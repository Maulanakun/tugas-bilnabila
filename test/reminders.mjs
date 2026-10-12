/* Uji pengingat email: jadwal, anti-dobel, saklar user, dan penjadwal (tanpa mengirim email sungguhan). */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { dueKey, localParts, runReminders } from "../src/reminders.js";
import { createFileStorage } from "../src/storage-file.js";
import { blankDoc } from "../src/ops.js";

let n = 0;
const ok = (m) => { n++; console.log("  ✓", m); };
const L = (date, h, m) => ({ date, min: h * 60 + m });
const R = (key, time, extra = {}) => ({ id: key, key, title: key, freq: "", time, on: 1, ...extra });

console.log("Jadwal");
assert.equal(dueKey(R("makan", "19:00"), L("2026-10-12", 19, 0)), "2026-10-12T19:00"); ok("harian: tepat jam");
assert.equal(dueKey(R("makan", "19:00"), L("2026-10-12", 19, 9)), "2026-10-12T19:00"); ok("harian: telat <10 menit tetap terkirim");
assert.equal(dueKey(R("makan", "19:00"), L("2026-10-12", 19, 10)), null); ok("harian: lewat jendela tidak dikirim");
assert.equal(dueKey(R("makan", "19:00"), L("2026-10-12", 18, 59)), null); ok("harian: belum waktunya");
assert.equal(dueKey(R("makan", "19:00", { on: 0 }), L("2026-10-12", 19, 0)), null); ok("pengingat nonaktif tidak dikirim");
assert.equal(dueKey(R("makan", "19:00", { sent: "2026-10-12T19:00" }), L("2026-10-12", 19, 3)), null); ok("sudah terkirim tidak dobel");
assert.equal(dueKey(R("makan", "19:00", { sent: "2026-10-11T19:00" }), L("2026-10-12", 19, 3)), "2026-10-12T19:00"); ok("terkirim kemarin, hari ini tetap kirim");
assert.equal(dueKey(R("cek", "08:00"), L("2026-10-05", 8, 2)), "2026-10-05T08:00"); ok("bulanan: tanggal 5");
assert.equal(dueKey(R("cek", "08:00"), L("2026-10-06", 8, 2)), null); ok("bulanan: bukan tanggal 5");
assert.equal(dueKey(R("air", "09:00"), L("2026-10-12", 13, 1)), "2026-10-12T13:00"); ok("tiap 2 jam: 09,11,13,...");
assert.equal(dueKey(R("air", "09:00"), L("2026-10-12", 12, 0)), null); ok("tiap 2 jam: jam genap di luar pola tidak dikirim");
assert.equal(dueKey(R("air", "09:00"), L("2026-10-12", 23, 0)), null); ok("tiap 2 jam: berhenti setelah 21:00");
assert.equal(dueKey(R("makan", "23:58"), L("2026-10-13", 0, 3)), "2026-10-12T23:58"); ok("melewati tengah malam");
const t = localParts(new Date("2026-10-12T12:30:00Z"), "Asia/Jakarta");
assert.deepEqual(t, { date: "2026-10-12", min: 19 * 60 + 30 }); ok("zona waktu WIB (UTC+7)");

console.log("Penjadwal");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gc-rem-"));
const storage = createFileStorage(path.join(dir, "db.json")); await storage.init();
const mk = async (id, email, remEmail) => {
  const user = { id, nama: id, email, pass: "x", jk: "L", lim: 400, createdAt: "", ...(remEmail === undefined ? {} : { remEmail }) };
  await storage.createUser(user);
  const doc = blankDoc(user); doc.reminders.push({ id: id + "r", userId: id, key: "makan", title: "Catat makanan hari ini", freq: "Setiap hari", time: "19:00", on: 1 });
  await storage.saveDoc(doc);
};
await mk("u1", "u1@x.com"); await mk("u2", "u2@x.com", false);
const sent = [];
const send = async (m) => { sent.push(m); return { ok: true }; };
const now = new Date("2026-10-12T12:02:00Z"); // 19:02 WIB
let r = await runReminders({ storage, env: {}, now, send });
assert.equal(sent.length, 1); assert.equal(sent[0].to, "u1@x.com"); assert.match(sent[0].subject, /Catat makanan/); assert.equal(r.sent, 1); ok("kirim ke user yang aktif, lewati yang mematikan email");
r = await runReminders({ storage, env: {}, now: new Date("2026-10-12T12:07:00Z"), send });
assert.equal(sent.length, 1); ok("jalan lagi 5 menit kemudian: tidak dobel");
const fail = async () => ({ ok: false, error: "x" });
await mk("u3", "u3@x.com");
r = await runReminders({ storage, env: {}, now: new Date("2026-10-12T12:04:00Z"), send: fail });
assert.equal(r.failed, 1); r = await runReminders({ storage, env: {}, now: new Date("2026-10-12T12:06:00Z"), send });
assert.ok(sent.some((m) => m.to === "u3@x.com")); ok("gagal kirim tidak ditandai terkirim, dicoba lagi di putaran berikutnya");
fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${n} pengujian pengingat lulus ✅`);
