/* Hero (sapaan + mood) dan tab Ringkasan */
Views.hero=()=>{const u=Auth.current(),h=new Date().getHours(),g=h<11?"Selamat pagi":h<15?"Selamat siang":h<18?"Selamat sore":"Selamat malam";
const md=Store.mood(U.today()),mood=md.mood,gej=md.gejala||[];
const M=[["😊","Baik"],["😐","Biasa"],["😣","Ada keluhan"]];
const msg=mood===0?"Senang mendengarnya! Pertahankan minum air putih dan catat makananmu hari ini.":mood===1?"Tidak apa-apa. Istirahat cukup dan jaga makan hari ini ya.":mood===2?"Terima kasih sudah jujur. Pilih keluhan di bawah agar tercatat.":"Bagaimana kabarmu hari ini?";
return`<div class="hero"><small>${new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</small><h1>${g}, ${U.esc(u.nama)} <span class="wave">👋</span></h1><p>${msg}</p><span class="chip">🔥 ${U.streak(Store.meals())} hari berturut-turut mencatat</span><span class="chip">🩺 Gout Care</span>
<div class="mood">${M.map((m,i)=>`<button class="${mood===i?"on":""}" onclick="Act.mood(${i})"><span>${m[0]}</span>${m[1]}</button>`).join("")}</div>
${mood===2?`<div class="g" style="margin-top:12px">${["Nyeri sendi","Bengkak","Kemerahan","Sulit berjalan","Demam"].map(x=>`<button style="background:rgba(255,255,255,.92);color:#18272a;${gej.includes(x)?"outline:3px solid #fde047":""}" onclick="Act.gejala('${x}')">${x}</button>`).join("")}</div>${gej.includes("Demam")||gej.length>=3?'<p style="margin-top:8px"><b>⚠️ Gejala ini perlu diperiksa. Segera hubungi tenaga kesehatan.</b></p>':""}`:""}</div>`};

Views.home=()=>{const u=Auth.current(),labs=Store.labs(),meals=Store.meals(),vits=Store.vitals(),l=labs.at(-1),t=U.dayTot(meals,U.today()),v=vits.at(-1);
const empty=!labs.length&&!meals.length&&!vits.length;
return`${empty?`<div class="c"><h2>Selamat datang, ${U.esc(u.nama)}! 🌱</h2><p class="mu">Akunmu masih kosong. Mulai dengan mencatat satu hal hari ini, atau coba dulu dengan data contoh.</p><div class="g" style="margin-top:8px"><button onclick="Act.go('food')">🍽️ Catat makan</button><button onclick="Act.go('lab')">🧪 Catat asam urat</button><button onclick="Act.seedDemo()">✨ Isi data contoh</button></div></div>`:""}
<div class="c"><h2>Ringkasan hari ini</h2><p>Asam urat terakhir: ${l?`<b>${l.v} mg/dL</b> <span class="t ${U.st(l.v,u.jk)[1]}">${U.st(l.v,u.jk)[0]}</span>`:'<span class="mu">belum ada data</span>'}</p><p>Purin hari ini: <b>${t} mg</b> dari batas ${u.lim} mg</p><p>Tensi terakhir: ${v?`<b>${U.esc(v.td)}</b> (${v.d})`:'<span class="mu">belum ada data</span>'}</p></div>
<div class="c"><h2>Perkembangan asam urat</h2>${U.chart(labs)||'<p class="mu">Catat minimal 2 hasil cek asam urat untuk melihat grafik.</p>'}</div>`};

Act.mood=i=>{Store.setMood(U.today(),{mood:i});App.render()};
Act.gejala=g=>{const a=[...(Store.mood(U.today()).gejala||[])],i=a.indexOf(g);i<0?a.push(g):a.splice(i,1);Store.setMood(U.today(),{gejala:a});App.render()};

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
  U.toast("Data contoh ditambahkan ke akunmu ✨");App.render();
};
