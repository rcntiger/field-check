/* field-check · js/kind-shape.js — 업무 구분 값마다 마커 모양 고르기 (계획마다 inspections.group_colors.__kind_shapes에 저장) */
AppFiles.reg('js/kind-shape.js','v3.14.2'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

let _ksDraft={};
function showKindShapeModal(){
  const singles=kinds.filter(k=>!kindIsMulti(k));
  if(!currentProject||!singles.length){showToast('업무 구분이 있는 계획에서만 쓸 수 있습니다','err');return;}
  _ksDraft={};singles.forEach(k=>{_ksDraft[k]=kindShape(k);});
  renderKindShapeList();
  showModal('kindShapeModal');
}
function renderKindShapeList(){
  const singles=kinds.filter(k=>!kindIsMulti(k)),multi=kinds.filter(kindIsMulti);
  const cnt={};items.forEach(d=>{const k=itemKind(d);if(k)cnt[k]=(cnt[k]||0)+1;});
  const rows=singles.map((k,i)=>`<div class="ks-row">
      <div class="ks-head"><span class="ks-cur">${shapeSvg(_ksDraft[k],18,'#64748b','#fff')}</span><span class="ks-name">${esc(kindLabel(k))}</span><span class="ks-cnt">${cnt[k]||0}곳</span></div>
      <div class="ks-pick">${SHAPES.map(s=>`<button type="button" class="${_ksDraft[k]===s?'on':''}" title="${SHAPE_NAMES[s]}" aria-label="${escAttr(kindLabel(k))} ${SHAPE_NAMES[s]}" onclick="pickKindShape(${i},'${s}')">${shapeSvg(s,16,'currentColor')}</button>`).join('')}</div>
    </div>`).join('');
  const note=multi.length?`<div class="ks-note">${shapeSvg('both',14,'#64748b','#fff')} 여러 구분이 겹친 대상(${multi.map(m=>esc(kindLabel(m))).join(', ')})은 동그라미 안 삼각형으로 고정입니다.</div>`:'';
  document.getElementById('ksList').innerHTML=rows+note;
  // 같은 모양을 두 구분이 쓰면 알림
  const by={};singles.forEach(k=>{(by[_ksDraft[k]]=by[_ksDraft[k]]||[]).push(kindLabel(k));});
  document.getElementById('ksWarn').innerHTML=Object.entries(by).filter(([,a])=>a.length>1).map(([s,a])=>`⚠ 같은 모양(${SHAPE_NAMES[s]})을 쓰는 구분: ${a.map(esc).join(' · ')}`).join('<br>');
}
function pickKindShape(i,s){
  const k=kinds.filter(x=>!kindIsMulti(x))[i];
  if(k==null||!SHAPES.includes(s))return;
  _ksDraft[k]=s;renderKindShapeList();
}
async function saveKindShapes(){
  const map={};Object.entries(_ksDraft).forEach(([k,s])=>{if(SHAPES.includes(s))map[k]=s;});
  await _writeKindShapes(map,'마커 모양을 저장했습니다');
}
async function resetKindShapes(){
  if(!confirm('정한 모양을 지우고 자동 모양으로 되돌릴까요?'))return;
  await _writeKindShapes(null,'자동 모양으로 되돌렸습니다');
}
// 팀 색과 같은 칸(group_colors)에 넣되, 팀 색은 그대로 둠
async function _writeKindShapes(map,okMsg){
  if(!currentProject)return;
  const btn=document.getElementById('ksSaveBtn');btn.disabled=true;
  try{
    const cur={...(currentProject.group_colors&&typeof currentProject.group_colors==='object'?currentProject.group_colors:{})};
    if(map&&Object.keys(map).length)cur.__kind_shapes=map;else delete cur.__kind_shapes;
    const {data,error}=await sbClient().from('inspections').update({group_colors:cur}).eq('id',currentProject.id).select('id');
    if(error)throw error;
    if(!Array.isArray(data)||!data.length)throw new Error('저장되지 않았습니다 (권한 확인 필요)');
    currentProject.group_colors=cur;
    const p=projectList.find(x=>String(x.id)===String(currentProject.id));if(p)p.group_colors=cur;
    hideModal('kindShapeModal');
    if(iwOpen){iwOpen.setMap(null);iwOpen=null;}
    renderAllMarkers();buildKindFilter();applyFilter();
    showToast(okMsg,'ok');
  }catch(e){
    const m=(e&&e.message)||String(e||'');
    const noCol=(e&&e.code==='PGRST204')||/group_colors/.test(m);
    showToast('저장 실패: '+(noCol?'DB 설정이 아직 적용되지 않았습니다 (sql/v3.2.0_team_colors.sql 실행 필요)':m),'err');
  }finally{btn.disabled=false;}
}
