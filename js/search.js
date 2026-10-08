/* field-check · js/search.js — 지도 검색 */
AppFiles.reg('js/search.js','v3.1.2'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

// ━━ 지도 검색 ━━
let srchMarkers=[];
function toggleMapSearch(){const w=document.getElementById('mapSearch');const btn=document.getElementById('btnSearch');if(w.style.display==='flex'){w.style.display='none';btn.classList.remove('on');srchMarkers.forEach(m=>m.setMap(null));srchMarkers=[];}else{w.style.display='flex';btn.classList.add('on');setTimeout(()=>document.getElementById('mapSearchInput').focus(),50);}}
function closeMapSearch(){document.getElementById('mapSearch').style.display='none';document.getElementById('btnSearch').classList.remove('on');srchMarkers.forEach(m=>m.setMap(null));srchMarkers=[];}
async function searchMap(){
  const q=document.getElementById('mapSearchInput').value.trim();if(!q){showToast('검색어를 입력하세요','err');return;}
  srchMarkers.forEach(m=>m.setMap(null));srchMarkers=[];
  const res=document.getElementById('mapSearchResults');
  res.innerHTML='<div class="sri" style="cursor:default">검색 중...</div>';res.style.display='block';
  let results=[];
  try{
    const docs=await KakaoGeo.keywordSearchRaw(q,10);
    if(docs.length)results=docs.map(doc=>({name:doc.place_name,addr:doc.road_address_name||doc.address_name,lat:+doc.y,lng:+doc.x}));
    else{
      const docs2=await KakaoGeo.addressSearchRaw(q,10);
      results=docs2.map(doc=>({name:doc.address_name,addr:doc.road_address?.address_name||'',lat:+doc.y,lng:+doc.x}));
    }
  }catch{}
  if(!results.length){res.innerHTML='<div class="sri" style="cursor:default;color:var(--mt)">검색 결과 없음</div>';return;}
  res.innerHTML='';
  results.forEach((r,i)=>{
    const el=document.createElement('div');el.className='sri';
    el.innerHTML=`<div class="sri-name">${i+1}. ${esc(r.name)}</div><div class="sri-addr">${esc(r.addr)}</div>`;
    el.onclick=()=>{kakaoMap.setLevel(3);kakaoMap.panTo(new kakao.maps.LatLng(r.lat,r.lng));};
    res.appendChild(el);
    const mk=document.createElement('div');mk.style.cssText='width:24px;height:24px;border-radius:50%;background:#f59e0b;border:3px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.5)';mk.textContent=i+1;
    const ov=new kakao.maps.CustomOverlay({position:new kakao.maps.LatLng(r.lat,r.lng),content:mk,zIndex:50});ov.setMap(kakaoMap);srchMarkers.push(ov);
  });
  if(results[0])kakaoMap.panTo(new kakao.maps.LatLng(results[0].lat,results[0].lng));
}
