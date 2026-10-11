/* Halaman Akun (dibuka dari tombol "Akun" di atas, bukan dari tab bar) */
Views.akun=()=>{const u=Auth.current(),n=t=>DB.table(t).filter(r=>r.userId===u.id).length;
return`<div class="c"><h2>Profil</h2><p class="mu">${U.esc(u.email)} · bergabung ${new Date(u.createdAt).toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"})}</p>
<label class="lb" for="pn">Nama</label><input id="pn" value="${U.esc(u.nama)}" maxlength="60">
<label class="lb" for="pj">Jenis kelamin</label><select id="pj"><option value="L" ${u.jk=="L"?"selected":""}>Laki-laki</option><option value="P" ${u.jk=="P"?"selected":""}>Perempuan</option></select>
<button class="b" style="margin-top:8px" onclick="Act.saveProfile()">Simpan profil</button></div>
<div class="c"><h2>Ganti kata sandi</h2><input id="po" type="password" placeholder="Kata sandi lama" autocomplete="current-password"><input id="pw1" type="password" placeholder="Kata sandi baru (min. 6)" autocomplete="new-password"><input id="pw2" type="password" placeholder="Ulangi kata sandi baru" autocomplete="new-password"><button class="b" onclick="Act.changePw()">Ganti kata sandi</button></div>
<div class="c"><h2>Data & cadangan</h2><p class="mu">Data kamu: ${n("labs")} hasil cek asam urat, ${n("meals")} catatan makan, ${n("vitals")} catatan tensi. Tersimpan di server dalam format JSON. Ekspor untuk cadangan pribadi.</p>
<div class="g" style="margin-top:8px"><button onclick="Act.exportMine()">⬇️ Ekspor data saya (JSON)</button><label class="fb">⬆️ Impor JSON<input type="file" accept="application/json,.json" hidden onchange="Act.importFile(this)"></label></div>
<p class="mu" style="margin-top:8px">File ekspor berisi data kesehatanmu (tanpa kata sandi). Simpan di tempat aman.</p></div>
<div class="c"><h2>Keluar</h2><button class="b" onclick="Act.logout()">Keluar dari akun</button></div>
<div class="c"><h2>Hapus akun</h2><p class="mu">Menghapus akun beserta seluruh datanya secara permanen dari server.</p><input id="dp" type="password" placeholder="Masukkan kata sandi untuk konfirmasi" autocomplete="current-password"><button class="b bad" onclick="Act.delAccount()">Hapus akun saya</button></div>`};

Act.saveProfile=()=>{Auth.patch({nama:U.$("pn").value,jk:U.$("pj").value});U.toast("Profil disimpan ✔");App.render()};
Act.changePw=async()=>{const r=await Auth.changePassword(U.$("po").value,U.$("pw1").value,U.$("pw2").value);
  if(r.error){U.toast("⚠️ "+r.error);return}U.toast("Kata sandi diganti ✔");App.render()};
Act.exportMine=()=>{const u=Auth.current();U.download("gout-care-"+u.nama.replace(/[^\w]+/g,"-").toLowerCase()+"-"+U.today()+".json",DB.exportJSON())};
Act.importFile=async el=>{const f=el.files[0];if(!f)return;
  try{const r=DB.importJSON(await f.text());U.toast(`Impor selesai: ${r.rows} data ditambahkan.`,5000);App.render()}
  catch(e){U.toast("⚠️ "+e.message)}el.value=""};
Act.delAccount=async()=>{const pw=U.$("dp").value;if(!pw){U.toast("Masukkan kata sandi dulu.");return}
  if(!confirm("Hapus akun dan semua datanya secara permanen?"))return;
  const r=await Auth.deleteAccount(pw);if(r.error){U.toast("⚠️ "+r.error);return}UI.tab="home";UI.authMode="login";App.render()};
Act.logout=async()=>{await Auth.logout();UI.tab="home";UI.rm="";UI.authMode="login";U.$("bye").style.display="none";App.render()};
