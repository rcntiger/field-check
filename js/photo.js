/* field-check · js/photo.js — 사진: 썸네일 · 압축 · 업로드 · 뷰어 · 바텀시트 */
AppFiles.reg('js/photo.js','v3.1.0'); // 파일 버전 표시 (tools/bump-version.py가 관리 — 손으로 고치지 않음)

/* ══════════ Photo Grid ══════════ */
function renderPhotoGrid(idx,photos){
  const grid=document.getElementById(`photoGrid-${idx}`);
  if(!grid)return;
  // innerHTML로 전체 렌더 (onclick 인라인 사용)
  const thumbsHtml=photos.map(p=>`
    <div class="iw-photo-thumb">
      <img src="${p.url}" loading="lazy" onclick="openPhotoViewer('${p.url}','')">
      <button class="iw-photo-del" onclick="deletePhoto(${idx},'${p.id}','${p.url}')">✕</button>
    </div>`).join('');
  grid.innerHTML=thumbsHtml;
}

// ━━ 이미지 압축 (공통 Utils 모듈) ━━
// 장변 1280px 이하, JPEG quality 0.75 → 압축 결과가 더 크면 원본 사용
async function compressImage(file){
  try{
    const blob=await Utils.compressImage(file,{maxWidth:1280,maxHeight:1280,quality:0.75});
    return (blob&&blob.size<file.size)?blob:file;
  }catch{ return file; }
}

// ━━ 사진 ━━
async function uploadPhotoFile(idx,file){
  const d=items[idx];if(!d||!currentProject||!file)return;
  showToast('사진 압축 중...','');
  let upload=file;
  try{upload=await compressImage(file);}catch{}
  const kb=Math.round(upload.size/1024);
  showToast(`업로드 중... (${kb}KB)`,'');
  try{
    const path=`${d.id}/${Date.now()}.jpg`;
    const url=await SupabaseUtil.uploadFile(PHOTO_BUCKET,path,upload);
    const [photo]=await SupabaseUtil.insert('inspection_photos',{item_id:d.id,inspection_id:currentProject.id,url,caption:''});
    if(!photoMap[d.id])photoMap[d.id]=[];
    photoMap[d.id].push(photo);
    renderPhotoGrid(idx,photoMap[d.id]);
    showToast(`사진 저장됨 (${kb}KB)`,'ok');
  }catch(e){showToast('업로드 실패: '+e.message,'err');console.error('uploadPhoto error:',e);}
}
// 하위 호환 (기존 inline onchange 혹시 남아있을 경우)
async function uploadPhoto(idx,input){
  if(!input.files[0])return;
  await uploadPhotoFile(idx,input.files[0]);
  input.value='';
}
async function deletePhoto(idx,photoId,url){
  if(!confirm('사진을 삭제하시겠습니까?'))return;
  const d=items[idx];if(!d)return;
  await SupabaseUtil.remove('inspection_photos',{id:photoId});
  // Storage에서도 삭제
  const path=url.split(`/${PHOTO_BUCKET}/`)[1];
  if(path)await SupabaseUtil.deleteFile(PHOTO_BUCKET,path);
  if(photoMap[d.id])photoMap[d.id]=photoMap[d.id].filter(p=>p.id!==photoId);
  renderPhotoGrid(idx,photoMap[d.id]||[]);
  showToast('사진 삭제됨','ok');
}
function openPhotoViewer(url,caption){
  document.getElementById('photoViewerImg').src=url;
  document.getElementById('photoViewerCaption').textContent=caption;
  document.getElementById('photoViewer').classList.add('open');
}
function closePhotoViewer(){document.getElementById('photoViewer').classList.remove('open');}

/* ══════════ Photo BottomSheet ══════════ */
let photoSheetIdx=-1;
function openPhotoSheet(idx){
  if(window.innerWidth>600){
    // PC: 바로 파일 선택창
    photoSheetIdx=idx;
    const el=document.getElementById('photoInputGallery');
    el.value='';el.click();
  }else{
    // 모바일: 바텀시트
    photoSheetIdx=idx;
    document.getElementById('photoSheetBg').classList.add('open');
  }
}
function closePhotoSheet(e){
  if(e&&e.target!==document.getElementById('photoSheetBg'))return;
  document.getElementById('photoSheetBg').classList.remove('open');
  photoSheetIdx=-1;
}
function triggerPhotoInput(mode){
  document.getElementById('photoSheetBg').classList.remove('open');
  if(mode==='camera'){
    const el=document.getElementById('photoInputCamera');
    el.value='';el.click();
  }else{
    const el=document.getElementById('photoInputGallery');
    el.value='';el.click();
  }
}
async function handlePhotoInput(input){
  if(photoSheetIdx<0||!input.files.length)return;
  const idx=photoSheetIdx;
  photoSheetIdx=-1;
  const files=Array.from(input.files);
  for(const file of files){
    await uploadPhotoFile(idx,file);
  }
  input.value='';
}
