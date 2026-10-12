/* ============================================================
   DB: salinan data user yang sedang login + sinkron ke server.
   - Data asli ada di server (file JSON lokal atau Netlify Blobs).
   - Di sini hanya data MILIK user yang login (server tidak mengirim data user lain).
   - Setiap insert/update/remove langsung tampil di layar, lalu dikirim ke
     server di latar belakang (antrian + coba ulang bila gagal).
   Tabel (baris terhubung ke akun lewat userId):
     labs {id,userId,d,v}   meals {id,userId,d,w,n,g,p}   vitals {id,userId,d,td,k}
     reminders {id,userId,key,title,freq,time,on}          moods {id,userId,d,mood,gejala[]}
     complaints {id,userId,d,t,gejala[],lain}
   ============================================================ */
const DB=(()=>{
  const TABLES=["labs","meals","vitals","reminders","moods","complaints"];
  const blank=()=>{const d={};TABLES.forEach(t=>d[t]=[]);return d};
  let user=null,data=blank(),queue=[],busy=false,timer=null,retry=0,failed=false,lostFn=null;
  const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,9);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function load(res){user=res.user;data=blank();TABLES.forEach(t=>{if(Array.isArray(res.data[t]))data[t]=res.data[t]})}
  function clear(){user=null;data=blank();queue=[];clearTimeout(timer);busy=false;retry=0;failed=false}
  const schedule=ms=>{clearTimeout(timer);timer=setTimeout(flush,ms)};
  const push=op=>{queue.push(op);schedule(250)};

  async function flush(){
    if(busy||!queue.length)return;
    busy=true;const batch=queue.slice(0,500);
    try{
      const r=await Api.req("POST","/me/ops",{ops:batch});
      queue.splice(0,batch.length);retry=0;
      if(r.rejected&&r.rejected.length)U.toast("⚠️ "+r.rejected.length+" perubahan ditolak server ("+r.rejected[0].error+").",7000);
      else if(failed){failed=false;U.toast("Tersambung lagi, data sudah tersimpan ✔")}
    }catch(e){
      if(e.status===401){busy=false;if(lostFn)lostFn();return}
      if(e.status&&e.status<500){queue.splice(0,batch.length);U.toast("⚠️ Server menolak data: "+e.message,7000)}
      else{retry++;failed=true;busy=false;U.toast("⚠️ Belum tersimpan ke server, mencoba lagi…",3000);schedule(Math.min(30000,2000*retry));return}
    }
    busy=false;if(queue.length)schedule(0);
  }
  /* Tunggu antrian kosong (dipakai sebelum keluar akun) */
  async function flushNow(){clearTimeout(timer);for(let i=0;i<20&&(queue.length||busy);i++){busy?await sleep(150):await flush()}return !queue.length}

  window.addEventListener("beforeunload",e=>{if(queue.length||busy){e.preventDefault();e.returnValue=""}});

  function exportJSON(){
    const out={app:"gout-care",version:2,exportedAt:new Date().toISOString(),user:{id:user.id,nama:user.nama,email:user.email,jk:user.jk,bb:user.bb,tb:user.tb,lim:user.lim,createdAt:user.createdAt}};
    TABLES.forEach(t=>out[t]=data[t]);return JSON.stringify(out,null,2);
  }
  /* Impor ke akun yang sedang login. Baris dengan id yang sama dilewati. Format lama (users[]) juga dibaca. */
  function importJSON(text){
    let p;try{p=JSON.parse(text)}catch(e){throw new Error("File bukan JSON yang valid.")}
    if(!p||p.app!=="gout-care")throw new Error("Bukan file cadangan Gout Care.");
    let n=0;
    TABLES.forEach(t=>(Array.isArray(p[t])?p[t]:[]).forEach(r=>{
      if(!r||typeof r.id!=="string"||data[t].some(x=>x.id===r.id))return;
      if(t==="reminders"&&data[t].some(x=>x.key===r.key))return;
      if(t==="moods"&&data[t].some(x=>x.d===r.d))return;
      const row=Object.assign({},r,{userId:user.id});
      data[t].push(row);push({op:"insert",t,row});n++;
    }));
    return{rows:n};
  }

  return{
    TABLES,uid,load,clear,exportJSON,importJSON,flushNow,
    onSessionLost(fn){lostFn=fn},
    get user(){return user},
    pending:()=>queue.length+(busy?1:0),
    table:t=>data[t],
    insert(t,row){row=Object.assign({id:uid()},row);data[t].push(row);push({op:"insert",t,row});return row},
    update(t,id,patch){const r=data[t].find(x=>x.id===id);if(r){Object.assign(r,patch);push({op:"update",t,id,patch})}return r},
    remove(t,id){data[t]=data[t].filter(x=>x.id!==id);push({op:"remove",t,id})},
    profile(patch){Object.assign(user,patch);push({op:"profile",patch})}
  };
})();
