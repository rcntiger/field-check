/* field-check · js/excel.js — 엑셀 업로드 · 컬럼 재설정 · 결과 내보내기 · 원본 내려받기 (공통 ExcelUtil 사용) */
AppFiles.reg('js/excel.js','v3.1.2'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

/* ══════════ Excel 업로드 / 컬럼 재설정 (공통 ExcelUtil.createReader 사용) ══════════ */
let excelReader=null;
let _excelMode='upload';     // 'upload' | 'reset'
let _excelOrigFile=null;     // 업로드 모드에서 Storage에 원본 저장할 File
let _resetOpts={delDone:false,delMemo:false,delPhotos:false};

function getExcelReader(){
  if(excelReader)return excelReader;
  excelReader=ExcelUtil.createReader({
    columns:[
      {id:'name',label:'이름',required:true,keywords:['이름','명칭','건물','시설','대상','name','번호','용수']},
      {id:'addr',label:'주소',required:true,keywords:['주소','도로','지번','위치','addr']},
      {id:'group',label:'그룹/팀',keywords:['팀','구역','그룹','형식','형태','group','team']},
      {id:'extra',label:'추가정보',keywords:['비고','추가','기타','결과','검수','extra']},
    ],
    defaultHeaderRow:1,
    confirmLabel:'확인',
    onConfirm:(headers,rows,mapping)=>_onExcelConfirm(rows,mapping),
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
    await getExcelReader().open(file);
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
    await getExcelReader().open(file);
  }catch(e){
    showToast('원본 파일 불러오기 실패: '+e.message,'err');
  }
}

// ━━ 공통 확인 핸들러 (업로드/재설정 분기) ━━
async function _onExcelConfirm(rows,mapping){
  const parsed=rows.map(r=>({
    name:String(mapping.name!=null?r[mapping.name]:'').replace(/^\s+|\s+$/g,'').replace(/\s+/g,' '),
    address:String(mapping.addr!=null?r[mapping.addr]:'').replace(/^\s+|\s+$/g,'').replace(/\s+/g,' '),
    group_name:mapping.group!=null?String(r[mapping.group]||'').trim():null,
    extra:mapping.extra!=null?{정보:String(r[mapping.extra]||'').trim()}:null,
  })).filter(d=>d.name);

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
  const allRows=items.map(d=>({
    '이름':d.name,'주소':d.address||'','그룹':d.group_name||'',
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
