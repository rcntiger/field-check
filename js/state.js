/* field-check · js/state.js — 전역 상태 변수 */
AppFiles.reg('js/state.js','v2.0.2'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

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
