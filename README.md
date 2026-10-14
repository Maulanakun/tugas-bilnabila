# Gout Care (versi server)

Aplikasi pemantau asam urat. Sekarang punya **server + database JSON**:

- **Lokal**: data tersimpan di file nyata `data/db.json` (muncul otomatis saat server dijalankan).
- **Netlify**: data tersimpan sebagai JSON di **Netlify Blobs** (disk Netlify tidak permanen, jadi file biasa tidak bisa dipakai di sana).

## Jalankan lokal (tanpa install apa pun)
```bash
cp .env.example .env     # opsional; tanpa .env pun jalan
npm start                # buka http://localhost:3000
```
File `data/db.json` langsung dibuat dan terisi setiap ada akun/catatan baru.
Butuh Node 20.12+. Tes otomatis: `npm test`.

## Deploy ke Netlify
1. Push folder ini ke GitHub/GitLab (`.gitignore` sudah menyingkirkan `.env` dan `data/`).
2. Netlify > **Add new site > Import from Git** > pilih repo. Pengaturan build terbaca dari `netlify.toml` (tidak perlu diisi).
3. **Site configuration > Environment variables** > tambahkan variabel di tabel bawah (minimal `JWT_SECRET`).
4. Deploy. Selesai. Netlify Blobs aktif otomatis, tanpa env tambahan.

Alternatif CLI: `npm i -g netlify-cli && npm install && netlify deploy --prod`.
Jangan pakai drag-and-drop folder: Function butuh `npm install` (paket `@netlify/blobs`).
Uji lokal dengan emulasi Netlify: `netlify dev`.

## Isi .env / Environment variables
| Variabel | Wajib? | Fungsi |
|---|---|---|
| `JWT_SECRET` | **Wajib di Netlify** | Kunci rahasia penanda token login. Min. 16 karakter. Buat: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Jika diganti, semua orang harus login ulang. |
| `ADMIN_KEY` | **Wajib di produksi** | Kata kunci rahasia: akun yang mendaftar/masuk dengan kata sandi yang *mengandung* teks ini menjadi admin. Di lokal, jika kosong dipakai `ADMINGOUTCARE`; di Netlify/produksi, jika kosong promosi ini **dimatikan** (kata kunci bawaan itu publik). Admin yang sudah ada tetap admin. |
| `ADMIN_TOKEN` | Opsional | Kata kunci untuk mengunduh seluruh database JSON (lihat bawah). Kosong = fitur mati. |
| `ALLOW_REGISTER` | Opsional | `false` untuk menutup pendaftaran baru. Default `true`. |
| `TOKEN_TTL_DAYS` | Opsional | Lama login bertahan (hari). Default `30`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Untuk email | Akun SMTP pengirim email pengingat (lihat bagian Pengingat lewat email). `MAIL_FROM` opsional. |
| `REMINDER_TZ`, `APP_URL`, `MAIL_MODE`, `REMINDERS_ENABLED` | Opsional | Zona waktu (default Asia/Jakarta), alamat aplikasi di email, mode uji `log`, dan sakelar penjadwal lokal. |
| `PORT`, `HOST`, `DATA_FILE` | Lokal saja | Port (3000), alamat (127.0.0.1; pakai `0.0.0.0` agar bisa dibuka dari HP di Wi-Fi sama), lokasi file db (`data/db.json`). Diabaikan di Netlify. |

Lokal tanpa `JWT_SECRET`: kunci dev dibuat otomatis di `data/.jwt-secret`.

## Pengingat lewat email
Pengingat yang aktif di menu **Pengingat** dikirim ke email akun user pada jam yang diatur (waktu `REMINDER_TZ`, default WIB).
- **Pengirim email**: SMTP lewat nodemailer. Isi `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (Gmail: pakai *App Password*). Jalankan `npm install` setelah pembaruan ini. Tanpa isian ini email tidak terkirim (tombol "Kirim email percobaan" akan memberi tahu).
- **Jadwal**: lokal, server memeriksa tiap menit. Di Netlify, `netlify/functions/reminders.mjs` berjalan otomatis tiap 5 menit (hanya pada deploy produksi). Email bisa terlambat sampai ±5-10 menit di Netlify.
- Aturan: *Cek asam urat bulanan* tiap tanggal 5; *Catat makanan* tiap hari. Beberapa pengingat pada jam sama digabung jadi satu email, dan tidak dikirim dobel.
- User bisa mematikan email dengan saklar "Kirim pengingat ke email".
- Uji lokal tanpa SMTP: isi `MAIL_MODE=log`, isi email muncul di konsol server.

## Mengambil file JSON dari Netlify
Set `ADMIN_TOKEN`, lalu:
```bash
curl -H "Authorization: Bearer ISI_ADMIN_TOKEN" https://NAMA-SITUS.netlify.app/api/admin/export -o gout-care-db.json
```
Hasilnya sama bentuknya dengan `data/db.json` lokal (hash sandi disembunyikan; tambahkan `?hashes=1` untuk menyertakan).
Pengguna biasa juga bisa **Akun > Ekspor data saya (JSON)** di aplikasi.

## Panel admin
Masuk dengan akun admin, panel terbuka otomatis. Sembilan tab:
| Tab | Isi |
|---|---|
| Dashboard | Total pasien, pasien aktif (7 hari), pasien & catatan baru hari ini, tren 14 hari, notifikasi (keluhan perlu dicek, asam urat tinggi, email gagal, SMTP/ADMIN_KEY belum diatur) |
| Pasien | Daftar + cari/filter/urut; detail per pasien (nonaktifkan, reset sandi, hapus, grafik **rata-rata pasien vs seluruh pasien**); "Catatan harian" per tanggal |
| Statistik | Rata-rata asam urat per bulan, purin harian, tensi, distribusi status, makanan teratas, gejala terbanyak (seluruh pasien) |
| Makanan | Kelola database makanan & kadar purin (ini yang dibaca aplikasi pasien; `public/js/data.js` hanya cadangan) |
| Konten | Pengumuman (muncul di Ringkasan) dan artikel edukasi tambahan |
| Pengingat | Template email (subjek/pembuka/penutup, kode `[nama]` `[judul]` `[jumlah]`), status SMTP, email terkirim |
| Laporan | Unduh Excel/CSV (pasien, asam urat, makanan, tensi, keluhan, rekap bulanan, database makanan), cetak rekap ke PDF |
| Sistem | Nama situs, buka/tutup pendaftaran, status SMTP, backup JSON |
| Log | Aktivitas (login, aksi admin), email, error server |

Catatan: "rata-rata keseluruhan" = rata-rata semua pengukuran pasien pada periode itu (bukan rata-rata dari rata-rata per pasien); jumlah pasien ditampilkan di samping. Data global (makanan, konten, pengaturan, log) disimpan di `meta` pada `db.json` (lokal) atau blob `meta/*` (Netlify). SMTP tetap hanya dari environment, tidak disimpan di database. Backup hanya mengunduh; belum ada fitur restore.

## Struktur
```
public/                 situs statis (index.html, css/, js/)
  js/api.js             klien API + token
  js/db.js              salinan data user + sinkron ke server (antrian, coba ulang)
  js/auth.js            daftar/masuk/keluar lewat server
src/api.js              seluruh rute API (dipakai lokal & Netlify)
src/ops.js              validasi data & penerapan operasi per user
src/admin-routes.js     rute /api/admin/* (pengguna, makanan, konten, pengaturan, log, ekspor)
src/stats.js            statistik & deret grafik (individu dan agregat)
src/xlsx.js             penulis CSV/XLSX tanpa dependensi
src/foods-seed.js       data makanan awal (dipindah dari data.js)
public/js/site.js       nama situs, makanan, pengumuman & artikel dari server
src/crypto.js           hash sandi (scrypt) + token HMAC
src/storage-file.js     database ke satu file JSON (lokal)
src/storage-blobs.js    database ke Netlify Blobs (Netlify)
server.js               server lokal (static + /api)
netlify/functions/api.mjs  Netlify Function untuk /api/*
test/smoke.mjs          tes otomatis
```

## Skema JSON (data/db.json)
```
users      {id, nama, email, pass(hash scrypt), jk, bb, tb, lim, createdAt}
labs       {id, userId, d, v}
meals      {id, userId, d, w, n, g, p}
vitals     {id, userId, d, td, k}
reminders  {id, userId, key, title, freq, time, on}
moods      {id, userId, d, mood, gejala[]}
complaints {id, userId, d, t(HH:MM), gejala[], lain}   <- keluhan dari modal "Ada keluhan"
```
Di Netlify Blobs, bentuknya satu dokumen per user (`users/<id>` berisi user + tabel-tabelnya) plus indeks email.

## Migrasi dari versi lama (tanpa server)
Di versi lama: Akun > Ekspor JSON. Di versi baru, daftar akun lalu Akun > Impor JSON.

## Catatan & batasan
- Sandi di-hash di server (scrypt); browser hanya menyimpan token login. Pakai HTTPS (Netlify otomatis).
- Server hanya mengirim data milik akun yang login, dan memaksa `userId` pemilik token pada setiap tulisan.
- Belum ada pembatasan percobaan login (rate limit) dan belum ada reset sandi lewat email.
- Lokal: aman untuk satu proses server. Di Netlify Blobs, dua perangkat yang menyimpan di detik yang sama bisa saling menimpa (jarang untuk pemakaian pribadi/keluarga).
