/* Uji panel admin: sandi ber-ADMINGOUTCARE = admin, pasien biasa ditolak, daftar pasien + cari + filter tanggal. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gc-adm-"));
const PORT = 3800 + Math.floor(Math.random() * 90), BASE = `http://127.0.0.1:${PORT}`;
const srv = spawn("node", ["server.js"], { cwd: ROOT, env: { ...process.env, PORT, HOST: "127.0.0.1", DATA_FILE: path.join(tmp, "db.json"), JWT_SECRET: "x".repeat(40), ALLOW_REGISTER: "true", REMINDERS_ENABLED: "false" }, stdio: ["ignore", "ignore", "inherit"] });
process.on("exit", () => srv.kill());
const call = async (method, p, body, token) => {
  const r = await fetch(BASE + p, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
let n = 0; const ok = (m) => console.log("  ✓", m, ++n && "");
try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  console.log("ADMIN");
  const D = "2026-10-12";
  let r = await call("POST", "/api/register", { nama: "Budi Santoso", email: "budi@mail.com", password: "rahasia1", jk: "L", bb: 70, tb: 170 });
  const P1 = r.j.token; assert.equal(r.j.user.role, "user"); ok("pasien biasa: role user");
  await call("POST", "/api/me/ops", { ops: [
    { op: "insert", t: "meals", row: { id: "m1", d: D, w: "Sarapan", n: "Daging sapi", g: 200, p: 500 } },
    { op: "insert", t: "labs", row: { id: "l1", d: D, v: 8.2 } },
    { op: "insert", t: "vitals", row: { id: "v1", d: D, td: "140/90" } },
    { op: "insert", t: "complaints", row: { id: "c1", d: D, t: "08:00", gejala: ["Demam"] } },
  ] }, P1);
  r = await call("POST", "/api/register", { nama: "Siti Aminah", email: "siti@mail.com", password: "rahasia2", jk: "P" });
  const P2 = r.j.token;
  await call("POST", "/api/me/ops", { ops: [{ op: "insert", t: "labs", row: { id: "l2", d: "2026-10-10", v: 4.9 } }] }, P2);

  r = await call("POST", "/api/register", { nama: "Admin Klinik", email: "admin@mail.com", password: "xxADMINGOUTCAREyy", jk: "P" });
  assert.equal(r.s, 201); assert.equal(r.j.user.role, "admin"); const A = r.j.token; ok("daftar dengan sandi ber-ADMINGOUTCARE = admin");
  assert.equal(r.j.user.pass, undefined); ok("hash sandi tidak bocor");

  assert.equal((await call("GET", "/api/admin/patients")).s, 401); ok("tanpa login ditolak (401)");
  assert.equal((await call("GET", "/api/admin/patients", null, P1)).s, 403); ok("pasien biasa ditolak (403)");

  r = await call("GET", "/api/admin/patients", null, A);
  assert.equal(r.s, 200); assert.equal(r.j.patients, 2); assert.equal(r.j.total, 2);
  assert.ok(!r.j.rows.some((x) => x.email === "admin@mail.com")); ok("daftar semua pasien, akun admin tidak ikut");
  const b = r.j.rows.find((x) => x.nama === "Budi Santoso");
  assert.equal(b.purin, 500); assert.equal(b.purinOk, false); assert.equal(b.lab, 8.2); assert.equal(b.labStatus, "Tinggi");
  assert.equal(b.td, "140/90"); assert.equal(b.urgent, true); ok("isi harian sesuai rapor (purin, asam urat, tensi, keluhan)");

  r = await call("GET", "/api/admin/patients?date=" + D, null, A);
  assert.deepEqual(r.j.rows.map((x) => x.nama), ["Budi Santoso"]); ok("filter tanggal");
  r = await call("GET", "/api/admin/patients?q=siti", null, A);
  assert.deepEqual(r.j.rows.map((x) => x.nama), ["Siti Aminah"]); ok("cari nama");
  r = await call("GET", "/api/admin/patients?q=BUDI@MAIL", null, A);
  assert.equal(r.j.rows.length, 1); ok("cari email (tidak peka huruf besar)");
  assert.equal((await call("GET", "/api/admin/patients?date=besok", null, A)).s, 400); ok("format tanggal salah ditolak");

  /* Pasien tidak bisa menaikkan dirinya lewat profil/ops */
  await call("POST", "/api/me/ops", { ops: [{ op: "profile", patch: { role: "admin", nama: "Budi S" } }] }, P1);
  assert.equal((await call("GET", "/api/admin/patients", null, P1)).s, 403); ok("role tidak bisa diubah lewat /me/ops");

  /* Login dengan sandi ber-kunci menjadikan admin (akun lama) */
  await call("POST", "/api/register", { nama: "Dokter Lama", email: "lama@mail.com", password: "biasa123", jk: "L" });
  await call("POST", "/api/me/password", { oldPassword: "biasa123", newPassword: "ADMINGOUTCARE99" }, (await call("POST", "/api/login", { email: "lama@mail.com", password: "biasa123" })).j.token);
  r = await call("POST", "/api/login", { email: "lama@mail.com", password: "ADMINGOUTCARE99" });
  assert.equal(r.j.user.role, "admin"); ok("login dengan sandi ber-ADMINGOUTCARE = admin");
  r = await call("POST", "/api/login", { email: "budi@mail.com", password: "rahasia1" });
  assert.equal(r.j.user.role, "user"); ok("login pasien biasa tetap user");
  console.log(`\n${n} uji lulus`);
} catch (e) { console.error("GAGAL:", e.message); process.exitCode = 1; } finally { srv.kill(); }
