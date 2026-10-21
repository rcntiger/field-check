/* field-check · js/core.js — 기본 도구 (esc · DOM 캐시 · 토스트 · 모달 · sbClient) */
AppFiles.reg('js/core.js','v3.12.2'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

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
// Supabase는 한 번에 최대 1000행만 돌려줌 → 1000행씩 나눠 끝까지 받기
// (SupabaseUtil.select는 한 번만 요청해서 1000행이 넘는 표는 뒤가 잘림)
// key: 순서를 고정할 고유 열 (inspection_done·inspection_memo는 id가 없고 item_id가 기본키)
async function sbSelectAll(table,{eq,order,columns='*',key='id'}={}){
  const PAGE=1000,out=[];
  for(let from=0;;from+=PAGE){
    let q=sbClient().from(table).select(columns);
    if(eq)Object.entries(eq).forEach(([k,v])=>{q=q.eq(k,v);});
    if(order)q=q.order(order.column,{ascending:order.ascending!==false});
    q=q.order(key,{ascending:true});           // 나눠 받을 때 순서가 흔들리지 않게
    const {data,error}=await q.range(from,from+PAGE-1);
    if(error)throw new Error(`select(${table}): ${error.message}`);
    out.push(...(data||[]));
    if(!data||data.length<PAGE)break;
  }
  return out;
}
// 행 수만 세기 (데이터를 받지 않음)
async function sbCount(table,eq){
  let q=sbClient().from(table).select('*',{count:'exact',head:true});
  Object.entries(eq||{}).forEach(([k,v])=>{q=q.eq(k,v);});
  const {count,error}=await q;
  if(error)throw new Error(`count(${table}): ${error.message}`);
  return count||0;
}
