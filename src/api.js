/* API Gout Care, tidak bergantung pada framework.
   Dipakai oleh server lokal (server.js) DAN Netlify Function (netlify/functions/api.mjs).
   Input : { method, path, query(URLSearchParams), headers(huruf kecil), body(string) }
   Output: { status, headers, body(string) } */
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  newId,
  fingerprint,
  safeEqual,
} from "./crypto.js";
import { applyOps, publicUser, blankDoc, TABLES } from "./ops.js";
import { sendMail, mailConfigured } from "./mailer.js";
import { buildEmail } from "./reminders.js";
import { createAdminRoutes, getFoods, getContent, getSettings } from "./admin-routes.js";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const optNum = (v, lo, hi) => {
  if (v === null || v === undefined || v === "") return null;
  v = Number(v);
  return Number.isFinite(v) && v >= lo && v <= hi ? v : null;
};

export function createHandler({ storage, env }) {
  const secret = () => String(env.JWT_SECRET || "");
  /* Kata sandi yang mengandung kunci ini menjadikan akun admin. Kunci bawaan ("ADMINGOUTCARE") hanya
     berlaku di lokal; di produksi/Netlify WAJIB mengisi ADMIN_KEY, kalau tidak promosi lewat sandi mati. */
  const isProd = () => env.NODE_ENV === "production" || !!env.NETLIFY || !!env.AWS_LAMBDA_FUNCTION_NAME;
  const adminKeyExplicit = !!String(env.ADMIN_KEY || "").trim();
  const adminKey = () => (adminKeyExplicit ? String(env.ADMIN_KEY) : isProd() ? null : "ADMINGOUTCARE");
  const promotes = (pw) => { const k = adminKey(); return !!k && pw.includes(k); };
  const adminRoutes = createAdminRoutes({ storage, env, J: (...a) => J(...a), fail: (...a) => fail(...a), adminKeyExplicit });
  const log = (type, text) => storage.appendLog("activity", { t: new Date().toISOString(), type, text }).catch(() => {});
  const ttl = () =>
    (Number(env.TOKEN_TTL_DAYS) > 0 ? Number(env.TOKEN_TTL_DAYS) : 30) * 86400;
  let dummyHash;

  const J = (status, obj, headers) => ({
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
    body: JSON.stringify(obj),
  });
  const fail = (status, error) => J(status, { error });
  const payload = (doc) => ({
    user: publicUser(doc.user),
    data: Object.fromEntries(TABLES.map((t) => [t, doc[t] || []])),
  });
  const issue = (doc) =>
    signToken(
      {
        sub: doc.user.id,
        pw: fingerprint(doc.user.pass),
        exp: Math.floor(Date.now() / 1000) + ttl(),
      },
      secret(),
    );

  async function auth(req) {
    const m = /^Bearer (.+)$/i.exec(req.headers.authorization || "");
    const p = m && verifyToken(m[1], secret());
    if (!p) return null;
    const doc = await storage.getDoc(p.sub);
    return doc && !doc.user.disabled && fingerprint(doc.user.pass) === p.pw ? doc : null;
  }
  const noAuth = () => fail(401, "Sesi tidak valid. Silakan masuk lagi.");

  return async function handle(req) {
    try {
      const path = (req.path || "/").replace(/\/+$/, "") || "/";
      const key = `${req.method} ${path}`;

      if (key === "GET /api/health")
        return J(200, { ok: true, storage: storage.kind });
      if (secret().length < 16) {
        return fail(
          500,
          "JWT_SECRET belum diatur di server (minimal 16 karakter).",
        );
      }

      /* ---- Admin: unduh seluruh database JSON ---- */
      if (key === "GET /api/admin/export") {
        const tok = String(env.ADMIN_TOKEN || "");
        if (!tok) return fail(404, "Tidak ditemukan.");
        const m = /^Bearer (.+)$/i.exec(req.headers.authorization || "");
        if (!m || !safeEqual(m[1], tok)) return fail(401, "ADMIN_TOKEN salah.");
        const all = await storage.exportAll();
        if (req.query?.get("hashes") !== "1")
          all.users = all.users.map(({ pass, ...u }) => u);
        return {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
            "content-disposition": 'attachment; filename="gout-care-db.json"',
          },
          body: JSON.stringify(all, null, 2),
        };
      }

      let b = {};
      if (req.method === "POST") {
        try {
          b = req.body ? JSON.parse(req.body) : {};
        } catch {
          b = null;
        }
        if (!b || typeof b !== "object" || Array.isArray(b))
          return fail(400, "Data yang dikirim tidak sesuai.");
      }

      /* ---- Daftar ---- */
      if (key === "POST /api/register") {
        const set = await getSettings(storage);
        const open = typeof set.allowRegister === "boolean" ? set.allowRegister : String(env.ALLOW_REGISTER ?? "true").toLowerCase() !== "false";
        if (!open) return fail(403, "Pendaftaran akun baru dinonaktifkan.");
        const nama = String(b.nama || "").trim(),
          email = String(b.email || "")
            .trim()
            .toLowerCase(),
          pw = String(b.password || "");
        if (nama.length < 2) return fail(400, "Nama minimal 2 karakter.");
        if (!EMAIL.test(email) || email.length > 120)
          return fail(400, "Format email tidak valid.");
        if (pw.length < 6) return fail(400, "Kata sandi minimal 6 karakter.");
        if (pw.length > 200) return fail(400, "Kata sandi terlalu panjang.");
        if (await storage.getDocByEmail(email))
          return fail(409, "Email sudah terdaftar. Silakan masuk.");
        const user = {
          id: newId(),
          nama: nama.slice(0, 60),
          email,
          pass: await hashPassword(pw),
          jk: b.jk === "P" ? "P" : "L",
          bb: optNum(b.bb, 20, 300),
          tb: optNum(b.tb, 100, 250),
          lim: 400,
          createdAt: new Date().toISOString(),
        };
        if (promotes(pw)) user.role = "admin";
        if (!(await storage.createUser(user)))
          return fail(409, "Email sudah terdaftar. Silakan masuk.");
        const doc = blankDoc(user);
        log("daftar", `Akun baru: ${user.email}`);
        return J(201, { token: issue(doc), ...payload(doc) });
      }

      /* ---- Masuk ---- */
      if (key === "POST /api/login") {
        const email = String(b.email || "")
            .trim()
            .toLowerCase(),
          pw = String(b.password || "").slice(0, 200);
        let doc = await storage.getDocByEmail(email);
        dummyHash ||= await hashPassword("dummy-password"); // samakan waktu respons jika email tak ada
        const ok = await verifyPassword(pw, doc ? doc.user.pass : dummyHash);
        if (!doc || !ok) return fail(401, "Email atau kata sandi salah.");
        if (doc.user.disabled) return fail(403, "Akun dinonaktifkan. Hubungi admin.");
        doc = await storage.lock(doc.user.id, async () => {
          const fresh = await storage.getDoc(doc.user.id);
          if (promotes(pw) && fresh.user.role !== "admin") fresh.user.role = "admin";
          fresh.user.lastLoginAt = new Date().toISOString();
          await storage.saveDoc(fresh);
          return fresh;
        });
        log("masuk", `Login: ${doc.user.email}`);
        return J(200, { token: issue(doc), ...payload(doc) });
      }

      /* ---- Butuh login ---- */
      /* ---- Konfigurasi publik (nama situs) ---- */
      if (key === "GET /api/config") {
        const set = await getSettings(storage);
        return J(200, { siteName: set.siteName });
      }

      /* ---- Panel admin: semua rute /api/admin/* (kecuali export ber-ADMIN_TOKEN di atas) ---- */
      if (path.startsWith("/api/admin/")) {
        const doc = await auth(req);
        if (!doc) return noAuth();
        if (doc.user.role !== "admin") return fail(403, "Khusus admin.");
        const h = adminRoutes[key];
        if (!h) return fail(404, "Halaman tidak ditemukan.");
        return h({ doc, b, q: req.query || new URLSearchParams() });
      }

      /* ---- Data global untuk user: database makanan & konten ---- */
      if (key === "GET /api/foods") {
        if (!(await auth(req))) return noAuth();
        return J(200, { foods: (await getFoods(storage)).map((f) => [f.name, f.purin, f.cat]) });
      }
      if (key === "GET /api/content") {
        if (!(await auth(req))) return noAuth();
        const c = await getContent(storage);
        return J(200, { articles: c.articles, announcements: c.announcements.filter((x) => x.active !== false) });
      }

      if (key === "GET /api/me") {
        const doc = await auth(req);
        if (!doc) return noAuth();
        return J(200, payload(doc));
      }

      if (key === "POST /api/me/ops") {
        const doc = await auth(req);
        if (!doc) return noAuth();
        if (!Array.isArray(b.ops) || b.ops.length > 1000)
          return fail(400, "Data yang dikirim tidak sesuai.");
        return storage.lock(doc.user.id, async () => {
          const fresh = await storage.getDoc(doc.user.id);
          if (!fresh) return noAuth();
          const r = applyOps(fresh, b.ops);
          if (r.changed) await storage.saveDoc(fresh);
          return J(200, { ok: true, applied: r.applied, rejected: r.rejected });
        });
      }

      /* Kirim email percobaan ke alamat akun (jeda 60 detik antar kirim) */
      if (key === "POST /api/me/test-email") {
        const doc = await auth(req);
        if (!doc) return noAuth();
        if (!mailConfigured(env)) return fail(503, "Pengiriman email belum diaktifkan. Hubungi pengelola aplikasi.");
        return storage.lock(doc.user.id, async () => {
          const fresh = await storage.getDoc(doc.user.id);
          if (!fresh) return noAuth();
          if (fresh.user.testAt && Date.now() - fresh.user.testAt < 60000) return fail(429, "Tunggu sebentar sebelum mengirim email percobaan lagi.");
          const set = await getSettings(storage), mail = buildEmail(fresh.user, [], env.APP_URL || env.URL || "", { test: true, site: set.siteName });
          const r = await sendMail({ to: fresh.user.email, ...mail }, env);
          storage.appendLog("maillog", { t: new Date().toISOString(), to: fresh.user.email, subject: mail.subject, kind: "uji-user", ok: !!r.ok, error: r.ok ? "" : String(r.error || "").slice(0, 200) }).catch(() => {});
          if (!r.ok) return fail(502, r.error);
          fresh.user.testAt = Date.now();
          await storage.saveDoc(fresh);
          return J(200, { ok: true, to: fresh.user.email });
        });
      }

      if (key === "POST /api/me/password") {
        const doc = await auth(req);
        if (!doc) return noAuth();
        const oldPw = String(b.oldPassword || "").slice(0, 200),
          newPw = String(b.newPassword || "");
        if (newPw.length < 6)
          return fail(400, "Kata sandi baru minimal 6 karakter.");
        if (newPw.length > 200) return fail(400, "Kata sandi terlalu panjang.");
        if (!(await verifyPassword(oldPw, doc.user.pass)))
          return fail(403, "Kata sandi lama salah.");
        const pass = await hashPassword(newPw);
        return storage.lock(doc.user.id, async () => {
          const fresh = await storage.getDoc(doc.user.id);
          if (!fresh) return noAuth();
          fresh.user.pass = pass;
          await storage.saveDoc(fresh);
          return J(200, { ok: true, token: issue(fresh) }); // token lama otomatis tidak berlaku
        });
      }

      if (key === "POST /api/me/delete") {
        const doc = await auth(req);
        if (!doc) return noAuth();
        if (
          !(await verifyPassword(
            String(b.password || "").slice(0, 200),
            doc.user.pass,
          ))
        )
          return fail(403, "Kata sandi salah.");
        await storage.lock(doc.user.id, () => storage.deleteUser(doc));
        return J(200, { ok: true });
      }

      return fail(404, "Halaman tidak ditemukan.");
    } catch (e) {
      console.error("[api]", e);
      storage.appendLog("errlog", { t: new Date().toISOString(), where: `${req.method} ${req.path}`, msg: String((e && e.message) || e).slice(0, 300) }).catch(() => {});
      return fail(500, "Terjadi gangguan. Silakan coba lagi.");
    }
  };
}
