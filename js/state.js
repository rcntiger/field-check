/* field-check · js/state.js — 전역 상태 변수 */
AppFiles.reg('js/state.js','v3.14.1'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

/* ══════════ State ══════════ */
let kakaoMap=null,rvInstance=null,rvMinimapInst=null,rvOverlay=null,minimapOn=false;
let clusterer=null;
let rvMode=false,distMode=false,distLine=null,distMarkers=[],distPath=[],satMode=false;
let roadPolylines=[],iwOpen=null,activeMarkerEl=null,lastIw=null,activeIdx=-1;
let _sharedTooltip=null;
let searchMarkers=[],mobMapMode=false;
let memoTimers={};

let currentProject=null;
let projectList=[];
let items=[],overlays={};
let doneMap={},memoMap={},photoMap={};
let groups=[],filterGroup=new Set(['all']),filterText='';
let labelsOn=null;   // 마커 이름표 켜짐 여부 (null = 아직 안 정함 → labelsVisible())
let kinds=[],filterKind=new Set(['all']);   // 업무 구분(조사·훈련 등) — 추가정보의 '구분' 값
