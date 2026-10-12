/* Laporan harian untuk panel admin: satu baris = satu pasien pada satu tanggal.
   Isinya sama dengan yang dihitung rapor (purin vs batas, asam urat, tensi, keluhan). */
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const isDateStr = (s) => typeof s === "string" && DATE.test(s);

/* Sama dengan U.st di klien: batas atas asam urat 7 (L) / 6 (P) mg/dL */
const labStatus = (v, jk) => {
  const l = jk === "L" ? 7 : 6;
  return v > l ? "Tinggi" : v > l - 1 ? "Batas atas" : "Normal";
};
const urgent = (g) => g.includes("Demam") || g.length >= 3;

export function buildPatientDays(docs, { q = "", date = "", limit = 500 } = {}) {
  const needle = String(q).trim().toLowerCase();
  const rows = [];
  let patients = 0;

  for (const doc of docs) {
    const u = doc.user;
    if (u.role === "admin") continue; // akun admin bukan pasien
    if (needle && !(`${u.nama} ${u.email}`.toLowerCase().includes(needle))) continue;
    patients++;

    const days = new Set();
    for (const t of ["meals", "labs", "vitals", "complaints"])
      for (const r of doc[t] || []) if (isDateStr(r.d) && (!date || r.d === date)) days.add(r.d);

    for (const d of days) {
      const meals = (doc.meals || []).filter((m) => m.d === d);
      const purin = meals.reduce((a, m) => a + (m.p || 0), 0);
      const lab = (doc.labs || []).filter((x) => x.d === d).at(-1);
      const vit = (doc.vitals || []).filter((x) => x.d === d).at(-1);
      const keluhan = (doc.complaints || [])
        .filter((x) => x.d === d)
        .map((x) => ({ t: x.t || "", gejala: x.gejala || [], lain: x.lain || "", urgent: urgent(x.gejala || []) }));
      rows.push({
        userId: u.id, nama: u.nama, email: u.email, jk: u.jk, bb: u.bb ?? null, tb: u.tb ?? null,
        d, purin, lim: u.lim, purinOk: meals.length ? purin <= u.lim : null,
        meals: meals.map((m) => ({ w: m.w, n: m.n, g: m.g, p: m.p })),
        lab: lab ? lab.v : null, labStatus: lab ? labStatus(lab.v, u.jk) : null,
        td: vit ? vit.td : null, catatan: vit ? vit.k : "",
        keluhan, urgent: keluhan.some((k) => k.urgent),
      });
    }
  }
  rows.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : a.nama.localeCompare(b.nama)));
  return { patients, total: rows.length, rows: rows.slice(0, limit), truncated: rows.length > limit };
}
