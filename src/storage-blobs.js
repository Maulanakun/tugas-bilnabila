/* Penyimpanan JSON di Netlify Blobs (untuk Netlify, karena disk Netlify tidak permanen).
   Satu dokumen JSON per user:  users/<id>  = { user, labs, meals, vitals, reminders, moods }
   Indeks email:                emails/<sha256(email)> = <id>
   Di Netlify tidak perlu env apa pun untuk Blobs; terhubung otomatis. */
import { createHash } from "node:crypto";
import { TABLES } from "./ops.js";

export async function createBlobStorage(name = "gout-care") {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name, consistency: "strong" });
  const emailKey = (e) => "emails/" + createHash("sha256").update(e).digest("hex");
  const userKey = (id) => "users/" + id;

  const api = {
    kind: "netlify-blobs",
    async init() {},
    lock(_id, fn) { return fn(); }, // tidak ada kunci lintas-instans di Blobs; jendela tabrakan sangat kecil
    async getDoc(id) { return (await store.get(userKey(id), { type: "json" })) || null; },
    async getDocByEmail(email) {
      const id = await store.get(emailKey(email), { type: "text" });
      return id ? api.getDoc(id) : null;
    },
    async createUser(user) {
      const r = await store.set(emailKey(user.email), user.id, { onlyIfNew: true });
      if (r && r.modified === false) return false; // email sudah dipakai
      const doc = { user }; TABLES.forEach((t) => (doc[t] = []));
      await store.setJSON(userKey(user.id), doc);
      return true;
    },
    async saveDoc(doc) { await store.setJSON(userKey(doc.user.id), doc); },
    async deleteUser(doc) {
      await store.delete(userKey(doc.user.id));
      await store.delete(emailKey(doc.user.email));
    },
    /* Gabungkan semua dokumen user menjadi skema satu-file (sama dengan db.json lokal) */
    async exportAll() {
      const out = { app: "gout-care", version: 2, users: [] };
      TABLES.forEach((t) => (out[t] = []));
      const { blobs } = await store.list({ prefix: "users/" });
      for (const b of blobs) {
        const d = await store.get(b.key, { type: "json" });
        if (!d) continue;
        out.users.push(d.user);
        TABLES.forEach((t) => out[t].push(...(d[t] || [])));
      }
      return out;
    },
  };
  return api;
}
