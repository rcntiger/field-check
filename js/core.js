/* field-check · js/core.js — 기본 도구 (esc · DOM 캐시 · 토스트 · 모달 · sbClient) */
AppFiles.reg('js/core.js','v3.1.0'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

/* ══════════ Utils & DOM Cache ══════════ */
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
const sleep=Utils.sleep;
// DOM 캐시 (반복 getElementById 호출 절감)
const _domCache={};
function $(id){return _domCache[id]||(_domCache[id]=document.getElementById(id));}

function showToast(msg,type=''){const t=$('toast');t.textContent=msg;t.className=`toast show ${type}`;setTimeout(()=>t.className='toast',4000);}
function showModal(id){$(id).classList.add('open');}
function hideModal(id){$(id).classList.remove('open');}
// Supabase는 공통 모듈 SupabaseUtil 사용 (init은 DOMContentLoaded에서)
const sbClient=()=>SupabaseUtil.getClient();
