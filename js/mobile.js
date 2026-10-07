/* field-check · js/mobile.js — 모바일 지도/목록 전환 */
AppFiles.reg('js/mobile.js','v2.0.2'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

// ━━ 모바일 ━━
function toggleMobView(){
  mobMapMode=!mobMapMode;
  document.getElementById('sidebar').classList.toggle('map-mode',mobMapMode);
  document.getElementById('mobToggle').textContent=mobMapMode?'📋 목록 보기':'🗺️ 지도 보기';
  const backBtn=document.getElementById('backBtn');
  if(backBtn&&window.innerWidth<=600)backBtn.textContent=mobMapMode?'← 이전':'← 목록';
  const isMobile=window.innerWidth<=768;
  if(isMobile){
    document.getElementById('mapToolbar').style.display=mobMapMode?'flex':'none';
    document.body.style.overflowX=mobMapMode?'':'hidden';
  }
  if(mobMapMode&&kakaoMap){
    const center=kakaoMap.getCenter();
    const level=kakaoMap.getLevel();
    const restore=()=>{
      kakaoMap.relayout();
      // 마커가 있으면 마커 영역에 맞추고, 없으면 기존 위치 복원
      if(items.some(d=>d.lat&&d.lng))fitAll();
      else{kakaoMap.setCenter(center);kakaoMap.setLevel(level);}
    };
    setTimeout(restore,50);
    setTimeout(restore,250);
    setTimeout(restore,500);
  }
}

function switchToMapMode(){
  if(!mobMapMode){
    mobMapMode=true;
    document.getElementById('sidebar').classList.add('map-mode');
    document.getElementById('mobToggle').textContent='📋 목록 보기';
    const backBtn=document.getElementById('backBtn');
    if(backBtn&&window.innerWidth<=600)backBtn.textContent='← 이전';
    document.getElementById('mapToolbar').style.display='flex';
    document.body.style.overflowX='';
    if(kakaoMap){
      const center=kakaoMap.getCenter();
      const level=kakaoMap.getLevel();
      setTimeout(()=>{kakaoMap.relayout();kakaoMap.setCenter(center);kakaoMap.setLevel(level);},50);
      setTimeout(()=>{kakaoMap.relayout();kakaoMap.setCenter(center);kakaoMap.setLevel(level);},200);
      setTimeout(()=>{kakaoMap.relayout();kakaoMap.setCenter(center);kakaoMap.setLevel(level);},500);
    }
  }
}
