/* field-check · js/map-core.js — 카카오 지도 초기화 · 진단 · 항목 활성화/전체 보기 */
AppFiles.reg('js/map-core.js','v2.0.0'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

/* ══════════ Kakao Map ══════════ */
function initKakaoMap(){
  if(kakaoMap){document.getElementById('mapPh').style.display='none';return Promise.resolve();}
  return KakaoGeo.load().then(()=>new Promise((resolve,reject)=>{
      try{
        document.getElementById('mapPh').style.display='none';
        kakaoMap=new kakao.maps.Map(document.getElementById('map'),{center:new kakao.maps.LatLng(37.46,126.90),level:5});
        clusterer=new kakao.maps.MarkerClusterer({
          map:kakaoMap,
          averageCenter:true,
          minLevel:6,
          disableClickZoom:false,
          styles:[{
            width:'36px',height:'36px',background:'rgba(47,129,247,.85)',
            borderRadius:'50%',color:'#fff',textAlign:'center',
            fontWeight:'700',fontSize:'13px',lineHeight:'36px',
            border:'2px solid #fff',boxShadow:'0 2px 6px rgba(0,0,0,.4)'
          }]
        });
        // 모바일은 지도 보기 클릭 시 툴바 표시, PC는 항상 표시
        if(window.innerWidth>768){
          document.getElementById('mapToolbar').style.display='flex';
        }
        kakao.maps.event.addListener(kakaoMap,'click',(e)=>{
          document.getElementById('mapSearchResults').style.display='none';
          if(rvMode){openRvAt(e.latLng);setRvMode(false);return;}
          if(distMode){distPath.push(e.latLng);addDistMarker(e.latLng);updateDistLine();}
        });
        kakao.maps.event.addListener(kakaoMap,'dblclick',()=>{if(distMode)finishDist();});
        resolve();
      }catch(e){reject(new Error('MAP_CREATE'));}
  })).catch(e=>{showDiag(e.message);});
}
function showDiag(code){
  const msgs={'TIMEOUT':{t:'도메인 미등록',d:'Kakao 콘솔에 현재 도메인을 등록하세요.',f:'developers.kakao.com → 내 애플리케이션 → 플랫폼 → Web'},'SCRIPT_LOAD':{t:'JS 키 오류',d:'403 오류',f:'JS 키와 도메인 확인'},'NO_KEY':{t:'키 설정 없음',d:'공통 설정(common/keys.js)에서 카카오 JS 키를 읽지 못했습니다.',f:'새로고침하세요'}};
  const m=msgs[code]||{t:'오류:'+code,d:'',f:'새로고침하세요'};
  document.getElementById('diagTitle').textContent='⚠️ '+m.t;
  document.getElementById('diagDesc').textContent=m.d;
  document.getElementById('diagFix').innerHTML=m.f+'<br><b>'+location.origin+'</b>';
  document.getElementById('diagPanel').style.display='flex';
}

function setActive(idx){
  if(activeIdx>=0)document.getElementById(`item-${activeIdx}`)?.classList.remove('active');
  activeIdx=idx;
  const el=document.getElementById(`item-${idx}`);
  if(el){el.classList.add('active');el.scrollIntoView({block:'nearest'});}
}
function closeIw(){if(iwOpen){iwOpen.setMap(null);iwOpen=null;}if(activeMarkerEl){activeMarkerEl.classList.remove('active-mk');activeMarkerEl=null;}}
function fitAll(){
  if(!kakaoMap)return;
  const bounds=new kakao.maps.LatLngBounds();
  items.forEach(d=>{if(d.lat&&d.lng)bounds.extend(new kakao.maps.LatLng(d.lat,d.lng));});
  if(!bounds.isEmpty())kakaoMap.setBounds(bounds,50);
}
