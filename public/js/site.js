/* Site: data global dari server yang dikelola admin.
   - nama situs (publik)
   - database makanan: mengganti isi F (data.js tetap sebagai cadangan bila server gagal)
   - pengumuman (kartu di Ringkasan) dan artikel edukasi tambahan (di tab Edukasi) */
const Site={
  name:"Gout Care",articles:[],news:[],uid:null,
  async init(){try{const c=await Api.req("GET","/config");if(c.siteName)Site.name=c.siteName}catch(e){}Site.paint()},
  paint(){document.title=Site.name;document.querySelectorAll(".sn").forEach(e=>{e.textContent=Site.name})},
  /* Dipanggil sekali per login (user biasa): ambil makanan + konten terbaru */
  async loadUser(){
    try{const f=await Api.req("GET","/foods");if(Array.isArray(f.foods)&&f.foods.length){F.length=0;F.push(...f.foods)}}catch(e){}
    try{const c=await Api.req("GET","/content");Site.articles=c.articles||[];Site.news=c.announcements||[]}catch(e){}
    return true;
  },
  txt:s=>U.esc(s).replace(/\n/g,"<br>"),
  newsHTML:()=>Site.news.map(n=>`<div class="c" style="border-left:5px solid var(--pr)"><h3 style="margin:0 0 4px">📢 ${U.esc(n.title)}</h3><p style="margin:0">${Site.txt(n.body)}</p></div>`).join(""),
  articlesHTML:()=>Site.articles.length?`<div class="c"><h2>Artikel tambahan</h2>${Site.articles.map(a=>`<details><summary>${U.esc(a.title)}</summary><p>${Site.txt(a.body)}</p>${a.src?`<p class="src">Sumber: ${U.esc(a.src)}</p>`:""}</details>`).join("")}</div>`:"",
  /* Pasang pengait tanpa mengubah file tampilan lain */
  wrap(){
    const home=Views.home,edu=Views.edu,render=App.render;
    Views.home=()=>Site.newsHTML()+home();
    Views.edu=()=>edu()+Site.articlesHTML();
    App.render=function(){
      const u=Auth.current();
      if(!u)Site.uid=null;
      else if(u.role!=="admin"&&Site.uid!==u.id){Site.uid=u.id;Site.loadUser().then(()=>{if(Auth.current()&&Auth.current().id===u.id)render.call(App)})}
      render.call(App);Site.paint();
    };
  }
};
