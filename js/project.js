/* field-check · js/project.js — 홈 화면: 계획 목록 · 보관 기한 · 계획 생성/수정/삭제 */
AppFiles.reg('js/project.js','v3.1.2'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

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
// 계획 한 줄의 상태 — 왼쪽 색 띠와 진행 막대 색을 정함 (css/home.css 의 data-state)
//   load: 건수 불러오는 중 · empty: 대상 없음 · run: 진행 중 · done: 모두 완료 · expired: 보관 기한 지남
function cardState(p){
  if(p.expire_at&&new Date(p.expire_at)<new Date())return 'expired';
  if(typeof p._total!=='number')return 'load';
  if(!p._total)return 'empty';
  return (p._done||0)>=p._total?'done':'run';
}
// 계획 한 줄의 아래쪽(진행 막대 · 건수 · 만든 날 · 보관 기한) HTML 생성 (공통)
function cardMetaHtml(p){
  const loaded=typeof p._total==='number';
  const total=loaded?p._total:0;
  const done=loaded?(p._done||0):0;
  const pct=total?Math.round(done/total*100):0;
  const num=!loaded?'<span>불러오는 중</span>'
    :!total?'<span>점검 대상 없음</span>'
    :`${done} <span>/ ${total}곳 완료</span> ${pct}%`;
  return `
    <div class="pc-prog"><div class="pc-bar"><i style="width:${pct}%"></i></div><div class="pc-num">${num}</div></div>
    <div class="pc-info"><span>${new Date(p.created_at).toLocaleDateString('ko-KR')} 만듦</span>${expireBadgeHtml(p.expire_at)}</div>`;
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
          card.dataset.state=cardState(p);
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
    card.dataset.state=cardState(p);
    card.tabIndex=0;
    card.setAttribute('role','button');
    card.innerHTML=`
      <div class="project-card-btns">
        <button class="project-card-btn" onclick="event.stopPropagation();showEditModal('${p.id}')" title="수정" aria-label="계획 수정">✏️</button>
        <button class="project-card-btn del" onclick="event.stopPropagation();deleteProject('${p.id}','${esc(p.name)}')" title="삭제" aria-label="계획 삭제">✕</button>
      </div>
      <div class="project-card-name">${esc(p.name)}</div>
      <div class="project-card-desc">${esc(p.description||'')}</div>
      <div class="project-card-meta">${cardMetaHtml(p)}</div>`;
    card.onclick=()=>openProject(p);
    card.onkeydown=e=>{if(e.key==='Enter'&&e.target===card)openProject(p);};
    frag.appendChild(card);
  });
  grid.appendChild(frag);
}
function showCreateModal(){
  document.getElementById('projName').value='';document.getElementById('projDesc').value='';document.getElementById('projExpire').value='';
  document.getElementById('projPw').value='';document.getElementById('projPwShow').checked=false;togglePwShow('projPw',false);
  showModal('createModal');
}
// 비밀번호 칸 보기/가리기
function togglePwShow(inputId,show){const el=document.getElementById(inputId);if(el)el.type=show?'text':'password';}
// DB 함수 호출 오류를 사람이 읽을 말로 (v3.0.0 SQL을 아직 실행하지 않은 경우 안내)
function rpcErrMsg(e){
  const m=(e&&e.message)||String(e||'');
  if((e&&(e.code==='PGRST202'||e.code==='42883'))||/could not find the function|does not exist/i.test(m))
    return 'DB 설정이 아직 적용되지 않았습니다 (sql/v3.0.0_delete_password.sql 실행 필요)';
  return m;
}

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
  const pw=document.getElementById('projPw').value;
  if(pw.length<4){showToast('삭제 비밀번호를 4자 이상 입력하세요','err');document.getElementById('projPw').focus();return;}
  try{
    // 계획과 삭제 비밀번호를 DB 함수로 한 번에 저장 (비밀번호는 암호화되어 보관되고 앱에서는 읽을 수 없음)
    const {data,error}=await sbClient().rpc('inspection_create',{p_name:name,p_description:desc,p_expire_at:expire_at,p_password:pw});
    if(error)throw error;
    const proj=Array.isArray(data)?data[0]:data;
    if(!proj||proj.id==null)throw new Error('응답 형식 오류');
    hideModal('createModal');
    showToast('프로젝트 생성됨','ok');
    openProject(proj);
  }catch(e){showToast('생성 실패: '+rpcErrMsg(e),'err');}
}
// 계획 삭제: 비밀번호 창을 연다 (만든 사람의 삭제 비밀번호 또는 관리자 비밀번호)
let _delTarget=null,_delBusy=false;
function deleteProject(id,name){
  _delTarget={id:String(id),name};
  document.getElementById('delProjName').textContent=name;
  const pw=document.getElementById('delProjPw');
  pw.value='';document.getElementById('delProjPwShow').checked=false;togglePwShow('delProjPw',false);
  showModal('deleteModal');
  setTimeout(()=>pw.focus(),50);
}
async function confirmDeleteProject(){
  if(!_delTarget||_delBusy)return;
  const {id}=_delTarget;
  const pwEl=document.getElementById('delProjPw');
  const pw=pwEl.value;
  if(!pw){showToast('비밀번호를 입력하세요','err');pwEl.focus();return;}
  const btn=document.getElementById('delProjBtn');
  _delBusy=true;btn.disabled=true;
  try{
    // 0. 비밀번호 확인 (맞을 때만 아래로 — 사진·파일을 먼저 지우지 않도록)
    showToast('비밀번호 확인 중...','');
    const chk=await sbClient().rpc('inspection_check_delete_pw',{p_id:id,p_password:pw});
    if(chk.error)throw chk.error;
    if(chk.data!==true){showToast('비밀번호가 맞지 않습니다','err');pwEl.select();return;}

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

    // 3. DB 삭제 — DB 함수가 비밀번호를 다시 확인하고 딸린 기록까지 한 번에 지움
    //    (inspections 표는 직접 삭제 권한이 닫혀 있어 이 함수로만 지워짐)
    const del=await sbClient().rpc('inspection_delete',{p_id:id,p_password:pw});
    if(del.error)throw del.error;
    if(del.data!==true)throw new Error('비밀번호가 맞지 않습니다');

    hideModal('deleteModal');
    _delTarget=null;
    showToast('프로젝트 삭제 완료','ok');
    loadProjects();
  }catch(e){showToast('삭제 실패: '+rpcErrMsg(e),'err');}
  finally{_delBusy=false;btn.disabled=false;}
}
