/* field-check · js/project.js — 홈 화면: 계획 목록 · 보관 기한 · 계획 생성/수정/삭제 */
AppFiles.reg('js/project.js','v2.0.2'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

/* ══════════ Home / Project ══════════ */
// 만료 배지 HTML 생성 (공통)
function expireBadgeHtml(expire_at){
  if(!expire_at)return `<span class="badge" style="background:rgba(255,255,255,.05);color:var(--mt)">📅 영구 보관</span>`;
  const exp=new Date(expire_at);
  const dDay=Math.ceil((exp-new Date())/(1000*60*60*24));
  const date=exp.toLocaleDateString('ko-KR');
  if(dDay<0) return `<span class="badge" style="background:rgba(239,68,68,.15);color:#ef4444;font-weight:700">⚠️ 만료됨 (${date})</span>`;
  if(dDay<=30) return `<span class="badge" style="background:rgba(251,146,60,.15);color:#fb923c;font-weight:700">⏰ D-${dDay} · ${date}까지</span>`;
  return `<span class="badge" style="background:rgba(255,255,255,.05);color:var(--mt)">📅 ${date}까지</span>`;
}
// 카드 메타(개소/완료/생성일/만료) HTML 생성 (공통)
function cardMetaHtml(p){
  const total=p._total==='-'?'-':(p._total||0);
  const done=p._done==='-'?'-':(p._done||0);
  const pct=(typeof total==='number'&&total)?Math.round(done/total*100):0;
  return `
    <span class="badge" style="background:rgba(47,129,247,.1);color:var(--ac)">${total}개소</span>
    <span class="badge" style="background:rgba(63,185,80,.1);color:var(--lo)">${done}완료 ${pct}%</span>
    <span class="badge" style="background:rgba(255,255,255,.05);color:var(--mt)">${new Date(p.created_at).toLocaleDateString('ko-KR')}</span>
    ${expireBadgeHtml(p.expire_at)}`;
}

async function loadProjects(){
  try{
    const projs=await SupabaseUtil.select('inspections',{order:{column:'created_at',ascending:false}});
    if(!Array.isArray(projs))throw new Error('응답 형식 오류');
    // 먼저 목록 표시 (건수 없이)
    projs.forEach(p=>{p._total='-';p._done='-';});
    renderProjects(projs);
    // 건수 일괄 로드: 전체 items/done을 2번 쿼리로 가져와 JS 집계 (N+1 제거)
    try{
      const [allItems,allDone]=await Promise.all([
        SupabaseUtil.select('inspection_items',{columns:'inspection_id'}),
        SupabaseUtil.select('inspection_done',{columns:'inspection_id'})
      ]);
      const totalMap={},doneMap2={};
      if(Array.isArray(allItems))allItems.forEach(x=>{totalMap[x.inspection_id]=(totalMap[x.inspection_id]||0)+1;});
      if(Array.isArray(allDone))allDone.forEach(x=>{doneMap2[x.inspection_id]=(doneMap2[x.inspection_id]||0)+1;});
      projs.forEach(p=>{
        p._total=totalMap[p.id]||0;
        p._done=doneMap2[p.id]||0;
        const card=document.getElementById('pcard-'+p.id);
        if(card){
          const meta=card.querySelector('.project-card-meta');
          if(meta)meta.innerHTML=cardMetaHtml(p);
        }
      });
    }catch(e){console.warn('건수 로드 실패',e);}
  }catch(e){
    showToast('프로젝트 로드 실패: '+e.message,'err');
    console.error('loadProjects 오류:',e);
  }
}
function renderProjects(list){
  projectList=list;
  const grid=document.getElementById('projectGrid');
  if(!grid)return;
  // empty 요소를 먼저 분리 보관
  const empty=document.getElementById('projectEmpty');
  if(empty&&empty.parentNode===grid)grid.removeChild(empty);
  grid.innerHTML='';
  if(!list.length){
    if(empty){empty.style.display='block';grid.appendChild(empty);}
    return;
  }
  if(empty)empty.style.display='none';
  const frag=document.createDocumentFragment();
  list.forEach(p=>{
    const card=document.createElement('div');
    card.className='project-card';
    card.id='pcard-'+p.id;
    card.innerHTML=`
      <button class="project-card-del" onclick="event.stopPropagation();deleteProject('${p.id}','${esc(p.name)}')" title="삭제">✕</button>
      <button class="project-card-edit" onclick="event.stopPropagation();showEditModal('${p.id}')" title="수정">✏️</button>
      <div class="project-card-name">${esc(p.name)}</div>
      <div class="project-card-desc">${esc(p.description||'')}</div>
      <div class="project-card-meta">${cardMetaHtml(p)}</div>`;
    card.onclick=()=>openProject(p);
    frag.appendChild(card);
  });
  grid.appendChild(frag);
}
function showCreateModal(){document.getElementById('projName').value='';document.getElementById('projDesc').value='';document.getElementById('projExpire').value='';showModal('createModal');}

function showEditModal(id){
  const p=projectList.find(x=>x.id===id);
  if(!p){showToast('프로젝트 정보를 찾을 수 없습니다','err');return;}
  document.getElementById('editProjId').value=p.id;
  document.getElementById('editProjName').value=p.name||'';
  document.getElementById('editProjDesc').value=p.description||'';
  // 현재 만료일 표시
  const info=document.getElementById('editExpireInfo');
  if(p.expire_at){
    const exp=new Date(p.expire_at);
    const dDay=Math.ceil((exp-new Date())/(1000*60*60*24));
    info.textContent=`현재: ${exp.toLocaleDateString('ko-KR')} (${dDay>0?'D-'+dDay:'만료됨'})`;
    info.style.color=dDay<=0?'#ef4444':dDay<=30?'#fb923c':'var(--mt)';
  }else{
    info.textContent='현재: 영구 보관';
    info.style.color='var(--mt)';
  }
  document.getElementById('editProjExpire').value='';
  showModal('editModal');
}
async function saveEditProject(){
  const id=document.getElementById('editProjId').value;
  const name=document.getElementById('editProjName').value.trim();
  if(!name){showToast('프로젝트명을 입력하세요','err');return;}
  const desc=document.getElementById('editProjDesc').value.trim();
  const expireMonths=document.getElementById('editProjExpire').value;
  const patch={name,description:desc};
  if(expireMonths===''){
    // 선택 안 함 → 기존 유지 (변경 안 함)
  }else if(expireMonths==='clear'){
    patch.expire_at=null;
  }else{
    const d=new Date();
    d.setMonth(d.getMonth()+parseInt(expireMonths));
    patch.expire_at=d.toISOString();
  }
  try{
    await SupabaseUtil.update('inspections',patch,{id});
    hideModal('editModal');
    showToast('수정됨','ok');
    loadProjects();
  }catch(e){showToast('수정 실패','err');}
}
async function createProject(){
  const name=document.getElementById('projName').value.trim();
  if(!name){showToast('프로젝트명을 입력하세요','err');return;}
  const desc=document.getElementById('projDesc').value.trim();
  const expireMonths=document.getElementById('projExpire').value;
  let expire_at=null;
  if(expireMonths){
    const d=new Date();
    d.setMonth(d.getMonth()+parseInt(expireMonths));
    expire_at=d.toISOString();
  }
  try{
    const [proj]=await SupabaseUtil.insert('inspections',{name,description:desc,expire_at});
    hideModal('createModal');
    showToast('프로젝트 생성됨','ok');
    openProject(proj);
  }catch(e){showToast('생성 실패','err');}
}
async function deleteProject(id,name){
  if(!confirm(`"${name}" 프로젝트를 삭제하시겠습니까?\n(모든 점검 데이터 및 사진, 원본 파일이 삭제됩니다)`))return;
  try{
    showToast('삭제 중...','');
    const store=sbClient().storage;

    // 1. Storage 사진 삭제 (item_id 폴더별)
    try{
      const itemIds=(await SupabaseUtil.select('inspection_items',{eq:{inspection_id:id},columns:'id'})).map(i=>i.id);
      for(const itemId of itemIds){
        const {data:files}=await store.from(PHOTO_BUCKET).list(String(itemId),{limit:100});
        if(Array.isArray(files)&&files.length){
          await store.from(PHOTO_BUCKET).remove(files.map(f=>`${itemId}/${f.name}`));
        }
      }
    }catch(e){console.warn('사진 Storage 삭제 실패',e);}

    // 2. Storage 원본 엑셀 삭제
    try{
      const {data:files}=await store.from('inspection-files').list(String(id),{limit:10});
      if(Array.isArray(files)&&files.length){
        await store.from('inspection-files').remove(files.map(f=>`${id}/${f.name}`));
      }
    }catch(e){console.warn('원본 엑셀 Storage 삭제 실패',e);}

    // 3. DB 삭제 (CASCADE 없을 경우 대비 순서대로)
    await SupabaseUtil.remove('inspection_photos',{inspection_id:id});
    await SupabaseUtil.remove('inspection_memo',{inspection_id:id});
    await SupabaseUtil.remove('inspection_done',{inspection_id:id});
    await SupabaseUtil.remove('inspection_items',{inspection_id:id});
    await SupabaseUtil.remove('inspections',{id});

    showToast('프로젝트 삭제 완료','ok');
    loadProjects();
  }catch(e){showToast('삭제 실패: '+e.message,'err');}
}
