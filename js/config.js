/* field-check · js/config.js — 상수 — 키·주소는 common/keys.js(APP_KEYS)에서 읽음 */
AppFiles.reg('js/config.js','v3.12.0'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

// ━━ 상수 ━━
// (APP_VERSION은 index.html 맨 위 한 곳에만 적는다 — 캐시 관리·파일 버전 확인에 함께 쓰임)
// ── 키·주소는 공통 키 설정(common/keys.js) 한 곳에서 관리 ── (이 파일에는 키를 적지 않음)
// 카카오 REST 키는 쓰지 않음 (주소·장소 검색은 common/kakao-geo.js가 지도 SDK services로 처리)
const _CFG=window.APP_KEYS||null;
const SB_URL  = _CFG?.SUPABASE?.inspec?.url;
const SB_KEY  = _CFG?.SUPABASE?.inspec?.anonKey;
if(window.KakaoGeo)KakaoGeo.init({jsKey:_CFG?.KAKAO_JS_KEY,libraries:['services','clusterer']});
const PHOTO_BUCKET = 'inspection-photos';
// 팀(그룹) 색표 — 색을 따로 정하지 않은 팀은 이 순서대로 자동으로 받음 (js/marker.js groupColorOf)
// 초록 계열은 넣지 않음: 점검 완료 마커가 초록색이라 헷갈림
const TEAM_PALETTE = [
  '#2563eb','#dc2626','#7c3aed','#ea580c','#0891b2','#db2777',
  '#ca8a04','#4338ca','#92400e','#0f766e','#be123c','#334155'
];
const NO_GROUP_COLOR = '#7d8590'; // 팀이 없는 대상
let STATIONS = {
  fs:{key:'fs',name:'금천소방서',    lat:37.4647,lng:126.9015},
  sh:{key:'sh',name:'시흥119안전센터',lat:37.4447,lng:126.9089}
};
