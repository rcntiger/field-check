/* field-check · js/gps.js — 현위치 */
AppFiles.reg('js/gps.js','v3.1.2'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

/* ══════════ 현위치 ══════════ */
let _myLocMarker=null,_myLocCircle=null,_myLocWatch=null;

function toggleMyLocation(){
  const btn=document.getElementById('btnMyLoc');
  if(_myLocWatch!==null){
    // 추적 종료
    navigator.geolocation.clearWatch(_myLocWatch);
    _myLocWatch=null;
    _myLocMarker?.setMap(null);_myLocMarker=null;
    _myLocCircle?.setMap(null);_myLocCircle=null;
    btn.classList.remove('on');
    showToast('현위치 추적 종료','');
    return;
  }
  if(!navigator.geolocation){showToast('이 브라우저는 위치 기능을 지원하지 않습니다','err');return;}
  btn.textContent='⏳';
  _myLocWatch=navigator.geolocation.watchPosition(
    pos=>{
      const {latitude:lat,longitude:lng,accuracy}=pos.coords;
      const latlng=new kakao.maps.LatLng(lat,lng);
      // 마커 (파란 원형)
      if(!_myLocMarker){
        const el=document.createElement('div');
        el.style.cssText='width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 3px rgba(37,99,235,.35)';
        _myLocMarker=new kakao.maps.CustomOverlay({position:latlng,content:el,zIndex:200});
        _myLocMarker.setMap(kakaoMap);
        kakaoMap.panTo(latlng);
      }else{
        _myLocMarker.setPosition(latlng);
      }
      // 정확도 원
      if(_myLocCircle){_myLocCircle.setMap(null);}
      _myLocCircle=new kakao.maps.Circle({
        center:latlng,radius:accuracy,
        strokeWeight:1,strokeColor:'#2563eb',strokeOpacity:.4,
        fillColor:'#2563eb',fillOpacity:.08,
      });
      _myLocCircle.setMap(kakaoMap);
      btn.textContent='📍';
      btn.classList.add('on');
    },
    err=>{
      btn.textContent='📍';
      btn.classList.remove('on');
      _myLocWatch=null;
      const msg={1:'위치 권한이 거부됐습니다',2:'위치를 가져올 수 없습니다',3:'위치 요청 시간 초과'};
      showToast(msg[err.code]||'위치 오류','err');
    },
    {enableHighAccuracy:true,timeout:10000,maximumAge:3000}
  );
}
