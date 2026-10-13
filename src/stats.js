/* Statistik untuk panel admin. Fungsi murni: terima dokumen user (doc.user + tabel), kembalikan angka/deret.
   Definisi "rata-rata keseluruhan": rata-rata SEMUA pengukuran pasien pada periode itu (bukan rata-rata
   dari rata-rata per pasien), jadi pasien yang rajin mengukur ikut berbobot lebih besar. Jumlah pasien (n)
   selalu disertakan agar admin tahu seberapa kuat angkanya. Akun admin tidak dihitung. */

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isD = (s) => typeof s === "string" && DATE.test(s);
const r1 = (n) => Math.round(n * 10) / 10;
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const addDays = (d, n) => { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const lastDays = (today, n) => Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
const lastMonths = (today, n) => {
  const [y, m] = today.split("-").map(Number), out = [];
  for (let i = n - 1; i >= 0; i--) { const t = new Date(Date.UTC(y, m - 1 - i, 1)); out.push(t.toISOString().slice(0, 7)); }
  return out;
};
export const labStatus = (v, jk) => { const l = jk === "L" ? 7 : 6; return v > l ? "Tinggi" : v > l - 1 ? "Batas atas" : "Normal"; };
export const parseTd = (s) => {
  const m = /^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/.exec(String(s || ""));
  return m ? { sys: +m[1], dia: +m[2] } : null;
};
const TABLES4 = ["labs", "meals", "vitals", "complaints"];
export const patientsOf = (docs) => docs.filter((d) => d.user.role !== "admin");
/* Tanggal (YYYY-MM-DD) dari stempel waktu ISO/UTC, dihitung di zona waktu aplikasi (default WIB) supaya cocok
   dengan "hari ini" milik server. Sebelumnya dipotong dari string UTC, jadi pukul 00:00-07:00 WIB terbaca hari kemarin. */
const TZ = (typeof process !== "undefined" && process.env && process.env.REMINDER_TZ) || "Asia/Jakarta";
const tzFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dateOf = (iso) => { const t = typeof iso === "string" ? Date.parse(iso) : NaN; return Number.isNaN(t) ? "" : tzFmt.format(t); };

/* Hari yang belum datang tidak boleh tampil di statistik: buang catatan bertanggal setelah `today`
   (dan yang tanggalnya tidak valid) dari salinan dokumen. Dokumen asli tidak diubah. */
export function capDoc(doc, today) {
  if (typeof today !== "string") return doc;
  const o = { ...doc };
  for (const t of TABLES4) o[t] = (doc[t] || []).filter((r) => isD(r.d) && r.d <= today);
  return o;
}

function lastActivity(doc) {
  let best = dateOf(doc.user.lastLoginAt);
  for (const t of TABLES4) for (const r of doc[t] || []) if (isD(r.d) && r.d > best) best = r.d;
  return best || null;
}
const dailyPurin = (doc) => {
  const by = new Map();
  for (const m of doc.meals || []) if (isD(m.d)) by.set(m.d, (by.get(m.d) || 0) + (m.p || 0));
  return by;
};

/* Satu baris untuk daftar pengguna */
export function userSummary(rawDoc, today) {
  const doc = capDoc(rawDoc, today), u = doc.user, labs = (doc.labs || []).filter((x) => isD(x.d)).sort((a, b) => (a.d < b.d ? -1 : 1));
  const last = labs.at(-1);
  return {
    id: u.id, nama: u.nama, email: u.email, jk: u.jk, bb: u.bb ?? null, tb: u.tb ?? null, lim: u.lim,
    role: u.role === "admin" ? "admin" : "user", disabled: !!u.disabled,
    createdAt: u.createdAt || null, lastLoginAt: u.lastLoginAt || null, lastActive: lastActivity(doc),
    records: TABLES4.reduce((a, t) => a + (doc[t] || []).length, 0),
    labCount: labs.length, mealCount: (doc.meals || []).length,
    lastLab: last ? { v: last.v, d: last.d, status: labStatus(last.v, u.jk) } : null,
  };
}

export function buildUserList(docs, { q = "", status = "all", sort = "recent", today } = {}) {
  const needle = String(q).trim().toLowerCase();
  let rows = patientsOf(docs).map((d) => userSummary(d, today));
  if (needle) rows = rows.filter((r) => `${r.nama} ${r.email}`.toLowerCase().includes(needle));
  if (status === "active") rows = rows.filter((r) => !r.disabled);
  if (status === "disabled") rows = rows.filter((r) => r.disabled);
  if (status === "high") rows = rows.filter((r) => r.lastLab && r.lastLab.status === "Tinggi");
  const cmp = {
    name: (a, b) => a.nama.localeCompare(b.nama),
    lab: (a, b) => (b.lastLab?.v ?? -1) - (a.lastLab?.v ?? -1),
    recent: (a, b) => (b.lastActive || "").localeCompare(a.lastActive || "") || a.nama.localeCompare(b.nama),
  }[sort] || (() => 0);
  rows.sort(cmp);
  return { total: rows.length, rows };
}

/* Agregat seluruh pasien: dipakai halaman Statistik, dan sebagai pembanding di detail pasien */
export function buildAggregate(docs, today, { days = 30, months = 12 } = {}) {
  const pts = patientsOf(docs).map((d) => capDoc(d, today)), dd = lastDays(today, days), mm = lastMonths(today, months);

  const labM = new Map(), tdM = new Map();
  for (const d of pts) {
    for (const l of d.labs || []) if (isD(l.d)) { const k = l.d.slice(0, 7); (labM.get(k) || labM.set(k, []).get(k)).push({ v: l.v, id: d.user.id }); }
    for (const x of d.vitals || []) { const p = parseTd(x.td); if (isD(x.d) && p) { const k = x.d.slice(0, 7); (tdM.get(k) || tdM.set(k, []).get(k)).push({ ...p, id: d.user.id }); } }
  }
  const lab = mm.map((m) => { const a = labM.get(m) || []; return { m, v: a.length ? r1(mean(a.map((x) => x.v))) : null, n: new Set(a.map((x) => x.id)).size, readings: a.length }; });
  const tensi = mm.map((m) => { const a = tdM.get(m) || []; return { m, sys: a.length ? Math.round(mean(a.map((x) => x.sys))) : null, dia: a.length ? Math.round(mean(a.map((x) => x.dia))) : null, n: new Set(a.map((x) => x.id)).size }; });

  /* Purin harian: rata-rata total purin per hari di antara pasien yang mencatat makan pada hari itu */
  const pur = pts.map((d) => dailyPurin(d));
  const purin = dd.map((d) => { const a = pur.map((m) => m.get(d)).filter((v) => v !== undefined); return { d, v: a.length ? Math.round(mean(a)) : null, n: a.length }; });

  /* Status asam urat terakhir tiap pasien */
  const dist = { Normal: 0, "Batas atas": 0, Tinggi: 0, "Belum ada data": 0 };
  const lastVals = { L: [], P: [] };
  for (const d of pts) {
    const l = (d.labs || []).filter((x) => isD(x.d)).sort((a, b) => (a.d < b.d ? -1 : 1)).at(-1);
    if (!l) { dist["Belum ada data"]++; continue; }
    dist[labStatus(l.v, d.user.jk)]++; lastVals[d.user.jk === "L" ? "L" : "P"].push(l.v);
  }

  /* Makanan paling sering & penyumbang purin terbesar (seluruh riwayat) */
  const food = new Map(), sym = new Map();
  for (const d of pts) {
    for (const m of d.meals || []) { const f = food.get(m.n) || { n: m.n, count: 0, purin: 0 }; f.count++; f.purin += m.p || 0; food.set(m.n, f); }
    for (const c of d.complaints || []) for (const g of c.gejala || []) sym.set(g, (sym.get(g) || 0) + 1);
  }
  const foods = [...food.values()];
  const allLab = pts.flatMap((d) => (d.labs || []).map((l) => l.v)), allTd = pts.flatMap((d) => (d.vitals || []).map((x) => parseTd(x.td)).filter(Boolean));
  const allPur = pur.flatMap((m) => [...m.values()]);

  /* Rekap bulanan untuk laporan */
  const monthly = mm.map((m) => {
    const act = new Set(); let cmp = 0; const pv = [];
    for (const d of pts) {
      let on = false;
      for (const t of TABLES4) for (const r of d[t] || []) if (isD(r.d) && r.d.startsWith(m)) { on = true; if (t === "complaints") cmp++; }
      if (on) act.add(d.user.id);
      for (const [k, v] of dailyPurin(d)) if (k.startsWith(m)) pv.push(v);
    }
    const L = lab.find((x) => x.m === m);
    return { m, activePatients: act.size, avgLab: L.v, avgPurin: pv.length ? Math.round(mean(pv)) : null, complaints: cmp };
  });

  return {
    patients: pts.length,
    lab, tensi, purin, monthly, dist,
    avg: {
      lab: allLab.length ? r1(mean(allLab)) : null,
      labL: lastVals.L.length ? r1(mean(lastVals.L)) : null, labP: lastVals.P.length ? r1(mean(lastVals.P)) : null,
      purin: allPur.length ? Math.round(mean(allPur)) : null,
      sys: allTd.length ? Math.round(mean(allTd.map((x) => x.sys))) : null, dia: allTd.length ? Math.round(mean(allTd.map((x) => x.dia))) : null,
    },
    topFoods: foods.sort((a, b) => b.count - a.count).slice(0, 10),
    topPurin: foods.slice().sort((a, b) => b.purin - a.purin).slice(0, 10),
    symptoms: [...sym].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
  };
}

/* Grafik satu pasien: rata-rata asam urat & tensi per bulan, total purin per hari */
export function buildPatientSeries(rawDoc, today, { days = 30, months = 12 } = {}) {
  const doc = capDoc(rawDoc, today), dd = lastDays(today, days), mm = lastMonths(today, months), u = doc.user;
  const lab = mm.map((m) => { const a = (doc.labs || []).filter((x) => isD(x.d) && x.d.startsWith(m)).map((x) => x.v); return { m, v: a.length ? r1(mean(a)) : null, n: a.length }; });
  const tensi = mm.map((m) => {
    const a = (doc.vitals || []).filter((x) => isD(x.d) && x.d.startsWith(m)).map((x) => parseTd(x.td)).filter(Boolean);
    return { m, sys: a.length ? Math.round(mean(a.map((x) => x.sys))) : null, dia: a.length ? Math.round(mean(a.map((x) => x.dia))) : null, n: a.length };
  });
  const by = dailyPurin(doc);
  const purin = dd.map((d) => ({ d, v: by.has(d) ? by.get(d) : null }));
  const logged = [...by.values()], allLab = (doc.labs || []).map((l) => l.v), allTd = (doc.vitals || []).map((x) => parseTd(x.td)).filter(Boolean);
  return {
    lim: u.lim, batas: u.jk === "L" ? 7 : 6, lab, tensi, purin,
    avg: {
      lab: allLab.length ? r1(mean(allLab)) : null, purin: logged.length ? Math.round(mean(logged)) : null,
      sys: allTd.length ? Math.round(mean(allTd.map((x) => x.sys))) : null, dia: allTd.length ? Math.round(mean(allTd.map((x) => x.dia))) : null,
      daysOver: logged.filter((v) => v > u.lim).length, daysLogged: logged.length,
    },
  };
}

/* Dashboard: angka ringkas, tren 14 hari, dan bahan notifikasi dari data pasien */
export function buildOverview(docs, today) {
  const pts = patientsOf(docs).map((d) => capDoc(d, today)), week = lastDays(today, 7), trendDays = lastDays(today, 14);
  const weekSet = new Set(week);
  let recordsToday = 0, newToday = 0, active = 0, disabled = 0;
  const perDay = new Map(trendDays.map((d) => [d, { records: 0, pts: new Set() }]));
  const urgent = [], high = [];
  for (const doc of pts) {
    const u = doc.user;
    if (u.disabled) disabled++;
    if (dateOf(u.createdAt) === today) newToday++;
    let act = weekSet.has(dateOf(u.lastLoginAt));
    for (const t of TABLES4) for (const r of doc[t] || []) {
      if (!isD(r.d)) continue;
      if (r.d === today) recordsToday++;
      if (weekSet.has(r.d)) act = true;
      const p = perDay.get(r.d); if (p) { p.records++; p.pts.add(u.id); }
    }
    if (act) active++;
    const recent = new Set(lastDays(today, 3));
    if ((doc.complaints || []).some((c) => recent.has(c.d) && (c.gejala?.includes("Demam") || (c.gejala || []).length >= 3))) urgent.push({ id: u.id, nama: u.nama });
    const l = (doc.labs || []).filter((x) => isD(x.d)).sort((a, b) => (a.d < b.d ? -1 : 1)).at(-1);
    if (l && labStatus(l.v, u.jk) === "Tinggi") high.push({ id: u.id, nama: u.nama, v: l.v });
  }
  return {
    totals: { patients: pts.length, active, newToday, recordsToday, disabled },
    trend: trendDays.map((d) => ({ d, records: perDay.get(d).records, patients: perDay.get(d).pts.size })),
    urgent, high,
  };
}

/* Isi laporan harian untuk ekspor */
export const tdText = (s) => { const p = parseTd(s); return p ? `${p.sys}/${p.dia}` : String(s || ""); };
