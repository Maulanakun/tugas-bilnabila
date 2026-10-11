/* Layar Masuk / Daftar */
Views.auth=()=>{const reg=UI.authMode==="register";
return`<div class="ac"><div class="ah"><h1>🩺 Gout Care</h1><p>Pantau asam urat, makanan, dan kesehatanmu setiap hari.</p></div>
<div class="c"><div class="seg"><button class="${reg?"":"on"}" onclick="Act.authMode('login')">Masuk</button><button class="${reg?"on":""}" onclick="Act.authMode('register')">Daftar</button></div>
${reg?`<form onsubmit="Act.doRegister(event)" autocomplete="on">
<label class="lb" for="rn">Nama</label><input id="rn" name="nama" autocomplete="name" required maxlength="60">
<label class="lb" for="re">Email</label><input id="re" name="email" type="email" autocomplete="email" required>
<label class="lb" for="rp">Kata sandi (min. 6 karakter)</label><input id="rp" name="password" type="password" autocomplete="new-password" required minlength="6">
<label class="lb" for="rc">Ulangi kata sandi</label><input id="rc" name="confirm" type="password" autocomplete="new-password" required>
<div class="r"><div><label class="lb" for="rj">Jenis kelamin</label><select id="rj" name="jk"><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></div>
<div><label class="lb" for="rb">Berat (kg)</label><input id="rb" name="bb" type="number" step="0.1" placeholder="opsional"></div>
<div><label class="lb" for="rt">Tinggi (cm)</label><input id="rt" name="tb" type="number" placeholder="opsional"></div></div>
<div class="err" id="aerr" role="alert"></div><button class="b full" type="submit">Buat akun</button></form>`
:`<form onsubmit="Act.doLogin(event)" autocomplete="on">
<label class="lb" for="le">Email</label><input id="le" name="email" type="email" autocomplete="email" required>
<label class="lb" for="lp">Kata sandi</label><input id="lp" name="password" type="password" autocomplete="current-password" required>
<div class="err" id="aerr" role="alert"></div><button class="b full" type="submit">Masuk</button></form>`}
<p class="mu" style="margin-top:12px">Data kamu tersimpan aman di server dan bisa dibuka dari perangkat mana pun setelah masuk.</p></div></div>`};

Act.authMode=m=>{UI.authMode=m;App.render()};
Act.doLogin=async e=>{e.preventDefault();const f=e.target,r=await Auth.login(f.email.value,f.password.value);
  if(r.error){U.$("aerr").textContent=r.error;return}UI.tab="home";UI.rm="";App.render()};
Act.doRegister=async e=>{e.preventDefault();const f=e.target;
  const r=await Auth.register({nama:f.nama.value,email:f.email.value,password:f.password.value,confirm:f.confirm.value,jk:f.jk.value,bb:f.bb.value,tb:f.tb.value});
  if(r.error){U.$("aerr").textContent=r.error;return}UI.tab="home";UI.rm="";App.render()};
