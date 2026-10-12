/* Tab Pengingat (disimpan per user). Pengingat aktif dikirim ke email akun oleh server. */
Views.ingat=()=>{const u=Auth.current(),on=u.remEmail!==false;
return`<div class="c"><h2>Pengingat</h2><p class="mu">Aktifkan pengingat yang diinginkan lalu atur jamnya. Pengingat dikirim ke email akunmu sesuai jam waktu Jakarta (WIB).</p>
<div class="mailcard"><span class="mi" aria-hidden="true">✉️</span><div><b>Dikirim ke</b><br><span class="mu">${U.esc(u.email)}</span></div></div>
<div class="tg"><div><b>Kirim pengingat ke email</b><br><span class="mu">Matikan untuk berhenti menerima email.</span></div><input type="checkbox" aria-label="Kirim pengingat ke email" ${on?"checked":""} onchange="Act.remEmail(this.checked)"></div>
${Store.reminders().map(r=>`<div class="tg"><div><b>${U.esc(r.title)}</b><br><span class="mu">${U.esc(r.freq)}</span></div><input type="time" value="${U.esc(r.time)}" onchange="Act.remTime('${r.id}',this.value)"><input type="checkbox" ${r.on?"checked":""} aria-label="Aktifkan ${U.esc(r.title)}" onchange="Act.remOn('${r.id}',this.checked)"></div>`).join("")}
<div class="g" style="margin-top:14px"><button class="b" onclick="Act.testMail(this)">✉️ Kirim email percobaan</button><button onclick="Act.simRem()">🔔 Coba simulasi pengingat</button></div></div>`};

Act.remTime=(id,v)=>Store.update("reminders",id,{time:v});
Act.remOn=(id,on)=>Store.update("reminders",id,{on:on?1:0});
Act.remEmail=on=>{Auth.patch({remEmail:on});U.toast(on?"Pengingat email diaktifkan ✔":"Pengingat email dimatikan.")};
Act.testMail=async b=>{b.disabled=true;
  try{await DB.flushNow();const r=await Api.req("POST","/me/test-email",{});U.toast("Email percobaan dikirim ke <b>"+U.esc(r.to)+"</b>. Cek kotak masuk (atau folder spam).",6000)}
  catch(e){U.toast("⚠️ "+U.esc(e.message),6000)}
  b.disabled=false};
Act.simRem=()=>{const a=Store.reminders().filter(r=>r.on);
  U.toast(a.length?"🔔 <b>Gout Care</b>: "+a.map(r=>U.esc(r.title)+" ("+U.esc(r.time)+")").join(" · "):"Belum ada pengingat aktif.")};
