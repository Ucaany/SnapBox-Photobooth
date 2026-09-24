# Deployment Vercel — `@snapbox/web`

Dokumen ini menjelaskan cara men-deploy aplikasi web SnapBox ke Vercel.
Konfigurasi DNS, WAF, dan Turnstile ada di `infra/cloudflare/README.md`.

## Ringkasan

- Proyek Vercel: satu proyek untuk `apps/web`, rootDirectory diset ke `apps/web`.
- Framework: Next.js 15 (App Router), region `sin1`.
- Instalasi dan build: dideteksi otomatis oleh Vercel (pnpm workspace + Next.js),
  karena itu `apps/web/vercel.json` hanya memuat `framework` dan `regions`.

## Pengaturan Proyek

`rootDirectory` adalah **setting proyek Vercel**, bukan kunci `vercel.json`. Set di
dashboard (Project Settings → General → Root Directory) atau saat `vercel link`:

```
rootDirectory: apps/web
```

Tanpa ini, Vercel akan mencoba mem-build dari root repo dan gagal menemukan
package `@snapbox/web`.

## Alasan Region `sin1`

Region `sin1` (Singapura) dipilih karena menjadi titik presence terdekat dengan
pasar target (Indonesia). Latensi dari Jakarta ke `sin1` jauh lebih rendah
dibanding region AS atau Eropa, dan Vercel menjalankan fungsi/SSR di sana
sehingga request pengguna tidak melintasi pasifik.

## Instalasi dan Build

Dengan `rootDirectory: apps/web` dan lockfile pnpm di root, Vercel otomatis:

- mendeteksi pnpm workspace dari `pnpm-lock.yaml` di root repo,
- menjalankan instalasi monorepo (`pnpm install`), lalu
- menjalankan `pnpm --filter @snapbox/web build` (setara `next build`) di `apps/web`.

Karena itu kita **tidak** menaruh `installCommand`/`buildCommand` di `vercel.json`.
Menaruhnya di sana berisiko dijalankan dari direktori yang salah dan bertentangan
dengan deteksi otomatis Vercel. `vercel.json` sengaja tetap hanya memuat kunci
yang valid menurut skema `https://openapi.vercel.sh/vercel.json`.

## Environment Variables

Inventaris lengkap variabel lingkungan untuk proyek Vercel `@snapbox/web`.
Sumber kebenaran: `.env.example` di root repo dan skema Zod di
`packages/shared/src/env.ts` (`publicEnvSchema`, `serverEnvSchema`,
`secretEnvSchema`, `thirdPartyEnvSchema`).

Provisioning **bukan** tugas CI dengan nilai mentah. Operator yang terautentikasi
(`vercel login`) menambahkan tiap variabel lewat `vercel env add <NAMA>` atau
Dashboard → Project Settings → Environment Variables, dengan memilih Environment
(Development / Preview / Production) dan Scope (Build / Runtime) yang sesuai.
Nilai secret tidak boleh ditulis di `vercel.json`, workflow, atau log.

### A. Variabel publik browser (di-inline ke bundle klien, prefix `NEXT_PUBLIC_`)

Wajib ada di **Development + Preview + Production**, scope **Build** (Next.js
meng-inline `NEXT_PUBLIC_*` saat build) dan ikut terkirim ke browser.

| Nama                               | Environment                | Scope           | Secret?   | Catatan                                                                                                    |
| ---------------------------------- | -------------------------- | --------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`              | Dev / Preview / Production | Build + Runtime | tidak     | URL publik aplikasi; absolute URL, redirect, dan CSP. Wajib format URL.                                    |
| `NEXT_PUBLIC_SUPABASE_URL`         | Dev / Preview / Production | Build + Runtime | **tidak** | URL proyek Supabase untuk klien.                                                                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | Dev / Preview / Production | Build + Runtime | **tidak** | Anon key Supabase. Publik by design, dilindungi RLS — **bukan** secret.                                    |
| `NEXT_PUBLIC_FIREBASE_API_KEY`     | Dev / Preview / Production | Build + Runtime | **tidak** | API key klien Firebase. Publik by design — **bukan** secret.                                               |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Dev / Preview / Production | Build + Runtime | tidak     | Auth domain Firebase (`<project>.firebaseapp.com`).                                                        |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`  | Dev / Preview / Production | Build + Runtime | tidak     | Project ID Firebase (identik dengan `FIREBASE_ADMIN_PROJECT_ID`).                                          |
| `NEXT_PUBLIC_FIREBASE_APP_ID`      | Dev / Preview / Production | Build + Runtime | tidak     | App ID web Firebase (`1:xxx:web:xxx`).                                                                     |
| `NEXT_PUBLIC_SENTRY_DSN`           | Dev / Preview / Production | Build + Runtime | tidak     | Opsional. DSN Sentry sisi klien. Wajib format URL bila diisi.                                              |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`  | Dev / Preview / Production | Build + Runtime | tidak     | Opsional. Client key Midtrans (B2C). Server key Midtrans per-tenant disimpan terenkripsi di DB, bukan env. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`   | Dev / Preview / Production | Build + Runtime | tidak     | Opsional. Site key Cloudflare Turnstile (pasangan publik dari `TURNSTILE_SECRET_KEY`).                     |

### B. Variabel runtime server (tidak pernah masuk bundle browser)

Server-only. Scope **Runtime**; tambahkan ke **Development + Preview +
Production** kecuali dicatat lain.

| Nama                          | Environment                | Scope   | Secret? | Catatan                                                                                                                              |
| ----------------------------- | -------------------------- | ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `SUPABASE_SERVICE_ROLE_KEY`   | Dev / Preview / Production | Runtime | **ya**  | Service role Supabase (bypass RLS). Hanya untuk kode server.                                                                         |
| `DATABASE_URL`                | Dev / Preview / Production | Runtime | **ya**  | Koneksi **session pooler** Supabase (port 5432) untuk runtime; klien memakai `prepare: false` agar cocok dengan pooler + serverless. |
| `FIREBASE_ADMIN_PROJECT_ID`   | Dev / Preview / Production | Runtime | tidak   | Project ID Firebase Admin.                                                                                                           |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Dev / Preview / Production | Runtime | tidak   | Email service account Firebase Admin. Wajib format email.                                                                            |
| `FIREBASE_ADMIN_PRIVATE_KEY`  | Dev / Preview / Production | Runtime | **ya**  | Private key service account Firebase Admin (PEM dengan `\n`).                                                                        |
| `ENCRYPTION_MASTER_KEY`       | Dev / Preview / Production | Runtime | **ya**  | Kunci master AES-256. Wajib base64 dari tepat 32 byte (`openssl rand -base64 32`).                                                   |
| `PAIRING_TOKEN_SECRET`        | Dev / Preview / Production | Runtime | **ya**  | HMAC untuk pairing token. Base64 tepat 32 byte.                                                                                      |
| `LAN_JWT_SECRET`              | Dev / Preview / Production | Runtime | **ya**  | Signing JWT LAN. Base64 tepat 32 byte.                                                                                               |
| `DEVICE_JWT_SECRET`           | Dev / Preview / Production | Runtime | **ya**  | Signing sesi perangkat. Base64 tepat 32 byte.                                                                                        |
| `PAKASIR_B2B_API_KEY`         | Dev / Preview / Production | Runtime | **ya**  | API key integrasi Pakasir B2B.                                                                                                       |
| `PAKASIR_B2B_WEBHOOK_SECRET`  | Dev / Preview / Production | Runtime | **ya**  | Secret verifikasi webhook Pakasir B2B.                                                                                               |
| `RESEND_API_KEY`              | Dev / Preview / Production | Runtime | **ya**  | API key Resend untuk email transaksional.                                                                                            |
| `RESEND_FROM_EMAIL`           | Dev / Preview / Production | Runtime | tidak   | Alamat pengirim, mis. `SnapBox <noreply@snapbox.id>`.                                                                                |
| `TURNSTILE_SECRET_KEY`        | Dev / Preview / Production | Runtime | **ya**  | Opsional. Secret key Turnstile; verifikasi sisi server.                                                                              |
| `WHATSAPP_SALES_NUMBER`       | Dev / Preview / Production | Runtime | tidak   | Nomor WhatsApp sales untuk tautan kontak.                                                                                            |

### C. Variabel khusus build (dibutuhkan langkah build, bukan runtime)

Dipakai saat build (mis. upload sourcemap). Tidak perlu tersedia di runtime
fungsi/SSR.

| Nama                | Environment          | Scope                        | Secret? | Catatan                                                                                                                                                                                                                                                  |
| ------------------- | -------------------- | ---------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SENTRY_AUTH_TOKEN` | Preview / Production | **Build only**               | **ya**  | Token upload sourcemap Sentry. Build-only dan **tidak pernah** diekspos ke klien.                                                                                                                                                                        |
| `SENTRY_ORG`        | Preview / Production | Build only                   | tidak   | Slug organisasi Sentry.                                                                                                                                                                                                                                  |
| `SENTRY_PROJECT`    | Preview / Production | Build only                   | tidak   | Slug proyek Sentry.                                                                                                                                                                                                                                      |
| `DIRECT_URL`        | Preview / Production | Tooling (Build, kondisional) | **ya**  | Koneksi langsung untuk Drizzle CLI (`generate`/`migrate`/`push`/`studio`) dan seed. Hanya diperlukan bila langkah migrasi/tooling benar-benar dijalankan di dalam build Vercel; jika migrasi dijalankan di alur terpisah, variabel ini tidak diperlukan. |

### D. Integrasi opsional / spesifik lingkungan

Variabel tooling opsional; hanya perlu bila alur terkait dipakai. Bila diisi,
secret tetap server-only.

| Nama                   | Environment      | Scope   | Secret? | Catatan                                                        |
| ---------------------- | ---------------- | ------- | ------- | -------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN` | sesuai kebutuhan | Tooling | **ya**  | Opsional. Token API Cloudflare untuk DNS/WAF otomatis.         |
| `CLOUDFLARE_ZONE_ID`   | sesuai kebutuhan | Tooling | tidak   | Opsional. Zone ID Cloudflare, pasangan `CLOUDFLARE_API_TOKEN`. |

### Catatan tambahan

- Provisioning dilakukan oleh **operator terautentikasi** lewat `vercel env add`
  atau dashboard, **bukan** oleh CI dengan nilai mentah. Jangan menaruh nilai
  secret di `vercel.json`, workflow, atau log build.
- `SENTRY_AUTH_TOKEN` bersifat **build-only**: hanya dipakai untuk upload
  sourcemap saat build dan **tidak pernah** diekspos ke bundle klien.
- `NEXT_PUBLIC_FIREBASE_*` (termasuk `NEXT_PUBLIC_FIREBASE_API_KEY`) dan
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` bersifat **publik by design** dan **bukan**
  secret. Sebaliknya `SUPABASE_SERVICE_ROLE_KEY`,
  `FIREBASE_ADMIN_PRIVATE_KEY`, seluruh kunci enkripsi/signing
  (`ENCRYPTION_MASTER_KEY`, `PAIRING_TOKEN_SECRET`, `LAN_JWT_SECRET`,
  `DEVICE_JWT_SECRET`), kredensial pembayaran (`PAKASIR_B2B_*`), dan secret
  webhook **adalah** secret — jangan pernah diberi prefix `NEXT_PUBLIC_`.
- Prosedur provisioning dan rotasi selengkapnya: lihat runbook
  [`docs/ENVIRONMENT-AND-SECRETS.md`](../../docs/ENVIRONMENT-AND-SECRETS.md).

## Verifikasi Deployment

Halaman dummy sudah ada: `apps/web/src/app/page.tsx` menampilkan galeri
komponen `@snapbox/ui` (rute `/`). Verifikasi deployment dianggap berhasil bila
halaman galeri tersebut **render tanpa error** di URL preview Vercel, dan error
runtime (jika ada) tertangkap oleh Sentry.
