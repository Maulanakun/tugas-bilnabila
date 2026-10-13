/* Uji fitur admin baru: dashboard, kelola pengguna, makanan, konten, statistik, template/log, ekspor. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gc-adm2-"));
const PORT = 3900 + Math.floor(Math.random() * 90), BASE = `http://127.0.0.1:${PORT}`;
const srv = spawn("node", ["server.js"], { cwd: ROOT, env: { ...process.env, PORT, HOST: "127.0.0.1", DATA_FILE: path.join(tmp, "db.json"), JWT_SECRET: "x".repeat(40), ALLOW_REGISTER: "true", REMINDERS_ENABLED: "false", MAIL_MODE: "log" }, stdio: ["ignore", "ignore", "inherit"] });
process.on("exit", () => srv.kill());
const call = async (method, p, body, token, raw) => {
  const r = await fetch(BASE + p, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (raw) return { s: r.status, buf: Buffer.from(await r.arrayBuffer()), h: r.headers };
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
let n = 0; const ok = (m) => console.log("  ✓", m, ++n && "");
const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  console.log("ADMIN 2");
  const reg = async (nama, email, pw, jk) => (await call("POST", "/api/register", { nama, email, password: pw, jk })).j;
  const b = await reg("Budi", "budi@mail.com", "rahasia1", "L"), s = await reg("Siti", "siti@mail.com", "rahasia2", "P");
  const A = (await reg("Admin", "adm@mail.com", "xxADMINGOUTCAREyy", "P")).token;
  const ops = (t, o) => call("POST", "/api/me/ops", { ops: o }, t);
  await ops(b.token, [
    { op: "insert", t: "labs", row: { id: "l1", d: today, v: 8 } }, { op: "insert", t: "labs", row: { id: "l1b", d: "2026-09-10", v: 6 } },
    { op: "insert", t: "meals", row: { id: "m1", d: today, w: "Sarapan", n: "Hati/ati ayam", g: 100, p: 243 } },
    { op: "insert", t: "meals", row: { id: "m2", d: today, w: "Makan siang", n: "Tempe", g: 100, p: 141 } },
    { op: "insert", t: "vitals", row: { id: "v1", d: today, td: "140/90" } },
    { op: "insert", t: "complaints", row: { id: "c1", d: today, t: "08:00", gejala: ["Demam"] } }]);
  await ops(s.token, [{ op: "insert", t: "labs", row: { id: "l2", d: today, v: 4 } }, { op: "insert", t: "meals", row: { id: "m3", d: today, w: "Sarapan", n: "Tempe", g: 100, p: 141 } }]);

  /* akses */
  for (const p of ["overview", "users", "stats", "foods", "content", "settings", "logs?kind=mail"]) assert.equal((await call("GET", "/api/admin/" + p, null, b.token)).s, 403);
  ok("semua endpoint admin baru menolak pasien (403)");
  assert.equal((await call("GET", "/api/admin/overview")).s, 401); ok("tanpa login ditolak (401)");

  /* dashboard */
  let r = await call("GET", "/api/admin/overview", null, A);
  assert.equal(r.j.totals.patients, 2); assert.equal(r.j.totals.active, 2); assert.equal(r.j.totals.recordsToday, 7); assert.equal(r.j.totals.newToday, 2);
  assert.equal(r.j.trend.length, 14); assert.equal(r.j.trend.at(-1).patients, 2);
  assert.ok(r.j.notifications.some((x) => x.level === "bad" && /Budi/.test(x.text))); assert.ok(r.j.notifications.some((x) => /asam urat terakhir 8/.test(x.text))); ok("dashboard: angka, tren 14 hari, notifikasi keluhan & asam urat tinggi");

  /* daftar & detail */
  r = await call("GET", "/api/admin/users?q=bud", null, A); assert.equal(r.j.total, 1); assert.equal(r.j.rows[0].lastLab.status, "Tinggi"); assert.equal(r.j.rows[0].records, 6);
  assert.equal((await call("GET", "/api/admin/users?status=high", null, A)).j.total, 1); ok("daftar pengguna: cari, filter, ringkasan");
  r = await call("GET", "/api/admin/user?id=" + b.user.id, null, A);
  assert.equal(r.j.series.lab.at(-1).v, 8); assert.equal(r.j.series.lab.at(-2).v, 6);
  assert.equal(r.j.overall.lab.at(-1).v, 6); /* (8 + 4) / 2 */ assert.equal(r.j.overall.lab.at(-1).n, 2);
  assert.equal(r.j.series.purin.at(-1).v, 384); assert.equal(r.j.overall.purin.at(-1).v, 263); /* (384+141)/2=262.5 */
  assert.equal(r.j.series.tensi.at(-1).sys, 140); assert.equal(r.j.series.avg.daysLogged, 1); assert.equal(r.j.series.avg.daysOver, 0); ok("detail: grafik individu vs rata-rata seluruh pasien");
  assert.equal((await call("GET", "/api/admin/user?id=nope", null, A)).s, 404); ok("detail id tak dikenal 404");

  /* nonaktif, reset, hapus */
  assert.equal((await call("POST", "/api/admin/user/disable", { id: b.user.id, disabled: true }, A)).s, 200);
  assert.equal((await call("GET", "/api/me", null, b.token)).s, 401); ok("akun nonaktif: token lama langsung tidak berlaku");
  r = await call("POST", "/api/login", { email: "budi@mail.com", password: "rahasia1" }); assert.equal(r.s, 403); ok("akun nonaktif tidak bisa login");
  await call("POST", "/api/admin/user/disable", { id: b.user.id, disabled: false }, A);
  r = await call("POST", "/api/admin/user/reset-password", { id: b.user.id }, A); assert.equal(r.s, 200); const tmpPw = r.j.password; assert.ok(tmpPw.length >= 10);
  assert.equal((await call("POST", "/api/login", { email: "budi@mail.com", password: "rahasia1" })).s, 401);
  assert.equal((await call("POST", "/api/login", { email: "budi@mail.com", password: tmpPw })).s, 200); ok("reset sandi: sandi lama mati, sandi sementara berfungsi");
  const adminId = (await call("GET", "/api/me", null, A)).j.user.id;
  assert.equal((await call("POST", "/api/admin/user/delete", { id: adminId, confirmEmail: "adm@mail.com" }, A)).s, 403); ok("akun admin tidak bisa dihapus/diubah lewat panel");
  assert.equal((await call("POST", "/api/admin/user/delete", { id: s.user.id, confirmEmail: "salah@mail.com" }, A)).s, 400);
  assert.equal((await call("POST", "/api/admin/user/delete", { id: s.user.id, confirmEmail: "siti@mail.com" }, A)).s, 200);
  assert.equal((await call("GET", "/api/admin/users", null, A)).j.total, 1); ok("hapus akun butuh konfirmasi email, data ikut terhapus");

  /* makanan */
  r = await call("GET", "/api/admin/foods", null, A); assert.equal(r.j.foods.length, 69); assert.equal(r.j.custom, false);
  assert.equal(r.j.foods.find((f) => f.name === "Tempe").used, 1);
  r = await call("POST", "/api/admin/foods/save", { name: "Tahu sutra", purin: 55, cat: "Kacang & olahan kedelai" }, A); assert.equal(r.s, 200); const fid = r.j.food.id;
  assert.equal((await call("POST", "/api/admin/foods/save", { name: "tahu SUTRA", purin: 1, cat: "x" }, A)).s, 409);
  assert.equal((await call("POST", "/api/admin/foods/save", { name: "Aneh", purin: -3, cat: "x" }, A)).s, 400);
  assert.equal((await call("POST", "/api/admin/foods/save", { id: fid, name: "Tahu sutra", purin: 60, cat: "Kacang & olahan kedelai" }, A)).s, 200);
  r = await call("GET", "/api/foods", null, (await call("POST", "/api/login", { email: "budi@mail.com", password: tmpPw })).j.token);
  assert.equal(r.j.foods.length, 70); assert.deepEqual(r.j.foods.find((f) => f[0] === "Tahu sutra"), ["Tahu sutra", 60, "Kacang & olahan kedelai"]); ok("makanan: tambah, ubah, validasi, duplikat, tampil ke user");
  assert.equal((await call("POST", "/api/admin/foods/delete", { id: fid }, A)).s, 200);
  assert.equal((await call("GET", "/api/admin/foods", null, A)).j.foods.length, 69); ok("makanan: hapus");

  /* konten */
  r = await call("POST", "/api/admin/content/save", { kind: "announcement", title: "Libur", body: "Klinik tutup Jumat" }, A); const aid = r.j.item.id;
  await call("POST", "/api/admin/content/save", { kind: "announcement", title: "Draf", body: "Belum tayang", active: false }, A);
  await call("POST", "/api/admin/content/save", { kind: "article", title: "Tips diet", body: "Minum air putih", src: "Tim" }, A);
  const UT = (await call("POST", "/api/login", { email: "budi@mail.com", password: tmpPw })).j.token;
  r = await call("GET", "/api/content", null, UT); assert.equal(r.j.announcements.length, 1); assert.equal(r.j.articles.length, 1); ok("konten: user hanya melihat pengumuman aktif + artikel");
  assert.equal((await call("POST", "/api/admin/content/delete", { kind: "announcement", id: aid }, A)).s, 200);
  assert.equal((await call("POST", "/api/admin/content/save", { kind: "article", title: "x", body: "yy" }, A)).s, 400); ok("konten: hapus & validasi");

  /* statistik */
  r = await call("GET", "/api/admin/stats", null, A);
  assert.equal(r.j.patients, 1); assert.equal(r.j.dist.Tinggi, 1); assert.equal(r.j.topFoods[0].count, 1); assert.equal(r.j.topPurin[0].n, "Hati/ati ayam");
  assert.equal(r.j.symptoms[0].name, "Demam"); assert.equal(r.j.monthly.length, 12); ok("statistik agregat: distribusi, makanan teratas, gejala, rekap bulanan");

  /* pengaturan, template, log */
  assert.equal((await call("POST", "/api/admin/settings/save", { siteName: "x", mail: {} }, A)).s, 400);
  r = await call("POST", "/api/admin/settings/save", { siteName: "Klinik Sehat", allowRegister: false, mail: { subject: "Halo {{nama}}: {{judul}}", intro: "Jangan lupa {{jumlah}} hal", footer: "Salam" } }, A); assert.equal(r.s, 200);
  assert.equal((await call("GET", "/api/config")).j.siteName, "Klinik Sehat");
  assert.equal((await call("POST", "/api/register", { nama: "Baru", email: "baru@mail.com", password: "rahasia3" })).s, 403); ok("pengaturan: nama situs & tutup pendaftaran (menimpa env)");
  r = await call("POST", "/api/admin/settings/test-email", {}, A); assert.equal(r.s, 200);
  r = await call("GET", "/api/admin/logs?kind=mail", null, A); assert.equal(r.j.rows[0].kind, "uji-admin"); assert.equal(r.j.rows[0].ok, true);
  r = await call("GET", "/api/admin/logs?kind=activity", null, A); assert.ok(r.j.rows.some((x) => x.type === "nonaktif") && r.j.rows.some((x) => x.type === "hapus-akun") && r.j.rows.some((x) => x.type === "masuk")); ok("log email & aktivitas tercatat");
  const { buildEmail } = await import("../src/reminders.js");
  const m = buildEmail({ nama: "Budi" }, ["A", "B"], "", { tpl: { subject: "Halo {{nama}}: {{judul}}", intro: "Ingat {{jumlah}} hal", footer: "Salam" }, site: "Klinik Sehat" });
  assert.equal(m.subject, "Halo Budi: A, B"); assert.ok(m.text.includes("Ingat 2 hal") && m.text.includes("Salam")); ok("template email: placeholder terisi");

  /* ekspor */
  r = await call("GET", "/api/admin/export/file?type=pasien&format=csv", null, A, true);
  assert.equal(r.s, 200); const csv = r.buf.toString("utf8"); assert.ok(csv.startsWith("\uFEFFNama,Email")); assert.ok(csv.includes("budi@mail.com")); ok("ekspor CSV (BOM UTF-8)");
  await ops(UT, [{ op: "insert", t: "vitals", row: { id: "v9", d: today, td: "120/80", k: "=HYPERLINK(\"x\")" } }]);
  r = await call("GET", "/api/admin/export/file?type=tensi&format=csv", null, A, true); assert.ok(r.buf.toString("utf8").includes("'=HYPERLINK")); ok("CSV: sel berawalan = diberi awalan ' (anti injeksi rumus)");
  r = await call("GET", "/api/admin/export/file?type=asam-urat&format=xlsx", null, A, true);
  assert.equal(r.buf.subarray(0, 2).toString(), "PK"); fs.writeFileSync(path.join(tmp, "t.xlsx"), r.buf); fs.writeFileSync("/tmp/gc-test.xlsx", r.buf); ok("ekspor XLSX (tanda tangan ZIP)");
  assert.equal((await call("GET", "/api/admin/export/file?type=ngawur", null, A)).s, 400);
  r = await call("GET", "/api/admin/backup", null, A, true); const bk = JSON.parse(r.buf.toString()); assert.ok(bk.users.length >= 2 && !bk.users.some((u) => u.pass) && bk.meta.settings.siteName === "Klinik Sehat"); ok("backup JSON: tanpa hash sandi, menyertakan pengaturan");

  /* hardening ADMIN_KEY di produksi */
  const { createHandler } = await import("../src/api.js");
  const { createFileStorage } = await import("../src/storage-file.js");
  const st = createFileStorage(path.join(tmp, "prod.json")); await st.init();
  const h = createHandler({ storage: st, env: { JWT_SECRET: "y".repeat(40), NODE_ENV: "production" } });
  const reg2 = await h({ method: "POST", path: "/api/register", headers: {}, body: JSON.stringify({ nama: "Pura", email: "p@mail.com", password: "xxADMINGOUTCAREyy" }) });
  assert.equal(JSON.parse(reg2.body).user.role, "user"); ok("produksi tanpa ADMIN_KEY: kata kunci bawaan tidak lagi menjadikan admin");
  console.log(`\n${n} uji lulus`);
} catch (e) { console.error("GAGAL:", e.message); process.exitCode = 1; } finally { srv.kill(); }
