/* field-check · js/init.js — 시작 (DOMContentLoaded) · 키보드 */
AppFiles.reg('js/init.js','v3.1.0'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

/* ══════════ Init ══════════ */
document.addEventListener('DOMContentLoaded',()=>{
  if(!_CFG||!window.KakaoGeo){
    document.body.insertAdjacentHTML('afterbegin','<div style="position:fixed;inset:0;z-index:30000;display:flex;align-items:center;justify-content:center;background:#0d1117;color:#e6edf3;padding:24px;text-align:center;font-size:15px;line-height:1.6">공통 설정 파일(common/keys.js, kakao-geo.js)을 불러오지 못했습니다.<br>인터넷 연결을 확인하고 새로고침하세요.</div>');
    return;
  }
  SupabaseUtil.init(SB_URL,SB_KEY);
  // 버전 표시: 화면 하단(캐시된 옛 버전인지 바로 확인) + 콘솔
  const verEl=document.getElementById('appVersion');
  if(verEl)verEl.textContent=`현장 확인 점검 Map ${APP_VERSION}`;
  console.info(`%c🚒 현장 확인 점검 Map ${APP_VERSION}`,'font-weight:bold');
  // 공유 툴팁 요소 (body에 단 하나, stacking context 문제 해결)
  _sharedTooltip=document.createElement('div');
  _sharedTooltip.className='mk-tooltip';
  document.body.appendChild(_sharedTooltip);
  document.getElementById('mapView').style.display='none';
  loadStations();
  loadProjects();
  // (예전의 loadSheetJS() 호출은 함수가 없어 여기서 오류로 멈췄음 — 엑셀은 공통 ExcelUtil이 필요할 때 스스로 준비하므로 삭제)
  fetchStationCoords();   // 기본 출발지 좌표 조회 — 이 과정에서 지도 SDK도 미리 받아짐
});

// 키보드
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(document.getElementById('rvPanel').style.display!=='none'){closeRv();return;}
    if(rvMode){setRvMode(false);return;}
    if(distMode){finishDist();return;}
    closeIw();
  }
});
