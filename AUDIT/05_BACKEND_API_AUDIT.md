# 05 — Backend / API Audit

**Source:** `.kilo/plans/1790436768946-snapbox-forensic-audit.md` §5 (PHASE 2/3 — Backend, database, realtime, desktop)
**Status of this document:** audit result. No source file, migration, config, or environment was modified.
**Canonical location:** this file is the canonical statement of every `BE-*` finding. `06`, `07`, and `08` are security-, realtime-, and database-specific lenses on the same findings and must not diverge from it.
**Evidence basis:** static code reading only. See `00_EXECUTIVE_SUMMARY.md` §3 (Audit limitations) before trusting any status.

---

## Finding template

| Field                       | Meaning                                                               |
| --------------------------- | --------------------------------------------------------------------- |
| **Finding**                 | Short title and severity                                              |
| **Evidence**                | `file:line` citations. Nothing is asserted from file or folder names. |
| **Actual**                  | What the code does                                                    |
| **Expected**                | What the PRD, an ADR, or the codebase's own stated rule requires      |
| **Impact**                  | Consequence if shipped as-is                                          |
| **Severity**                | P0–P4                                                                 |
| **Affected files**          | Primary source files                                                  |
| **Affected routes**         | Routes a user can reach                                               |
| **Related API**             | Endpoint, server action, or table involved                            |
| **Status**                  | `CONFIRMED (static)` · `UNVERIFIED` · `POSITIVE`                      |
| **Recommended next action** | **Direction only — never code**                                       |

Status vocabulary: `CONFIRMED (static)` (proven by reading source with `file:line`) · `UNVERIFIED` (needs execution, AUDIT-LIM-01/02) · `POSITIVE` (a real strength, recorded so it is not "fixed" away).

**Severity-field integrity.** Four titles carry a severity that differs from the `Severity:` field in the source audit. Both are preserved; the `Severity:` field is authoritative for the roll-up in `00_EXECUTIVE_SUMMARY.md` §4.

| ID     | Title says    | `Severity:` field says                                                               |
| ------ | ------------- | ------------------------------------------------------------------------------------ |
| BE-012 | POSITIVE (P4) | P4 for the handler, **P2 for its one gap** (`SELECT … FOR UPDATE` missing)           |
| BE-014 | P1            | P1                                                                                   |
| BE-029 | P2/P3         | P2 for the FK/tenant-key gaps, P3 for `deleteTemplate` and the `auth_sessions` shape |
| BE-032 | P3            | P3                                                                                   |

---

## API inventory

### 1. Route handlers — 9 files (8 under `/api/**` + 1 nested export route)

| #   | Route                                      | Methods                 | Auth                                                        | Rate limit        | Error envelope            | Status                                                                                   |
| --- | ------------------------------------------ | ----------------------- | ----------------------------------------------------------- | ----------------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | `/api/auth/session`                        | `POST`, `DELETE`, `GET` | none (login) / HMAC cookie (logout, session read)           | yes (IP + email)  | —                         | **IMPLEMENTED**; has `isSameOrigin` (`:61-70,119-121`)                                   |
| 2   | `/api/auth/staff-pin`                      | `POST`, `GET`           | none (PIN)                                                  | yes (IP)          | `{ok:false,code,message}` | **BROKEN** — can only return `PIN_REJECTED` (FE-020); **lacks `isSameOrigin`** (BE-009)  |
| 3   | `/api/booth/pair-session`                  | `POST`, `GET`           | `requireOwnerTenant()`                                      | yes (**IP only**) | `{ok:false,code,message}` | **IMPLEMENTED**; the best-implemented part of a chain that terminates at a wall (BE-003) |
| 4   | `/api/health`                              | `GET`                   | **none**                                                    | no                | `{message}`               | **PARTIAL** — leaks raw DB `error.message` (BE-018)                                      |
| 5   | `/api/internal/telemetry/heartbeat`        | `POST`, `GET`           | shared secret `x-snapbox-heartbeat-secret`, constant-time   | no                | `{ok:false,message}`      | **IMPLEMENTED**; fails closed 503 without `HEARTBEAT_SECRET`                             |
| 6   | `/api/internal/telemetry/waf`              | `POST`, `GET`           | shared secret `x-snapbox-waf-secret`, constant-time         | no                | `{ok:false,message}`      | **IMPLEMENTED**; fails closed 503 without `WAF_INGEST_SECRET`; **at risk from BE-021**   |
| 7   | `/api/sentry-example`                      | `GET`                   | none                                                        | no                | n/a                       | **DEAD** — throws an unhandled `Error` on every GET outside production (BE-032)          |
| 8   | `/api/webhooks/pakasir-b2b`                | `POST`, `GET`           | HMAC-SHA256 over the **raw body before parse** (`:236-240`) | no                | n/a                       | **IMPLEMENTED** — production-grade (BE-012)                                              |
| 9   | `GET /owner-dashboard/transactions/export` | `GET`, `POST`           | session cookie                                              | no                | `{message}`               | **IMPLEMENTED**; hand-rolled ZIP containing one CSV (FE-021f)                            |

`GET` health-style descriptors exist on 7 of the 9; `POST` mutations on 5.

**Not implemented, and referenced elsewhere in the repo (see BE-011, BE-028):** `POST /api/payment/create`, `/api/webhooks/b2c/[provider]`, `POST /api/booth/pair`, `POST /api/booth/heartbeat`, `/api/contact`, `/api/operator/*`, `/api/pairing/*`.

### 2. Server actions — 19 `'use server'` files, 55 exported actions

**CEO — 6 files, 14 actions**

| File                                     | Actions                                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| `ceo-dashboard/broadcast/actions.ts`     | `createBroadcast`                                                                            |
| `ceo-dashboard/plans/actions.ts`         | `updatePlan`                                                                                 |
| `ceo-dashboard/promos/actions.ts`        | `createPromo`, `updatePromo`, `togglePromo`, `deletePromo`                                   |
| `ceo-dashboard/settings/actions.ts`      | `updateSetting`                                                                              |
| `ceo-dashboard/subscriptions/actions.ts` | `createInvoice`, `retryInvoice`                                                              |
| `ceo-dashboard/tenants/actions.ts`       | `createTenant`, `changeTenantStatus`, `resetTenantInvite`, `downgradeTenant`, `deleteTenant` |

**Owner — 13 files, 41 actions**

| File                          | Actions                                                                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `devices/actions.ts`          | `revokeOwnerDevice`                                                                                                                                   |
| `frame-studio/actions.ts`     | `createFrame`, `updateFrame`, `deleteFrame`                                                                                                           |
| `kiosk-theme/actions.ts`      | `saveKioskTheme`, `publishKioskTheme`, `restoreKioskThemeVersion`                                                                                     |
| `machines/actions.ts`         | `createBoothWithPairing`, `updateBooth`, `updateBoothPackagePrice`, `setPinLock`, `revokeBoothDevice`, `revokeDeviceById`, `regeneratePairingSession` |
| `notifications/actions.ts`    | `markOwnerNotificationRead`                                                                                                                           |
| `outlets/actions.ts`          | `createOutlet`, `updateOutlet`, `setOutletActive`                                                                                                     |
| `packages/actions.ts`         | `createPackage`, `updatePackage`, `deletePackage`, `setPackageActive`                                                                                 |
| `payment-settings/actions.ts` | `testPaymentConnection`, `savePaymentConfig`                                                                                                          |
| `promos/actions.ts`           | `createPromo`, `updatePromo`, `togglePromo`, `deletePromo`, `batchGenerate`, `redeemPromo`                                                            |
| `settings/actions.ts`         | `updateOwnerProfile`, `getOwnerSettings` ← a **read** exported from `'use server'` (FE-013)                                                           |
| `staff/actions.ts`            | `createStaff`, `updateStaff`, `setStaffActive`, `resendStaffInvite`                                                                                   |
| `support/actions.ts`          | `submitOwnerSupport`                                                                                                                                  |
| `templates/actions.ts`        | `createTemplate`, `updateTemplate`, `deleteTemplate`, `setTemplateActive`                                                                             |

`ceo-dashboard/tenants/[id]/tenant-detail-actions.tsx` is a **component**, not a `'use server'` module; it reuses the same shared `statusTransitionError` guard as `tenants/actions.ts:296`.

**Zero-caller exports:** `updatePromo` (`promos/actions.ts:50`), `batchGenerate` (`:99`), `redeemPromo` (`:135`) — the only path to 500-code batch generation and the only writer to `promo_redemptions` (FE-013).

### 3. Data-access and integration surface

| Layer       | Reality                                                                                       | Evidence                                      |
| ----------- | --------------------------------------------------------------------------------------------- | --------------------------------------------- |
| DB client   | `postgres(DATABASE_URL)` — direct connection as the **table owner**                           | `packages/db/src/client.ts:30-56`             |
| ORM         | `drizzle-orm@0.45.3`; 35 tables in `schema.ts` (981 lines)                                    | `packages/db/src/schema.ts`                   |
| Supabase JS | storage + realtime only, via anon/service keys                                                | `@supabase/supabase-js`                       |
| Auth        | Firebase `verifyIdToken` (server) → HMAC-signed HttpOnly cookie `snapbox_session` (12 h)      | `packages/auth/**`, `lib/auth/session.ts`     |
| Payment     | configuration + **real** test-connection calls to 4 live gateway hosts; **no execution path** | `payment-provider-test.ts:11-25`              |
| Webhooks    | 1 implemented (`pakasir-b2b`), 4 provider verifiers still to write                            | BE-011, BE-012                                |
| Email       | Resend via `fetch`, escaping + header flattening, 10 s timeout                                | `lib/email/resend.ts`                         |
| Realtime    | hand-rolled Phoenix WebSocket client; Supabase Broadcast for publish                          | `use-booth-realtime.ts`, `realtime-server.ts` |
| Desktop     | Tauri v2, **518 LOC** (274 TS + 154 Rust), **1** command, never called                        | `apps/desktop/**`                             |

---

## Summary index

| ID     | Severity                                       | Title                                                                                        | Status                                 |
| ------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------- |
| BE-001 | **P0**                                         | RLS is enabled but not `FORCE`d, and the app connects as the table owner ⇒ RLS never fires   | CONFIRMED (static)                     |
| BE-002 | **P0**                                         | Desktop/kiosk is a 518-line shell; 0 of 17 kiosk states                                      | CONFIRMED (static)                     |
| BE-003 | P1                                             | `POST /api/booth/pair` does not exist ⇒ pairing is a dead end                                | CONFIRMED (static)                     |
| BE-004 | **P4 POSITIVE**                                | Application-layer tenant isolation is genuinely strong                                       | CONFIRMED (static)                     |
| BE-005 | P1                                             | Granular RBAC is entirely dead code (75 permissions, 0 consumers)                            | CONFIRMED (static)                     |
| BE-006 | P1                                             | Two CEO pages read real PII with middleware-only authorization                               | CONFIRMED (static)                     |
| BE-007 | P1                                             | Session revocation is recorded but never enforced                                            | CONFIRMED (static)                     |
| BE-008 | P2                                             | No CSP and no HSTS                                                                           | CONFIRMED (static)                     |
| BE-009 | P2                                             | `/api/auth/staff-pin` lacks the same-origin check its sibling has                            | CONFIRMED (static)                     |
| BE-010 | P2                                             | Rate limiting is in-memory, per-instance, and self-defeating                                 | CONFIRMED (static)                     |
| BE-011 | P1                                             | B2C payment **execution** does not exist; only configuration does                            | CONFIRMED (static)                     |
| BE-012 | **P4 POSITIVE** (P2 for its one gap)           | The Pakasir B2B webhook is production-grade                                                  | CONFIRMED (static)                     |
| BE-013 | P1                                             | Subscription cron, expiry, and grace-period enforcement are absent                           | CONFIRMED (static)                     |
| BE-014 | P1                                             | Entitlement is well-guarded but quota counts are structurally zero                           | CONFIRMED (static)                     |
| BE-015 | P2                                             | Migration integrity: two `0005_*` files, journal drift, missing snapshots                    | CONFIRMED (static)                     |
| BE-016 | P2                                             | Realtime: 1 of 25 catalog events is emitted, 0 are consumed                                  | CONFIRMED (static)                     |
| BE-017 | P2                                             | Secrets hygiene                                                                              | CONFIRMED (static)                     |
| BE-018 | P2                                             | `/api/health` leaks raw DB error strings                                                     | CONFIRMED (static)                     |
| BE-019 | P3                                             | Documentation/reality drift                                                                  | CONFIRMED (static)                     |
| BE-020 | **P0**                                         | `0005_owner_promo_code_scope.sql` is orphaned and will never be applied                      | CONFIRMED (static)                     |
| BE-021 | P1                                             | 3 tables are in `schema.ts` but in no Drizzle snapshot ⇒ next `generate` emits forbidden DDL | CONFIRMED (static)                     |
| BE-022 | P2                                             | `app.is_ceo()` fails open when `public.users` is unreadable                                  | CONFIRMED (static)                     |
| BE-023 | P2                                             | `promo_redemptions.transactionId` is a client-supplied UUID with no FK                       | CONFIRMED (static)                     |
| BE-024 | P2                                             | Tenants can never redeem a CEO-global promo                                                  | CONFIRMED (static)                     |
| BE-025 | P2                                             | Webhook has no timestamp / freshness window                                                  | CONFIRMED (static)                     |
| BE-026 | P2                                             | `WHATSAPP_SALES_NUMBER` silently gates webhook signature verification                        | CONFIRMED (static)                     |
| BE-027 | P2                                             | Index gaps that will bite at volume                                                          | CONFIRMED (static)                     |
| BE-028 | P2                                             | Bot protection is declared but never invoked                                                 | CONFIRMED (static) / partly UNVERIFIED |
| BE-029 | P2 / P3                                        | Foreign-key and deletion-integrity gaps                                                      | CONFIRMED (static)                     |
| BE-030 | **P4 POSITIVE**                                | All 55 server actions gate correctly                                                         | CONFIRMED (static)                     |
| BE-031 | **P4 POSITIVE** (P3 for 4 unenforced features) | Entitlement is the best-engineered subsystem                                                 | CONFIRMED (static)                     |
| BE-032 | P3                                             | `auth_sessions` revocation + `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` dead                          | CONFIRMED (static) / partly UNVERIFIED |
| BE-033 | P3                                             | Migration history claims contradict each other                                               | CONFIRMED (static) / partly UNVERIFIED |
| BE-034 | P3                                             | Server-only enforcement is convention, not guard                                             | CONFIRMED (static)                     |

---

## BE-001 — P0 — **RLS is enabled but not `FORCE`d, and the app connects as the table owner ⇒ RLS never fires**

**Finding.** P0. The documented second layer of tenant defence does not execute on the connection the application uses.

**Evidence.**

- `packages/db/src/client.ts:30-56` connects directly with `postgres(DATABASE_URL)` — the Supabase direct/superuser connection, not the anon key.
- Per `docs/AUDIT-FASE-0-1-…:§6` and the migration set, RLS is `ENABLE`d without `FORCE ROW LEVEL SECURITY`, so the owning role bypasses every policy.
- All 40+ policies are well-formed; the defect is the role, not the policy text (see `08_DATABASE_TENANT_AUDIT.md`).

**Actual.** The app connects as the table owner; RLS policies do not fire for app queries.

**Expected.** PRD §5.5: "Postgres RLS policy aktif sebagai lapisan kedua."

**Impact.** 100% of tenant isolation rests on application-level `WHERE tenant_id = session.tenant_id`. The application layer **is** good (BE-004) — but the documented defence-in-depth is nominal, and a single missed predicate is a cross-tenant leak with no DB backstop.

**Severity.** P0.

**Affected files.** `packages/db/src/client.ts:30-56`, `packages/db/migrations/0001_rls_and_realtime.sql`, `packages/db/migrations/0005_phase_2_owner_rls.sql`, `supabase/migrations/*_rls_foundation.sql`.

**Affected routes.** All authenticated routes; every query in the app.

**Related API.** All 9 route handlers and all 55 server actions; all 35 tables.

**Status.** CONFIRMED (static). Live RLS behaviour is UNVERIFIED (AUDIT-LIM-02).

**Recommended next action (direction only).** Decide the runtime DB role (dedicated non-owner DML role), then `FORCE RLS` **after** all paths are tested — the exact upgrade path the prior audit already named.

---

## BE-002 — P0 — Desktop/kiosk is a **518-line shell; 0 of 17 kiosk states**

**Finding.** P0. The kiosk client is a placeholder, and it is the surface that generates the product's revenue.

**Evidence.**

- `apps/desktop/src/App.tsx` = **25 lines**, renders one `<h1>`, one `<p>`, and a badge literally reading `Hardware engine belum terpasang`.
- Rust: **1** `#[tauri::command]` (`get_app_info`, returns compile-time constants, **never called**). No `AppState`, no secure storage, no single-instance lock, no camera/printer/storage adapter, no SQLite state persistence, no `update`/signing.
- **0/18** PRD §F kiosk features, **0/17** §R states, **0/9** §10.9 hardware traits, **0/15** Fase 5 customer-flow tasks, **0/8** §7.5 payment steps. Overall desktop completeness **≈6%** (Fase-0 scaffolding only).
- **Security positives that are real:** CSP `script-src 'self'` with **no** `unsafe-inline`/`unsafe-eval` (`tauri.conf.json:26`); capability allowlist is `core:default` + `opener:default` scoped to the single `kiosk` window; no shell/process command exposed (PRD §10.10 ban respected).
- Minor: `opener:default` is granted with **zero** consumers and is the _broad_ variant (open-url **and** open-path **and** reveal-in-dir). CSP is missing `object-src 'none'; base-uri 'none'; form-action 'self'`. `connect-src` hardcodes `https://api.snapbox.id` (no staging variant). `macos` is not a bundle target.

**Actual.** A 25-line screen and one never-called command stand in for the entire kiosk client.

**Expected.** PRD §F (features), §R (states), §10.9 (hardware traits), Fase 5 (customer flow).

**Impact.** Nothing in the PRD's customer-facing flow can run. The 0/18, 0/17, 0/15 and 0/8 counts mean "kiosk" is a PRD promise with no implementation behind it.

**Severity.** P0.

**Affected files.** `apps/desktop/src/App.tsx`, `apps/desktop/src-tauri/src/lib.rs`, `tauri.conf.json`, `apps/desktop/dist/**` (untracked build output).

**Affected routes.** None (desktop app, not a web route). PRD §F flow routes: none exist.

**Related API.** None wired; `get_app_info` only. Would require `POST /api/booth/pair`, `/api/booth/heartbeat` (both missing — BE-003, BE-016).

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Treat the desktop client as Fase 5 scope and say so explicitly, or staff it. Narrow `opener:default` to the single capability actually used, and add the three missing CSP directives.

---

## BE-003 — P1 — `POST /api/booth/pair` **does not exist** ⇒ pairing is a dead end

**Finding.** P1. A token is minted correctly and then nothing ever redeems it.

**Evidence.**

- `pair-session/route.ts:9-10` says so explicitly.
- Nothing redeems a `pairing_tokens` row: `used`/`usedAt` (`:319-320`), `expiresAt` (`:318`) and `attemptCount` (`:321`) have **zero readers/writers outside the insert**. There is **no** atomic `UPDATE … WHERE used = false AND expires_at > now()` anywhere.
- The `devices` table is **never inserted into** anywhere in the repo, so `deviceQuota` (`machine-server.ts:120-123`) always counts 0 ⇒ **unlimited pairing on every plan** (`pair-session/route.ts:62-68`).
- **Positives:** 18 random bytes (144-bit) base64url, SHA-256 hash-only persistence (`pairing-session.ts:54,60`), 10-min TTL, prior tokens invalidated on re-issue, tenant+booth scoped, 404 (not 403) on cross-tenant.

**Actual.** The token-issuing half is production-quality; the redemption half does not exist.

**Expected.** An atomic redemption endpoint that consumes the token, counts the attempt, and mints a session.

**Impact.** The kiosk cannot be paired. `deviceQuota` is a permanent no-op on every plan, so device limits in the PRD and in `PlanFeatures` are unenforceable.

**Severity.** P1.

**Affected files.** `app/api/booth/pair-session/route.ts`, `owner-dashboard/machines/pairing-session.ts`, `machine-server.ts:120-123`, `packages/db/src/schema.ts` (`pairing_tokens`, `devices`).

**Affected routes.** `/owner-dashboard/machines` (token mint), and the kiosk flow (no route).

**Related API.** `POST /api/booth/pair-session` (exists) · `POST /api/booth/pair` (**missing**). Tables: `pairing_tokens`, `devices`, `booths`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Implement the redemption endpoint with a single atomic conditional update, wire `expires_at`/`attempt_count` into the predicate, and insert into `devices` on first pair so `deviceQuota` becomes enforceable.

---

## BE-004 — P4 POSITIVE — Application-layer tenant isolation is genuinely strong

**Finding.** P4 POSITIVE. Recorded so a repair pass does not weaken it.

**Evidence.**

- Every mutation re-derives `tenantId` from the session and puts it in the SQL predicate. No client-supplied `tenant_id` anywhere (grep for `parsed.data.tenantId` → all session-derived).
- `requireOwnerTenant()` (`outlet-server.ts:7-36`) re-verifies the HMAC cookie **and** re-reads the `users` row **and** re-checks `tenants.status = 'ACTIVE' AND deleted_at IS NULL` on every page and action.
- Cross-tenant reads return **404, not 403** (PRD §5.5 satisfied at `pair-session/route.ts:88-89`, `tenant-server.ts:100-117`).

**Actual.** Tenant scoping is enforced in the application layer, consistently, on every traced path.

**Expected.** Exactly this.

**Impact.** None. This is what makes BE-001 survivable today.

**Severity.** P4 (observation).

**Affected files.** `lib/owner-dashboard/outlet-server.ts:7-36`, all 13 Owner `actions.ts`, all Owner `*-server.ts` loaders.

**Affected routes.** All `/owner-dashboard/**`.

**Related API.** All 41 Owner server actions.

**Status.** POSITIVE — CONFIRMED (static).

**Recommended next action (direction only).** Preserve it. The one gap to close is `loadOwnerKioskTheme`, which has no `tenantId` predicate (FE-013).

---

## BE-005 — P1 — Granular RBAC is **entirely dead code**

**Finding.** P1. A 75-permission authorization model exists and nothing reads it.

**Evidence.**

- `packages/shared/src/auth.ts` defines 75 `PERMISSIONS`, `OWNER_PERMISSIONS`, `STAFF_PERMISSIONS`, `ROLE_PERMISSIONS`, `hasPermission()`, `canAccessTenant()`, `ROLE_HOME_ROUTE`. Repo-wide grep: **matches only inside `auth.ts` itself — zero consumers.**
- Actual enforcement is role-string equality: `requireCeo()` → `row.role !== 'CEO'`; `requireOwnerTenant()` → `owner.role !== 'OWNER'`.
- `STAFF_PERMISSIONS` (deliberately no destructive entries) is never consulted. Staff safety today is **incidental** — `/staff-dashboard` does not exist, so Staff hits `/unauthorized`. **The day `/staff-dashboard` is added, or any action forgets `requireOwnerTenant()`, a Staff account gets OWNER-class destructive access with no warning.**
- No instance was found of a client-gated destructive control whose server action omits the check — every one traced has a server-side counterpart, often the _same_ shared function (`statusTransitionError` at `tenant-detail-actions.tsx:157` and `tenants/actions.ts:296`).

**Actual.** The permission model is unused; enforcement is a two-value role comparison.

**Expected.** Either the documented granular model is enforced, or the documentation stops claiming it.

**Impact.** A latent privilege-escalation path that depends only on a folder not existing. Nothing warns; nothing fails.

**Severity.** P1.

**Affected files.** `packages/shared/src/auth.ts`, `lib/ceo-dashboard/tenant-server.ts`, `lib/owner-dashboard/outlet-server.ts`, all `actions.ts`, `lib/auth/route-policy.ts`.

**Affected routes.** All `/owner-dashboard/**` and `/ceo-dashboard/**`; the future `/staff-dashboard/**`.

**Related API.** `requireCeo()`, `requireOwnerTenant()`, `hasPermission()` (uncalled), `canAccessTenant()` (uncalled).

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Wire `hasPermission` into mutations, **or** delete the module and stop claiming granular RBAC in docs. Do not add `/staff-dashboard` before this is decided.

---

## BE-006 — P1 — Two CEO pages read real PII with **middleware-only authorization**

**Finding.** P1. The only two CEO pages that read customer PII do not re-check the role server-side.

**Evidence.**

- `tenants/[id]/page.tsx:58-67` and `tenants/new/page.tsx:29` never call `requireCeo()`, and neither do their loaders (`tenant-server.ts:100,132,166,186,197,215`). Every sibling page does.
- This violates the repo's own stated rule at `middleware.ts:17-21`.
- Exposed: `ownerEmail`, `ownerPhone`, `address`, `notes`, plan tiers, subscription amounts, booth names, audit-actor emails — gated only by a cookie snapshot valid for `SESSION_MAX_AGE_SECONDS = 43_200` (12 h) after role revocation.
- `ceo-dashboard/layout.tsx:12-14` explicitly delegates authz to middleware and requires each DB-touching route to repeat it; these two do not.

**Actual.** Two PII-bearing CEO pages rely entirely on middleware, which runs once per request from a cookie and never re-reads the role.

**Expected.** The repo's own rule: every DB-touching CEO route repeats `requireCeo()`.

**Impact.** Up to 12 hours of continued PII access after a CEO role is revoked, on the two most sensitive surfaces in the product.

**Severity.** P1.

**Affected files.** `ceo-dashboard/tenants/[id]/page.tsx:58-67`, `ceo-dashboard/tenants/new/page.tsx:29`, `lib/ceo-dashboard/tenant-server.ts:100,132,166,186,197,215`, `middleware.ts:17-21`, `ceo-dashboard/layout.tsx:12-14`.

**Affected routes.** `/ceo-dashboard/tenants/[id]`, `/ceo-dashboard/tenants/new`.

**Related API.** `getTenantDetail`, `listTenants`, `listPlanOptions`, `createTenant`. Tables: `tenants`, `users`, `b2b_subscriptions`, `booths`, `activity_logs`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Add `requireCeo()` to the `tenant-server.ts` loaders (preferred — it closes the class, not the two instances).

---

## BE-007 — P1 — Session **revocation is recorded but never enforced**

**Finding.** P1. The product can revoke a session; the verification path cannot see the revocation.

**Evidence.**

- `revokeAuthSession` / `revokeAuthSessionsForUser` write `auth_sessions.revokedAt` (`health-security-server.ts:287-319`).
- `verifySession` (`session.ts:193-236`) checks **only** HMAC → zod → `exp`. A logged-out or force-revoked cookie stays valid up to 12 h.
- `changeTenantStatus` and `deleteTenant` disable the Firebase account and the `users` row but **never call `revokeAuthSessionsForUser`**, despite `health-security-server.ts:302-306` saying that function is provided for that path.
- Result: a suspended tenant's Owner keeps read-only page access for 12 h (mutations are still blocked by `requireOwnerTenant`'s `disabled` check).
- The CEO Security page renders a "Dicabut" label for a state the enforcement path ignores.

**Actual.** Revocation is written to a table nothing reads on the request path.

**Expected.** A revoked session stops authenticating.

**Impact.** Logout, force-revoke, and account suspension are all advisory. Up to 12 h of continued authenticated access; up to 12 h of continued PII read on the two BE-006 pages.

**Severity.** P1.

**Affected files.** `lib/auth/session.ts:193-236`, `lib/ceo-dashboard/health-security-server.ts:287-319`, `ceo-dashboard/tenants/actions.ts` (`changeTenantStatus`, `deleteTenant`), `packages/db/src/schema.ts:922` (`auth_sessions`).

**Affected routes.** All authenticated routes; `/ceo-dashboard/security` (displays the unenforced state).

**Related API.** `verifySession`, `revokeAuthSession`, `revokeAuthSessionsForUser`, `changeTenantStatus`, `deleteTenant`. Table: `auth_sessions`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Enforce `revoked_at` in the Node-side verifiers (`requireCeo`, `requireOwnerTenant`), and call `revokeAuthSessionsForUser` from suspend/ban/delete.

---

## BE-008 — P2 — No CSP and no HSTS

**Finding.** P2. Two of the standard web security headers are absent from the Next.js config.

**Evidence.**

- `next.config.ts:28-43` sets `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`.
- Missing: `Strict-Transport-Security` and any `Content-Security-Policy` (PRD §8.2 mandates XSS sanitisation).
- `session.ts:276` sets `secure: NODE_ENV === 'production'`, meaning **preview/staging serves the session cookie over plain HTTP**.

**Actual.** Four of six headers are set; the two that matter most for a cookie-authenticated multi-tenant app are not.

**Expected.** PRD §8.2.

**Impact.** No HSTS, so a downgrade to HTTP is possible; no CSP, so an injected script has no second barrier. Staging/preview expose the session cookie in cleartext.

**Severity.** P2.

**Affected files.** `apps/web/next.config.ts:28-43`, `lib/auth/session.ts:276`.

**Affected routes.** All.

**Related API.** All.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Add a CSP and HSTS to `next.config.ts`; set `secure: true` outside local dev so preview/staging do not serve the cookie over HTTP.

---

## BE-009 — P2 — `/api/auth/staff-pin` lacks the same-origin check its sibling has

**Finding.** P2. Two auth endpoints with the same threat model are protected differently.

**Evidence.**

- `api/auth/session/route.ts:61-70,119-121` implements `isSameOrigin` with an explicit login-CSRF threat model.
- `api/auth/staff-pin/route.ts:62` goes straight to the rate limiter.

**Actual.** CSRF protection exists on one auth route and not the other.

**Expected.** Consistent origin enforcement across `/api/auth/*`.

**Impact.** Latent today (FE-020: no PIN can be set), but live the moment that is fixed.

**Severity.** P2.

**Affected files.** `app/api/auth/staff-pin/route.ts:62`, `app/api/auth/session/route.ts:61-70,119-121`.

**Affected routes.** `/api/auth/staff-pin` (drives the `/login` staff tab).

**Related API.** `POST /api/auth/staff-pin`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Add the missing `isSameOrigin` check to `/api/auth/staff-pin`, and apply it to every future `/api/auth/*` route.

---

## BE-010 — P2 — Rate limiting is **in-memory, per-instance, and self-defeating**

**Finding.** P2. The rate limiter cannot survive horizontal scaling and can be turned off by an attacker.

**Evidence.**

- `lib/auth/rate-limit.ts:34` `new Map<string, Bucket>()`; `:8-16` self-documents the per-instance multiplication on Vercel.
- `:51` `if (buckets.size >= MAX_BUCKETS) buckets.clear()` — one attacker generating 5 000 keys **wipes every victim's counters**.
- `clientIp` falls back to the literal `'unknown'` (`:80`), collapsing all headerless traffic into one global window.
- Limits: 10/min per IP, 5/min per email.
- `pair-session` is keyed on **IP only** — PRD §8.2 requires `/api/booth/*` at 60/min **per device fingerprint**; no per-device dimension exists.
- Cloudflare WAF/rate-limit/Turnstile exist in the repo as **JSON drafts only** (`infra/cloudflare/*.json` + `workers/rate-limit-counter.md`). `check-infra-drafts.mjs` proves the drafts are _complete_, not that they are _deployed_.

**Actual.** A per-process counter with a global reset and a shared fallback key.

**Expected.** A shared store, and per-device limiting on the booth surface.

**Impact.** On Vercel the effective limit is N× the intended one; a single attacker can clear every counter; all headerless traffic shares one window; the PRD's per-device booth limit does not exist.

**Severity.** P2.

**Affected files.** `lib/auth/rate-limit.ts:8-16,34,51,80`, `app/api/booth/pair-session/route.ts`, `infra/cloudflare/*.json`, `scripts/check-infra-drafts.mjs`.

**Affected routes.** `/api/auth/session`, `/api/auth/staff-pin`, `/api/booth/pair-session`.

**Related API.** All three limited endpoints.

**Status.** CONFIRMED (static) for the code; **UNVERIFIED** for any live Cloudflare zone (AUDIT-LIM-02).

**Recommended next action (direction only).** Replace `buckets.clear()` with LRU expiry and move limiter state to a shared store; add the per-device fingerprint dimension for `/api/booth/*`; confirm whether the Cloudflare drafts are actually deployed.

---

## BE-011 — P1 — B2C payment **execution does not exist**; only configuration does

**Finding.** P1. The product can store a payment credential and test it, and cannot take a payment.

**Evidence.**

- **Implemented:** `payment-provider-test.ts:11-25` performs **real** HTTPS test-connection calls to all four providers' live sandbox/production hosts; `payment-crypto.ts` AES-256-GCM; `b2c_payment_configs` upsert with advisory lock; masked credentials never returned.
- **Missing:** the `PaymentProvider` interface (PRD §10.8), any `createPayment`/`verifyPayment`/`refund` implementation, `POST /api/payment/create`, `/api/webhooks/b2c/[provider]`, and the `PAYMENT_PENDING/PAID/FAILED` → `START_CAPTURE` chain. `payment_method` enum values (`QRIS_MIDTRANS` etc.) exist in the schema with **no writer**.

**Actual.** Configuration and connectivity testing exist; money movement does not.

**Expected.** PRD §10.8 plus the capture chain.

**Impact.** ADR-002's "server as source of truth" for payment is **untested** — there is no payment path for a client to forge _yet_. That silver lining evaporates the moment an adapter lands without the webhook.

**Severity.** P1.

**Affected files.** `lib/owner-dashboard/payment-provider-test.ts:11-25`, `lib/owner-dashboard/payment-crypto.ts`, `lib/owner-dashboard/payment-server.ts`, `packages/db/src/schema.ts` (`b2c_payment_configs`, `transactions.payment_method`).

**Affected routes.** `/owner-dashboard/payment-settings` (config only).

**Related API.** `POST /api/payment/create` (**missing**) · `/api/webhooks/b2c/[provider]` (**missing**) · `testPaymentConnection`, `savePaymentConfig` (exist). Tables: `b2c_payment_configs`, `transactions`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Implement the provider interface and the create endpoint **only together with** the webhook. Shipping an adapter without the webhook re-opens the ADR-002 hole.

---

## BE-012 — P4 POSITIVE (P2 for its one gap) — The Pakasir B2B webhook is production-grade

**Finding.** P4 POSITIVE for the handler; **P2 for one missing lock.** Recorded in full because it is the reference implementation the B2C webhooks should copy.

**Evidence — correct, do not "fix" these:**

- Signature verified on the **raw body before parse** (`:236-240`); `timingSafeEqual` with a length guard (`pakasir-b2b.ts:228+`); 64 KB body cap (`:232`).
- Idempotency via unique `(provider, provider_event_id)`, with the marker **released on any non-2xx** so a retry is reprocessed instead of silently dropped (`:291-326`) — the exact failure mode most webhook handlers get wrong.
- **Server-authoritative amount check** before activation (`:146-149`); monotonic `paidAt`/`validUntil` guard against out-of-order events (`:162-169`); `validUntil` sanity window (`:103-114`).
- Dead-letter to `webhook_failures` on every failure class (`:80-92`); distinct status per failure class; `23505` unwrapped through the `cause` chain (`:66-77`).

**Gap.** Read-then-write with **no `SELECT … FOR UPDATE`** on the subscription row, so two _different_ concurrent events for one invoice can race. PRD §6.F requires row locking for the analogous voucher redemption.

**Actual.** The strongest webhook in the repo, missing one lock.

**Expected.** Row-level locking on the state transition, as PRD §6.F requires elsewhere.

**Impact.** Low-probability race between two distinct events for the same invoice; the monotonic date guard limits the damage.

**Severity.** P4 for the design; **P2** for the missing lock.

**Affected files.** `app/api/webhooks/pakasir-b2b/route.ts` (332 LOC), `lib/ceo-dashboard/pakasir-b2b.ts`.

**Affected routes.** `POST /api/webhooks/pakasir-b2b` (external).

**Related API.** `POST /api/webhooks/pakasir-b2b`, `verifyPakasirSignature`, `applyEvent`. Tables: `b2b_subscriptions`, `webhook_events`, `webhook_failures`.

**Status.** POSITIVE — CONFIRMED (static). Delivery behaviour in production is UNVERIFIED (AUDIT-LIM-02).

**Recommended next action (direction only).** Add `FOR UPDATE` to the subscription write path. Extract the idempotency-marker + dead-letter pattern into a shared helper so the B2C webhooks cannot get it wrong.

---

## BE-013 — P1 — Subscription state machine: cron, expiry, and grace-period enforcement are **absent**

**Finding.** P1. The status enum models the full lifecycle; nothing drives it past `ACTIVE`.

**Evidence.**

- `SUBSCRIPTION_STATUSES` supports `PENDING/ACTIVE/EXPIRING/GRACE_PERIOD/EXPIRED/SUSPENDED` (`domain.ts:18-24`) and `isSubscriptionUsable` gates access — but **no cron job exists** (no `pg_cron` schedule in any migration, no worker).
- `EXPIRING` is never entered by anything. H-7/H-3/H-1 notifications (PRD §6.J) do not exist. Kiosk maintenance mode on expiry does not exist (there is no kiosk).
- `authorization.ts:86-88` handles "no dates set" as `UNKNOWN` rather than `BLOCKED` — a deliberate, documented decision, but it means a tenant with a subscription row lacking `valid_until` passes the login gate.

**Actual.** A five-state machine with one reachable transition path (`PENDING → ACTIVE → EXPIRED`, the last by date comparison only).

**Expected.** Hourly expiry evaluation, `EXPIRING`/`GRACE_PERIOD` transitions, H-7/H-3/H-1 notifications, kiosk maintenance mode.

**Impact.** A tenant is never warned, never gracefully expired, and never put into maintenance. Renewal is a manual CEO action.

**Severity.** P1.

**Affected files.** `packages/shared/src/domain.ts:18-24`, `lib/auth/authorization.ts:86-88`, `lib/owner-dashboard/owner-layout-data.ts:66-71`, `packages/db/migrations/*` (no `pg_cron` schedule), `app/api/cron/**` (absent).

**Affected routes.** All `/owner-dashboard/**` (gating), `/ceo-dashboard/subscriptions`.

**Related API.** `isSubscriptionUsable`, `getOwnerLayoutData`. Tables: `b2b_subscriptions`, `notifications`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Implement the hourly expiry job, the two missing transitions, the three notification classes, and kiosk maintenance mode. Separately, decide whether "no dates set" should be `UNKNOWN` or `BLOCKED`.

---

## BE-014 — P1 — Entitlement is well-guarded but **quota counts are structurally zero**

**Finding.** P1. The guard is real; one of the three things it counts can never be non-zero.

**Evidence.**

- `check-entitlement-usage.mjs` is a real CI guard banning `if (plan === 'GROWTH')` outside 14 allowlisted files. Design is correct.
- But `machineQuota` counts `devices` (never inserted — BE-003) and `staffQuota`/`outletQuota` count rows that only grow via the Owner UI.
- Effective enforcement today: `deviceQuota` = **no-op**, the other two = correct.
- `payment-settings` **computes** `canConfigure`/`canUseBackup` and then discards them (`payment-settings/page.tsx:10`), so a tenant without the entitlement only learns by clicking Save and reading `FORBIDDEN`.

**Actual.** Three quotas; one can never trip; the entitlement result is computed and thrown away on one screen.

**Expected.** Quotas that count real rows, and entitlement results that gate the UI before the click.

**Impact.** A tenant can pair unlimited devices on every plan, including the plan with a `deviceQuota`.

**Severity.** P1.

**Affected files.** `scripts/check-entitlement-usage.mjs`, `lib/owner-dashboard/entitlement-*.ts`, `machine-server.ts:120-123`, `owner-dashboard/payment-settings/page.tsx:10`, `pair-session/route.ts:62-68`.

**Affected routes.** `/owner-dashboard/machines`, `/owner-dashboard/payment-settings`, every quota-gated mutation.

**Related API.** `checkEntitlement`, `effectiveDeviceQuota`, `createBoothWithPairing`, `savePaymentConfig`. Tables: `devices`, `users`, `outlets`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Fix BE-003 (the insert) so `deviceQuota` becomes enforceable, then surface the computed entitlement result in the UI instead of discarding it.

---

## BE-015 — P2 — Migration integrity: **two `0005_*` files, journal drift, missing snapshots**

**Finding.** P2. The migration history cannot be reasoned about from the repository.

**Evidence.**

- `packages/db/migrations/` contains `0005_owner_promo_code_scope.sql` **and** `0005_phase_2_owner_rls.sql` (untracked). `meta/` holds snapshots for 0000, 0002, 0004 only — **0001, 0003 and both `0005`s are missing**.
- `_journal.json` is modified in the working tree and does not give `0005_owner_promo_code_scope.sql` its own entry (see BE-020, which is the P0 form of this).
- The prior audit also documents a **required cross-sequence order** (Supabase 0–00400 → Drizzle 0000–0004 → Supabase 00500–00700) that plain `supabase db reset` gets wrong, because `00500` needs Drizzle's `users` and `00600` needs Drizzle's `broadcasts`. `scripts/migrate-ordered.mjs` implements it.

**Actual.** Two sequences, colliding prefixes, incomplete snapshots, an unordered apply path, and a script that only one person knows to run.

**Expected.** A fresh install and an upgrade both derivable from the repo.

**Impact.** A new environment can be created with a schema that does not match the code, and nothing detects it.

**Severity.** P2.

**Affected files.** `packages/db/migrations/**`, `packages/db/migrations/meta/_journal.json`, `supabase/migrations/**`, `scripts/migrate-ordered.mjs`.

**Affected routes.** None directly; affects every deployment.

**Related API.** `pnpm --filter @snapbox/db generate|migrate`.

**Status.** CONFIRMED (static). What is actually applied to any environment is UNVERIFIED (AUDIT-LIM-02, AUDIT-LIM-04).

**Recommended next action (direction only).** Reconcile the journal and snapshot set, rename the colliding prefixes, and document the supported fresh-install and upgrade paths.

---

## BE-016 — P2 — Realtime: **1 of 25 catalog events is ever emitted, 0 are ever consumed**

**Finding.** P2. The event catalog, the transport, and the RLS are all built; the publisher and the subscriber are not.

**Evidence.**

- Emitted: `THEME_UPDATED` only (`kiosk-theme/actions.ts:121,136` → `tenant:{id}`), and it has no subscriber.
- `BROADCAST_CREATED` is published by `broadcast-server.ts:110-149` but as `'broadcast.created'` (lowercase-dotted, **not in `REALTIME_EVENTS`**) with a **snake_case** payload violating PRD §10.6, and **bypassing `realtimeEventSchema.parse()`** entirely (self-documented as debt at `:106-108`).
- `DEVICE_REVOKED` is **never published** on revoke (`machines/actions.ts:298-375` does DB + audit only) — PRD §6.K requires push revocation; a revoked kiosk would keep working forever.
- **No code writes any heartbeat** (`booths.last_heartbeat_at`, `devices.last_heartbeat_at` have zero writers) ⇒ every booth displays `OFFLINE`/`UNPAIRED`, and `DEVICE_ONLINE/OFFLINE`/`BOOTH_ONLINE/OFFLINE` can never fire.
- The catalog itself is `packages/shared/src/events.ts:26-58` — **25** names (the planning pass recorded 22; the three operational events `LOW_PAPER`, `MAINTENANCE_MODE_ON/OFF` close the gap). Of the 25, exactly **one** is ever published and **none** is ever consumed.
- `EventDeduplicator` (`events.ts:95-132`) is **dead code**; PRD §10.6 "handler wajib idempotent" and ADR-011 `version` checking are unenforced.
- **POSITIVE:** the `realtime.messages` RLS is the strongest control in the realtime layer — extension-scoped policies, correct `broadcast:all` CEO gate, presence restricted to own `tenant:`/`user:`, **no browser broadcast-INSERT policy** (correctly omitted; publish is `service_role`-only), and the deferred `booth:{id}` policy is correctly created in `packages/db/migrations/0001_rls_and_realtime.sql:144-166` with the `split_part` UUID round-trip. No `REPLICA IDENTITY` and no publication entries are **correct and deliberate** because the transport is Broadcast/Presence, not Postgres Changes.

**Actual.** One event published to nobody, one event published outside the schema, one required event never published, and no heartbeat writer.

**Expected.** PRD §10.6: every catalog event emitted on its state change, dedup + `version` checked on the handler.

**Impact.** Realtime is decorative. The one visible symptom is a green "Realtime aktif" indicator that is untrue (FE-022); the invisible symptoms are that device revocation never reaches a kiosk and every booth reads offline.

**Severity.** P2.

**Affected files.** `packages/shared/src/events.ts:15,26-58,95-132`, `lib/ceo-dashboard/broadcast-server.ts:106-149`, `kiosk-theme/actions.ts:121,136`, `machines/actions.ts:298-375`, `packages/db/migrations/0001_rls_and_realtime.sql:144-166`, `supabase/migrations/20260101000300_realtime.sql`.

**Affected routes.** `/owner-dashboard/machines`, `/owner-dashboard/machines/[boothId]`, `/ceo-dashboard/broadcast`.

**Related API.** `publishRealtimeEvent`, Phoenix channels `tenant:{id}`, `broadcast:all`, `booth:{id}`, `user:{uid}`. Table: `realtime.messages`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Publish the catalog events, wire `EventDeduplicator` and `version` checks, normalise `broadcast.created` through `publishRealtimeEvent`, implement heartbeats, and publish `DEVICE_REVOKED`. See `07_REALTIME_AUDIT.md` for the end-to-end view.

---

## BE-017 — P2 — Secrets hygiene

**Finding.** P2. The secret handling design is sound; three hygiene gaps remain.

**Evidence — correct, do not "fix" these:**

- `packages/shared/src/env.ts` structurally separates `publicEnvSchema` / `serverEnvSchema` / `secretEnvSchema` (5 base64-32-byte keys, each `.refine()`-validated) / `thirdPartyEnvSchema`; env error messages emit `path` + `message` only, never values.
- `packages/auth/src/index.ts:11` deliberately does **not** re-export `./admin` or `./client`, so `firebase-admin` cannot enter a browser bundle. All 149 `NEXT_PUBLIC_*` occurrences were reviewed; none is a secret.
- AES-256-GCM for B2C credentials; `payment_settings` key allowlist; scrypt PIN with per-hash parameters and `timingSafeEqual`.

**Gaps.**

- `.env` (2 759 B) sits in the working tree — untracked but present.
- `apps/desktop/dist/**` appears in the tree; a 2.3 MB `.js.map` is an information-disclosure and bloat concern if tracked.
- `broadcast-server.ts` reads `SUPABASE_SERVICE_ROLE_KEY` and sends it as `Authorization`/`apikey` **without `import 'server-only'`**, unlike `realtime-server.ts:8`.

**Actual.** Correct secret architecture; an untracked `.env`, untracked build output, and one unguarded service-role read.

**Expected.** No secret material in the tree; server-only modules structurally unable to reach a client bundle.

**Impact.** Low today; the `.map` and the missing guard become disclosure vectors the moment either is committed or the module is imported by a client component.

**Severity.** P2.

**Affected files.** `packages/shared/src/env.ts`, `packages/auth/src/index.ts:11`, `lib/ceo-dashboard/broadcast-server.ts`, `apps/desktop/dist/**`, `.gitignore`.

**Affected routes.** `/ceo-dashboard/broadcast` and anything that could import `broadcast-server.ts`.

**Related API.** `parseEnv`, `broadcast-server.ts` publish helper.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Confirm `.env` and `apps/desktop/dist/**` are ignored; add `import 'server-only'` to the service-role readers (see BE-034).

---

## BE-018 — P2 — `/api/health` leaks raw DB error strings

**Finding.** P2. An unauthenticated endpoint returns driver error text, contradicting its own header comment.

**Evidence.** `api/health/route.ts:32-38` returns `error.message` from the driver on an **unauthenticated** `no-store` endpoint, directly contradicting its own header comment.

**Actual.** Driver messages (which can include host, schema, and relation names) are returned to any caller.

**Expected.** A health endpoint that reports status, not internals.

**Impact.** Information disclosure to anonymous callers, and a free error-oracle for probing the database.

**Severity.** P2.

**Affected files.** `app/api/health/route.ts:32-38`.

**Affected routes.** `/api/health` (unauthenticated).

**Related API.** `GET /api/health`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Return a status code and a stable error identifier; keep the detail in server logs.

---

## BE-019 — P3 — Documentation/reality drift (all confirmed)

**Finding.** P3. Five documented statements are contradicted by the code. Two of them will actively mislead the next operator.

**Evidence.**

| Claim                                                                                                                        | Reality                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/auth/session.ts:17` instructs authors to re-check with "`getSession()` + query"                                         | **No `getSession` exists** in the repo (1 match — that comment). Real helpers: `requireCeo`, `requireOwnerTenant`                                                        |
| `ceo-dashboard/content.ts:121` says `/ceo-dashboard/settings` includes "kunci API master"                                    | Deliberately **not** rendered (`settings-view.tsx:97-101`). Copy is wrong; code is right                                                                                 |
| `docs/ADR-004:155-165` "Owner/Staff dashboard … deliberately out of scope"; `safeHomeForRole` returns `null` for OWNER/STAFF | The Owner dashboard **is** built; `route-policy.ts:81` now returns `/owner-dashboard` for OWNER. ADR-004 is stale                                                        |
| PRD §11 Fase 2 carries an inline **"Status audit (2026-09-26)"** block                                                       | The PRD now mixes **requirement** with **implementation status**; the working-tree PRD is modified with a `.rej` sibling. Requirement and status must be separated again |
| PRD §10.12 schema is used as if normative                                                                                    | `packages/db/src/schema.ts` is the real source; they have already diverged (see FE-021d/e)                                                                               |

**Actual.** Comments, nav copy, one ADR, and the PRD itself describe a system that no longer matches the code.

**Expected.** Documentation that either describes the current system or is explicitly marked superseded.

**Impact.** An engineer following `session.ts:17` will look for a function that does not exist. An engineer following ADR-004 will assume the Owner dashboard is someone else's problem.

**Severity.** P3.

**Affected files.** `lib/auth/session.ts:17`, `ceo-dashboard/content.ts:121`, `components/ceo-dashboard/settings-view.tsx:97-101`, `docs/ADR-004:155-165`, `lib/auth/route-policy.ts:81`, the PRD, `docs/ADR-002` (PC-13).

**Affected routes.** None directly; affects every reader.

**Related API.** `getSession()` (nonexistent), `requireCeo`, `requireOwnerTenant`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Fix the comment and the nav copy, supersede ADR-002 and ADR-004, and move the Fase 2 status block out of the PRD into a generated status report.

---

## BE-020 — P0 — `0005_owner_promo_code_scope.sql` is **orphaned and will never be applied**

**Finding.** P0. A migration exists on disk that the migrator will never execute.

**Evidence.**

- `packages/db/migrations/0005_owner_promo_code_scope.sql` exists, but `meta/_journal.json:40-46` contains **only** `0005_phase_2_owner_rls`. Drizzle's migrator is journal-driven ⇒ this file is dead code.
- Its only novel artifact is `CREATE INDEX IF NOT EXISTS promo_redemptions_tenant_customer_idx ON public.promo_redemptions (tenant_id, promo_id, customer_email)` (`:12-13`). Lines 2-10 are no-ops against `0004` (it drops `promos_code_lower_idx`, which `0004:51` already dropped, then re-creates the same two indexes that `0004:53-54` creates).

**Actual.** One index the redemption path depends on does not exist in any database.

**Expected.** Every file in `migrations/` has a journal entry and is applied in order.

**Impact.** The redemption path `promos/actions.ts:165-169` runs `count(*) where promo_id=? and customer_email=?` per redemption against a table that grows with every customer transaction — a sequential scan, forever. Plus silent divergence between claimed and deployed schema. `migrate-ordered.mjs` will not notice.

**Severity.** P0 — one journal entry fixes it, and a `migrate --dry-run` in CI would have caught it.

**Affected files.** `packages/db/migrations/0005_owner_promo_code_scope.sql`, `packages/db/migrations/meta/_journal.json:40-46`, `promos/actions.ts:165-169`.

**Affected routes.** `/owner-dashboard/promos` (the only future caller: `redeemPromo`, currently zero-callers).

**Related API.** `redeemPromo`. Table: `promo_redemptions`.

**Status.** CONFIRMED (static). Whether the index exists in any live database is UNVERIFIED (AUDIT-LIM-02).

**Recommended next action (direction only).** Add the journal entry (or drop the file), and assert journal/file parity in CI.

---

## BE-021 — P1 — Three tables are in `schema.ts` but in **no Drizzle snapshot** ⇒ the next `generate` emits forbidden DDL

**Finding.** P1. Schema and snapshots have diverged; the next generation step will emit DDL that another migration explicitly forbids.

**Evidence.**

- `security_events`, `auth_sessions`, `system_health_checks` are declared at `packages/db/src/schema.ts:897,922,940`, but `meta/` holds only `0000`, `0002`, `0004` snapshots and only `platform_settings` matches. `0004_snapshot.json` predates these three.
- `supabase/…00500:10-13` forbids exactly this: _"tidak boleh ada migration Drizzle yang membuat tabel ini lagi: dua DDL divergen dengan `IF NOT EXISTS` akan membuat yang dijalankan kedua menjadi no-op senyap, sehingga kolom DB bisa tidak cocok dengan query runtime."_

**Actual.** Three tables exist in the ORM schema and in a Supabase migration, and in no Drizzle snapshot.

**Expected.** Schema, snapshots, and applied migrations describe the same database.

**Impact.** The next `pnpm --filter @snapbox/db generate` emits `CREATE TABLE` for all three; `00500:26,65,91` then no-ops via `IF NOT EXISTS`, leaving possible column drift. `recordWafEvent` / `recordHealthHeartbeat` / `recordAuthSession` start throwing on column mismatch, and WAF ingest (`api/internal/telemetry/waf/route.ts:70-73`) returns 500 — losing WAF visibility exactly when it is needed.

**Severity.** P1.

**Affected files.** `packages/db/src/schema.ts:897,922,940`, `packages/db/migrations/meta/0004_snapshot.json`, `supabase/migrations/*00500*`, `app/api/internal/telemetry/waf/route.ts:70-73`, `app/api/internal/telemetry/heartbeat/route.ts`.

**Affected routes.** `/api/internal/telemetry/waf`, `/api/internal/telemetry/heartbeat`, `/ceo-dashboard/system-health`, `/ceo-dashboard/security`.

**Related API.** `recordWafEvent`, `recordHealthHeartbeat`, `recordAuthSession`, `revokeAuthSession`, `revokeAuthSessionsForUser`. Tables: `security_events`, `auth_sessions`, `system_health_checks`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Restore snapshot parity **before** anyone runs `drizzle-kit generate` — or exclude those three tables from the Drizzle schema, since `00500` owns their DDL.

---

## BE-022 — P2 — `app.is_ceo()` **fails open** when `public.users` is unreadable

**Finding.** P2. One defensive branch in a security function returns the permissive answer.

**Evidence.**

- `supabase/…00100:166-168`: `if to_regclass('public.users') is null then return true; end if;`
- The claim check at `:152-164` is otherwise sound — layer 2 requires a real `users` row with `firebase_uid = claims->>'sub' AND role='CEO' AND NOT disabled AND deleted_at IS NULL`, so claim forgery alone is insufficient. **That is a genuinely good two-layer design.**
- If `users` is ever missing/renamed/misconfigured in `search_path`, **any** token carrying `app_role='CEO'` (or the `app.role` GUC) becomes CEO: tenant provisioning, plan pricing, global settings, global promos, broadcasts.
- The authors already found and fixed an analogous NULL-fail-open at `:146-151`; this branch survived.

**Actual.** A fail-open branch inside a fail-closed function.

**Expected.** Unreadable ⇒ deny.

**Impact.** Narrow trigger, catastrophic outcome: full platform control for any token with a CEO claim.

**Severity.** P2.

**Affected files.** `supabase/migrations/20260101000100_rls_foundation.sql:146-168`.

**Affected routes.** All `/ceo-dashboard/**` data paths; every RLS policy that calls `app.is_ceo()`.

**Related API.** `app.is_ceo()`. Tables: `tenants`, `users`, `platform_settings`, `promos`, `broadcasts`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Return `false` when the table cannot be read.

---

## BE-023 — P2 — `promo_redemptions.transactionId` is a **client-supplied UUID with no FK** ⇒ cross-tenant attachment

**Finding.** P2. A client-provided identifier is stored as a foreign reference with nothing validating it.

**Evidence.**

- `promos/actions.ts:176-182` inserts `promoRedemptions` with `transactionId: p.data.transactionId ?? null`.
- `schema.ts:526` declares `tenantId NOT NULL` with **no** `.references()`, and `transactionId` has **no FK**.
- `0005_phase_2_owner_rls.sql:107` cross-checks the transaction's tenant — but the app connects as the table owner (BE-001), so that policy never runs.

**Actual.** A redemption row can point at any transaction id in the database.

**Expected.** Either a composite FK, or a server-derived transaction id.

**Impact.** A tenant can attach a redemption record to **any** transaction id, including another tenant's. Not exploitable for money today (the redeem path has zero callers), but it is a live storage-layer hole that will survive the moment the kiosk ships.

**Severity.** P2. Category: `POTENTIAL IDOR` / `TENANT SCOPING RISK`.

**Affected files.** `promos/actions.ts:176-182`, `packages/db/src/schema.ts:526`, `packages/db/migrations/0005_phase_2_owner_rls.sql:107`.

**Affected routes.** `/owner-dashboard/promos` (when `redeemPromo` gains a caller).

**Related API.** `redeemPromo` (zero callers today). Tables: `promo_redemptions`, `transactions`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Stop accepting a client-supplied `transactionId`, or add a composite FK. Note that the RLS cross-check is not a substitute while BE-001 stands.

---

## BE-024 — P2 — Tenants can **never redeem a CEO-global promo**

**Finding.** P2. A delivered feature is unreachable because the application query is narrower than the policy that permits it.

**Evidence.** `promos/actions.ts:146` filters `where tenant_id = ${a.tenantId} and lower(code) = lower(...) and is_active = true`, so `tenant_id IS NULL` (global) promos are unreachable. The seed creates `is_global` semantics, and `0005:118-122` RLS correctly makes global promos visible to non-CEO — but the **application** query is narrower than the policy.

**Actual.** Global vouchers exist in the data model and in policy, and cannot be found by the redemption path.

**Expected.** `tenant_id = me OR tenant_id IS NULL`, matching the RLS.

**Impact.** PRD §6.G global vouchers are a delivered requirement that currently cannot be used.

**Severity.** P2.

**Affected files.** `promos/actions.ts:146`, `packages/db/migrations/0005_phase_2_owner_rls.sql:118-122`, `packages/db/src/schema.ts` (`promos.tenantId` nullable).

**Affected routes.** `/owner-dashboard/promos`; the future kiosk redemption flow.

**Related API.** `redeemPromo`, `batchGenerate`. Table: `promos`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Widen the lookup to match the RLS policy.

---

## BE-025 — P2 — Webhook has **no timestamp / freshness window**

**Finding.** P2. Signature verification is correct; replay protection is not.

**Evidence.**

- `verifyPakasirSignature` is correct: HMAC-SHA256 over the raw body, `timingSafeEqual` with a length + hex-charset pre-check, fail-closed when the secret is unset.
- There is **no** `X-Pakasir-Timestamp`, no nonce, and no freshness window; `pakasirWebhookPayloadSchema` accepts `paidAt`/`validUntil` as optional with no maximum age.
- Byte-identical replays **are** caught by the `webhook_events` unique index → `200 {duplicate:true}` with no state change. But the _releasable_-marker path (`:291-303`) re-runs `applyEvent`, and a captured body replayed under a **fresh `eventId`** is accepted as new.
- Bounded by `MAX_VALIDITY_WINDOW_MS = 400 days` and the amount-must-match check, so it is **not** a free-money path — but an attacker who captured one valid `PAID` body can repeatedly re-assert `validUntil` up to 400 days out for an invoice they legitimately paid once.

**Actual.** Authentic-but-old messages are accepted as new events.

**Expected.** A signed timestamp with a bounded acceptance window (industry norm: ±5 minutes).

**Impact.** Entitlement-integrity gap, not a payment-theft path: `validUntil` can be pushed out repeatedly for an already-paid invoice.

**Severity.** P2.

**Affected files.** `lib/ceo-dashboard/pakasir-b2b.ts` (`verifyPakasirSignature`, `pakasirWebhookPayloadSchema`), `app/api/webhooks/pakasir-b2b/route.ts:291-303,103-114`.

**Affected routes.** `POST /api/webhooks/pakasir-b2b`.

**Related API.** `verifyPakasirSignature`, `applyEvent`. Tables: `webhook_events`, `b2b_subscriptions`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Require and verify a signed timestamp with a ±5 min window. Also measure the body cap in bytes (`content-length` or a stream), not `rawBody.length` (UTF-16 code units).

---

## BE-026 — P2 — `WHATSAPP_SALES_NUMBER` silently **gates webhook signature verification**

**Finding.** P2. An unrelated marketing variable can disable payment verification.

**Evidence.** `thirdPartyEnvSchema` requires `WHATSAPP_SALES_NUMBER` non-emptily (`packages/shared/src/env.ts:111`), and `pakasir-b2b.ts:87` validates the **whole** schema before reading `webhookSecret`. If that unrelated var is unset, `readPakasirConfig` throws → `verifyPakasirSignature` catches → returns `false` → **every webhook 401s**.

**Actual.** A phone number sits in the payment-integrity critical path.

**Expected.** The webhook secret is read from its own schema, and an unrelated env var cannot change the verification outcome.

**Impact.** A single missing env var silently rejects every payment webhook. Fails closed, so no security hole — but a total outage with a misleading 401.

**Severity.** P2.

**Affected files.** `packages/shared/src/env.ts:111`, `lib/ceo-dashboard/pakasir-b2b.ts:87`, `.env.example`.

**Affected routes.** `POST /api/webhooks/pakasir-b2b`.

**Related API.** `verifyPakasirSignature`, `readPakasirConfig`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Split the schema, or read the secret from its own schema so unrelated variables cannot gate verification.

---

## BE-027 — P2 — Index gaps that will bite at volume

**Finding.** P2. No security impact; latency degrades as data grows.

**Evidence.**

- **Zero indexes at all** (no second `pgTable` argument): `frame_versions`, `templates`, `packages`, `kiosk_themes`, `kiosk_theme_versions`, `broadcasts`, `webhook_failures`.
- `templates` and `packages` are `NOT NULL`-scoped tenant tables rendered on **every** dashboard load via `eq(x.tenantId, tenantId)` — a full scan each, and the surprise of the set.
- **`tenant_id` not indexed:** `pairing_tokens`, `promo_redemptions`, `sessions`, `download_tokens`, `device_logs`, `paper_logs`, `booth_frames`.
- `webhook_failures` has no index on `provider`, `resolved`, or `created_at`, so the documented retention purge is sequential. `broadcasts.target_tenant_ids` is unindexed jsonb scanned per row by `jsonb_exists` (`supabase/…00600:33`).

**Actual.** Seven tables with no indexes; seven more without a `tenant_id` index.

**Expected.** An index on the tenant key of every tenant-scoped table, and at least one index on every table that is read or purged on a schedule.

**Impact.** `templates` and `packages` are scanned on every Owner dashboard load; the retention purge is sequential; the redemption count is sequential (compounded by BE-020).

**Severity.** P2.

**Affected files.** `packages/db/src/schema.ts` (the 14 tables named), `supabase/migrations/*00600*:33`.

**Affected routes.** All `/owner-dashboard/**` (dashboard load), `/ceo-dashboard/system-health` (purge).

**Related API.** `listTemplates`, `listPackages`, `recordHealthHeartbeat`, `redeemPromo`.

**Status.** CONFIRMED (static). Actual query latency is UNVERIFIED (AUDIT-LIM-01) — no performance claim is made here.

**Recommended next action (direction only).** Add `tenant_id` indexes on the 7 uncovered tables, then a first index set for the 7 zero-index tables, `templates` and `packages` first.

---

## BE-028 — P2 — Bot protection is **declared but never invoked**

**Finding.** P2. The env vars and the infra drafts exist; nothing calls them.

**Evidence.**

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` (`env.ts:37,110`) + `infra/cloudflare/turnstile-widget.json` exist; **0** occurrences of `turnstile` in `apps/web/src`. No endpoint — including `/api/auth/*` — has a bot challenge. This compounds BE-010.
- Cloudflare rules also reference **five endpoints that do not exist**: `/api/payment/create` (`rate-limit-rules.json:62`), `/api/contact` (`:75`), `/api/operator/*` (`:88`), `/api/pairing/*` (`:103`), and the `/api/booth/*` rule is blocked by `$requiresWorker: true` (`:48`) with no Worker in the repo.
- `infra/cloudflare/README.md:145-151` gives a _verification_ procedure that curls `/api/contact` and expects 429 — it will 404.
- `check:infra-drafts` validates against the PRD allowlist, not the codebase, so CI will not catch the drift.

**Actual.** Bot protection is configured on paper and absent at runtime; the ruleset that would enforce it targets five imaginary endpoints.

**Expected.** Either a challenge on the auth surface, or declarations removed so the env inventory reflects reality.

**Impact.** The only bot defence is the self-defeating in-memory limiter (BE-010). The documented verification procedure cannot succeed, so nobody can prove the ruleset works.

**Severity.** P2.

**Affected files.** `packages/shared/src/env.ts:37,110`, `infra/cloudflare/turnstile-widget.json`, `infra/cloudflare/rate-limit-rules.json:48,62,75,88,103`, `infra/cloudflare/README.md:145-151`, `scripts/check-infra-drafts.mjs`.

**Affected routes.** `/api/auth/*`, `/api/booth/*` (targeted but unenforced).

**Related API.** None implemented.

**Status.** CONFIRMED (static) for the code; **UNVERIFIED** for any live Cloudflare zone (AUDIT-LIM-02).

**Recommended next action (direction only).** Fix the ruleset before deploying it (5 of 8 rules target non-existent endpoints and the verification procedure cannot pass), then wire Turnstile into at least `/api/auth/*` — or delete the declarations.

---

## BE-029 — P2/P3 — Foreign-key and deletion-integrity gaps

**Finding.** P2 for the FK/tenant-key gaps, P3 for the two shape issues. Tenant deletion leaves orphans.

**Evidence.**

- **`tenant_id` declared but with no FK to `tenants`:** `users` (`:92`), `promo_redemptions` (`:526`), `sessions` (`:812`), `download_tokens` (`:860`), `activity_logs` (`:636`), `device_logs` (`:755`).
- **Other missing FKs:** `sessions.booth_id`, `sessions.device_id`; `device_logs.booth_id`; `promo_redemptions.transaction_id`; `pairing_tokens.created_by_user_id`; `activity_logs.booth_id/device_id`.
- **Impact:** `ON DELETE CASCADE FROM tenants` (declared on 15 other tables) does **not** clean these, so deleting a tenant orphans `activity_logs` (5-year retention), `sessions`, `download_tokens`, `promo_redemptions`.
- `deleteTemplate` (`templates/actions.ts:62-71`) is a **hard `DELETE`** while `deletePackage` and both `deletePromo` variants soft-delete via `isActive`, and `templates.isActive` exists (`schema.ts:418`).
- `auth_sessions` has **no `tenant_id`** (`schema.ts:922`) — documented as deliberate (`supabase/…00500:119-123`), but it means "active sessions for tenant X" is a two-hop join and there is no bulk tenant-level session kill.
- `device_calibrations` (`:330-345`) is keyed only on `(deviceFingerprint, cameraId)` with RLS revoked from every role (`0001:121`, `0005:173`); isolation rests entirely on the global uniqueness of `booths.device_fingerprint` — a real but **undocumented** invariant.

**Actual.** Six tenant keys with no referential integrity; inconsistent delete semantics across three sibling features.

**Expected.** Every `tenant_id` references `tenants`; delete semantics consistent per feature; invariants documented where they are load-bearing.

**Impact.** Tenant deletion silently orphans four tables, one of which has a 5-year retention commitment. A revoked or deleted device can keep operating if nothing else checks.

**Severity.** P2 for the FK/tenant-key gaps; P3 for `deleteTemplate` and the `auth_sessions` shape.

**Affected files.** `packages/db/src/schema.ts:92,330-345,418,526,636,755,812,860,922`, `templates/actions.ts:62-71`, `packages/db/migrations/0001_rls_and_realtime.sql:121`, `0005_phase_2_owner_rls.sql:173`, `supabase/migrations/*00500*:119-123`.

**Affected routes.** `/ceo-dashboard/tenants/[id]` (delete tenant), `/owner-dashboard/templates`, `/owner-dashboard/devices`.

**Related API.** `deleteTenant`, `deleteTemplate`, `deletePackage`, `deletePromo`. Tables: `tenants`, `users`, `sessions`, `activity_logs`, `device_logs`, `download_tokens`, `promo_redemptions`, `auth_sessions`, `device_calibrations`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Add the missing FKs so cascade actually cleans up; align `deleteTemplate` with the soft-delete convention; document the `booths.device_fingerprint` uniqueness invariant.

---

## BE-030 — P4 POSITIVE — All 55 server actions gate correctly

**Finding.** P4 POSITIVE. Recorded so a repair pass does not weaken it.

**Evidence.** Every one of the 55 exports across 20 `actions.ts` files calls `requireCeo()` or `requireOwnerTenant()` — a **fresh DB read** of the `users`/`tenants` row, not a cookie snapshot. All use zod. 20 use transactions. **No action trusts a client-supplied `tenantId`.** Cross-tenant reads return 404 rather than 403.

**Actual.** Authorization at the mutation boundary is uniform and correct.

**Expected.** Exactly this.

**Impact.** None. This is the strongest property in the codebase and is what makes BE-001 survivable.

**Severity.** P4 (observation).

**Affected files.** All 19 `'use server'` modules; `lib/ceo-dashboard/tenant-server.ts`; `lib/owner-dashboard/outlet-server.ts`.

**Affected routes.** All `/owner-dashboard/**` and `/ceo-dashboard/**`.

**Related API.** All 55 server actions; `requireCeo`, `requireOwnerTenant`.

**Status.** POSITIVE — CONFIRMED (static).

**Recommended next action (direction only).** Preserve it. Two known exceptions to fix, neither of which is an action: `getOwnerSettings` is a read exported from `'use server'` (FE-013), and the two CEO loaders in BE-006.

---

## BE-031 — P4 POSITIVE — Entitlement is the best-engineered subsystem

**Finding.** P4 POSITIVE for the design; **P3** for four declared-but-unchecked features. Recorded so a repair pass does not weaken it.

**Evidence — correct, do not "fix" these:**

- Two-layer design with an **inverted dependency direction** (`plan-features-shape.ts:5-12`) so editor changes cannot silently invalidate old tenant data.
- Fail-closed at **every** step of `entitlement-contract.ts:190-233` (unknown feature → tenant blocked → subscription unusable → plan missing → invalid data → quota).
- `effectiveDeviceQuota` (`:172-181`) correctly special-cases `UNLIMITED (-1)` before addition — the exact off-by-one that usually produces `1` for unlimited plans.
- `USABLE_SUBSCRIPTION_STATUSES` is a single list shared with `authorization.ts:24-26` (no drift).
- A real CI static guard (`check-entitlement-usage.mjs:64-68`) **fails the build** on any `plan === 'GROWTH'`-style capability check outside a 15-file allowlist whose every entry carries a written justification.
- Server-side at every mutation site (`machines:51`, `pair-session:62`, `staff:51-55`, `outlets:25-30`, `frame-studio:115`, `promos:25,142`, `payment-server:61,91,98`).

**Gaps.**

- `templates`/`packages` have no quota at all and no `templateLimit`/`packageLimit` in `PlanFeatures`.
- `kioskCustomEnabled`, `kioskMultiplePanelStyle`, `storageMb`, `retentionDays` are declared and seeded but have **no `checkEntitlement` call site**.
- `checkEntitlement` maps any DB throw to `allowed:false / LOOKUP_FAILED` (`:134-143`), so a DB outage is indistinguishable from a plan denial.

**Actual.** A fail-closed, CI-guarded entitlement engine with four features declared but never checked and one error mode that hides outages.

**Expected.** Every declared feature has a call site; infrastructure failure is distinguishable from a denial.

**Impact.** Four paid capabilities are sold and unenforced; an outage presents to the tenant as "your plan does not include this".

**Severity.** P4 for the design; **P3** for the four unenforced features.

**Affected files.** `lib/owner-dashboard/entitlement-contract.ts:134-143,172-181,190-233`, `plan-features-shape.ts:5-12`, `scripts/check-entitlement-usage.mjs:64-68`, and the 7 mutation sites listed.

**Affected routes.** Every quota-gated `/owner-dashboard/**` route.

**Related API.** `checkEntitlement`, `effectiveDeviceQuota`, `USABLE_SUBSCRIPTION_STATUSES`. Tables: `platform_settings`, `b2b_subscriptions`.

**Status.** POSITIVE — CONFIRMED (static).

**Recommended next action (direction only).** Add call sites for the four declared features (or remove them from `PlanFeatures`), and distinguish a lookup failure from a plan denial in the user-facing message.

---

## BE-032 — P3 — `auth_sessions` revocation + `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` dead

**Finding.** P3. One dead env var, one unenforced revocation, and two unverifiable development assumptions.

**Evidence.**

- `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` is declared (`env.ts:38`, `.env.example`, `check-env-example.mjs:29`) and referenced by **zero** application code.
- `eslint.ignoreDuringBuilds: true` (`next.config.ts:16-20`) is justified as "lint runs as a separate CI task" — correct only if that task is mandatory, which is **UNVERIFIED**.
- `.env` is missing all 22 `NEXT_PUBLIC_*` names, so `publicEnvSchema` cannot currently validate and `realtime-server.ts:18,30` / `broadcast-server.ts:118` cannot resolve a Supabase URL. Development-only state; **UNVERIFIED** for production.
- `api/sentry-example` (`route.ts:23-28`) throws an unhandled `Error` on every GET outside production — correctly gated, whitelisted from WAF with a comment saying the exemption must go with the route, but a standing tripwire for error-budget alerts.
- The revocation half of this finding is BE-007.

**Actual.** An unused publishable key, a dev environment that cannot validate its own env schema, and a deliberately-throwing route.

**Expected.** Every declared env var is consumed; a dev environment can start the app; no route throws by design outside production.

**Impact.** Low. The tripwire route will consume error budget and, if the WAF exemption outlives it, silently allowlist a throwing endpoint.

**Severity.** P3.

**Affected files.** `packages/shared/src/env.ts:38`, `.env.example`, `scripts/check-env-example.mjs:29`, `apps/web/next.config.ts:16-20`, `app/api/sentry-example/route.ts:23-28`, `lib/realtime/realtime-server.ts:18,30`, `lib/ceo-dashboard/broadcast-server.ts:118`.

**Affected routes.** `/api/sentry-example`; `/ceo-dashboard/broadcast` and realtime publish (env-dependent).

**Related API.** `GET /api/sentry-example`.

**Status.** CONFIRMED (static) for the dead key and the tripwire; **UNVERIFIED** for production env completeness (AUDIT-LIM-02).

**Recommended next action (direction only).** Remove or use `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`; delete `api/sentry-example` together with its WAF exemption; verify production has the full `NEXT_PUBLIC_*` set before any deploy.

---

## BE-033 — P3 — Migration history claims **contradict each other**

**Finding.** P3. Two migration headers assert incompatible deployment states.

**Evidence.**

- `supabase/…00100:7-15`: _"File ini BELUM pernah di-apply ke environment bersama mana pun"_ (no linked remote, no project ref in `config.toml`).
- `supabase/…00400:5-6`: _"sudah ter-push ke `origin/main` … dan kini BEKU."_
- Both cannot be true. Deployment state is **UNVERIFIED** and the comments will mislead the next operator. `supabase/.branches/_current_branch` and `.temp/start-secrets/…/env/docker.env` exist, which favours `00400`.
- `scripts/migrate-ordered.mjs` itself is well-built: a genuine remote allowlist (`:38-46` refuses any URL not targeting the hardcoded project), a `mkdtemp` workspace, a three-phase interleave, `rm -rf` in `finally`. But it asserts an **exact** file count (`:66-67` `files.length !== 8 || first.length !== 5 || last.length !== 3 → throw`), so a 9th Supabase migration breaks it with a bare throw; the project ref is duplicated in the usage string (`:11`); and a bare `supabase db push` on a fresh environment applies only the Supabase files, leaving every application table absent while RLS policies reference them.

**Actual.** Contradictory provenance comments plus a correct-but-brittle ordering script.

**Expected.** One accurate statement of what has been applied where, and an ordering script that fails loudly with guidance.

**Impact.** The next operator cannot tell which migrations are live. The exact-count assertion turns a routine migration into a bare crash.

**Severity.** P3.

**Affected files.** `supabase/migrations/20260101000100_rls_foundation.sql:7-15`, `supabase/migrations/*00400*:5-6`, `scripts/migrate-ordered.mjs:11,38-46,66-67`, `supabase/config.toml`.

**Affected routes.** None directly; affects every deployment.

**Related API.** `scripts/migrate-ordered.mjs`, `supabase db push`.

**Status.** CONFIRMED (static) for the contradiction; **UNVERIFIED** for actual deployment state (AUDIT-LIM-02, AUDIT-LIM-04).

**Recommended next action (direction only).** Reconcile the comments against the real remote state, replace the exact-count assertion with a phase-aware check that reports what changed, and document that a bare `supabase db push` is not a supported install path.

---

## BE-034 — P3 — Server-only enforcement is convention, not guard

**Finding.** P3. The rule that keeps server secrets out of the browser is documented but not enforced for the database layer.

**Evidence.** `import 'server-only'` appears on 2 of ~15 server modules (`frame-storage.ts:1`, `transaction-server.ts:1`). `client.ts`, `outlet-server.ts`, `entitlement-service.ts`, `pakasir-b2b.ts`, `email/resend.ts`, `payment-server.ts`, `broadcast-server.ts` rely on naming convention plus the absence of a `NEXT_PUBLIC_` prefix. A `'use client'` component importing `@snapbox/db` would not be stopped by a build error.

**Actual.** Two modules opt in; the rest rely on convention.

**Expected.** A structural guarantee, or a CI guard that fails when a client-reachable module imports a server module.

**Impact.** The failure mode is a build-time leak of `DATABASE_URL`, `firebase-admin`, or the service-role key into a browser bundle. `packages/auth` solved this properly (BE-017) — `@snapbox/db` did not.

**Severity.** P3.

**Affected files.** `packages/db/src/client.ts`, `lib/owner-dashboard/outlet-server.ts`, `lib/owner-dashboard/entitlement-service.ts`, `lib/ceo-dashboard/pakasir-b2b.ts`, `lib/email/resend.ts`, `lib/owner-dashboard/payment-server.ts`, `lib/ceo-dashboard/broadcast-server.ts`.

**Affected routes.** Any that could be reached by a client import.

**Related API.** `@snapbox/db`, `parseEnv` (secret schemas).

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Add `import 'server-only'` to the ~13 modules that lack it, starting with `broadcast-server.ts` and `packages/db/src/client.ts`, and add a CI guard for client-reachable imports of server modules.

---

## Cross-references

- Security lens on BE-005…BE-010, BE-017, BE-018, BE-020…BE-028, BE-032, BE-034, plus FE-003d: `06_SECURITY_AUDIT.md`.
- Realtime lens on BE-016 and FE-022: `07_REALTIME_AUDIT.md`.
- Database/tenant lens on BE-001, BE-004, BE-015, BE-020…BE-023, BE-027, BE-029: `08_DATABASE_TENANT_AUDIT.md`.
- Frontend counterparts: `01_FRONTEND_AUDIT.md`, `04_FRONTEND_API_CONTRACT.md`.
- PRD conflicts PC-01…PC-14: `09_PRD_IMPLEMENTATION_MATRIX.md`.
- Ordered remediation direction (frontend queue and backend queue, kept separate): `10_RECOMMENDED_REPAIR_ORDER.md`.
