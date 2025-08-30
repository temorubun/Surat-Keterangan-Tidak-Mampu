// ================== KONFIG (fallback ID_USER) ==================
const ID_USER_RAW = "{{ $json.id }}"; // literal jika tidak dirender n8n
function resolveIdUser(){
  if (/\{\{\s*\$json\.id\s*\}\}/.test(ID_USER_RAW)){
    const u = new URL(location.href);
    const q = u.searchParams.get('id');
    if (q) return q.trim();
    const segs = u.pathname.split('/').filter(Boolean);
    if (segs.length) return segs[segs.length-1];
    return "";
  }
  return ID_USER_RAW.trim();
}
let ID_USER = resolveIdUser();
let JSON_URL = ID_USER ? ("https://distrikwania.com/data/"+encodeURIComponent(ID_USER)) : "";
document.getElementById('src').textContent = JSON_URL || "(ID_USER belum di-set)";

// ====== STRATEGI UPDATE ======
const UPDATE_STRATEGY = 'OVERWRITE_BIN';

// ================== Elemen ==================
const E=(id)=>document.getElementById(id);
const out=E('output'), stat=E('status'), sstat=E('sendStatus'), ustat2=E('updateStatus'), ust=E('uploadStatus');
const btn=E('sendBtn'), updateBtn=E('updateBtn'), upBtn=E('uploadBtn'), fileInput=E('fileInput');
const uploadedFilesTbody=E('uploadedFilesTbody'), delDocStatus=E('delDocStatus');



/* ====== Helper Query ====== */
const F = {
  // bidang tampilan (DIV/SPAN)
  jenis_surat: E('jenis_surat'),
  nomor_surat: E('nomor_surat'),
  tanggal_surat: E('tanggal_surat'),
  operator:     E('operator'),

  // tampilan identitas (DIV/SPAN)
  d: {
    nama: E('nama'),
    nik: E('nik'),
    ttl: E('ttl'),
    agama: E('agama'),
    jk: E('jenis_kelamin'),
    status: E('status_perkawinan'),
    pekerjaan: E('pekerjaan'),
    alamat: E('alamat'),
    kelurahan: E('kelurahan'),
    kecamatan: E('kecamatan'),
    kota_kab: E('kota_kab'),
    provinsi: E('provinsi'),
  },

  // input edit mode (sudah ada di HTML)
  e: {
    nama: E('editNama'),
    nik: E('editNIK'),
    ttl: E('editTTL'),
    agama: E('editAgama'),
    jk: E('editJenisKelamin'),
    status: E('editStatusPerkawinan'),
    pekerjaan: E('editPekerjaan'),
    alamat: E('editAlamat'),
    kelurahan: E('editKelurahan'),
    kecamatan: E('editKecamatan'),
    kota_kab: E('editKotaKab'),
    provinsi: E('editProvinsi'),
  },

  // elemen lain yang memang ada
  keterangan_kelurahan: E('keterangan_kelurahan'),
  tahun: E('tahun'),
  uploadedList: E('uploadedFilesList'),
  logo: E('LogoURL'),
};

F.tahun.textContent = new Date().getFullYear();

/* ====== Util ====== */
function val(x, fb='-'){ return (x ?? '').toString().trim() || fb; }
function normalizeDokumen(docs){
  const arr = Array.isArray(docs) ? docs : [];
  const out = [];
  const seen = new Set();
  for (const d of arr){
    const fid = d?.file_id || d?.id || null;
    const key = fid ? 'fid:'+fid : 'name:'+(d?.name||'').toLowerCase()+'|size:'+(d?.size||0);
    if (seen.has(key)) continue;
    seen.add(key);
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

/* ====== Renderers ====== */
function fillView(obj){
  // header
  F.jenis_surat.textContent   = val(obj.jenis_surat);
  F.nomor_surat.textContent   = val(obj.nomor_surat);
  F.tanggal_surat.textContent = val(obj.tanggal_surat);
  F.operator.textContent      = val(obj.operator);

  // identitas (tampilan)
  const p = obj.pemohon || {};
  F.d.nama.textContent       = val(p.nama);
  F.d.nik.textContent        = val(p.nik);
  F.d.ttl.textContent        = val(p.ttl);
  F.d.agama.textContent      = val(p.agama);
  F.d.jk.textContent         = val(p.jenis_kelamin);
  F.d.status.textContent     = val(p.status_perkawinan);
  F.d.pekerjaan.textContent  = val(p.pekerjaan);
  F.d.alamat.textContent     = val(p.alamat);
  F.d.kelurahan.textContent  = val(p.kelurahan);
  F.d.kecamatan.textContent  = val(p.kecamatan);
  F.d.kota_kab.textContent   = val(p.kota_kab);
  F.d.provinsi.textContent   = val(p.provinsi);

  // isian edit (supaya saat toggle edit sudah terisi)
  F.e.nama.value       = val(p.nama, '');
  F.e.nik.value        = val(p.nik, '');
  F.e.ttl.value        = val(p.ttl, '');
  F.e.agama.value      = val(p.agama, '');
  F.e.jk.value         = val(p.jenis_kelamin, 'LAKI-LAKI');
  F.e.status.value     = val(p.status_perkawinan, 'BELUM KAWIN');
  F.e.pekerjaan.value  = val(p.pekerjaan, '');
  F.e.alamat.value     = val(p.alamat, '');
  F.e.kelurahan.value  = val(p.kelurahan, '');
  F.e.kecamatan.value  = val(p.kecamatan, '');
  F.e.kota_kab.value   = val(p.kota_kab, '');
  F.e.provinsi.value   = val(p.provinsi, '');

  // keterangan dinamis
  if (F.keterangan_kelurahan) F.keterangan_kelurahan.textContent = val(p.kelurahan);

  // logo opsional (kalau ada)
  if (F.logo && obj.LogoURL) F.logo.src = obj.LogoURL;
}

function renderUploadedFiles(obj){
  const box = F.uploadedList;
  box.innerHTML = '';
  const docs = normalizeDokumen(obj?.dokumen);
  if (!docs.length){
    box.innerHTML = '<div class="no-files-message">Belum ada file yang diupload</div>';
    return;
  }
  for (const d of docs){
    const div = document.createElement('div');
    div.className = 'uploaded-file-item';
    div.innerHTML = `
      <div class="file-icon">📎</div>
      <div class="file-details">
        <div class="file-name">${d.name || d.label || '-'}</div>
        <div class="file-meta">${d.mimeType || '-'} • ${d.size ? d.size.toLocaleString('id-ID')+' bytes' : '-'}</div>
      </div>
      <div style="display:flex; gap:8px;">
        ${d.view_url ? `<a class="btn ghost" href="${d.view_url}" target="_blank" rel="noopener">Lihat</a>` : ''}
        ${d.download_url ? `<a class="btn ghost" href="${d.download_url}" target="_blank" rel="noopener">Unduh</a>` : ''}
      </div>`;
    box.appendChild(div);
  }
}

/* ====== Loader JSON ====== */
let lastObj = null;
async function load(){
  if (!JSON_URL) return;
  const res = await fetch(JSON_URL+'?t='+Date.now(), { cache: 'no-store' });
  const txt = await res.text();

  // aman terhadap konten yang bukan JSON murni
  let data;
  try { data = JSON.parse(txt); }
  catch { console.warn('Respon bukan JSON valid'); return; }

  const root = Array.isArray(data) ? data[0] : data;
  lastObj = root || {};
  fillView(lastObj);
  renderUploadedFiles(lastObj);
}
load();
setInterval(load, 500);

/* ====== (Opsional) fungsi edit-mode agar tombol Edit tidak error ====== */
function toggleEditMode(){ document.querySelector('.card').classList.toggle('edit-mode'); }
function cancelEdit(){ document.querySelector('.card').classList.remove('edit-mode'); }
function saveChanges(){
  const p = lastObj.pemohon || (lastObj.pemohon = {});
  p.nama = F.e.nama.value.trim();
  p.nik = F.e.nik.value.trim();
  p.ttl = F.e.ttl.value.trim();
  p.agama = F.e.agama.value.trim();
  p.jenis_kelamin = F.e.jk.value;
  p.status_perkawinan = F.e.status.value;
  p.pekerjaan = F.e.pekerjaan.value.trim();
  p.alamat = F.e.alamat.value.trim();
  p.kelurahan = F.e.kelurahan.value.trim();
  p.kecamatan = F.e.kecamatan.value.trim();
  p.kota_kab = F.e.kota_kab.value.trim();
  p.provinsi = F.e.provinsi.value.trim();
  // sinkron ke tampilan
  fillView(lastObj);
  toggleEditMode();
}
const F = { jenis_surat:E('jenis_surat'), nomor_surat:E('nomor_surat'), tanggal_surat:E('tanggal_surat'), operator:E('operator'),
  p:{ nama:E('p_nama'), nik:E('p_nik'), ttl:E('p_ttl'), agama:E('p_agama'), jk:E('p_jk'), status:E('p_status'), pekerjaan:E('p_pekerjaan'), alamat:E('p_alamat'), kelurahan:E('p_kelurahan'), kecamatan:E('p_kecamatan'), kota:E('p_kota'), prov:E('p_prov'), domisili:E('p_domisili') } };

let lastJSON=null, lastObj=null, lastHash=null;

// ================== Utils ==================
async function hashText(txt){ const buf=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)); return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
function val(x,fb=''){return x??fb;}
function stripTransient(obj){ if(!obj||typeof obj!=='object') return obj; const copy=JSON.parse(JSON.stringify(obj));
  const keys=['files','files_info','last_upload_info','temp_files','pending_docs','upload_session_id'];
  for(const k of keys){ if(k in copy) delete copy[k]; }
  if(Array.isArray(copy)&&copy[0]&&typeof copy[0]==='object'){
    for(const k of keys){ if(k in copy[0]) delete copy[0][k]; }
  }
  return copy;
}
function normalizeDokumen(docs){
  const arr=Array.isArray(docs)?docs.filter(Boolean):[];
  const seen=new Set(); const out=[];
  for(const d of arr){
    const fid=d?.file_id||d?.id||d?.fileId||null;
    const hasUrl=!!(d?.view_url||d?.download_url);
    if(!fid && !hasUrl) continue;
    const key=fid?`fid:${fid}`:`name:${(d?.name||'').toLowerCase()}|size:${d?.size||0}`;
    if(seen.has(key)) continue; seen.add(key);
    out.push({
      label:d?.label??d?.name??'-',
      name:d?.name??d?.label??'-',
      mimeType:d?.mimeType??null,
      size:typeof d?.size==='number'?d.size:(Number.isFinite(+d?.size)?+d.size:null),
      file_id:fid, view_url:d?.view_url??null, download_url:d?.download_url??null
    });
  }
  return out;
}

// ================== Form Builders ==================
function fillForm(obj){
  // Isi input form
  if(F.jenis_surat) F.jenis_surat.value=val(obj.jenis_surat);
  if(F.nomor_surat) F.nomor_surat.value=val(obj.nomor_surat);
  if(F.tanggal_surat) F.tanggal_surat.value=val(obj.tanggal_surat);
  if(F.operator) F.operator.value=val(obj.operator);
  const p=obj.pemohon||{};
  if(F.p.nama) F.p.nama.value=val(p.nama);
  if(F.p.nik) F.p.nik.value=val(p.nik);
  if(F.p.ttl) F.p.ttl.value=val(p.ttl);
  if(F.p.agama) F.p.agama.value=val(p.agama);
  if(F.p.jk) F.p.jk.value=val(p.jenis_kelamin);
  if(F.p.status) F.p.status.value=val(p.status_perkawinan);
  if(F.p.pekerjaan) F.p.pekerjaan.value=val(p.pekerjaan);
  if(F.p.alamat) F.p.alamat.value=val(p.alamat);
  if(F.p.kelurahan) F.p.kelurahan.value=val(p.kelurahan);
  if(F.p.kecamatan) F.p.kecamatan.value=val(p.kecamatan);
  if(F.p.kota) F.p.kota.value=val(p.kota_kab);
  if(F.p.prov) F.p.prov.value=val(p.provinsi);
  if(F.p.domisili) F.p.domisili.value=val(p.domisili);

  // Isi elemen non-input
  const setText = (id, value) => { const el = document.getElementById(id); if(el) el.textContent = value || ""; };
  setText('LogoURL', obj.LogoURL);
  setText('jenis_surat', obj.jenis_surat);
  setText('nomor_surat', obj.nomor_surat);
  setText('operator', obj.operator);
  setText('tanggal_surat', obj.tanggal_surat);
  setText('ref', obj.ref);
  setText('WAHA_Trigger_payload_from', obj.WAHA_Trigger_payload_from);
  setText('nama', p.nama);
  setText('nik', p.nik);
  setText('ttl', p.ttl);
  setText('agama', p.agama);
  setText('jenis_kelamin', p.jenis_kelamin);
  setText('status_perkawinan', p.status_perkawinan);
  setText('pekerjaan', p.pekerjaan);
  setText('alamat', p.alamat);
  setText('kelurahan', p.kelurahan);
  setText('kecamatan', p.kecamatan);
  setText('kota_kab', p.kota_kab);
  setText('provinsi', p.provinsi);
  setText('keterangan_kelurahan', p.kelurahan);
  // Tahun copyright
  setText('tahun', new Date().getFullYear());
  // Jika ada logo, update src
  const logoEl = document.getElementById('LogoURL');
  if(logoEl && obj.LogoURL) logoEl.src = obj.LogoURL;
}
function buildPayload(base){
  const obj=JSON.parse(JSON.stringify(base||{}));
  obj.jenis_surat=F.jenis_surat.value.trim();
  obj.nomor_surat=F.nomor_surat.value.trim();
  obj.tanggal_surat=F.tanggal_surat.value.trim();
  obj.operator=F.operator.value.trim();
  obj.pemohon=obj.pemohon||{};
  obj.pemohon.nama=F.p.nama.value.trim();
  obj.pemohon.nik=F.p.nik.value.trim();
  obj.pemohon.ttl=F.p.ttl.value.trim();
  obj.pemohon.agama=F.p.agama.value.trim();
  obj.pemohon.jenis_kelamin=F.p.jk.value.trim();
  obj.pemohon.status_perkawinan=F.p.status.value.trim();
  obj.pemohon.pekerjaan=F.p.pekerjaan.value.trim();
  obj.pemohon.alamat=F.p.alamat.value.trim();
  obj.pemohon.kelurahan=F.p.kelurahan.value.trim();
  obj.pemohon.kecamatan=F.p.kecamatan.value.trim();
  obj.pemohon.kota_kab=F.p.kota.value.trim();
  obj.pemohon.provinsi=F.p.prov.value.trim();
  obj.pemohon.domisili=F.p.domisili.value.trim();
  if(Array.isArray(obj.dokumen)) obj.dokumen = normalizeDokumen(obj.dokumen);
  return stripTransient(obj);
}

// ================== Render Daftar Dokumen ==================
function renderUploadedFiles(obj){
  const docs=normalizeDokumen(Array.isArray(obj?.dokumen)?obj.dokumen:[]);
  uploadedFilesTbody.innerHTML='';
  for(const d of docs){
    const tr=document.createElement('tr');
    const name=d?.name||d?.label||'-';
    const view=d?.view_url||null;
    const down=d?.download_url||null;
    const fid=d?.file_id||null;
    tr.innerHTML='<td>'+name+'</td>'+\
      '<td class="nowrap"><div class="actions">'+\
      (view?('<a class="linklike" href="'+view+'" target="_blank" rel="noopener">Lihat</a>'):'<span class="status">—</span>')+\
      (down?('<a class="linklike" href="'+down+'" target="_blank" rel="noopener">Unduh</a>'):'<span class="status">—</span>')+\
      '<button class="btn btn-danger tight-del" '+(fid?'':'disabled')+' data-fileid="'+(fid||'')+'">Hapus</button></div></td>'+\
      '<td class="nowrap"><code class="mono">'+(fid||'-')+'</code></td>'+\
      '<td class="nowrap">'+(d?.mimeType||'-')+'</td>'+\
      '<td class="nowrap">'+(typeof d?.size==='number'?d.size.toLocaleString('id-ID'):(d?.size||'-'))+'</td>';
    uploadedFilesTbody.appendChild(tr);
  }
  uploadedFilesTbody.querySelectorAll('.tight-del').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const fid=btn.getAttribute('data-fileid');
      if(fid) deleteDocumentsByFileIds([fid]);
    });
  });
}

// ================== Loader JSON sumber (robust) ==================
async function load(){
  try{
    if(!JSON_URL){
      stat.textContent='ID_USER kosong. Buka halaman dengan ?id=<ID> atau render via n8n.';
      out.textContent='{}'; uploadedFilesTbody.innerHTML=''; return;
    }
    const res=await fetch(JSON_URL+'?t='+Date.now(),{cache:'no-store'});
    if(!res.ok){
      const text=await res.text();
      stat.textContent='Gagal ('+res.status+'). Periksa ID/URL/CORS.';
      out.textContent=text.slice(0,500); uploadedFilesTbody.innerHTML=''; return;
    }
    const ctype=res.headers.get('content-type')||'';
    const txt=await res.text();
    try{ lastJSON=JSON.parse(txt); }
    catch(err){
      if(!ctype.includes('application/json')){
        stat.textContent='Respon bukan JSON. Cek server/CORS.';
        out.textContent=txt.slice(0,500); uploadedFilesTbody.innerHTML=''; return;
      } else { throw err; }
    }
    const h=await hashText(JSON.stringify(lastJSON));
    if(h!==lastHash){
      lastHash=h;
      lastObj=Array.isArray(lastJSON)?lastJSON[0]:lastJSON;
      out.textContent=JSON.stringify(lastJSON,null,2);
      renderUploadedFiles(lastObj||{});
      // Selalu isi form (checkbox pause dihapus)
      fillForm(lastObj||{});
    }
    stat.textContent='Tersambung • '+new Date().toLocaleTimeString();
  }catch(e){ stat.textContent='Error: '+e.message; }
}
load(); setInterval(load,1200);

// ================== Kirim / Update / Upload ==================
btn.addEventListener('click', async()=>{
  if(!lastObj && !lastJSON){ sstat.textContent='Belum ada data'; return; }
  btn.disabled=true; sstat.textContent='Mengirim…';
  try{
    const base=lastObj||(Array.isArray(lastJSON)?lastJSON[0]:lastJSON)||{};
    const editedClean=buildPayload(base);
    let dataPayload;
    if(Array.isArray(lastJSON)){ const arr=[...lastJSON]; arr[0]={...editedClean,id_user:ID_USER}; dataPayload=arr; }
    else { dataPayload={...editedClean,id_user:ID_USER}; }
    const resp=await fetch('https://n8n-qz8tp6856ibc.bgxy.sumopod.my.id/webhook/57feb799-ddb2-4b0c-bfc0-b4e077558c79',{
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(dataPayload)
    });
    sstat.textContent=resp.ok?'Terkirim ✓':('Gagal ('+resp.status+')');
  }catch(e){ sstat.textContent='Error: '+e.message; }
  finally{ btn.disabled=false; }
});

updateBtn.addEventListener('click', async()=>{
  if(!lastObj && !lastJSON){ ustat2.textContent='Belum ada data'; return; }
  updateBtn.disabled=true; ustat2.textContent='Mengirim update…';
  try{
    const base=lastObj||(Array.isArray(lastJSON)?lastJSON[0]:lastJSON)||{};
    const edited=buildPayload(base);

    if(UPDATE_STRATEGY==='OVERWRITE_BIN'){
      const oldDocs=normalizeDokumen(base?.dokumen);
      edited.dokumen = normalizeDokumen(Array.isArray(edited.dokumen)&&edited.dokumen.length?edited.dokumen:oldDocs);
    } else {
      if('dokumen' in edited) delete edited.dokumen;
    }

    let dataPayload;
    if(Array.isArray(lastJSON)){ const arr=[...lastJSON]; arr[0]={...edited,id_user:ID_USER}; dataPayload=arr; }
    else { dataPayload={...edited,id_user:ID_USER}; }

    const resp=await fetch('https://n8n-qz8tp6856ibc.bgxy.sumopod.my.id/webhook/e1863045-3bfd-497d-b8a3-fc2c7c23eaa7',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ action:'UPDATE_ONLY', strategy:UPDATE_STRATEGY, id_user:ID_USER, data:dataPayload })
    });
    if(!resp.ok) throw new Error('HTTP '+resp.status+' — '+(await resp.text()).slice(0,200));
    ustat2.textContent='Update sukses ✓';
    await load();
  }catch(e){ ustat2.textContent='Error: '+e.message; }
  finally{ updateBtn.disabled=false; }
});

upBtn.addEventListener('click', async()=>{
  try{
    if(!lastObj && !lastJSON){ ust.textContent='Belum ada data'; return; }
    const files=Array.from(fileInput.files||[]);
    if(files.length===0){ ust.textContent='Pilih minimal satu file.'; return; }

    upBtn.disabled=true; ust.textContent='Mengupload…';

    const baseObj=lastObj||(Array.isArray(lastJSON)?lastJSON[0]:lastJSON)||{};
    const edited=buildPayload(baseObj);

    let dataPayload;
    if(Array.isArray(lastJSON)){ const arr=[...lastJSON]; arr[0]={...edited,id_user:ID_USER}; dataPayload=arr; }
    else { dataPayload={...edited,id_user:ID_USER}; }

    const files_info=files.map(f=>({name:f.name,size:f.size,type:f.type||null}));
    const form=new FormData();
    form.append('data', JSON.stringify(dataPayload));
    form.append('id_user', ID_USER);
    form.append('files_info', JSON.stringify(files_info));
    for(const f of files) form.append('files[]', f, f.name);

    const resp=await fetch('https://n8n-qz8tp6856ibc.bgxy.sumopod.my.id/webhook/1ae8a1a1-9f9d-4792-8505-9c84e1d3654b',{ method:'POST', body:form });
    const text=await resp.text();
    if(!resp.ok) throw new Error('HTTP '+resp.status+' — '+text.slice(0,200));

    ust.textContent='Upload sukses ✓';
    fileInput.value=''; // reset input file
    await load();
  }catch(e){ ust.textContent='Upload gagal: '+e.message; }
  finally{ upBtn.disabled=false; }
});

// ================== Hapus Dokumen ==================
async function deleteDocumentsByFileIds(fileIds=[]){
  if(!fileIds.length) return;
  if(!confirm('Hapus '+fileIds.length+' dokumen?\n'+fileIds.join('\n'))) return;
  try{
    delDocStatus.textContent='Memproses…';
    const base=lastObj||(Array.isArray(lastJSON)?lastJSON[0]:lastJSON)||{};
    const filtered=JSON.parse(JSON.stringify(base));
    const docs=Array.isArray(filtered.dokumen)?filtered.dokumen:[];
    filtered.dokumen = normalizeDokumen(docs).filter(d=>!fileIds.includes(d?.file_id));

    let overwritePayload;
    if(Array.isArray(lastJSON)){ const arr=[...lastJSON]; arr[0]={...filtered,id_user:ID_USER}; overwritePayload=arr; }
    else { overwritePayload={...filtered,id_user:ID_USER}; }

    const resp=await fetch('https://n8n-qz8tp6856ibc.bgxy.sumopod.my.id/webhook/e1863045-3bfd-497d-b8a3-fc2c7c23eaa7',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ action:'DELETE_DOCS', id_user:ID_USER, delete_file_ids:fileIds, data:overwritePayload })
    });

    if(!resp.ok){ const t=await resp.text(); throw new Error('HTTP '+resp.status+' — '+t.slice(0,200)); }
    delDocStatus.textContent='Dokumen dihapus & data ditimpa ✓';
    await load();
  }catch(e){ delDocStatus.textContent='Gagal: '+e.message; }
}

uploadedFilesTbody.addEventListener('click',(ev)=>{
  const btn=ev.target.closest('.tight-del');
  if(!btn) return;
  const fid=btn.getAttribute('data-fileid');
  if(fid) deleteDocumentsByFileIds([fid]);
});
