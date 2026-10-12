/* Unduh rapor bulanan sebagai PDF (jsPDF). Jika pustaka belum termuat -> dialog cetak. */
Act.savePDF=()=>{const L=UI.last,u=Auth.current();if(!L||!u)return;
const J=window.jspdf&&window.jspdf.jsPDF;
if(!J){U.toast("Pustaka PDF belum termuat (butuh internet). Membuka dialog cetak, pilih Simpan sebagai PDF.",5000);setTimeout(()=>window.print(),700);return}
try{
const d=new J({unit:"mm",format:"a4"}),W=180;let y=20;const cl=x=>String(x).replace(/[–—]/g,"-").replace(/<li>/g,"\n- ").replace(/<\/?(ul|b)>/g,"").replace(/<[^>]+>/g,"").replace(/[^\x20-\xFF]/g,"");
const tx=(x,sz,b)=>{d.setFont("helvetica",b?"bold":"normal");d.setFontSize(sz);d.splitTextToSize(cl(x),W).forEach(l=>{if(y>280){d.addPage();y=20}d.text(l,15,y);y+=sz*.5+1.5})};
tx("Gout Care - Rapor Kesehatan "+U.mn(L.m),16,1);tx("Nama: "+u.nama+"   Dicetak: "+U.today(),10);y+=3;
tx("Nilai: "+L.sc+"/100 ("+L.gl+" - "+L.gr+")",13,1);
tx("Kontrol purin: "+L.sp+"/40 | Kadar asam urat: "+L.sl+"/40 | Konsistensi mencatat: "+Math.round(L.sk)+"/20",10);
tx("Hari tercatat: "+L.nd+" | Hari aman: "+L.ok+" | Rata-rata purin: "+L.avg+" mg/hari | Asam urat: "+(L.lab?L.lab.v+" mg/dL":"belum dicek"),10);y+=3;
tx("Keluhan bulan ini",12,1);
if(L.kel&&L.kel.n){tx("Tercatat "+L.kel.n+" keluhan pada "+L.kel.days+" hari."+(L.kel.by.length?" Paling sering: "+L.kel.by.map(t=>t[0]+" "+t[1]+"x").join(", ")+".":""),10);L.kel.items.slice().sort((a,b)=>(a.d+a.t)<(b.d+b.t)?-1:1).forEach(e=>tx("- "+e.d+(e.t?" "+e.t:"")+": "+(e.g.join(", ")||"-")+(e.lain?" ("+e.lain+")":""),10))}else tx("Belum ada keluhan tercatat.",10);y+=2;
tx("Yang sudah baik",12,1);(L.good.length?L.good:["Belum ada data cukup."]).forEach(x=>tx("- "+x,10));y+=2;
tx("Yang perlu ditingkatkan",12,1);(L.imp.length?L.imp:["Pertahankan!"]).forEach(x=>tx("- "+x,10));y+=2;
tx("Edukasi untuk bulan depan",12,1);L.edu.forEach(e=>{tx(e[0],10,1);tx(e[1],10);tx("Sumber: "+e[2],9);y+=1});y+=2;
tx("Rapor ini alat bantu pemantauan, bukan diagnosis. Konsultasikan hasil ke tenaga kesehatan.",9);
d.save("rapor-gout-care-"+L.m+".pdf");
}catch(e){U.toast("Belum berhasil menyimpan PDF. Coba Cetak lalu Simpan sebagai PDF.",5000)}};
