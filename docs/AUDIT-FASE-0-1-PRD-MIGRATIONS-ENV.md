# Audit Fase 0-1: PRD, Migrations, dan Environment

**Tanggal audit:** 2026-09-25
**Scope:** Fase 0 task 0.1-0.9 dan Fase 1 task 1.1-1.12; [PRD](/Users/ucaany/Documents/Snap Box - Main/PRD_SnapBox_Photobooth_Platform_SaaS_Manajemen_Photobooth_Multi-Tenant_Kiosk_Desktop.md), migration SQL, seed, env, runtime acceptance.
**Repository references:** [PHASE-0](/Users/ucaany/Documents/Snap Box - Main/docs/PHASE-0.md), [README](/Users/ucaany/Documents/Snap Box - Main/README.md), [.env.example](/Users/ucaany/Documents/Snap Box - Main/.env.example).
**Evidence rule:** repository/docs = bukti static; runtime/remote/production tidak dipromosikan dari dokumentasi historis. Secret values tidak dicantumkan.

## Status Legend

| Status            | Arti                                                      |
| :---------------- | :-------------------------------------------------------- |
| **PASS (static)** | Artefak ada; bukan bukti deployment runtime.              |
| **PARTIAL**       | Implementasi sebagian; acceptance/gap masih ada.          |
| **UNKNOWN**       | Bukti runtime/remote/production tidak tersedia.           |
| **HIGH**          | Risiko wajib ditangani.                                   |
| **DEFERRED**      | Ditunda eksplisit; tetap gap bila requirement dibutuhkan. |

## 1. Executive Verdict

Fase 0 **PARTIAL**: implementation substantial, tetapi provisioning provider/acceptance, local/remote Supabase, Firebase claims, external Vercel/Cloudflare/Sentry, CI execution, migrations, dan secrets tidak terbukti. Fase 1 **PARTIAL**: mostly implemented, tetapi public content placeholder, auth/DB/Firebase E2E, Pakasir sandbox, entitlement CI, health/security, migrations/seed runtime, dan usable CEO account belum terbukti.

**Belum production-ready.** Runtime checks tidak dapat rerun karena shell permission policy. Existing docs hanya historical/non-current PASS untuk typecheck/lint/build/tests. Worktree dirty: **7 modified, 18 untracked**; bukan committed release evidence.

**Update runtime 2026-09-25:** migration ordered berhasil diterapkan ke Supabase project `ehoemilzosbzdygqyvzd` (AWS ap-southeast-2) melalui transaction pooler port 6543. Semua 8 migrasi Supabase dan 5 migrasi Drizzle tercatat; 35 tabel public, 6 private buckets, tiga extension, RLS aktif pada 35 tabel, dan seed dua kali menghasilkan jumlah stabil. Dua tenant diuji lewat role `authenticated`: masing-masing hanya membaca booth/tenant sendiri; tanpa tenant claim hasil 0. Bukti ini berlaku untuk project tersebut saat eksekusi, bukan production parity lintas environment atau CEO/provider acceptance.

## 2. Matriks PRD Fase 0

| Task | Requirement                                       | Evidence                                 | Status  | Gap                                                                                                                               | Rekomendasi                                             |
| :--- | :------------------------------------------------ | :--------------------------------------- | :------ | :-------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------ |
| 0.1  | Monorepo, Next/Tauri, packages, strict tooling    | Workspace, `docs/PHASE-0.md`             | PARTIAL | Node README `>=20.11` vs package engine `>=22.12`; test runner disebut unselected meski 15 files/root `node:test`; PASS historis. | Samakan prerequisite; fresh CI; dokumentasikan runner.  |
| 0.2  | Design system/palet PRD                           | UI files, CSS tokens, ADR-002            | PARTIAL | Palet PRD diganti biru; rebrand ditunda; PRD checkbox unchecked.                                                                  | Tetapkan `DESIGN.md`; putuskan rebrand; update PRD/ADR. |
| 0.3  | Font/layout/dark/toggle/toast/motion              | Font/provider/toggle/toast/motion        | PARTIAL | Dark tokens belum ada; toggle belum dipasang; deferred.                                                                           | Selesaikan atau nyatakan non-goal.                      |
| 0.4  | Supabase local/remote/extensions/storage/realtime | config, 7 migrations, scripts            | PARTIAL | Runtime local/remote unverified; cron/jobs/policy sebagian deferred.                                                              | Reset/query acceptance; link remote; capture parity.    |
| 0.5  | Firebase provider/claims/JWT                      | `packages/auth`, ADR-003, guards         | PARTIAL | Provider/claims deployment unverified.                                                                                            | Verify Email/Password, claims, ID, token exchange.      |
| 0.6  | Vercel/Cloudflare/Sentry/health                   | Config/runbooks/instrumentation          | PARTIAL | External unverified; `/api/sentry-example` remains.                                                                               | Staging smoke test; remove/classify example.            |
| 0.7  | CI/CD quality gates                               | Workflow/commands                        | PARTIAL | Actual run unverified; missing `check:firebase-project-id`, `check:entitlement-usage`.                                            | Add required guards; run current SHA.                   |
| 0.8  | Drizzle/RLS/realtime/seed                         | `packages/db/migrations/0000-0004`, seed | PARTIAL | Applied/seed runtime unknown; ENABLE not FORCE; order conflict.                                                                   | Apply §6 order; verify policy/schema/seed twice.        |
| 0.9  | Real secrets/providers                            | `.env.example`, docs                     | PARTIAL | Values/completeness/provisioning unknown.                                                                                         | Secret manager; provider smoke tests.                   |

## 3. Matriks PRD Fase 1

| Task | Requirement                       | Evidence                   | Status  | Gap                                                | Rekomendasi                                     |
| :--- | :-------------------------------- | :------------------------- | :------ | :------------------------------------------------- | :---------------------------------------------- |
| 1.1  | Public website/SEO/OG/JSON-LD     | Routes/components          | PARTIAL | Placeholder; render/SEO runtime unknown.           | Browser/build verify; replace placeholders.     |
| 1.2  | Firebase auth/cookie/middleware   | Login/session/middleware   | PARTIAL | Auth/DB E2E unknown; no usable CEO seed.           | Real CEO login, cookie, role/expiry tests.      |
| 1.3  | CEO dashboard skeleton            | CEO routes/views           | PARTIAL | Authorization/data runtime unknown; dirty changes. | CEO acceptance + negative role tests.           |
| 1.4  | Provisioning/invite/Resend        | Wizard/server contracts    | PARTIAL | Provider delivery/DB E2E unknown.                  | Staging create/invite/suspend evidence.         |
| 1.5  | Plan editor/limits                | Editor/schema              | PARTIAL | Persistence/auth runtime unknown.                  | Edit/reload/audit test.                         |
| 1.6  | Pakasir draft/HMAC                | Adapter/route/config       | PARTIAL | Sandbox/signature/idempotence unknown.             | Valid/invalid/duplicate webhook tests.          |
| 1.7  | Entitlement service               | Entitlement code/schema    | PARTIAL | CI guard absent; usage unproven.                   | Required `check:entitlement-usage`; scan/tests. |
| 1.8  | Immutable audit/high-risk actions | Helper/trigger `0003`      | PARTIAL | Runtime/coverage unknown.                          | Verify actions and mutation rejection.          |
| 1.9  | Broadcast/settings                | Views/`0002`/`00600`       | PARTIAL | Policy acceptance unknown.                         | All/selected visibility/isolation tests.        |
| 1.10 | Global promo/quota                | View/schema/`0004`         | PARTIAL | CRUD/atomic redemption unknown.                    | Case-insensitive/auth/concurrency tests.        |
| 1.11 | Health/security                   | `00500`, routes, telemetry | PARTIAL | Runtime unknown; telemetry docs missing names.     | Provision telemetry; verify hashes.             |
| 1.12 | Auth/tenant migrations/RLS/seed   | SQL/seed/tests             | PARTIAL | Applied unknown; seed UID cannot login; no CEO.    | Ordered apply; seed twice; real CEO; parity.    |

## 4. Migration Inventory

All files **tracked/defined**. Target `ehoemilzosbzdygqyvzd`: Supabase 8/8 dan Drizzle 5/5 **APPLIED (runtime verified 2026-09-25)**. Other remote/production parity: **UNKNOWN**. CI migration-history artifact remains unverified.

### Supabase

| Migration                                           | Purpose                                                    | Dependency                        | Defined | Applied | Verification                      |
| :-------------------------------------------------- | :--------------------------------------------------------- | :-------------------------------- | :------ | :------ | :-------------------------------- |
| `20260101000000_enable_extensions.sql`              | pgcrypto/pg_cron/pg_net                                    | none                              | YES     | APPLIED | extension query in target project |
| `20260101000100_rls_foundation.sql`                 | schema `app`, JWT/tenant helpers                           | 000000                            | YES     | APPLIED | `app.enforce_rls(text)` verified  |
| `20260101000200_storage_buckets.sql`                | Six private buckets/policies                               | 000001                            | YES     | APPLIED | six buckets, all private          |
| `20260101000300_realtime.sql`                       | Broadcast/presence policy                                  | 000001                            | YES     | APPLIED | realtime policies verified        |
| `20260101000400_enforce_rls_text_param.sql`         | Safe `text` helper replacement                             | 000001                            | YES     | APPLIED | `app.enforce_rls(text)` verified  |
| `20260101000500_system_health_security.sql`         | `security_events`, `auth_sessions`, `system_health_checks` | **Drizzle `users`**               | YES     | APPLIED | all three tables verified         |
| `20260101000600_broadcast_tenant_scope.sql`         | Tenant SELECT policy                                       | **Drizzle `broadcasts` + policy** | YES     | APPLIED | tenant policy present             |
| `20260101000700_security_events_partial_unique.sql` | Partial unique index parity                                | `security_events`                 | YES     | APPLIED | partial predicate verified        |

### Drizzle

| Migration                              | Purpose                                     | Dependency            | Defined | Applied | Verification                                            |
| :------------------------------------- | :------------------------------------------ | :-------------------- | :------ | :------ | :------------------------------------------------------ |
| `0000_smiling_hawkeye.sql`             | 31 tables/enums/indexes/FKs                 | Supabase 000000-00400 | YES     | APPLIED | 35 public tables total; users/broadcasts verified       |
| `0001_rls_and_realtime.sql`            | RLS + tenant/parent/platform + booth policy | 0000 + `app`          | YES     | APPLIED | tenant policy and two-tenant runtime isolation verified |
| `0002_grey_mongoose.sql`               | `platform_settings`, CEO policy/defaults    | 0000/0001             | YES     | APPLIED | table and policy verified                               |
| `0003_activity_logs_immutable.sql`     | Immutable trigger/revoke mutation           | 0000/0001             | YES     | APPLIED | trigger verified; UPDATE/DELETE rejected                |
| `0004_promo_code_case_insensitive.sql` | `lower(code)` unique index                  | 0000 `promos`         | YES     | APPLIED | `promos_code_lower_idx` verified                        |

**Reconciled:** `security_events` partial unique index is owned by Supabase `00700` and matches Drizzle schema metadata. `0001`/`0002` helper calls now pass `text`, matching Supabase `app.enforce_rls(text)`. Realtime booth policy remains split intentionally: Supabase defers it; Drizzle `0001` creates it after `booths` exists.

## 5. Correct Migration Execution Order

**HIGH:** README menyatakan semua Supabase lalu semua Drizzle. Invalid: `00500` mereferensikan `public.users`; `00600` mereferensikan `public.broadcasts`/policy Drizzle.

```text
Supabase 000000 -> 00100 -> 00200 -> 00300 -> 00400
Drizzle 0000 -> 0001 -> 0002 -> 0003 -> 0004
Supabase 00500 -> 00600
```

README dan automation memakai `pnpm migrate:ordered --local` atau `pnpm migrate:ordered --db-url <URL>`. Runner mengeksekusi Supabase `000000`-`00400`, Drizzle `0000`-`0004`, lalu Supabase `00500`-`00700`, fail-fast; URL remote dikunci ke project ref `ehoemilzosbzdygqyvzd`. Jangan jalankan direct `supabase db reset` sebagai pengganti urutan ini.

## 6. RLS dan Security Audit

RLS enabled, **not forced**. Direct DB owner dan `service_role` bypass; RLS secondary control. Server authorization/tenant check wajib: `session.tenant_id` sama dengan `resource.tenant_id`, cross-tenant denied (prefer 404). Upgrade path: dedicated non-owner DML runtime role, owner migration-only, lalu `FORCE ROW LEVEL SECURITY` setelah semua path/policy teruji.

```sql
select n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r';
select schemaname,tablename,policyname,cmd,roles from pg_policies order by schemaname,tablename,policyname;
```

## 7. Seed Audit

`packages/db/src/seed.ts`: 3 plans, 3 tenants, owners, active subscriptions, booths; static idempotence tests ada. `seed:*` UIDs placeholder, tidak bisa login; no CEO seed. Secrets, activity logs, PIN hashes, pairing codes, fingerprints, gateway credentials sengaja tidak di-seed.

```bash
pnpm --filter @snapbox/db migrate
pnpm --filter @snapbox/db seed
pnpm --filter @snapbox/db seed
pnpm --filter @snapbox/db test
```

```sql
select tier,count(*) from plans group by tier order by tier;
select count(*) from tenants where notes='Seed Task 1.12 (data contoh)';
select count(*) from users where firebase_uid like 'seed:%';
select tenant_id,plan_tier,count(*) from b2b_subscriptions group by tenant_id,plan_tier having count(*)>1;
```

Buat CEO real melalui Firebase/DB provisioning resmi; jangan gunakan seed placeholder credential.

## 8. Environment Audit

`.env.example` mendeklarasikan sekitar 46 names. Filename `.env` dan `apps/web/.env.local` ada, tetapi values/completeness/provisioning unknown dan tidak diekspos.

| Category           | Names                                                                                                           | Operational requirement                                         |
| :----------------- | :-------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------- |
| Public             | `NEXT_PUBLIC_*`, `VITE_*`                                                                                       | Match environment/project/domain; bundle-visible, bukan secret. |
| DB                 | `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`                                                       | Pooler runtime; direct migration/seed; secret manager.          |
| Firebase           | `FIREBASE_ADMIN_*`, `NEXT_PUBLIC_FIREBASE_*`                                                                    | Provider, service account, claims, ID parity.                   |
| Session/encryption | `SESSION_COOKIE_SECRET`, `ENCRYPTION_MASTER_KEY`, `PAIRING_TOKEN_SECRET`, `LAN_JWT_SECRET`, `DEVICE_JWT_SECRET` | Real 32-byte values, environment-separated, rotated.            |
| Providers          | `PAKASIR_B2B_*`, `RESEND_*`, `SENTRY_*`                                                                         | Accounts, HMAC, verified sender, Sentry CI.                     |
| Telemetry          | `TELEMETRY_HASH_SALT`, `WAF_INGEST_SECRET`, `HEARTBEAT_SECRET`                                                  | Server-only real values; deployment docs omit all three.        |
| Cloudflare         | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, Turnstile keys                                                    | DNS/WAF/rate-limit/bot protection.                              |

Safe name-only check, never print RHS:

```bash
for f in .env apps/web/.env.local; do test -f "$f" && awk -F= '/^[A-Za-z_][A-Za-z0-9_]*=/{print FILENAME ":" $1}' "$f"; done
```

## 9. Runtime Acceptance Checklist

Record timestamp, environment, SHA, command, redacted evidence. Unreachable provider = **UNKNOWN**, not PASS.

| Area            | Check                                                        | Expected evidence                                                                    |
| :-------------- | :----------------------------------------------------------- | :----------------------------------------------------------------------------------- |
| Baseline        | `pnpm typecheck && pnpm lint && pnpm build && pnpm test`     | Fresh current-SHA CI log.                                                            |
| Firebase        | `pnpm check:firebase-project-id`; real CEO/Owner/Staff login | Claims, exchange, cookie, redirects.                                                 |
| Resend          | Task 1.4 invite                                              | Message ID, verified sender, received mail.                                          |
| Pakasir         | Sandbox invoice + valid/invalid/duplicate webhook            | Invoice ID, HMAC, idempotence.                                                       |
| Vercel          | Deploy and `/api/health`                                     | URL, health, SHA.                                                                    |
| Cloudflare      | DNS/WAF/Turnstile/rate limit                                 | Resolution and block/allow evidence.                                                 |
| Sentry          | Controlled web/desktop event                                 | Event ID/release, no sensitive payload.                                              |
| Supabase        | Remote target `ehoemilzosbzdygqyvzd`, inspect                | APPLIED: PostgreSQL 17.6, 8/8 migration versions.                                    |
| Migrations      | `node scripts/migrate-ordered.mjs --db-url ...`              | APPLIED: Supabase 8/8, Drizzle 5/5; 35 tables.                                       |
| Seed            | Remote seed twice + SQL counts                               | PASS: plans 3, tenants 3, seed users 3, subs 3, booths 3; duplicate subscriptions 0. |
| RLS             | Two tenant contexts, cross-tenant read/write                 | PASS: own booth 1, other tenant 0, no-tenant 0; cross-tenant UPDATE 0 rows.          |
| Health/security | Failed login, WAF/rate-limit, heartbeat                      | Hashed identifiers and health records.                                               |

## 10. Prioritized Recommendations

| Priority | Action                                                                                                                                                                                                                |
| :------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0**   | Migration ordering, target-project migrations, seed idempotence, and tenant RLS isolation verified for `ehoemilzosbzdygqyvzd`; production parity elsewhere, CEO/providers, and deployment acceptance remain unproven. |
| **P1**   | CI guards added; verify fresh hosted CI run; provision real CEO; verify providers; migration history artifact; reconcile Node/test docs.                                                                              |
| **P2**   | Decide blue vs SnapBox rebrand; explicit dark deferral; remove/classify `/api/sentry-example`; define non-owner/FORCE-RLS upgrade; update PRD checkboxes after acceptance.                                            |

## 11. Final Summary

| Phase  | Status      | Conclusion                                                                                                                                                                     |
| :----- | :---------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fase 0 | **PARTIAL** | Target Supabase migrations/runtime schema verified; other environments, external provisioning, secrets rotation, and hosted CI execution remain unproven.                      |
| Fase 1 | **PARTIAL** | DB migrations, seed idempotence, and tenant RLS verified on target; placeholders, provider/auth E2E, CEO login, telemetry delivery, and deployment acceptance remain unproven. |

“Berfungsi dan berjalan” belum boleh diklaim: target Supabase migration parity, RLS isolation, dan seed idempotence kini memiliki evidence; real CEO login/redirect, tenant provisioning + Resend, Pakasir webhook, telemetry delivery, Vercel/Cloudflare/Sentry, dan fresh hosted current-SHA CI masih belum. PRD checkboxes tetap unchecked sampai bukti dikaitkan ke release.
