/* Pengingat lewat email.
   Dijalankan berkala (server lokal: tiap menit; Netlify: Scheduled Function tiap 5 menit).
   Aturan: pengingat dikirim bila jamnya jatuh dalam WINDOW menit terakhir dan belum pernah
   dikirim untuk jam itu (ditandai di kolom `sent` pada baris pengingat), jadi tidak dobel.
   Zona waktu: env REMINDER_TZ (default Asia/Jakarta). */
import { sendMail } from "./mailer.js";

export const WINDOW = 10; // menit toleransi keterlambatan penjadwal
const pad = (n) => String(n).padStart(2, "0");
const hhmm = (m) => pad(Math.floor(m / 60)) + ":" + pad(m % 60);

export function localParts(date, tz = "Asia/Jakarta") {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date).map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
}
const shiftDay = (d, n) => { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

/* Menit-menit (dalam sehari) saat pengingat ini berbunyi pada tanggal d */
function slotsFor(r, d) {
  const [h, m] = r.time.split(":").map(Number), start = h * 60 + m;
  if (r.key === "cek") return Number(d.slice(8, 10)) === 5 ? [start] : []; // "Setiap tanggal 5"
  return [start]; // "Setiap hari" dan pengingat lain
}

/* Kunci slot terbaru yang jatuh tempo untuk satu pengingat, atau null */
export function dueKey(r, local) {
  if (!r || !r.on || r.key === "air" || !/^\d{2}:\d{2}$/.test(r.time || "")) return null;
  let best = null;
  for (const off of [0, -1]) {
    const d = off ? shiftDay(local.date, -1) : local.date, now = local.min + (off ? 1440 : 0);
    for (const s of slotsFor(r, d)) if (now - s >= 0 && now - s < WINDOW) { const k = `${d}T${hhmm(s)}`; if (!best || k > best) best = k; }
  }
  return best && !(r.sent && r.sent >= best) ? best : null;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Template admin: {{nama}} {{judul}} (daftar judul, dipisah koma) {{jumlah}}. Kosong = teks bawaan. */
const fill = (t, v) => String(t).replace(/\{\{(nama|judul|jumlah)\}\}/g, (_, k) => v[k]);

export function buildEmail(user, titles, appUrl, { test = false, tpl = {}, site = "Gout Care" } = {}) {
  const nama = user.nama || "";
  const v = { nama, judul: titles.join(", "), jumlah: String(titles.length) };
  const subject = test
    ? `Email percobaan ${site}`
    : tpl.subject ? fill(tpl.subject, v) : titles.length === 1 ? `Pengingat: ${titles[0]}` : `Pengingat ${site} (${titles.length})`;
  const intro = test ? "Ini email percobaan. Pengingatmu akan dikirim ke alamat ini." : tpl.intro ? fill(tpl.intro, v) : "Waktunya untuk:";
  const footer = tpl.footer ? fill(tpl.footer, v) : "Matikan pengingat email kapan saja di menu Pengingat.";
  const text = [`Halo ${nama},`, "", intro, ...(test ? [] : titles.map((t) => "- " + t)), "", appUrl ? `Buka ${site}: ` + appUrl : "", "", footer].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");
  const html = `<div style="font-family:system-ui,Segoe UI,sans-serif;max-width:480px;margin:auto;padding:24px;color:#14212c">
<div style="font-size:20px;font-weight:700;margin-bottom:12px">${esc(site)}</div>
<p>Halo ${esc(nama)},</p><p>${esc(intro)}</p>
${test ? "" : `<ul style="padding-left:20px;font-size:16px;line-height:1.7">${titles.map((t) => `<li><b>${esc(t)}</b></li>`).join("")}</ul>`}
${appUrl ? `<p><a href="${esc(appUrl)}" style="display:inline-block;background:#1d6a8a;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">Buka ${esc(site)}</a></p>` : ""}
<p style="color:#5b6b78;font-size:13px">${esc(footer)}</p></div>`;
  return { subject, text, html };
}

export async function runReminders({ storage, env, now = new Date(), send = sendMail }) {
  const tz = env.REMINDER_TZ || "Asia/Jakarta", local = localParts(now, tz);
  const appUrl = env.APP_URL || env.URL || "";
  const res = { users: 0, sent: 0, failed: 0 };
  const st = (await storage.getMeta?.("settings")) || {}, tpl = st.mail || {}, site = st.siteName || "Gout Care";
  for (const doc of await storage.allDocs()) {
    res.users++;
    if (doc.user.remEmail === false || !doc.user.email) continue;
    const due = (doc.reminders || []).map((r) => [r, dueKey(r, local)]).filter((x) => x[1]);
    if (!due.length) continue;
    const mail = buildEmail(doc.user, due.map(([r]) => r.title), appUrl, { tpl, site });
    const r = await send({ to: doc.user.email, ...mail }, env);
    try { await storage.appendLog?.("maillog", { t: new Date().toISOString(), to: doc.user.email, subject: mail.subject, kind: "pengingat", ok: !!r.ok, error: r.ok ? "" : String(r.error || "").slice(0, 200) }); } catch { /* log opsional */ }
    if (!r.ok) { res.failed++; console.error("[reminders] gagal kirim:", r.error); continue; }
    await storage.lock(doc.user.id, async () => {
      const fresh = await storage.getDoc(doc.user.id);
      if (!fresh) return;
      for (const [row, key] of due) { const f = fresh.reminders.find((x) => x.id === row.id); if (f) f.sent = key; }
      await storage.saveDoc(fresh);
    });
    res.sent++;
  }
  return res;
}
