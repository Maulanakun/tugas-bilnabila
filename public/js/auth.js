/* ============================================================
   Auth: daftar, masuk, keluar, ganti sandi, hapus akun.
   Semua lewat server. Sandi di-hash di server (scrypt) dan tidak pernah
   disimpan di browser. Browser hanya menyimpan token login.
   ============================================================ */
const Auth=(()=>{
  const current=()=>DB.user;

  async function register(f){
    const nama=(f.nama||"").trim(),email=(f.email||"").trim().toLowerCase();
    if(nama.length<2)return{error:"Nama minimal 2 karakter."};
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return{error:"Format email tidak valid."};
    if((f.password||"").length<6)return{error:"Kata sandi minimal 6 karakter."};
    if(f.password!==f.confirm)return{error:"Konfirmasi kata sandi tidak sama."};
    try{
      const r=await Api.req("POST","/register",{nama,email,password:f.password,jk:f.jk,bb:f.bb,tb:f.tb});
      Api.setToken(r.token);DB.load(r);
      DEF_REM.forEach(x=>DB.insert("reminders",{userId:r.user.id,key:x[0],title:x[1],freq:x[2],time:x[3],on:x[4]}));
      return{ok:true};
    }catch(e){return{error:e.message}}
  }
  async function login(email,pw){
    try{
      const r=await Api.req("POST","/login",{email:(email||"").trim().toLowerCase(),password:pw||""});
      Api.setToken(r.token);DB.load(r);return{ok:true};
    }catch(e){return{error:e.message}}
  }
  /* Dipanggil saat aplikasi dibuka: pulihkan sesi dari token. Hasil: ok | none | offline */
  async function restore(){
    if(!Api.hasToken())return"none";
    try{DB.load(await Api.req("GET","/me"));return"ok"}
    catch(e){if(e.status===401){Api.setToken(null);return"none"}return"offline"}
  }
  /* Ambil ulang data dari server (sinkron antar perangkat). true bila ada perubahan. */
  async function refresh(){
    if(!DB.user||DB.pending())return false;
    try{const r=await Api.req("GET","/me"),sig=JSON.stringify(DB.user)+JSON.stringify(DB.TABLES.map(t=>DB.table(t)));
      if(DB.pending())return false;DB.load(r);return sig!==JSON.stringify(DB.user)+JSON.stringify(DB.TABLES.map(t=>DB.table(t)))}
    catch(e){return false}
  }
  async function logout(){
    const ok=await DB.flushNow();
    if(!ok)U.toast("⚠️ Beberapa data terakhir belum sempat tersimpan ke server.",6000);
    Api.setToken(null);DB.clear();
  }
  async function changePassword(oldPw,newPw,confirm){
    if(!current())return{error:"Belum masuk."};
    if(newPw.length<6)return{error:"Kata sandi baru minimal 6 karakter."};
    if(newPw!==confirm)return{error:"Konfirmasi kata sandi tidak sama."};
    try{const r=await Api.req("POST","/me/password",{oldPassword:oldPw,newPassword:newPw});Api.setToken(r.token);return{ok:true}}
    catch(e){return{error:e.message}}
  }
  async function deleteAccount(pw){
    if(!current())return{error:"Belum masuk."};
    try{await DB.flushNow();await Api.req("POST","/me/delete",{password:pw});Api.setToken(null);DB.clear();return{ok:true}}
    catch(e){return{error:e.message}}
  }
  /* Hanya kolom profil yang boleh diubah (server memeriksa ulang) */
  function patch(p){
    const u=current();if(!u)return;const ok={};
    if(p.nama!==undefined){const n=String(p.nama).trim().slice(0,60);ok.nama=n.length>=2?n:u.nama}
    if(p.jk==="L"||p.jk==="P")ok.jk=p.jk;
    if(p.bb!==undefined)ok.bb=p.bb;
    if(p.tb!==undefined)ok.tb=p.tb;
    if(p.lim===150||p.lim===400)ok.lim=p.lim;
    if(typeof p.remEmail==="boolean")ok.remEmail=p.remEmail;
    DB.profile(ok);
  }
  return{current,register,login,restore,refresh,logout,changePassword,deleteAccount,patch};
})();
