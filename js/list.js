/* field-check · js/list.js — 목록 그리기 */
AppFiles.reg('js/list.js','v3.1.0'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

// ━━ 목록 렌더 ━━
function renderList(){
  const el=document.getElementById('listEl');
  el.innerHTML='';
  if(!items.length){el.innerHTML='<div style="text-align:center;color:var(--mt);font-size:12px;padding:30px">📂 엑셀 업로드로 대상을 추가하세요</div>';return;}
  const frag=document.createDocumentFragment();
  items.forEach((d,i)=>{
    const isDone=!!doneMap[d.id];
    const color=groupColor(d);
    const div=document.createElement('div');
    div.className='item'+(isHidden(d)?' hidden':'')+(isDone?' done-item':'');
    div.id=`item-${i}`;
    div.innerHTML=`<div class="team-dot" style="background:${color}"></div>
      <div class="ibody">
        <div class="iname">${esc(d.name)}</div>
        <div class="isub">${esc((d.address||'').replace('서울특별시 금천구 ',''))}</div>
        <div class="itags">
          ${d.group_name?`<span class="itag">${esc(d.group_name)}</span>`:''}
          ${isDone?'<span class="itag done-tag">✓ 완료</span>':''}
          ${memoMap[d.id]?'<span class="itag">📝 메모</span>':''}
          ${(photoMap[d.id]?.length)?`<span class="itag">📷 ${photoMap[d.id].length}</span>`:''}
        </div>
      </div>`;
    div.addEventListener('click',()=>{
      setActive(i);
      if(d.lat&&d.lng&&kakaoMap){
        kakaoMap.setLevel(3);kakaoMap.panTo(new kakao.maps.LatLng(d.lat,d.lng));
        if(overlays[i]){if(iwOpen)iwOpen.setMap(null);overlays[i].iw.setMap(kakaoMap);iwOpen=overlays[i].iw;}
      }
      // 모바일: 목록 클릭 시 지도 모드로 자동 전환
      if(window.innerWidth<=600)switchToMapMode();
    });
    frag.appendChild(div);
  });
  el.appendChild(frag);
}
