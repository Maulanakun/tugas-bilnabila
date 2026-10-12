/* Panel Admin: daftar pasien + data harian (purin, asam urat, tensi, keluhan), bisa dicari dan difilter tanggal */
const Adm={q:"",d:"",rows:[],info:null,loading:false,err:"",seq:0,t:null};

Views.admin=()=>{const u=Auth.current();
return`<header class="top noprint"><div class="in"><div class="brand"><i aria-hidden="true">🩺</i>Gout Care · Admin</div>
<div class="who"><span>Halo, <b>${U.esc(u.nama)}</b></span></div>
<div class="tools"><button id="thm2" onclick="Act.theme()">🌙 Gelap</button><button onclick="Act.logout()">Keluar</button></div></div></header>
<div class="adm"><div class="c noprint"><h2>Daftar pasien</h2>
<p class="mu">Data harian tiap pasien sesuai isi rapor: total purin dibanding batas, kadar asam urat, tensi, dan keluhan.</p>
<label class="lb" for="aq">Cari pasien (nama atau email)</label>
<input id="aq" type="search" placeholder="Ketik nama atau email…" value="${U.esc(Adm.q)}" oninput="Act.admSearch(this.value)" autocomplete="off">
<div class="r" style="align-items:end"><div><label class="lb" for="ad">Tanggal</label><input id="ad" type="date" value="${U.esc(Adm.d)}" onchange="Act.admDate(this.value)"></div>
<div class="g" style="margin-bottom:5px"><button onclick="Act.admDate('${U.today()}')">Hari ini</button><button onclick="Act.admDate('')">Semua tanggal</button></div></div></div>
<div id="admres" aria-live="polite"></div></div>`};

function admStatus(r){return{
  purin:r.purinOk===null?"":r.purinOk?'<span class="t ok">Aman</span>':'<span class="t bad">Melebihi</span>',
  lab:!r.labStatus?"":`<span class="t ${r.labStatus==="Normal"?"ok":r.labStatus==="Tinggi"?"bad":"wa"}">${r.labStatus}</span>`}}

function admTable(){
  if(Adm.loading&&!Adm.rows.length)return'<div class="c"><p class="mu">Memuat…</p></div>';
  if(Adm.err)return`<div class="c"><div class="warn">${U.esc(Adm.err)}</div></div>`;
  const i=Adm.info||{patients:0,total:0};
  if(!Adm.rows.length)return`<div class="c"><p class="mu">Tidak ada data${Adm.q?" untuk pencarian itu":""}${Adm.d?" pada "+U.longDate(Adm.d):""}.</p></div>`;
  return`<div class="c"><p class="mu" style="margin-top:0"><b>${i.patients}</b> pasien · <b>${i.total}</b> catatan harian${i.truncated?" (menampilkan "+Adm.rows.length+" terbaru, persempit pencarian)":""}. Klik baris untuk detail.</p>
<div class="ov"><table><thead><tr><th>Pasien</th><th>Tanggal</th><th>Purin</th><th>Asam urat</th><th>Tensi</th><th>Keluhan</th></tr></thead><tbody>${Adm.rows.map((r,n)=>{const s=admStatus(r);
return`<tr style="cursor:pointer" onclick="Act.admToggle(${n})" tabindex="0" onkeydown="if(event.key==='Enter')Act.admToggle(${n})"><td><b>${U.esc(r.nama)}</b><br><span class="mu">${U.esc(r.email)}</span></td><td>${r.d}</td>
<td>${r.meals.length?r.purin+" / "+r.lim+" mg<br>"+s.purin:'<span class="mu">-</span>'}</td>
<td>${r.lab!==null?r.lab+" mg/dL<br>"+s.lab:'<span class="mu">-</span>'}</td>
<td>${r.td?U.esc(r.td):'<span class="mu">-</span>'}</td>
<td>${r.keluhan.length?r.keluhan.length+"x"+(r.urgent?' <span class="t bad">Perlu dicek</span>':""):'<span class="mu">-</span>'}</td></tr>
<tr id="adm${n}" hidden><td colspan="6">${admDetail(r)}</td></tr>`}).join("")}</tbody></table></div></div>`}

function admDetail(r){
  const bm=r.bb&&r.tb?(r.bb/((r.tb/100)**2)).toFixed(1):null;
  return`<p class="mu" style="margin:0 0 6px">${U.longDate(r.d)} · ${r.jk==="L"?"Laki-laki":"Perempuan"}${bm?" · IMT "+bm:""}</p>
<b>Makanan</b>${r.meals.length?`<ul style="margin:4px 0 8px">${r.meals.map(m=>`<li>${U.esc(m.w)}: ${U.esc(m.n)} (${m.g} g, ${m.p} mg purin)</li>`).join("")}</ul>`:'<p class="mu" style="margin:2px 0 8px">Tidak ada catatan makan.</p>'}
<b>Keluhan</b>${r.keluhan.length?`<ul style="margin:4px 0 8px">${r.keluhan.map(k=>`<li>${k.t?k.t+" · ":""}${U.esc(k.gejala.join(", "))||"-"}${k.lain?" · "+U.esc(k.lain):""}${k.urgent?' <span class="t bad">Perlu dicek</span>':""}</li>`).join("")}</ul>`:'<p class="mu" style="margin:2px 0 8px">Tidak ada keluhan.</p>'}
${r.catatan?`<b>Catatan tensi</b><p style="margin:4px 0 0">${U.esc(r.catatan)}</p>`:""}`}

async function admLoad(){
  const my=++Adm.seq;Adm.loading=true;Adm.err="";
  try{
    const qs=new URLSearchParams();if(Adm.q.trim())qs.set("q",Adm.q.trim());if(Adm.d)qs.set("date",Adm.d);
    const r=await Api.req("GET","/admin/patients?"+qs);
    if(my!==Adm.seq)return;Adm.rows=r.rows;Adm.info=r;
  }catch(e){if(my!==Adm.seq)return;Adm.rows=[];Adm.err=e.message}
  Adm.loading=false;admPaint();
}
function admPaint(){const el=U.$("admres");if(el)el.innerHTML=admTable()}

Act.admSearch=v=>{Adm.q=v;clearTimeout(Adm.t);Adm.t=setTimeout(admLoad,250)};
Act.admDate=v=>{Adm.d=v;const el=U.$("ad");if(el)el.value=v;admLoad()};
Act.admToggle=n=>{const el=U.$("adm"+n);if(el)el.hidden=!el.hidden};
/* Dipanggil App.render saat admin masuk: muat data awal (hari ini) sekali per sesi */
Act.admInit=()=>{if(!Adm.ready){Adm.ready=true;Adm.d=U.today();Adm.q="";Adm.rows=[];}admLoad()};
