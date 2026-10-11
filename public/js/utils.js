/* Helper umum + state UI sementara (tidak disimpan) */
const UI={tab:"home",rm:"",last:null,authMode:"login"};
const Views={};   // setiap file di js/views/ mengisi objek ini
const Act={};     // semua aksi tombol (onclick) dikumpulkan di sini

const U={
  $:id=>document.getElementById(id),
  pad:n=>String(n).padStart(2,"0"),
  /* Tanggal LOKAL (bukan UTC) supaya "hari ini" benar di WIB */
  iso(d){return d.getFullYear()+"-"+U.pad(d.getMonth()+1)+"-"+U.pad(d.getDate())},
  today(){return U.iso(new Date())},
  esc(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))},
  ym:d=>d.slice(0,7),
  mn:m=>new Date(m+"-01T12:00:00").toLocaleDateString("id-ID",{month:"long",year:"numeric"}),
  st(v,jk){const l=jk==="L"?7:6;return v>l?["Tinggi","bad"]:v>l-1?["Batas atas","wa"]:["Normal","ok"]},
  dayTot(meals,d){return meals.filter(m=>m.d===d).reduce((a,m)=>a+m.p,0)},
  streak(meals){const s=new Set(meals.map(m=>m.d));let dt=new Date();dt.setHours(12);if(!s.has(U.iso(dt)))dt.setDate(dt.getDate()-1);let n=0;while(s.has(U.iso(dt))){n++;dt.setDate(dt.getDate()-1)}return n},
  bmi(u){return u.bb&&u.tb?u.bb/((u.tb/100)**2):null},
  meal(d,w,n,g){return{d,w,n,g,p:Math.round(F.find(x=>x[0]===n)[1]*g/100)}},
  months(meals,labs){return[...new Set([...meals.map(x=>x.d.slice(0,7)),...labs.map(x=>x.d.slice(0,7)),U.today().slice(0,7)])].sort().reverse()},
  toast(html,ms=4000){const t=U.$("toast");t.innerHTML=html;t.style.display="block";clearTimeout(U._t);U._t=setTimeout(()=>t.style.display="none",ms)},
  download(name,text){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"application/json"}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)},
  chart(L){if(L.length<2)return"";const W=600,H=190,mx=Math.max(...L.map(x=>x.v),8)+1,mi=Math.min(...L.map(x=>x.v),5)-1;const X=i=>40+i*(W-70)/(L.length-1),Y=v=>H-28-(v-mi)/(mx-mi)*(H-50);
    return`<div class="ov"><svg viewBox="0 0 ${W} ${H}" width="100%"><line x1="40" x2="${W-20}" y1="${Y(6)}" y2="${Y(6)}" stroke="#0f766e" stroke-dasharray="4"/><text x="${W-20}" y="${Y(6)-4}" font-size="11" text-anchor="end" fill="#0f766e">target 6</text><polyline fill="none" stroke="#b91c1c" stroke-width="2.5" points="${L.map((x,i)=>X(i)+","+Y(x.v)).join(" ")}"/>${L.map((x,i)=>`<circle cx="${X(i)}" cy="${Y(x.v)}" r="4" fill="#b91c1c"/><text x="${X(i)}" y="${Y(x.v)-9}" font-size="11" text-anchor="middle" fill="currentColor">${x.v}</text><text x="${X(i)}" y="${H-8}" font-size="11" text-anchor="middle" fill="currentColor">${U.mn(U.ym(x.d)).split(" ")[0].slice(0,3)}</text>`).join("")}</svg></div>`}
};
