/* field-check · js/project-open.js — 계획 열기/닫기 · 계획 데이터 불러오기 */
AppFiles.reg('js/project-open.js','v3.3.2'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

// ━━ 프로젝트 열기 ━━
async function openProject(proj){
  currentProject=proj;
  document.getElementById('homeView').style.display='none';
  document.getElementById('mapView').style.display='flex';
  document.getElementById('mapHeaderTitle').textContent=proj.name;
  items=[];overlays={};doneMap={};memoMap={};photoMap={};groups=[];filterGroup=new Set(['all']);filterText='';kinds=[];filterKind=new Set(['all']);
  document.getElementById('listEl').innerHTML='<div style="text-align:center;color:var(--mt);font-size:12px;padding:30px">지도 초기화 중...</div>';
  await initKakaoMap();
  await loadProjectData();
}
// 상단 버튼: 모바일 지도 보기 상태면 목록으로, 아니면 홈으로
function handleBack(){
  if(window.innerWidth<=600&&mobMapMode){
    toggleMobView(); // 목록 보기로 전환
  }else{
    goHome();
  }
}

async function goHome(){
  try{
    if(kakaoMap){Object.values(overlays).forEach(o=>{o.overlay?.setMap(null);o.iw?.setMap(null);});}
    if(iwOpen){iwOpen.setMap(null);iwOpen=null;}
    // 모바일 상태 초기화
    mobMapMode=false;
    const sidebar=document.getElementById('sidebar');
    if(sidebar)sidebar.classList.remove('map-mode');
    const toggle=document.getElementById('mobToggle');
    if(toggle)toggle.textContent='🗺️ 지도 보기';
    const backBtn=document.getElementById('backBtn');
    if(backBtn)backBtn.textContent='← 목록';
    const toolbar=document.getElementById('mapToolbar');
    if(toolbar)toolbar.style.display='none';
    document.body.style.overflowX='hidden';
    // 화면 전환
    const mapView=document.getElementById('mapView');
    const homeView=document.getElementById('homeView');
    if(mapView)mapView.style.display='none';
    if(homeView)homeView.style.display='block';
    currentProject=null;
    items=[];overlays={};
    await loadProjects();
  }catch(e){console.error('goHome 오류:',e);}
}
async function loadProjectData(){
  if(!currentProject)return;
  const id=currentProject.id;
  try{
    const [itemsRes,doneArr,memoArr,photosArr]=await Promise.all([
      // 1000곳이 넘는 계획도 끝까지 받도록 나눠 받기
      sbSelectAll('inspection_items',{eq:{inspection_id:id},order:{column:'created_at',ascending:true}}),
      sbSelectAll('inspection_done',{eq:{inspection_id:id},key:'item_id'}),
      sbSelectAll('inspection_memo',{eq:{inspection_id:id},key:'item_id'}),
      sbSelectAll('inspection_photos',{eq:{inspection_id:id},order:{column:'created_at',ascending:true}}),
    ]);
    items=itemsRes;
    doneMap={};doneArr.forEach(d=>{doneMap[d.item_id]=d;});
    memoMap={};memoArr.forEach(m=>{memoMap[m.item_id]=m.memo||'';});
    photoMap={};photosArr.forEach(p=>{if(!photoMap[p.item_id])photoMap[p.item_id]=[];photoMap[p.item_id].push(p);});
    // 그룹 목록
    groups=[...new Set(items.map(d=>d.group_name||'').filter(Boolean))];
    refreshGroupColors(); // 팀 색 (저장된 색 + 자동)
    buildGroupFilter();
    // 업무 구분 목록: 한 가지(조사, 훈련 …)를 먼저, 여러 가지가 겹친 것(조사·훈련)을 뒤에
    // 한 가지 구분끼리는 '조사·훈련'처럼 겹친 이름에 적힌 순서(= 크로스 체크의 목록 순서)를 따름
    const _k=[...new Set(items.map(itemKind).filter(Boolean))];
    const _rank=k=>{let r=99;_k.filter(kindIsMulti).forEach(m=>{const i=m.split('·').map(x=>x.trim()).indexOf(k);if(i>=0&&i<r)r=i;});return r;};
    const _singles=_k.filter(k=>!kindIsMulti(k)).map((k,i)=>[k,_rank(k),i]).sort((a,b)=>a[1]-b[1]||a[2]-b[2]).map(x=>x[0]);
    kinds=[..._singles,..._k.filter(kindIsMulti)];
    filterKind=new Set(['all']);
    buildKindFilter();
    renderAllMarkers();
    renderList();
    updateStats();
    if(items.length)fitAll();
  }catch(e){showToast('데이터 로드 실패','err');}
}
