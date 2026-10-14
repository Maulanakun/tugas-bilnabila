/* Pengirim email memakai nodemailer (SMTP).
   Env:
     SMTP_HOST   server SMTP, mis. smtp.gmail.com
     SMTP_PORT   587 (STARTTLS, default) atau 465 (SSL)
     SMTP_USER   akun/email untuk login SMTP
     SMTP_PASS   sandi SMTP (Gmail: "App Password" 16 huruf, BUKAN sandi akun biasa)
     MAIL_FROM   opsional, mis. "Gout Care <akunanda@gmail.com>". Kosong = "Gout Care <SMTP_USER>".
                 Gmail mewajibkan alamat pengirim = akun yang dipakai login.
     MAIL_MODE   isi "log" untuk uji lokal: email dicetak di konsol, tidak benar-benar dikirim.
   Hasil: { ok:true } | { ok:false, skipped:true, error } | { ok:false, error } */
const isLog = (env) => String(env.MAIL_MODE || "").toLowerCase() === "log";
export const mailConfigured = (env) => isLog(env) || !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

let cached = { key: "", tx: null };
async function transporter(env) {
  const key = [env.SMTP_HOST, env.SMTP_PORT, env.SMTP_USER, env.SMTP_PASS].join("|");
  if (cached.key === key && cached.tx) return cached.tx;
  const { default: nodemailer } = await import("nodemailer");
  const port = Number(env.SMTP_PORT) || 587;
  const tx = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = SSL langsung; 587 = STARTTLS otomatis
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
  cached = { key, tx };
  return tx;
}

export async function sendMail({ to, subject, html, text }, env) {
  if (isLog(env)) {
    console.log(`[mail:log] ke=${to} | ${subject}\n${text}\n`);
    return { ok: true, logged: true };
  }
  if (!mailConfigured(env))
    return { ok: false, skipped: true, error: "Pengiriman email belum diaktifkan. Hubungi pengelola aplikasi." };
  try {
    const tx = await transporter(env);
    await tx.sendMail({ from: env.MAIL_FROM || `Gout Care <${env.SMTP_USER}>`, to, subject, text, html });
    return { ok: true };
  } catch (e) {
    cached = { key: "", tx: null }; // buat koneksi baru pada percobaan berikutnya
    const m = e && e.code === "EAUTH" ? "Akun email pengirim ditolak. Hubungi pengelola aplikasi." : e && e.code === "MODULE_NOT_FOUND" ? "Fitur pengiriman email belum terpasang lengkap. Hubungi pengelola aplikasi." : (e && e.message) || String(e);
    return { ok: false, error: "Gagal mengirim email: " + m };
  }
}
