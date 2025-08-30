
/* =========================
   1) KONFIGURASI & ENDPOINT
   ========================= */
const WEBHOOK_CREATE  = 'https://n8n-qz8tp6856ibc.bgxy.sumopod.my.id/webhook/737cd7f5-bfa1-4b9c-b55a-21aa718bfc3d';
const WEBHOOK_UPDATE  = 'https://n8n-qz8tp6856ibc.bgxy.sumopod.my.id/webhook/e1863045-3bfd-497d-b8a3-fc2c7c23eaa7';
const WEBHOOK_UPLOAD  = 'https://n8n-qz8tp6856ibc.bgxy.sumopod.my.id/webhook/1ae8a1a1-9f9d-4792-8505-9c84e1d3654b';
const WEBHOOK_DELETE  = 'https://n8n-qz8tp6856ibc.bgxy.sumopod.my.id/webhook/d240d7b5-7395-4a13-9b1c-ebd4d6fe4589';
const UPDATE_STRATEGY = 'OVERWRITE_BIN';
const POLL_MS = 1000; // realtime di luar edit: 1 detik

/* =========================
   2) ID_USER & SUMBER DATA
   ========================= */
const ID_USER_RAW = "{{ $json.id }}"; // pakai ?id=... bila tidak dirender n8n
function resolveIdUser(){
  if (/\{\{\s*\$json\.id\s*\}\}/.test(ID_USER_RAW)) {
    const u = new URL(location.href);
    const q = u.searchParams.get('id');
    if (q) return q.trim();
    const segs = u.pathname.split('/').filter(Boolean);
    if (segs.length) return segs[segs.length-1];
    return "";
  }
  return (ID_USER_RAW || "").trim();
}
const ID_USER = resolveIdUser();
const JSON_URL = ID_USER ? ("https://distrikwania.com/data/" + encodeURIComponent(ID_USER)) : "";

/* =========================
   3) UTIL & ELEMEN
   ========================= */
const $ = (id) => document.getElementById(id);
function toStr(x, fb='-'){ const v=(x??'').toString().trim(); return v.length?v:fb; }
function isJSONResponse(res){ return (res.headers.get('content-type')||'').toLowerCase().includes('application/json'); }
async function hashText(txt){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function pickObj(root){
  if (!root) return {};
  if (Array.isArray(root?.data) && root.data[0]) return root.data[0];
  if (Array.isArray(root) && root[0]) return root[0];
  return root;
}
function normalizeDocs(docs){
  const arr = Array.isArray(docs)? docs.filter(Boolean):[];
  const seen=new Set(); const out=[];
  for (const d of arr){
    const fid = d?.file_id || d?.id || d?.fileId || null;
    const hasUrl = !!(d?.view_url || d?.download_url);
    if (!fid && !hasUrl) continue;
    const key = fid ? `fid:${fid}` : `name:${(d?.name||'').toLowerCase()}|size:${d?.size||0}`;
    if (seen.has(key)) continue; seen.add(key);
    out.push({
      label: d?.label ?? d?.name ?? '-',
      name:  d?.name  ?? d?.label ?? '-',
      file_id: fid,
      view_url: d?.view_url ?? null,
      download_url: d?.download_url ?? null
    });
  }
  return out;
}

/* =========================
   4) STATE GLOBAL
   ========================= */
let lastJSON=null, lastObj={}, lastHash=null;
let editMode=false, pollHandle=null;
let pendingFiles=[];

/* =========================
   5) PETA ELEMEN
   ========================= */
const VIEW = {
  logo: $('LogoURL'),
  jenis_surat: $('jenis_surat'),
  nomor_surat: $('nomor_surat'),
  operator: $('operator'),
  tanggal_surat: $('tanggal_surat'),
  ref: $('ref'),
  from: $('WAHA_Trigger_payload_from'),
  tahun: $('tahun'),
  // pemohon
  nama: $('nama'), nik: $('nik'), ttl: $('ttl'), agama: $('agama'),
  jenis_kelamin: $('jenis_kelamin'), status_perkawinan: $('status_perkawinan'),
  pekerjaan: $('pekerjaan'), alamat: $('alamat'),
  kelurahan: $('kelurahan'), kecamatan: $('kecamatan'),
  kota_kab: $('kota_kab'), provinsi: $('provinsi'),
  ket_kel: $('keterangan_kelurahan'),
  // files
  filesList: $('uploadedFilesList')
};
const EDIT = {
  nama: $('editNama'), nik: $('editNIK'), ttl: $('editTTL'), agama: $('editAgama'),
  jk: $('editJenisKelamin'), status: $('editStatusPerkawinan'), pekerjaan: $('editPekerjaan'),
  alamat: $('editAlamat'), kelurahan: $('editKelurahan'), kecamatan: $('editKecamatan'),
  kota_kab: $('editKotaKab'), provinsi: $('editProvinsi'),
};
const elFileInput=$('fileInput'), elFileInfo=$('fileInfo'), elUploadBtn=$('uploadBtn');
const elProg=$('uploadProgress'), elProgBar=$('uploadProgressBar');
const popupOverlay=$('popupOverlay');

/* =========================
   6) RENDERING
   ========================= */
function renderStatic(){ if (VIEW.tahun) VIEW.tahun.textContent = String(new Date().getFullYear()); }
function renderFiles(obj){
  const wrap = VIEW.filesList; if (!wrap) return;
  const docs = normalizeDocs(obj?.dokumen);
  wrap.innerHTML = '';
  if (!docs.length){
    const div = document.createElement('div');
    div.className='no-files-message'; div.textContent='Belum ada file yang diupload';
    wrap.appendChild(div); return;
  }
  docs.forEach(d=>{
    const row=document.createElement('div');
    row.className='uploaded-file-item';
    row.style.display='flex'; row.style.justifyContent='space-between'; row.style.alignItems='center';

    const left=document.createElement('div');
    const name = toStr(d.name);
    const fid  = d.file_id ? `<code style="font-size:12px;opacity:.85">${d.file_id}</code>` : '<i style="font-size:12px;opacity:.6">ID tidak tersedia</i>';
    left.innerHTML = `<div class="file-name">${name}</div><div>${fid}</div>`;

    const right=document.createElement('div');
    right.style.display='flex'; right.style.gap='8px';
    if (d.view_url){ const a=document.createElement('a'); a.href=d.view_url; a.target='_blank'; a.rel='noopener'; a.textContent='Lihat'; a.className='btn ghost'; right.appendChild(a); }
    if (d.download_url){ const a=document.createElement('a'); a.href=d.download_url; a.target='_blank'; a.rel='noopener'; a.textContent='Unduh'; a.className='btn ghost'; right.appendChild(a); }
    if (d.file_id){ const del=document.createElement('button'); del.className='btn danger'; del.textContent='Hapus'; del.onclick=()=>deleteDocumentsByFileIds([d.file_id]); right.appendChild(del); }

    row.appendChild(left); row.appendChild(right); wrap.appendChild(row);
  });
}
function renderView(obj){
  if (VIEW.jenis_surat) VIEW.jenis_surat.textContent = toStr(obj.jenis_surat,'Surat Keterangan Tidak Mampu (SKTM)');
  if (VIEW.nomor_surat) VIEW.nomor_surat.textContent = toStr(obj.nomor_surat,'—');
  if (VIEW.operator) VIEW.operator.textContent = toStr(obj.operator,'—');
  if (VIEW.tanggal_surat) VIEW.tanggal_surat.textContent = toStr(obj.tanggal_surat, new Date().toLocaleDateString('id-ID'));
  if (VIEW.ref) VIEW.ref.textContent = toStr(obj.ref, ID_USER || '—');
  if (VIEW.from) VIEW.from.textContent = toStr(obj.WAHA_Trigger_payload_from,'—');
  if (VIEW.logo){ const logo=obj.LogoURL||obj.logo_url||''; if (logo) VIEW.logo.src=logo; }

  const p=obj.pemohon||{};
  if (VIEW.nama) VIEW.nama.textContent = toStr(p.nama);
  if (VIEW.nik) VIEW.nik.textContent = toStr(p.nik);
  if (VIEW.ttl) VIEW.ttl.textContent = toStr(p.ttl);
  if (VIEW.agama) VIEW.agama.textContent = toStr(p.agama);
  if (VIEW.jenis_kelamin) VIEW.jenis_kelamin.textContent = toStr(p.jenis_kelamin);
  if (VIEW.status_perkawinan) VIEW.status_perkawinan.textContent = toStr(p.status_perkawinan);
  if (VIEW.pekerjaan) VIEW.pekerjaan.textContent = toStr(p.pekerjaan);
  if (VIEW.alamat) VIEW.alamat.textContent = toStr(p.alamat);
  if (VIEW.kelurahan) VIEW.kelurahan.textContent = toStr(p.kelurahan);
  if (VIEW.kecamatan) VIEW.kecamatan.textContent = toStr(p.kecamatan);
  if (VIEW.kota_kab) VIEW.kota_kab.textContent = toStr(p.kota_kab);
  if (VIEW.provinsi) VIEW.provinsi.textContent = toStr(p.provinsi);
  if (VIEW.ket_kel) VIEW.ket_kel.textContent = toStr(p.kelurahan);

  // seed field edit
  if (EDIT.nama) EDIT.nama.value = p.nama ?? '';
  if (EDIT.nik) EDIT.nik.value = p.nik ?? '';
  if (EDIT.ttl) EDIT.ttl.value = p.ttl ?? '';
  if (EDIT.agama) EDIT.agama.value = p.agama ?? '';
  if (EDIT.jk) EDIT.jk.value = p.jenis_kelamin ?? 'LAKI-LAKI';
  if (EDIT.status) EDIT.status.value = p.status_perkawinan ?? 'BELUM KAWIN';
  if (EDIT.pekerjaan) EDIT.pekerjaan.value = p.pekerjaan ?? '';
  if (EDIT.alamat) EDIT.alamat.value = p.alamat ?? '';
  if (EDIT.kelurahan) EDIT.kelurahan.value = p.kelurahan ?? '';
  if (EDIT.kecamatan) EDIT.kecamatan.value = p.kecamatan ?? '';
  if (EDIT.kota_kab) EDIT.kota_kab.value = p.kota_kab ?? '';
  if (EDIT.provinsi) EDIT.provinsi.value = p.provinsi ?? '';

  renderFiles(obj);
}

/* =========================
   7) POLLING REALTIME (1s)
   ========================= */
function startPolling(){ stopPolling(); pollHandle=setInterval(()=>{ if(!editMode) loadOnce(); }, POLL_MS); }
function stopPolling(){ if(pollHandle){ clearInterval(pollHandle); pollHandle=null; } }

/* =========================
   8) MODE EDIT & SIMPAN (UPDATE)
   ========================= */
function toggleEditMode(){
  editMode = !editMode;
  document.body.classList.toggle('edit-mode', editMode);
  const btn = $('editBtn'); if (btn) btn.textContent = editMode ? '🔒 Selesai Edit' : '✏️ Edit Data';
  if (editMode) stopPolling(); else { loadOnce(); startPolling(); }
}
function cancelEdit(){ renderView(lastObj||{}); if (editMode) toggleEditMode(); }

/* “Simpan Perubahan” => UPDATE */
async function saveChanges(){
  try{
    if (!lastObj || typeof lastObj!=='object') lastObj = {};
    if (!lastObj.pemohon) lastObj.pemohon = {};
    const p = lastObj.pemohon;
    p.nama = EDIT.nama?.value ?? p.nama;
    p.nik = EDIT.nik?.value ?? p.nik;
    p.ttl = EDIT.ttl?.value ?? p.ttl;
    p.agama = EDIT.agama?.value ?? p.agama;
    p.jenis_kelamin = EDIT.jk?.value ?? p.jenis_kelamin;
    p.status_perkawinan = EDIT.status?.value ?? p.status_perkawinan;
    p.pekerjaan = EDIT.pekerjaan?.value ?? p.pekerjaan;
    p.alamat = EDIT.alamat?.value ?? p.alamat;
    p.kelurahan = EDIT.kelurahan?.value ?? p.kelurahan;
    p.kecamatan = EDIT.kecamatan?.value ?? p.kecamatan;
    p.kota_kab = EDIT.kota_kab?.value ?? p.kota_kab;
    p.provinsi = EDIT.provinsi?.value ?? p.provinsi;

    const edited = JSON.parse(JSON.stringify(lastObj||{}));
    if (UPDATE_STRATEGY==='OVERWRITE_BIN') edited.dokumen = normalizeDocs(lastObj?.dokumen);
    const payload = { action:'UPDATE_ONLY', strategy:UPDATE_STRATEGY, id_user:ID_USER, data:edited };
    const resp = await fetch(WEBHOOK_UPDATE, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
    });
    if (!resp.ok){ const t=await resp.text(); throw new Error('HTTP '+resp.status+' — '+t.slice(0,200)); }

    renderView(lastObj);
    if (editMode) toggleEditMode();
    alert('Perubahan disimpan ✓');
  }catch(e){
    alert('Gagal menyimpan perubahan: ' + e.message);
  }
}

/* =========================
   9) MUAT DATA (dipanggil polling)
   ========================= */
async function loadOnce(){
  try{
    if (!JSON_URL) return console.warn('ID_USER kosong.');
    const res = await fetch(JSON_URL + '?t=' + Date.now(), { cache:'no-store' });
    const text = await res.text();
    if (!res.ok) throw new Error('HTTP '+res.status+' — '+text.slice(0,200));
    let data; try{ data = JSON.parse(text); } catch(err){ if (!isJSONResponse(res)) throw new Error('Respon bukan JSON'); throw err; }
    const h = await hashText(JSON.stringify(data));
    if (h !== lastHash){
      lastHash = h; lastJSON = data; lastObj = pickObj(data) || {};
      renderView(lastObj);
    }
  }catch(e){ console.error('Load error:', e.message); }
}
function startRealtime(){ renderStatic(); loadOnce(); startPolling(); }

/* =========================
   10) AKSI: CREATE / DELETE / UPLOAD
   ========================= */
function buildPayload(base){ return { ...(base||{}), id_user: ID_USER }; }

/* === Tombol “Buat Surat & Kirim Data” (CREATE) === */
async function generateAndSendLetter(){
  try{
    if (editMode) await saveChanges(); // pastikan state terkini terkirim
    const resp = await fetch(WEBHOOK_CREATE, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(buildPayload(lastObj))
    });
    if (!resp.ok){ const t=await resp.text(); throw new Error('HTTP '+resp.status+' — '+t.slice(0,200)); }
    openPopup(); // tampilkan popup sukses
  }catch(e){ alert('Gagal membuat & mengirim surat: '+e.message); }
}

/* — Hapus seluruh data/surat — */
async function deleteLetterAndData(){
  if (!confirm('Yakin hapus SURAT dan DATA ini?')) return;
  try{
    const resp = await fetch(WEBHOOK_DELETE, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'DELETE_ALL', id_user: ID_USER, data: buildPayload(lastObj) })
    });
    const text = await resp.text();
    if (!resp.ok){ throw new Error('HTTP '+resp.status+' — '+text.slice(0,200)); }
    alert('Data & surat dihapus ✓'); await loadOnce();
  }catch(e){ alert('Gagal menghapus: '+e.message); }
}

/* — Upload berkas — */
function handleFileSelect(ev){ pendingFiles = Array.from(ev.target.files||[]); refreshPendingFilesUI(); }
function handleDragOver(ev){ ev.preventDefault(); ev.stopPropagation(); ev.currentTarget.style.borderColor='rgba(56,189,248,.6)'; ev.currentTarget.style.background='rgba(56,189,248,.06)'; }
function handleDragLeave(ev){ ev.preventDefault(); ev.stopPropagation(); ev.currentTarget.style.borderColor=''; ev.currentTarget.style.background=''; }
function handleDrop(ev){ ev.preventDefault(); ev.stopPropagation(); ev.currentTarget.style.borderColor=''; ev.currentTarget.style.background=''; pendingFiles = Array.from(ev.dataTransfer.files||[]); refreshPendingFilesUI(); }
function refreshPendingFilesUI(){
  if (!elFileInfo || !elUploadBtn) return;
  if (!pendingFiles.length){ elFileInfo.style.display='none'; elUploadBtn.style.display='none'; return; }
  elFileInfo.style.display=''; elUploadBtn.style.display='';
  elFileInfo.innerHTML = '<div style="font-weight:600;margin-bottom:6px">File akan diupload:</div>' +
    pendingFiles.map(f=>`<div style="font-size:12px">${f.name}</div>`).join('');
}
async function uploadFiles(){
  try{
    if (!pendingFiles.length) return alert('Pilih minimal satu file.');
    if (!lastObj && !lastJSON) return alert('Belum ada data utama.');

    if (editMode) await saveChanges();
    const form = new FormData();
    form.append('data', JSON.stringify(buildPayload(lastObj)));
    form.append('id_user', ID_USER);
    pendingFiles.forEach(f=> form.append('files[]', f, f.name));

    if (elProg) elProg.style.display=''; if (elProgBar) elProgBar.style.width='8%';
    const resp = await fetch(WEBHOOK_UPLOAD, { method:'POST', body: form });
    const text = await resp.text();
    if (!resp.ok) throw new Error('HTTP '+resp.status+' — '+text.slice(0,200));

    if (elProgBar) elProgBar.style.width='100%';
    alert('Upload sukses ✓');
    pendingFiles=[]; if (elFileInput) elFileInput.value=''; refreshPendingFilesUI();
    await loadOnce();
  }catch(e){
    alert('Upload gagal: '+e.message);
  }finally{
    setTimeout(()=>{ if (elProg) elProg.style.display='none'; }, 600);
    if (elProgBar) elProgBar.style.width='0%';
  }
}

/* =========================
   11) HAPUS DOKUMEN
   ========================= */
async function deleteDocumentsByFileIds(fileIds=[]){
  if (!fileIds.length) return;
  if (!confirm('Hapus dokumen berikut?\n'+fileIds.join('\n'))) return;
  try{
    const payload = { action:'DELETE_DOCS', id_user:ID_USER, delete_file_ids:fileIds, data: buildPayload(lastObj) };
    const resp = await fetch(WEBHOOK_UPDATE, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
    });
    if (!resp.ok){ const t=await resp.text(); throw new Error('HTTP '+resp.status+' — '+t.slice(0,200)); }
    await loadOnce(); alert('Dokumen dihapus ✓');
  }catch(e){ alert('Gagal menghapus dokumen: '+e.message); }
}

/* =========================
   12) POPUP
   ========================= */
function openPopup(){ if (popupOverlay) popupOverlay.style.display='flex'; }
function closePopup(){ if (popupOverlay) popupOverlay.style.display='none'; }
window.closePopup = closePopup;

/* =========================
   13) EKSPOR GLOBAL
   ========================= */
window.toggleEditMode = toggleEditMode;
window.saveChanges = saveChanges;                // tombol "Simpan Perubahan" → UPDATE
window.cancelEdit = cancelEdit;
window.uploadFiles = uploadFiles;
window.generateAndSendLetter = generateAndSendLetter; // tombol "Buat Surat & Kirim Data" → CREATE
window.deleteLetterAndData = deleteLetterAndData;
window.handleFileSelect = handleFileSelect;
window.handleDragOver = handleDragOver;
window.handleDragLeave = handleDragLeave;
window.handleDrop = handleDrop;

/* =========================
   14) START
   ========================= */
document.addEventListener('DOMContentLoaded', startRealtime);
