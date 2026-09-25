# Task 1.6 Subscription Engine B2B

## Keputusan

- Model invoice Task 1.6 memakai row `b2b_subscriptions` yang sudah ada. Tidak menambah `b2b_invoices` atau migrasi baru; satu row mewakili invoice/subscription draft dan retry memperbarui row tersebut.
- `/ceo-dashboard/subscriptions` membaca subscription nyata dengan join `tenants` dan `plans`. Jika query berhasil tetapi kosong, UI memakai lima row dummy existing sebagai fallback demo dan memberi label `Data contoh`; dummy tidak boleh dikirim ke server action.
- Status tabel memakai mapping presentasi: `ACTIVE`/`paidAt` menjadi `Lunas`, `PENDING` dengan `pakasirInvoiceId` menjadi `Menunggu`, dan `PENDING` tanpa invoice ID setelah kegagalan create API menjadi `Gagal`; status subscription DB tidak diperluas dengan `FAILED`.
- `createInvoice` dan `retryInvoice` adalah Server Action draft, CEO-only, input tervalidasi server-side. Aksi menghitung nominal dari plan/row DB, tidak mempercayai nominal atau tenant dari browser.
- Adapter Pakasir hanya memakai native `fetch`, timeout, dan payload/response typed minimum. Endpoint berasal dari env `PAKASIR_B2B_API_URL` opsional; tanpa URL/API key action gagal aman tanpa mutasi. Tidak mengarang hardcoded endpoint vendor.
- Webhook `/api/webhooks/pakasir-b2b` menerima POST Node runtime, membaca raw body, memverifikasi `X-Pakasir-Signature` HMAC-SHA256 constant-time memakai `PAKASIR_B2B_WEBHOOK_SECRET`, lalu melakukan idempotensi melalui unique `(provider, provider_event_id)` pada `webhook_events`.
- Webhook hanya boleh mengubah status subscription dari payload terverifikasi. Event duplicate mengembalikan 200 tanpa update; signature invalid 401; payload malformed/unmatched invoice 400/404 sesuai kontrak route; kegagalan pemrosesan dicatat ke `webhook_failures` tanpa menyimpan signature/secret.
- `ACTIVE` webhook menetapkan `paidAt`, `pakasirTransactionId`, `validFrom`, `validUntil` dari data provider atau periode canonical row, memperbarui `updatedAt`, serta revalidate dashboard. Tidak ada aktivasi dari browser/action.
- Audit memakai helper `writeAuditLog` yang sudah ada: `subscription.invoice_create`, `subscription.invoice_retry`, dan `subscription.webhook_paid` dengan metadata aman. Audit failure tidak membatalkan mutasi.

## Implementasi

1. Tambahkan `apps/web/src/lib/ceo-dashboard/subscription-contract.ts`:
   - schema status/filter, UUID, `subscriptionId`, dan action input strict;
   - schema payload Pakasir minimum (`event_id`/transaction id, invoice id, status, amount, paid time, valid-until) dengan batas ukuran dan status allowlist;
   - discriminated result `{ ok: true; ... }` / `{ ok: false; code; message; fieldErrors? }` tanpa stack, payload, URL rahasia, atau credential;
   - fungsi mapping status DB ke label UI dan guard retry eligibility.

2. Tambahkan `apps/web/src/lib/ceo-dashboard/pakasir-b2b.ts` server-only:
   - parse env lazily menggunakan `thirdPartyEnvSchema` plus `PAKASIR_B2B_API_URL` URL optional;
   - `createPakasirInvoice` dan `retryPakasirInvoice` dengan `fetch`, `AbortSignal.timeout`, API key server-only, response status/JSON validation, dan error normalization;
   - payload draft berisi invoice/reference ID subscription, tenant/company, amount, currency `IDR`, callback URL, dan metadata non-secret;
   - jangan log API key, signature, raw body, payment URL sensitif, atau seluruh response provider;
   - expose helper signature HMAC memakai `node:crypto` dan `timingSafeEqual`, serta helper constant-time hex/base64 normalization bila kontrak provider belum final.

3. Extend `apps/web/src/lib/ceo-dashboard/tenant-server.ts` atau helper subscription server terpisah:
   - query invoice rows join tenant/plan, urut `createdAt` desc, canonical numeric/date serialization;
   - `getSubscriptionForInvoiceOr404` memvalidasi UUID dan menutup unknown row sebagai 404;
   - reuse `requireCeo` dan `writeAuditLog`, tidak impor helper server-only ke client;
   - helper period calculation menjaga renewal dari `validUntil` aktif bila relevan, tanpa mengubah harga row historical.

4. Tambahkan `apps/web/src/app/(ceo-dashboard)/ceo-dashboard/subscriptions/actions.ts`:
   - `createInvoice(input: unknown)` authorize CEO, parse input, load canonical subscription/tenant/plan, panggil adapter, lalu update `pakasirInvoiceId`/`pakasirPaymentUrl`/`updatedAt` hanya setelah API sukses;
   - `retryInvoice(input: unknown)` hanya menerima row retryable, panggil provider dengan reference stabil/idempotency key, update provider IDs/URL setelah sukses;
   - transaksi DB menjaga update tidak menimpa row yang telah berubah/paid; conflict dikembalikan sebagai result aman;
   - audit dan `revalidatePath('/ceo-dashboard/subscriptions')` setelah sukses;
   - map missing config, timeout, 4xx/5xx provider, DB constraint, auth, dan unexpected error ke kode user-safe.

5. Buat route eksplisit `apps/web/src/app/(ceo-dashboard)/ceo-dashboard/subscriptions/page.tsx`:
   - metadata title/description dari registry, `robots: noindex`, server-load query;
   - fallback dummy hanya ketika hasil query kosong, bukan saat DB error; DB error tampil sebagai error page/state tertutup;
   - render component client dengan rows serializable dan `isExample` marker;
   - update catch-all guard agar multi-segment subscriptions tidak pernah dirender oleh `[...segments]`.

6. Ganti `apps/web/src/components/ceo-dashboard/views/subscriptions-view.tsx` atau pindahkan renderer menjadi komponen dengan props server rows:
   - pertahankan neobrutalist design system, `PageIntro`, `Table`, `Badge/StatusBadge`, `Button`, `Input/Select` existing;
   - tabel invoice, tenant, periode, nominal IDR, status, issued/paid date, link Pakasir bila aman, dan aksi per row;
   - filter status/search bekerja pada rows server; status mapping konsisten dengan contract;
   - tombol `Buat invoice`/`Coba tagih ulang` disabled untuk dummy, paid, atau pending non-retryable; tidak ada global action yang ambigu;
   - pending, success, error, empty, fallback-example, `aria-live`, focus, duplicate-submit prevention, dan `router.refresh()` setelah sukses;
   - label eksplisit bahwa API/webhook masih draft sandbox, bukan status pembayaran manual.

7. Tambahkan `apps/web/src/app/api/webhooks/pakasir-b2b/route.ts`:
   - `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `Cache-Control: no-store`;
   - batasi method POST dan ukuran raw body sebelum parse;
   - verifikasi HMAC atas raw body sebelum validasi payload; jangan memakai parsed JSON untuk signature;
   - insert event idempotency dengan provider `pakasir-b2b`, handle unique conflict sebagai duplicate 200;
   - transaction: resolve subscription by invoice ID/transaction ID, update only valid state transition, mark event processed; malformed/unmatched/provider failure masuk `webhook_failures` dengan redacted payload;
   - return JSON status minimal, tanpa echo secret/payload penuh.

8. Update env contract/docs only where required by existing conventions:
   - add optional `PAKASIR_B2B_API_URL` to shared env/server documentation and `.env.example` if present; keep all Pakasir variables server-only;
   - do not place credentials in client config or commit actual values. Existing `.env` contains live-looking secrets and must be rotated outside this task before any shared/deployed use.

9. Add focused Node self-check/test following repo style:
   - HMAC valid, altered body/signature, malformed encoding, constant-time mismatch;
   - contract rejects oversized/unknown/missing payload fields and invalid statuses;
   - status mapping/retry matrix, dummy action guard, missing config fail-closed;
   - action authorization, provider failure leaves DB unchanged, successful create/retry persists IDs, duplicate webhook no second update, paid transition only from verified event;
   - assert secret/signature/raw payload absent from client result, audit metadata, and failure message.

## Data dan failure rules

- DB row remains `PENDING` when Pakasir create/retry fails; UI derives `Gagal` from the failed operation marker/result without adding a new enum or claiming payment state changed.
- Provider success without required invoice ID/payment URL fails closed and does not update the row.
- Webhook signature verification precedes payload parsing and DB lookup. Invalid signatures are never stored as processed events.
- Webhook idempotency uses provider event ID when available; otherwise stable transaction ID/invoice ID is rejected as malformed rather than guessed.
- `PAID`/`ACTIVE` is server-authoritative. Browser actions cannot set paid fields or subscription status.
- Historical amount remains unchanged. Retry does not recalculate from client input; renewal amount comes from canonical plan only when creating a new draft row under an explicitly supported flow.
- Provider API errors are safe for users; detailed diagnostics stay server logs/Sentry with redaction.
- Dummy rows never reach Pakasir or DB mutation paths.

## Validation

1. Run `pnpm --filter @snapbox/web lint`, `pnpm --filter @snapbox/web typecheck`, `pnpm --filter @snapbox/web build`, and focused Node self-check.
2. Route matrix: anonymous redirect `/login`, non-CEO action denial, CEO route access, explicit subscriptions route wins over catch-all, DB empty fallback, DB error non-fallback.
3. Action tests: create success, retry success, retry ineligible, missing env, timeout, provider 4xx/5xx, stale row conflict, no mutation on failure, audit/revalidation only after success.
4. Webhook tests: valid paid event, duplicate event, duplicate transaction, bad signature, malformed JSON, oversized body, unknown invoice, out-of-order/non-regressive transition, DB failure and dead-letter insert.
5. Browser tests: search/status filter, dummy labels/disabled actions, pending duplicate click, error retry, success refresh, external URL safety, keyboard/focus/aria-live, mobile table overflow, reduced motion, no console errors.
6. Verify no secret values are printed by lint/test/build output and inspect `git diff` for accidental env leakage.

## Di luar scope

- Separate invoice table/history, enum `FAILED`, production Pakasir endpoint certification, cron expiry/grace-period automation, email invoice delivery, Owner subscription page, realtime notifications, queue worker deployment, and full audit-log UI.
- Full vendor-specific webhook schema beyond the documented draft contract; adapter remains configurable until Pakasir API documentation is supplied.
