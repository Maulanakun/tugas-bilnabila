/* Tab Cek Asam Urat */
Views.lab=()=>{const u=Auth.current(),labs=Store.labs();
return`<div class="c"><h2>Perkembangan bulanan</h2>${U.chart(labs)||'<p class="mu">Catat minimal 2 hasil cek untuk melihat grafik.</p>'}</div><div class="c"><h2>Tambah hasil cek</h2><div class="r"><input id="ld" type="date" value="${U.today()}"><input id="lv" type="number" step="0.1" placeholder="mg/dL"></div><button class="b" onclick="Act.addLab()">Simpan</button></div>
<div class="c">${labs.length?`<table><tr><th>Tanggal</th><th>Hasil</th><th>Status</th><th></th></tr>${labs.map(x=>`<tr><td>${x.d}</td><td>${x.v}</td><td><span class="t ${U.st(x.v,u.jk)[1]}">${U.st(x.v,u.jk)[0]}</span></td><td><button class="x noprint" title="Hapus" onclick="Act.del('labs','${x.id}')">✕</button></td></tr>`).join("")}</table>`:'<p class="mu">Belum ada hasil cek.</p>'}</div>`};

Act.addLab=()=>{const d=U.$("ld").value,v=parseFloat(U.$("lv").value);
  if(!d||!(v>0&&v<30)){U.toast("Isi tanggal dan hasil yang valid (mg/dL).");return}
  Store.addLab(d,v);App.render()};
