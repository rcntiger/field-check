/* field-check · js/navigation.js — 길찾기 */
AppFiles.reg('js/navigation.js','v3.0.0'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

/* ══════════ Navigation ══════════ */
// select 변경 시 직접 입력창으로 교체
function onNaviSelChange(idx){
  const sel=document.getElementById(`naviSel-${idx}`);
  const wrap=document.getElementById(`naviCustomWrap-${idx}`);
  if(!sel||!wrap)return;
  if(sel.value==='custom'){
    sel.dataset.prev=sel.dataset.lastVal||'fs';
    sel.style.display='none';
    wrap.style.display='block';
    document.getElementById(`naviCustomInput-${idx}`)?.focus();
  }else{
    sel.dataset.lastVal=sel.value;
  }
}
function clearNaviCustom(idx){
  const input=document.getElementById(`naviCustomInput-${idx}`);
  const wrap=document.getElementById(`naviCustomWrap-${idx}`);
  const sel=document.getElementById(`naviSel-${idx}`);
  if(input&&input.value.trim()){
    // 글자 있으면 지우고 포커스 유지
    input.value='';input.focus();
  }else{
    // 빈 상태면 선택으로 복귀
    if(wrap)wrap.style.display='none';
    if(sel){sel.style.display='';sel.value=sel.dataset.prev||'fs';}
  }
}

// 길찾기 버튼 클릭
async function naviClick(idx,toLat,toLng,toName){
  const wrap=document.getElementById(`naviCustomWrap-${idx}`);
  const input=document.getElementById(`naviCustomInput-${idx}`);
  const sel=document.getElementById(`naviSel-${idx}`);
  const isCustom=wrap&&wrap.style.display==='block';

  if(isCustom){
    // 직접 입력 모드
    const addr=(input?.value||'').trim();
    if(!addr){showToast('출발지 주소를 입력하세요','err');return;}
    showToast('출발지 좌표 검색 중...','');
    try{
      let lat,lng;
      const data={documents:await KakaoGeo.addressSearchRaw(addr,1)};
      if(data.documents?.length){
        lat=parseFloat(data.documents[0].y);
        lng=parseFloat(data.documents[0].x);
      }else{
        const data2={documents:await KakaoGeo.keywordSearchRaw(addr,1)};
        if(data2.documents?.length){
          lat=parseFloat(data2.documents[0].y);
          lng=parseFloat(data2.documents[0].x);
        }else{showToast('주소를 찾을 수 없습니다','err');return;}
      }
      openNaviWithCoords(lat,lng,addr.substring(0,15),toLat,toLng,toName);
    }catch(e){showToast('주소 검색 실패','err');}
  }else{
    // 드롭다운 선택 모드
    const stKey=sel?.value;
    if(!stKey||stKey==='custom'){showToast('출발지를 선택하세요','err');return;}
    openNavi(toLat,toLng,toName,stKey);
  }
}

// 좌표로 직접 길찾기
function openNaviWithCoords(fromLat,fromLng,fromName,toLat,toLng,toName){
  const isMobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const sp=`${encodeURIComponent(fromName)},${fromLat},${fromLng}`;
  const ep=`${encodeURIComponent(toName)},${toLat},${toLng}`;
  const webUrl=`https://map.kakao.com/link/by/car/${sp}/${ep}`;
  if(isMobile){
    const naviUrl=`kakaomap://route?sp=${fromLat},${fromLng}&ep=${toLat},${toLng}&by=CAR`;
    const el=document.createElement('a');
    el.href=naviUrl;el.style.display='none';
    document.body.appendChild(el);el.click();document.body.removeChild(el);
    setTimeout(()=>{window.open(webUrl,'_blank');},1500);
  }else{
    window.open(webUrl,'_blank');
  }
}
function openNavi(toLat,toLng,toName,stKey){
  const st=STATIONS[stKey]||Object.values(STATIONS)[0];
  if(!st){showToast('출발지가 설정되지 않았습니다','err');return;}
  if(!st.lat||!st.lng){showToast('출발지 좌표가 없습니다','err');return;}
  const isMobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const sp=`${encodeURIComponent(st.name)},${st.lat},${st.lng}`;
  const ep=`${encodeURIComponent(toName)},${toLat},${toLng}`;
  const webUrl=`https://map.kakao.com/link/by/car/${sp}/${ep}`;
  if(isMobile){
    const naviUrl=`kakaomap://route?sp=${st.lat},${st.lng}&ep=${toLat},${toLng}&by=CAR`;
    const el=document.createElement('a');
    el.href=naviUrl;el.style.display='none';
    document.body.appendChild(el);el.click();document.body.removeChild(el);
    setTimeout(()=>{window.open(webUrl,'_blank');},1500);
  }else{
    window.open(webUrl,'_blank');
  }
}
