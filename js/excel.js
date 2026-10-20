/* field-check · js/excel.js — 엑셀 업로드 · 컬럼 재설정 · 결과 내보내기 · 원본 내려받기 (공통 ExcelUtil 사용) */
AppFiles.reg('js/excel.js','v3.6.0'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

/* ══════════ Excel 업로드 / 컬럼 재설정 (공통 ExcelUtil.createReader 사용) ══════════ */
let excelReader=null;
let _excelReaderHdr=null;     // 지금 리더가 쓰는 기본 머리글 행 (0 = 1행)
let _excelMode='upload';     // 'upload' | 'reset'
let _excelOrigFile=null;     // 업로드 모드에서 Storage에 원본 저장할 File
let _resetOpts={delDone:false,delMemo:false,delPhotos:false};

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
function showUploadModal(){
  if(!currentProject){showToast('프로젝트를 먼저 선택하세요','err');return;}
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
  document.getElementById('resetDelDone').checked=false;
  document.getElementById('resetDelMemo').checked=false;
  document.getElementById('resetDelPhotos').checked=false;
  showModal('resetOptModal');
}
async function proceedReset(){
  hideModal('resetOptModal');
  _resetOpts={
    delDone:document.getElementById('resetDelDone').checked,
    delMemo:document.getElementById('resetDelMemo').checked,
    delPhotos:document.getElementById('resetDelPhotos').checked,
  };
  showToast('원본 파일 확인 중...','');
  try{
    const store=sbClient().storage;
    const {data:files}=await store.from('inspection-files').list(String(currentProject.id),{limit:10});
    const orig=Array.isArray(files)?files.find(f=>f.name&&f.name.startsWith('original.')):null;
    if(!orig)throw new Error('원본 파일이 없습니다 (최초 업로드 시 저장되지 않았거나 삭제됨)');
    const {data:blob,error:dlErr}=await store.from('inspection-files').download(`${currentProject.id}/${orig.name}`);
    if(dlErr||!blob)throw new Error('다운로드 실패');
    const file=new File([blob],orig.name,{type:blob.type||'application/octet-stream'});
    _excelMode='reset';
    _excelOrigFile=null; // 재설정 시 원본은 다시 저장하지 않음 (이미 Storage에 있음)
    await getExcelReader(await _guessHeaderRow(file)).open(file);
  }catch(e){
    showToast('원본 파일 불러오기 실패: '+e.message,'err');
  }
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
  document.getElementById('xcGoBtn').textContent=_excelMode==='reset'?'재설정':'올리기';
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
    chosen.forEach(i=>{const v=String(r[i]??'').trim();if(v)extra[labels[i]]=v;}); // 빈 칸은 넣지 않음
    return{
      name:clean(r[idx.name]),
      address:clean(r[idx.addr]),
      group_name:idx.group!=null?String(r[idx.group]??'').trim():null,
      extra:Object.keys(extra).length?extra:null,
    };
  }).filter(d=>d.name);

  if(!parsed.length){showToast('가져올 행이 없습니다','err');return;}

  if(_excelMode==='reset'){
    await _runReset(parsed);
  }else{
    await _runUpload(parsed);
  }
}

async function _runUpload(parsed){
  // 원본 파일 Storage에 저장
  if(_excelOrigFile&&currentProject){
    try{
      const path=`${currentProject.id}/original.${_excelOrigFile.name.split('.').pop()||'xlsx'}`;
      await SupabaseUtil.uploadFile('inspection-files',path,_excelOrigFile);
    }catch(e){console.warn('원본 파일 저장 실패',e);}
  }

  let ok=0;
  for(let i=0;i<parsed.length;i++){
    const d=parsed[i];
    showToast(`(${i+1}/${parsed.length}) ${d.name} 업로드 중...`,'');
    let lat=null,lng=null;
    try{const geo=await geocodeAddr(d.address);if(geo){lat=geo.lat;lng=geo.lng;}}catch{}
    try{
      await SupabaseUtil.insert('inspection_items',{inspection_id:currentProject.id,name:d.name,address:d.address,group_name:d.group_name||null,lat,lng,extra:d.extra||null});
      ok++;
    }catch{}
    if(i%5===0)await sleep(50);
  }
  showToast(`${ok}/${parsed.length}개 업로드 완료`,'ok');
  await loadProjectData();
}

async function _runReset(parsed){
  const pid=currentProject.id;
  const {delDone,delMemo,delPhotos}=_resetOpts;
  try{
    if(delPhotos){
      showToast('사진 삭제 중...','');
      const photos=Object.values(photoMap).flat();
      const paths=photos.map(p=>p.url.split(`/${PHOTO_BUCKET}/`)[1]).filter(Boolean);
      if(paths.length)await sbClient().storage.from(PHOTO_BUCKET).remove(paths);
      await SupabaseUtil.remove('inspection_photos',{inspection_id:pid});
    }
    if(delMemo){showToast('메모 삭제 중...','');await SupabaseUtil.remove('inspection_memo',{inspection_id:pid});}
    if(delDone){showToast('완료 기록 삭제 중...','');await SupabaseUtil.remove('inspection_done',{inspection_id:pid});}

    showToast('기존 항목 삭제 중...','');
    await SupabaseUtil.remove('inspection_items',{inspection_id:pid});

    let ok=0;
    for(let i=0;i<parsed.length;i++){
      const d=parsed[i];
      showToast(`(${i+1}/${parsed.length}) ${d.name} 재설정 중...`,'');
      let lat=null,lng=null;
      try{const geo=await geocodeAddr(d.address);if(geo){lat=geo.lat;lng=geo.lng;}}catch{}
      try{
        await SupabaseUtil.insert('inspection_items',{inspection_id:pid,name:d.name,address:d.address,group_name:d.group_name||null,lat,lng,extra:d.extra||null});
        ok++;
      }catch{}
      if(i%5===0)await sleep(50);
    }
    showToast(`✅ 재설정 완료 (${ok}/${parsed.length}개)`,'ok');
    await loadProjectData();
  }catch(e){
    showToast('재설정 실패: '+e.message,'err');
  }
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
