/* Panel Admin (khusus akun admin). Satu halaman, sembilan tab. Data diambil dari /api/admin/*.
   Grafik digambar sendiri sebagai SVG (objek Ch), tanpa pustaka tambahan. */
const Adm={ready:false,tab:"dash",data:{},sel:null,err:"",tmpPw:null,pm:"list",uq:"",us:"all",uo:"recent",ut:null,logKind:"activity",ed:null,cf:{kind:"announcement"},fq:"",fc:""};
const Dly={q:"",d:"",rows:[],info:null,loading:false,err:"",seq:0,t:null};   // "Catatan harian" (laporan harian per pasien)
const E=U.esc,NV=v=>v==null||v===""?"–":v;
const MON=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const mlab=m=>MON[+m.slice(5,7)-1]+" "+m.slice(2,4),dlab=d=>d.slice(8,10)+"/"+d.slice(5,7);
const tmf=t=>t?new Date(t).toLocaleString("id-ID",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"–";
const stTag=s=>s?`<span class="t ${s==="Normal"?"ok":s==="Tinggi"?"bad":"wa"}">${E(s)}</span>`:"";
const AT=[["dash","📊","Dashboard"],["users","👥","Pasien"],["stats","📈","Statistik"],["food","🍽️","Makanan"],["cont","📰","Konten"],["mail","✉️","Pengingat"],["rep","📄","Laporan"],["sys","⚙️","Sistem"],["log","🧾","Log"]];

/* ================= Grafik SVG ================= */
const Ch={
  empty:m=>`<p class="mu">${m||"Belum ada data untuk grafik ini."}</p>`,
  legend:s=>`<div class="lg">${s.map(x=>`<span><i style="border-top:3px ${x.dash?"dashed":"solid"} ${x.color}"></i>${E(x.name)}</span>`).join("")}</div>`,
  /* Kerangka bersama: 5 garis bantu sumbu Y, label X (dijarangkan), garis acuan opsional. Nilai grafik tak pernah negatif. */
  frame(xs,all,{ref,refText,min,label},draw){
    const W=640,H=230,L=46,R=14,T=14,B=34,vs=all.filter(v=>v!=null);
    if(!vs.length)return Ch.empty();
    let lo=Math.min(...vs,ref??Infinity,min??Infinity),hi=Math.max(...vs,ref??-Infinity);
    if(lo===hi){lo-=1;hi+=1}
    /* Skala "bulat": langkah 1/2/2.5/5 x 10^n supaya angka sumbu mudah dibaca */
    const raw=(hi-lo)/4,mag=10**Math.floor(Math.log10(raw)),step=[1,2,2.5,5,10].map(m=>m*mag).find(x=>x>=raw);
    lo=Math.max(0,Math.floor(lo/step)*step);hi=Math.ceil(hi/step)*step;
    const X=i=>L+(xs.length>1?i*(W-L-R)/(xs.length-1):(W-L-R)/2),Y=v=>T+(1-(v-lo)/(hi-lo))*(H-T-B),sx=Math.ceil(xs.length/8);
    let grid="";for(let v=lo;v<=hi+step/1e6;v+=step)grid+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--bd)"/><text x="${L-6}" y="${Y(v)+4}" font-size="11" text-anchor="end" fill="var(--mu)">${+v.toFixed(2)}</text>`;
    const xl=xs.map((x,i)=>(xs.length-1-i)%sx===0?`<text x="${X(i)}" y="${H-10}" font-size="11" text-anchor="middle" fill="var(--mu)">${E(x)}</text>`:"").join("");
    const rf=ref==null?"":`<line x1="${L}" x2="${W-R}" y1="${Y(ref)}" y2="${Y(ref)}" stroke="var(--ok)" stroke-dasharray="6 4" stroke-width="1.5"/><text x="${W-R}" y="${Y(ref)-5}" font-size="11" text-anchor="end" fill="var(--ok)" font-weight="700">${E(refText||ref)}</text>`;
    return`<div class="ov"><svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:440px" role="img" aria-label="${E(label||"Grafik")}">${grid}${rf}${xl}${draw(X,Y,W-L-R)}</svg></div>`;
  },
  /* Garis: series=[{name,vals[],color,dash}] sejajar dengan xs; nilai null = garis putus */
  line(xs,series,o={}){
    const dots=xs.length<=31;
    const g=Ch.frame(xs,series.flatMap(s=>s.vals),o,(X,Y)=>series.map((s,si)=>{
      let seg=[],out="";const flush=()=>{if(seg.length>1)out+=`<polyline fill="none" stroke="${s.color}" stroke-width="${si?2:3}" ${s.dash?'stroke-dasharray="6 4"':""} stroke-linejoin="round" points="${seg.map(p=>p[0]+","+p[1]).join(" ")}"/>`;seg=[]};
      const few=s.vals.filter(x=>x!=null).length<=12;
      s.vals.forEach((v,i)=>{if(v==null){flush();return}seg.push([X(i),Y(v)]);
        const solo=(i===0||s.vals[i-1]==null)&&(i===s.vals.length-1||s.vals[i+1]==null);
        if(dots||solo)out+=`<circle cx="${X(i)}" cy="${Y(v)}" r="${si?3:4.5}" fill="var(--card)" stroke="${s.color}" stroke-width="2.5"/>`;
        if(si===0&&few)out+=`<text x="${X(i)}" y="${Y(v)-9}" font-size="11" text-anchor="middle" fill="currentColor">${v}</text>`});
      flush();return out}).join(""));
    return g.startsWith("<p")?g:g+Ch.legend(series);
  },
  /* Batang (mis. purin per hari), merah bila melewati `ref`; `over` = garis pembanding putus-putus */
  bars(xs,vals,o={}){
    return Ch.frame(xs,[...vals,...(o.over||[]),0],{...o,min:0},(X,Y,w)=>{
      const bw=Math.max(3,Math.min(26,w/xs.length*.7)),y0=Y(0);
      let out=vals.map((v,i)=>v==null?"":`<rect x="${X(i)-bw/2}" y="${Y(v)}" width="${bw}" height="${Math.max(1,y0-Y(v))}" rx="2" fill="${o.ref!=null&&v>o.ref?"var(--bad)":"var(--pr)"}"><title>${xs[i]}: ${v}</title></rect>`).join("");
      if(o.over){let seg=[];const fl=()=>{if(seg.length>1)out+=`<polyline fill="none" stroke="var(--mu)" stroke-width="2" stroke-dasharray="6 4" points="${seg.join(" ")}"/>`;seg=[]};o.over.forEach((v,i)=>{if(v==null)fl();else seg.push(X(i)+","+Y(v))});fl()}
      return out});
  },
  /* Batang mendatar berisi daftar (makanan teratas, distribusi status) */
  hbars(rows,{unit="",color="var(--pr)"}={}){
    if(!rows.length)return Ch.empty();const mx=Math.max(...rows.map(r=>r.v),1);
    return rows.map(r=>`<div style="display:grid;grid-template-columns:minmax(90px,38%) 1fr auto;gap:8px;align-items:center;margin:5px 0"><span style="font-size:14px">${E(r.n)}</span><div class="bar" style="margin:0"><i style="width:${r.v/mx*100}%;background:${r.color||color}"></i></div><b style="font-size:14px">${r.v}${unit}</b></div>`).join("");
  }
};

/* ================= Kerangka halaman ================= */
Views.admin=()=>{const u=Auth.current();
return`<header class="top noprint"><div class="in"><div class="brand"><i aria-hidden="true">🩺</i><span class="sn">Gout Care</span> · Admin</div>
<div class="who"><span>Halo, <b>${E(u.nama)}</b></span></div>
<div class="tools"><button id="thm2" onclick="Act.theme()">🌙 Gelap</button><button onclick="Act.logout()">Keluar</button></div></div></header>
<nav class="atabs noprint" id="atabs" aria-label="Menu admin"></nav>
<div class="adm"><div id="admres" aria-live="polite"></div></div>`};

Adm.draw={};
Adm.tabs=()=>{const el=U.$("atabs");if(el)el.innerHTML=AT.map(t=>`<button class="${Adm.tab===t[0]?"on":""}" ${Adm.tab===t[0]?'aria-current="page"':""} onclick="Act.admGo('${t[0]}')"><span aria-hidden="true">${t[1]}</span> ${t[2]}</button>`).join("")};
/* Gambar tab aktif dari data yang sudah ada (null = belum siap), lalu isi bagian yang dikelola terpisah */
Adm.paint=()=>{const el=U.$("admres");if(!el)return;
  el.innerHTML=Adm.err?`<div class="c"><div class="warn">${E(Adm.err)}</div></div>`:(Adm.draw[Adm.tab]()||'<div class="c"><p class="mu">Memuat…</p></div>');
  if(Adm.err)return;
  if(Adm.tab==="users"&&!Adm.sel)Adm.pm==="daily"?dlyPaint():usersPaint();
  if(Adm.tab==="food")foodsPaint();
  if(Adm.tab==="mail"&&Adm.data.set)Act.admPrev()};
/* Ambil satu sumber data ke Adm.data[k], lalu gambar ulang */
Adm.get=async(k,path)=>{try{Adm.data[k]=await Api.req("GET",path);Adm.err=""}catch(e){Adm.err=e.message}Adm.paint()};
const adm=async(method,path,body)=>{try{return await Api.req(method,path,body)}catch(e){U.toast("⚠️ "+E(e.message),6000);throw e}};

Adm.show=()=>{Adm.tabs();Adm.paint();Adm.load()};
Adm.load=()=>{switch(Adm.tab){
  case"dash":Adm.get("ov","/admin/overview");break;
  case"users":Adm.sel?Adm.get("det","/admin/user?id="+encodeURIComponent(Adm.sel)):Adm.pm==="daily"?dlyLoad():usersLoad();break;
  case"stats":case"rep":Adm.get("stats","/admin/stats");break;
  case"food":Adm.get("foods","/admin/foods");break;
  case"cont":Adm.get("cont","/admin/content");break;
  case"mail":Adm.get("set","/admin/settings");Adm.get("lmail","/admin/logs?kind=mail");break;
  case"sys":Adm.get("set","/admin/settings");break;
  case"log":Adm.get("log","/admin/logs?kind="+Adm.logKind);break}};
Act.admGo=t=>{Adm.tab=t;Adm.sel=null;Adm.err="";Adm.tmpPw=null;Adm.show()};
Act.admOpen=id=>{Adm.tab="users";Adm.sel=id;Adm.err="";Adm.tmpPw=null;delete Adm.data.det;window.scrollTo(0,0);Adm.show()};
/* Dipanggil App.render saat admin masuk */
Act.admInit=()=>{if(!Adm.ready){Adm.ready=true;Adm.tab="dash";Adm.data={};Adm.sel=null;Dly.d=U.today();Dly.q=""}Adm.show()};

/* ================= 1. Dashboard ================= */
Adm.draw.dash=()=>{const o=Adm.data.ov;if(!o)return null;const t=o.totals;
  const card=(k,v,s)=>`<div class="as"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s||""}</div></div>`;
  return`<div class="astats">${card("Total pasien",t.patients,t.disabled?t.disabled+" nonaktif":"")}${card("Pasien aktif",t.active,"7 hari terakhir")}${card("Pasien baru hari ini",t.newToday)}${card("Catatan hari ini",t.recordsToday,"makan, asam urat, tensi, keluhan")}</div>
<div class="c"><h2>Tren 14 hari terakhir</h2>${Ch.line(o.trend.map(x=>dlab(x.d)),[{name:"Pasien aktif",vals:o.trend.map(x=>x.patients),color:"var(--pr)"},{name:"Catatan baru",vals:o.trend.map(x=>x.records),color:"var(--wa)",dash:true}],{min:0,label:"Tren pasien aktif dan catatan baru per hari"})}</div>
<div class="c"><h2>Notifikasi penting</h2>${o.notifications.length?o.notifications.map(n=>`<div class="nt ${n.level}"><span>${E(n.text)}</span>${n.userId?`<button onclick="Act.admOpen('${E(n.userId)}')">Lihat</button>`:""}</div>`).join(""):'<p class="mu">Tidak ada hal mendesak saat ini. 👍</p>'}</div>`};

/* ================= 2. Pasien: daftar, detail, catatan harian ================= */
Adm.draw.users=()=>{
  if(Adm.sel){const d=Adm.data.det;return d?userDetail(d):null}
  return`<div class="c noprint"><div class="g" style="margin-bottom:6px"><button class="${Adm.pm==="list"?"b":""}" onclick="Act.admPm('list')">Daftar pengguna</button><button class="${Adm.pm==="daily"?"b":""}" onclick="Act.admPm('daily')">Catatan harian</button></div>
${Adm.pm==="list"?`<label class="lb" for="uq">Cari (nama atau email)</label><input id="uq" type="search" placeholder="Ketik nama atau email…" value="${E(Adm.uq)}" oninput="Act.admUq(this.value)" autocomplete="off">
<div class="r"><div><label class="lb" for="us">Filter</label><select id="us" onchange="Act.admUs(this.value)">${[["all","Semua"],["active","Akun aktif"],["disabled","Akun nonaktif"],["high","Asam urat tinggi"]].map(o=>`<option value="${o[0]}" ${Adm.us===o[0]?"selected":""}>${o[1]}</option>`).join("")}</select></div>
<div><label class="lb" for="uo">Urutkan</label><select id="uo" onchange="Act.admUo(this.value)">${[["recent","Aktivitas terbaru"],["name","Nama"],["lab","Asam urat tertinggi"]].map(o=>`<option value="${o[0]}" ${Adm.uo===o[0]?"selected":""}>${o[1]}</option>`).join("")}</select></div></div>`
:`<p class="mu">Data harian tiap pasien: total purin dibanding batas, asam urat, tensi, dan keluhan.</p><label class="lb" for="aq">Cari pasien</label><input id="aq" type="search" placeholder="Nama atau email…" value="${E(Dly.q)}" oninput="Act.admSearch(this.value)" autocomplete="off">
<div class="r" style="align-items:end"><div><label class="lb" for="ad">Tanggal</label><input id="ad" type="date" value="${E(Dly.d)}" onchange="Act.admDate(this.value)"></div><div class="g" style="margin-bottom:5px"><button onclick="Act.admDate('${U.today()}')">Hari ini</button><button onclick="Act.admDate('')">Semua tanggal</button></div></div>`}</div>
<div id="${Adm.pm==="list"?"admul":"admdl"}"></div>`};
Act.admPm=m=>{Adm.pm=m;Adm.show()};

async function usersLoad(){
  const qs=new URLSearchParams({status:Adm.us,sort:Adm.uo});if(Adm.uq.trim())qs.set("q",Adm.uq.trim());
  try{Adm.data.ul=await Api.req("GET","/admin/users?"+qs);Adm.err=""}catch(e){Adm.data.ul=null;Adm.err=e.message}
  Adm.err?Adm.paint():usersPaint();
}
function usersPaint(){const el=U.$("admul");if(!el)return;const l=Adm.data.ul;
  if(!l){el.innerHTML='<div class="c"><p class="mu">Memuat…</p></div>';return}
  if(!l.rows.length){el.innerHTML='<div class="c"><p class="mu">Tidak ada pengguna yang cocok.</p></div>';return}
  el.innerHTML=`<div class="c"><p class="mu" style="margin-top:0"><b>${l.total}</b> pengguna. Klik baris untuk melihat detail dan grafik.</p><div class="ov"><table><thead><tr><th>Pengguna</th><th>Catatan</th><th>Asam urat terakhir</th><th>Aktivitas terakhir</th><th>Akun</th></tr></thead><tbody>${l.rows.map(r=>`<tr style="cursor:pointer" tabindex="0" onclick="Act.admOpen('${E(r.id)}')" onkeydown="if(event.key==='Enter')Act.admOpen('${E(r.id)}')"><td><b>${E(r.nama)}</b><br><span class="mu">${E(r.email)}</span></td><td>${r.records}</td><td>${r.lastLab?`${r.lastLab.v} mg/dL<br>${stTag(r.lastLab.status)}`:'<span class="mu">–</span>'}</td><td>${E(NV(r.lastActive))}</td><td>${r.disabled?'<span class="t bad">Nonaktif</span>':'<span class="t ok">Aktif</span>'}</td></tr>`).join("")}</tbody></table></div></div>`}
Act.admUq=v=>{Adm.uq=v;clearTimeout(Adm.ut);Adm.ut=setTimeout(usersLoad,250)};
Act.admUs=v=>{Adm.us=v;usersLoad()};Act.admUo=v=>{Adm.uo=v;usersLoad()};

/* ---- Detail satu pasien: grafik rata-rata pasien vs seluruh pasien ---- */
function userDetail(d){
  const s=d.summary,se=d.series,ov=d.overall,a=se.avg,oa=ov.avg,bm=s.bb&&s.tb?(s.bb/((s.tb/100)**2)).toFixed(1):null;
  const xm=se.lab.map(x=>mlab(x.m)),xd=se.purin.map(x=>dlab(x.d));
  const row=(k,a1,b1)=>`<tr><td>${k}</td><td><b>${a1}</b></td><td>${b1}</td></tr>`;
  return`<div class="c noprint"><div class="g"><button onclick="Act.admBack()">← Kembali ke daftar</button></div></div>
<div class="c"><h2>${E(s.nama)} ${s.disabled?'<span class="t bad">Nonaktif</span>':'<span class="t ok">Aktif</span>'}</h2>
<p class="mu" style="margin:0">${E(s.email)} · ${s.jk==="L"?"Laki-laki":"Perempuan"}${bm?" · IMT "+bm:""} · batas purin ${s.lim} mg/hari</p>
<p class="mu" style="margin:2px 0 10px">Terdaftar ${E(NV((s.createdAt||"").slice(0,10)))} · login terakhir ${tmf(s.lastLoginAt)} · ${s.records} catatan</p>
<div class="g noprint"><button onclick="Act.admDisable(${!s.disabled})">${s.disabled?"✅ Aktifkan akun":"⏸ Nonaktifkan akun"}</button><button onclick="Act.admReset()">🔑 Reset kata sandi</button><button onclick="Act.admDelete()" style="color:var(--bad)">🗑 Hapus akun</button></div>
${Adm.tmpPw?`<div class="warn" style="margin-top:12px"><b>Kata sandi sementara (hanya tampil sekali):</b><br><code style="font-size:18px;user-select:all">${E(Adm.tmpPw)}</code><br><span class="mu">Sampaikan ke pasien secara langsung, lalu minta ia menggantinya di menu Akun. Sesi lamanya sudah dicabut.</span></div>`:""}</div>
<div class="c"><h2>Rata-rata kesehatan: pasien ini vs seluruh pasien</h2>
<div class="ov"><table><thead><tr><th></th><th>${E(s.nama)}</th><th>Seluruh pasien (${ov.patients})</th></tr></thead><tbody>
${row("Asam urat rata-rata",NV(a.lab)+" mg/dL",NV(oa.lab)+" mg/dL")}${row("Purin rata-rata per hari",NV(a.purin)+" mg",NV(oa.purin)+" mg")}${row("Tensi rata-rata",a.sys?a.sys+"/"+a.dia:"–",oa.sys?oa.sys+"/"+oa.dia:"–")}${row("Hari melebihi batas purin",a.daysLogged?a.daysOver+" dari "+a.daysLogged+" hari tercatat":"–","–")}</tbody></table></div>
<h3>Asam urat per bulan (rata-rata, mg/dL)</h3>${Ch.line(xm,[{name:"Pasien ini",vals:se.lab.map(x=>x.v),color:"var(--pr)"},{name:"Seluruh pasien",vals:ov.lab.map(x=>x.v),color:"var(--mu)",dash:true}],{ref:se.batas,refText:"batas atas "+se.batas,label:"Asam urat per bulan, pasien dan seluruh pasien"})}
<h3>Total purin per hari, 30 hari terakhir (mg)</h3>${Ch.bars(xd,se.purin.map(x=>x.v),{ref:se.lim,refText:"batas "+se.lim,over:ov.purin.map(x=>x.v),label:"Purin harian pasien dibanding batas"})}<p class="mu">Batang merah = melebihi batas. Garis putus-putus = rata-rata seluruh pasien pada hari itu.</p>
<h3>Tensi per bulan (rata-rata, mmHg)</h3>${Ch.line(xm,[{name:"Sistolik (pasien)",vals:se.tensi.map(x=>x.sys),color:"var(--bad)"},{name:"Diastolik (pasien)",vals:se.tensi.map(x=>x.dia),color:"var(--pr)"},{name:"Sistolik (semua)",vals:ov.tensi.map(x=>x.sys),color:"var(--bad)",dash:true},{name:"Diastolik (semua)",vals:ov.tensi.map(x=>x.dia),color:"var(--pr)",dash:true}],{label:"Tensi per bulan"})}</div>
<div class="c"><h2>Riwayat asam urat</h2>${d.labs.length?`<div class="ov"><table><tr><th>Tanggal</th><th>Kadar</th><th>Status</th></tr>${d.labs.map(l=>`<tr><td>${l.d}</td><td>${l.v} mg/dL</td><td>${stTag(l.status)}</td></tr>`).join("")}</table></div>`:'<p class="mu">Belum ada.</p>'}</div>
<div class="c"><h2>Keluhan terbaru</h2>${d.complaints.length?`<ul>${d.complaints.map(c=>`<li>${c.d}${c.t?" "+c.t:""} · ${E((c.gejala||[]).join(", "))||"–"}${c.lain?" · "+E(c.lain):""}</li>`).join("")}</ul>`:'<p class="mu">Tidak ada keluhan.</p>'}</div>
<div class="c"><h2>Catatan makan terbaru</h2>${d.meals.length?`<div class="ov"><table><tr><th>Tanggal</th><th>Waktu</th><th>Makanan</th><th>Purin</th></tr>${d.meals.map(m=>`<tr><td>${m.d}</td><td>${E(m.w)}</td><td>${E(m.n)} (${m.g} g)</td><td>${m.p} mg</td></tr>`).join("")}</table></div>`:'<p class="mu">Belum ada.</p>'}</div>`}
Act.admBack=()=>{Adm.sel=null;Adm.tmpPw=null;Adm.show()};
Act.admDisable=async off=>{if(!confirm(off?"Nonaktifkan akun ini? Pasien tidak bisa masuk sampai diaktifkan lagi.":"Aktifkan kembali akun ini?"))return;
  try{await adm("POST","/admin/user/disable",{id:Adm.sel,disabled:off});U.toast(off?"Akun dinonaktifkan.":"Akun diaktifkan.");Adm.load()}catch(e){}};
Act.admReset=async()=>{if(!confirm("Reset kata sandi pasien ini? Kata sandi lama langsung tidak berlaku."))return;
  try{const r=await adm("POST","/admin/user/reset-password",{id:Adm.sel});Adm.tmpPw=r.password;Adm.paint()}catch(e){}};
Act.admDelete=async()=>{const e=prompt("HAPUS PERMANEN akun ini beserta seluruh catatannya (tidak bisa dibatalkan).\nKetik email pengguna untuk konfirmasi:");if(e===null)return;
  try{await adm("POST","/admin/user/delete",{id:Adm.sel,confirmEmail:e});U.toast("Akun dihapus.");Act.admBack()}catch(x){}};

/* ---- Catatan harian (fitur lama, dipertahankan) ---- */
function admStatus(r){return{purin:r.purinOk===null?"":r.purinOk?'<span class="t ok">Aman</span>':'<span class="t bad">Melebihi</span>',lab:stTag(r.labStatus)}}
function dlyTable(){
  if(Dly.loading&&!Dly.rows.length)return'<div class="c"><p class="mu">Memuat…</p></div>';
  if(Dly.err)return`<div class="c"><div class="warn">${E(Dly.err)}</div></div>`;
  const i=Dly.info||{patients:0,total:0};
  if(!Dly.rows.length)return`<div class="c"><p class="mu">Tidak ada data${Dly.q?" untuk pencarian itu":""}${Dly.d?" pada "+U.longDate(Dly.d):""}.</p></div>`;
  return`<div class="c"><p class="mu" style="margin-top:0"><b>${i.patients}</b> pasien · <b>${i.total}</b> catatan harian${i.truncated?" (menampilkan "+Dly.rows.length+" terbaru, persempit pencarian)":""}. Klik baris untuk detail.</p>
<div class="ov"><table><thead><tr><th>Pasien</th><th>Tanggal</th><th>Purin</th><th>Asam urat</th><th>Tensi</th><th>Keluhan</th></tr></thead><tbody>${Dly.rows.map((r,n)=>{const s=admStatus(r);
return`<tr style="cursor:pointer" onclick="Act.admToggle(${n})" tabindex="0" onkeydown="if(event.key==='Enter')Act.admToggle(${n})"><td><b>${E(r.nama)}</b><br><span class="mu">${E(r.email)}</span></td><td>${r.d}</td><td>${r.meals.length?r.purin+" / "+r.lim+" mg<br>"+s.purin:'<span class="mu">-</span>'}</td><td>${r.lab!==null?r.lab+" mg/dL<br>"+s.lab:'<span class="mu">-</span>'}</td><td>${r.td?E(r.td):'<span class="mu">-</span>'}</td><td>${r.keluhan.length?r.keluhan.length+"x"+(r.urgent?' <span class="t bad">Perlu dicek</span>':""):'<span class="mu">-</span>'}</td></tr>
<tr id="adm${n}" hidden><td colspan="6">${dlyDetail(r)}</td></tr>`}).join("")}</tbody></table></div></div>`}
function dlyDetail(r){const bm=r.bb&&r.tb?(r.bb/((r.tb/100)**2)).toFixed(1):null;
  return`<p class="mu" style="margin:0 0 6px">${U.longDate(r.d)} · ${r.jk==="L"?"Laki-laki":"Perempuan"}${bm?" · IMT "+bm:""} · <a href="#" onclick="Act.admOpen('${E(r.userId)}');return false">Buka profil &amp; grafik</a></p>
<b>Makanan</b>${r.meals.length?`<ul style="margin:4px 0 8px">${r.meals.map(m=>`<li>${E(m.w)}: ${E(m.n)} (${m.g} g, ${m.p} mg purin)</li>`).join("")}</ul>`:'<p class="mu" style="margin:2px 0 8px">Tidak ada catatan makan.</p>'}
<b>Keluhan</b>${r.keluhan.length?`<ul style="margin:4px 0 8px">${r.keluhan.map(k=>`<li>${k.t?k.t+" · ":""}${E(k.gejala.join(", "))||"-"}${k.lain?" · "+E(k.lain):""}${k.urgent?' <span class="t bad">Perlu dicek</span>':""}</li>`).join("")}</ul>`:'<p class="mu" style="margin:2px 0 8px">Tidak ada keluhan.</p>'}
${r.catatan?`<b>Catatan tensi</b><p style="margin:4px 0 0">${E(r.catatan)}</p>`:""}`}
async function dlyLoad(){
  const my=++Dly.seq;Dly.loading=true;Dly.err="";
  try{const qs=new URLSearchParams();if(Dly.q.trim())qs.set("q",Dly.q.trim());if(Dly.d)qs.set("date",Dly.d);
    const r=await Api.req("GET","/admin/daily?"+qs);if(my!==Dly.seq)return;Dly.rows=r.rows;Dly.info=r}
  catch(e){if(my!==Dly.seq)return;Dly.rows=[];Dly.err=e.message}
  Dly.loading=false;dlyPaint()}
function dlyPaint(){const el=U.$("admdl");if(el)el.innerHTML=dlyTable()}
Act.admSearch=v=>{Dly.q=v;clearTimeout(Dly.t);Dly.t=setTimeout(dlyLoad,250)};
Act.admDate=v=>{Dly.d=v;const el=U.$("ad");if(el)el.value=v;dlyLoad()};
Act.admToggle=n=>{const el=U.$("adm"+n);if(el)el.hidden=!el.hidden};

/* ================= 3. Statistik agregat ================= */
Adm.draw.stats=()=>{const s=Adm.data.stats;if(!s)return null;const a=s.avg,tot=Object.values(s.dist).reduce((x,y)=>x+y,0)||1;
  const card=(k,v,t)=>`<div class="as"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${t||""}</div></div>`;
  return`<div class="c noprint"><div class="g"><button onclick="window.print()">🖨️ Cetak / simpan PDF</button></div></div>
<div class="po"><h2>Statistik Gout Care</h2><p>Dicetak: ${U.today()}</p></div>
<div class="astats">${card("Pasien",s.patients)}${card("Asam urat rata-rata",NV(a.lab)+" mg/dL","semua pengukuran")}${card("Purin rata-rata",NV(a.purin)+" mg","per hari tercatat")}${card("Tensi rata-rata",a.sys?a.sys+"/"+a.dia:"–","mmHg")}</div>
<div class="c"><h2>Rata-rata asam urat seluruh pasien per bulan</h2>${Ch.line(s.lab.map(x=>mlab(x.m)),[{name:"Rata-rata semua pengukuran (mg/dL)",vals:s.lab.map(x=>x.v),color:"var(--pr)"}],{label:"Rata-rata asam urat seluruh pasien per bulan"})}
<p class="mu">Pasien yang mengukur tiap bulan: ${s.lab.filter(x=>x.n).map(x=>mlab(x.m)+" = "+x.n).join(", ")||"belum ada"}. Rata-rata pengukuran terakhir per pasien: laki-laki ${NV(a.labL)}, perempuan ${NV(a.labP)} mg/dL.</p></div>
<div class="c"><h2>Rata-rata purin harian seluruh pasien (30 hari)</h2>${Ch.bars(s.purin.map(x=>dlab(x.d)),s.purin.map(x=>x.v),{label:"Rata-rata purin harian seluruh pasien"})}<p class="mu">Dihitung dari pasien yang mencatat makan pada hari itu (mg per pasien).</p></div>
<div class="c"><h2>Rata-rata tensi per bulan</h2>${Ch.line(s.tensi.map(x=>mlab(x.m)),[{name:"Sistolik",vals:s.tensi.map(x=>x.sys),color:"var(--bad)"},{name:"Diastolik",vals:s.tensi.map(x=>x.dia),color:"var(--pr)"}],{label:"Rata-rata tensi seluruh pasien per bulan"})}</div>
<div class="c"><h2>Status asam urat terakhir tiap pasien</h2>${Ch.hbars(Object.entries(s.dist).map(([n,v])=>({n,v,color:n==="Normal"?"var(--ok)":n==="Tinggi"?"var(--bad)":n==="Batas atas"?"var(--wa)":"var(--bd)"})))}<p class="mu">${tot} pasien. Batas atas: 7 mg/dL (laki-laki), 6 mg/dL (perempuan).</p></div>
<div class="c"><h2>Makanan paling sering dicatat</h2>${Ch.hbars(s.topFoods.map(f=>({n:f.n,v:f.count})),{unit:"×"})}</div>
<div class="c"><h2>Penyumbang purin terbesar (total mg tercatat)</h2>${Ch.hbars(s.topPurin.map(f=>({n:f.n,v:f.purin})),{unit:" mg",color:"var(--wa)"})}</div>
<div class="c"><h2>Gejala keluhan terbanyak</h2>${Ch.hbars(s.symptoms.map(f=>({n:f.name,v:f.count})),{unit:"×",color:"var(--bad)"})}</div>`};

/* ================= 4. Database makanan ================= */
const lvl=p=>p>150?["bad","Tinggi"]:p>=50?["wa","Sedang"]:["ok","Rendah"];
Adm.draw.food=()=>{const d=Adm.data.foods;if(!d)return null;const cats=[...new Set(d.foods.map(f=>f.cat))].sort(),ed=Adm.ed&&d.foods.find(f=>f.id===Adm.ed);
  return`<div class="c noprint"><h2>${ed?"Ubah makanan":"Tambah makanan"}</h2><div class="r"><div><label class="lb" for="fn">Nama makanan</label><input id="fn" maxlength="80" value="${ed?E(ed.name):""}"></div><div><label class="lb" for="fp">Purin (mg / 100 g)</label><input id="fp" type="number" min="0" max="1000" step="1" value="${ed?ed.purin:""}"></div></div>
<label class="lb" for="fc">Kategori</label><input id="fc" list="fcl" maxlength="40" value="${ed?E(ed.cat):""}"><datalist id="fcl">${cats.map(c=>`<option value="${E(c)}">`).join("")}</datalist>
<div class="g" style="margin-top:12px"><button class="b" onclick="Act.admFoodSave()">${ed?"Simpan perubahan":"Tambah"}</button>${ed?'<button onclick="Act.admFoodEdit(null)">Batal</button>':""}</div>
<p class="mu">Perubahan berlaku untuk pasien saat mereka membuka aplikasi. Catatan makan lama tidak berubah (nilai purin disimpan saat dicatat).</p></div>
<div class="c"><h2>Daftar makanan (${d.foods.length})</h2>${d.custom?"":'<p class="mu">Masih memakai data bawaan; daftar tersimpan di database saat Anda pertama kali menambah atau mengubah.</p>'}
<div class="r noprint"><div><input type="search" placeholder="Cari makanan…" value="${E(Adm.fq)}" oninput="Act.admFq(this.value)" aria-label="Cari makanan"></div><div><select onchange="Act.admFc(this.value)" aria-label="Filter kategori"><option value="">Semua kategori</option>${cats.map(c=>`<option ${Adm.fc===c?"selected":""}>${E(c)}</option>`).join("")}</select></div></div>
<div id="admft"></div></div>`};
function foodsPaint(){const el=U.$("admft"),d=Adm.data.foods;if(!el||!d)return;const q=Adm.fq.trim().toLowerCase();
  const rows=d.foods.filter(f=>(!q||f.name.toLowerCase().includes(q))&&(!Adm.fc||f.cat===Adm.fc)).sort((a,b)=>a.cat.localeCompare(b.cat)||a.name.localeCompare(b.name));
  el.innerHTML=rows.length?`<div class="ov"><table><thead><tr><th>Makanan</th><th>Purin/100 g</th><th>Kategori</th><th>Dicatat</th><th class="noprint"></th></tr></thead><tbody>${rows.map(f=>{const l=lvl(f.purin);return`<tr><td><b>${E(f.name)}</b></td><td>${f.purin} <span class="t ${l[0]}">${l[1]}</span></td><td>${E(f.cat)}</td><td>${f.used}×</td><td class="noprint" style="white-space:nowrap"><button onclick="Act.admFoodEdit('${E(f.id)}')">Ubah</button> <button class="x" onclick="Act.admFoodDel('${E(f.id)}')" aria-label="Hapus ${E(f.name)}">✕</button></td></tr>`}).join("")}</tbody></table></div><p class="mu">Rendah &lt; 50, sedang 50–150, tinggi &gt; 150 mg per 100 g.</p>`:'<p class="mu">Tidak ada makanan yang cocok.</p>'}
Act.admFq=v=>{Adm.fq=v;foodsPaint()};Act.admFc=v=>{Adm.fc=v;foodsPaint()};
Act.admFoodEdit=id=>{Adm.ed=id;Adm.paint();if(id)U.$("fn").scrollIntoView({behavior:"smooth",block:"center"})};
Act.admFoodSave=async()=>{try{await adm("POST","/admin/foods/save",{id:Adm.ed||undefined,name:U.$("fn").value,purin:U.$("fp").value===""?NaN:+U.$("fp").value,cat:U.$("fc").value});
  U.toast("Makanan tersimpan ✔");Adm.ed=null;Adm.load()}catch(e){}};
Act.admFoodDel=async id=>{const f=Adm.data.foods.foods.find(x=>x.id===id);if(!f||!confirm(`Hapus "${f.name}" dari daftar? Catatan makan lama pasien tetap ada.`))return;
  try{await adm("POST","/admin/foods/delete",{id});U.toast("Makanan dihapus.");Adm.load()}catch(e){}};

/* ================= 5. Konten: pengumuman & artikel ================= */
Adm.draw.cont=()=>{const c=Adm.data.cont;if(!c)return null;const f=Adm.cf,art=f.kind==="article";
  const li=(k,x)=>`<li style="margin:8px 0"><b>${E(x.title)}</b> ${k==="announcement"?(x.active===false?'<span class="t wa">Draf</span>':'<span class="t ok">Tayang</span>'):""}<br><span class="mu">${E(x.body.slice(0,110))}${x.body.length>110?"…":""}</span><br><button onclick="Act.admCfEdit('${k}','${E(x.id)}')">Ubah</button> <button class="x" onclick="Act.admCfDel('${k}','${E(x.id)}')" aria-label="Hapus ${E(x.title)}">✕</button></li>`;
  return`<div class="c"><h2>${f.id?"Ubah konten":"Tulis konten baru"}</h2><label class="lb" for="ck">Jenis</label><select id="ck" onchange="Act.admCfKind(this.value)" ${f.id?"disabled":""}><option value="announcement" ${!art?"selected":""}>Pengumuman (kartu di halaman Ringkasan)</option><option value="article" ${art?"selected":""}>Artikel edukasi (di tab Edukasi)</option></select>
<label class="lb" for="ct">Judul</label><input id="ct" maxlength="120" value="${E(f.title||"")}"><label class="lb" for="cb">Isi</label><textarea id="cb" rows="5" maxlength="5000">${E(f.body||"")}</textarea>
${art?`<label class="lb" for="cs">Sumber (opsional)</label><input id="cs" maxlength="120" value="${E(f.src||"")}">`:`<label class="lb" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ca" ${f.active===false?"":"checked"} style="width:auto"> Tayangkan sekarang</label>`}
<div class="g" style="margin-top:12px"><button class="b" onclick="Act.admCfSave()">Simpan</button>${f.id?'<button onclick="Act.admCfEdit()">Batal</button>':""}</div></div>
<div class="c"><h2>Pengumuman (${c.announcements.length})</h2>${c.announcements.length?`<ul style="list-style:none;padding:0">${c.announcements.map(x=>li("announcement",x)).join("")}</ul>`:'<p class="mu">Belum ada.</p>'}</div>
<div class="c"><h2>Artikel edukasi tambahan (${c.articles.length})</h2>${c.articles.length?`<ul style="list-style:none;padding:0">${c.articles.map(x=>li("article",x)).join("")}</ul>`:'<p class="mu">Belum ada. Materi edukasi bawaan aplikasi tetap tampil.</p>'}</div>`};
Act.admCfKind=k=>{Adm.cf={kind:k,title:U.$("ct").value,body:U.$("cb").value};Adm.paint()};
Act.admCfEdit=(k,id)=>{if(!id){Adm.cf={kind:"announcement"}}else{const x=Adm.data.cont[k==="article"?"articles":"announcements"].find(z=>z.id===id);Adm.cf={kind:k,id,title:x.title,body:x.body,src:x.src,active:x.active}}Adm.paint();window.scrollTo(0,0)};
Act.admCfSave=async()=>{const f=Adm.cf,art=f.kind==="article";
  try{await adm("POST","/admin/content/save",{kind:f.kind,id:f.id,title:U.$("ct").value,body:U.$("cb").value,src:art?U.$("cs").value:undefined,active:art?undefined:U.$("ca").checked});U.toast("Tersimpan ✔");Adm.cf={kind:f.kind};Adm.load()}catch(e){}};
Act.admCfDel=async(k,id)=>{if(!confirm("Hapus konten ini?"))return;try{await adm("POST","/admin/content/delete",{kind:k,id});U.toast("Dihapus.");Adm.load()}catch(e){}};

/* ================= 6. Pengingat: template email & status pengiriman ================= */
const mailTable=rows=>rows.length?`<div class="ov"><table><thead><tr><th>Waktu</th><th>Ke</th><th>Subjek</th><th>Jenis</th><th>Status</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${tmf(x.t)}</td><td>${E(x.to)}</td><td>${E(x.subject)}</td><td>${E(x.kind)}</td><td>${x.ok?'<span class="t ok">Terkirim</span>':`<span class="t bad">Gagal</span><br><span class="mu">${E(x.error)}</span>`}</td></tr>`).join("")}</tbody></table></div>`:'<p class="mu">Belum ada email tercatat.</p>';
Adm.draw.mail=()=>{const s=Adm.data.set,l=Adm.data.lmail;if(!s||!l)return null;const m=s.settings.mail,r=s.reminders;
  return`<div class="c"><h2>Status pengiriman email</h2><p>${s.smtp.configured?(s.smtp.mode==="log"?'<span class="t wa">Mode uji (log)</span> email hanya dicetak di konsol server.':`<span class="t ok">SMTP aktif</span> ${E(s.smtp.host)} · ${E(s.smtp.user)}`):'<span class="t bad">SMTP belum diatur</span> isi SMTP_HOST, SMTP_USER, SMTP_PASS di environment.'}</p>
<p class="mu">7 hari terakhir: <b>${s.mail7d.ok}</b> terkirim, <b>${s.mail7d.failed}</b> gagal. ${r.emailOn} dari ${r.users} pasien mengaktifkan pengingat email.${Object.keys(r.byKey).length?" Pengingat aktif: "+Object.entries(r.byKey).map(([k,v])=>E(k)+" ("+v+")").join(", ")+".":""}</p></div>
<div class="c"><h2>Template email pengingat</h2><p class="mu">Kosongkan untuk memakai teks bawaan. Kode yang bisa dipakai: <code>{{nama}}</code> nama pasien, <code>{{judul}}</code> daftar pengingat, <code>{{jumlah}}</code> banyaknya pengingat.</p>
<label class="lb" for="ms">Subjek</label><input id="ms" maxlength="150" placeholder="Pengingat: {{judul}}" value="${E(m.subject)}" oninput="Act.admPrev()">
<label class="lb" for="mi">Kalimat pembuka</label><input id="mi" maxlength="300" placeholder="Waktunya untuk:" value="${E(m.intro)}" oninput="Act.admPrev()">
<label class="lb" for="mf">Kalimat penutup</label><input id="mf" maxlength="300" placeholder="Matikan pengingat email kapan saja di menu Pengingat." value="${E(m.footer)}" oninput="Act.admPrev()">
<div class="warn" style="border-left-color:var(--pr);background:var(--soft)" id="mprev"></div>
<div class="g"><button class="b" onclick="Act.admMailSave()">Simpan template</button><button onclick="Act.admMailTest()">Kirim email percobaan ke saya</button></div></div>
<div class="c"><h2>Email terkirim terakhir</h2>${mailTable(l.rows.slice(0,25))}</div>`};
Act.admPrev=()=>{const el=U.$("mprev");if(!el||!U.$("ms"))return;const f=(t,d)=>(t||d).replace(/\{\{nama\}\}/g,"Budi").replace(/\{\{judul\}\}/g,"Catat makanan hari ini, Minum air putih").replace(/\{\{jumlah\}\}/g,"2");
  el.innerHTML=`<b>Pratinjau</b><br>Subjek: ${E(f(U.$("ms").value,"Pengingat Gout Care (2)"))}<br>${E(f(U.$("mi").value,"Waktunya untuk:"))}<br>• Catat makanan hari ini · • Minum air putih<br><span class="mu">${E(f(U.$("mf").value,"Matikan pengingat email kapan saja di menu Pengingat."))}</span>`};
Act.admMailSave=async()=>{const s=Adm.data.set.settings;try{const r=await adm("POST","/admin/settings/save",{...s,mail:{subject:U.$("ms").value,intro:U.$("mi").value,footer:U.$("mf").value}});Adm.data.set.settings=r.settings;U.toast("Template tersimpan ✔")}catch(e){}};
Act.admMailTest=async()=>{try{await Act.admMailSave();const r=await adm("POST","/admin/settings/test-email",{});U.toast("Email percobaan dikirim ke "+E(r.to)+" ✔");Adm.get("lmail","/admin/logs?kind=mail")}catch(e){}};

/* ================= 7. Laporan & ekspor ================= */
const REP=[["pasien","Daftar pasien + ringkasan"],["asam-urat","Riwayat asam urat"],["makanan","Catatan makan"],["tensi","Tensi"],["keluhan","Keluhan"],["rekap","Rekap bulanan"],["database-makanan","Database makanan"]];
Adm.draw.rep=()=>{const s=Adm.data.stats;if(!s)return null;
  return`<div class="c noprint"><h2>Unduh data</h2><div class="r"><div><label class="lb" for="rt">Jenis laporan</label><select id="rt">${REP.map(r=>`<option value="${r[0]}">${r[1]}</option>`).join("")}</select></div><div><label class="lb" for="rf">Format</label><select id="rf"><option value="xlsx">Excel (.xlsx)</option><option value="csv">CSV</option></select></div></div>
<div class="g" style="margin-top:12px"><button class="b" onclick="Act.admExport()">⬇️ Unduh</button><button onclick="window.print()">🖨️ Cetak / simpan rekap sebagai PDF</button></div><p class="mu">Berisi data pasien (nama, email, data kesehatan). Simpan dengan aman.</p></div>
<div class="po"><h2>Rekap bulanan Gout Care</h2><p>Dicetak: ${U.today()}</p></div>
<div class="c"><h2>Rekap bulanan (12 bulan)</h2><div class="ov"><table><thead><tr><th>Bulan</th><th>Pasien aktif</th><th>Asam urat rata-rata</th><th>Purin rata-rata/hari</th><th>Keluhan</th></tr></thead><tbody>${s.monthly.slice().reverse().map(m=>`<tr><td>${U.mn(m.m)}</td><td>${m.activePatients}</td><td>${m.avgLab==null?"–":m.avgLab+" mg/dL"}</td><td>${m.avgPurin==null?"–":m.avgPurin+" mg"}</td><td>${m.complaints}</td></tr>`).join("")}</tbody></table></div></div>`};
Act.admExport=async()=>{try{const f=await Api.download(`/admin/export/file?type=${U.$("rt").value}&format=${U.$("rf").value}`);U.toast("Terunduh: "+E(f))}catch(e){U.toast("⚠️ "+E(e.message),6000)}};

/* ================= 8. Sistem: pengaturan & backup ================= */
Adm.draw.sys=()=>{const d=Adm.data.set;if(!d)return null;const s=d.settings,rg=s.allowRegister===null?"env":s.allowRegister?"1":"0";
  return`<div class="c"><h2>Pengaturan situs</h2><label class="lb" for="sn">Nama situs</label><input id="sn" maxlength="40" value="${E(s.siteName)}">
<label class="lb" for="sr">Pendaftaran akun baru</label><select id="sr"><option value="env" ${rg==="env"?"selected":""}>Ikuti environment (ALLOW_REGISTER, saat ini ${d.envRegister?"buka":"tutup"})</option><option value="1" ${rg==="1"?"selected":""}>Buka</option><option value="0" ${rg==="0"?"selected":""}>Tutup</option></select>
<div class="g" style="margin-top:12px"><button class="b" onclick="Act.admSysSave()">Simpan</button></div></div>
<div class="c"><h2>Email (SMTP)</h2><p>${d.smtp.configured?`<span class="t ok">Terhubung</span> ${E(d.smtp.host)} · ${E(d.smtp.user)}`:'<span class="t bad">Belum diatur</span>'}</p><p class="mu">Kredensial SMTP sengaja hanya dibaca dari environment server (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS), tidak disimpan di database. Ubah di .env atau di Netlify, lalu uji lewat tab Pengingat.</p></div>
${d.adminKeyExplicit?"":'<div class="c"><div class="warn"><b>ADMIN_KEY belum diatur.</b> Di lokal kata kunci bawaan masih berlaku; di produksi promosi lewat kata sandi dimatikan. Isi ADMIN_KEY dengan teks rahasia milik Anda.</div></div>'}
<div class="c"><h2>Backup data</h2><p class="mu">Unduh seluruh database (pasien, catatan, makanan, konten, pengaturan) sebagai satu file JSON. Hash kata sandi tidak ikut.</p><button class="b" onclick="Act.admBackup()">⬇️ Unduh backup JSON</button></div>`};
Act.admSysSave=async()=>{const s=Adm.data.set.settings,r=U.$("sr").value;try{const x=await adm("POST","/admin/settings/save",{...s,siteName:U.$("sn").value,allowRegister:r==="env"?null:r==="1"});Adm.data.set.settings=x.settings;Site.name=x.settings.siteName;Site.paint();U.toast("Pengaturan tersimpan ✔")}catch(e){}};
Act.admBackup=async()=>{try{U.toast("Terunduh: "+E(await Api.download("/admin/backup")))}catch(e){U.toast("⚠️ "+E(e.message),6000)}};

/* ================= 9. Log ================= */
Adm.draw.log=()=>{const d=Adm.data.log,k=Adm.logKind;
  const bar=`<div class="c noprint"><div class="g">${[["activity","Aktivitas"],["mail","Email"],["error","Error"]].map(x=>`<button class="${k===x[0]?"b":""}" onclick="Act.admLog('${x[0]}')">${x[1]}</button>`).join("")}</div></div>`;
  if(!d)return bar+'<div class="c"><p class="mu">Memuat…</p></div>';
  const rows=d.rows;let body;
  if(!rows.length)body='<p class="mu">Belum ada catatan.</p>';
  else if(k==="mail")body=mailTable(rows);
  else if(k==="error")body=`<div class="ov"><table><thead><tr><th>Waktu</th><th>Di</th><th>Pesan</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${tmf(x.t)}</td><td>${E(x.where)}</td><td>${E(x.msg)}</td></tr>`).join("")}</tbody></table></div>`;
  else body=`<div class="ov"><table><thead><tr><th>Waktu</th><th>Jenis</th><th>Keterangan</th><th>Oleh</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${tmf(x.t)}</td><td>${E(x.type)}</td><td>${E(x.text)}</td><td>${E(NV(x.by))}</td></tr>`).join("")}</tbody></table></div>`;
  return bar+`<div class="c"><h2>${{activity:"Aktivitas pengguna & admin",mail:"Email terkirim",error:"Riwayat error server"}[k]}</h2><p class="mu" style="margin-top:0">Menampilkan sampai 150 catatan terbaru.</p>${body}</div>`};
Act.admLog=k=>{Adm.logKind=k;delete Adm.data.log;Adm.paint();Adm.load()};
