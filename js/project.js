/* field-check · js/project.js — 홈 화면: 계획 목록 · 보관 기한 · 계획 생성/수정/삭제 */
AppFiles.reg('js/project.js','v3.13.0'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

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
    // 건수: 계획마다 행 수만 셈 (데이터는 받지 않음)
    // ※ 예전에는 모든 계획의 항목을 한 번에 받아 셌는데, Supabase가 1000행에서 잘라서
    //   전체 항목이 1000곳을 넘으면 나중에 올린 계획의 건수가 적게 나왔음
    try{
      const counts=await Promise.all(projs.map(p=>Promise.all([
        sbCount('inspection_items',{inspection_id:p.id}),
        sbCount('inspection_done',{inspection_id:p.id}),
      ])));
      projs.forEach((p,i)=>{
        p._total=counts[i][0];
        p._done=counts[i][1];
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
        <button class="project-card-btn" onclick="event.stopPropagation();showCopyModal('${p.id}')" title="같은 대상으로 새 계획 (다음 회차)" aria-label="같은 대상으로 새 계획">🔁</button>
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
let _copyFrom=null; // "같은 대상으로 새 계획"일 때 원래 계획 (보통 새 계획이면 null)
function _openCreateModal({title,info,name,desc}){
  document.getElementById('createTitle').textContent=title;
  const inf=document.getElementById('createInfo');
  inf.innerHTML=info||'';inf.style.display=info?'':'none';
  document.getElementById('projName').value=name||'';document.getElementById('projDesc').value=desc||'';document.getElementById('projExpire').value='';
  document.getElementById('projPw').value='';document.getElementById('projPwShow').checked=false;togglePwShow('projPw',false);
  document.getElementById('createBtn').textContent=_copyFrom?'새 회차 만들기':'만들기';
  showModal('createModal');
}
function showCreateModal(){
  _copyFrom=null;
  _openCreateModal({title:'📋 새 계획'});
}
// ━━ 같은 대상으로 새 계획 (다음 회차) ━━
// 대상·팀·팀 색·정보카드 칸·원본 엑셀은 복사하고, 완료·메모·사진은 비운 채 시작. 원래 계획은 그대로 남음
function _nextRoundName(name){
  const m=String(name).match(/^(.*?)\s*\((\d+)회차\)\s*$/);
  return m?`${m[1]} (${+m[2]+1}회차)`:`${name} (2회차)`;
}
function showCopyModal(id){
  const p=projectList.find(x=>String(x.id)===String(id));
  if(!p){showToast('계획 정보를 찾을 수 없습니다','err');return;}
  const total=typeof p._total==='number'?p._total:null;
  if(total===0){showToast('복사할 점검 대상이 없습니다','err');return;}
  _copyFrom=p;
  _openCreateModal({
    title:'🔁 같은 대상으로 새 계획',
    info:`<b>${esc(p.name)}</b>의 점검 대상${total!=null?` <b>${total.toLocaleString()}</b>곳`:''}을 그대로 가져옵니다. 팀 색·정보카드 칸·원본 엑셀도 함께 가져오고, 완료·메모·사진은 비어 있는 상태로 시작합니다. 원래 계획과 그 기록은 그대로 남습니다.`,
    name:_nextRoundName(p.name),
    desc:p.description||'',
  });
}
// 새로 만든 계획에 원래 계획의 대상 등을 복사. 실패하면 throw
async function _copyProjectContents(src,dst){
  const srcItems=await sbSelectAll('inspection_items',{eq:{inspection_id:src.id},order:{column:'created_at',ascending:true}});
  if(!srcItems.length)throw new Error('원래 계획에 점검 대상이 없습니다');
  // 대상 복사 (좌표도 그대로 → 주소 검색을 다시 하지 않음). 500곳씩 한 번에
  const rows=srcItems.map(r=>{const c={...r};delete c.id;delete c.created_at;c.inspection_id=dst.id;return c;});
  for(let i=0;i<rows.length;i+=500){
    showToast(`대상 복사 중... (${Math.min(i+500,rows.length)}/${rows.length})`,'');
    await SupabaseUtil.insert('inspection_items',rows.slice(i,i+500));
  }
  // 팀 색 (v3.2.0 SQL 전이면 칸이 없어 건너뜀)
  if(src.group_colors&&Object.keys(src.group_colors).length){
    try{await SupabaseUtil.update('inspections',{group_colors:src.group_colors},{id:dst.id});}catch(e){console.warn('팀 색 복사 실패',e);}
  }
  // 원본 엑셀 (컬럼 재설정에 씀)
  try{
    const store=sbClient().storage.from('inspection-files');
    const {data:files}=await store.list(String(src.id),{limit:100});
    for(const f of (files||[])){
      if(!f.name||!(f.name.startsWith('original.')||f.name.startsWith('added_')))continue;
      const {error}=await store.copy(`${src.id}/${f.name}`,`${dst.id}/${f.name}`);
      if(error)console.warn('엑셀 파일 복사 실패',f.name,error);
    }
  }catch(e){console.warn('엑셀 파일 복사 실패',e);}
  // 정보카드 칸 고르기에서 지난번 고른 칸 (이 브라우저)
  try{const v=localStorage.getItem('field_check_extra_cols_'+src.id);if(v)localStorage.setItem('field_check_extra_cols_'+dst.id,v);}catch{}
  return srcItems.length;
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
    if(_copyFrom){
      const src=_copyFrom;
      const btn=document.getElementById('createBtn');btn.disabled=true;
      try{
        const n=await _copyProjectContents(src,proj);
        proj.group_colors=src.group_colors||{};
        hideModal('createModal');_copyFrom=null;
        showToast(`✅ 새 회차를 만들었습니다 (대상 ${n.toLocaleString()}곳)`,'ok');
        openProject(proj);
      }catch(e){
        // 복사가 중간에 실패하면 반쯤 만들어진 새 계획을 지움 (방금 정한 삭제 비밀번호로)
        try{await sbClient().rpc('inspection_delete',{p_id:String(proj.id),p_password:pw});}catch(e2){console.warn(e2);}
        showToast('새 회차 만들기 실패: '+(e.message||e)+' — 새 계획은 만들지 않았습니다','err');
        loadProjects();
      }finally{btn.disabled=false;}
      return;
    }
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
    //    사진이 있는 대상의 폴더만 봄 — 예전에는 대상마다 폴더를 하나씩 열어 봐서
    //    692곳짜리 계획은 이 단계에서만 몇 분이 걸려 "삭제 중..."에서 멈춘 것처럼 보였음
    try{
      const itemIds=[...new Set((await sbSelectAll('inspection_photos',{eq:{inspection_id:id},columns:'id,item_id'})).map(p=>p.item_id).filter(v=>v!=null))];
      for(const itemId of itemIds){
        const {data:files}=await store.from(PHOTO_BUCKET).list(String(itemId),{limit:100});
        if(Array.isArray(files)&&files.length){
          await store.from(PHOTO_BUCKET).remove(files.map(f=>`${itemId}/${f.name}`));
        }
      }
    }catch(e){console.warn('사진 Storage 삭제 실패',e);}
    // 1-2. 사진 주소로도 지움 (엑셀 바꾸기·재설정으로 이어받은 사진은 옛 대상 폴더에 남아 있음)
    try{
      const paths=(await sbSelectAll('inspection_photos',{eq:{inspection_id:id},columns:'id,url'}))
        .map(p=>String(p.url||'').split(`/${PHOTO_BUCKET}/`)[1]).filter(Boolean).map(decodeURIComponent);
      for(let i=0;i<paths.length;i+=100)await store.from(PHOTO_BUCKET).remove(paths.slice(i,i+100));
    }catch(e){console.warn('사진 Storage 삭제 실패(주소)',e);}

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
