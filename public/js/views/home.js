/* Hero (sapaan + kondisi hari ini) dan tab Ringkasan */
Views.hero=()=>{const u=Auth.current(),h=new Date().getHours(),g=h<11?"Selamat pagi":h<15?"Selamat siang":h<18?"Selamat sore":"Selamat malam";
const md=Store.mood(U.today()),mood=md.mood;
const M=["Baik","Biasa","Ada keluhan"];
const tc=Store.complaints().filter(c=>c.d===U.today()),tg=[...new Set(tc.flatMap(c=>c.gejala))];
const msg=mood===0?"Senang mendengarnya. Pertahankan kebiasaan baikmu dan catat makananmu hari ini.":mood===1?"Tidak apa-apa. Istirahat cukup dan jaga makan hari ini ya.":mood===2?"Terima kasih sudah jujur. Catat keluhanmu agar masuk ke laporan dan riwayat.":"Bagaimana kondisimu hari ini?";
return`<div class="hero"><small>${new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</small><h1>${g}, ${U.esc(u.nama)}</h1><p>${msg}</p><span class="chip">${U.streak(Store.meals())} hari berturut-turut mencatat</span>
<div class="ml">Kondisi hari ini</div>
<div class="mood" role="group" aria-label="Kondisi hari ini">${M.map((m,i)=>`<button class="m${i} ${mood===i?"on":""}" aria-pressed="${mood===i}" onclick="Act.mood(${i})">${m}</button>`).join("")}</div>
${mood===2?`<div class="g" style="margin-top:12px"><button onclick="Act.openComplaint()">Catat keluhan</button></div>${tc.length?`<p style="margin-top:8px">Hari ini tercatat <b>${tc.length} keluhan</b>${tg.length?": "+U.esc(tg.join(", ")):""}. Lihat di tab Riwayat.</p>`:""}${U.urgent(tg)?`<div class="warn"><b>${WARN_TXT}</b></div>`:""}`:""}</div>`};
Views.home=()=>{const u=Auth.current(),labs=Store.labs(),meals=Store.meals(),vits=Store.vitals(),l=labs.at(-1),t=U.dayTot(meals,U.today()),v=vits.at(-1);
const empty=!labs.length&&!meals.length&&!vits.length;
return`${empty?`<div class="c"><h2>Selamat datang, ${U.esc(u.nama)}!</h2><p class="mu">Akunmu masih kosong. Mulai dengan mencatat satu hal hari ini, atau coba dulu dengan data contoh.</p><div class="g" style="margin-top:8px"><button onclick="Act.go('food')">Catat makan</button><button onclick="Act.go('lab')">Catat asam urat</button><button onclick="Act.seedDemo()">Isi data contoh</button></div></div>`:""}
<div class="c"><h2>Ringkasan hari ini</h2><div class="stats">
<div class="stat"><span class="k">Asam urat terakhir</span>${l?`<span class="v">${l.v}<small>mg/dL</small></span><span class="s"><span class="t ${U.st(l.v,u.jk)[1]}">${U.st(l.v,u.jk)[0]}</span></span>`:'<span class="v mu" style="font-size:16px;font-weight:400">belum ada data</span>'}</div>
<div class="stat"><span class="k">Purin hari ini</span><span class="v">${t}<small>mg</small></span><span class="s">dari batas ${u.lim} mg</span><div class="bar"><i class="${t>u.lim?"over":""}" style="width:${Math.min(100,t/u.lim*100)}%"></i></div></div>
<div class="stat"><span class="k">Tensi terakhir</span>${v?`<span class="v">${U.esc(v.td)}</span><span class="s">${v.d}</span>`:'<span class="v mu" style="font-size:16px;font-weight:400">belum ada data</span>'}</div>
</div></div>
<div class="c"><h2>Perkembangan asam urat</h2>${U.chart(labs)||'<p class="mu">Catat minimal 2 hasil cek asam urat untuk melihat grafik.</p>'}</div>`};

Act.mood=i=>{Store.setMood(U.today(),{mood:i});App.render();if(i===2)Act.openComplaint()};

/* Data contoh (relatif terhadap hari ini) untuk mencoba aplikasi */
Act.seedDemo=()=>{
  const now=new Date(),vals=[8.4,7.9,7.2,6.8,6.3,6.6];
  vals.forEach((v,i)=>Store.addLab(U.iso(new Date(now.getFullYear(),now.getMonth()-(5-i),Math.min(now.getDate(),28))),v));
  const L=[["Tempe",80],["Dada ayam",100],["Tahu",100],["Ikan lele",100],["Ampela",100],["Bayam",100]];
  for(let i=1;i<=10;i++){const dt=new Date();dt.setDate(dt.getDate()-(10-i));const d=U.iso(dt),add=m=>Store.addMeal(m);
    add(U.meal(d,"Sarapan","Nasi putih",150));add(U.meal(d,"Sarapan","Telur",60));add(U.meal(d,"Makan siang","Nasi putih",150));add(U.meal(d,"Makan siang",...L[i%6]));
    add(i%3==0?U.meal(d,"Makan malam","Hati/ati ayam",100):U.meal(d,"Makan malam","Kangkung",100));
    if(i%2)add(U.meal(d,"Camilan","Kopi (1 cangkir)",150))}
  const d1=new Date(),d2=new Date();d1.setDate(d1.getDate()-6);d2.setDate(d2.getDate()-2);
  Store.addVit(U.iso(d1),"130/85","Nyeri ringan di jempol kaki");Store.addVit(U.iso(d2),"125/80","");
  U.toast("Data contoh ditambahkan ke akunmu");App.render();
};
