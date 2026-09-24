# ADR-003: Firebase sebagai Identity Provider dan Kontrak Custom Claims

## Status

Diterima. ADR ini menyelesaikan kontrak klaim Firebase yang masih berstatus
DRAFT di `docs/PHASE-0.md` (Task 0.4, baris 221-226); kata "DRAFT (diverifikasi
Fase 3/6)" pada catatan itu digantikan oleh keputusan di bawah dan boleh
diperbarui oleh pemilik berkas tersebut.

## Konteks

Firebase adalah identity provider SnapBox (PRD Bab 10.3, PRD baris 1970).
Supabase BUKAN IdP dan tidak pernah menerbitkan token SnapBox, tetapi harus
menerima JWT Firebase agar Realtime dan Storage bisa mengotorisasi sesi. Karena
itu ada blok `[auth.third_party.firebase]` di `supabase/config.toml:97-105`
dengan `enabled = true` dan `project_id = "snapbox"` (placeholder lokal), di
samping blok `[auth]` dasar (`config.toml:82-91`) yang dibutuhkan `supabase
start` supaya hidup. `jwt_expiry = 3600` di `config.toml:90` merujuk masa
berlaku token Supabase, bukan token Firebase.

Custom claims adalah sumber kebenaran peran. Setiap keputusan otorisasi
diulang di server, dan `tenant_id` yang dikirim klien tidak pernah dipercaya
(PRD Bab 5.5). `packages/shared/src/auth.ts:1-7` sudah menuliskan aturan ini di
level modul, dan `sessionSchema` di `auth.ts:94-103` menandai `tenantId` sebagai
"DILARANG diisi dari input klien".

Cakupan Task 0.5 adalah infrastruktur saja: kontrak klaim, paket pembungkus
SDK, dan kredensial admin. Login page, provisioning staf, dan UI tidak termasuk
(Fase 1). ADR ini mencatat keputusan yang sudah diambil, bukan usulan.

## Keputusan

### Dua klaim: `role` dan `app_role`

Token Firebase SnapBox memuat DUA klaim peran yang berbeda arti:

- **`role`** WAJIB bernilai string role Postgres `'authenticated'`. Ini
  keputusan terpenting di ADR ini. Supabase tanpa syarat menetapkan Postgres
  session role dari klaim `role` saat memvalidasi token, dan `app_metadata.role`
  tidak terjangkau untuk token Firebase third-party yang divalidasi lewat
  `[auth.third_party.firebase]`. Karena itu role aplikasi tidak boleh berada di
  `role`: Supabase akan menimpanya, dan nilai aplikasi diam-diam hilang.
- **`app_role`** membawa role aplikasi `CEO | OWNER | STAFF`, dikirim dalam
  snake_case di wire (persis string enum `USER_ROLES` di
  `packages/shared/src/domain.ts:13`).
- **`tenant_id`** dan **`parent_tenant_id`** membawa scoping tenant, bernilai
  `null` untuk CEO.

Naming di wire dan di penyimpanan token adalah snake_case; tipe TypeScript yang
menghadap aplikasi tetap camelCase. Konversi itu diamanatkan ke satu fungsi
mapper bernama `toCustomClaims`, dan split ini disengaja supaya batas antar
keduanya eksplisit. Tipe aplikasi memakai `CustomClaims.appRole`,
`CustomClaims.tenantId`, dan `CustomClaims.parentTenantId` seperti sudah
tertulis di `packages/shared/src/auth.ts:86-91`.

### Lokasi kontrak klaim

Ada dua berkas, dan pembagiannya disengaja:

- `packages/auth/src/claims.ts` adalah pembangun klaim kanonik dan skema wire.
  Skema Zod di sini bernama `firebaseClaimsSchema`, dan klaim `role` dipatok
  dengan `z.literal('authenticated')` agar salah isi gagal keras saat parse,
  bukan diam-diam.
- `packages/shared/src/auth.ts` menyimpan kontrak yang menghadap aplikasi:
  `customClaimsSchema` (`auth.ts:86-90`), `Session`/`sessionSchema`
  (`auth.ts:94-103`), `ROLE_PERMISSIONS` (`auth.ts:176-181`), `hasPermission`
  (`auth.ts:190-192`), dan `canAccessTenant` (`auth.ts:204-215`).

Invarian yang harus dijaga kedua berkas:

1. CEO: `tenant_id` dan `parent_tenant_id` keduanya `null`.
2. OWNER: `tenant_id` non-null.
3. STAFF: `tenant_id` dan `parent_tenant_id` keduanya non-null.

### Paket dan pemisahan server/klien

Paket baru `packages/auth` (`package.json:2`) membungkus `firebase-admin`
(server) dan `firebase` (browser). Subpath export di `package.json:7-12`:

- `.` ke `src/index.ts`: re-export klaim saja.
- `./admin` ke `src/admin.ts`: server-only.
- `./client` ke `src/client.ts`: browser.
- `./claims` ke `src/claims.ts`: skema dan pembangun klaim.

Barrel root SENGAJA tidak mengekspor `admin`, supaya bundle klien tidak bisa
menarik `firebase-admin` hanya dengan mengimpor `@snapbox/auth`. Ini pagar
arsitektural, bukan preferensi gaya.

### Kredensial Admin SDK

Tiga variabel env yang sudah ada di `packages/shared/src/env.ts:43-45` dan
`.env.example:27-29` dipakai apa adanya: `FIREBASE_ADMIN_PROJECT_ID`,
`FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`. Ketiganya diteruskan
ke `cert({ projectId, clientEmail, privateKey })`. Tidak ada berkas
service-account JSON di repo.

Nilai `FIREBASE_ADMIN_PRIVATE_KEY` dari `.env` tidak bisa memuat newline asli,
jadi literal `\n` dinormalisasi dengan `privateKey.replace(/\\n/g, '\n')` sebelum
dipasang. Validasi lewat `serverEnvSchema` dari `@snapbox/shared/env`; konfigurasi
yang hilang melempar saat init, bukan saat request pertama. Singleton-nya disimpan
di `globalThis` mengikuti pola di `packages/db/src/client.ts:34-37` dan `:50-52`,
supaya hot reload Next dev tidak membuat aplikasi Firebase ganda.

### Blocking function (belum diimplementasikan)

Blocking function Firebase (Identity Platform) harus mengeluarkan KEDUA klaim
saat token dicetak. Fitur ini butuh paket Identity Platform berbayar, jadi
penyebarannya ditunda. Bentuk klaim yang wajib dihasilkan supaya implementer
berikutnya tidak salah:

```json
{
  "role": "authenticated",
  "app_role": "OWNER",
  "tenant_id": "<uuid>",
  "parent_tenant_id": "<uuid|null>"
}
```

Jalur cadangan bila blocking function tetap tidak tersedia: klaim dicetak lewat
Admin SDK `setCustomUserClaims` pada saat provisioning. Konsekuensinya, token
yang sudah terbit tidak ikut berubah; klaim baru hanya muncul setelah refresh
token berikutnya.

### Masa berlaku token dan pencabutan sesi

Token ID Firebase berumur pendek (default 1 jam; repo ini tidak memperpanjangnya).
Pencabutan mengandalkan tiga jalur:

1. `setUserDisabled` untuk disable keras.
2. Revocation refresh token Firebase untuk memaksa re-autentikasi.
3. Cek token-version / claims-version bila klaim basi jadi masalah nyata.

Konsekuensi yang diakui: perubahan klaim (ganti role, pindah tenant) tidak
terlihat sampai token ID saat itu di-refresh, sehingga otorisasi yang bergantung
pada perubahan role harus mentoleransi staleness sampai satu masa berlaku token.
Yang diimplementasikan sekarang hanyalah helper tipis untuk `setUserDisabled` dan
`setCustomUserClaims`; revocation refresh token dan cek versi klaim ditunda
sampai ada kebutuhan nyata.

### Konsol manual (di luar repo)

Langkah berikut tidak bisa dikerjakan kode dan harus dilakukan di konsol
Firebase:

1. Buat project Firebase.
2. Aktifkan provider Email/Password.
3. Buat service-account key.
4. Salin empat nilai konfigurasi web `NEXT_PUBLIC_FIREBASE_*`: `API_KEY`,
   `AUTH_DOMAIN`, `PROJECT_ID`, `APP_ID` (lihat `.env.example:16-19`).

Lalu isi tiga env `FIREBASE_ADMIN_*` dari `.env.example` dan verifikasi dengan
`pnpm check:firebase-project-id` (`scripts/check-firebase-project-id.mjs`), yang
memastikan `project_id` di `supabase/config.toml` sama dengan nilai env.

### Cakupan yang sengaja tidak dikerjakan

Tanpa login page, tanpa middleware, tanpa provisioning atau undangan staf (Fase
1). Tanpa deployment blocking function. Tanpa Sentry/Vercel/Cloudflare (Task 0.6).

## Penyimpangan yang disengaja

### Konflik nama ADR-003

PRD Bab 10.16 sudah memakai label "ADR-003" untuk strategi rotasi kunci
enkripsi, dan `packages/shared/src/env.ts:50` serta `:88` merujuknya sebagai
ADR-003. ADR ini memakai nomor 003 untuk topik Firebase di `docs/`, sehingga
penomoran itu sengaja tidak unik. Ini mengikuti penomoran Task 0.5, bukan tanda
bahwa topik enkripsi batal.

### Naming wire versus tipe aplikasi

`app_role`/`tenant_id` di token beradu dengan `appRole`/`tenantId` di kode.
Satu-satunya tempat konversinya boleh terjadi adalah `toCustomClaims` di
`packages/auth/src/claims.ts`; perbandingan inline di luar mapper itu dianggap
bug.

## Konsekuensi

- **(a)** `role` tidak boleh dipakai sebagai role aplikasi di mana pun. Salah
  ejaan di level wire membuat Supabase memilih Postgres role yang salah, yang
  diam-diam memberi atau menolak akses database. Penjaga `scripts/check-claims-sync.mjs`
  plus `z.literal('authenticated')` di `firebaseClaimsSchema` ada persis untuk
  membuat kesalahan itu bersuara. Skrip itu membandingkan
  `firebaseClaimsSchema` di `packages/auth/src/claims.ts` dengan
  `customClaimsSchema` di `packages/shared/src/auth.ts` dan menuntut pasangan
  snake_case (`app_role`, `tenant_id`, `parent_tenant_id`) punya kembaran
  camelCase (`appRole`, `tenantId`, `parentTenantId`).
- **(b)** Perubahan klaim tertinggal sampai satu masa berlaku token. Otorisasi
  tidak boleh mengasumsikan efek instan saat role atau tenant berubah.
- **(c)** SDK browser dan server tidak boleh diimpor dari modul yang sama.
  Ditegakkan oleh bentuk barrel root yang mengecualikan `admin`.
- **(d)** Test atau pengembangan lokal memerlukan project Firebase nyata, atau
  env Admin sengaja dibiarkan kosong. Dalam kasus terakhir `getFirebaseAdmin()`
  melempar sebagai perilaku yang disengaja, bukan kegagalan.

## Alternatif yang ditolak

- **Menaruh role aplikasi di `role` dan membiarkan Supabase memetakannya.**
  Ditolak: Supabase menimpa `role` dengan Postgres session role, jadi role
  aplikasi akan dibuang tanpa peringatan.
- **Membaca role aplikasi dari `app_metadata.role`.** Ditolak: `app_metadata`
  tidak terjangkau untuk token Firebase third-party yang divalidasi lewat
  `[auth.third_party.firebase]`.
- **Meng-commit `serviceAccountKey.json`.** Ditolak: secret ikut terlacak Git,
  rotasi menjadi perubahan kode, sementara `.env` sudah membawa ketiga field yang
  diperlukan.
- **Layanan `apps/api` tersendiri yang memiliki auth.** Ditolak atau ditunda:
  layanan itu belum ada, dan Task 0.5 adalah urusan tingkat paket. Ditinjau ulang
  bila muncul server non-Next.
- **Memverifikasi token ID Firebase dengan `jose`/JWKS alih-alih Admin SDK.**
  Ditolak: akan mengimplementasi ulang cache sertifikat dan semantik pencabutan
  yang sudah disediakan SDK, dan berpotensi menyimpang dari bentuk klaim yang
  dihasilkan blocking function.
