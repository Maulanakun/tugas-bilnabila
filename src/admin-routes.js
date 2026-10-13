/* Rute API panel admin. Dipanggil dari api.js SETELAH akun admin terverifikasi.
   Setiap handler: ({ doc, b, q }) => response. Aksi yang mengubah data dicatat ke log aktivitas. */
import { randomBytes } from "node:crypto";
import { SEED_FOODS } from "./foods-seed.js";
import { localParts, buildEmail } from "./reminders.js";
import { sendMail, mailConfigured } from "./mailer.js";
import { hashPassword, newId } from "./crypto.js";
import { buildUserList, buildAggregate, buildPatientSeries, buildOverview, patientsOf, userSummary, labStatus, tdText, capDoc } from "./stats.js";
import { buildPatientDays, isDateStr } from "./admin.js";
import { toCsv, toXlsx } from "./xlsx.js";

/* ---- Data global yang juga dibaca user biasa (lewat api.js) ---- */
export async function getFoods(storage) {
  const f = await storage.getMeta("foods");
  return Array.isArray(f) ? f : SEED_FOODS.map(([name, purin, cat], i) => ({ id: "s" + i, name, purin, cat }));
}
export async function getContent(storage) {
  const c = (await storage.getMeta("content")) || {};
  return { articles: Array.isArray(c.articles) ? c.articles : [], announcements: Array.isArray(c.announcements) ? c.announcements : [] };
}
export const SETTINGS_DEFAULT = { siteName: "Gout Care", allowRegister: null, mail: { subject: "", intro: "", footer: "" } };
export async function getSettings(storage) {
  const s = (await storage.getMeta("settings")) || {};
  return { ...SETTINGS_DEFAULT, ...s, mail: { ...SETTINGS_DEFAULT.mail, ...(s.mail || {}) } };
}

const clip = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const validId = (id) => typeof id === "string" && /^[\w-]{1,40}$/.test(id);
const TEMP_CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const tempPassword = () => Array.from(randomBytes(10), (b) => TEMP_CHARS[b % TEMP_CHARS.length]).join("");

export function createAdminRoutes({ storage, env, J, fail, adminKeyExplicit }) {
  const today = () => localParts(new Date(), env.REMINDER_TZ || "Asia/Jakarta").date;
  const log = async (admin, type, text) => {
    try { await storage.appendLog("activity", { t: new Date().toISOString(), type, by: admin.user.nama, text }); } catch { /* log tidak boleh menggagalkan aksi */ }
  };
  const target = async (id) => {
    if (!validId(id)) return { err: fail(400, "ID pengguna tidak valid.") };
    const d = await storage.getDoc(id);
    if (!d) return { err: fail(404, "Pengguna tidak ditemukan.") };
    if (d.user.role === "admin") return { err: fail(403, "Akun admin tidak bisa diubah dari panel ini.") };
    return { d };
  };

  const R = {};

  /* ---------- Dashboard ---------- */
  R["GET /api/admin/overview"] = async () => {
    const docs = await storage.allDocs(), t = today(), o = buildOverview(docs, t);
    const notes = [];
    for (const u of o.urgent) notes.push({ level: "bad", text: `${u.nama}: keluhan yang perlu dicek (demam atau ≥3 gejala) dalam 3 hari terakhir.`, userId: u.id });
    for (const u of o.high.slice(0, 8)) notes.push({ level: "wa", text: `${u.nama}: asam urat terakhir ${u.v} mg/dL (di atas batas).`, userId: u.id });
    if (o.high.length > 8) notes.push({ level: "wa", text: `Dan ${o.high.length - 8} pasien lain dengan asam urat tinggi.` });
    const ml = (await storage.getMeta("maillog")) || [];
    const fails = ml.filter((m) => !m.ok && Date.now() - Date.parse(m.t) < 864e5).length;
    if (fails) notes.push({ level: "bad", text: `${fails} email gagal terkirim dalam 24 jam terakhir. Lihat tab Log.` });
    if (!mailConfigured(env)) notes.push({ level: "wa", text: "SMTP belum dikonfigurasi: email pengingat tidak terkirim." });
    if (!adminKeyExplicit) notes.push({ level: "wa", text: "ADMIN_KEY belum diatur. Kata kunci bawaan diketahui publik; isi ADMIN_KEY di environment." });
    return J(200, { ...o, notifications: notes, today: t });
  };

  /* ---------- Pengguna ---------- */
  R["GET /api/admin/users"] = async ({ q }) => {
    const docs = await storage.allDocs();
    return J(200, buildUserList(docs, { q: String(q.get("q") || "").slice(0, 80), status: q.get("status") || "all", sort: q.get("sort") || "recent", today: today() }));
  };
  R["GET /api/admin/daily"] = async ({ q }) => {
    const date = String(q.get("date") || "");
    if (date && !isDateStr(date)) return fail(400, "Format tanggal harus YYYY-MM-DD.");
    return J(200, buildPatientDays(await storage.allDocs(), { q: String(q.get("q") || "").slice(0, 80), date, today: today() }));
  };
  R["GET /api/admin/patients"] = R["GET /api/admin/daily"]; // nama lama, dipertahankan
  R["GET /api/admin/user"] = async ({ q }) => {
    const id = String(q.get("id") || "");
    const docs = await storage.allDocs(), found = docs.find((x) => x.user.id === id && x.user.role !== "admin");
    if (!found) return fail(404, "Pengguna tidak ditemukan.");
    const t = today(), d = capDoc(found, t), agg = buildAggregate(docs, t);
    const desc = (a, n) => a.slice().sort((x, y) => ((y.d + (y.t || "")) < (x.d + (x.t || "")) ? -1 : 1)).slice(0, n);
    return J(200, {
      summary: userSummary(d, t), series: buildPatientSeries(d, t),
      overall: { lab: agg.lab, tensi: agg.tensi, purin: agg.purin, avg: agg.avg, patients: agg.patients },
      labs: desc(d.labs || [], 12).map(({ d: dt, v }) => ({ d: dt, v, status: labStatus(v, d.user.jk) })),
      complaints: desc(d.complaints || [], 15).map(({ d: dt, t: tm, gejala, lain }) => ({ d: dt, t: tm, gejala, lain })),
      meals: desc(d.meals || [], 15).map(({ d: dt, w, n, g, p }) => ({ d: dt, w, n, g, p })),
    });
  };
  R["POST /api/admin/user/disable"] = async ({ doc, b }) => {
    const { d, err } = await target(b.id); if (err) return err;
    const off = b.disabled !== false;
    await storage.lock(d.user.id, async () => { const f = await storage.getDoc(d.user.id); f.user.disabled = off; await storage.saveDoc(f); });
    await log(doc, off ? "nonaktif" : "aktif", `${off ? "Menonaktifkan" : "Mengaktifkan"} akun ${d.user.email}`);
    return J(200, { ok: true, disabled: off });
  };
  R["POST /api/admin/user/reset-password"] = async ({ doc, b }) => {
    const { d, err } = await target(b.id); if (err) return err;
    const pw = tempPassword(), pass = await hashPassword(pw);
    await storage.lock(d.user.id, async () => { const f = await storage.getDoc(d.user.id); f.user.pass = pass; await storage.saveDoc(f); }); // token lama otomatis mati
    await log(doc, "reset-sandi", `Reset kata sandi ${d.user.email}`);
    return J(200, { ok: true, password: pw, email: d.user.email });
  };
  R["POST /api/admin/user/delete"] = async ({ doc, b }) => {
    const { d, err } = await target(b.id); if (err) return err;
    if (String(b.confirmEmail || "").trim().toLowerCase() !== d.user.email) return fail(400, "Ketik email pengguna persis untuk konfirmasi hapus.");
    await storage.lock(d.user.id, () => storage.deleteUser(d));
    await log(doc, "hapus-akun", `Menghapus akun ${d.user.email} beserta seluruh datanya`);
    return J(200, { ok: true });
  };

  /* ---------- Statistik ---------- */
  R["GET /api/admin/stats"] = async () => J(200, buildAggregate(await storage.allDocs(), today()));

  /* ---------- Database makanan ---------- */
  R["GET /api/admin/foods"] = async () => {
    const [foods, docs] = [await getFoods(storage), await storage.allDocs()], use = new Map();
    for (const d of patientsOf(docs)) for (const m of d.meals || []) use.set(m.n, (use.get(m.n) || 0) + 1);
    return J(200, { foods: foods.map((f) => ({ ...f, used: use.get(f.name) || 0 })), custom: Array.isArray(await storage.getMeta("foods")) });
  };
  R["POST /api/admin/foods/save"] = async ({ doc, b }) => {
    const name = clip(b.name, 80), cat = clip(b.cat, 40), purin = Number(b.purin);
    if (name.length < 2) return fail(400, "Nama makanan minimal 2 karakter.");
    if (!cat) return fail(400, "Kategori wajib diisi.");
    if (!Number.isFinite(purin) || purin < 0 || purin > 1000) return fail(400, "Purin harus angka 0–1000 mg per 100 g.");
    const res = await storage.lock("meta:foods", async () => {
      const list = await getFoods(storage);
      if (list.some((f) => f.id !== b.id && f.name.toLowerCase() === name.toLowerCase())) return { dup: true };
      let row;
      if (b.id) { row = list.find((f) => f.id === b.id); if (!row) return { nf: true }; Object.assign(row, { name, purin, cat }); }
      else { row = { id: newId(), name, purin, cat }; list.push(row); }
      await storage.setMeta("foods", list);
      return { row };
    });
    if (res.dup) return fail(409, "Makanan dengan nama itu sudah ada.");
    if (res.nf) return fail(404, "Makanan tidak ditemukan.");
    await log(doc, "makanan", `${b.id ? "Mengubah" : "Menambah"} makanan "${name}" (${purin} mg/100 g)`);
    return J(200, { ok: true, food: res.row });
  };
  R["POST /api/admin/foods/delete"] = async ({ doc, b }) => {
    const out = await storage.lock("meta:foods", async () => {
      const list = await getFoods(storage), f = list.find((x) => x.id === b.id);
      if (!f) return null;
      await storage.setMeta("foods", list.filter((x) => x.id !== b.id));
      return f;
    });
    if (!out) return fail(404, "Makanan tidak ditemukan.");
    await log(doc, "makanan", `Menghapus makanan "${out.name}"`);
    return J(200, { ok: true });
  };

  /* ---------- Konten: pengumuman & artikel edukasi ---------- */
  R["GET /api/admin/content"] = async () => J(200, await getContent(storage));
  R["POST /api/admin/content/save"] = async ({ doc, b }) => {
    const kind = b.kind === "announcement" ? "announcements" : b.kind === "article" ? "articles" : null;
    if (!kind) return fail(400, "Jenis konten tidak dikenal.");
    const title = clip(b.title, 120), body = clip(b.body, 5000);
    if (title.length < 3) return fail(400, "Judul minimal 3 karakter.");
    if (body.length < 3) return fail(400, "Isi minimal 3 karakter.");
    const item = await storage.lock("meta:content", async () => {
      const c = await getContent(storage); let row = b.id && c[kind].find((x) => x.id === b.id);
      if (b.id && !row) return null;
      if (!row) { row = { id: newId(), createdAt: new Date().toISOString() }; c[kind].unshift(row); }
      Object.assign(row, { title, body });
      if (kind === "articles") row.src = clip(b.src, 120);
      else row.active = b.active !== false;
      await storage.setMeta("content", c);
      return row;
    });
    if (!item) return fail(404, "Konten tidak ditemukan.");
    await log(doc, "konten", `Menyimpan ${b.kind === "article" ? "artikel" : "pengumuman"} "${title}"`);
    return J(200, { ok: true, item });
  };
  R["POST /api/admin/content/delete"] = async ({ doc, b }) => {
    const kind = b.kind === "announcement" ? "announcements" : b.kind === "article" ? "articles" : null;
    if (!kind) return fail(400, "Jenis konten tidak dikenal.");
    const gone = await storage.lock("meta:content", async () => {
      const c = await getContent(storage), row = c[kind].find((x) => x.id === b.id);
      if (!row) return null;
      c[kind] = c[kind].filter((x) => x.id !== b.id); await storage.setMeta("content", c); return row;
    });
    if (!gone) return fail(404, "Konten tidak ditemukan.");
    await log(doc, "konten", `Menghapus "${gone.title}"`);
    return J(200, { ok: true });
  };

  /* ---------- Pengaturan, template email, status pengiriman ---------- */
  R["GET /api/admin/settings"] = async () => {
    const s = await getSettings(storage), docs = patientsOf(await storage.allDocs());
    const rem = { users: docs.length, emailOn: docs.filter((d) => d.user.remEmail !== false).length, byKey: {} };
    for (const d of docs) for (const r of d.reminders || []) if (r.on && r.key !== "air") rem.byKey[r.title] = (rem.byKey[r.title] || 0) + 1;
    const ml = (await storage.getMeta("maillog")) || [], week = ml.filter((m) => Date.now() - Date.parse(m.t) < 7 * 864e5);
    return J(200, {
      settings: s,
      smtp: { configured: mailConfigured(env), mode: String(env.MAIL_MODE || "").toLowerCase() === "log" ? "log" : "smtp", host: env.SMTP_HOST || "", user: env.SMTP_USER ? env.SMTP_USER.replace(/^(.).*(@.*)$/, "$1•••$2") : "" },
      envRegister: String(env.ALLOW_REGISTER ?? "true").toLowerCase() !== "false",
      adminKeyExplicit, reminders: rem, mail7d: { ok: week.filter((m) => m.ok).length, failed: week.filter((m) => !m.ok).length },
    });
  };
  R["POST /api/admin/settings/save"] = async ({ doc, b }) => {
    const siteName = clip(b.siteName, 40);
    if (siteName.length < 2) return fail(400, "Nama situs minimal 2 karakter.");
    const m = b.mail || {};
    const s = { siteName, allowRegister: typeof b.allowRegister === "boolean" ? b.allowRegister : null, mail: { subject: clip(m.subject, 150), intro: clip(m.intro, 300), footer: clip(m.footer, 300) } };
    await storage.setMeta("settings", s);
    await log(doc, "pengaturan", "Menyimpan pengaturan sistem / template email");
    return J(200, { ok: true, settings: s });
  };
  R["POST /api/admin/settings/test-email"] = async ({ doc }) => {
    if (!mailConfigured(env)) return fail(503, "SMTP belum dikonfigurasi (SMTP_HOST, SMTP_USER, SMTP_PASS).");
    const s = await getSettings(storage);
    const mail = buildEmail(doc.user, ["Contoh pengingat: Catat makanan hari ini", "Contoh pengingat: Cek asam urat bulanan"], env.APP_URL || env.URL || "", { tpl: s.mail, site: s.siteName });
    const r = await sendMail({ to: doc.user.email, ...mail }, env);
    await storage.appendLog("maillog", { t: new Date().toISOString(), to: doc.user.email, subject: mail.subject, kind: "uji-admin", ok: r.ok, error: r.ok ? "" : r.error });
    return r.ok ? J(200, { ok: true, to: doc.user.email }) : fail(502, r.error);
  };

  /* ---------- Log ---------- */
  R["GET /api/admin/logs"] = async ({ q }) => {
    const key = { mail: "maillog", error: "errlog", activity: "activity" }[q.get("kind")];
    if (!key) return fail(400, "Jenis log tidak dikenal.");
    const l = (await storage.getMeta(key)) || [];
    return J(200, { rows: l.slice(-150).reverse() });
  };

  /* ---------- Ekspor & backup ---------- */
  const EXPORTS = {
    pasien: ["Pasien", (docs) => [["Nama", "Email", "JK", "BB (kg)", "TB (cm)", "Batas purin (mg)", "Terdaftar", "Status akun", "Login terakhir", "Jumlah catatan", "Asam urat terakhir (mg/dL)", "Tanggal cek", "Status asam urat"],
      ...patientsOf(docs).map((x) => userSummary(x)).map((u) => [u.nama, u.email, u.jk, u.bb, u.tb, u.lim, (u.createdAt || "").slice(0, 10), u.disabled ? "Nonaktif" : "Aktif", (u.lastLoginAt || "").slice(0, 10), u.records, u.lastLab?.v ?? "", u.lastLab?.d ?? "", u.lastLab?.status ?? ""])]],
    "asam-urat": ["Asam urat", (docs) => [["Nama", "Email", "Tanggal", "Kadar (mg/dL)", "Status"], ...patientsOf(docs).flatMap((d) => (d.labs || []).map((l) => [d.user.nama, d.user.email, l.d, l.v, labStatus(l.v, d.user.jk)]))]],
    makanan: ["Catatan makan", (docs) => [["Nama", "Email", "Tanggal", "Waktu", "Makanan", "Porsi (g/ml)", "Purin (mg)"], ...patientsOf(docs).flatMap((d) => (d.meals || []).map((m) => [d.user.nama, d.user.email, m.d, m.w, m.n, m.g, m.p]))]],
    tensi: ["Tensi", (docs) => [["Nama", "Email", "Tanggal", "Tensi", "Catatan"], ...patientsOf(docs).flatMap((d) => (d.vitals || []).map((v) => [d.user.nama, d.user.email, v.d, tdText(v.td), v.k]))]],
    keluhan: ["Keluhan", (docs) => [["Nama", "Email", "Tanggal", "Jam", "Gejala", "Keluhan lain", "Perlu dicek"], ...patientsOf(docs).flatMap((d) => (d.complaints || []).map((c) => [d.user.nama, d.user.email, c.d, c.t, (c.gejala || []).join(", "), c.lain, c.gejala?.includes("Demam") || (c.gejala || []).length >= 3 ? "Ya" : "Tidak"]))]],
    rekap: ["Rekap bulanan", (docs, t) => [["Bulan", "Pasien aktif", "Rata-rata asam urat (mg/dL)", "Rata-rata purin per hari (mg)", "Jumlah keluhan"], ...buildAggregate(docs, t).monthly.map((m) => [m.m, m.activePatients, m.avgLab ?? "", m.avgPurin ?? "", m.complaints])]],
  };
  R["GET /api/admin/export/file"] = async ({ q }) => {
    const type = q.get("type"), fmt = q.get("format") === "xlsx" ? "xlsx" : "csv";
    let name, rows;
    if (type === "database-makanan") { name = "Database makanan"; rows = [["Nama", "Purin (mg/100 g)", "Kategori"], ...(await getFoods(storage)).map((f) => [f.name, f.purin, f.cat])]; }
    else if (EXPORTS[type]) { name = EXPORTS[type][0]; { const t = today(); rows = EXPORTS[type][1]((await storage.allDocs()).map((x) => capDoc(x, t)), t); } }
    else return fail(400, "Jenis laporan tidak dikenal.");
    const file = `gout-care-${type}-${today()}.${fmt}`;
    const body = fmt === "xlsx" ? toXlsx(rows, name) : toCsv(rows);
    return { status: 200, headers: { "content-type": fmt === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${file}"`, "cache-control": "no-store" }, body };
  };
  R["GET /api/admin/backup"] = async ({ doc }) => {
    const all = await storage.exportAll();
    all.users = all.users.map(({ pass, ...u }) => u); // hash sandi tidak ikut
    all.exportedAt = new Date().toISOString();
    await log(doc, "backup", "Mengunduh backup data (JSON)");
    return { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "content-disposition": `attachment; filename="gout-care-backup-${today()}.json"` }, body: JSON.stringify(all, null, 2) };
  };

  return R;
}
