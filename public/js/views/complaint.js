/* Modal keluhan: muncul saat pilihan "Ada keluhan" ditekan atau tombol "Catat keluhan".
   Keluhan yang disimpan masuk ke tabel complaints, lalu tampil di Rapor dan Riwayat. */
const WARN_TXT="Gejala ini perlu diperiksa. Segera hubungi tenaga kesehatan.";

Act.openComplaint=()=>{
  const o=U.$("modal");
  o.innerHTML=`<div class="mo"><h2 id="mt">Ada keluhan?</h2><p class="mu">Pilih yang kamu rasakan hari ini. Bisa lebih dari satu.</p>
<div class="g" id="gj">${GEJALA.map(x=>`<button type="button" aria-pressed="false" data-g="${U.esc(x)}" onclick="Act.togGejala(this)">${U.esc(x)}</button>`).join("")}</div>
<div id="gw" class="warn" role="alert" hidden>${WARN_TXT}</div>
<label class="lb" for="gl">Keluhan lain yang dirasakan (opsional)</label>
<textarea id="gl" rows="3" maxlength="300" placeholder="Mis. nyeri di pergelangan kaki sejak semalam"></textarea>
<div class="err" id="ge" role="alert"></div>
<div class="r"><button type="button" onclick="Act.closeComplaint()">Batal</button><button type="button" class="b" onclick="Act.submitComplaint()">Simpan keluhan</button></div></div>`;
  o.style.display="flex";document.body.style.overflow="hidden";
  const f=o.querySelector("#gj button");if(f)f.focus();
};
Act.closeComplaint=()=>{const o=U.$("modal");o.style.display="none";o.innerHTML="";document.body.style.overflow=""};

const pickedG=()=>[...document.querySelectorAll("#gj button.on")].map(b=>b.dataset.g);
Act.togGejala=b=>{b.classList.toggle("on");b.setAttribute("aria-pressed",b.classList.contains("on"));
  U.$("gw").hidden=!U.urgent(pickedG());U.$("ge").textContent=""};

Act.submitComplaint=()=>{
  const g=pickedG(),lain=U.$("gl").value.trim().slice(0,300);
  if(!g.length&&!lain){U.$("ge").textContent="Pilih minimal satu keluhan atau ketik keluhanmu.";return}
  Store.addComplaint(U.today(),U.hm(),g,lain);
  if(Store.mood(U.today()).mood!==2)Store.setMood(U.today(),{mood:2});
  Act.closeComplaint();
  U.toast("Keluhan tersimpan. Tampil di Rapor dan Riwayat."+(U.urgent(g)?"<br><b>"+WARN_TXT+"</b>":""),U.urgent(g)?8000:4000);
  App.render();
};

/* Tutup dengan Escape atau klik area gelap */
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&U.$("modal").style.display==="flex")Act.closeComplaint()});
U.$("modal").addEventListener("click",e=>{if(e.target===U.$("modal"))Act.closeComplaint()});
