/* Uji asap: jalankan server lokal sementara + uji API + uji kode klien (db.js/auth.js) terhadap server itu. */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gc-"));
const DATA = path.join(tmp, "db.json"), PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const srv = spawn("node", ["server.js"], { cwd: ROOT, env: { ...process.env, PORT, HOST: "127.0.0.1", DATA_FILE: DATA, JWT_SECRET: "x".repeat(40), ADMIN_TOKEN: "adm-secret", ALLOW_REGISTER: "true" }, stdio: ["ignore", "pipe", "inherit"] });
const stop = () => srv.kill();
process.on("exit", stop);

let pass = 0;
const ok = (name) => { pass++; console.log("  ✓", name); };
const call = async (method, p, body, token) => {
  const r = await fetch(BASE + p, { method, headers: { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};

try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  console.log("API");
  assert.ok(fs.existsSync(DATA)); ok("file db.json otomatis dibuat saat server start");
  assert.equal((await fetch(BASE + "/")).status, 200); ok("index.html disajikan");
  assert.equal((await fetch(BASE + "/..%2fserver.js")).status === 200, false); ok("path traversal ditolak");

  let r = await call("POST", "/api/register", { nama: "Budi", email: "Budi@Mail.com", password: "rahasia1", jk: "L", bb: 70, tb: 170 });
  assert.equal(r.s, 201); const A = r.j.token; const idA = r.j.user.id;
  assert.equal(r.j.user.pass, undefined); ok("daftar OK, hash sandi tidak bocor");
  assert.equal((await call("POST", "/api/register", { nama: "Dup", email: "budi@mail.com", password: "rahasia1" })).s, 409); ok("email ganda ditolak (tidak peka huruf besar)");
  assert.equal((await call("POST", "/api/login", { email: "budi@mail.com", password: "salah" })).s, 401); ok("login sandi salah ditolak");
  r = await call("POST", "/api/login", { email: "budi@mail.com", password: "rahasia1" }); assert.equal(r.s, 200); ok("login OK");
  assert.equal((await call("GET", "/api/me")).s, 401); ok("tanpa token ditolak");
  assert.equal((await call("GET", "/api/me", null, A + "x")).s, 401); ok("token dipalsukan ditolak");

  r = await call("POST", "/api/me/ops", { ops: [
    { op: "insert", t: "labs", row: { id: "lab1", userId: "orang-lain", d: "2026-10-01", v: 6.5 } },
    { op: "insert", t: "meals", row: { id: "m1", d: "2026-10-01", w: "Sarapan", n: "Tahu", g: 100, p: 68 } },
    { op: "insert", t: "labs", row: { id: "bad", d: "bukan-tanggal", v: 6 } },
    { op: "insert", t: "labs", row: { id: "lab1", d: "2026-10-01", v: 6.5 } },
    { op: "update", t: "labs", id: "lab1", patch: { v: 7.1, userId: "hack", id: "x" } },
    { op: "profile", patch: { lim: 150, email: "hack@x.com", pass: "hack" } },
  ] }, A);
  assert.equal(r.s, 200); assert.equal(r.j.rejected.length, 1); assert.equal(r.j.rejected[0].i, 2); ok("ops: yang valid diterapkan, yang salah ditolak per-baris");
  r = await call("GET", "/api/me", null, A);
  assert.equal(r.j.data.labs.length, 1); assert.equal(r.j.data.labs[0].v, 7.1); assert.equal(r.j.data.labs[0].userId, idA); assert.equal(r.j.data.labs[0].id, "lab1");
  assert.equal(r.j.user.lim, 150); assert.equal(r.j.user.email, "budi@mail.com"); ok("userId dipaksa ke pemilik; email/pass/id tak bisa diubah lewat ops");

  r = await call("POST", "/api/me/ops", { ops: [
    { op: "insert", t: "complaints", row: { id: "c1", userId: "orang-lain", d: "2026-10-12", t: "08:30", gejala: ["Nyeri sendi", "Demam"], lain: "Nyeri pergelangan kaki" } },
    { op: "insert", t: "complaints", row: { id: "c2", d: "2026-10-12", t: "25:99", gejala: [], lain: "" } },
    { op: "insert", t: "complaints", row: { id: "c3", d: "2026-10-12", gejala: ["Bengkak"] } },
    { op: "insert", t: "complaints", row: { id: "c4", d: "2026-10-12", t: "09:00", gejala: ["Bengkak"] } },
  ] }, A);
  assert.deepEqual(r.j.rejected.map((x) => x.i), [1, 2]);
  r = await call("GET", "/api/me", null, A);
  assert.equal(r.j.data.complaints.length, 2); assert.equal(r.j.data.complaints[0].userId, idA); assert.equal(r.j.data.complaints[0].lain, "Nyeri pergelangan kaki"); assert.deepEqual(r.j.data.complaints[1].gejala, ["Bengkak"]); assert.equal(r.j.data.complaints[1].lain, ""); ok("keluhan (complaints): disimpan, jam di luar 00:00-23:59 / tanpa jam ditolak, userId dipaksa ke pemilik");

  const B = (await call("POST", "/api/register", { nama: "Sari", email: "sari@mail.com", password: "rahasia2" })).j.token;
  assert.equal((await call("GET", "/api/me", null, B)).j.data.labs.length, 0);
  await call("POST", "/api/me/ops", { ops: [{ op: "remove", t: "labs", id: "lab1" }] }, B);
  assert.equal((await call("GET", "/api/me", null, A)).j.data.labs.length, 1); ok("data antar akun terpisah (B tak bisa hapus data A)");

  const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));
  assert.equal(raw.users.length, 2); assert.equal(raw.labs.length, 1); assert.ok(raw.users[0].pass.startsWith("scrypt$")); ok("file db.json berisi users/labs/dst; sandi ter-hash scrypt");

  r = await call("POST", "/api/me/password", { oldPassword: "salah", newPassword: "baru1234" }, A); assert.equal(r.s, 403);
  r = await call("POST", "/api/me/password", { oldPassword: "rahasia1", newPassword: "baru1234" }, A); assert.equal(r.s, 200);
  assert.equal((await call("GET", "/api/me", null, A)).s, 401); assert.equal((await call("GET", "/api/me", null, r.j.token)).s, 200); ok("ganti sandi: token lama mati, token baru jalan");

  assert.equal((await call("GET", "/api/admin/export")).s, 401); assert.equal((await call("GET", "/api/admin/export", null, "salah")).s, 401);
  r = await call("GET", "/api/admin/export", null, "adm-secret"); assert.equal(r.s, 200); assert.equal(r.j.users.length, 2); assert.equal(r.j.users[0].pass, undefined); ok("admin export: butuh ADMIN_TOKEN, hash sandi disembunyikan");

  r = await call("POST", "/api/me/delete", { password: "baru1234" }, B); assert.equal(r.s, 403);
  r = await call("POST", "/api/me/delete", { password: "rahasia2" }, B); assert.equal(r.s, 200);
  assert.equal(JSON.parse(fs.readFileSync(DATA, "utf8")).users.length, 1); ok("hapus akun menghapus user dari file");

  /* ---------- Uji kode KLIEN (public/js) terhadap server asli ---------- */
  console.log("KLIEN (db.js + auth.js)");
  const store = {};
  const sandbox = { console, setTimeout, clearTimeout, fetch: (u, o) => fetch(BASE + u, o), Promise, JSON, Date, Math,
    localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k] },
    document: { getElementById: () => ({ style: {}, set innerHTML(v) {} }) } };
  sandbox.window = { addEventListener() {} }; vm.createContext(sandbox);
  const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, "public/js", f), "utf8").replace(/^const (\w+)=/m, "globalThis.$1="), sandbox, { filename: f });
  ["data.js", "utils.js"].forEach(load); vm.runInContext("globalThis.U=U;globalThis.DEF_REM=DEF_REM;", sandbox);
  vm.runInContext("U.toast=(m)=>console.log('    toast:',m);", sandbox);
  ["api.js", "db.js", "auth.js"].forEach(load);
  const run = (code) => vm.runInContext(code, sandbox);
  const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b)); // objek dari vm beda realm

  r = await run(`Auth.register({nama:"Ani",email:"ani@mail.com",password:"abcdef",confirm:"abcdef",jk:"P",bb:"55",tb:"160"})`);
  same(r, { ok: true }); ok("klien: Auth.register");
  assert.equal(run("DB.table('reminders').length"), 3); ok("klien: 3 pengingat bawaan dibuat");
  run(`DB.insert("labs",{userId:Auth.current().id,d:"2026-10-02",v:5.9}); DB.insert("moods",{userId:Auth.current().id,d:"2026-10-02",mood:null,gejala:[]}); Auth.patch({lim:150,bb:60})`);
  assert.equal(await run("DB.flushNow()"), true);
  const mine = (await call("POST", "/api/login", { email: "ani@mail.com", password: "abcdef" })).j;
  assert.equal(mine.data.labs.length, 1); assert.equal(mine.data.reminders.length, 3); assert.equal(mine.data.moods.length, 1); assert.equal(mine.user.lim, 150); assert.equal(mine.user.bb, 60); ok("klien: perubahan sampai ke server");
  const exp = run("DB.exportJSON()"); assert.ok(!exp.includes("pass")); ok("klien: ekspor JSON tanpa hash sandi");
  await run("Auth.logout()"); assert.equal(run("Auth.current()"), null); assert.equal(store["goutcare.token"], undefined); ok("klien: logout membersihkan token & data");
  r = await run(`Auth.login("ani@mail.com","abcdef")`); same(r, { ok: true }); assert.equal(run("DB.table('labs').length"), 1); ok("klien: login memuat data dari server");
  assert.equal(await run("Auth.restore()"), "ok"); ok("klien: sesi dipulihkan dari token (reload halaman)");
  const imp = run(`DB.importJSON(${JSON.stringify(exp)})`); assert.equal(imp.rows, 0); ok("klien: impor file sendiri tidak menggandakan data");
  const legacy = { app: "gout-care", version: 1, users: [{ id: "old", email: "lama@x.com", pass: "pbkdf2:abc" }], labs: [{ id: "oldlab", userId: "old", d: "2026-01-01", v: 8 }], meals: [{ id: "oldm", userId: "old", d: "2026-01-01", w: "Sarapan", n: "Telur", g: 50, p: 3 }] };
  assert.equal(run(`DB.importJSON(${JSON.stringify(JSON.stringify(legacy))})`).rows, 2); await run("DB.flushNow()");
  r = await run(`Api.req("GET","/me")`); assert.equal(r.data.labs.length, 2); assert.equal(r.data.meals.length, 1); ok("klien: impor cadangan format lama dari versi tanpa-server");
  r = await run(`Auth.changePassword("abcdef","ghijkl","ghijkl")`); same(r, { ok: true }); assert.equal(await run("Auth.restore()"), "ok"); ok("klien: ganti sandi, token baru dipakai");
  r = await run(`Auth.deleteAccount("salah")`); assert.ok(r.error); r = await run(`Auth.deleteAccount("ghijkl")`); same(r, { ok: true }); ok("klien: hapus akun");

  console.log(`\n${pass} pengujian lulus ✅`);
} catch (e) {
  console.error("\n❌ GAGAL:", e.message); console.error(e.stack?.split("\n").slice(1, 4).join("\n")); process.exitCode = 1;
} finally { stop(); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(process.exitCode || 0); }
