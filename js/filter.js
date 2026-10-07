/* field-check · js/filter.js — 그룹 필터 · 정렬 · 필터 적용 · 통계 */
AppFiles.reg('js/filter.js','v3.0.0'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

// ━━ 그룹 필터 ━━
function buildGroupFilter(){
  const panel=document.getElementById('groupPanel');
  const row=document.getElementById('groupFilter');
  if(!groups.length){panel.style.display='none';return;}
  panel.style.display='block';
  row.innerHTML=`<span class="fbtn active" id="gf-all" onclick="toggleGroup('all')">전체</span>`
    +groups.map((g,i)=>`<span class="fbtn ${GROUP_CLS[i%6]}" id="gf-${i}" onclick="toggleGroup('${g}')">${g} <span class="dcnt" id="gc-${i}"></span></span>`).join('');
  updateGroupCounts();
}
function toggleGroup(g){
  if(g==='all')filterGroup=new Set(['all']);
  else{filterGroup.delete('all');filterGroup.has(g)?filterGroup.delete(g):filterGroup.add(g);if(!filterGroup.size)filterGroup=new Set(['all']);}
  const isAll=filterGroup.has('all');
  document.getElementById('gf-all')?.classList.toggle('active',isAll);
  groups.forEach((grp,i)=>document.getElementById(`gf-${i}`)?.classList.toggle('active',!isAll&&filterGroup.has(grp)));
  applyFilter();
}
function updateGroupCounts(){
  const vis=items.filter(d=>!filterText||d.name.toLowerCase().includes(filterText.toLowerCase()));
  groups.forEach((g,i)=>{const el=document.getElementById(`gc-${i}`);if(el)el.textContent=vis.filter(d=>d.group_name===g).length;});
}
function isHidden(d){
  if(!filterGroup.has('all')&&!filterGroup.has(d.group_name||''))return true;
  if(filterText&&!d.name.toLowerCase().includes(filterText.toLowerCase())&&!(d.address||'').toLowerCase().includes(filterText.toLowerCase()))return true;
  return false;
}
let sortMode='';
function setSort(mode){
  if(sortMode===mode){
    sortMode='';
    document.getElementById('sortName')?.classList.remove('active');
    document.getElementById('sortAddr')?.classList.remove('active');
  }else{
    sortMode=mode;
    document.getElementById('sortName')?.classList.toggle('active',mode==='name');
    document.getElementById('sortAddr')?.classList.toggle('active',mode==='addr');
  }
  if(sortMode==='name') items.sort((a,b)=>a.name.localeCompare(b.name,'ko'));
  else if(sortMode==='addr') items.sort((a,b)=>(a.address||'').localeCompare(b.address||'','ko'));
  renderList();
  applyFilter();
}

function applyFilter(){
  filterText=document.getElementById('searchInput').value.trim();
  items.forEach((d,i)=>{
    const hide=isHidden(d);
    document.getElementById(`item-${i}`)?.classList.toggle('hidden',hide);
    const o=overlays[i];
    if(o){
      o.overlay?.setMap(hide?null:kakaoMap);
      o.labelOverlay?.setMap(hide?null:kakaoMap);
      // 클러스터러 계산용 invisible 마커도 같이 빼줘야 카카오 기본 풍선이 남지 않음
      if(clusterer&&o.clMarker&&o.hidden!==hide){
        if(hide)clusterer.removeMarker(o.clMarker);
        else clusterer.addMarker(o.clMarker,true);
        o.hidden=hide;
      }
    }
  });
  updateStats();updateGroupCounts();
}

// ━━ 통계 ━━
function updateStats(){
  const filtered=items.filter(d=>!isHidden(d));
  const tot=filtered.length;
  const done=filtered.filter(d=>doneMap[d.id]).length;
  const pct=tot?Math.round(done/tot*100):0;
  document.getElementById('sTot').textContent=tot;
  document.getElementById('sDone').textContent=done;
  document.getElementById('sLeft').textContent=tot-done;
  document.getElementById('sPct').textContent=pct+'%';
  document.getElementById('progFill').style.width=pct+'%';
  document.getElementById('progLabel').textContent=done+' / '+tot+' ('+pct+'%)';
}
