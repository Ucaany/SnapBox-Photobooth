# Task 1.4 Tenant Provisioning Wizard

## Keputusan

- `/ceo-dashboard/tenants` tetap menampilkan 20 tenant dummy lokal sesuai PRD/skeleton; filter search/status/plan bekerja client-side. Mutasi dan detail memakai data nyata sehingga demo tidak mengklaim dummy sebagai telemetry produksi.
- `/ceo-dashboard/tenants/new` memakai wizard client tiga langkah: `Client Details`, `Plan & Duration`, `Review & Invite`. Validasi Zod terjadi di browser untuk UX dan di server action sebagai trust boundary.
- Invite owner memakai Firebase Admin `createUserWithoutPassword`, `generatePasswordResetLink`, lalu Resend API. Tidak menyimpan password atau membuat token onboarding baru. Tambahkan helper Admin SDK untuk reset link.
- Provisioning DB dikerjakan dalam transaksi: `tenants`, owner `users`, `b2b_subscriptions`, dan satu `booths` default. Plan canonical dibaca dari tabel `plans`; tidak memakai hardcoded perbandingan plan untuk entitlement.
- Firebase tidak mendukung transaksi bersama PostgreSQL. Jika insert DB gagal setelah user Firebase dibuat, hapus user Firebase sebagai kompensasi. Jika email gagal setelah commit, provisioning tetap sukses dan action mengembalikan status `inviteFailed` agar CEO dapat retry/resend pada detail.
- Semua server action mengulang verifikasi sesi + query user DB dan menerima hanya role `CEO`; ID tenant dari URL diverifikasi di server. Cross-tenant/unknown resource ditutup sebagai 404 sesuai ADR.
- Suspend/ban/restore/reset/downgrade membutuhkan confirmation UI dan reason non-empty. Status tenant serta user Firebase disabled diselaraskan: suspend/ban menonaktifkan owner, restore mengaktifkan owner. Reset mengirim ulang reset link tanpa mengubah status tenant. Downgrade mengubah tenant plan dan membuat/update subscription draft sesuai kontrak action.
- Setiap mutasi menulis `activity_logs` dengan actor, action, tenant/resource, reason, dan metadata. Email hanya memakai env `RESEND_API_KEY`/`RESEND_FROM_EMAIL`; tidak menaruh secret di client.
- Route eksplisit `new` dan `[id]` harus menang atas catch-all CEO route. Catch-all disesuaikan agar tidak merender halaman skeleton untuk route provisioning.

## Implementasi

1. Tambahkan shared contract/schema server-input di `apps/web/src/lib/ceo-dashboard/tenant-contract.ts`: client details, plan/duration, action/reason, plan/status enums, batas panjang, email/phone validation, serta result/error discriminated union. Reuse `@snapbox/shared` domain schemas.
2. Tambahkan server utilities di `apps/web/src/lib/ceo-dashboard/tenant-server.ts`: `requireCeo()`, `getTenantByIdOr404`, plan lookup, owner lookup, audit writer, and Resend sender. Pastikan modul server-only tidak diimpor client.
3. Tambahkan `apps/web/src/app/(ceo-dashboard)/ceo-dashboard/tenants/actions.ts` dengan `createTenant`, `changeTenantStatus`, `resetTenantInvite`, dan `downgradeTenant`:
   - parse `FormData`/plain action input dengan schema;
   - authorize CEO from fresh session/DB;
   - load active plan and calculate duration dates/amount from DB;
   - create Firebase user and reset link;
   - transactionally insert tenant, OWNER user, subscription (`PENDING` or contract-approved initial status), default booth (`UNPAIRED`), and audit log;
   - compensate Firebase user on DB failure;
   - send invite after commit, return invite delivery result, `revalidatePath` for tenant routes;
   - for status/action mutations, update DB, Firebase disabled state, audit log, and return typed feedback. Do not silently swallow partial failures.
4. Extend `packages/auth/src/admin.ts` with a server-only `generatePasswordResetLink(email, actionCodeSettings?)` wrapper. Keep Admin barrel boundary intact. Add no client Firebase Admin import.
5. Add a minimal server-side Resend adapter, preferably `apps/web/src/lib/email/resend.ts`, using native `fetch` to avoid a new dependency. Validate env lazily, set timeout via `AbortSignal.timeout`, send plain HTML/text invite with company/owner/plan/reset URL, and expose typed failure without logging secrets.
6. Replace the skeleton tenant panel behavior in `apps/web/src/components/ceo-dashboard/ceo-dashboard-content.tsx` with the 20-row dummy dataset and working search/status/plan filters, row links to `/ceo-dashboard/tenants/[id]`, and CTA to `/ceo-dashboard/tenants/new`. Preserve `Data contoh` labeling and neobrutalist UI primitives.
7. Create `apps/web/src/app/(ceo-dashboard)/ceo-dashboard/tenants/new/page.tsx` and a client component such as `tenant-provisioning-wizard.tsx`. Implement step navigation, per-step validation, keyboard/focus states, review summary, pending/error/success states, and redirect to detail only after successful server result. Prevent duplicate submit with pending state; show invite delivery warning when DB succeeded but Resend failed.
8. Create `apps/web/src/app/(ceo-dashboard)/ceo-dashboard/tenants/[id]/page.tsx` as a server page loading tenant, owner, latest subscriptions, booths, and activity. Add `tenant-detail-actions.tsx` client dialogs/forms with explicit confirmation text, required reason, destructive styling, loading/error/success feedback, and accessible labels.
9. Add real-data query helpers for detail and action refresh. Show profile, subscription history, booth list, recent activity, status/plan badges, invite status, and only actions valid for current state. Avoid dead buttons; unavailable transitions render explanatory text.
10. Add scoped `ceo-tenant-*` CSS in `apps/web/src/app/globals.css`: three-step progress, review layout, detail panels, action danger states, responsive tables, 44px targets, visible focus, reduced motion. Reuse existing tokens and typography; no new icon dependency.
11. Update CEO registry/sidebar metadata so `tenants/new` and dynamic tenant detail have correct headings/breadcrumbs without adding dynamic IDs to static navigation. Adjust `[...segments]/page.tsx` to exclude explicit provisioning/detail paths or return `notFound()`.
12. Add a focused test/self-check for contract validation and action transition matrix. Minimum cases: invalid email/reason, unknown plan, status transitions, duplicate owner email, DB failure compensation path, Resend failure result, and CEO-only authorization.

## Data and failure rules

- Duplicate owner email must fail before DB mutation where possible; Firebase `auth/email-already-exists` maps to a user-safe validation error.
- Missing plan or inactive plan fails closed; no subscription row is created with guessed pricing.
- Transaction rollback must remove all DB rows; Firebase compensation failure is logged with request ID and surfaced as an operational error, never exposed with credentials/details.
- Status actions are idempotent where safe (`restore` on active, `suspend` on suspended) and reject illegal transitions with a typed message.
- `reset` must not enable a banned/suspended tenant. Reason remains mandatory and is audited.
- Invite URL and Firebase UID never enter `activity_logs.metadata` or client error payloads.

## Validation

1. Run `pnpm --filter @snapbox/web lint`, `pnpm --filter @snapbox/web typecheck`, and `pnpm --filter @snapbox/web build`.
2. Run the focused tenant contract/action tests with Firebase, DB, and Resend mocked; assert transaction/compensation and no secret leakage.
3. Verify route matrix: anonymous redirects to `/login`; non-CEO denied; CEO can open list/new/detail; unknown tenant returns 404; catch-all does not shadow explicit routes.
4. Browser-test wizard step validation, back/next, refresh-safe errors, duplicate-submit prevention, success redirect, and invite failure warning.
5. Browser-test detail actions with confirmation + reason, cancellation, illegal-state messaging, status/plan refresh, and audit visibility.
6. Check desktop/mobile layouts, keyboard dialog behavior, focus rings, reduced motion, table overflow isolation, and no console errors.

## Di luar scope

- Real tenant list pagination/search API replacing the 20-row dummy list.
- Pakasir invoice creation/payment webhook, plan editor, entitlement service, full audit-log page persistence UX, owner/staff provisioning, custom onboarding route, and production email template editor.
- Migration changes: existing schema already contains required `users`, `tenants`, `plans`, `b2b_subscriptions`, `booths`, and `activity_logs` tables.
