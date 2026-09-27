# 06 — Security Audit

**Source:** `.kilo/plans/1790436768946-snapbox-forensic-audit.md` §5 (BE-005…BE-010, BE-017, BE-018, BE-020…BE-028, BE-032, BE-034) and §3 (FE-003d)
**Status of this document:** audit result. No source file, migration, config, secret, or environment was modified or read beyond what is cited.
**Canonical location:** `05_BACKEND_API_AUDIT.md` holds the canonical statement of every `BE-*` finding. This file is the **security lens** — the same findings reordered by attacker-reachable outcome, with the exposure path spelled out. Where the two disagree, `05` is correct.
**Evidence basis:** static code reading only. **No live Supabase / Firebase / Vercel / Cloudflare / Sentry / Resend access (AUDIT-LIM-02).** Nothing here is a runtime penetration result.

---

## How to read this file

Same eleven-field template as every other file in this audit:
`Finding` · `Evidence` · `Actual` · `Expected` · `Impact` · `Severity` · `Affected files` · `Affected routes` · `Related API` · `Status` · `Recommended next action` (**direction only, never code**).

Severity: **P0** blocker · **P1** critical · **P2** major · **P3** minor · **P4** observation.

| Security status | Meaning                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| `EXPOSED`       | Reachable by an attacker given the code as written.                                                        |
| `NOMINAL`       | A control exists and is documented, but does not execute on the path in use.                               |
| `LATENT`        | Not exploitable today because a prerequisite is missing; becomes exploitable when that prerequisite lands. |
| `UNVERIFIED`    | Depends on live infrastructure or runtime evidence (AUDIT-LIM-01/02).                                      |
| `POSITIVE`      | A real control, recorded so it is not weakened.                                                            |

---

## 1. Security posture in one paragraph

The **application layer** is unusually strong: every mutation re-derives `tenantId` from the session, all 55 server actions re-read the `users`/`tenants` row, cross-tenant reads return 404 rather than 403, and no client-supplied `tenantId` exists anywhere. The **database layer's** second line of defence does not execute at all, because the app connects as the table owner and RLS is `ENABLE`d but not `FORCE`d. The result is a single-layer system that happens to be a good single layer. Everything ranked P0/P1 below is either a hole in that one layer, a control that is declared but not enforced, or an unauthenticated disclosure.

---

## 2. Ranked security findings

| Rank | ID      | Finding                                                                                          | Security status                | Severity |
| ---- | ------- | ------------------------------------------------------------------------------------------------ | ------------------------------ | -------- |
| 1    | BE-001  | RLS enabled, not `FORCE`d; app connects as table owner ⇒ 40+ policies never fire                 | **NOMINAL**                    | **P0**   |
| 2    | BE-020  | `0005_owner_promo_code_scope.sql` orphaned from the journal ⇒ never applied                      | **EXPOSED** (schema drift)     | **P0**   |
| 3    | BE-021  | 3 tables in `schema.ts`, in no snapshot ⇒ next `generate` emits forbidden DDL, WAF ingest breaks | **EXPOSED** (on next generate) | **P1**   |
| 4    | BE-006  | Two CEO pages read tenant PII with middleware-only authz (12 h cookie window)                    | **EXPOSED**                    | **P1**   |
| 5    | BE-007  | `auth_sessions.revokedAt` written, never enforced; suspend/ban does not revoke                   | **EXPOSED**                    | **P1**   |
| 6    | BE-005  | 75-permission RBAC dead; Staff safety accidental, gated only on a folder not existing            | **LATENT**                     | **P1**   |
| 7    | FE-003d | `/gallery` public + unauthenticated; 41/64 primitives + heavy deps exposed                       | **EXPOSED** (information)      | **P1**   |
| 8    | BE-003  | `POST /api/booth/pair` missing ⇒ `deviceQuota` a permanent no-op                                 | **EXPOSED** (quota bypass)     | **P1**   |
| 9    | BE-022  | `app.is_ceo()` returns `true` when `public.users` is unreadable                                  | **LATENT**                     | **P2**   |
| 10   | BE-023  | `promo_redemptions.transactionId` client-supplied, no FK, under a policy that never runs         | **LATENT** (IDOR)              | **P2**   |
| 11   | BE-010  | Rate limit in-memory, per-instance, globally clearable, `unknown` IP fallback                    | **EXPOSED** (weak)             | **P2**   |
| 12   | BE-028  | Bot protection declared, never invoked; ruleset targets 5 non-existent endpoints                 | **NOMINAL**                    | **P2**   |
| 13   | BE-025  | Webhook has no freshness window; `validUntil` re-assertable up to 400 days                       | **EXPOSED** (bounded)          | **P2**   |
| 14   | BE-026  | `WHATSAPP_SALES_NUMBER` gates webhook signature verification                                     | **EXPOSED** (availability)     | **P2**   |
| 15   | BE-008  | No CSP, no HSTS; `secure:false` outside production                                               | **EXPOSED**                    | **P2**   |
| 16   | BE-009  | `/api/auth/staff-pin` lacks the `isSameOrigin` check its sibling has                             | **LATENT**                     | **P2**   |
| 17   | BE-018  | `/api/health` returns raw driver error strings, unauthenticated                                  | **EXPOSED** (disclosure)       | **P2**   |
| 18   | BE-032  | Unused `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`; dev `.env` cannot validate its own schema              | **UNVERIFIED**                 | **P3**   |
| 19   | BE-017  | Untracked `.env`, untracked `apps/desktop/dist/**`, one unguarded service-role read              | **EXPOSED** (hygiene)          | **P2**   |
| 20   | BE-034  | `server-only` on 2 of ~15 server modules                                                         | **LATENT**                     | **P3**   |

### 2.1 Security controls that are genuinely correct — do not weaken

| Control                                       | Evidence                                                                                                                                                                                                | Note                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Application-layer tenant isolation            | every `WHERE tenant_id` is session-derived; 404 not 403 on cross-tenant                                                                                                                                 | The single most important asset in the codebase (BE-004)                               |
| All 55 server actions gate on a fresh DB read | `requireCeo()` / `requireOwnerTenant()` in every export                                                                                                                                                 | Not a cookie snapshot (BE-030)                                                         |
| Entitlement fails closed at every step        | `entitlement-contract.ts:190-233`                                                                                                                                                                       | DB outage mapped to denial, though it is indistinguishable from a plan denial (BE-031) |
| Pakasir webhook                               | raw-body HMAC before parse, `timingSafeEqual` + length/hex pre-checks, 64 KB cap, idempotency marker released on non-2xx, server-authoritative amount, monotonic date guard, dead-letter on every class | Production-grade (BE-012)                                                              |
| `realtime.messages` RLS                       | extension-scoped, correct `broadcast:all` CEO gate, presence restricted to own `tenant:`/`user:`, **no browser INSERT policy**                                                                          | Deliberate and correct: publish is `service_role`-only                                 |
| Deferred `booth:{id}` policy                  | `0001_rls_and_realtime.sql:144-166` with the `split_part` UUID round-trip                                                                                                                               | Correctly deferred, correctly written                                                  |
| No `REPLICA IDENTITY`, no publications        | —                                                                                                                                                                                                       | **Correct**: the transport is Broadcast/Presence, not Postgres Changes                 |
| Pairing token minting                         | 18 random bytes (144-bit), SHA-256 hash-only persistence, 10-min TTL, prior token invalidated, 404 on cross-tenant                                                                                      | Best-implemented part of a chain that dead-ends (BE-003)                               |
| `payment-crypto`                              | AES-256-GCM; masked credentials never returned; advisory-locked upsert                                                                                                                                  | Configuration-only path (BE-011)                                                       |
| PIN hashing                                   | scrypt with per-hash parameters + `timingSafeEqual`                                                                                                                                                     | The _read_ path is unwired (FE-020)                                                    |
| Auth claim handling                           | `verifyIdToken` server-side; `tenantId`/`role` from the **DB row**, never the client claim; `CLAIMS_STALE` detection                                                                                    | Client-claim tenant redirection has zero effect                                        |
| Secret schema separation                      | `publicEnvSchema` / `serverEnvSchema` / `secretEnvSchema` / `thirdPartyEnvSchema`; parse errors emit `path`+`message` only                                                                              | `server-only` is not applied to the DB modules (BE-034)                                |
| `packages/auth` barrel                        | `index.ts:11` does not re-export `./admin`/`./client`                                                                                                                                                   | `firebase-admin` cannot reach a browser bundle                                         |
| Tauri CSP and capabilities                    | `script-src 'self'`, no `unsafe-inline`/`unsafe-eval`; `core:default` + `opener:default` scoped to one window; no shell/process command                                                                 | PRD §10.10 respected; `opener:default` is broader than needed (BE-002)                 |
| WAF/heartbeat ingest auth                     | shared secret, constant-time compare, fail-closed 503 when the secret is unset                                                                                                                          | At risk from BE-021                                                                    |
| Open-redirect protection on `?next=`          | validated at all three entry points                                                                                                                                                                     | Verified                                                                               |
| 149 `NEXT_PUBLIC_*` occurrences reviewed      | none is a secret                                                                                                                                                                                        | —                                                                                      |

---

## 3. Findings

### BE-001 — P0 — RLS is enabled but not `FORCE`d, and the app connects as the table owner

**Finding.** P0. The database's second layer of tenant defence does not execute on the connection the application uses.

**Evidence.** `packages/db/src/client.ts:30-56` connects with `postgres(DATABASE_URL)` — the Supabase direct/superuser connection, not the anon key. RLS is `ENABLE`d without `FORCE ROW LEVEL SECURITY` throughout the migration set, so the owning role bypasses every policy. All 40+ policies are well-formed; the role is the defect.

**Actual.** RLS policies do not fire for any application query.

**Expected.** PRD §5.5: "Postgres RLS policy aktif sebagai lapisan kedua."

**Impact.** 100% of tenant isolation rests on application predicates. Those predicates are good (BE-004), but a single missed one is a cross-tenant leak with **no database backstop**.

**Severity.** P0.

**Affected files.** `packages/db/src/client.ts:30-56`, `packages/db/migrations/0001_rls_and_realtime.sql`, `0005_phase_2_owner_rls.sql`, `supabase/migrations/*_rls_foundation.sql`.

**Affected routes.** All authenticated routes; every query in the app.

**Related API.** All 9 route handlers, all 55 server actions, all 35 tables.

**Status.** NOMINAL — CONFIRMED (static). Live RLS behaviour UNVERIFIED (AUDIT-LIM-02).

**Recommended next action (direction only).** Decide the runtime DB role (a dedicated non-owner DML role), then `FORCE RLS` **after** all paths are tested. This is the only change that turns the documented defence-in-depth from nominal into real.

---

### BE-020 — P0 — `0005_owner_promo_code_scope.sql` is orphaned and will never be applied

**Finding.** P0. A migration on disk that the journal-driven migrator will never execute.

**Evidence.** `packages/db/migrations/0005_owner_promo_code_scope.sql` exists; `meta/_journal.json:40-46` contains only `0005_phase_2_owner_rls`. Its only novel artifact is `CREATE INDEX IF NOT EXISTS promo_redemptions_tenant_customer_idx … (tenant_id, promo_id, customer_email)` (`:12-13`); lines 2-10 are no-ops against `0004`.

**Actual.** The index the redemption path depends on does not exist in any database built from the repo.

**Expected.** Every migration file has a journal entry and is applied in order.

**Impact.** Silent divergence between claimed and deployed schema; the redemption count is a sequential scan forever. `migrate-ordered.mjs` will not notice.

**Severity.** P0 (one journal entry; a `migrate --dry-run` in CI would have caught it).

**Affected files.** `packages/db/migrations/0005_owner_promo_code_scope.sql`, `meta/_journal.json:40-46`, `promos/actions.ts:165-169`.

**Affected routes.** `/owner-dashboard/promos` (only once `redeemPromo` gains a caller).

**Related API.** `redeemPromo`. Table: `promo_redemptions`.

**Status.** EXPOSED — CONFIRMED (static); live DB state UNVERIFIED (AUDIT-LIM-02).

**Recommended next action (direction only).** Add the journal entry (or drop the file) and assert journal/file parity in CI.

---

### BE-021 — P1 — Three tables in `schema.ts`, in no snapshot ⇒ the next `generate` emits forbidden DDL

**Finding.** P1. Schema, snapshots, and applied migrations disagree; a routine command will break the WAF ingest path.

**Evidence.** `security_events`, `auth_sessions`, `system_health_checks` are declared at `packages/db/src/schema.ts:897,922,940`; `meta/` holds only 0000/0002/0004 snapshots and only `platform_settings` matches. `supabase/…00500:10-13` explicitly forbids a Drizzle migration creating these tables again: two divergent DDLs plus `IF NOT EXISTS` makes the second a silent no-op, so runtime columns can mismatch queries.

**Actual.** The next `drizzle-kit generate` emits `CREATE TABLE` for all three; `00500:26,65,91` then no-ops.

**Expected.** Schema, snapshots, and migrations describe one database.

**Impact.** `recordWafEvent` / `recordHealthHeartbeat` / `recordAuthSession` start throwing on column mismatch; `api/internal/telemetry/waf/route.ts:70-73` returns 500 — **WAF visibility disappears exactly when it is needed**, and the WAF is the compensating control several P2 findings above rely on.

**Severity.** P1.

**Affected files.** `packages/db/src/schema.ts:897,922,940`, `meta/0004_snapshot.json`, `supabase/migrations/*00500*`, `app/api/internal/telemetry/waf/route.ts:70-73`, `api/internal/telemetry/heartbeat/route.ts`.

**Affected routes.** `/api/internal/telemetry/waf`, `/api/internal/telemetry/heartbeat`, `/ceo-dashboard/system-health`, `/ceo-dashboard/security`.

**Related API.** `recordWafEvent`, `recordHealthHeartbeat`, `recordAuthSession`, `revokeAuthSession`, `revokeAuthSessionsForUser`.

**Status.** EXPOSED on next generate — CONFIRMED (static).

**Recommended next action (direction only).** Restore snapshot parity **before** anyone runs `generate`, or exclude those three tables from the Drizzle schema since `00500` owns their DDL.

---

### BE-006 — P1 — Two CEO pages read real PII with middleware-only authorization

**Finding.** P1. The two most sensitive CEO surfaces do not re-check the role server-side.

**Evidence.** `ceo-dashboard/tenants/[id]/page.tsx:58-67` and `ceo-dashboard/tenants/new/page.tsx:29` never call `requireCeo()`, and neither do their loaders (`tenant-server.ts:100,132,166,186,197,215`). Every sibling page does. This violates the repo's own rule at `middleware.ts:17-21`; `ceo-dashboard/layout.tsx:12-14` delegates authz to middleware and requires each route to repeat it — these two do not. Exposed fields: `ownerEmail`, `ownerPhone`, `address`, `notes`, plan tiers, subscription amounts, booth names, audit-actor emails. Window: `SESSION_MAX_AGE_SECONDS = 43_200` (12 h) after role revocation.

**Actual.** Middleware authorizes from a cookie; it does not re-read the role.

**Expected.** Every DB-touching CEO route repeats `requireCeo()`.

**Impact.** Up to 12 h of continued PII access after a CEO role is revoked, on the two highest-value targets in the product.

**Severity.** P1.

**Affected files.** `ceo-dashboard/tenants/[id]/page.tsx:58-67`, `ceo-dashboard/tenants/new/page.tsx:29`, `lib/ceo-dashboard/tenant-server.ts:100,132,166,186,197,215`, `middleware.ts:17-21`.

**Affected routes.** `/ceo-dashboard/tenants/[id]`, `/ceo-dashboard/tenants/new`.

**Related API.** `getTenantDetail`, `listTenants`, `listPlanOptions`, `createTenant`. Tables: `tenants`, `users`, `b2b_subscriptions`, `booths`, `activity_logs`.

**Status.** EXPOSED — CONFIRMED (static).

**Recommended next action (direction only).** Add `requireCeo()` inside the `tenant-server.ts` loaders so the class is closed rather than the two instances.

---

### BE-007 — P1 — Session revocation is recorded but never enforced

**Finding.** P1. The product can revoke a session; the verification path cannot see it.

**Evidence.** `revokeAuthSession` / `revokeAuthSessionsForUser` write `auth_sessions.revokedAt` (`health-security-server.ts:287-319`). `verifySession` (`session.ts:193-236`) checks **only** HMAC → zod → `exp`. `changeTenantStatus` and `deleteTenant` disable the Firebase account and the `users` row but never call `revokeAuthSessionsForUser`, despite `health-security-server.ts:302-306` saying it is provided for that path. The CEO Security page renders a "Dicabut" label for a state the enforcement path ignores.

**Actual.** Revocation is written to a table nothing reads on the request path.

**Expected.** A revoked session stops authenticating.

**Impact.** Logout, force-revoke, and account suspension are advisory: up to 12 h of continued authenticated access, including the BE-006 PII pages. Mutations are still blocked by `requireOwnerTenant`'s `disabled` check, so this is read exposure, not write exposure.

**Severity.** P1.

**Affected files.** `lib/auth/session.ts:193-236`, `lib/ceo-dashboard/health-security-server.ts:287-319`, `ceo-dashboard/tenants/actions.ts`, `packages/db/src/schema.ts:922`.

**Affected routes.** All authenticated routes; `/ceo-dashboard/security` (displays the unenforced state).

**Related API.** `verifySession`, `revokeAuthSession`, `revokeAuthSessionsForUser`, `changeTenantStatus`, `deleteTenant`.

**Status.** EXPOSED — CONFIRMED (static).

**Recommended next action (direction only).** Enforce `revoked_at` in the Node-side verifiers and call `revokeAuthSessionsForUser` from suspend/ban/delete. Consider a `kid` prefix on the session cookie so secret rotation is non-breaking (`session.ts:108-113`).

---

### BE-005 — P1 — Granular RBAC is entirely dead code

**Finding.** P1. A 75-permission authorization model exists; nothing reads it.

**Evidence.** `packages/shared/src/auth.ts` defines 75 `PERMISSIONS`, `OWNER_PERMISSIONS`, `STAFF_PERMISSIONS`, `ROLE_PERMISSIONS`, `hasPermission()`, `canAccessTenant()`, `ROLE_HOME_ROUTE`. Repo-wide grep matches **only inside `auth.ts` itself — zero consumers**. Actual enforcement is role-string equality (`row.role !== 'CEO'`, `owner.role !== 'OWNER'`). `STAFF_PERMISSIONS` (deliberately excluding destructive entries) is never consulted. No instance was found of a client-gated destructive control whose server action omits the check — every traced one has a server-side counterpart, often the same shared function (`statusTransitionError` at `tenant-detail-actions.tsx:157` and `tenants/actions.ts:296`).

**Actual.** The permission model is unused; enforcement is a two-value comparison.

**Expected.** Either the documented model is enforced, or the documentation stops claiming it.

**Impact.** Staff safety today is _incidental_ — `/staff-dashboard` does not exist, so Staff hits `/unauthorized`. **The day that folder is added, or any action forgets `requireOwnerTenant()`, a Staff account gets OWNER-class destructive access with no warning and no test failing.**

**Severity.** P1.

**Affected files.** `packages/shared/src/auth.ts`, `lib/ceo-dashboard/tenant-server.ts`, `lib/owner-dashboard/outlet-server.ts`, all `actions.ts`, `lib/auth/route-policy.ts`.

**Affected routes.** All `/owner-dashboard/**`, `/ceo-dashboard/**`, the future `/staff-dashboard/**`.

**Related API.** `requireCeo()`, `requireOwnerTenant()`; `hasPermission()` / `canAccessTenant()` uncalled.

**Status.** LATENT — CONFIRMED (static).

**Recommended next action (direction only).** Wire `hasPermission` into mutations **or** delete the module and stop claiming granular RBAC. Do not add `/staff-dashboard` before this is decided.

---

### FE-003d — P1 — `/gallery` is public, unauthenticated, and unlinked

**Finding.** P1. An internal component catalog with no access control.

**Evidence.** `middleware.ts:43-49` matcher is `['/ceo-dashboard/:path*','/owner-dashboard/:path*','/staff-dashboard/:path*','/dashboard/:path*','/login']` — `/gallery` is **not matched**, so no auth and no role check run. `robots.ts:15`, `sitemap.ts:41` and `gallery/page.tsx:12-17` are all advisory to crawlers, not access control. It renders 41 of the 64 UI primitives, ships `@tanstack/react-table`, `react-day-picker`, `recharts`, `react-hook-form` and `zod` as publicly downloadable chunks (`gallery-heavy-data.tsx:1-17`, `primitives-section.tsx:134`), and displays 20 dummy tenant names + 3 dummy device IDs from `example-data.ts`. `grep '/gallery'` outside `app/gallery/` returns 3 hits, all comments.

**Actual.** Full internal-surface disclosure to anonymous visitors.

**Expected.** An internal catalog gated by auth or environment.

**Impact.** Reveals the component inventory, the demo data model, and the heavy client dependency set — useful reconnaissance, and the public chunks are a bandwidth/attack-surface cost with no product return.

**Severity.** P1.

**Affected files.** `middleware.ts:43-49`, `app/gallery/**`, `gallery-heavy-data.tsx`, `primitives-section.tsx`, `example-data.ts`, `robots.ts`, `sitemap.ts`, `docs/ADR-002-neobrutalism-tokens.md:42-43,57-60`.

**Affected routes.** `/gallery`.

**Related API.** None.

**Status.** EXPOSED (information disclosure) — CONFIRMED (static).

**Recommended next action (direction only).** Gate `/gallery` behind non-production or `notFound()`. That single decision also scopes how much of `packages/ui` is actually required (only 20 of 64 primitives are used in product UI).

---

### BE-003 — P1 — `POST /api/booth/pair` does not exist ⇒ pairing is a dead end and `deviceQuota` is a permanent no-op

**Finding.** P1. A quota that can never be enforced because the rows it counts are never created.

**Evidence.** `pair-session/route.ts:9-10` states the redemption endpoint does not exist. `used`/`usedAt` (`:319-320`), `expiresAt` (`:318`) and `attemptCount` (`:321`) have **zero readers/writers outside the insert**; there is **no** atomic `UPDATE … WHERE used = false AND expires_at > now()` anywhere. The `devices` table is **never inserted into**, so `deviceQuota` (`machine-server.ts:120-123`) always counts 0 ⇒ **unlimited pairing on every plan** (`pair-session/route.ts:62-68`). Positives: 18 random bytes (144-bit), SHA-256 hash-only persistence (`pairing-session.ts:54,60`), 10-min TTL, prior tokens invalidated on re-issue, tenant+booth scoped, 404 (not 403) on cross-tenant.

**Actual.** A correct token mint terminates at a wall, leaving a paid limit unenforceable.

**Expected.** Atomic redemption, attempt counting, and a `devices` row on first pair.

**Impact.** Device limits sold in `PlanFeatures` cannot apply. No kiosk can be paired, so the missing redemption path is currently masked — that is the only reason this is P1 and not P0.

**Severity.** P1.

**Affected files.** `app/api/booth/pair-session/route.ts`, `owner-dashboard/machines/pairing-session.ts`, `machine-server.ts:120-123`, `packages/db/src/schema.ts`.

**Affected routes.** `/owner-dashboard/machines`; the kiosk flow (no route).

**Related API.** `POST /api/booth/pair-session` (exists) · `POST /api/booth/pair` (missing). Tables: `pairing_tokens`, `devices`, `booths`.

**Status.** EXPOSED (quota bypass) — CONFIRMED (static).

**Recommended next action (direction only).** Implement redemption with one atomic conditional update, wire `expires_at`/`attempt_count` into the predicate, and insert into `devices` on first pair. Add the per-device rate-limit dimension (BE-010) in the same change.

---

### BE-022 — P2 — `app.is_ceo()` fails open when `public.users` is unreadable

**Finding.** P2. One defensive branch inside a fail-closed function returns the permissive answer.

**Evidence.** `supabase/…00100:166-168`: `if to_regclass('public.users') is null then return true; end if;`. The claim check at `:152-164` is otherwise sound — layer 2 requires a real `users` row with `firebase_uid = claims->>'sub' AND role='CEO' AND NOT disabled AND deleted_at IS NULL`, so claim forgery alone is insufficient (**a genuinely good two-layer design**). The authors already fixed an analogous NULL-fail-open at `:146-151`; this branch survived.

**Actual.** If `users` is missing, renamed, or misconfigured in `search_path`, **any** token carrying `app_role='CEO'` (or the `app.role` GUC) becomes CEO.

**Expected.** Unreadable ⇒ deny.

**Impact.** Narrow trigger, catastrophic outcome: tenant provisioning, plan pricing, global settings, global promos, and broadcasts.

**Severity.** P2.

**Affected files.** `supabase/migrations/20260101000100_rls_foundation.sql:146-168`.

**Affected routes.** All `/ceo-dashboard/**` data paths; every RLS policy calling `app.is_ceo()`.

**Related API.** `app.is_ceo()`. Tables: `tenants`, `users`, `platform_settings`, `promos`, `broadcasts`.

**Status.** LATENT — CONFIRMED (static).

**Recommended next action (direction only).** Return `false` when the table cannot be read.

---

### BE-023 — P2 — `promo_redemptions.transactionId` is a client-supplied UUID with no FK

**Finding.** P2. A client-provided identifier is stored as a foreign reference with nothing validating it.

**Evidence.** `promos/actions.ts:176-182` inserts with `transactionId: p.data.transactionId ?? null`. `schema.ts:526` declares `tenantId NOT NULL` with **no** `.references()`; `transactionId` has **no FK**. `0005_phase_2_owner_rls.sql:107` cross-checks the transaction's tenant — but the app connects as the table owner (BE-001), so that policy never runs.

**Actual.** A redemption row can point at any transaction id in the database.

**Expected.** A composite FK, or a server-derived transaction id.

**Impact.** A tenant can attach a redemption record to another tenant's transaction id. Not exploitable for money today (`redeemPromo` has zero callers) — but it is a live storage-layer hole that survives the moment the kiosk ships.

**Severity.** P2. Category: `POTENTIAL IDOR` / `TENANT SCOPING RISK`.

**Affected files.** `promos/actions.ts:176-182`, `packages/db/src/schema.ts:526`, `0005_phase_2_owner_rls.sql:107`.

**Affected routes.** `/owner-dashboard/promos` (when `redeemPromo` gains a caller).

**Related API.** `redeemPromo`. Tables: `promo_redemptions`, `transactions`.

**Status.** LATENT — CONFIRMED (static).

**Recommended next action (direction only).** Stop accepting a client-supplied `transactionId`, or add a composite FK. The RLS cross-check is **not** a substitute while BE-001 stands.

---

### BE-010 — P2 — Rate limiting is in-memory, per-instance, and self-defeating

**Finding.** P2. The only runtime abuse control can be multiplied by the deployment and switched off by an attacker.

**Evidence.** `lib/auth/rate-limit.ts:34` `new Map<string, Bucket>()`; `:8-16` self-documents the per-instance multiplication on Vercel. `:51` `if (buckets.size >= MAX_BUCKETS) buckets.clear()` — 5 000 generated keys **wipe every victim's counters**. `clientIp` falls back to the literal `'unknown'` (`:80`), collapsing all headerless traffic into one global window. Limits are 10/min per IP, 5/min per email. `pair-session` is keyed on **IP only**; PRD §8.2 requires `/api/booth/*` at 60/min **per device fingerprint**. Cloudflare WAF/rate-limit/Turnstile exist as **JSON drafts only**; `check-infra-drafts.mjs` proves completeness, not deployment.

**Actual.** A per-process counter with a global reset and a shared fallback key.

**Expected.** A shared store; per-device limiting on the booth surface.

**Impact.** On Vercel the effective limit is N× the intended one; credential stuffing and pairing abuse both run effectively unlimited; the PRD's per-device requirement does not exist.

**Severity.** P2.

**Affected files.** `lib/auth/rate-limit.ts:8-16,34,51,80`, `app/api/booth/pair-session/route.ts`, `infra/cloudflare/*.json`, `scripts/check-infra-drafts.mjs`.

**Affected routes.** `/api/auth/session`, `/api/auth/staff-pin`, `/api/booth/pair-session`.

**Related API.** All three limited endpoints.

**Status.** EXPOSED (weak) — CONFIRMED (static); any live Cloudflare zone UNVERIFIED (AUDIT-LIM-02).

**Recommended next action (direction only).** Replace `buckets.clear()` with LRU expiry, move limiter state to a shared store, add the per-device fingerprint dimension, and confirm whether the Cloudflare drafts are deployed at all.

---

### BE-028 — P2 — Bot protection is declared but never invoked

**Finding.** P2. Configuration exists; enforcement does not; and the ruleset targets endpoints that do not exist.

**Evidence.** `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` (`env.ts:37,110`) and `infra/cloudflare/turnstile-widget.json` exist; **0** occurrences of `turnstile` in `apps/web/src`. Cloudflare rules reference five non-existent endpoints — `/api/payment/create` (`rate-limit-rules.json:62`), `/api/contact` (`:75`), `/api/operator/*` (`:88`), `/api/pairing/*` (`:103`) — and the `/api/booth/*` rule is blocked by `$requiresWorker: true` (`:48`) with no Worker in the repo. `infra/cloudflare/README.md:145-151` gives a verification procedure that curls `/api/contact` and expects 429 — it will 404. `check:infra-drafts` validates against the PRD allowlist, not the codebase.

**Actual.** No endpoint — including `/api/auth/*` — has a bot challenge; the ruleset that would enforce it points at imaginary routes; the documented verification cannot pass.

**Expected.** A challenge on the auth surface, or declarations removed.

**Impact.** Compounds BE-010: the only abuse control is a self-defeating in-memory limiter. Nobody can prove the ruleset works, because the documented proof is impossible.

**Severity.** P2.

**Affected files.** `packages/shared/src/env.ts:37,110`, `infra/cloudflare/turnstile-widget.json`, `rate-limit-rules.json:48,62,75,88,103`, `infra/cloudflare/README.md:145-151`, `scripts/check-infra-drafts.mjs`.

**Affected routes.** `/api/auth/*`, `/api/booth/*` (targeted, unenforced).

**Related API.** None implemented.

**Status.** NOMINAL — CONFIRMED (static); live zone UNVERIFIED (AUDIT-LIM-02).

**Recommended next action (direction only).** Fix the ruleset before deploying it, then wire Turnstile into at least `/api/auth/*` — or delete the declarations so the env inventory reflects reality.

---

### BE-025 — P2 — Webhook has no timestamp / freshness window

**Finding.** P2. Signature verification is correct; replay protection is not.

**Evidence.** `verifyPakasirSignature` is correct (HMAC-SHA256 over the raw body, `timingSafeEqual` with length + hex-charset pre-check, fail-closed when the secret is unset). There is **no** `X-Pakasir-Timestamp`, no nonce, and no freshness window; `pakasirWebhookPayloadSchema` accepts `paidAt`/`validUntil` as optional with no maximum age. Byte-identical replays **are** caught by the `webhook_events` unique index → `200 {duplicate:true}` with no state change, but the _releasable_-marker path (`:291-303`) re-runs `applyEvent`, and a captured body replayed under a **fresh `eventId`** is accepted as new. Bounded by `MAX_VALIDITY_WINDOW_MS = 400 days` and the amount-must-match check.

**Actual.** Authentic-but-old messages are accepted as new events.

**Expected.** A signed timestamp with a bounded acceptance window.

**Impact.** Not a free-money path. An attacker who captured one valid `PAID` body can repeatedly re-assert `validUntil` up to 400 days out for an invoice they legitimately paid once — an entitlement-integrity gap, not a theft path.

**Severity.** P2.

**Affected files.** `lib/ceo-dashboard/pakasir-b2b.ts`, `app/api/webhooks/pakasir-b2b/route.ts:103-114,291-303`.

**Affected routes.** `POST /api/webhooks/pakasir-b2b`.

**Related API.** `verifyPakasirSignature`, `applyEvent`. Tables: `webhook_events`, `b2b_subscriptions`.

**Status.** EXPOSED (bounded) — CONFIRMED (static).

**Recommended next action (direction only).** Require and verify a signed timestamp with a ±5 min window. Measure the body cap in bytes (`content-length` or a stream), not `rawBody.length` (UTF-16 code units).

---

### BE-026 — P2 — `WHATSAPP_SALES_NUMBER` silently gates webhook signature verification

**Finding.** P2. An unrelated marketing variable can disable payment verification.

**Evidence.** `thirdPartyEnvSchema` requires `WHATSAPP_SALES_NUMBER` non-emptily (`packages/shared/src/env.ts:111`); `pakasir-b2b.ts:87` validates the **whole** schema before reading `webhookSecret`. If that var is unset, `readPakasirConfig` throws → `verifyPakasirSignature` catches → returns `false` → **every webhook 401s**.

**Actual.** A phone number sits in the payment-integrity critical path.

**Expected.** The secret is read from its own schema; an unrelated variable cannot change the verification outcome.

**Impact.** A single missing env var silently rejects every payment webhook. Fails closed, so no security hole — a total outage presenting as a misleading 401.

**Severity.** P2.

**Affected files.** `packages/shared/src/env.ts:111`, `lib/ceo-dashboard/pakasir-b2b.ts:87`, `.env.example`.

**Affected routes.** `POST /api/webhooks/pakasir-b2b`.

**Related API.** `verifyPakasirSignature`, `readPakasirConfig`.

**Status.** EXPOSED (availability) — CONFIRMED (static).

**Recommended next action (direction only).** Split the schema or read the secret from its own schema.

---

### BE-008 — P2 — No CSP and no HSTS

**Finding.** P2. Two standard headers are absent from a cookie-authenticated multi-tenant app.

**Evidence.** `next.config.ts:28-43` sets `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`. Missing: `Strict-Transport-Security` and any `Content-Security-Policy` (PRD §8.2 mandates XSS sanitisation). `session.ts:276` sets `secure: NODE_ENV === 'production'`, so **preview/staging serve the session cookie over plain HTTP**.

**Actual.** Four of six headers present; the two that constrain transport and script execution are not.

**Expected.** PRD §8.2.

**Impact.** No HSTS, so a downgrade to HTTP is possible; no CSP, so injected script has no second barrier; staging/preview expose the session cookie in cleartext.

**Severity.** P2.

**Affected files.** `apps/web/next.config.ts:28-43`, `lib/auth/session.ts:276`.

**Affected routes.** All.

**Related API.** All.

**Status.** EXPOSED — CONFIRMED (static).

**Recommended next action (direction only).** Add CSP and HSTS; set `secure: true` outside local dev.

---

### BE-009 — P2 — `/api/auth/staff-pin` lacks the same-origin check its sibling has

**Finding.** P2. Two auth endpoints with the same threat model, protected differently.

**Evidence.** `api/auth/session/route.ts:61-70,119-121` implements `isSameOrigin` with an explicit login-CSRF threat model. `api/auth/staff-pin/route.ts:62` goes straight to the rate limiter.

**Actual.** CSRF protection exists on one auth route and not its sibling.

**Expected.** Consistent origin enforcement across `/api/auth/*`.

**Impact.** Latent today (FE-020: no PIN can be set) — live the moment that is fixed.

**Severity.** P2.

**Affected files.** `app/api/auth/staff-pin/route.ts:62`, `app/api/auth/session/route.ts:61-70,119-121`.

**Affected routes.** `/api/auth/staff-pin` (drives the `/login` staff tab).

**Related API.** `POST /api/auth/staff-pin`.

**Status.** LATENT — CONFIRMED (static).

**Recommended next action (direction only).** Add the missing `isSameOrigin` check, and apply it to every future `/api/auth/*` route.

---

### BE-018 — P2 — `/api/health` leaks raw DB error strings

**Finding.** P2. An unauthenticated endpoint returns driver error text.

**Evidence.** `api/health/route.ts:32-38` returns `error.message` from the driver on an **unauthenticated** `no-store` endpoint, directly contradicting its own header comment.

**Actual.** Driver messages — which can include host, schema, and relation names — reach any caller.

**Expected.** A health endpoint that reports status, not internals.

**Impact.** Information disclosure to anonymous callers, plus a free error oracle for probing the database.

**Severity.** P2.

**Affected files.** `app/api/health/route.ts:32-38`.

**Affected routes.** `/api/health` (unauthenticated).

**Related API.** `GET /api/health`.

**Status.** EXPOSED (disclosure) — CONFIRMED (static).

**Recommended next action (direction only).** Return a status code and a stable error identifier; keep driver detail in server logs.

---

### BE-017 — P2 — Secrets hygiene

**Finding.** P2. Correct secret architecture; three hygiene gaps.

**Evidence — correct:** `packages/shared/src/env.ts` structurally separates `publicEnvSchema` / `serverEnvSchema` / `secretEnvSchema` (5 base64-32-byte keys, each `.refine()`-validated) / `thirdPartyEnvSchema`; env error messages emit `path` + `message` only, never values. `packages/auth/src/index.ts:11` does **not** re-export `./admin` or `./client`, so `firebase-admin` cannot enter a browser bundle. All 149 `NEXT_PUBLIC_*` occurrences reviewed; none is a secret. AES-256-GCM for B2C credentials; `payment_settings` key allowlist; scrypt PIN with per-hash parameters and `timingSafeEqual`.

**Gaps.** `.env` (2 759 B) sits in the working tree — untracked but present. `apps/desktop/dist/**` appears in the tree; a 2.3 MB `.js.map` is an information-disclosure and bloat concern if tracked. `broadcast-server.ts` reads `SUPABASE_SERVICE_ROLE_KEY` and sends it as `Authorization`/`apikey` **without `import 'server-only'`**, unlike `realtime-server.ts:8`.

**Actual.** An untracked `.env`, untracked build output with a source map, and one unguarded service-role read.

**Expected.** No secret material in the tree; server-only modules structurally unable to reach a client bundle.

**Impact.** Low today. The `.map` and the missing guard become disclosure vectors the moment either is committed or the module is imported from a client component.

**Severity.** P2.

**Affected files.** `packages/shared/src/env.ts`, `packages/auth/src/index.ts:11`, `lib/ceo-dashboard/broadcast-server.ts`, `apps/desktop/dist/**`, `.gitignore`.

**Affected routes.** `/ceo-dashboard/broadcast` and anything that could import `broadcast-server.ts`.

**Related API.** `parseEnv`; the `broadcast-server.ts` publish helper.

**Status.** EXPOSED (hygiene) — CONFIRMED (static).

**Recommended next action (direction only).** Confirm `.env` and `apps/desktop/dist/**` are ignored; add `import 'server-only'` to the service-role readers.

---

### BE-032 — P3 — `auth_sessions` revocation + `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` dead

**Finding.** P3. One dead publishable key, one deliberately-throwing route, and an unverifiable env assumption.

**Evidence.** `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` is declared (`env.ts:38`, `.env.example`, `check-env-example.mjs:29`) and referenced by **zero** application code. `eslint.ignoreDuringBuilds: true` (`next.config.ts:16-20`) is justified as "lint runs as a separate CI task" — correct only if that task is mandatory, which is **UNVERIFIED**. `.env` is missing all 22 `NEXT_PUBLIC_*` names, so `publicEnvSchema` cannot currently validate and `realtime-server.ts:18,30` / `broadcast-server.ts:118` cannot resolve a Supabase URL. `api/sentry-example` (`route.ts:23-28`) throws an unhandled `Error` on every GET outside production — correctly gated and whitelisted from WAF, with a comment saying the exemption must go with the route. The revocation half is BE-007.

**Actual.** An unused key, a dev environment that cannot validate its own schema, and a route that throws by design.

**Expected.** Every declared env var is consumed; a dev environment can start; no route throws by design outside production.

**Impact.** Low. The tripwire route consumes error budget, and if its WAF exemption outlives it, a throwing endpoint is silently allowlisted.

**Severity.** P3.

**Affected files.** `packages/shared/src/env.ts:38`, `.env.example`, `scripts/check-env-example.mjs:29`, `apps/web/next.config.ts:16-20`, `app/api/sentry-example/route.ts:23-28`, `lib/realtime/realtime-server.ts:18,30`, `lib/ceo-dashboard/broadcast-server.ts:118`.

**Affected routes.** `/api/sentry-example`; `/ceo-dashboard/broadcast` and realtime publish (env-dependent).

**Related API.** `GET /api/sentry-example`.

**Status.** UNVERIFIED (production env completeness) — CONFIRMED (static) for the dead key and the tripwire.

**Recommended next action (direction only).** Remove or use the key; delete `api/sentry-example` together with its WAF exemption; verify the full `NEXT_PUBLIC_*` set in production before any deploy.

---

### BE-034 — P3 — Server-only enforcement is convention, not guard

**Finding.** P3. The rule keeping server secrets out of the browser is documented, not enforced, for the database layer.

**Evidence.** `import 'server-only'` appears on 2 of ~15 server modules (`frame-storage.ts:1`, `transaction-server.ts:1`). `client.ts`, `outlet-server.ts`, `entitlement-service.ts`, `pakasir-b2b.ts`, `email/resend.ts`, `payment-server.ts`, `broadcast-server.ts` rely on naming convention plus the absence of a `NEXT_PUBLIC_` prefix. A `'use client'` component importing `@snapbox/db` would not be stopped by a build error.

**Actual.** Two modules opt in; the rest rely on convention.

**Expected.** A structural guarantee, or a CI guard that fails on client-reachable imports of server modules.

**Impact.** The failure mode is a build-time leak of `DATABASE_URL`, `firebase-admin`, or the service-role key into a browser bundle. `packages/auth` solved this properly; `@snapbox/db` did not.

**Severity.** P3.

**Affected files.** `packages/db/src/client.ts`, `lib/owner-dashboard/outlet-server.ts`, `lib/owner-dashboard/entitlement-service.ts`, `lib/ceo-dashboard/pakasir-b2b.ts`, `lib/email/resend.ts`, `lib/owner-dashboard/payment-server.ts`, `lib/ceo-dashboard/broadcast-server.ts`.

**Affected routes.** Any reachable by a client import.

**Related API.** `@snapbox/db`, the secret schemas in `parseEnv`.

**Status.** LATENT — CONFIRMED (static).

**Recommended next action (direction only).** Add `import 'server-only'` to the ~13 modules that lack it, starting with `broadcast-server.ts` and `packages/db/src/client.ts`, and add a CI guard for client-reachable server imports.

---

## 4. Security gaps that are _not_ findings

Recorded so a later pass does not "discover" them and add noise:

- **No `REPLICA IDENTITY`, no `realtime` publication entries.** Correct and deliberate — the transport is Supabase Broadcast/Presence, not Postgres Changes.
- **No browser INSERT policy on `realtime.messages`.** Correct: publish is `service_role`-only. Adding one would be the defect.
- **No `pg_cron` schedule for subscription expiry.** A missing feature (BE-013), not a security control failure.
- **`device_calibrations` has RLS revoked from every role.** Isolation rests on the global uniqueness of `booths.device_fingerprint` — a real but undocumented invariant (BE-029, P3).
- **`.env` is untracked, not committed.** A hygiene gap, not an exposure (BE-017).
- **The Staff PIN path is unwired.** Removing the feature removes the BE-009 CSRF gap with it (FE-020).

---

## 5. PRD §8.3 Security Acceptance Criteria — scorecard

The PRD's own mandatory gate: _"Checklist Wajib Lulus"_ — **100% must pass** before launch. Twenty criteria, scored statically.

| #   | Criterion                                     | Actual                                                                                                                                                                                                                                                                                         | Verdict   |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | No secrets in frontend                        | `publicEnvSchema` is the only schema a browser module may import; `firebase-admin` is withheld from the package barrel; all 149 `NEXT_PUBLIC_*` reviewed and none is a secret. One structural gap: `broadcast-server.ts` reads the service-role key with no `server-only` assertion (BE-017)   | `PARTIAL` |
| 2   | API authorization server-side                 | **Yes.** All 55 server actions and all 9 route handlers re-derive role and tenant from a fresh DB read; no client header is trusted for authorization                                                                                                                                          | `PASS`    |
| 3   | Tenant isolation tested                       | **Not tested.** No cross-tenant test exists. The application layer would likely pass; the database layer would not, because RLS is inert on its own connection (BE-001)                                                                                                                        | `FAIL`    |
| 4   | IDOR tested                                   | **Not tested.** No automated IDOR suite — and one live instance of the class exists: a client-supplied `transactionId` with no FK (BE-023)                                                                                                                                                     | `FAIL`    |
| 5   | Webhook signature verified                    | **Yes.** HMAC-SHA256 over the raw body **before** parse, `timingSafeEqual` with length and hex pre-checks, fail-closed when the secret is unset (BE-012)                                                                                                                                       | `PASS`    |
| 6   | Webhook idempotency tested                    | **Not tested**, though implemented — unique `(provider, provider_event_id)` with the marker **released on any non-2xx** so a retry reprocesses (BE-012)                                                                                                                                        | `FAIL`    |
| 7   | Rate limits active                            | **Partially.** In-app limits run (10/min IP, 5/min email) but are in-memory, per-instance, spoofable via a rotating forwarded-for header, and globally clearable at 5 000 keys. The Cloudflare layer is an undeployed draft (BE-010)                                                           | `PARTIAL` |
| 8   | Cloudflare WAF configured                     | **No.** `infra/cloudflare/README.md:6-7` states nothing in that directory is executed against any account, and 5 of 8 rules target endpoints that do not exist (BE-028)                                                                                                                        | `FAIL`    |
| 9   | Turnstile active                              | **No.** Keys declared, widget drafted, **zero** application usage (BE-028)                                                                                                                                                                                                                     | `FAIL`    |
| 10  | Sensitive credentials encrypted               | **Yes.** AES-256-GCM for payment keys, scrypt for PINs, SHA-256 for pairing codes, HMAC for the session cookie. No plaintext secret found in any code path                                                                                                                                     | `PASS`    |
| 11  | Audit log immutable                           | **Yes, and genuinely.** A `BEFORE UPDATE OR DELETE` trigger plus `REVOKE UPDATE, DELETE`. Triggers are unconditional, so this holds **even for the table owner** — the one place where the database, not the application, is the enforcement point                                             | `PASS`    |
| 12  | Signed URLs expire                            | **Yes for what exists.** Frame thumbnails and framed images use `createSignedUrl`, and list payloads expose only `hasPhotos` so no signed URL leaks into them                                                                                                                                  | `PASS`    |
| 13  | Download tokens non-guessable                 | **Not applicable — nothing exists.** `/download/[token]` is absent; `download_tokens` has no writer and no reader (PC-04)                                                                                                                                                                      | `MISSING` |
| 14  | Device revoke works                           | **Partially.** The database side is complete and transactional; there is no HTTP endpoint and no `DEVICE_REVOKED` push, so a revoked kiosk is never told to stop. No kiosk exists to revoke (BE-003, BE-016)                                                                                   | `PARTIAL` |
| 15  | JWT/session revoke works                      | **No.** `revokedAt` is written and never read; suspend and ban do not revoke. A cookie stays valid for its full 12 hours (BE-007)                                                                                                                                                              | `FAIL`    |
| 16  | Pairing replay prevented                      | **No.** `used` and `expiresAt` have zero readers and zero writers; no atomic single-use claim exists anywhere. The 144-bit code is strong, but the _replay_ control is absent (BE-003)                                                                                                         | `FAIL`    |
| 17  | PIN brute force protected                     | **Partially.** scrypt with per-hash parameters and constant-time compare is correct, and 5/min per email + 10/min per IP apply. But the limiter is per-instance and resettable, there is no CAPTCHA, and the endpoint is inert regardless because nothing writes the PIN hash (FE-020, BE-010) | `PARTIAL` |
| 18  | Duplicate print prevented                     | **Not applicable.** No print path exists. `transactions.gateway_transaction_id` is `UNIQUE`, which is the right primitive for when it is built                                                                                                                                                 | `MISSING` |
| 19  | File upload MIME + size + dimension validated | **Yes, and well.** `frame-storage.ts` checks the declared MIME **and** the format `sharp` actually decodes, rejects a declared/actual mismatch, enforces byte size, enforces minimum dimensions, and caps input pixels                                                                         | `PASS`    |
| 20  | Path traversal blocked                        | **Not applicable — no filesystem access exists in the kiosk.** The error vocabulary anticipates it (`PathNotAllowed`, `error.rs:18-27`) but there is no path-sanitisation layer to audit (BE-002)                                                                                              | `MISSING` |

### Score: 7 `PASS` · 8 `FAIL` · 4 `PARTIAL` · 4 `MISSING` — of 20. The PRD requires 100%.

**Two shapes of failure, and they are not equally urgent.**

The four `MISSING` rows are all the same shape: the criterion is written for a subsystem that does not exist yet, so it has never been attempted. They are honest `MISSING`, not failures of a control.

The eight `FAIL` rows are the real signal, and they cluster on exactly the three structural gaps this audit identified independently: **no enforced revocation** (rows 15, 16), **no durable rate limiting and no deployed edge layer** (rows 7, 8, 9), and **no database-level tenant backstop** (rows 3, 4). The four `PARTIAL` rows (1, 7, 14, 17) are each one deliberate decision away from passing.

**Note on the criterion count.** PRD §8.3 contains **20** criteria. Some readings of this report quote a larger figure because they fold §8.2's adjacent requirements into the same scorecard. The count above is taken directly from `PRD:839-858`.

---

## 6. What a runtime pass would need to test

This audit could not execute anything (AUDIT-LIM-01/02). A second, separate pass should attempt, in this order:

1. Connect as the application's actual `DATABASE_URL` role and confirm whether policies fire (BE-001). If they do not, that is a P0 confirmation, not a hypothesis.
2. Attempt a cross-tenant read/write through one Owner action with a second tenant's id, both with and without `FORCE RLS`.
3. Revoke a session, then reuse the cookie.
4. Revoke a CEO role, then request `/ceo-dashboard/tenants/[id]` with the old cookie.
5. Replay a captured Pakasir body with a fresh `eventId` (BE-025).
6. Unset `WHATSAPP_SALES_NUMBER` and confirm every webhook 401s (BE-026).
7. Generate 5 000 rate-limit keys, then confirm another IP's counter is gone (BE-010).
8. Request `/gallery` anonymously (FE-003d) and `/api/health` with an induced DB error (BE-018).
9. Confirm `setUserClaims` coverage for OWNER/CEO — if `app_role` is not planted, `CLAIMS_STALE` may reject every Owner/CEO login in production (see `00_EXECUTIVE_SUMMARY.md` §9, item 6).

---

## Cross-references

- Canonical `BE-*` statements: `05_BACKEND_API_AUDIT.md`.
- Database/tenant mechanics: `08_DATABASE_TENANT_AUDIT.md`.
- Realtime RLS: `07_REALTIME_AUDIT.md`.
- Auth/session and tenant-PII surfaces: `01_FRONTEND_AUDIT.md` (FE-003d, FE-020), `04_FRONTEND_API_CONTRACT.md` (FE-021b, FE-021c).
- Ordered remediation direction: `10_RECOMMENDED_REPAIR_ORDER.md` §8B (backend queue) — kept separate from the frontend queue.
