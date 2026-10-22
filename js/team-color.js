/* field-check · js/team-color.js — 팀 색 지정 창 (계획마다 inspections.group_colors에 저장) */
AppFiles.reg('js/team-color.js','v3.14.3'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

// 속성값용 이스케이프 (팀 이름에 따옴표가 있어도 안전하게)
function escAttr(t){return esc(t).replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

// 색 위에 올릴 글자색 (밝은 색이면 검정, 어두운 색이면 흰색)
function teamTextColor(hex){
  if(!isHexColor(hex))return '#fff';
  const n=parseInt(hex.slice(1),16),r=n>>16&255,g=n>>8&255,b=n&255;
  return (0.299*r+0.587*g+0.114*b)>165?'#111':'#fff';
}
// 점검 완료(초록)와 헷갈릴 만한 초록 계열인지
function isGreenish(hex){
  if(!isHexColor(hex))return false;
  const n=parseInt(hex.slice(1),16);
  const r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;
  if(d<0.15||mx!==g)return false;          // 회색 계열이거나 초록이 가장 세지 않음
  let h=60*(((b-r)/d)+2);                   // 초록이 가장 셀 때의 색상각
  return h>=85&&h<=165;
}

let _tcDraft={}; // 창에서 고르는 중인 색 (팀 이름 → '#rrggbb')
function showTeamColorModal(){
  if(!currentProject||!groups.length){showToast('팀(그룹)이 있는 계획에서만 쓸 수 있습니다','err');return;}
  _tcDraft={};
  groups.forEach(g=>{_tcDraft[g]=groupColorOf(g).toLowerCase();});
  renderTeamColorList();
  showModal('teamColorModal');
}
function renderTeamColorList(){
  const counts={};
  items.forEach(d=>{if(d.group_name)counts[d.group_name]=(counts[d.group_name]||0)+1;});
  const pal=TEAM_PALETTE.map(c=>c.toLowerCase());
  document.getElementById('tcList').innerHTML=groups.map((g,i)=>{
    const cur=_tcDraft[g];
    const isCustom=!pal.includes(cur);
    return `<div class="tc-row">
      <div class="tc-head"><span class="tc-cur" style="background:${cur}"></span><span class="tc-name">${esc(g)}</span><span class="tc-cnt">${counts[g]||0}곳</span></div>
      <div class="tc-sw">
        ${pal.map(c=>`<button type="button" class="${c===cur?'on':''}" style="background:${c}" title="${c}" aria-label="${escAttr(g)} 색 ${c}" onclick="pickTeamColor(${i},'${c}')"></button>`).join('')}
        <label class="tc-custom${isCustom?' on':''}" title="다른 색 고르기" style="${isCustom?`background:${cur}`:''}">${isCustom?'':'＋'}<input type="color" value="${cur}" onchange="pickTeamColor(${i},this.value)" aria-label="${escAttr(g)} 다른 색 고르기"></label>
      </div>
    </div>`;
  }).join('');
  // 알림: 같은 색을 쓰는 팀 · 초록 계열
  const byColor={};
  groups.forEach(g=>{(byColor[_tcDraft[g]]=byColor[_tcDraft[g]]||[]).push(g);});
  const warns=[];
  Object.values(byColor).filter(a=>a.length>1).forEach(a=>warns.push(`같은 색을 쓰는 팀: ${a.map(esc).join(' · ')}`));
  const green=groups.filter(g=>isGreenish(_tcDraft[g]));
  if(green.length)warns.push(`초록 계열은 점검 완료 표시와 헷갈릴 수 있습니다: ${green.map(esc).join(' · ')}`);
  document.getElementById('tcWarn').innerHTML=warns.map(w=>'⚠ '+w).join('<br>');
}
function pickTeamColor(i,c){
  const g=groups[i];
  if(g==null||!isHexColor(c))return;
  _tcDraft[g]=c.toLowerCase();
  renderTeamColorList();
}

// 저장: 모든 팀의 색을 한꺼번에 저장 (나중에 한 팀만 바꿔도 다른 팀 색이 따라 바뀌지 않도록)
async function saveTeamColors(){
  const map={};
  groups.forEach(g=>{if(isHexColor(_tcDraft[g]))map[g]=_tcDraft[g];});
  await _writeTeamColors(map,'팀 색을 저장했습니다');
}
// 자동 색으로: 저장된 색을 모두 지움
async function resetTeamColors(){
  if(!confirm('정한 색을 모두 지우고 자동 색으로 되돌릴까요?'))return;
  await _writeTeamColors({},'자동 색으로 되돌렸습니다');
}
async function _writeTeamColors(map,okMsg){
  if(!currentProject)return;
  // 같은 칸에 저장된 마커 모양(__kind_shapes)은 그대로 둠
  const ks=currentProject.group_colors&&currentProject.group_colors.__kind_shapes;
  if(ks)map={...map,__kind_shapes:ks};
  const btn=document.getElementById('tcSaveBtn');
  btn.disabled=true;
  try{
    // 지금 있는 팀만 저장 → 엑셀을 다시 올려 팀 이름이 바뀌어도 옛 이름이 쌓이지 않음
    const {data,error}=await sbClient().from('inspections')
      .update({group_colors:map}).eq('id',currentProject.id).select('id');
    if(error)throw error;
    if(!Array.isArray(data)||!data.length)throw new Error('저장되지 않았습니다 (권한 확인 필요)');
    currentProject.group_colors=map;
    const p=projectList.find(x=>String(x.id)===String(currentProject.id));
    if(p)p.group_colors=map;
    hideModal('teamColorModal');
    applyTeamColors();
    showToast(okMsg,'ok');
  }catch(e){
    const m=(e&&e.message)||String(e||'');
    const noCol=(e&&e.code==='PGRST204')||/group_colors/.test(m);
    showToast('저장 실패: '+(noCol?'DB 설정이 아직 적용되지 않았습니다 (sql/v3.2.0_team_colors.sql 실행 필요)':m),'err');
  }finally{btn.disabled=false;}
}
// 바뀐 색을 지도·목록·필터에 다시 그림 (고른 필터는 유지)
function applyTeamColors(){
  refreshGroupColors();
  if(iwOpen){iwOpen.setMap(null);iwOpen=null;}
  activeMarkerEl=null;
  renderAllMarkers();
  renderList();
  buildGroupFilter();
  applyFilter();
}
