/* field-check · js/marker.js — 그룹 색상 · 마커 · 이름표 · 정보카드(팝업) 그리기 */
AppFiles.reg('js/marker.js','v2.0.2'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

/* ══════════ Marker & List Render ══════════ */
const _groupColorMap={};
function groupColor(d){
  if(!d.group_name)return GROUP_COLORS[0];
  if(!_groupColorMap[d.group_name]){
    const keys=Object.keys(_groupColorMap);
    _groupColorMap[d.group_name]=GROUP_COLORS[keys.length%GROUP_COLORS.length];
  }
  return _groupColorMap[d.group_name];
}
function groupCls(d){return 'g'+(Object.keys(_groupColorMap).indexOf(d.group_name||'')+1);}

function renderAllMarkers(){
  Object.values(overlays).forEach(o=>{o.overlay?.setMap(null);o.iw?.setMap(null);o.labelOverlay?.setMap(null);});
  if(clusterer)clusterer.clear();
  overlays={};
  items.forEach((d,i)=>{if(d.lat&&d.lng)addMarker(i,d);});
}
let _transparentMarkerImg=null;
function getTransparentMarkerImage(){
  if(!_transparentMarkerImg){
    _transparentMarkerImg=new kakao.maps.MarkerImage(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      new kakao.maps.Size(1,1)
    );
  }
  return _transparentMarkerImg;
}
function addMarker(idx,d){
  const isDone=!!doneMap[d.id];
  const color=groupColor(d);
  const el=document.createElement('div');
  el.className=`kk-marker ${groupCls(d)}${isDone?' done':''}`;
  el.id='mk-'+idx;
  el.style.position='relative';

  // 툴팁: body에 단 하나의 공유 툴팁 요소를 사용 (stacking context 탈출)
  el.addEventListener('mouseenter',()=>{
    if(iwOpen===iw)return;
    const r=el.getBoundingClientRect();
    _sharedTooltip.textContent=d.name;
    _sharedTooltip.style.left=(r.left+r.width/2)+'px';
    _sharedTooltip.style.top=(r.bottom+6)+'px';
    _sharedTooltip.style.opacity='1';
  });
  el.addEventListener('mouseleave',()=>{_sharedTooltip.style.opacity='0';});
  // 모바일: 이름 말풍선 레이블을 CustomOverlay로 마커 아래 항상 표시
  let labelOverlay=null;
  if('ontouchstart' in window){
    const color=groupColor(d);
    const labelEl=document.createElement('div');
    labelEl.style.cssText=`padding:3px 8px;font-size:11px;font-weight:700;color:${color};background:rgba(255,255,255,0.95);border:1.5px solid ${color};border-radius:12px;white-space:normal;max-width:120px;word-break:keep-all;text-align:center;line-height:1.4;box-shadow:0 2px 6px rgba(0,0,0,.2);pointer-events:auto;cursor:pointer`;
    labelEl.addEventListener('click',openIw);
    let _lbTouchMoved=false;
    labelEl.addEventListener('touchstart',()=>{_lbTouchMoved=false;},{passive:true});
    labelEl.addEventListener('touchmove',()=>{_lbTouchMoved=true;},{passive:true});
    labelEl.addEventListener('touchend',e=>{if(!_lbTouchMoved){e.preventDefault();openIw();}},{passive:false});
    labelEl.textContent=d.name;
    labelOverlay=new kakao.maps.CustomOverlay({
      position:new kakao.maps.LatLng(d.lat,d.lng),
      content:labelEl,
      xAnchor:0.5,yAnchor:-0.3,
      zIndex:9,
    });
    labelOverlay.setMap(kakaoMap);
  }

  const iwEl=document.createElement('div');
  iwEl.className='iw-wrap';
  ['mousedown','mousemove','dblclick','wheel','touchstart','touchmove','touchend'].forEach(ev=>{
    iwEl.addEventListener(ev,e=>e.stopPropagation(),{passive:false});
  });
  // 카드 내부 터치 스크롤 처리
  let touchStartY=0;
  iwEl.addEventListener('touchstart',e=>{touchStartY=e.touches[0].clientY;},{passive:true});
  iwEl.addEventListener('touchmove',e=>{
    const dy=e.touches[0].clientY-touchStartY;
    const atTop=iwEl.scrollTop===0;
    const atBottom=iwEl.scrollTop+iwEl.clientHeight>=iwEl.scrollHeight;
    if((atTop&&dy>0)||(atBottom&&dy<0))return;
    e.stopPropagation();
  },{passive:false});

  const iw=new kakao.maps.CustomOverlay({position:new kakao.maps.LatLng(d.lat,d.lng),content:iwEl,yAnchor:1.1,zIndex:100});
  renderPopup(iwEl,idx,d,iw);

  function openIw(){
    if(iwOpen)iwOpen.setMap(null);
    if(activeMarkerEl)activeMarkerEl.classList.remove('active-mk');
    el.classList.add('active-mk');activeMarkerEl=el;
    _sharedTooltip.style.opacity='0';
    clearTimeout(_tipTimer); // 정보카드 열리면 툴팁 타이머 취소
    iw.setMap(kakaoMap);iwOpen=iw;
    setActive(idx);kakaoMap.panTo(new kakao.maps.LatLng(d.lat,d.lng));
  }
  el.addEventListener('click',openIw);
  // 모바일: CustomOverlay 내부에서 click이 누락되는 경우가 있어 touchend로 보완
  let _touchMoved=false,_tipTimer=null;
  el.addEventListener('touchstart',()=>{_touchMoved=false;},{passive:true});
  el.addEventListener('touchmove',()=>{_touchMoved=true;},{passive:true});
  el.addEventListener('touchend',e=>{if(!_touchMoved){e.preventDefault();openIw();}},{passive:false});
  const overlay=new kakao.maps.CustomOverlay({position:new kakao.maps.LatLng(d.lat,d.lng),content:el,zIndex:10});
  overlay.setMap(kakaoMap);
  // 클러스터러용 invisible 마커 (줌 레벨 6 이상에서 클러스터로 묶임)
  // ⚠ opacity:0만으로는 클러스터러가 줌인 시 마커를 재표시할 때 카카오 기본 풍선 아이콘이 노출됨
  //    → 완전 투명 1x1 PNG를 마커 이미지로 지정해 원천 차단
  const clMarker=new kakao.maps.Marker({position:new kakao.maps.LatLng(d.lat,d.lng),image:getTransparentMarkerImage()});
  if(clusterer)clusterer.addMarker(clMarker,true);
  overlays[idx]={overlay,iw,clMarker,labelOverlay,hidden:false};
}

function renderPopup(iwEl,idx,d,iw){
  const isDone=!!doneMap[d.id];
  const doneDate=doneMap[d.id]?.done_at?new Date(doneMap[d.id].done_at).toISOString().slice(0,10):'';
  const color=groupColor(d);
  const memo=memoMap[d.id]||'';
  const photos=photoMap[d.id]||[];
  const extraStr=d.extra?Object.entries(d.extra).map(([k,v])=>`${k}: ${v}`).join(' · '):'';

  iwEl.innerHTML=`
    <div class="iw-header">
      <span class="iw-team-badge${isDone?' done':''}" style="background:${color}22;color:${color}">${isDone?'점검 완료':esc(d.group_name||'점검 대상')}</span>
      <div style="display:flex;align-items:center;gap:5px">
        <button class="iw-done-top${isDone?' is-done':''}" id="doneBtnTop-${idx}" onclick="toggleDone(${idx})">
          ${isDone?'✓ 완료(취소)':'완료시 클릭'}
        </button>
        <span class="iw-close" onclick="closeIw()">✕</span>
      </div>
    </div>
    <div class="iw-name">${esc(d.name)}</div>
    ${d.address?`<div class="iw-addr-row"><span class="iw-addr">📍 ${esc(d.address)}</span><button class="iw-rv-inline" onclick="openRvFromPopup(new kakao.maps.LatLng(${d.lat},${d.lng}))">🔭 로드뷰</button></div>`:''}
    ${extraStr?`<div class="iw-extra">${esc(extraStr)}</div>`:''}
    <div class="iw-divider"></div>

    <div id="dateRow-${idx}" style="display:${isDone?'flex':'none'}" class="iw-date-row">
      <label>📅 점검일자</label>
      <input type="date" value="${doneDate}" onchange="updateDoneDate(${idx},this.value)">
    </div>

    <div class="iw-memo">
      <div class="iw-memo-header">
        <span class="iw-memo-title">📝 점검 메모</span>
        <div style="display:flex;align-items:center;gap:5px">
          <span class="iw-memo-status" id="memoSt-${idx}"></span>
          <button class="iw-rv-inline iw-photo-add-top" onclick="openPhotoSheet(${idx})">📷 추가</button>
        </div>
      </div>
      <textarea id="memo-${idx}" placeholder="점검 결과, 특이사항 입력..." oninput="onMemoInput(${idx},this)">${esc(memo)}</textarea>
      <div class="iw-memo-actions">
        <span class="iw-memo-len" id="memoLen-${idx}">${memo.length}/300자</span>
        <div class="iw-memo-btns">
          <button class="iw-memo-save" onclick="saveMemoNow(${idx})">💾 저장</button>
          <button class="iw-memo-del" onclick="deleteMemoNow(${idx})">🗑 삭제</button>
        </div>
      </div>
    </div>

    <div class="iw-divider"></div>

    <div class="iw-photo-add-bottom" style="display:flex;align-items:center;justify-content:flex-start;margin-bottom:5px">
      <button class="iw-rv-inline" onclick="openPhotoSheet(${idx})">📷 추가</button>
    </div>
    <div class="iw-photos" id="photoGrid-${idx}"></div>

    <div class="iw-divider"></div>

    <div class="iw-navi-row">
      <div id="naviFrom-${idx}" style="position:relative;display:contents">
        <select class="iw-navi-sel" id="naviSel-${idx}" onchange="onNaviSelChange(${idx})">
          ${Object.values(STATIONS).map(s=>`<option value="${s.key}">🚒 ${esc(s.name)}</option>`).join('')}
          <option value="custom">✏️ 직접 입력</option>
        </select>
        <div id="naviCustomWrap-${idx}" style="display:none;flex:1;min-width:0;position:relative">
          <input type="text" id="naviCustomInput-${idx}" placeholder="출발지 주소 입력..." style="width:100%;padding:5px 22px 5px 6px;border:1px solid #fde68a;border-radius:6px;font-size:10px;background:#fffbeb;color:#334155;outline:none;box-sizing:border-box">
          <button onclick="clearNaviCustom(${idx})" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);background:none;border:none;color:#94a3b8;font-size:12px;cursor:pointer;padding:0;line-height:1">✕</button>
        </div>
      </div>
      <button class="iw-navi-btn" onclick="naviClick(${idx},${d.lat},${d.lng},'${d.name.replace(/'/g,'').substring(0,15)}')">🗺️ 길찾기</button>
    </div>

    <div class="iw-divider iw-done-bottom-divider"></div>
    <button class="iw-btn done-btn${isDone?' is-done':''} iw-done-bottom" id="doneBtn-${idx}" onclick="toggleDone(${idx})">
      ${isDone?'✓ 점검 완료 (취소)':'점검 완료시 클릭'}
    </button>`;

  renderPhotoGrid(idx,photos);
}
