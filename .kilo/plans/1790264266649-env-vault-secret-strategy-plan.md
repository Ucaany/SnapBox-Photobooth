# Task 0.9: Env Vault & Secret Strategy

## Konteks

- `.env.example` sudah ada dan mengikuti PRD Bab 10.14.
- `packages/shared/src/env.ts` sudah membagi public, server, encryption, dan third-party env berdasarkan trust boundary.
- `.github/workflows/ci.yml` sudah memakai `VERCEL_TOKEN`, `VERCEL_ORG_ID`, dan `VERCEL_PROJECT_ID` untuk preview deploy, tetapi belum ada runbook provisioning/rotasi.
- `apps/web/VERCEL.md` hanya mendata sebagian env Vercel.
- Akun vendor tidak tersedia di repo; provisioning nilai rahasia tidak boleh dilakukan atau dicatat oleh implementasi.

## Keputusan

- Jadikan `.env.example` inventory kanonik, dengan placeholder yang tidak menyerupai credential valid dan catatan scope `development`, `preview`, `production`.
- Jangan menambah secret ke Git, source code, workflow literals, Supabase config, atau database.
- Vercel menyimpan env aplikasi web per environment. Public env boleh exposed sesuai prefix; semua server/encryption/third-party env tetap server-only.
- GitHub Actions menyimpan hanya credential automation yang diperlukan workflow. Nilai runtime aplikasi tidak disalin ke GitHub kecuali job tertentu benar-benar membutuhkannya.
- Supabase `secrets set` didokumentasikan sebagai secret store untuk Edge Functions; karena repo belum memiliki Edge Function, jangan membuat secret palsu atau migration untuknya.
- Rotasi encryption/signing key diperlakukan sebagai migrasi terkoordinasi, bukan penggantian env langsung, karena ciphertext/token aktif dapat menjadi tidak terbaca. Rotasi vendor token dilakukan create-new, deploy, verify, revoke-old.
- Tambahkan verifikasi inventory/placeholder yang aman untuk CI atau operator; output hanya nama variabel dan status, tidak pernah nilainya.

## Perubahan yang diimplementasikan

1. **`.env.example`**
   - Audit agar seluruh key yang dikonsumsi `packages/shared/src/env.ts`, `apps/web`, `apps/desktop`, `packages/auth`, Drizzle, Sentry, Cloudflare, Turnstile, Resend, dan Pakasir tercantum tepat sekali.
   - Kelompokkan dengan label `PUBLIC`, `SERVER_ONLY`, `ENCRYPTION`, `THIRD_PARTY`, `CLOUDFLARE`, `LINKS`, `DESKTOP`.
   - Tambahkan tabel/komentar source, environment, dan generator untuk setiap kelas secret; gunakan contoh non-secret yang jelas.
   - Tegaskan bahwa `NEXT_PUBLIC_*` dan `VITE_*` masuk bundle; Firebase public config/Supabase anon key bukan secret, service role/Admin/private key/payment credentials adalah secret.
   - Pastikan contoh private key memakai escaped newline yang kompatibel dengan loader Firebase.

2. **Dokumentasi operasi secret**
   - Buat `docs/ENVIRONMENT-AND-SECRETS.md` sebagai runbook Task 0.9.
   - Dokumentasikan pemetaan env ke Vercel `Development`/`Preview`/`Production`, root directory `apps/web`, dan Build vs Runtime scope.
   - Dokumentasikan GitHub Actions secrets minimum: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`; jelaskan secret tambahan hanya untuk workflow yang menggunakannya, serta fork PR tidak boleh menerima secret.
   - Dokumentasikan Supabase: project ref/link, `supabase secrets set` untuk Edge Functions, `supabase secrets list`/deploy verification tanpa menampilkan nilai, dan larangan menaruh secret di `supabase/config.toml`.
   - Tambahkan prosedur lokal: salin `.env.example` ke `.env.local`/`.env`, isi dari vendor, jangan memakai `.env` desktop/Tauri.
   - Tambahkan prosedur rotasi per kelas: quarterly third-party, immediate compromise response, Vercel/GitHub token rotation, Firebase Admin key replacement, Supabase service-role replacement, signing key overlap/revocation, encryption key migration.
   - Tambahkan incident response: revoke old credential, inspect audit logs/deploy history, redeploy affected environments, verify health/auth/webhook, record rotation date/owner outside Git.
   - Tambahkan acceptance checklist dan command examples yang tidak mencetak secret (`vercel env ls`, `gh secret list`, `supabase secrets list`, `pnpm typecheck`, `pnpm lint`, `pnpm test`).

3. **Vercel documentation**
   - Update `apps/web/VERCEL.md` agar inventory env lengkap dan konsisten dengan `.env.example`/schema.
   - Bedakan public browser variables, server runtime variables, build-only Sentry variables, optional integrations, dan environment-specific URLs/keys.
   - Cantumkan bahwa `vercel env add`/dashboard provisioning dijalankan operator terautentikasi, bukan CI dengan raw values.

4. **PHASE-0 status and guardrail**
   - Update `docs/PHASE-0.md`: Task 0.9 deliverables, batas manual provisioning, verification evidence, dan status checkbox catatan repo.
   - Tambahkan script ringan `scripts/check-env-example.mjs` (atau perluas guard yang sudah ada) untuk memastikan required key inventory, duplicate keys, banned literal patterns, dan `.env.example` tetap tracked.
   - Tambahkan script tersebut ke `package.json` dan job `verify` di `.github/workflows/ci.yml`.
   - Guard harus memeriksa nama/key structure saja; tidak memuat atau mencetak `.env`, GitHub secret, Vercel env, atau nilai runtime.

## Data flow dan failure handling

- Local developer: `.env.example` -> ignored `.env.local`/`.env`; schema parse gagal cepat dengan pesan tanpa nilai.
- Vercel: dashboard/CLI env store -> build/runtime `apps/web`; preview/prod memakai environment scope berbeda.
- CI: GitHub encrypted secrets -> process env hanya pada preview deploy; job dilewati aman bila Vercel secrets tidak tersedia.
- Supabase Edge Function (future): Supabase secret store -> function runtime; tidak tersedia pada browser/Vercel kecuali explicitly proxied server-side.
- Missing/invalid env: fail verification/deploy with variable names only; never echo shell env or serialize `process.env`.
- Leaked secret: revoke first, replace in provider and stores, redeploy, invalidate sessions/signatures where applicable, document incident.

## Validation

- `pnpm check:env-example`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm format:check`
- `pnpm build`
- Manual review: `git check-ignore .env.local`, `git ls-files .env.example`, inspect workflow logs for absence of secret values.
- Operator verification: Vercel environment names/scopes, GitHub secret names, Supabase secret names, and one preview deployment; capture only URLs/status, never credential values.

## Explicitly out of scope

- Creating or linking real Vercel/Supabase/Firebase/Cloudflare/Sentry accounts.
- Executing provider CLI commands requiring user credentials.
- Adding Supabase Edge Functions that do not yet exist.
- Encryption key dual-read/versioned ciphertext migration; document procedure now, implement with the encryption feature before first production rotation.
- Tauri code-signing/notarization secrets; owned by Task 8.3.
