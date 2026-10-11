/* Penyimpanan ke SATU file JSON di disk (untuk server lokal / VPS).
   Isi file = skema asli aplikasi: users, labs, meals, vitals, reminders, moods. */
import fs from "node:fs/promises";
import path from "node:path";
import { TABLES } from "./ops.js";

export function createFileStorage(file) {
  let db = null, loading = null, w = Promise.resolve(), chain = Promise.resolve();
  const blank = () => { const d = { app: "gout-care", version: 2, users: [] }; TABLES.forEach((t) => (d[t] = [])); return d; };

  async function doWrite() {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = file + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(db, null, 2));
    await fs.rename(tmp, file); // tulis atomik: file tidak pernah setengah jadi
  }
  const persist = () => { const p = w.then(doWrite); w = p.catch(() => {}); return p; };

  async function ensure() {
    if (db) return db;
    if (!loading) loading = (async () => {
      let raw;
      try { raw = await fs.readFile(file, "utf8"); }
      catch (e) { if (e.code !== "ENOENT") throw e; db = blank(); await persist(); return; }
      if (!raw.trim()) { db = blank(); await persist(); return; }
      let o;
      try { o = JSON.parse(raw); } catch { throw new Error(`File ${file} bukan JSON valid. Perbaiki atau hapus file itu (tidak ditimpa otomatis).`); }
      if (!o || typeof o !== "object" || !Array.isArray(o.users)) throw new Error(`File ${file} bukan data Gout Care.`);
      db = Object.assign(blank(), o);
      TABLES.forEach((t) => { if (!Array.isArray(db[t])) db[t] = []; });
    })();
    await loading;
    return db;
  }

  const docOf = (u) => {
    const d = { user: structuredClone(u) };
    TABLES.forEach((t) => (d[t] = structuredClone(db[t].filter((r) => r.userId === u.id))));
    return d;
  };

  return {
    kind: "file-json",
    file,
    init: ensure,
    /* Serialisasi baca-ubah-tulis per proses agar dua request tidak saling menimpa */
    lock(_id, fn) { const p = chain.then(() => fn()); chain = p.catch(() => {}); return p; },
    async getDoc(id) { await ensure(); const u = db.users.find((x) => x.id === id); return u ? docOf(u) : null; },
    async getDocByEmail(email) { await ensure(); const u = db.users.find((x) => x.email === email); return u ? docOf(u) : null; },
    async createUser(user) {
      await ensure();
      if (db.users.some((u) => u.email === user.email)) return false;
      db.users.push(user); await persist(); return true;
    },
    async saveDoc(doc) {
      await ensure();
      const i = db.users.findIndex((u) => u.id === doc.user.id);
      if (i < 0) return;
      db.users[i] = doc.user;
      TABLES.forEach((t) => { db[t] = db[t].filter((r) => r.userId !== doc.user.id).concat(doc[t]); });
      await persist();
    },
    async deleteUser(doc) {
      await ensure();
      const id = doc.user.id;
      db.users = db.users.filter((u) => u.id !== id);
      TABLES.forEach((t) => { db[t] = db[t].filter((r) => r.userId !== id); });
      await persist();
    },
    async exportAll() { await ensure(); return structuredClone(db); },
  };
}
