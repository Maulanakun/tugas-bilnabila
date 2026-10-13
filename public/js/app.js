/* App: router sederhana + render + bar bawah + modal keluar. File terakhir yang dimuat. */
let ZOOM=1;
const App={
  render(){
    const u=Auth.current(),A=U.$("auth"),P=U.$("app"),M=U.$("admin");
    if(!u){P.hidden=true;M.hidden=true;Adm.ready=false;A.hidden=false;A.innerHTML=Views.auth();return}
    A.hidden=true;
    if(u.role==="admin"){P.hidden=true;M.hidden=false;M.innerHTML=Views.admin();Theme.paint();Act.admInit();return}
    M.hidden=true;P.hidden=false;
    U.$("who").textContent=u.nama;
    U.$("hero").innerHTML=Views.hero();
    U.$("v").innerHTML=(Views[UI.tab]||Views.home)()+'<div class="noprint" style="text-align:center;margin:18px 0"><button class="b" onclick="Act.bye()">Selesai & keluar 👋</button></div>';
    App.renderTabs();
  },
  renderTabs(){
    const bar=U.$("tabin"),keep=bar.scrollLeft;
    bar.innerHTML=TABS.map(t=>`<button class="${UI.tab===t[0]?"on":""}" ${UI.tab===t[0]?'aria-current="page"':""} onclick="Act.go('${t[0]}')"><span class="ic">${t[2]}</span>${U.esc(t[1])}</button>`).join("");
    bar.style.scrollBehavior="auto";bar.scrollLeft=keep;
    const on=bar.querySelector(".on");
    if(on&&UI.centerTab){bar.style.scrollBehavior="smooth";bar.scrollLeft=on.offsetLeft-(bar.clientWidth-on.offsetWidth)/2;UI.centerTab=false}
  },
  async init(){
    const A=U.$("auth");A.hidden=false;A.innerHTML='<div class="ac"><div class="c"><p class="mu">Memuat…</p></div></div>';
    DB.onSessionLost(()=>{Api.setToken(null);DB.clear();UI.authMode="login";App.render();U.toast("Sesi berakhir, silakan masuk lagi.",6000)});
    const s=await Auth.restore();
    if(s==="offline"){A.innerHTML='<div class="ac"><div class="c"><h2>Tidak bisa terhubung</h2><p class="mu">Server tidak bisa dihubungi. Periksa koneksi internet lalu coba lagi.</p><button class="b" onclick="location.reload()">Coba lagi</button></div></div>';return}
    App.render();
    /* sinkron saat kembali ke tab ini (mis. data diubah dari HP/perangkat lain) */
    document.addEventListener("visibilitychange",async()=>{if(document.visibilityState==="visible"&&Auth.current()&&await Auth.refresh())App.render()});
  }
};

Act.go=t=>{UI.tab=t;UI.centerTab=true;window.scrollTo(0,0);App.render()};
Act.fzoom=d=>{ZOOM=d==0?1:Math.min(1.5,Math.max(.85,ZOOM+d));document.querySelector("#app .w").style.zoom=ZOOM};

/* Pesan penutup lalu keluar */
Act.bye=()=>{const u=Auth.current(),m=Store.meals(),t=U.dayTot(m,U.today()),lg=m.some(x=>x.d==U.today());
const A=lg&&t<=u.lim?["Hebat! Purinmu hari ini terkendali. Langkah kecil yang konsisten membuat sendimu makin nyaman. 💚","Kamu sudah merawat dirimu dengan baik hari ini. Teruskan ya! 🌟"]:lg?["Satu hari yang belum sempurna bukan masalah. Kamu sudah hebat karena mau mencatat, besok kesempatan baru. 🌱","Mencatat jujur itu langkah berani. Pelan-pelan, kamu pasti bisa! 💪"]:["Terima kasih sudah mampir. Mencatat satu menu saja sudah langkah baik untuk besok. 🌿","Kesehatanmu berharga. Sampai jumpa, jangan lupa minum air putih ya! 💧"];
const o=U.$("bye");o.innerHTML='<div><div style="font-size:44px">🌈</div><h2>Sampai jumpa, '+U.esc(u.nama)+'!</h2><p>'+A[new Date().getDate()%A.length]+'</p><div class="g" style="justify-content:center;margin-top:12px"><button onclick="document.getElementById(\'bye\').style.display=\'none\'">Kembali</button><button class="b" onclick="Act.logout()">Keluar</button></div></div>';o.style.display="flex"};

/* Tema terang/gelap: ikuti pengaturan perangkat, lalu pilihan pengguna disimpan di browser (opsional) */
const Theme={
  cur(){const d=document.documentElement.getAttribute("data-theme");return d||(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")},
  paint(){for(const id of ["thm","thm2"]){const b=U.$(id);if(!b)continue;const d=Theme.cur()==="dark";b.textContent=d?"☀️ Terang":"🌙 Gelap";b.setAttribute("aria-label",d?"Ganti ke mode terang":"Ganti ke mode gelap")}}
};
Act.theme=()=>{const n=Theme.cur()==="dark"?"light":"dark";document.documentElement.setAttribute("data-theme",n);try{localStorage.setItem("goutcare.theme",n)}catch(e){}Theme.paint()};
Theme.paint();

Site.wrap();
Site.init();
App.init();
