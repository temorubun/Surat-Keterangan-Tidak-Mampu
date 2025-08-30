
/* ---------- CONFIG ---------- */
const ID_USER_RAW = "1yKVeFVfqy8XRHvixY60DsxTy1ozC4GUa";
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

/* ---------- DOM ---------- */
const E = (id) => document.getElementById(id);
const F = {
  // tampilan header
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

  keterangan_kelurahan: E('keterangan_kelurahan'),
  tahun: E('tahun'),
  uploadedList: E('uploadedFilesList'),
};
if (F.tahun) F.tahun.textContent = new Date().getFullYear();

/* ---------- Utils ---------- */
function val(x, fb='-'){ return (x ?? '').toString().trim() || fb; }
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

/* ---------- Renderers ---------- */
function fillView(obj){
  // header
  if (F.jenis_surat)   F.jenis_surat.textContent   = val(obj.jenis_surat);
  if (F.nomor_surat)   F.nomor_surat.textContent   = val(obj.nomor_surat);
  if (F.tanggal_surat) F.tanggal_surat.textContent = val(obj.tanggal_surat);
  if (F.operator)      F.operator.textContent      = val(obj.operator);
  if (F.logo && obj.LogoURL) F.logo.src = obj.LogoURL;

  // identitas view
  const p = obj.pemohon || {};
  if (F.d.nama)       F.d.nama.textContent       = val(p.nama);
  if (F.d.nik)        F.d.nik.textContent        = val(p.nik);
  if (F.d.ttl)        F.d.ttl.textContent        = val(p.ttl);
  if (F.d.agama)      F.d.agama.textContent      = val(p.agama);
  if (F.d.jk)         F.d.jk.textContent         = val(p.jenis_kelamin);
  if (F.d.status)     F.d.status.textContent     = val(p.status_perkawinan);
  if (F.d.pekerjaan)  F.d.pekerjaan.textContent  = val(p.pekerjaan);
  if (F.d.alamat)     F.d.alamat.textContent     = val(p.alamat);
  if (F.d.kelurahan)  F.d.kelurahan.textContent  = val(p.kelurahan);
  if (F.d.kecamatan)  F.d.kecamatan.textContent  = val(p.kecamatan);
  if (F.d.kota_kab)   F.d.kota_kab.textContent   = val(p.kota_kab);
  if (F.d.provinsi)   F.d.provinsi.textContent   = val(p.provinsi);
  if (F.keterangan_kelurahan) F.keterangan_kelurahan.textContent = val(p.kelurahan);

  // isi default ke input edit
  if (F.e.nama)       F.e.nama.value       = val(p.nama,'');
  if (F.e.nik)        F.e.nik.value        = val(p.nik,'');
  if (F.e.ttl)        F.e.ttl.value        = val(p.ttl,'');
  if (F.e.agama)      F.e.agama.value      = val(p.agama,'');
  if (F.e.jk)         F.e.jk.value         = val(p.jenis_kelamin,'LAKI-LAKI');
  if (F.e.status)     F.e.status.value     = val(p.status_perkawinan,'BELUM KAWIN');
  if (F.e.pekerjaan)  F.e.pekerjaan.value  = val(p.pekerjaan,'');
  if (F.e.alamat)     F.e.alamat.value     = val(p.alamat,'');
  if (F.e.kelurahan)  F.e.kelurahan.value  = val(p.kelurahan,'');
  if (F.e.kecamatan)  F.e.kecamatan.value  = val(p.kecamatan,'');
  if (F.e.kota_kab)   F.e.kota_kab.value   = val(p.kota_kab,'');
  if (F.e.provinsi)   F.e.provinsi.value   = val(p.provinsi,'');
}

function renderUploadedFiles(obj){
  const box = F.uploadedList;
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
    row.innerHTML = `
      <div class="file-icon">📎</div>
      <div class="file-details">
        <div class="file-name">${d.name || d.label || '-'}</div>
        <div class="file-meta">${d.mimeType || '-'} • ${d.size ? d.size.toLocaleString('id-ID')+' bytes' : '-'}</div>
      </div>
      <div style="display:flex; gap:8px;">
        ${d.view_url ? `<a class="btn ghost" href="${d.view_url}" target="_blank" rel="noopener">Lihat</a>` : ''}
        ${d.download_url ? `<a class="btn ghost" href="${d.download_url}" target="_blank" rel="noopener">Unduh</a>` : ''}
      </div>`;
    box.appendChild(row);
  }
}

/* ---------- Loader ---------- */
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

/* ---------- Edit Mode ---------- */
function toggleEditMode(){
  const card = document.querySelector('.card');
  card.classList.toggle('edit-mode');
  if (card.classList.contains('edit-mode')){
    clearInterval(loadInterval);
  } else {
    load();
    loadInterval = setInterval(load, 1200);
  }
}
function cancelEdit(){
  document.querySelector('.card').classList.remove('edit-mode');
  load(); // kembalikan tampilan
  clearInterval(loadInterval);
  loadInterval = setInterval(load, 1200);
}
function saveChanges(){
  if (!lastObj) lastObj = {};
  const p = lastObj.pemohon || (lastObj.pemohon = {});
  p.nama = F.e.nama?.value?.trim() || '';
  p.nik  = F.e.nik?.value?.trim() || '';
  p.ttl  = F.e.ttl?.value?.trim() || '';
  p.agama = F.e.agama?.value?.trim() || '';
  p.jenis_kelamin = F.e.jk?.value || '';
  p.status_perkawinan = F.e.status?.value || '';
  p.pekerjaan = F.e.pekerjaan?.value?.trim() || '';
  p.alamat = F.e.alamat?.value?.trim() || '';
  p.kelurahan = F.e.kelurahan?.value?.trim() || '';
  p.kecamatan = F.e.kecamatan?.value?.trim() || '';
  p.kota_kab = F.e.kota_kab?.value?.trim() || '';
  p.provinsi = F.e.provinsi?.value?.trim() || '';
  fillView(lastObj);
  toggleEditMode();
}

