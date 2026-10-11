/* ============================================================
   Store: akses data MILIK USER YANG SEDANG LOGIN saja.
   Semua baca/tulis difilter lewat userId, sehingga data antar
   akun terpisah tetapi tiap baris terhubung ke akun pemiliknya.
   ============================================================ */
const Store=(()=>{
  const uid=()=>Auth.current().id;
  const mine=t=>DB.table(t).filter(r=>r.userId===uid());
  const byDate=(a,b)=>a.d<b.d?-1:a.d>b.d?1:0;
  const owned=(t,id)=>DB.table(t).find(r=>r.id===id&&r.userId===uid());
  return{
    labs:()=>mine("labs").sort(byDate),
    addLab:(d,v)=>DB.insert("labs",{userId:uid(),d,v}),
    meals:()=>mine("meals"),
    addMeal:m=>DB.insert("meals",Object.assign({userId:uid()},m)),
    vitals:()=>mine("vitals").sort(byDate),
    addVit:(d,td,k)=>DB.insert("vitals",{userId:uid(),d,td,k}),
    reminders:()=>mine("reminders"),
    mood:d=>mine("moods").find(m=>m.d===d)||{mood:null,gejala:[]},
    setMood(d,patch){const r=mine("moods").find(m=>m.d===d);r?DB.update("moods",r.id,patch):DB.insert("moods",Object.assign({userId:uid(),d,mood:null,gejala:[]},patch))},
    update:(t,id,patch)=>{if(owned(t,id))DB.update(t,id,patch)},
    remove:(t,id)=>{if(owned(t,id))DB.remove(t,id)}
  };
})();
