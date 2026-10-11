/* Tab IMT & Berat */
Views.imt=()=>{const u=Auth.current(),b=U.bmi(u);
const input=`<div class="c"><h2>Hitung IMT</h2><div class="r"><input id="bb" type="number" step="0.1" value="${u.bb||""}" placeholder="Berat (kg)"><input id="tb" type="number" value="${u.tb||""}" placeholder="Tinggi (cm)"></div><button class="b" onclick="Act.setBMI()">Hitung</button></div>`;
if(b===null)return input+'<div class="c"><p class="mu">Isi berat dan tinggi badan untuk melihat IMT.</p></div>';
const h=u.tb/100,lo=18.5*h*h,hi=22.9*h*h,k=b<18.5?["Kurus","wa"]:b<23?["Normal","ok"]:b<25?["Berat badan lebih","wa"]:["Obesitas","bad"],sel=Math.max(0,u.bb-hi);
return input+`<div class="c"><h2>IMT ${b.toFixed(1)} <span class="t ${k[1]}">${k[0]}</span></h2><p>Rentang berat badan ideal (IMT 18,5-22,9): <b>${lo.toFixed(1)} - ${hi.toFixed(1)} kg</b></p>${sel>0?`<p>Selisih ke batas atas: <b>${sel.toFixed(1)} kg</b>. Dengan penurunan bertahap sekitar 0,5 kg per minggu, perkiraan <b>${Math.ceil(sel/0.5)} minggu</b>.</p><p class="mu">Hindari diet ekstrem atau puasa ketat karena penurunan berat badan terlalu cepat dapat memicu serangan gout. Konsultasikan ke tenaga kesehatan.</p>`:"<p>Berat badan sudah dalam rentang ideal. Pertahankan!</p>"}<p class="mu">Acuan klasifikasi: WHO Asia-Pasifik. Sesuaikan dengan acuan institusi.</p></div>`};

Act.setBMI=()=>{const b=+U.$("bb").value,t=+U.$("tb").value;
  if(!(b>=20&&b<=300&&t>=100&&t<=250)){U.toast("Isi berat (20-300 kg) dan tinggi (100-250 cm) yang valid.");return}
  Auth.patch({bb:b,tb:t});App.render()};
