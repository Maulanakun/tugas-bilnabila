/* Tab Rapor Bulanan */
function raporHTML(m){
const u=Auth.current(),meals=Store.meals(),labs=Store.labs(),LIM=u.lim,bm=U.bmi(u);
const ms=meals.filter(x=>U.ym(x.d)===m),days=[...new Set(ms.map(x=>x.d))],tot=days.map(d=>U.dayTot(meals,d)),ok=tot.filter(t=>t<=LIM).length,over=days.length-ok;
const lab=labs.filter(x=>U.ym(x.d)===m).at(-1),prev=labs.filter(x=>U.ym(x.d)<m).at(-1);
const sp=days.length?Math.round(ok/days.length*40):0;
const sl=lab?(lab.v<=6?40:lab.v<=7?25:10):0;
const sk=Math.min(days.length/20,1)*20,sc=Math.round(sp+sl+sk);
const gr=sc>=85?["A","Sangat baik","ok"]:sc>=70?["B","Baik","ok"]:sc>=55?["C","Cukup, perlu ditingkatkan","wa"]:["D","Perlu perhatian","bad"];
const by={};ms.forEach(x=>by[x.n]=(by[x.n]||0)+x.p);const top=Object.entries(by).filter(t=>(F.find(f=>f[0]==t[0])||[0,0])[1]>=50).sort((a,b)=>b[1]-a[1]).slice(0,3);
const avg=days.length?Math.round(tot.reduce((a,b)=>a+b,0)/days.length):0;
const kc=histEvents().filter(e=>e.k==="cp"&&U.ym(e.d)===m),kd=[...new Set(kc.map(e=>e.d))],kby={};kc.forEach(e=>e.g.forEach(g=>kby[g]=(kby[g]||0)+1));
const ktop=Object.entries(kby).sort((a,b)=>b[1]-a[1]),kurg=kc.some(e=>e.urgent),kel={n:kc.length,days:kd.length,by:ktop,items:kc.map(e=>({d:e.d,t:e.t,g:e.g,lain:e.lain}))};
const imp=[],good=[],edu=[];
if(over>0){imp.push(`Purin melebihi batas ${LIM} mg pada <b>${over} dari ${days.length} hari</b> tercatat. Penyumbang terbesar: <b>${top.map(t=>t[0]).join(", ")}</b>.`);edu.push(EDU[1],EDU[2])}else if(days.length)good.push("Semua hari tercatat masih dalam batas purin.");
if(!lab){imp.push("Belum ada hasil cek asam urat bulan ini. Jadwalkan pemeriksaan.")}else if(lab.v>(u.jk=="L"?7:6)){imp.push(`Kadar asam urat ${lab.v} mg/dL masih di atas batas. Konsultasikan ke dokter.`);edu.push(EDU[3])}else if(lab.v>6){imp.push(`Kadar ${lab.v} mg/dL di bawah batas, namun belum mencapai target 6 mg/dL.`)}else good.push(`Kadar asam urat ${lab.v} mg/dL mencapai target.`);
if(lab&&prev){const dl=(lab.v-prev.v).toFixed(1);dl>0?imp.push(`Kadar naik ${dl} mg/dL dibanding bulan sebelumnya (${prev.v}).`):good.push(`Kadar turun ${Math.abs(dl)} mg/dL dibanding bulan sebelumnya.`)}
if(days.length<20){imp.push(`Pencatatan baru <b>${days.length} hari</b>. Targetkan minimal 20 hari agar penilaian akurat.`)}else good.push("Pencatatan konsisten.");
if(kc.length){imp.push(`Tercatat <b>${kc.length} keluhan</b> pada <b>${kd.length} hari</b>${ktop.length?" ("+ktop.map(t=>U.esc(t[0])+" "+t[1]+"x").join(", ")+")":""}. Jika berulang atau tidak membaik, konsultasikan ke dokter.`);if(kurg){imp.push("Ada keluhan yang perlu diperiksa (demam atau 3 gejala atau lebih sekaligus). Segera hubungi tenaga kesehatan.");edu.unshift(EDU[9])}}
if(by["Kopi (1 cangkir)"]>0)edu.push(EDU[6]);
if(bm!==null&&bm>=23){imp.push(`IMT ${bm.toFixed(1)} termasuk di atas normal. Target penurunan berat badan bertahap membantu menurunkan risiko.`);edu.push(EDU[2])}
edu.push(EDU[7],EDU[5]);
const eduF=[...new Set(edu)].slice(0,3);
UI.last={m,sc,gl:gr[0],gr:gr[1],sp,sl,sk,nd:days.length,ok,avg,lab,imp,good,edu:eduF,kel};
const C=2*Math.PI*52;
return`<div class="po"><h2>Gout Care - Rapor Kesehatan ${U.mn(m)}</h2><p>Nama: ${U.esc(u.nama)} · Dicetak: ${U.today()}</p></div><div class="c"><div class="r noprint" style="align-items:center;margin-bottom:12px"><select onchange="Act.setMonth(this.value)">${U.months(meals,labs).map(x=>`<option value="${x}" ${x==m?"selected":""}>${U.mn(x)}</option>`).join("")}</select><button class="b" onclick="Act.savePDF()">Unduh PDF</button></div>
<div class="rp"><svg width="130" height="130" viewBox="0 0 130 130"><circle cx="65" cy="65" r="52" fill="none" stroke="var(--bd)" stroke-width="12"/><circle cx="65" cy="65" r="52" fill="none" stroke="var(--${gr[2]})" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C*sc/100} ${C}" transform="rotate(-90 65 65)"/><text x="65" y="62" text-anchor="middle" font-size="30" font-weight="700" fill="currentColor">${sc}</text><text x="65" y="82" text-anchor="middle" font-size="12" fill="currentColor">Nilai ${gr[0]}</text></svg>
<div style="flex:1;min-width:200px"><h2>Rapor ${U.mn(m)}</h2><span class="t ${gr[2]}">${gr[1]}</span>
<p class="mu" style="margin-top:8px">Kontrol purin (40): ${sp}</p><div class="bar"><i style="width:${sp/40*100}%"></i></div><p class="mu">Kadar asam urat (40): ${sl}</p><div class="bar"><i style="width:${sl/40*100}%"></i></div><p class="mu">Konsistensi mencatat (20): ${Math.round(sk)}</p><div class="bar"><i style="width:${sk/20*100}%"></i></div></div></div>
<p class="mu">Rata-rata purin ${avg} mg/hari · Hari aman ${ok}/${days.length} · Asam urat ${lab?lab.v+" mg/dL":"belum dicek"}</p></div>
<div class="c"><h2>Keluhan ${U.mn(m)}</h2>${kc.length?`<p>Tercatat <b>${kc.length} keluhan</b> pada <b>${kd.length} hari</b>.${ktop.length?" Paling sering: "+ktop.map(t=>"<b>"+U.esc(t[0])+"</b> ("+t[1]+"x)").join(", ")+".":""}</p>${kurg?'<div class="warn"><b>'+WARN_TXT+'</b></div>':""}<table><tr><th>Tanggal</th><th>Keluhan</th></tr>${kc.slice().sort((a,b)=>(b.d+b.t)<(a.d+a.t)?-1:1).map(e=>`<tr><td>${e.d}${e.t?"<br><span class='mu'>"+e.t+"</span>":""}</td><td>${U.esc(e.g.join(", "))||"-"}${e.lain?"<br><span class='mu'>"+U.esc(e.lain)+"</span>":""}</td></tr>`).join("")}</table>`:'<p class="mu">Belum ada keluhan tercatat bulan ini. Pilih "Ada keluhan" di bagian atas untuk mencatat keluhan.</p>'}</div>
<div class="c"><h2>Yang sudah baik</h2><ul>${good.map(x=>`<li>${x}</li>`).join("")||"<li>Belum ada data cukup.</li>"}</ul><h2 style="margin-top:12px">Yang perlu ditingkatkan bulan depan</h2><ul>${imp.map(x=>`<li>${x}</li>`).join("")||"<li>Pertahankan!</li>"}</ul></div>
<div class="c"><h2>Edukasi untuk bulan depan</h2>${eduF.map(e=>`<h3>${e[0]}</h3><div>${e[1]}</div><p class="src">Sumber: ${e[2]}</p>`).join("")}<p class="mu" style="margin-top:10px">Rapor ini alat bantu pemantauan, bukan diagnosis.</p></div>`}

Views.rapor=()=>raporHTML(UI.rm||U.today().slice(0,7));
Act.setMonth=v=>{UI.rm=v;App.render()};
