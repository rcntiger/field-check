/* field-check · js/config.js — 상수 — 키·주소는 common/keys.js(APP_KEYS)에서 읽음 */
AppFiles.reg('js/config.js','v3.1.0'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

// ━━ 상수 ━━
// (APP_VERSION은 index.html 맨 위 한 곳에만 적는다 — 캐시 관리·파일 버전 확인에 함께 쓰임)
// ── 키·주소는 공통 키 설정(common/keys.js) 한 곳에서 관리 ── (이 파일에는 키를 적지 않음)
// 카카오 REST 키는 쓰지 않음 (주소·장소 검색은 common/kakao-geo.js가 지도 SDK services로 처리)
const _CFG=window.APP_KEYS||null;
const SB_URL  = _CFG?.SUPABASE?.inspec?.url;
const SB_KEY  = _CFG?.SUPABASE?.inspec?.anonKey;
if(window.KakaoGeo)KakaoGeo.init({jsKey:_CFG?.KAKAO_JS_KEY,libraries:['services','clusterer']});
const PHOTO_BUCKET = 'inspection-photos';
const GROUP_COLORS = ['#3b5fc4','#c0392b','#7c3aed','#b45309','#059669','#be185d'];
const GROUP_CLS    = ['g1','g2','g3','g4','g5','g6'];
let STATIONS = {
  fs:{key:'fs',name:'금천소방서',    lat:37.4647,lng:126.9015},
  sh:{key:'sh',name:'시흥119안전센터',lat:37.4447,lng:126.9089}
};
