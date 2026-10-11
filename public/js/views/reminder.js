/* Tab Pengingat (disimpan per user) */
Views.ingat=()=>`<div class="c"><h2>Pengingat</h2><p class="mu">Aktifkan pengingat yang diinginkan. Di produk final, pengingat dikirim lewat notifikasi atau WhatsApp.</p>${Store.reminders().map(r=>`<div class="tg"><div><b>${U.esc(r.title)}</b><br><span class="mu">${U.esc(r.freq)}</span></div><input type="time" value="${U.esc(r.time)}" onchange="Act.remTime('${r.id}',this.value)"><input type="checkbox" ${r.on?"checked":""} onchange="Act.remOn('${r.id}',this.checked)"></div>`).join("")}<button class="b" style="margin-top:10px" onclick="Act.simRem()">🔔 Coba simulasi pengingat</button></div>`;

Act.remTime=(id,v)=>Store.update("reminders",id,{time:v});
Act.remOn=(id,on)=>Store.update("reminders",id,{on:on?1:0});
Act.simRem=()=>{const a=Store.reminders().filter(r=>r.on);
  U.toast(a.length?"🔔 <b>Gout Care</b>: "+a.map(r=>U.esc(r.title)+" ("+U.esc(r.time)+")").join(" · "):"Belum ada pengingat aktif.")};
