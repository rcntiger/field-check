/* field-check · js/marker.js — 그룹 색상 · 마커 · 이름표 · 정보카드(팝업) 그리기 */
AppFiles.reg('js/marker.js','v3.8.0'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

/* ══════════ Marker & List Render ══════════ */
// ── 팀 색 ── (마커 · 이름표 · 목록 점 · 정보카드 · 그룹 필터가 모두 여기서 색을 받음)
// ① 계획에 저장된 색(inspections.group_colors, 팀 이름 → '#rrggbb')
// ② 없으면 TEAM_PALETTE에서 자동: 저장된 팀들이 쓰지 않는 색부터 팀 순서대로
let _autoTeamColors={};
function isHexColor(c){return typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c);}
function savedGroupColors(){
  const m=currentProject&&currentProject.group_colors;
  return (m&&typeof m==='object'&&!Array.isArray(m))?m:{};
}
// 팀 목록(groups)이나 저장된 색이 바뀌면 다시 계산
function refreshGroupColors(){
  const saved=savedGroupColors();
  const used=new Set(groups.map(g=>saved[g]).filter(isHexColor).map(c=>c.toLowerCase()));
  const free=TEAM_PALETTE.filter(c=>!used.has(c.toLowerCase()));
  const pool=free.length?free:TEAM_PALETTE;
  let k=0;
  _autoTeamColors={};
  groups.forEach(g=>{if(!isHexColor(saved[g]))_autoTeamColors[g]=pool[k++%pool.length];});
}
function groupColorOf(name){
  if(!name)return NO_GROUP_COLOR;
  const c=savedGroupColors()[name];
  if(isHexColor(c))return c;
  return _autoTeamColors[name]||TEAM_PALETTE[0];
}
function groupColor(d){return groupColorOf(d&&d.group_name||'');}

// ── 업무 구분 ── (크로스 체크 지도용 파일의 '구분' 열 → 추가정보 extra.구분)
// 비고가 들어 있을 수 있는 칸: '정보'(v3.5 이전 업로드) · '비고'(정보카드 항목 고르기로 올린 크로스 체크 파일)
const NOTE_KEYS=['정보','비고'];
function itemKind(d){return itemKindInfo(d).kind;}
// { kind, from }: from = 구분을 읽어 온 칸 이름 ('구분' 또는 비고 칸) — 정보카드에서 그 비고 줄을 감출 때 씀
function itemKindInfo(d){
  if(!d||!d.extra||typeof d.extra!=='object')return {kind:'',from:''};
  if(d.extra['구분'])return {kind:String(d.extra['구분']).trim(),from:'구분'};
  for(const k of NOTE_KEYS){const v=_kindFromNote(d.extra[k]);if(v)return {kind:v,from:k};}
  return {kind:'',from:''};
}
// 구분 열이 생기기 전(v3.3.0 이전) 올린 크로스 체크 파일: 비고 맨 앞에서 구분을 읽음
//   '2개 목록(조사, 훈련) · 묶음 03 · …' → '조사·훈련'
//   '조사 · 조사 12행'처럼 한 목록인 대상은, 같은 계획의 '2개 목록(…)'에 나온 목록 이름과 같을 때 그 이름으로
//   (목록 이름을 계획에서 배우므로 '2026 자료조사'처럼 긴 이름도 인식, 다른 엑셀의 비고는 잘못 읽지 않음)
const _noteKindCache=new Map();
let _knownListNames=new Set();
function _firstNotePart(note){return String(note).split(' · ')[0].trim();}
function _multiNames(first){const m=first.match(/^\d+개 목록\((.+)\)$/);return m?m[1].split(',').map(s=>s.trim()).filter(Boolean):null;}
// 계획을 열 때 한 번: 비고에 나온 목록 이름을 모아 둠
function prepareKindNames(list){
  _noteKindCache.clear();
  _knownListNames=new Set();
  (list||[]).forEach(d=>{
    if(d&&d.extra&&d.extra['구분'])String(d.extra['구분']).split('·').forEach(s=>s.trim()&&_knownListNames.add(s.trim()));
    NOTE_KEYS.forEach(key=>{
      const n=d&&d.extra&&d.extra[key];if(!n)return;
      (_multiNames(_firstNotePart(n))||[]).forEach(s=>_knownListNames.add(s));
    });
  });
}
function _kindFromNote(note){
  if(!note)return '';
  if(_noteKindCache.has(note))return _noteKindCache.get(note);
  const first=_firstNotePart(note);
  const multi=_multiNames(first);
  let k='';
  if(multi)k=multi.join('·');
  else if(_knownListNames.has(first))k=first;
  else if(first.length<=10&&/조사|훈련/.test(first)&&!/\d/.test(first))k=first;   // 한 목록만 있는 계획
  _noteKindCache.set(note,k);
  return k;
}
// 정보카드용 짧은 문구: 조사 → '조사 대상', 훈련 → '훈련 대상', 둘 다 → '조사·훈련 대상'
//   (이름이 '자료조사'·'소방훈련'이어도 '조사'·'훈련'으로 줄임)
function kindLabel(k){
  return String(k).split('·').map(s=>s.trim()).map(s=>/조사/.test(s)?'조사':/훈련/.test(s)?'훈련':s).join('·')+' 대상';
}
function kindIsMulti(k){return String(k).includes('·');}          // 여러 목록에 함께 든 대상 (예: 조사·훈련)
function kindShort(k){return String(k).split('·').map(s=>s.trim().charAt(0)).join('·');} // 조사·훈련 → 조·훈
// 마커 모양: 조사만 = 삼각형, 훈련만 = 동그라미, 둘 다(여러 목록) = 동그라미 안에 삼각형
//   이름에 '조사'/'훈련'이 없으면 목록 순서로: 첫째 = 삼각형, 둘째 = 동그라미, 셋째부터 = 네모
//   'tri' | 'circle' | 'both' | 'square' | '' (구분 없음 = 기존 동그라미)
function kindShape(k){
  if(!k)return '';
  if(kindIsMulti(k))return 'both';
  if(/조사/.test(k))return 'tri';
  if(/훈련/.test(k))return 'circle';
  const i=kinds.filter(x=>!kindIsMulti(x)).indexOf(k);
  return i===0?'tri':i===1?'circle':'square';
}
function kindShapeCls(d){
  const s=kindShape(itemKind(d));
  return s==='tri'?' k-tri':s==='both'?' k-both':s==='square'?' k-square':'';
}
// 삼각형·겹침 마커는 SVG로 그림 (색은 css color = 팀 색, 완료면 초록)
const KIND_SVG={
  tri:'<svg viewBox="0 0 16 15" width="16" height="15" aria-hidden="true"><polygon points="8,1.2 15,13.8 1,13.8" fill="currentColor" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>',
  both:'<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="8.6" fill="currentColor" stroke="#fff" stroke-width="2"/><polygon points="10,4.6 15.2,13.9 4.8,13.9" fill="#fff"/></svg>',
};
// 필터 칩·범례용 작은 모양 (회색)
function kindIconHtml(k){
  const s=kindShape(k);
  if(s==='tri'||s==='both')return `<span class="kicon" style="color:#94a3b8">${KIND_SVG[s].replace(/width="\d+" height="\d+"/,'width="11" height="11"')}</span>`;
  return `<span class="kicon kicon-${s==='square'?'sq':'ci'}"></span>`;
}

// ━━ 이름표 켜기/끄기 ━━ (선택은 이 브라우저에 기억)
const LABELS_KEY='fc_labels_on';
function labelsVisible(){
  if(labelsOn===null){
    const v=Utils.lsGet(LABELS_KEY,null);
    labelsOn=(v===null)?('ontouchstart' in window):!!v;
  }
  return labelsOn;
}
function updateLabelBtn(){document.getElementById('btnLabel')?.classList.toggle('on',labelsVisible());}
function toggleLabels(){
  labelsOn=!labelsVisible();
  Utils.lsSet(LABELS_KEY,labelsOn);
  items.forEach((d,i)=>{const o=overlays[i];if(o&&o.labelOverlay)o.labelOverlay.setMap(labelsOn&&!isHidden(d)?kakaoMap:null);});
  updateLabelBtn();
  showToast(labelsOn?'이름표 켬':'이름표 끔','');
}
function renderAllMarkers(){
  Object.values(overlays).forEach(o=>{o.overlay?.setMap(null);o.iw?.setMap(null);o.labelOverlay?.setMap(null);});
  if(clusterer)clusterer.clear();
  overlays={};
  items.forEach((d,i)=>{if(d.lat&&d.lng)addMarker(i,d);});
  updateLabelBtn();
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
  el.className=`kk-marker${kindShapeCls(d)}${isDone?' done':''}`;
  { const s=kindShape(itemKind(d)); if(KIND_SVG[s]){ el.innerHTML=KIND_SVG[s]; el.style.color=color; } }
  el.style.background=color; // 완료면 css의 .done(초록)이 우선
  el.id='mk-'+idx;
  el.style.position='relative';

  // 툴팁: body에 단 하나의 공유 툴팁 요소를 사용 (stacking context 탈출)
  el.addEventListener('mouseenter',()=>{
    if(iwOpen===iw)return;
    const r=el.getBoundingClientRect();
    const _k=itemKind(d);
    _sharedTooltip.textContent=_k?`${d.name} · ${kindLabel(_k)}`:d.name;
    _sharedTooltip.style.left=(r.left+r.width/2)+'px';
    _sharedTooltip.style.top=(r.bottom+6)+'px';
    _sharedTooltip.style.opacity='1';
  });
  el.addEventListener('mouseleave',()=>{_sharedTooltip.style.opacity='0';});
  // 이름표(이름 말풍선): 마커 아래 CustomOverlay. 툴바 🏷️ 이름표로 켜고 끔 (처음에는 휴대폰 켬, PC 끔)
  let labelOverlay=null;
  {
    const color=groupColor(d);
    const labelEl=document.createElement('div');
    labelEl.style.cssText=`padding:3px 8px;font-size:11px;font-weight:700;color:${color};background:rgba(255,255,255,0.95);border:1.5px solid ${color};border-radius:12px;white-space:normal;max-width:120px;word-break:keep-all;text-align:center;line-height:1.4;box-shadow:0 2px 6px rgba(0,0,0,.2);pointer-events:auto;cursor:pointer`;
    labelEl.addEventListener('click',openIw);
    let _lbTouchMoved=false;
    labelEl.addEventListener('touchstart',()=>{_lbTouchMoved=false;},{passive:true});
    labelEl.addEventListener('touchmove',()=>{_lbTouchMoved=true;},{passive:true});
    labelEl.addEventListener('touchend',e=>{if(!_lbTouchMoved){e.preventDefault();openIw();}},{passive:false});
    labelEl.textContent=d.name;
    if(kindIsMulti(itemKind(d))){   // 여러 목록 대상만 짧게 표시 (말풍선 폭이 좁아서)
      const kb=document.createElement('span');kb.className='lb-kind';kb.textContent=kindShort(itemKind(d));
      labelEl.appendChild(document.createTextNode(' '));labelEl.appendChild(kb);
    }
    labelOverlay=new kakao.maps.CustomOverlay({
      position:new kakao.maps.LatLng(d.lat,d.lng),
      content:labelEl,
      xAnchor:0.5,yAnchor:-0.3,
      zIndex:9,
    });
    if(labelsVisible())labelOverlay.setMap(kakaoMap);
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
  const {kind,from:kindFrom}=itemKindInfo(d);
  // 엑셀에서 고른 칸들 — 한 줄에 하나씩 "엑셀 제목  값"
  //   '구분'은 위 배지로 보여 주므로 빼고, 크로스 체크 비고(목록·묶음·행 번호)에서 구분을 읽었으면 그 긴 비고 줄도 뺌
  const extraRows=(d.extra&&typeof d.extra==='object')
    ?Object.entries(d.extra).filter(([k,v])=>k!=='구분'&&!(kindFrom&&k===kindFrom)&&String(v??'').trim()!=='')
    :[];

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
    ${kind?`<div class="iw-kindline${kindIsMulti(kind)?' multi':''}">${esc(kindLabel(kind))}</div>`:''}
    ${extraRows.length?`<dl class="iw-extra">${extraRows.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`:''}
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
