/* Tab Tensi & Keluhan */
Views.vit=()=>{const v=Store.vitals();
return`<div class="c"><h2>Catat tensi & keluhan</h2><input id="vd" type="date" value="${U.today()}"><input id="td" placeholder="Tensi (mis. 120/80)"><textarea id="kk" rows="2" placeholder="Keluhan"></textarea><button class="b" onclick="Act.addVit()">Simpan</button></div><div class="c">${v.length?`<table><tr><th>Tanggal</th><th>Tensi</th><th>Keluhan</th><th></th></tr>${v.map(x=>`<tr><td>${x.d}</td><td>${U.esc(x.td)}</td><td>${U.esc(x.k)||"-"}</td><td><button class="x noprint" title="Hapus" onclick="Act.del('vitals','${x.id}')">✕</button></td></tr>`).join("")}</table>`:'<p class="mu">Belum ada catatan tensi.</p>'}</div>`};

Act.addVit=()=>{const td=U.$("td").value.trim(),d=U.$("vd").value||U.today();
  if(!td){U.toast("Isi tensi, mis. 120/80.");return}
  Store.addVit(d,td.slice(0,20),U.$("kk").value.trim().slice(0,300));App.render()};
