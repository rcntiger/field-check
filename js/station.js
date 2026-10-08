/* field-check · js/station.js — 출발지 관리 · 기본 출발지 좌표 조회 */
AppFiles.reg('js/station.js','v3.1.2'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

// 기본 출발지(금천소방서·시흥119안전센터) 좌표를 도로명 주소로 구한다 (KakaoGeo — 지도 SDK services, REST 키 불필요)
// 이름 검색은 엉뚱한 곳(이름이 비슷한 다른 시설 등)이 잡힐 수 있어 쓰지 않는다. 주소 검색은 결과가 하나로 정해진다.
// 주소 검색이 실패하면 DEFAULT_STATIONS에 적힌 좌표를 그대로 쓴다.
// 직접 추가한 출발지는 등록할 때 주소로 구한 좌표를 쓰므로 건드리지 않는다
async function fetchStationCoords(){
  for(const key of Object.keys(STATIONS)){
    const def=DEFAULT_STATIONS.find(d=>d.key===key);
    if(!def)continue;
    // 예전 버전이 잘못 바꿔 저장해 둔 좌표가 있어도 기본 좌표에서 다시 시작
    STATIONS[key].lat=def.lat;STATIONS[key].lng=def.lng;
    if(!def.addr)continue;
    try{
      const doc=(await KakaoGeo.addressSearchRaw(def.addr,1)||[])[0];
      const lat=doc?parseFloat(doc.y):NaN,lng=doc?parseFloat(doc.x):NaN;
      if(isFinite(lat)&&isFinite(lng)){
        STATIONS[key].lat=lat;
        STATIONS[key].lng=lng;
      }else{
        console.warn('출발지 주소 검색 결과 없음 — 기본 좌표 사용:',def.name,def.addr);
      }
    }catch(e){console.warn('좌표 취득 실패:',def.name,e);}
  }
  // 출발지 설정 창이 열려 있으면 새 좌표로 다시 그림
  if(document.getElementById('stationModal')?.classList.contains('open'))renderStationList();
}

/* ══════════ Station Settings ══════════ */
const STATION_KEY='field_check_stations';
const DEFAULT_STATIONS=[
  // addr: 좌표를 구하는 기준 주소 (위치가 바뀌면 여기만 고침) · lat/lng: 주소 검색이 실패했을 때만 쓰는 예비 좌표
  {key:'fs',name:'금천소방서',addr:'서울 금천구 시흥대로 342',lat:37.4647,lng:126.9015},
  {key:'sh',name:'시흥119안전센터',addr:'서울 금천구 시흥대로45길 31',lat:37.4447,lng:126.9089}
];

function loadStations(){
  try{
    const parsed=Utils.lsGet(STATION_KEY,null);
    if(Array.isArray(parsed)&&parsed.length){
      STATIONS={};
      parsed.forEach(s=>{STATIONS[s.key]=s;});
      return;
    }
  }catch(e){console.warn('출발지 로드 실패',e);}
  // 기본값 유지 + key 필드 보장
  Object.keys(STATIONS).forEach(k=>{STATIONS[k].key=k;});
}

function saveStations(){
  const list=Object.entries(STATIONS).map(([k,s])=>({...s,key:k}));
  Utils.lsSet(STATION_KEY,list);
}

function showStationModal(){
  renderStationList();
  const addArea=document.getElementById('stationAddArea');
  if(addArea)addArea.style.display=Object.keys(STATIONS).length>=5?'none':'block';
  showModal('stationModal');
}

function renderStationList(){
  const el=document.getElementById('stationList');
  if(!el)return;
  const list=Object.values(STATIONS);
  if(!list.length){el.innerHTML='<div style="font-size:12px;color:var(--mt);text-align:center;padding:10px">등록된 출발지가 없습니다</div>';return;}
  const isMobile=window.innerWidth<=600;
  el.innerHTML=list.map((s,i)=>`
    <div class="station-item" data-key="${s.key}" ${!isMobile?'draggable="true"':''}
      style="display:flex;align-items:center;gap:8px;background:var(--sur2);border-radius:var(--r);padding:8px 10px;transition:opacity .15s;user-select:none">
      ${isMobile?`
        <div style="display:flex;flex-direction:column;gap:2px;flex-shrink:0">
          <button onclick="moveStation('${s.key}',-1)" ${i===0?'disabled':''}
            style="background:none;border:1px solid var(--bd2);border-radius:3px;color:${i===0?'var(--mt)':'var(--tx)'};cursor:${i===0?'default':'pointer'};font-size:10px;padding:1px 5px;line-height:1.4">▲</button>
          <button onclick="moveStation('${s.key}',1)" ${i===list.length-1?'disabled':''}
            style="background:none;border:1px solid var(--bd2);border-radius:3px;color:${i===list.length-1?'var(--mt)':'var(--tx)'};cursor:${i===list.length-1?'default':'pointer'};font-size:10px;padding:1px 5px;line-height:1.4">▼</button>
        </div>`
      :`<span style="color:var(--mt);cursor:grab;font-size:16px;padding:0 2px;flex-shrink:0" title="드래그하여 순서 변경">⠿</span>`}
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700;color:var(--tx)">${esc(s.name)}</div>
        <div style="font-size:10px;color:var(--mt);margin-top:2px">${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}</div>
      </div>
      <button onclick="removeStation('${s.key}')" style="background:none;border:none;color:var(--mt);cursor:pointer;font-size:16px;padding:2px 5px;border-radius:4px;flex-shrink:0" title="삭제">🗑</button>
    </div>`).join('');

  if(!isMobile){
    // PC: 드래그앤드롭
    let dragSrc=null;
    el.querySelectorAll('.station-item').forEach(item=>{
      item.addEventListener('dragstart',e=>{
        dragSrc=item;
        e.dataTransfer.effectAllowed='move';
        setTimeout(()=>item.style.opacity='0.4',0);
      });
      item.addEventListener('dragend',()=>{
        item.style.opacity='1';
        el.querySelectorAll('.station-item').forEach(i=>i.style.border='');
      });
      item.addEventListener('dragover',e=>{
        e.preventDefault();
        e.dataTransfer.dropEffect='move';
        if(item!==dragSrc)item.style.border='1px solid var(--ac)';
      });
      item.addEventListener('dragleave',()=>item.style.border='');
      item.addEventListener('drop',e=>{
        e.preventDefault();
        if(!dragSrc||dragSrc===item)return;
        item.style.border='';
        const keys=[...el.querySelectorAll('.station-item')].map(i=>i.dataset.key);
        const fromIdx=keys.indexOf(dragSrc.dataset.key);
        const toIdx=keys.indexOf(item.dataset.key);
        keys.splice(fromIdx,1);
        keys.splice(toIdx,0,dragSrc.dataset.key);
        const newStations={};
        keys.forEach(k=>{if(STATIONS[k])newStations[k]=STATIONS[k];});
        STATIONS=newStations;
        saveStations();refreshNaviSelects();renderStationList();
      });
    });
  }
}

function moveStation(key,dir){
  const keys=Object.keys(STATIONS);
  const idx=keys.indexOf(key);
  const newIdx=idx+dir;
  if(newIdx<0||newIdx>=keys.length)return;
  // 순서 교환
  [keys[idx],keys[newIdx]]=[keys[newIdx],keys[idx]];
  const newStations={};
  keys.forEach(k=>{newStations[k]=STATIONS[k];});
  STATIONS=newStations;
  saveStations();refreshNaviSelects();renderStationList();
}

async function addStation(){
  const name=document.getElementById('stationNewName').value.trim();
  const addr=document.getElementById('stationNewAddr').value.trim();
  if(!name){showToast('이름을 입력하세요','err');return;}
  if(!addr){showToast('주소를 입력하세요','err');return;}
  if(Object.keys(STATIONS).length>=5){showToast('최대 5개까지 등록 가능합니다','err');return;}
  showToast('좌표 검색 중...','');
  try{
    const data={documents:await KakaoGeo.addressSearchRaw(addr,1)};
    let lat,lng;
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
    const key='st_'+Date.now();
    STATIONS[key]={key,name,lat,lng};
    saveStations();
    document.getElementById('stationNewName').value='';
    document.getElementById('stationNewAddr').value='';
    renderStationList();
    refreshNaviSelects();
    const addArea=document.getElementById('stationAddArea');
    if(addArea)addArea.style.display=Object.keys(STATIONS).length>=5?'none':'block';
    showToast(`'${name}' 추가됨`,'ok');
  }catch(e){showToast('주소 검색 실패','err');}
}

function refreshNaviSelects(){
  // 현재 열린 정보카드의 select를 STATIONS 기준으로 갱신
  document.querySelectorAll('[id^="naviSel-"]').forEach(sel=>{
    const idx=sel.id.replace('naviSel-','');
    const cur=sel.value;
    sel.innerHTML=Object.values(STATIONS).map(s=>`<option value="${s.key}">🚒 ${esc(s.name)}</option>`).join('')
      +`<option value="custom">✏️ 직접 입력</option>`;
    // 이전 선택값 유지 (없으면 첫 번째)
    if(STATIONS[cur])sel.value=cur;
  });
}

function removeStation(key){
  if(!confirm(`'${STATIONS[key]?.name}' 출발지를 삭제하시겠습니까?`))return;
  delete STATIONS[key];
  saveStations();
  renderStationList();
  refreshNaviSelects();
  const addArea=document.getElementById('stationAddArea');
  if(addArea)addArea.style.display=Object.keys(STATIONS).length>=5?'none':'block';
  showToast('삭제됨','ok');
}
