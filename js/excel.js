/* field-check · js/excel.js — 엑셀 업로드 · 컬럼 재설정 · 결과 내보내기 · 원본 내려받기 (공통 ExcelUtil 사용) */
AppFiles.reg('js/excel.js','v3.10.0'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

/* ══════════ Excel 업로드 / 컬럼 재설정 (공통 ExcelUtil.createReader 사용) ══════════ */
let excelReader=null;
let _excelReaderHdr=null;     // 지금 리더가 쓰는 기본 머리글 행 (0 = 1행)
let _excelMode='upload';     // 'upload'(엑셀 업로드) | 'reset'(컬럼 재설정)
let _excelOrigFile=null;     // 업로드 모드에서 Storage에 원본 저장할 File
let _upOpts={mode:'add',skipDup:true,carry:true}; // 업로드 방식: add(기존 대상에 추가) | replace(지우고 바꾸기)
let _resetOpts={carry:true};                     // 컬럼 재설정: 같은 대상 기록 이어받기

// 머리글 행 추측: 맨 위에 제목·빈 줄(값이 한 칸 이하)이 있으면 그 아래 첫 표 줄을 머리글로
// 예) 크로스 체크 지도용 파일은 1행 제목, 2행 머리글 → 2행 / 보통 엑셀은 1행 머리글 → 1행
async function _guessHeaderRow(file){
  try{
    await ExcelUtil.loadSheetJS();
    const wb=XLSX.read(await file.arrayBuffer(),{type:'array',sheetRows:6});
    const aoa=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});
    const filled=r=>(r||[]).filter(c=>String(c).trim()).length;
    const i=aoa.findIndex(r=>filled(r)>=2);
    return i>=0&&i<=4?i:0;          // 업로드 창의 헤더 행 선택은 1~5행
  }catch{return 0;}
}
function getExcelReader(hdr=0){
  if(excelReader&&_excelReaderHdr===hdr)return excelReader;
  _excelReaderHdr=hdr;
  excelReader=ExcelUtil.createReader({
    columns:[
      {id:'name',label:'이름',required:true,keywords:['이름','명칭','건물','시설','대상','name','번호','용수']},
      {id:'addr',label:'주소',required:true,keywords:['주소','도로','지번','위치','addr']},
      {id:'group',label:'그룹/팀',keywords:['팀','구역','그룹','형식','형태','group','team']},
    ],
    // 정보카드에 보여 줄 나머지 칸(비고·구분 등)은 다음 단계(정보카드 항목 고르기 창)에서 여러 개 고름
    storageKey:'field-check',  // 이 앱만의 컬럼 설정 저장 칸 (다른 앱과 섞이지 않게)
    defaultHeaderRow:hdr, // 공통 ExcelUtil은 0부터 센다 (0 = 1행)
    confirmLabel:'확인',
    onConfirm:(headers,rows,mapping)=>_onExcelConfirm(headers,rows,mapping),
  });
  return excelReader;
}

// ━━ 업로드 ━━
// 대상이 이미 있으면 먼저 방식을 고름: 기존 대상에 추가 / 기존 대상을 지우고 바꾸기
function showUploadModal(){
  if(!currentProject){showToast('프로젝트를 먼저 선택하세요','err');return;}
  if(!items.length){_upOpts={mode:'add',skipDup:true,carry:true};_pickExcelFile();return;}
  document.getElementById('upCount').textContent=items.length.toLocaleString();
  document.getElementById('upModeAdd').checked=true;
  document.getElementById('upSkipDup').checked=true;
  document.getElementById('upCarry').checked=true;
  updateUploadModeUI();
  showModal('uploadModeModal');
}
function updateUploadModeUI(){
  const rep=document.getElementById('upModeReplace').checked;
  document.getElementById('upSubAdd').style.display=rep?'none':'';
  document.getElementById('upSubReplace').style.display=rep?'':'none';
  document.getElementById('upModeReplace').closest('.up-opt').classList.toggle('on',rep);
  document.getElementById('upModeAdd').closest('.up-opt').classList.toggle('on',!rep);
}
function proceedUpload(){
  const rep=document.getElementById('upModeReplace').checked;
  _upOpts={mode:rep?'replace':'add',skipDup:document.getElementById('upSkipDup').checked,carry:document.getElementById('upCarry').checked};
  hideModal('uploadModeModal');
  _pickExcelFile();   // 버튼을 누른 그 순간이라 파일 고르기 창이 막히지 않음
}
function _pickExcelFile(){
  const input=document.createElement('input');
  input.type='file';
  input.accept='.xlsx,.xls,.csv,.ods,.tsv';
  input.onchange=async()=>{
    const file=input.files[0];if(!file)return;
    _excelMode='upload';
    _excelOrigFile=file;
    await getExcelReader(await _guessHeaderRow(file)).open(file);
  };
  input.click();
}

// ━━ 컬럼 재설정 ━━
async function showResetColModal(){
  if(!currentProject){showToast('프로젝트를 먼저 선택하세요','err');return;}
  document.getElementById('resetCarry').checked=true;
  showModal('resetOptModal');
}
async function proceedReset(){
  hideModal('resetOptModal');
  _resetOpts={carry:document.getElementById('resetCarry').checked};
  showToast('원본 파일 확인 중...','');
  try{
    const store=sbClient().storage;
    const files=await _projectFiles();
    const orig=files.find(n=>n.startsWith('original.'));
    if(!orig)throw new Error('원본 파일이 없습니다 (최초 업로드 시 저장되지 않았거나 삭제됨)');
    // "기존 대상에 추가"로 올린 엑셀은 원본에 들어 있지 않음 → 재설정하면 그 대상은 빠짐
    const added=files.filter(n=>n.startsWith('added_')).length;
    if(added&&!confirm(`"기존 대상에 추가"로 올린 엑셀이 ${added}개 있습니다.\n컬럼 재설정은 처음 올린 원본 엑셀로만 대상을 다시 만들어서, 추가로 올린 대상은 빠집니다.\n\n계속할까요?`))return;
    const {data:blob,error:dlErr}=await store.from('inspection-files').download(`${currentProject.id}/${orig}`);
    if(dlErr||!blob)throw new Error('다운로드 실패');
    const file=new File([blob],orig,{type:blob.type||'application/octet-stream'});
    _excelMode='reset';
    _excelOrigFile=null; // 재설정 시 원본은 다시 저장하지 않음 (이미 Storage에 있음)
    await getExcelReader(await _guessHeaderRow(file)).open(file);
  }catch(e){
    showToast('원본 파일 불러오기 실패: '+e.message,'err');
  }
}
// 이 계획의 저장된 엑셀 파일 이름들 (original.xlsx, added_….xlsx)
async function _projectFiles(){
  const {data,error}=await sbClient().storage.from('inspection-files').list(String(currentProject.id),{limit:100});
  if(error)throw new Error(error.message);
  return (data||[]).map(f=>f.name).filter(Boolean);
}

// ━━ 공통 확인 핸들러 (업로드/재설정 분기) ━━
// 공통 ExcelUtil은 열 선택을 col._id(예: 'col_0_name') 이름으로 넘긴다 → 앱의 id('name')로 바꿔 찾는다
function _colIdx(mapping,id){
  if(mapping[id]!=null) return mapping[id];                       // 예전 방식(id 그대로)도 그대로 받음
  const col=(mapping._dynCols||[]).find(c=>c.id===id);
  const v=col?mapping[col._id]:null;
  return v!=null?v:null;
}
let _pendingExcel=null; // 정보카드 항목 고르기 창이 열려 있는 동안의 엑셀 내용
async function _onExcelConfirm(headers,rows,mapping){
  const idx={name:_colIdx(mapping,'name'),addr:_colIdx(mapping,'addr'),group:_colIdx(mapping,'group')};
  if(idx.name==null||idx.addr==null){showToast('이름·주소 컬럼을 지정하세요','err');return;}
  if(!rows.some(r=>String(r[idx.name]??'').trim())){showToast('가져올 행이 없습니다','err');return;}
  _pendingExcel={headers,rows,idx};
  showExtraColsModal();
}

// ━━ 정보카드 항목 고르기 ━━
// 이름·주소·그룹으로 쓴 칸을 뺀 나머지 엑셀 칸 중 정보카드에 보여 줄 칸을 고름 (엑셀 제목이 그대로 앞에 붙음)
const EXTRA_KEYWORDS=['비고','추가','기타','결과','검수','extra'];
const CC_INFO_COLS=['관할센터','등급','용도','전화번호'];   // 크로스 체크 지도용 파일의 정보 칸 — 처음에는 미리 골라 둠 (지난번 고른 칸이 있으면 그대로)
const KIND_COL='구분';   // 크로스 체크 지도용 파일의 업무 구분 열 (조사/훈련/조사·훈련) — 마커 모양·업무 구분 필터에 쓰여 늘 미리 골라 둠
function _extraColsKey(){return 'field_check_extra_cols_'+(currentProject?currentProject.id:'');}
function _headerLabels(headers){
  // 빈 제목은 'N열', 같은 제목이 또 있으면 뒤에 (2)(3)… 를 붙여 구분
  const seen={};
  return headers.map((h,i)=>{
    let t=String(h??'').trim()||`${i+1}열`;
    if(seen[t]){seen[t]++;t=`${t} (${seen[t]})`;}else seen[t]=1;
    return t;
  });
}
function showExtraColsModal(){
  const {headers,rows,idx}=_pendingExcel;
  const labels=_headerLabels(headers);
  const used=new Set([idx.name,idx.addr,idx.group].filter(v=>v!=null));
  const cand=labels.map((t,i)=>({i,t})).filter(c=>!used.has(c.i));
  // 미리 고를 칸: ① 이 계획에서 지난번 고른 칸 ② 지금 대상들의 정보카드 항목 이름 ③ 비고·기타 같은 이름
  let prev=null;
  try{prev=JSON.parse(localStorage.getItem(_extraColsKey())||'null');}catch(e){}
  const shown=new Set();
  items.forEach(d=>{if(d.extra&&typeof d.extra==='object')Object.keys(d.extra).forEach(k=>shown.add(k));});
  const pick=c=>c.t===KIND_COL?true:Array.isArray(prev)?prev.includes(c.t)
    :CC_INFO_COLS.includes(c.t)?true
    :shown.size?shown.has(c.t)
    :EXTRA_KEYWORDS.some(k=>c.t.toLowerCase().includes(k));
  // 칸마다 보기 값 (값이 있는 첫 행)
  const sample=i=>{const r=rows.find(r=>String(r[i]??'').trim());return r?String(r[i]).trim():'';};
  const el=document.getElementById('xcList');
  if(!cand.length){
    el.innerHTML='<div class="xc-empty">이름·주소·그룹 말고 남은 칸이 없습니다. 그대로 진행하세요.</div>';
  }else{
    el.innerHTML=cand.map(c=>{
      const v=sample(c.i);
      return `<label class="xc-item"><input type="checkbox" value="${c.i}" ${pick(c)?'checked':''} onchange="updateExtraColsCount()">
        <span class="xc-name">${esc(c.t)}</span><span class="xc-sample">${v?esc(v.length>28?v.slice(0,28)+'…':v):'(빈 칸)'}</span></label>`;
    }).join('');
  }
  document.getElementById('xcGoBtn').textContent=_excelMode==='reset'?'재설정':_upOpts.mode==='replace'?'바꾸기':'올리기';
  updateExtraColsCount();
  showModal('extraColsModal');
}
function updateExtraColsCount(){
  const n=document.querySelectorAll('#xcList input:checked').length;
  document.getElementById('xcCount').textContent=n?`${n}개 고름`:'고른 칸 없음 — 정보카드에는 이름·주소만 나옵니다';
}
function setAllExtraCols(on){
  document.querySelectorAll('#xcList input').forEach(c=>{c.checked=on;});
  updateExtraColsCount();
}
function cancelExtraCols(){_pendingExcel=null;hideModal('extraColsModal');}
async function confirmExtraCols(){
  if(!_pendingExcel)return;
  const {headers,rows,idx}=_pendingExcel;
  const labels=_headerLabels(headers);
  const chosen=[...document.querySelectorAll('#xcList input:checked')].map(c=>+c.value);
  try{localStorage.setItem(_extraColsKey(),JSON.stringify(chosen.map(i=>labels[i])));}catch(e){}
  _pendingExcel=null;
  hideModal('extraColsModal');
  const clean=v=>String(v??'').replace(/^\s+|\s+$/g,'').replace(/\s+/g,' ');
  const parsed=rows.map(r=>{
    const extra={};
    chosen.forEach(i=>{const v=String(r[i]??'').trim();if(v&&v!=='-')extra[labels[i]]=v;}); // 빈 칸·'-'(모름)은 넣지 않음
    return{
      name:clean(r[idx.name]),
      address:clean(r[idx.addr]),
      group_name:idx.group!=null?String(r[idx.group]??'').trim():null,
      extra:Object.keys(extra).length?extra:null,
    };
  }).filter(d=>d.name);

  if(!parsed.length){showToast('가져올 행이 없습니다','err');return;}

  if(_excelMode==='reset')await _runReplace(parsed,{carry:_resetOpts.carry,label:'재설정'});
  else if(_upOpts.mode==='replace')await _runReplace(parsed,{carry:_upOpts.carry,label:'바꾸기',file:_excelOrigFile});
  else await _runUpload(parsed,{skipDup:_upOpts.skipDup,file:_excelOrigFile});
}

// ━━ 대상 넣기 도우미 ━━
// 같은 대상인지: 이름·주소의 띄어쓰기·대소문자를 무시하고 비교
function _itemKey(d){const n=v=>String(v??'').replace(/\s+/g,'').toLowerCase();return n(d.name)+'|'+n(d.address);}
// 주소 → 좌표 찾고 한 곳씩 넣음. 넣은 행(새 id 포함)을 돌려줌
async function _insertItems(parsed,word){
  const pid=currentProject.id,rows=[];let fail=0;
  for(let i=0;i<parsed.length;i++){
    const d=parsed[i];
    showToast(`(${i+1}/${parsed.length}) ${d.name} ${word} 중...`,'');
    let lat=null,lng=null;
    try{const geo=await geocodeAddr(d.address);if(geo){lat=geo.lat;lng=geo.lng;}}catch{}
    try{
      const [row]=await SupabaseUtil.insert('inspection_items',{inspection_id:pid,name:d.name,address:d.address,group_name:d.group_name||null,lat,lng,extra:d.extra||null});
      if(row&&row.id!=null)rows.push(row);else fail++;
    }catch{fail++;}
    if(i%5===0)await sleep(50);
  }
  return {rows,fail};
}
// 여러 행을 한꺼번에 지움 (주소 길이 제한 때문에 100개씩)
async function _deleteIn(table,col,vals){
  for(let i=0;i<vals.length;i+=100){
    const {error}=await sbClient().from(table).delete().in(col,vals.slice(i,i+100));
    if(error)throw new Error(`${table} 삭제: ${error.message}`);
  }
}
// 원본 엑셀 저장. replace=true면 예전 파일(원본·추가분)을 지우고 이 파일을 새 원본으로
async function _saveExcelFile(file,{asOriginal,replace}){
  if(!file||!currentProject)return;
  const pid=currentProject.id,ext=(file.name.split('.').pop()||'xlsx').toLowerCase();
  try{
    if(replace){
      const old=(await _projectFiles()).filter(n=>n.startsWith('original.')||n.startsWith('added_'));
      if(old.length)await sbClient().storage.from('inspection-files').remove(old.map(n=>`${pid}/${n}`));
    }
    const name=asOriginal?`original.${ext}`:`added_${Date.now()}.${ext}`;
    await SupabaseUtil.uploadFile('inspection-files',`${pid}/${name}`,file);
  }catch(e){console.warn('엑셀 파일 저장 실패',e);}
}

// ━━ 기존 대상에 추가 ━━
async function _runUpload(parsed,{skipDup,file}){
  const had=items.length;
  let todo=parsed,skipped=0;
  if(skipDup&&had){
    const have=new Set(items.map(_itemKey));
    todo=parsed.filter(d=>!have.has(_itemKey(d)));
    skipped=parsed.length-todo.length;
  }
  if(!todo.length){showToast(`새로 넣을 대상이 없습니다 (${skipped}곳 모두 이미 있음)`,'err');return;}
  const {rows,fail}=await _insertItems(todo,'추가');
  // 처음 올리는 파일은 원본으로, 그다음부터는 추가분으로 따로 보관 (원본을 덮어쓰지 않음)
  let hasOrig=false;
  try{hasOrig=(await _projectFiles()).some(n=>n.startsWith('original.'));}catch{}
  await _saveExcelFile(file,{asOriginal:!had||!hasOrig,replace:false});
  showToast(`✅ ${rows.length}곳 추가`+(skipped?` · 이미 있는 ${skipped}곳 건너뜀`:'')+(fail?` · ${fail}곳 실패`:''),fail?'err':'ok');
  await loadProjectData();
}

// ━━ 기존 대상을 지우고 바꾸기 (엑셀 업로드 "바꾸기" · 컬럼 재설정 공통) ━━
// 순서: ① 새 대상 넣기 → ② 같은 대상의 완료·메모·사진을 새 대상으로 옮기기 → ③ 남은 기록 정리 → ④ 옛 대상 지우기
// ①이 하나라도 실패하면 넣은 것을 지우고 멈춤 → 옛 대상은 그대로 남음
async function _runReplace(parsed,{carry,label,file}){
  const pid=currentProject.id;
  try{
    const oldItems=await sbSelectAll('inspection_items',{eq:{inspection_id:pid},columns:'id,name,address'});
    // ①
    const {rows:newRows,fail}=await _insertItems(parsed,label);
    if(fail){
      try{await _deleteIn('inspection_items','id',newRows.map(r=>r.id));}catch(e){console.warn(e);}
      showToast(`${fail}곳을 넣지 못해 ${label==='재설정'?'재설정을':'바꾸기를'} 멈췄습니다. 기존 대상은 그대로입니다`,'err');
      await loadProjectData();return;
    }
    const newIds=new Set(newRows.map(r=>String(r.id)));
    const [doneArr,memoArr,photoArr]=await Promise.all([
      sbSelectAll('inspection_done',{eq:{inspection_id:pid},key:'item_id'}),
      sbSelectAll('inspection_memo',{eq:{inspection_id:pid},key:'item_id'}),
      sbSelectAll('inspection_photos',{eq:{inspection_id:pid}}),
    ]);
    // ② 이어받기: 옛 대상 → 이름·주소가 같은 새 대상 (같은 대상이 여러 개면 순서대로 짝지음)
    let moved=0;
    if(carry){
      const queue={};
      newRows.forEach(r=>{(queue[_itemKey(r)]=queue[_itemKey(r)]||[]).push(r.id);});
      const pair={};
      oldItems.forEach(o=>{const q=queue[_itemKey(o)];if(q&&q.length)pair[o.id]=q.shift();});
      const has=new Set([...doneArr,...memoArr,...photoArr].map(r=>String(r.item_id)));
      const olds=Object.keys(pair).filter(id=>has.has(String(id)));
      const strip=(r,drop)=>{const c={...r};drop.forEach(k=>delete c[k]);return c;};
      for(let i=0;i<olds.length;i++){
        const o=olds[i],n=pair[o];
        showToast(`(${i+1}/${olds.length}) 완료·메모·사진 이어받는 중...`,'');
        // 새 대상으로 복사한 뒤 옛 기록을 지움 (사진 파일은 그대로 두고 주소만 이어 씀)
        const d=doneArr.find(r=>String(r.item_id)===String(o));
        if(d){await SupabaseUtil.upsert('inspection_done',{...strip(d,['id']),item_id:n},'item_id');await SupabaseUtil.remove('inspection_done',{item_id:o});}
        const m=memoArr.find(r=>String(r.item_id)===String(o));
        if(m){await SupabaseUtil.upsert('inspection_memo',{...strip(m,['id']),item_id:n},'item_id');await SupabaseUtil.remove('inspection_memo',{item_id:o});}
        const ps=photoArr.filter(r=>String(r.item_id)===String(o));
        if(ps.length){
          await SupabaseUtil.insert('inspection_photos',ps.map(p=>({...strip(p,['id']),item_id:n})));
          await _deleteIn('inspection_photos','id',ps.map(p=>p.id));
        }
        moved++;
      }
    }
    // ③ 새 대상에 붙지 않은 기록 정리 (사진은 파일까지)
    showToast('남은 기록 정리 중...','');
    const [d2,m2,p2]=await Promise.all([
      sbSelectAll('inspection_done',{eq:{inspection_id:pid},key:'item_id',columns:'item_id'}),
      sbSelectAll('inspection_memo',{eq:{inspection_id:pid},key:'item_id',columns:'item_id'}),
      sbSelectAll('inspection_photos',{eq:{inspection_id:pid},columns:'id,item_id,url'}),
    ]);
    const stray=r=>!newIds.has(String(r.item_id));
    const dropDone=d2.filter(stray).map(r=>r.item_id),dropMemo=m2.filter(stray).map(r=>r.item_id),dropPhoto=p2.filter(stray);
    if(dropPhoto.length){
      const paths=dropPhoto.map(p=>String(p.url||'').split(`/${PHOTO_BUCKET}/`)[1]).filter(Boolean).map(decodeURIComponent);
      for(let i=0;i<paths.length;i+=100){try{await sbClient().storage.from(PHOTO_BUCKET).remove(paths.slice(i,i+100));}catch(e){console.warn(e);}}
      await _deleteIn('inspection_photos','id',dropPhoto.map(p=>p.id));
    }
    if(dropDone.length)await _deleteIn('inspection_done','item_id',dropDone);
    if(dropMemo.length)await _deleteIn('inspection_memo','item_id',dropMemo);
    // ④ 옛 대상 지우기
    showToast('기존 대상 지우는 중...','');
    await _deleteIn('inspection_items','id',oldItems.map(o=>o.id).filter(id=>!newIds.has(String(id))));
    if(file)await _saveExcelFile(file,{asOriginal:true,replace:true});
    const lost=new Set([...dropDone,...dropMemo,...dropPhoto.map(p=>p.item_id)].map(String)).size;
    showToast(`✅ ${label} 완료: 대상 ${newRows.length}곳`+(carry?` · 기록 이어받음 ${moved}곳`:'')+(lost?` · 기록 지움 ${lost}곳`:''),'ok');
  }catch(e){
    showToast(`${label} 중 오류: `+e.message,'err');
  }
  await loadProjectData();
}

/* ══════════ Excel Export ══════════ */
async function exportExcel(){
  const stamp=new Date().toISOString().slice(0,10).replace(/-/g,'');
  // 정보카드 항목(엑셀에서 가져온 칸)도 결과 엑셀에 그대로 넣음 — 이름이 겹치면 앞에 '정보-'를 붙임
  // ('구분'은 아래 고정 열에 짧은 문구로 들어가므로 따로 넣지 않음)
  const fixed=['이름','주소','그룹','구분','점검완료','점검일자','점검결과','사진수'];
  const extraKeys=[];
  items.forEach(d=>{if(d.extra&&typeof d.extra==='object')Object.keys(d.extra).forEach(k=>{if(k!=='구분'&&!extraKeys.includes(k))extraKeys.push(k);});});
  const extraCol=k=>fixed.includes(k)?'정보-'+k:k;
  const allRows=items.map(d=>({
    '이름':d.name,'주소':d.address||'','그룹':d.group_name||'','구분':itemKind(d)?kindLabel(itemKind(d)):'',
    ...Object.fromEntries(extraKeys.map(k=>[extraCol(k),(d.extra&&d.extra[k])??''])),
    '점검완료':doneMap[d.id]?'○':'',
    '점검일자':doneMap[d.id]?.done_at?new Date(doneMap[d.id].done_at).toLocaleDateString('ko-KR'):'',
    '점검결과':memoMap[d.id]||'',
    '사진수':(photoMap[d.id]?.length)||0,
  }));
  const doneRows=allRows.filter((_,i)=>!!doneMap[items[i].id]);
  const undoneRows=allRows.filter((_,i)=>!doneMap[items[i].id]);
  await ExcelUtil.download([
    {name:'전체현황',rows:allRows},
    {name:'점검완료',rows:doneRows.length?doneRows:[{'안내':'완료 없음'}]},
    {name:'미완료',rows:undoneRows.length?undoneRows:[{'안내':'미완료 없음'}]},
  ],`${currentProject?.name||'점검결과'}_${stamp}.xlsx`);
  showToast('📊 엑셀 저장 완료','ok');
}

// ━━ 원본 파일 다운로드 ━━
async function downloadOriginalFile(){
  if(!currentProject){showToast('프로젝트를 먼저 선택하세요','err');return;}
  showToast('원본 파일 확인 중...','');
  try{
    const store=sbClient().storage;
    const {data:files}=await store.from('inspection-files').list(String(currentProject.id),{limit:10});
    const orig=Array.isArray(files)?files.find(f=>f.name&&f.name.startsWith('original.')):null;
    if(!orig)throw new Error('NO_FILE');
    const {data:blob,error:dlErr}=await store.from('inspection-files').download(`${currentProject.id}/${orig.name}`);
    if(dlErr||!blob)throw new Error('다운로드 실패');
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`${currentProject.name}_원본.${orig.name.split('.').pop()||'xlsx'}`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ 원본 파일 다운로드 완료','ok');
  }catch(e){
    if(e.message==='NO_FILE') showToast('저장된 원본 파일이 없습니다','err');
    else showToast('다운로드 실패: '+e.message,'err');
  }
}
