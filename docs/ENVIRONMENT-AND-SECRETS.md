# Lingkungan & Rahasia: Runbook Operasi Secret (Task 0.9)

Runbook ini adalah prosedur **provisioning manual** untuk variabel lingkungan dan
rahasia SnapBox. Tidak ada akun nyata di repo ini, dan tidak ada perintah CLI
berkredensial yang dijalankan oleh implementasi Task 0.9. Semua langkah di sini
dikerjakan operator yang sudah terautentikasi.

Acuan inventaris variabel: `packages/shared/src/env.ts` (sumber kebenaran trust
boundary) dan `.env.example` (contoh nilai). Dokumen terkait:
`apps/web/VERCEL.md`, `docs/PHASE-0.md` (Task 0.4/0.5/0.6), `docs/ADR-003-firebase-auth.md`,
`infra/cloudflare/README.md`.

## 1. Tujuan & ruang lingkup

Runbook ini mengatur:

- Inventaris kanonik variabel lingkungan dan batas kepercayaannya.
- Prosedur provisioning manual ke Vercel, GitHub Actions, dan Supabase.
- Rotasi kredensial per kelas, termasuk jalur migrasi kunci enkripsi.
- Respons insiden dan verifikasi tanpa membocorkan nilai.

### Yang DILARANG dilakukan implementer

| Larangan                                                                       | Alasan                                                                                               |
| :----------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| Meng-commit nilai rahasia ke Git                                               | Riwayat Git abadi; rotasi menjadi operasi mahal.                                                     |
| Menaruh rahasia sebagai literal di workflow, source, atau konfigurasi Supabase | Terlacak, ter-inline ke bundle, atau terbaca di dasbor.                                              |
| Menaruh rahasia di `supabase/config.toml`                                      | Berkas ini ter-commit, bukan secret store.                                                           |
| Menaruh rahasia di DB, atau di kolom yang tidak terenkripsi                    | Bocor lewat backup/query; kredensial B2C per-tenant dikecualikan dan disimpan terenkripsi (ADR-003). |
| Meng-echo nilai rahasia (`cat .env`, `env`, `printenv`)                        | Nilai bocor ke log CI/shell history.                                                                 |
| Menyalin rahasia runtime aplikasi ke GitHub Secrets                            | GitHub hanya perlu tiga secret Vercel (bagian 4).                                                    |
| Memakai `.env` untuk rilis desktop/Tauri                                       | Desktop memakai prefix `VITE_*`, bukan `NEXT_PUBLIC_*` (bagian 6).                                   |

## 2. Model trust boundary

Empat skema di `packages/shared/src/env.ts` memisahkan kelas variabel. Pemisahan
ini pagar arsitektural, bukan preferensi gaya.

| Kelas                 | Prefix / nama                                                                                        | Boleh hidup di                                 | Contoh konsumen                                                  |
| :-------------------- | :--------------------------------------------------------------------------------------------------- | :--------------------------------------------- | :--------------------------------------------------------------- |
| PUBLIC (browser-safe) | `NEXT_PUBLIC_*`                                                                                      | Bundle browser, env Vercel (Build + Runtime)   | `packages/auth/src/client.ts`, Supabase client                   |
| SERVER_ONLY           | `SUPABASE_*`, `DATABASE_URL`, `DIRECT_URL`, `FIREBASE_ADMIN_*`                                       | Runtime server Next.js, proses Drizzle CLI     | `packages/db/src/client.ts`, `packages/auth/src/admin.ts`        |
| SESSION               | `SESSION_COOKIE_SECRET`                                                                              | Runtime server Next.js **dan** edge middleware | `apps/web/src/lib/auth/session.ts`, `apps/web/src/middleware.ts` |
| ENCRYPTION            | `ENCRYPTION_MASTER_KEY`, `PAIRING_TOKEN_SECRET`, `LAN_JWT_SECRET`, `DEVICE_JWT_SECRET`               | Runtime server, secret store Edge Function     | Fitur pairing/LAN/JWT perangkat, enkripsi kolom                  |
| THIRD_PARTY           | `PAKASIR_*`, `RESEND_*`, `SENTRY_*`, `CLOUDFLARE_*`, `TURNSTILE_SECRET_KEY`, `WHATSAPP_SALES_NUMBER` | Runtime server, job Build Sentry               | Webhook Pakasir, Resend, upload sourcemap                        |
| DESKTOP (Vite)        | `VITE_*`                                                                                             | Bundle kiosk Vite                              | `apps/desktop/src/main.tsx`, `vite.config.ts`                    |

**`NEXT_PUBLIC_*` dan `VITE_*` ter-inline ke bundle browser.** Next.js hanya
meng-inline `process.env.NEXT_PUBLIC_*` pada akses properti statis; Vite hanya
meng-inline prefix `VITE_`. Apa pun dengan prefix itu terlihat oleh siapa pun yang
membuka bundle, karena itu bukan rahasia.

**Yang BUKAN rahasia** (aman dipublikasikan, dan memang harus publik):

- Konfigurasi web Firebase: `NEXT_PUBLIC_FIREBASE_API_KEY`,
  `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`,
  `NEXT_PUBLIC_FIREBASE_APP_ID`.
- Supabase anon key: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (dilindungi RLS, bukan
  kredensial pemilik data).
- Site key Turnstile, client key Midtrans, DSN Sentry, URL aplikasi.

**Yang RAHASIA** (bocor = kompromi penuh):

- `SUPABASE_SERVICE_ROLE_KEY` — melewati RLS, akses penuh database.
- `FIREBASE_ADMIN_PRIVATE_KEY` (bersama `FIREBASE_ADMIN_CLIENT_EMAIL`) — mencetak
  token dan klaim untuk pengguna mana pun.
- Kunci pembayaran/webhook: `PAKASIR_B2B_API_KEY`,
  `PAKASIR_B2B_WEBHOOK_SECRET`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`,
  `CLOUDFLARE_API_TOKEN`.
- Kunci enkripsi dan signing: `ENCRYPTION_MASTER_KEY`, `PAIRING_TOKEN_SECRET`,
  `LAN_JWT_SECRET`, `DEVICE_JWT_SECRET`.
- `DATABASE_URL` / `DIRECT_URL` — memuat kata sandi Postgres.

## 3. Pemetaan env ke Vercel

Satu proyek Vercel untuk `apps/web`. **`rootDirectory` diset ke `apps/web`**
(setting proyek, bukan kunci `vercel.json`; lihat `apps/web/VERCEL.md`). Tanpa ini
Vercel mem-build dari root repo dan gagal menemukan `@snapbox/web`.

| Variabel                           | Environment                      | Scope                     | Sumber nilai                        |
| :--------------------------------- | :------------------------------- | :------------------------ | :---------------------------------- |
| `NEXT_PUBLIC_APP_URL`              | Development, Preview, Production | Build + Runtime           | URL per environment                 |
| `NEXT_PUBLIC_SUPABASE_URL`         | Preview, Production              | Build + Runtime           | Dasbor Supabase                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | Preview, Production              | Build + Runtime           | Dasbor Supabase → API               |
| `NEXT_PUBLIC_FIREBASE_API_KEY`     | Preview, Production              | Build + Runtime           | Konsol Firebase (config web)        |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Preview, Production              | Build + Runtime           | Konsol Firebase                     |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`  | Preview, Production              | Build + Runtime           | Konsol Firebase                     |
| `NEXT_PUBLIC_FIREBASE_APP_ID`      | Preview, Production              | Build + Runtime           | Konsol Firebase                     |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`  | Preview, Production              | Build + Runtime           | Dasbor Midtrans (sandbox/prod)      |
| `NEXT_PUBLIC_SENTRY_DSN`           | Preview, Production              | Build + Runtime           | Sentry → Client Keys                |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`   | Preview, Production              | Build + Runtime           | Cloudflare Turnstile                |
| `SUPABASE_SERVICE_ROLE_KEY`        | Preview, Production              | Runtime                   | Dasbor Supabase → API               |
| `DATABASE_URL`                     | Preview, Production              | Runtime                   | Supabase Session Pooler (port 5432) |
| `DIRECT_URL`                       | Preview, Production              | Build (Drizzle) + Runtime | Supabase direct connection          |
| `FIREBASE_ADMIN_PROJECT_ID`        | Preview, Production              | Runtime                   | Service account Firebase            |
| `FIREBASE_ADMIN_CLIENT_EMAIL`      | Preview, Production              | Runtime                   | Service account Firebase            |
| `FIREBASE_ADMIN_PRIVATE_KEY`       | Preview, Production              | Runtime                   | Service account Firebase            |
| `ENCRYPTION_MASTER_KEY`            | Preview, Production              | Runtime                   | `openssl rand -base64 32`           |
| `PAIRING_TOKEN_SECRET`             | Preview, Production              | Runtime                   | `openssl rand -base64 32`           |
| `LAN_JWT_SECRET`                   | Preview, Production              | Runtime                   | `openssl rand -base64 32`           |
| `DEVICE_JWT_SECRET`                | Preview, Production              | Runtime                   | `openssl rand -base64 32`           |
| `PAKASIR_B2B_API_KEY`              | Preview, Production              | Runtime                   | Dasbor Pakasir                      |
| `PAKASIR_B2B_WEBHOOK_SECRET`       | Preview, Production              | Runtime                   | Dasbor Pakasir                      |
| `RESEND_API_KEY`                   | Preview, Production              | Runtime                   | Dasbor Resend                       |
| `RESEND_FROM_EMAIL`                | Preview, Production              | Runtime                   | Alamat terverifikasi Resend         |
| `SENTRY_AUTH_TOKEN`                | Production (opsional Preview)    | **Build-only**            | Sentry → Auth Tokens                |
| `SENTRY_ORG`                       | Production (opsional Preview)    | Build-only                | Sentry                              |
| `SENTRY_PROJECT`                   | Production (opsional Preview)    | Build-only                | Sentry                              |
| `CLOUDFLARE_API_TOKEN`             | Preview, Production              | Runtime                   | Cloudflare API Tokens               |
| `CLOUDFLARE_ZONE_ID`               | Preview, Production              | Runtime                   | Cloudflare dashboard                |
| `TURNSTILE_SECRET_KEY`             | Preview, Production              | Runtime                   | Cloudflare Turnstile                |
| `WHATSAPP_SALES_NUMBER`            | Preview, Production              | Build + Runtime           | Nomor penjualan                     |

Catatan:

- `SENTRY_AUTH_TOKEN` **hanya** dipakai saat upload sourcemap (`next build`),
  bukan runtime klien. Menaruhnya di runtime menambah permukaan bocor tanpa
  manfaat. Tanpa token, `sourcemaps.disable` aktif dan build tetap sukses
  (Task 0.6).
- Variabel publik dan server-only dipisah tegas: jangan pernah menaruh secret di
  `NEXT_PUBLIC_*`.
- `vercel env add` atau provisioning lewat dasbor dilakukan **operator yang
  terautentikasi**, bukan CI dengan nilai mentah. CI tidak pernah menerima nilai
  env aplikasi (bagian 4).
- `DIRECT_URL` dipakai Drizzle CLI (`generate`/`migrate`/`push`/`studio`) dan
  seed; runtime memakai `DATABASE_URL` (pooler).

## 4. GitHub Actions secrets minimum

GitHub Actions hanya memegang **tiga** secret, semuanya untuk job `preview` di
`.github/workflows/ci.yml` (baris 127-176):

| Secret              | Dipakai oleh  | Fungsi                                            |
| :------------------ | :------------ | :------------------------------------------------ |
| `VERCEL_TOKEN`      | Job `preview` | `vercel pull/build/deploy` via `pnpm dlx vercel`. |
| `VERCEL_ORG_ID`     | Job `preview` | Identitas org Vercel.                             |
| `VERCEL_PROJECT_ID` | Job `preview` | Identitas proyek Vercel.                          |

- Ketiganya dikonsumsi **hanya** oleh job `preview`; job `verify` dan `rust`
  tidak menerima secret apa pun.
- Secret tambahan hanya ditambahkan untuk workflow yang benar-benar
  mengonsumsinya. Jangan menyiapkan secret spekulatif.
- **PR dari fork tidak menerima secret.** Guard `if:` pada job `preview`
  mensyaratkan `github.event.pull_request.head.repo.full_name == github.repository`.
- **Nilai runtime aplikasi TIDAK disalin ke GitHub.** Env aplikasi hidup di
  Vercel (bagian 3) dan Supabase (bagian 5), bukan di GitHub Secrets.
- Verifikasi nama secret (hanya nama, tanpa nilai):

```bash
gh secret list
```

## 5. Supabase (Edge Functions secret store)

Supabase hanya mengelola dua hal di sini: koneksi lokal/proyek ter-link dan
secret store Edge Functions. Saat ini **repo tidak memiliki Edge Functions**, jadi
jangan membuat secret atau migrasi palsu untuk mereka.

### Link proyek

```bash
supabase login
supabase link --project-ref <project-ref>
```

Project ref adalah identitas proyek Supabase (terlihat di URL dasbor). `link`
menyimpan asosiasi lokal ke state CLI, bukan ke repo.

### Secret Edge Functions

```bash
supabase secrets set KEY=value
supabase secrets list
```

`supabase secrets list` menampilkan **nama dan hash**, bukan nilai. Ini jalur
verifikasi tanpa membocorkan nilai.

### Verifikasi deploy

```bash
supabase functions list
```

Atau cek dasbor (Edge Functions → Logs) untuk memastikan fungsi saat ini jalan.

### Larangan

- **DILARANG menaruh secret di `supabase/config.toml`.** Berkas itu ter-commit.
- Repo **tidak punya Edge Functions**. Jangan membuat secret Edge Functions atau
  migrasi hanya untuk memuaskan daftar; jalur secret store di atas dipakai saat
  fitur Edge Function benar-benar ada.
- `supabase/config.toml` hanya memuat konfigurasi stack lokal (Task 0.4), tanpa
  kredensial.

## 6. Prosedur lokal

```bash
cp .env.example .env.local
```

Lalu isi nilainya dari dasbor masing-masing vendor.

| Berkas         | Pemakai                           | Catatan                                                 |
| :------------- | :-------------------------------- | :------------------------------------------------------ |
| `.env.example` | Referensi                         | Ter-commit; hanya nama + placeholder, tanpa nilai asli. |
| `.env.local`   | `apps/web` (Next.js)              | Tidak ter-commit; nilai asli lokal.                     |
| `.env`         | `packages/db` (Drizzle CLI), seed | Tidak ter-commit; dipakai tooling CLI.                  |

- **JANGAN pakai `.env` untuk rilis desktop/Tauri.** Desktop meng-inline prefix
  `VITE_*`, dan Vite tidak melihat `NEXT_PUBLIC_*`. Kiosk memakai
  `VITE_SENTRY_DSN` / `VITE_SENTRY_RELEASE` sendiri (Task 0.6).
- `.gitignore` sudah mengabaikan `.env` dan `.env.*`, tetapi meng-un-ignore
  `!.env.example` (baris 24-26). File `.env*` lain tidak pernah terlacak.
- Verifikasi penjagaan ignore tanpa membocorkan nilai:

```bash
git check-ignore .env.local   # harus mencetak .env.local
git ls-files .env.example     # harus mencetak .env.example
```

## 7. Rotasi per kelas

### 7.1 Rotasi pihak ketiga kuartalan

Kredensial vendor (Pakasir, Resend, Sentry, Cloudflare, Turnstile, Midtrans,
WhatsApp) dirotasi tiap kuartal, atau segera bila ada indikasi bocor. Alur:
buat kredensial baru di dasbor vendor, pasang di secret store (Vercel/Supabase),
deploy ulang, verifikasi, lalu hapus kredensial lama.

### 7.2 Respons kompromi langsung

Bila sebuah kredensial diduga bocor, lakukan pencabutan **segera** sebelum
tindakan lain (lihat urutan di bagian 8). Jangan menunggu jadwal rotasi.

### 7.3 Rotasi token Vercel / GitHub

`VERCEL_TOKEN` dan (bila ada) token GitHub dirotasi dari dasbor masing-masing
akun: buat token baru, perbarui secret GitHub, verifikasi job `preview` masih
jalan, lalu cabut token lama. Token lama dicabut setelah deployment baru sukses.

### 7.4 Penggantian kunci Firebase Admin

Kunci Admin tidak bisa di-rotasi di tempat. Urutannya:

1. Buat **key baru** di konsol Firebase (Project Settings → Service Accounts →
   Generate new private key).
2. Perbarui `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, dan
   `FIREBASE_ADMIN_PRIVATE_KEY` di Vercel.
3. Deploy ulang; verifikasi `getFirebaseAdmin()` berhasil (login uji/smoke test).
4. Baru setelah verifikasi sukses, hapus key lama di konsol.

### 7.5 Penggantian service-role Supabase

Buat service-role key baru di dasbor Supabase, pasang `SUPABASE_SERVICE_ROLE_KEY`
di Vercel, deploy ulang, verifikasi, lalu cabut key lama. Karena key ini melewati
RLS, jendela dua key aktif harus sesingkat mungkin.

### 7.6 Overlap/revocation kunci signing

`PAIRING_TOKEN_SECRET`, `LAN_JWT_SECRET`, `DEVICE_JWT_SECRET` dipakai untuk
membuat dan memverifikasi token. Saat rotasi, sediakan **jendela overlap**: token
yang terbit dengan kunci lama tetap valid sampai diterima dengan kunci baru.
Alur: pasang kunci baru, terima kedua kunci selama jendela grace, lalu cabut kunci
lama. Revocation total (tanpa overlap) membatalkan semua token aktif dan
memaksa pairing ulang, jadi hanya dipakai saat kompromi.

### 7.7 Migrasi kunci enkripsi (`ENCRYPTION_MASTER_KEY`)

**`ENCRYPTION_MASTER_KEY` BUKAN penukaran env biasa.** Mengganti nilainya
langsung membuat seluruh ciphertext aktif **tidak terbaca** — data terenkripsi
dengan kunci lama tidak bisa didekripsi kunci baru. Ini migrasi terkoordinasi:

1. **Overlap kunci** — simpan kunci lama dan kunci baru bersamaan (mis. kunci
   versi `v2` + `v1` lama) supaya dekripsi kunci lama tetap mungkin.
2. **Dual-read** — baca ciphertext dengan versi kunci yang tercatat, bukan
   menebak dari kunci aktif.
3. **Re-enkripsi** — enkripsi ulang data dengan kunci baru secara bertahap.
4. **Cabut kunci lama** setelah tidak ada ciphertext yang merujuknya.

Prosedur overlap/dual-read **didokumentasikan sekarang**, tetapi implementasinya
milik fitur enkripsi, bukan Task 0.9, dan harus ada **sebelum rotasi produksi
pertama**. Acuan: PRD Bab 10.16 (strategi rotasi kunci enkripsi) dan konflik
penomoran ADR-003 yang dicatat di `docs/ADR-003-firebase-auth.md` (ADR-003 Firebase
vs ADR-003 rotasi kunci); `packages/shared/src/env.ts:50` dan `:88` merujuk ADR
rotasi itu.

## 8. Respons insiden

Urutan wajib saat kredensial diduga bocor:

1. **Cabut kredensial lama lebih dulu** (revoke), sebelum investigasi. Menutup
   jendela eksploitasi adalah prioritas.
2. **Periksa audit log / riwayat deploy**: log akses Vercel, audit log Supabase,
   audit log Firebase, riwayat deployment, dan log penyedia pihak ketiga.
3. **Deploy ulang environment terdampak** dengan kredensial baru (Preview dan
   Production bila perlu).
4. **Verifikasi** kesehatan, auth, dan webhook: cek health endpoint, login uji,
   dan kirim webhook uji ke endpoint Pakasir.
5. **Catat tanggal rotasi + pemilik** **di luar Git** (catatan operator atau
   password manager). Jangan menulis tanggal/nama kredensial di repo.

## 9. Acceptance checklist

- [ ] `.env.local` lokal terisi dan `pnpm typecheck`/`pnpm lint` hijau.
- [ ] `git check-ignore .env.local` mencetak `.env.local`; `git ls-files .env.example` mencetak `.env.example`.
- [ ] `pnpm check:env-example` hijau (inventaris nama, tanpa duplikat, tanpa pola literal terlarang).
- [ ] Vercel: `rootDirectory = apps/web`; semua variabel publik + server-only ada di Preview & Production.
- [ ] Vercel: `SENTRY_AUTH_TOKEN` hanya Build env; tidak ada secret di `NEXT_PUBLIC_*`.
- [ ] Vercel: deploy preview `apps/web` sukses tanpa secret di CI.
- [ ] GitHub: `gh secret list` hanya menampilkan `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- [ ] GitHub: job `preview` sukses; PR dari fork tidak menerima secret.
- [ ] Supabase: `supabase secrets list` menampilkan nama (tanpa nilai); tidak ada secret di `supabase/config.toml`.
- [ ] Tidak ada Edge Function palsu atau migrasi yang dibuat hanya untuk secret.
- [ ] `.env.example` tidak pernah memuat nilai rahasia asli.

## 10. Verifikasi tanpa membocorkan nilai

```bash
vercel env ls
gh secret list
supabase secrets list
pnpm check:env-example
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
```

Seluruh perintah di atas hanya mencetak **nama dan status**, tidak pernah nilai.

Larangan tegas: **jangan pernah** `cat .env`, `env`, `printenv`, atau
meng-echo nilai rahasia di log CI. `pnpm check:env-example` adalah guard yang
memeriksa inventaris nama variabel, duplikat, dan pola literal terlarang di
**`.env.example` saja** — ia tidak pernah membaca atau mencetak `.env`, GitHub
Secrets, env Vercel, atau nilai runtime.
