/* Klien API: bicara ke server (/api/*). Token login disimpan di localStorage browser. */
const Api=(()=>{
  const TK="goutcare.token";
  let token=null;try{token=localStorage.getItem(TK)}catch(e){}
  const setToken=t=>{token=t;try{t?localStorage.setItem(TK,t):localStorage.removeItem(TK)}catch(e){}};
  async function req(method,path,body){
    let r;
    try{
      r=await fetch("/api"+path,{method,headers:Object.assign(body!==undefined?{"Content-Type":"application/json"}:{},token?{Authorization:"Bearer "+token}:{}),body:body!==undefined?JSON.stringify(body):undefined});
    }catch(e){const x=new Error("Tidak bisa terhubung. Periksa koneksi internetmu.");x.network=true;throw x}
    let data=null;try{data=await r.json()}catch(e){}
    if(!r.ok){const x=new Error((data&&data.error)||"Terjadi gangguan. Coba lagi sebentar lagi.");x.status=r.status;throw x}
    return data;
  }
  /* Unduh file dari endpoint ber-token (CSV/XLSX/JSON): ambil sebagai blob lalu picu penyimpanan */
  async function download(path,fallback){
    let r;try{r=await fetch("/api"+path,{headers:token?{Authorization:"Bearer "+token}:{}})}catch(e){throw new Error("Tidak bisa terhubung. Periksa koneksi internetmu.")}
    if(!r.ok){let m="Gagal mengunduh file. Coba lagi.";try{m=(await r.json()).error||m}catch(e){}throw new Error(m)}
    const cd=r.headers.get("content-disposition")||"",nm=(/filename="([^"]+)"/.exec(cd)||[])[1]||fallback||"unduhan";
    const a=document.createElement("a");a.href=URL.createObjectURL(await r.blob());a.download=nm;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    return nm;
  }
  return{req,download,setToken,hasToken:()=>!!token};
})();
