/* Tab IMT & Berat. Klasifikasi: Kemenkes RI (2025), Pedoman Nasional Pelayanan Klinis Tata Laksana Obesitas Dewasa */
const IMTK=[["Berat badan kurang (Underweight)","IMT < 18,5 kg/m²","Risiko rendah","wa"],["Normal","IMT 18,5–22,9 kg/m²","Risiko rata-rata","ok"],["Berat badan lebih (Overweight)","IMT 23–24,9 kg/m²","Risiko meningkat","wa"],["Obesitas I","IMT 25–29,9 kg/m²","Risiko sedang","bad"],["Obesitas II","IMT ≥ 30 kg/m²","Risiko berat","bad"]];
const IMTM=["IMT Anda berada di bawah rentang normal. Kondisi ini perlu diperhatikan karena dapat berkaitan dengan kekurangan gizi.","Berat badan sudah dalam rentang ideal. Pertahankan!","Hindari diet ekstrem atau puasa ketat karena penurunan berat badan terlalu cepat dapat memicu serangan gout. Konsultasikan ke tenaga kesehatan."];
const imtIdx=b=>b<18.5?0:b<23?1:b<25?2:b<30?3:4;

Views.imt=()=>{const u=Auth.current(),b=U.bmi(u);
const input=`<div class="c"><h2>Hitung IMT</h2><div class="r"><div><label class="lb" for="bb">BB (berat badan, kg)</label><input id="bb" type="number" step="0.1" value="${u.bb||""}" placeholder="Mis. 65"></div><div><label class="lb" for="tb">TB (tinggi badan, cm)</label><input id="tb" type="number" value="${u.tb||""}" placeholder="Mis. 165"></div></div><button class="b" onclick="Act.setBMI()">Hitung</button></div>`;
if(b===null)return input+'<div class="c"><p class="mu">Isi berat dan tinggi badan untuk melihat IMT.</p></div>';
const h=u.tb/100,lo=18.5*h*h,hi=22.9*h*h,i=imtIdx(b),k=IMTK[i],sel=Math.max(0,u.bb-hi),msg=IMTM[i<=1?i:2];
return input+`<div class="c"><h2>IMT ${b.toFixed(1)} <span class="t ${k[3]}">${k[0]}</span></h2><p class="mu">${k[2]}</p><p>Rentang berat badan ideal (IMT 18,5-22,9): <b>${lo.toFixed(1)} - ${hi.toFixed(1)} kg</b></p>${sel>0?`<p>Selisih ke batas atas: <b>${sel.toFixed(1)} kg</b>. Dengan penurunan bertahap sekitar 0,5 kg per minggu, perkiraan <b>${Math.ceil(sel/0.5)} minggu</b>.</p>`:""}<p ${i===1?"":'class="mu"'} style="margin-top:6px">${msg}</p></div>
<div class="c"><h2>Klasifikasi IMT</h2><table>${IMTK.map((x,j)=>`<tr style="${j===i?"font-weight:700;background:color-mix(in srgb,var(--pr) 12%,transparent)":""}"><td>${x[0]}</td><td>${x[1]}</td><td><span class="t ${x[3]}">${x[2]}</span></td></tr>`).join("")}</table>
<p class="mu" style="margin-top:8px"><b>Sumber:</b> Kementerian Kesehatan Republik Indonesia (2025) <i>Keputusan Menteri Kesehatan Republik Indonesia Nomor HK.01.07/MENKES/509/2025 tentang Pedoman Nasional Pelayanan Klinis Tata Laksana Obesitas Dewasa</i>. Jakarta: Kementerian Kesehatan Republik Indonesia. Tersedia di: <a href="https://jdih.kemkes.go.id/" target="_blank" rel="noopener" style="color:var(--pr)">https://jdih.kemkes.go.id/</a></p></div>`};

Act.setBMI=()=>{const b=+U.$("bb").value,t=+U.$("tb").value;
  if(!(b>=20&&b<=300&&t>=100&&t<=250)){U.toast("Isi berat (20-300 kg) dan tinggi (100-250 cm) yang valid.");return}
  Auth.patch({bb:b,tb:t});App.render()};
