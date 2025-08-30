
/* ====================== CONFIG & ENDPOINTS ====================== */
const ID_USER_RAW = "1yKVeFVfqy8XRHvixY60DsxTy1ozC4GUa"; // ganti jika dirender via n8n
function resolveIdUser(){
  if (/\{\{\s*\$json\.id\s*\}\}/.test(ID_USER_RAW)){
    const u = new URL(location.href);
    return (u.searchParams.get('id')
      || u.pathname.split('/').filter(Boolean).pop()
      || "").trim();
  }
  return ID_USER_RAW.trim();
}
let ID_USER = resolveIdUser();
let JSON_URL = ID_USER ? ("https://distrikwania.com/data/"+encodeURIComponent(ID_USER)) : "";

/* --- ENDPOINTS n8n (ganti sesuai flow Anda) --- */
const URL_CREATE       = 'https://n8n-qz8tp6856ibc.bgxy.sumopod.my.id/webhook/57feb799-ddb2-4b0c-bfc0-b4e077558c79';
const URL_UPDATE       = 'https://n8n-qz8tp6856ibc.bgxy.sumopod.my.id/webhook/e1863045-3bfd-497d-b8a3-fc2c7c23eaa7';
const URL_UPLOAD       = 'https://n8n-qz8tp6856ibc.bgxy.sumopod.my.id/webhook/1ae8a1a1-9f9d-4792-8505-9c84e1d3654b';
const URL_DELETE_FILE  = 'https://n8n-qz8tp6856ibc.bgxy.sumopod.my.id/webhook/1ae8a1a1-9f9d-4792-8505-9c84e1d3654b'; // <-- GANTI ke webhook delete file Anda (URL_DELETE_FILE)

const UPDATE_STRATEGY = 'OVERWRITE_BIN';

/* ====================== DOM HELPERS ====================== */
const E = (id) => document.getElementById(id);

/* elemen yang ADA di HTML */
const DOM = {
  // header
  jenis_surat: E('jenis_surat'),
  nomor_surat: E('nomor_surat'),
  tanggal_surat: E('tanggal_surat'),
  operator:     E('operator'),
  logo:         E('LogoURL'),

  // identitas (view)
  d: {
    nama: E('nama'), nik: E('nik'), ttl: E('ttl'), agama: E('agama'),
    jk: E('jenis_kelamin'), status: E('status_perkawinan'),
    pekerjaan: E('pekerjaan'), alamat: E('alamat'),
    kelurahan: E('kelurahan'), kecamatan: E('kecamatan'),
    kota_kab: E('kota_kab'), provinsi: E('provinsi'),
  },

  // identitas (edit)
  e: {
    nama: E('editNama'), nik: E('editNIK'), ttl: E('editTTL'),
    agama: E('editAgama'), jk: E('editJenisKelamin'),
    status: E('editStatusPerkawinan'), pekerjaan: E('editPekerjaan'),
    alamat: E('editAlamat'), kelurahan: E('editKelurahan'),
    kecamatan: E('editKecamatan'), kota_kab: E('editKotaKab'),
    provinsi: E('editProvinsi'),
  },

  // keterangan & list file
  keterangan_kelurahan: E('keterangan_kelurahan'),
  tahun: E('tahun'),
  uploadedList: E('uploadedFilesList'),

  // upload
  fileInput: E('fileInput'),
  uploadBtn: E('uploadBtn'),
  fileInfo:  E('fileInfo'),
  uploadProgress: E('uploadProgress'),
  uploadProgressBar: E('uploadProgressBar'),

  // popup sukses buat surat
  popupOverlay: E('popupOverlay'),
};
if (DOM.tahun) DOM.tahun.textContent = new Date().getFullYear();

/* ====================== UTILS ====================== */
function safe(x, fb='-'){ return (x ?? '').toString().trim() || fb; }
function normalizeDokumen(docs){
  const arr = Array.isArray(docs) ? docs : [];
  const out = []; const seen = new Set();
  for (const d of arr){
    const fid = d?.file_id || d?.id || null;
    const key = fid ? ('fid:'+fid) : ('name:'+(d?.name||'').toLowerCase()+'|size:'+(d?.size||0));
    if (seen.has(key)) continue; seen.add(key);
    out.push({
      label: d?.label ?? d?.name ?? '-',
      name: d?.name ?? d?.label ?? '-',
      mimeType: d?.mimeType ?? null,
      size: typeof d?.size==='number' ? d.size : (+d?.size || null),
      file_id: fid,
      view_url: d?.view_url ?? null,
      download_url: d?.download_url ?? null,
    });
  }
  return out;
}

/* ====================== RENDERERS ====================== */
function fillView(obj){
  // header
  if (DOM.jenis_surat)   DOM.jenis_surat.textContent   = safe(obj.jenis_surat);
  if (DOM.nomor_surat)   DOM.nomor_surat.textContent   = safe(obj.nomor_surat);
  if (DOM.tanggal_surat) DOM.tanggal_surat.textContent = safe(obj.tanggal_surat);
  if (DOM.operator)      DOM.operator.textContent      = safe(obj.operator);
  if (DOM.logo && obj.LogoURL) DOM.logo.src = obj.LogoURL;

  // identitas view
  const p = obj.pemohon || {};
  if (DOM.d.nama)       DOM.d.nama.textContent       = safe(p.nama);
  if (DOM.d.nik)        DOM.d.nik.textContent        = safe(p.nik);
  if (DOM.d.ttl)        DOM.d.ttl.textContent        = safe(p.ttl);
  if (DOM.d.agama)      DOM.d.agama.textContent      = safe(p.agama);
  if (DOM.d.jk)         DOM.d.jk.textContent         = safe(p.jenis_kelamin);
  if (DOM.d.status)     DOM.d.status.textContent     = safe(p.status_perkawinan);
  if (DOM.d.pekerjaan)  DOM.d.pekerjaan.textContent  = safe(p.pekerjaan);
  if (DOM.d.alamat)     DOM.d.alamat.textContent     = safe(p.alamat);
  if (DOM.d.kelurahan)  DOM.d.kelurahan.textContent  = safe(p.kelurahan);
  if (DOM.d.kecamatan)  DOM.d.kecamatan.textContent  = safe(p.kecamatan);
  if (DOM.d.kota_kab)   DOM.d.kota_kab.textContent   = safe(p.kota_kab);
  if (DOM.d.provinsi)   DOM.d.provinsi.textContent   = safe(p.provinsi);
  if (DOM.keterangan_kelurahan) DOM.keterangan_kelurahan.textContent = safe(p.kelurahan);

  // sinkron nilai awal ke input edit
  if (DOM.e.nama)       DOM.e.nama.value       = safe(p.nama,'');
  if (DOM.e.nik)        DOM.e.nik.value        = safe(p.nik,'');
  if (DOM.e.ttl)        DOM.e.ttl.value        = safe(p.ttl,'');
  if (DOM.e.agama)      DOM.e.agama.value      = safe(p.agama,'');
  if (DOM.e.jk)         DOM.e.jk.value         = safe(p.jenis_kelamin,'LAKI-LAKI');
  if (DOM.e.status)     DOM.e.status.value     = safe(p.status_perkawinan,'BELUM KAWIN');
  if (DOM.e.pekerjaan)  DOM.e.pekerjaan.value  = safe(p.pekerjaan,'');
  if (DOM.e.alamat)     DOM.e.alamat.value     = safe(p.alamat,'');
  if (DOM.e.kelurahan)  DOM.e.kelurahan.value  = safe(p.kelurahan,'');
  if (DOM.e.kecamatan)  DOM.e.kecamatan.value  = safe(p.kecamatan,'');
  if (DOM.e.kota_kab)   DOM.e.kota_kab.value   = safe(p.kota_kab,'');
  if (DOM.e.provinsi)   DOM.e.provinsi.value   = safe(p.provinsi,'');
}

function renderUploadedFiles(obj){
  const box = DOM.uploadedList;
  if (!box) return;
  box.innerHTML = '';
  const docs = normalizeDokumen(obj?.dokumen);
  if (!docs.length){
    box.innerHTML = '<div class="no-files-message">Belum ada file yang diupload</div>';
    return;
  }
  for (const d of docs){
    const row = document.createElement('div');
    row.className = 'uploaded-file-item';
    const btnDelete = d.file_id ? `<button class="file-remove" onclick="deleteSingleFile('${d.file_id}')">Hapus</button>` : '';
    row.innerHTML = `
      <div class="file-icon">📎</div>
      <div class="file-details">
        <div class="file-name">${d.name || d.label || '-'}</div>
        <div class="file-meta">${d.mimeType || '-'} • ${d.size ? d.size.toLocaleString('id-ID')+' bytes' : '-'}</div>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        ${d.view_url ? `<a class="btn ghost" href="${d.view_url}" target="_blank" rel="noopener">Lihat</a>` : ''}
        ${d.download_url ? `<a class="btn ghost" href="${d.download_url}" target="_blank" rel="noopener">Unduh</a>` : ''}
        ${btnDelete}
      </div>`;
    box.appendChild(row);
  }
}

/* ====================== LOADER ====================== */
let lastObj = null;
async function load(){
  if (!JSON_URL) return;
  const res = await fetch(JSON_URL+'?t='+Date.now(), { cache: 'no-store' });
  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); }
  catch { console.warn('Respon bukan JSON valid'); return; }
  const root = Array.isArray(data) ? data[0] : data;
  lastObj = root || {};
  fillView(lastObj);
  renderUploadedFiles(lastObj);
}
load();
let loadInterval = setInterval(load, 1200);

/* ====================== EDIT MODE (TOMBOL EDIT) ====================== */
function toggleEditMode(){
  const card = document.querySelector('.card');
  card.classList.toggle('edit-mode');
  if (card.classList.contains('edit-mode')){
    clearInterval(loadInterval); // pause refresh saat edit
  } else {
    load();
    loadInterval = setInterval(load, 1200);
  }
}
function cancelEdit(){
  document.querySelector('.card').classList.remove('edit-mode');
  load();
  clearInterval(loadInterval);
  loadInterval = setInterval(load, 1200);
}
function saveChanges(){
  if (!lastObj) lastObj = {};
  const p = lastObj.pemohon || (lastObj.pemohon = {});
  p.nama = DOM.e.nama?.value?.trim() || '';
  p.nik  = DOM.e.nik?.value?.trim() || '';
  p.ttl  = DOM.e.ttl?.value?.trim() || '';
  p.agama = DOM.e.agama?.value?.trim() || '';
  p.jenis_kelamin = DOM.e.jk?.value || '';
  p.status_perkawinan = DOM.e.status?.value || '';
  p.pekerjaan = DOM.e.pekerjaan?.value?.trim() || '';
  p.alamat = DOM.e.alamat?.value?.trim() || '';
  p.kelurahan = DOM.e.kelurahan?.value?.trim() || '';
  p.kecamatan = DOM.e.kecamatan?.value?.trim() || '';
  p.kota_kab = DOM.e.kota_kab?.value?.trim() || '';
  p.provinsi = DOM.e.provinsi?.value?.trim() || '';
  fillView(lastObj);
  toggleEditMode();
}

/* ====================== FUNGSI TOMBOL: BUAT/UPDATE/UPLOAD/DELETE ====================== */
function buildCleanPayload(){
  const base = lastObj || {};
  const obj = JSON.parse(JSON.stringify(base));
  if (Array.isArray(obj.dokumen)) obj.dokumen = normalizeDokumen(obj.dokumen);
  obj.id_user = ID_USER;
  return obj;
}

async function generateAndSendLetter(){
  try{
    const payload = buildCleanPayload();
    const resp = await fetch(URL_CREATE, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if(!resp.ok) throw new Error('HTTP '+resp.status+' — '+(await resp.text()).slice(0,200));
    if (DOM.popupOverlay) DOM.popupOverlay.style.display = 'flex';
  }catch(e){
    alert('Gagal membuat surat: '+e.message);
  }
}
function closePopup(){ if (DOM.popupOverlay) DOM.popupOverlay.style.display = 'none'; }

async function deleteLetterAndData(){
  if(!confirm('Hapus surat & data untuk ID: '+ID_USER+' ?')) return;
  try{
    const resp = await fetch(URL_UPDATE, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'DELETE_ALL', id_user:ID_USER })
    });
    if(!resp.ok) throw new Error('HTTP '+resp.status+' — '+(await resp.text()).slice(0,200));
    alert('Data terhapus.');
    load();
  }catch(e){
    alert('Gagal menghapus: '+e.message);
  }
}

/* ---- HAPUS SATU FILE via URL_DELETE_FILE ---- */
async function deleteSingleFile(fileId){
  if(!fileId){ alert('file_id tidak ditemukan.'); return; }
  if(!confirm('Hapus file ini?\nID: '+fileId)) return;
  try{
    const resp = await fetch(URL_DELETE_FILE, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'DELETE_FILE', id_user: ID_USER, file_id: fileId })
    });
    const text = await resp.text();
    if(!resp.ok) throw new Error('HTTP '+resp.status+' — '+text.slice(0,200));
    // refresh data
    await load();
  }catch(e){
    alert('Gagal menghapus file: '+e.message);
  }
}

async function uploadFiles(){
  try{
    const files = Array.from(DOM.fileInput?.files || []);
    if(!files.length){ alert('Pilih minimal satu file.'); return; }

    if (DOM.fileInfo) DOM.fileInfo.style.display = 'block';
    if (DOM.uploadProgress) DOM.uploadProgress.style.display = 'block';
    if (DOM.uploadProgressBar) DOM.uploadProgressBar.style.width = '0%';

    const payload = buildCleanPayload();
    const files_info = files.map(f=>({name:f.name,size:f.size,type:f.type||null}));

    const form = new FormData();
    form.append('data', JSON.stringify(payload));
    form.append('id_user', ID_USER);
    form.append('files_info', JSON.stringify(files_info));
    files.forEach(f => form.append('files[]', f, f.name));

    const resp = await fetch(URL_UPLOAD, { method:'POST', body:form });
    const text = await resp.text();
    if(!resp.ok) throw new Error('HTTP '+resp.status+' — '+text.slice(0,200));

    if (DOM.uploadProgressBar) DOM.uploadProgressBar.style.width = '100%';
    DOM.fileInput.value = '';
    await load();
    alert('Upload sukses.');
  }catch(e){
    alert('Upload gagal: '+e.message);
  }finally{
    if (DOM.uploadBtn) DOM.uploadBtn.style.display = 'none';
    if (DOM.uploadProgressBar) setTimeout(()=>{ DOM.uploadProgressBar.style.width='0%'; }, 800);
  }
}

/* ====================== DRAG & DROP & FILE SELECT ====================== */
function handleDragOver(ev){
  ev.preventDefault();
  ev.currentTarget.style.borderColor = 'rgba(56,189,248,.8)';
}
function handleDragLeave(ev){
  ev.currentTarget.style.borderColor = 'rgba(148,163,184,.15)';
}
function handleDrop(ev){
  ev.preventDefault();
  ev.currentTarget.style.borderColor = 'rgba(148,163,184,.15)';
  if (!DOM.fileInput) return;
  const dt = new DataTransfer();
  for (const f of ev.dataTransfer.files) dt.items.add(f);
  DOM.fileInput.files = dt.files;
  handleFileSelect();
}
function handleFileSelect(){
  const files = Array.from(DOM.fileInput?.files || []);
  if (files.length){
    if (DOM.fileInfo){
      DOM.fileInfo.innerHTML = files.map(f=>`<div class="file-info">• ${f.name} (${(f.size||0).toLocaleString('id-ID')} B)</div>`).join('');
      DOM.fileInfo.style.display = 'block';
    }
    if (DOM.uploadBtn) DOM.uploadBtn.style.display = 'block';
  }else{
    if (DOM.fileInfo){ DOM.fileInfo.style.display='none'; DOM.fileInfo.innerHTML=''; }
    if (DOM.uploadBtn) DOM.uploadBtn.style.display = 'none';
  }
}

/* ====================== EKSPOR FUNGSI KE WINDOW ====================== */
window.generateAndSendLetter = generateAndSendLetter;
window.deleteLetterAndData  = deleteLetterAndData;
window.deleteSingleFile     = deleteSingleFile;
window.uploadFiles          = uploadFiles;
window.handleDragOver       = handleDragOver;
window.handleDragLeave      = handleDragLeave;
window.handleDrop           = handleDrop;
window.handleFileSelect     = handleFileSelect;
window.toggleEditMode       = toggleEditMode;
window.cancelEdit           = cancelEdit;
window.saveChanges          = saveChanges;
window.closePopup           = closePopup;

