/* field-check · js/geocode.js — 주소 → 좌표 (KakaoGeo) */
AppFiles.reg('js/geocode.js','v3.0.0'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

async function geocodeAddr(addr){
  if(!addr)return null;
  // 도로명/지번이 짧으면 금천구 추가
  const fullAddr=addr.includes('서울')||addr.includes('금천')?addr:'서울 금천구 '+addr;
  // 주소 검색
  const d=await KakaoGeo.addressSearchRaw(fullAddr,1);
  if(d[0])return{lat:+d[0].y,lng:+d[0].x};
  // 키워드 검색 폴백
  const d2=await KakaoGeo.keywordSearchRaw(fullAddr,1);
  if(d2[0])return{lat:+d2[0].y,lng:+d2[0].x};
  await sleep(80);
  return null;
}
