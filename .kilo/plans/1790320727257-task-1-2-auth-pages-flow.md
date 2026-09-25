# Task 1.2 Auth Pages & Flow

## Tujuan dan keputusan

- Implementasi hanya Task 1.2: `/login`, `/unauthorized`, Firebase email/password sign-in, Staff email+PIN, session cookie, Edge route gate. Tidak membuat dashboard/provisioning/invite.
- Firebase Client SDK hanya dipakai browser. `POST /api/auth/session` memverifikasi ID token dengan `verifyIdToken` dari `@snapbox/auth/admin`, mengambil user/tenant/subscription dari DB, lalu menerbitkan session cookie `snapbox_session`.
- Karena `firebase-admin` tidak kompatibel Edge, `middleware.ts` tidak mengimpor Admin SDK/DB. Middleware memverifikasi envelope session bertanda tangan menggunakan Web Crypto HMAC dan memeriksa `role`, `tenantId`, `subscription`, `exp`; route server/layout/API tetap melakukan verifikasi authoritative terhadap DB.
- Session payload minimum: Firebase UID, aplikasi user ID, email, role (`CEO|OWNER|STAFF`), tenant ID/parent tenant ID, subscription gate state, issued-at, expiry. Jangan masukkan token Firebase, PIN, atau secret.
- Cookie: `HttpOnly`, `Secure` di production, `SameSite=Lax`, `Path=/`, expiry terbatas; secret baru `SESSION_COOKIE_SECRET` (base64 32 byte) wajib server/Edge. HMAC implementation harus memakai Web Crypto agar verifier identik di Node dan Edge. Invalid/expired/tampered cookie dihapus/dianggap anonymous.
- Staff PIN memakai `email + PIN`, bukan PIN-only. Route mencari user STAFF aktif berdasarkan email, tenant aktif, lalu mencocokkan PIN terhadap `booths.operatorPinHash` milik tenant. Hash format ditetapkan `scrypt$<salt-base64url>$<key-base64url>$<N>$<r>$<p>`; plaintext tidak pernah disimpan/log. PIN verification harus constant-time dan gagal tertutup bila format hash invalid.
- Subscription gate: CEO tidak diblokir subscription. OWNER/STAFF hanya lolos bila tenant tidak `SUSPENDED|BANNED|DELETED` dan ada subscription `ACTIVE|EXPIRING|GRACE_PERIOD` dengan tanggal valid; expired/blocked diarahkan ke `/owner-dashboard/subscription` bila route itu tersedia, selain itu `/unauthorized` dengan reason aman. Middleware memakai snapshot session; server endpoint mengulang query DB.
- Self-registration tetap tidak ada. Error UI generik untuk kredensial/PIN gagal; jangan bocorkan apakah email, user, booth, atau subscription ditemukan.

## File dan perubahan konkret

1. Tambahkan dependency workspace `@snapbox/auth` ke `apps/web/package.json`; jangan menambah library crypto/hash bila Node/Web Crypto + helper kecil cukup. Pastikan `@snapbox/db` sudah tersedia untuk route server.
2. Tambahkan helper server-only, misalnya `apps/web/src/lib/auth/session.ts`:
   - schema Zod payload/session context;
   - encode/decode base64url;
   - sign/verify HMAC-SHA256 via Web Crypto;
   - issue/parse/clear cookie dengan atribut keamanan terpusat;
   - role home mapping dari `ROLE_HOME_ROUTE`;
   - subscription predicate bersama untuk route server dan payload snapshot.
     Jangan ekspor helper yang mengimpor DB/Firebase ke middleware bila bundling Edge akan menarik modul Node.
3. Tambahkan helper server-only `apps/web/src/lib/auth/authorization.ts` untuk query `users`, `tenants`, `b2bSubscriptions`, normalisasi claim melalui `toCustomClaims`, lookup user by Firebase UID, dan membangun session setelah semua pemeriksaan. Tenant ID selalu dari claim/user/database, tidak dari body klien.
4. Tambahkan helper hash PIN `apps/web/src/lib/auth/pin.ts` menggunakan `node:crypto` `scrypt`/`timingSafeEqual` untuk route Node saja. Sertakan format parser ketat, batas panjang PIN 6 digit, parameter scrypt tetap, dan satu self-check kecil atau test Node untuk round-trip/hash invalid/timing-safe mismatch. Middleware tidak mengimpor helper ini.
5. Tambahkan `apps/web/src/app/api/auth/session/route.ts`:
   - `POST` validasi body `{ idToken }` dengan Zod, ukuran body/token dibatasi, Admin `verifyIdToken`, resolve user/tenant/subscription, set session cookie, return `{ ok: true, redirectTo }`.
   - Map Firebase errors dan authorization failures ke status generik tanpa secret/claim dump.
   - `DELETE` clear cookie; method lain `405` dengan `Allow`.
   - Set `Cache-Control: no-store`; jangan log token/email sensitif.
6. Tambahkan `apps/web/src/app/api/auth/staff-pin/route.ts`:
   - `POST` validasi `{ email, pin }`, normalisasi email, rate-limit boundary sesuai PRD (`/api/auth/*`), lookup STAFF aktif, tenant/booth aktif, verify `operatorPinHash`, query subscription, issue session cookie yang sama.
   - Response generik untuk semua kegagalan; audit/login-failure hook hanya bila fondasi audit tersedia, tanpa PIN.
   - Tetapkan runtime Node karena memakai DB dan `node:crypto`.
7. Tambahkan `apps/web/src/app/api/auth/logout/route.ts` atau gunakan `DELETE /api/auth/session` secara konsisten. Client logout Firebase dan server cookie harus sama-sama dibersihkan; kegagalan salah satu tidak boleh meninggalkan UI seolah logout berhasil.
8. Tambahkan client component `apps/web/src/components/auth/login-form.tsx`:
   - mode toggle Email & Password / Staff PIN dengan `aria-pressed`, field labels, autocomplete yang tepat, password/PIN masking, submit pending, keyboard/focus states, error region `role="alert"`.
   - Email mode: `getFirebaseAuth()` + `signInWithEmailAndPassword`, `getIdToken()`, POST session, redirect hanya berdasarkan response server.
   - PIN mode: email + numeric 6-digit PIN ke route server; tidak memanggil Firebase client password flow.
   - Tampilkan status subscription/access secara generik; jangan render custom claims sebagai otoritas.
9. Tambahkan `apps/web/src/app/(auth)/login/page.tsx` atau route equivalent yang menghasilkan `/login`, memakai design system `@snapbox/ui` (`Button`, `Input`, `Label` bila cocok) dan kelas scoped `public-*`/auth-specific. Neobrutalist: border tebal, hard shadow, yellow/violet accent, responsive mobile, 44px targets, visible focus, no gradient tambahan di luar identitas yang sudah ada. Tambahkan `generateMetadata` no-store/noindex.
10. Tambahkan `apps/web/src/app/(auth)/unauthorized/page.tsx` untuk 403: pesan tidak membocorkan detail, tombol kembali `/login`, link home publik bila memang route tersedia, metadata `noindex`.
11. Tambahkan `apps/web/src/middleware.ts`:
    - matcher hanya route private/dashboard, bukan asset/public/API auth;
    - parse/verify `snapbox_session` dengan helper Edge-safe;
    - anonymous ke `/login?next=...` dengan `next` tervalidasi internal path;
    - role mismatch ke `/unauthorized` atau home role yang benar;
    - STAFF tidak boleh masuk owner/CEO, OWNER tidak boleh CEO, CEO tidak boleh staff route;
    - blocked/expired subscription ke subscription route/unauthorized sesuai route yang tersedia;
    - jangan melakukan DB/Firebase Admin fetch di middleware.
12. Update env contract/docs: `packages/shared/src/env.ts`, `.env.example`, dan `docs/ENVIRONMENT-AND-SECRETS.md` untuk `SESSION_COOKIE_SECRET`; jalankan guard env yang ada. Jangan menambahkan secret value.
13. Bila schema/migration saat ini belum memiliki format/owner untuk `operatorPinHash`, gunakan kolom `booths.operatorPinHash` yang sudah ada dan dokumentasikan provisioning sebagai follow-up. Jangan membuat endpoint PIN management di Task 1.2. Bila migration lokal belum memuat kolom tersebut, tambahkan migration Drizzle minimal sebelum route dipakai.

## Error, security, dan edge cases

- Firebase token valid tetapi user DB hilang, disabled, claim role tidak sinkron, tenant banned, atau subscription tidak aktif: no session; response generik; redirect unauthorized.
- Claim `role` aplikasi harus dibaca dari `app_role` melalui `toCustomClaims`, bukan claim Postgres `role` (`authenticated`).
- Session expiry lebih pendek dari Firebase token dan dirotasi saat login; perubahan role/subscription tidak menunggu expiry karena server re-check di protected handlers. Middleware stale snapshot hanya gate awal, bukan authorization final.
- `next` hanya relative same-origin path; tolak absolute URL/protocol-relative URL.
- Rate limiting auth adalah concern wajib. Jika belum ada shared limiter, buat boundary interface yang fail-closed di production dan gunakan IP/email key; jangan menulis limiter in-memory sebagai klaim production-ready. Cloudflare rule tetap menjadi defense tambahan.
- Cookie tidak boleh diakses client-side, tidak boleh dipasang dari query/body, dan tidak boleh dikirim ke logging/Sentry.
- CORS tidak diperlukan untuk same-origin App Router; method/content-type/body size divalidasi.

## Validasi

1. `pnpm --filter @snapbox/auth typecheck`, `pnpm --filter @snapbox/db typecheck`, `pnpm --filter @snapbox/web lint`, `pnpm --filter @snapbox/web typecheck`, `pnpm --filter @snapbox/web build`.
2. Jalankan `pnpm check:env-example`, `pnpm check:claims-sync`, serta test self-check PIN/session. Pastikan build middleware tidak menarik `firebase-admin`, `postgres`, atau modul Node ke Edge bundle.
3. Manual browser desktop/mobile: email login sukses/gagal, disabled user, claim role mismatch, Staff PIN sukses/gagal, toggle mode, pending state, refresh, logout, back/forward, keyboard-only, focus/contrast.
4. Matrix middleware: anonymous, CEO, OWNER active, OWNER expired, OWNER suspended, STAFF, wrong dashboard, tampered cookie, expired cookie, malformed cookie, unsafe `next`.
5. Inspect `Set-Cookie`: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` production, no token in response/body/log. Confirm `/login` and `/unauthorized` noindex/no-store.

## Out of scope

- Firebase provisioning, invite/reset-password, staff CRUD/PIN management, LAN QR token, device pairing, dashboard UI, subscription engine/webhook/cron, real rate-limit provider implementation, audit-log dashboard, Supabase Auth exchange.
- Do not add `/register`.
