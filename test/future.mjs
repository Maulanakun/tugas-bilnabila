/* Uji: hari yang belum datang tidak ikut statistik, dan tanggal login/daftar dihitung dalam WIB. */
import assert from "node:assert/strict";
import { buildAggregate, buildOverview, buildPatientSeries, userSummary, capDoc } from "../src/stats.js";
import { buildPatientDays } from "../src/admin.js";

const today = "2026-10-13";
const doc = {
  user: { id: "a", nama: "A", email: "a@x", jk: "L", lim: 400, role: "user", createdAt: "2026-10-12T19:00:00.000Z" }, // 02:00 WIB 13 Okt
  labs: [{ d: "2026-10-05", v: 6.5 }, { d: "2026-10-10", v: 8 }, { d: "2026-10-25", v: 5 }, { d: "2026-12-01", v: 5 }],
  meals: [{ d: "2026-10-12", n: "x", p: 100 }, { d: "2026-10-12", n: "y", p: 200 }, { d: "2026-10-13", n: "x", p: 100 }, { d: "2026-10-20", n: "z", p: 500 }],
  vitals: [{ d: "2026-10-12", td: "120/80" }, { d: "2026-11-02", td: "180/110" }],
  complaints: [{ d: "2026-10-30", gejala: ["Demam"] }],
};
let n = 0; const ok = (m) => console.log("  ✓", m, ++n && "");
console.log("HARI YANG BELUM DATANG");

const agg = buildAggregate([doc], today);
assert.deepEqual(agg.lab.at(-1), { m: "2026-10", v: 7.3, n: 1, readings: 2 });
assert.equal(agg.lab.at(-1).m, "2026-10"); assert.equal(agg.purin.at(-1).d, today);
assert.equal(agg.tensi.at(-1).sys, 120);
ok("grafik: rata-rata bulan ini hanya dari catatan sampai hari ini; sumbu berakhir di bulan/tanggal hari ini");
assert.equal(agg.dist.Tinggi, 1); assert.equal(agg.avg.labL, 8); assert.equal(agg.avg.purin, 200);
assert.equal(agg.topFoods.length, 2); assert.equal(agg.symptoms.length, 0); assert.equal(agg.monthly.at(-1).complaints, 0);
ok("distribusi status, rata-rata, makanan teratas, gejala, rekap bulanan tidak memuat data masa depan");

const sm = userSummary(doc, today);
assert.equal(sm.lastLab.v, 8); assert.equal(sm.records, 6); assert.equal(sm.lastActive, today);
ok("ringkasan pasien: asam urat terakhir & aktivitas terakhir bukan tanggal masa depan");

const se = buildPatientSeries(doc, today);
assert.equal(se.avg.lab, 7.3); assert.equal(se.avg.daysLogged, 2); assert.equal(se.avg.daysOver, 0);
ok("grafik per pasien tidak memuat data masa depan");

const dly = buildPatientDays([doc], { today });
assert.ok(dly.rows.every((r) => r.d <= today)); assert.equal(buildPatientDays([doc], { today, date: "2026-10-20" }).total, 0);
ok("catatan harian: tanggal masa depan tidak tampil, memilih tanggal masa depan kosong");

assert.equal(capDoc(doc, undefined), doc);
ok("tanpa 'today' dokumen dibiarkan (tidak merusak pemanggil lama)");

console.log("ZONA WAKTU");
const ov = buildOverview([doc], today);
assert.equal(ov.totals.newToday, 1);
ok("daftar pukul 02:00 WIB dihitung 'baru hari ini' (bukan kemarin menurut UTC)");
console.log(`\n${n} uji lulus`);
