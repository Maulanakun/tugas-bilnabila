/* Tab Riwayat: seluruh catatan (keluhan, tensi, asam urat, makan & minum, perasaan) dijadikan satu, dikelompokkan per tanggal */
const HK=[["all","Semua"],["cp","Keluhan"],["vit","Tensi"],["lab","Asam urat"],["meal","Makan & minum"],["mood","Perasaan"]];
const MOODN=["Baik","Biasa","Ada keluhan"];

/* Kumpulkan semua catatan milik user menjadi satu daftar: {d,k,o,id?,t?,ic,h,s,x} (x = tabel untuk tombol hapus) */
function histEvents(){
  const u=Auth.current(),E=[],cps=Store.complaints(),cpDays=new Set(cps.map(c=>c.d));
  cps.forEach(c=>{const gs=c.gejala.join(", ");
    E.push({d:c.d,k:"cp",o:0,id:c.id,x:"complaints",ic:ICON("alert"),h:"Keluhan"+(gs?": "+U.esc(gs):""),s:c.t+(c.lain?" · "+U.esc(c.lain):""),urgent:U.urgent(c.gejala),g:c.gejala,lain:c.lain,t:c.t})});
  Store.moods().forEach(m=>{
    if(m.mood===2){
      if(cpDays.has(m.d))return;
      if(m.gejala&&m.gejala.length){E.push({d:m.d,k:"cp",o:0,ic:ICON("alert"),h:"Keluhan: "+U.esc(m.gejala.join(", ")),s:"Dari catatan lama",urgent:U.urgent(m.gejala),g:m.gejala,lain:"",t:""});return}
    }
    if(m.mood!==null&&m.mood!==undefined)E.push({d:m.d,k:"mood",o:4,ic:ICON("user"),h:"Perasaan: "+(MOODN[m.mood]||"-"),s:m.mood===2?"Keluhan belum dirinci":""})});
  Store.vitals().forEach(v=>E.push({d:v.d,k:"vit",o:1,id:v.id,x:"vitals",ic:ICON("pulse"),h:"Tensi "+U.esc(v.td),s:v.k?"Keluhan: "+U.esc(v.k):""}));
  Store.labs().forEach(l=>{const st=U.st(l.v,u.jk);E.push({d:l.d,k:"lab",o:2,id:l.id,x:"labs",ic:ICON("drop"),h:`Asam urat ${l.v} mg/dL <span class="t ${st[1]}">${st[0]}</span>`,s:""})});
  Store.meals().forEach(m=>E.push({d:m.d,k:"meal",o:3,id:m.id,x:"meals",ic:m.w==="Minum"||/\b(air putih|teh|kopi|susu|jus|sirup|bir|minuman)\b/i.test(m.n)?ICON("cup"):ICON("food"),h:U.esc(m.n)+" ("+m.g+" g)",s:U.esc(m.w)+" · "+m.p+" mg purin"}));
  return E;
}

Views.riwayat=()=>{
  const u=Auth.current(),all=histEvents(),meals=Store.meals(),f=UI.hf,list=f==="all"?all:all.filter(e=>e.k===f);
  const cnt=k=>k==="all"?all.length:all.filter(e=>e.k===k).length;
  const chips=`<div class="fl noprint" role="group" aria-label="Saring riwayat">${HK.map(h=>`<button class="${f===h[0]?"on":""}" aria-pressed="${f===h[0]}" onclick="Act.hf('${h[0]}')">${h[1]} (${cnt(h[0])})</button>`).join("")}</div>`;
  const head=`<div class="c"><h2>Riwayat</h2><p class="mu">Semua catatanmu dalam satu tempat: keluhan, tensi, asam urat, makan &amp; minum, dan perasaan.</p>${chips}</div>`;
  if(!list.length)return head+`<div class="c"><p class="mu">${all.length?"Tidak ada catatan untuk pilihan ini.":"Belum ada riwayat. Catatan yang kamu simpan di aplikasi akan muncul di sini."}</p></div>`;
  const days=[...new Set(list.map(e=>e.d))].sort().reverse(),shown=days.slice(0,UI.hn);
  const body=shown.map(d=>{
    const ev=list.filter(e=>e.d===d).sort((a,b)=>a.o-b.o||(a.s<b.s?-1:a.s>b.s?1:0)),hasM=ev.some(e=>e.k==="meal"),t=U.dayTot(meals,d),nc=ev.filter(e=>e.k==="cp").length;
    return`<div class="c"><div class="hh"><h2>${U.longDate(d)}</h2><span>${nc?`<span class="t bad">${nc} keluhan</span> `:""}${hasM&&f!=="cp"?`<span class="t ${t>u.lim?"bad":t>u.lim*0.75?"wa":"ok"}">${t} mg purin</span>`:""}</span></div>${ev.map(e=>`<div class="hi"><span class="ic" aria-hidden="true">${e.ic}</span><div class="bd">${e.h}${e.s?`<small>${e.s}</small>`:""}${e.urgent?'<small style="color:var(--bad)"><b>Perlu diperiksa tenaga kesehatan</b></small>':""}</div>${e.x?`<button class="x noprint" title="Hapus" aria-label="Hapus catatan" onclick="Act.del('${e.x}','${e.id}')">Hapus</button>`:""}</div>`).join("")}</div>`}).join("");
  const more=days.length>shown.length?`<div style="text-align:center" class="noprint"><button class="b" onclick="Act.hmore()">Tampilkan lebih lama (${days.length-shown.length} hari lagi)</button></div>`:"";
  return head+body+more;
};
Act.hf=k=>{UI.hf=k;UI.hn=14;App.render()};
Act.hmore=()=>{UI.hn+=14;App.render()};
