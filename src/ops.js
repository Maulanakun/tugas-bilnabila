/* Validasi + penerapan operasi data milik satu user.
   Klien mengirim operasi (insert/update/remove/profile); server memeriksa
   bentuk datanya dan memaksa userId = pemilik token, jadi user tidak bisa
   menulis ke data orang lain. */
export const TABLES = ["labs", "meals", "vitals", "reminders", "moods", "complaints"];
const MAX_ROWS = 20000;

const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const num = (lo, hi) => (v) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);
const str = (max) => (v) => (typeof v === "string" ? v.slice(0, max) : undefined);
const V = {
  date: (v) => (isDate(v) ? v : undefined),
  time: (v) => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : undefined),
  flag: (v) => (v === 1 || v === true ? 1 : v === 0 || v === false ? 0 : undefined),
  mood: (v) => (v === null || (Number.isInteger(v) && v >= 0 && v <= 9) ? v : undefined),
  list: (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 30).map((x) => x.slice(0, 40)) : undefined),
};

/* Spesifikasi per tabel: [validator, nilai bawaan]. Tanpa nilai bawaan = wajib. */
const SPEC = {
  labs: { d: [V.date], v: [num(0.1, 30)] },
  meals: { d: [V.date], w: [str(30)], n: [str(80)], g: [num(0.1, 100000)], p: [num(0, 1000000)] },
  vitals: { d: [V.date], td: [str(20)], k: [str(300), ""] },
  reminders: { key: [str(30)], title: [str(80)], freq: [str(60)], time: [V.time], on: [V.flag, 1] }, // kolom `sent` (penanda email terkirim) hanya ditulis server
  moods: { d: [V.date], mood: [V.mood, null], gejala: [V.list, []] },
  /* Keluhan yang dikirim lewat modal emoji: tanggal, jam (HH:MM), pilihan gejala, dan keluhan lain (teks bebas) */
  complaints: { d: [V.date], t: [V.time], gejala: [V.list, []], lain: [str(300), ""] },
};

const validId = (id) => typeof id === "string" && /^[\w-]{1,40}$/.test(id);

function cleanRow(t, row) {
  const out = {};
  for (const [k, [fn, def]] of Object.entries(SPEC[t])) {
    let v = fn(row[k]);
    if (v === undefined) {
      if (row[k] === undefined && def !== undefined) v = def;
      else return null;
    }
    out[k] = v;
  }
  return out;
}

function cleanPatch(t, patch) {
  if (!patch || typeof patch !== "object") return null;
  const out = {};
  for (const [k, val] of Object.entries(patch)) {
    if (!SPEC[t][k]) continue; // kolom tak dikenal / id / userId diabaikan
    const v = SPEC[t][k][0](val);
    if (v === undefined) return null;
    out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

const optNum = (v, lo, hi) => (v === null ? null : typeof v === "number" && v >= lo && v <= hi ? v : undefined);

export function cleanProfile(p) {
  const o = {};
  if (!p || typeof p !== "object") return o;
  if (typeof p.nama === "string") { const n = p.nama.trim().slice(0, 60); if (n.length >= 2) o.nama = n; }
  if (p.jk === "L" || p.jk === "P") o.jk = p.jk;
  if (p.lim === 150 || p.lim === 400) o.lim = p.lim;
  if (typeof p.remEmail === "boolean") o.remEmail = p.remEmail;
  for (const [k, lo, hi] of [["bb", 20, 300], ["tb", 100, 250]]) {
    if (p[k] !== undefined) { const v = optNum(p[k], lo, hi); if (v !== undefined) o[k] = v; }
  }
  return o;
}

export const publicUser = (u) => ({ id: u.id, nama: u.nama, email: u.email, jk: u.jk, bb: u.bb, tb: u.tb, lim: u.lim, role: u.role === "admin" ? "admin" : "user", remEmail: u.remEmail !== false, createdAt: u.createdAt });

export function blankDoc(user) {
  const d = { user };
  TABLES.forEach((t) => (d[t] = []));
  return d;
}

/* Terapkan daftar operasi ke doc (dimutasi). Operasi yang salah ditolak satu per satu. */
export function applyOps(doc, ops) {
  let applied = 0, changed = false;
  const rejected = [];
  const bad = (i, error) => rejected.push({ i, error });
  TABLES.forEach((t) => { if (!Array.isArray(doc[t])) doc[t] = []; }); // dokumen lama (mis. di Netlify Blobs) belum punya tabel baru

  ops.forEach((op, i) => {
    if (!op || typeof op !== "object") return bad(i, "format operasi salah");
    if (op.op === "profile") {
      const p = cleanProfile(op.patch);
      if (!Object.keys(p).length) return bad(i, "profil tidak valid");
      Object.assign(doc.user, p); applied++; changed = true; return;
    }
    const t = op.t;
    if (!TABLES.includes(t)) return bad(i, "tabel tidak dikenal");

    if (op.op === "insert") {
      const row = op.row;
      if (!row || !validId(row.id)) return bad(i, "id tidak valid");
      if (doc[t].some((r) => r.id === row.id)) { applied++; return; } // sudah ada: aman diulang
      if (doc[t].length >= MAX_ROWS) return bad(i, "batas jumlah data tercapai");
      const c = cleanRow(t, row);
      if (!c) return bad(i, "data tidak valid");
      doc[t].push({ id: row.id, userId: doc.user.id, ...c });
      applied++; changed = true;
    } else if (op.op === "update") {
      const r = validId(op.id) && doc[t].find((x) => x.id === op.id);
      if (!r) return bad(i, "data tidak ditemukan");
      const c = cleanPatch(t, op.patch);
      if (!c) return bad(i, "perubahan tidak valid");
      Object.assign(r, c); applied++; changed = true;
    } else if (op.op === "remove") {
      const n = doc[t].length;
      doc[t] = doc[t].filter((x) => x.id !== op.id);
      applied++; if (doc[t].length !== n) changed = true;
    } else bad(i, "operasi tidak dikenal");
  });
  return { applied, rejected, changed };
}
