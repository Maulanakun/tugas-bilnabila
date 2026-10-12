/* Server lokal Gout Care: menyajikan folder public/ + API di /api/*.
   Database berupa file JSON (default: data/db.json) yang otomatis dibuat. Tanpa dependensi npm.
   Jalankan:  npm start   lalu buka http://localhost:3000 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createHandler } from "./src/api.js";
import { createFileStorage } from "./src/storage-file.js";
import { runReminders } from "./src/reminders.js";

try {
  process.loadEnvFile();
} catch {
  /* .env tidak ada: tidak apa-apa */
}
console.log(
  "JWT_SECRET terbaca, panjang:",
  (process.env.JWT_SECRET || "").length,
); // <-- tambahkan baris ini

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, "public");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const DATA_FILE = path.resolve(ROOT, process.env.DATA_FILE || "data/db.json");

/* JWT_SECRET: pakai dari .env; jika kosong (mode dev) buat otomatis & simpan di data/.jwt-secret */
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error("JWT_SECRET wajib diisi di produksi.");
    process.exit(1);
  }
  const f = path.join(path.dirname(DATA_FILE), ".jwt-secret");
  fs.mkdirSync(path.dirname(f), { recursive: true });
  if (!fs.existsSync(f))
    fs.writeFileSync(f, randomBytes(32).toString("hex"), { mode: 0o600 });
  process.env.JWT_SECRET = fs.readFileSync(f, "utf8").trim();
  console.log("ℹ️  JWT_SECRET tidak diisi di .env, memakai kunci dev di", f);
}

const storage = createFileStorage(DATA_FILE);
await storage.init(); // membuat data/db.json bila belum ada
const handle = createHandler({ storage, env: process.env });

/* Penjadwal pengingat email: cek tiap menit (matikan dengan REMINDERS_ENABLED=false) */
if (String(process.env.REMINDERS_ENABLED ?? "true").toLowerCase() !== "false") {
  const tick = () => runReminders({ storage, env: process.env }).then((r) => r.sent && console.log("[reminders] terkirim:", r.sent)).catch((e) => console.error("[reminders]", e.message));
  setInterval(tick, 60000).unref();
  setTimeout(tick, 5000).unref();
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};
const MAX_BODY = 2 * 1024 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("too large"), { code: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) {
      const body = ["GET", "HEAD"].includes(req.method)
        ? ""
        : await readBody(req);
      const r = await handle({
        method: req.method,
        path: url.pathname,
        query: url.searchParams,
        headers: req.headers,
        body,
      });
      res.writeHead(r.status, r.headers);
      res.end(r.body);
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      res.end();
      return;
    }
    let rel;
    try {
      rel = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    let file = path.join(PUBLIC, rel);
    if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory())
      file = path.join(file, "index.html");
    if (!fs.existsSync(file)) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("404 Tidak ditemukan");
      return;
    }
    res.writeHead(200, {
      "content-type": MIME[path.extname(file)] || "application/octet-stream",
      "cache-control": "no-cache",
    });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    const code = e.code === 413 ? 413 : 500;
    if (code === 500) console.error(e);
    if (!res.headersSent)
      res.writeHead(code, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        error: code === 413 ? "Permintaan terlalu besar." : "Kesalahan server.",
      }),
    );
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    `\n🩺 Gout Care berjalan di  http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`,
  );
  console.log(`📁 File database JSON    : ${DATA_FILE}\n`);
});
