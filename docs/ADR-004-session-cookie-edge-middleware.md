# ADR-004: Sesi Cookie Bertanda Tangan dan Batas Middleware Edge

## Status

Diterima. Menyelesaikan ketegangan antara dua mandat PRD yang tidak bisa
dipenuhi sekaligus apa adanya: Bab 8.2 baris 813 mewajibkan `middleware.ts`
berjalan di **edge runtime**, sementara Task 1.2 mewajibkan verifikasi token
lewat **`firebase-admin`**.

## Konteks

Task 1.2 (PRD baris 1984) meminta satu paket: `/login` + `/unauthorized`,
Firebase Client SDK login, verifikasi server via `firebase-admin`, middleware
edge yang mengalihkan berdasarkan custom claim + status langganan, dan cookie
sesi `HttpOnly` `SameSite=Lax`.

Keempat hal itu tidak bisa hidup bersama dalam satu berkas:

1. `firebase-admin` membutuhkan Node API (crypto, net, fs untuk sertifikat).
   Middleware Next.js berjalan di Edge runtime, yang tidak menyediakannya.
   Mengimpor `firebase-admin` di middleware membuat build gagal.
2. Membaca `b2b_subscriptions` dari middleware berarti membuka koneksi Postgres
   (`postgres.js`) dari Edge, yang juga tidak mungkin dan akan menambah latensi
   pada setiap permintaan.
3. Cookie yang menyimpan ID token Firebase mentah hanya hidup 1 jam (ADR-003
   "Masa berlaku token") dan tidak membawa ringkasan otorisasi apa pun, jadi
   middleware tetap tidak bisa memutuskan redirect tanpa memanggil server.

## Keputusan

### 1. Sesi adalah envelope bertanda tangan, bukan ID token

Route `POST /api/auth/session` memverifikasi ID token Firebase lewat
`verifyIdToken` (Admin SDK, runtime Node), membaca baris `users`, `tenants`, dan
`b2b_subscriptions` dari Postgres, lalu menerbitkan cookie `snapbox_session`
berisi **snapshot**:

```
userId, firebaseUid, email, role, tenantId, parentTenantId,
subscription (OK | UNKNOWN | BLOCKED), subscriptionStatus, iat, exp
```

Envelope ditandatangani HMAC-SHA256 dengan `SESSION_COOKIE_SECRET` (base64 dari
tepat 32 byte). Format `payload.signature`, keduanya base64url. Tidak ada
algoritma yang bisa dinegosiasikan, sehingga tidak ada serangan
`alg: none`/confusion.

ID token Firebase **tidak pernah** masuk cookie. `firebaseUid` disimpan agar
server bisa memverifikasi ulang ke Firebase bila perlu, tetapi cookie sendiri
bukan bukti identitas — ia hanya bukti bahwa route sesi pernah menerbitkannya.

### 2. Verifikasi memakai Web Crypto, bukan `node:crypto`

`apps/web/src/lib/auth/session.ts` hanya memakai `crypto.subtle`,
`TextEncoder`, `TextDecoder`, dan `atob`/`btoa`. Ketiganya tersedia di Node 22
dan Edge, sehingga satu implementasi dipakai `middleware.ts` dan route server
tanpa percabangan runtime. Ini alasan `SESSION_COOKIE_SECRET` dipisah ke
`sessionEnvSchema` di `packages/shared/src/env.ts`, bukan digabung ke
`secretEnvSchema`: middleware tidak butuh kunci enkripsi/LAN/perangkat, dan
`secretEnvSchema` dikonsumsi tooling yang boleh memakai `node:crypto`.

Validasi nilai (`base64` tepat 32 byte) tetap dilakukan, tetapi verifikasi
**gagal tertutup**: secret hilang/rusak berarti cookie dianggap tidak sah,
bukan dilewati.

### 3. Middleware adalah gate awal, bukan otorisasi final

`apps/web/src/middleware.ts` hanya melakukan tiga hal: memverifikasi tanda
tangan envelope, mencocokkan peran dengan prefix rute, dan mengecek snapshot
gate langganan. Ia tidak menyentuh `firebase-admin`, Postgres, maupun
`node:crypto`; ini diverifikasi pada artefak build (grep `firebase-admin`,
`drizzle-orm`, `node:crypto` pada `.next/server/src/middleware.js` = 0
kemunculan).

Setiap route handler, server action, dan layout privat WAJIB mengulang
pemeriksaan ke DB lewat `getSession()` + query. Reason: snapshot di cookie bisa
basi. Perubahan peran, suspend tenant, atau habisnya langganan tidak langsung
mengubah cookie yang sudah terbit; ADR-003 sudah mencatat konsekuensi yang sama
untuk claim token ("perubahan klaim tidak terlihat sampai token di-refresh").

### 4. Jalur Staff PIN memakai email + PIN, bukan PIN saja

PRD Task 1.2 menyebut "mode toggle untuk Staff PIN" dan Bab 6.H menyebut "PIN
operator (6 digit, generate Owner)". Desainnya:

- PIN **bukan** kata sandi Firebase. PIN 6 digit hanya punya 1.000.000
  kemungkinan, sehingga menjadikannya kredensial Firebase berarti brute-force
  terhadap Firebase, bukan terhadap aplikasi.
- Form meminta **email + PIN**. PIN saja tidak bisa diatribusikan ke akun mana
  pun, sehingga tidak ada yang bisa diaudit dan rate limit per akun mustahil.
- Server mencari user `STAFF` aktif berdasarkan email, mencocokkan PIN terhadap
  `booths.operator_pin_hash` milik tenant user tersebut, lalu menerbitkan sesi
  yang **identik** dengan jalur kata sandi. Tidak ada jalur otorisasi kedua yang
  lebih lemah.
- Hash PIN memakai `scrypt` (N=16384, r=8, p=1) dengan format
  `scrypt$N$r$p$salt$key`, parameter ditulis di dalam string agar verifikasi lama
  tidak rusak bila default naik. Perbandingan memakai `timingSafeEqual`, dan
  parameter di luar jendela wajar ditolak untuk mencegah hash jumbo dipakai
  sebagai DoS.

### 5. Atribut cookie terpusat

`sessionCookieOptions()` satu-satunya tempat atribut ditulis: `HttpOnly`,
`Secure` di production, `SameSite=Lax` (PRD Bab 8.2), `Path=/`. Umur sesi 12 jam,
lebih pendek dari refresh token Firebase. Logout dilakukan lewat
`DELETE /api/auth/session` dengan `maxAge: 0` dan atribut identik supaya cookie
benar-benar hilang, bukan meninggalkan salinan dengan nama sama dan path
berbeda.

### 6. Rate limit auth adalah batas aplikasi, bukan klaim produksi

`apps/web/src/lib/auth/rate-limit.ts` mengimplementasikan 10 req/menit per IP
dan 5 req/menit per email sesuai PRD Bab 8.2, tetapi **in-memory per-instance**.
Di Vercel serverless tiap instance punya penghitung sendiri, jadi dosis efektif
berlipat sebanyak instance panas. Ini jaring pengaman, bukan pengganti rate limit
terdistribusi. Cloudflare Rate Limiting tetap lapisan pertama di edge.

## Konsekuensi

- **(a)** Build hijau tanpa `firebase-admin` di Edge; diverifikasi pada
  `.next/server/src/middleware.js` (0 kemunculan `firebase-admin`,
  `drizzle-orm`, `node:crypto`).
- **(b)** Otorisasi final selalu di server. Middleware bisa melewatkan permintaan
  ke layout privat yang kemudian menolaknya berdasarkan DB, dan sebaliknya
  (cookie basi) — layout/route handler adalah pengadilan terakhir.
- **(c)** `SESSION_COOKIE_SECRET` wajib ada di dua runtime (server dan edge).
  Rotasi kunci ini akan memaksa seluruh sesi login ulang, jadi perlakukan
  seperti kunci signing lain: rotasi terkoordinasi, bukan tiba-tiba.
- **(d)** `/login` dan `/unauthorized` `noindex` + `no-store`; keduanya tidak
  masuk sitemap.
- **(e)** GET pada `/api/auth/session` mengembalikan 405 dengan header `Allow`,
  bukan 404, supaya kontrak endpoint eksplisit.

## Alternatif yang ditolak

- **`firebase-admin` di middleware.** Ditolak: tidak kompatibel Edge; build
  gagal. Ini pemicu utama ADR ini.
- **Middleware memanggil endpoint Node internal untuk verifikasi.** Ditolak:
  satu permintaan halaman menjadi dua hop jaringan, menambah titik gagal, dan
  berpotensi loop bila endpoint itu sendiri melewati middleware.
- **Middleware `runtime = 'nodejs'`.** Ditolak: bergantung dukungan runtime
  deployment yang tidak portabel dan menyimpang dari mandat eksplisit PRD
  ("middleware.ts (edge runtime)").
- **Cookie berisi ID token Firebase mentah.** Ditolak: umur 1 jam, tidak membawa
  ringkasan role/tenant/langganan, dan menaruh token bearer di tempat yang bisa
  dibaca pada setiap permintaan.
- **PIN saja (tanpa email).** Ditolak: tidak bisa diatribusikan ke akun, tidak
  bisa diaudit, rate limit per akun mustahil, dan ambigu lintas tenant.
- **PIN dijadikan kata sandi Firebase.** Ditolak: memindahkan brute-force PIN
  6 digit ke Firebase dan membuat PIN jadi kredensial yang harus di-reset, bukan
  kode operasional booth.
- **Sesi mengandalkan `app_metadata.role`.** Ditolak: tidak terjangkau untuk
  token Firebase third-party (ADR-003).

## Cakupan yang sengaja tidak dikerjakan

- Halaman dashboard untuk OWNER/STAFF dan halaman langganan Owner. Karena itu
  `safeHomeForRole('OWNER' | 'STAFF')` mengembalikan `null` dan
  `subscriptionRecoveryPath()` masih `null`: lebih baik menampilkan
  `/unauthorized` daripada mengarahkan ke rute yang belum ada.
- Provisioning user/Firebase, invite, reset password, CRUD staff, dan UI
  pembuatan PIN operator. Kolom `booths.operator_pin_hash` sudah ada di skema;
  yang belum ada adalah layar untuk mengisinya.
- LAN QR token untuk staff (PRD Bab 5.4), device pairing, subscription engine,
  webhook Pakasir, dan cron expiry.
- Rate limit terdistribusi dan audit-log UI login gagal (PRD Task 1.11).
