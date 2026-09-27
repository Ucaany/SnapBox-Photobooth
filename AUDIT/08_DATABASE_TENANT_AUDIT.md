# 08 — Database & Tenant Audit

**Source:** `.kilo/plans/1790436768946-snapbox-forensic-audit.md` §5 (BE-001, BE-004, BE-015, BE-020…BE-023, BE-027, BE-029)
**Status of this document:** audit result. No migration, schema, snapshot, journal, or database was modified, generated, or contacted.
**Canonical location:** `05_BACKEND_API_AUDIT.md` holds the canonical `BE-*` statements; `06_SECURITY_AUDIT.md` holds the attacker-reachable ordering. This file is the **database/tenant lens**.
**Evidence basis:** static file reading only. **No database connection, no `drizzle-kit`, no `psql`, no query plans (AUDIT-LIM-01/02).** No performance claim is made anywhere in this file.

---

## How to read this file

Same eleven-field template:
`Finding` · `Evidence` · `Actual` · `Expected` · `Impact` · `Severity` · `Affected files` · `Affected routes` · `Related API` · `Status` · `Recommended next action` (**direction only, never code**).

Severity: **P0** blocker · **P1** critical · **P2** major · **P3** minor · **P4** observation.

---

## 1. The one thing to understand before reading anything else

**The RLS policies in this repository are not wrong. The connection role is.**

The migration that enables RLS says so itself. `supabase/migrations/20260101000400_enforce_rls_text_param.sql:32-47`:

> _"FORCE row level security SENGAJA tidak dipakai: aplikasi terhubung langsung sebagai role owner … owner MELEWATI RLS kecuali FORCE di-set … `enable` tanpa FORCE inert di jalur owner/direct. Jalur upgrade (konkret): buat role DML non-owner khusus aplikasi … arahkan `DATABASE_URL` aplikasi ke role itu, lalu set `force row level security`."_

So BE-001 is not an oversight. It is a **documented, deliberate, incomplete** decision: RLS protects the PostgREST/Realtime/`authenticated` paths, and is inert on the `DATABASE_URL` path that the application actually uses. Anyone reading only `docs/ADR-004` or PRD §5.5 would conclude the opposite.

**Verified mechanically:** `FORCE ROW LEVEL SECURITY` (case-insensitive) appears **0 times** in `packages/db/` and `supabase/`. RLS is enabled for application tables exclusively through the helper `app.enforce_rls(p_table text)` (`…00100:215` → replaced by `…00400:56`), which issues `enable row level security` only.

---

## 2. Inventory

### 2.1 Schema

| Item                              | Reality                                                            | Evidence                                                            |
| --------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Tables declared                   | **35** `pgTable` declarations                                      | `packages/db/src/schema.ts` (981 lines)                             |
| Tables in **no** Drizzle snapshot | **3** — `security_events`, `auth_sessions`, `system_health_checks` | `schema.ts:897,922,940`; `meta/` holds 0000/0002/0004 only (BE-021) |
| Client                            | `postgres(DATABASE_URL)` — the Supabase direct/owner connection    | `packages/db/src/client.ts:30-56`                                   |
| ORM                               | `drizzle-orm@0.45.3`                                               | `package.json`                                                      |
| Secondary client                  | `@supabase/supabase-js` for storage + realtime                     | `packages/db/src/client.ts`                                         |

### 2.2 Two migration sequences, and why order matters

**Sequence A — Drizzle, `packages/db/migrations/`**

| File                                     | In journal?       | Snapshot?            |
| ---------------------------------------- | ----------------- | -------------------- |
| `0000_smiling_hawkeye.sql`               | yes (`idx 0`)     | `0000_snapshot.json` |
| `0001_rls_and_realtime.sql`              | yes (`idx 1`)     | **no**               |
| `0002_grey_mongoose.sql`                 | yes (`idx 2`)     | `0002_snapshot.json` |
| `0003_activity_logs_immutable.sql`       | yes (`idx 3`)     | **no**               |
| `0004_promo_code_case_insensitive.sql`   | yes (`idx 4`)     | `0004_snapshot.json` |
| `0005_owner_promo_code_scope.sql`        | **NO — orphaned** | **no**               |
| `0005_phase_2_owner_rls.sql` (untracked) | yes (`idx 5`)     | **no**               |

`meta/_journal.json` has exactly 6 entries; two files share the `0005_` prefix; one of them is unreachable (BE-020).

**Sequence B — Supabase, `supabase/migrations/`** — 8 timestamped files, `20260101000000` … `20260101000700`.

**The required order is not the file order.** Per the prior audit and implemented by `scripts/migrate-ordered.mjs`: Supabase `00000–00400` → Drizzle `0000–0004` → Supabase `00500–00700`, because `00500` needs Drizzle's `users` and `00600` needs Drizzle's `broadcasts`. A bare `supabase db reset` or `supabase db push` gets this wrong and leaves RLS policies referencing tables that do not exist yet.

### 2.3 RLS inventory

| Property                                | Value                                                                                                                                                                                                                                               | Evidence                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Tables with RLS enabled                 | 31 in the `app.enforce_rls` loop                                                                                                                                                                                                                    | `0001_rls_and_realtime.sql:9-20` |
| Policy creation sites                   | 32 explicit `create policy` statements repo-wide, **plus** loop-generated ones                                                                                                                                                                      | see below                        |
| Loop-generated tenant policies          | 18 tables × `snapbox_%I_tenant`                                                                                                                                                                                                                     | `0001:33-47`                     |
| Loop-generated parent policies          | 4 relationships × `snapbox_%I_parent` (`frame_versions`→`frames`, `booth_frames`→`booths`, `kiosk_theme_versions`→`kiosk_themes`, `paper_logs`→`booths`)                                                                                            | `0001:61-72`                     |
| Loop-generated CEO policies             | `snapbox_%I_ceo` over a third table list                                                                                                                                                                                                            | `0001:129-140`                   |
| Standalone app policies                 | `snapbox_tenants_scope`, `snapbox_users_scope`, `snapbox_notifications_scope`, `snapbox_platform_settings_ceo`                                                                                                                                      | `0001:49-53`, `0002`             |
| Phase-2 owner policies                  | 14 explicit (`devices`, `pairing_tokens`, `packages`, `kiosk_themes`, `sessions`, `transactions`, `download_tokens`, `promo_redemptions`, `promos`, `booth_frames`, `frame_versions`, `kiosk_theme_versions`, `paper_logs`, `camera_compatibility`) | `0005_phase_2_owner_rls.sql`     |
| Realtime policies                       | 3 in `…00300`, incl. the deferred `booth:{id}` select with the `split_part` UUID round-trip; **no browser INSERT policy**                                                                                                                           | `…00300`, `0001:144-166`         |
| Storage policies                        | 2 in `…00200` (select + insert, bucket-scoped, tenant-prefix-scoped)                                                                                                                                                                                | `…00200`                         |
| **Effective policy count**              | **> 40**                                                                                                                                                                                                                                            | —                                |
| `FORCE ROW LEVEL SECURITY`              | **0 occurrences**                                                                                                                                                                                                                                   | repo-wide search                 |
| Fail-open branch in the CEO gate        | 1                                                                                                                                                                                                                                                   | `…00100:166-168` (BE-022)        |
| Tables with RLS revoked from every role | `device_calibrations`                                                                                                                                                                                                                               | `0001:121`, `0005:173` (BE-029)  |

**Quality note, recorded as a positive:** the policy text itself is careful. Nullable `tenant_id` deliberately excludes platform rows (`0001:28`); child tables inherit scope from the parent FK rather than duplicating a tenant column (`0001:55-56`); the `authenticated` role gets `grant usage` + DML, not more (`0001:25-26`); the realtime booth policy round-trips a UUID through the topic string correctly; and `app.is_ceo()` requires a real `users` row, not just a claim (`…00100:152-164`).

---

## 3. The tenant isolation model as built

| Layer             | Mechanism                                                                                                                              | Executes today?                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1. Session        | HMAC-signed `snapbox_session`; `tenantId`/`role` read from the **DB row**, never the client claim                                      | **yes**                                                                                                               |
| 2. Action gate    | `requireCeo()` / `requireOwnerTenant()` — a fresh DB read of `users` + `tenants`, re-checking `status='ACTIVE' AND deleted_at IS NULL` | **yes** (all 55 actions)                                                                                              |
| 3. Predicate      | every query carries `tenant_id = session.tenantId`; no client-supplied `tenantId` exists                                               | **yes**                                                                                                               |
| 4. Response shape | cross-tenant reads return **404, not 403**                                                                                             | **yes**                                                                                                               |
| 5. Database RLS   | > 40 policies over `app.current_tenant_id()` / `app.is_ceo()`                                                                          | **NO on the `DATABASE_URL` path** (owner role bypasses RLS) — but **YES** on PostgREST/Realtime/`authenticated` paths |

Layers 1-4 are uniform and correct. Layer 5 exists, is well written, and does not run for the application's own queries. That is the whole of BE-001, and it is also why BE-001 is survivable rather than catastrophic **today**.

---

## 4. Findings

### BE-001 — P0 — RLS is enabled but not `FORCE`d, and the app connects as the table owner

**Finding.** P0. The documented second layer of tenant defence does not execute on the connection the application uses.

**Evidence.**

- `packages/db/src/client.ts:30-56` — `postgres(DATABASE_URL)`, the Supabase direct/owner connection, not the anon key.
- **0 occurrences** of `FORCE ROW LEVEL SECURITY` in `packages/db/` or `supabase/`. RLS is enabled only via `app.enforce_rls(p_table text)` (`…00100:215`, replaced by `…00400:56`), which issues `enable row level security` alone.
- `…00400:32-47` documents the limitation and the upgrade path in the migration's own comments, including: _"owner MELEWATI RLS kecuali FORCE di-set"_ and _"`enable` tanpa FORCE inert di jalur owner/direct."_
- The prior audit (`docs/AUDIT-FASE-0-1-…:§6`) records the same state (AUDIT-LIM-04: historical, unverified here).

**Actual.** > 40 well-formed policies are inert for every application query.

**Expected.** PRD §5.5: RLS as a second layer. ADR-004 treats it as active.

**Impact.** 100% of tenant isolation rests on layers 1-4. Those are good (BE-004), but a single missed predicate is a cross-tenant leak with **no database backstop**, and nothing in the code or the test suite can catch it.

**Severity.** P0.

**Affected files.** `packages/db/src/client.ts:30-56`, `supabase/migrations/20260101000400_enforce_rls_text_param.sql:32-47`, `packages/db/migrations/0001_rls_and_realtime.sql`, `0005_phase_2_owner_rls.sql`, `supabase/migrations/20260101000100_rls_foundation.sql`.

**Affected routes.** All authenticated routes; every query the application issues.

**Related API.** All 9 route handlers, all 55 server actions, all 35 tables. Functions: `app.current_tenant_id()`, `app.is_ceo()`, `app.enforce_rls()`.

**Status.** CONFIRMED (static). Live RLS behaviour UNVERIFIED (AUDIT-LIM-02).

**Recommended next action (direction only).** Follow the upgrade path the migration itself already spells out: create a dedicated non-owner DML role, point the application `DATABASE_URL` at it, then `FORCE ROW LEVEL SECURITY` **after** every path is tested. Resolve open question 4 in `00_EXECUTIVE_SUMMARY.md` §9 first — it is a deployment-topology decision, not a code change.

---

### BE-004 — P4 POSITIVE — Application-layer tenant isolation is genuinely strong

**Finding.** P4 POSITIVE. The layer that actually enforces isolation is uniform and re-verified on every request.

**Evidence.**

- Every mutation re-derives `tenantId` from the session and puts it in the SQL predicate. No client-supplied `tenant_id` anywhere (grep for `parsed.data.tenantId` → all session-derived).
- `requireOwnerTenant()` (`outlet-server.ts:7-36`) re-verifies the HMAC cookie **and** re-reads the `users` row **and** re-checks `tenants.status = 'ACTIVE' AND deleted_at IS NULL` on every page and action.
- Cross-tenant reads return **404, not 403** — PRD §5.5 satisfied (`pair-session/route.ts:88-89`, `tenant-server.ts:100-117`).

**Actual.** Tenant scoping is enforced in the application layer, consistently, on every traced path.

**Expected.** Exactly this.

**Impact.** None. **This is what makes BE-001 survivable.**

**Severity.** P4 (observation).

**Affected files.** `lib/owner-dashboard/outlet-server.ts:7-36`, all 13 Owner `actions.ts`, all Owner `*-server.ts` loaders.

**Affected routes.** All `/owner-dashboard/**`.

**Related API.** All 41 Owner server actions; `requireOwnerTenant()`.

**Status.** POSITIVE — CONFIRMED (static).

**Recommended next action (direction only).** Preserve it verbatim through the BE-001 change — switching connection roles is the single highest-risk edit in this audit, and this layer is the only thing standing between a mistake and a cross-tenant leak. The one known gap is `loadOwnerKioskTheme`, which has no `tenantId` predicate (FE-013).

---

### BE-015 — P2 — Migration integrity: two `0005_*` files, journal drift, missing snapshots

**Finding.** P2. The database's history cannot be reconstructed from the repository.

**Evidence.**

- `packages/db/migrations/` holds 7 files; `meta/_journal.json` has 6 entries. `0005_owner_promo_code_scope.sql` is **not** among them (see BE-020). `0005_phase_2_owner_rls.sql` is untracked but journaled.
- `meta/` holds snapshots for **0000, 0002, 0004 only** — 0001, 0003 and both 0005s have none.
- Two files share the `0005_` prefix, so lexical and journal order disagree.
- The prior audit documents the required cross-sequence interleave (Supabase 0–00400 → Drizzle 0000–0004 → Supabase 00500–00700) and `scripts/migrate-ordered.mjs` implements it — but that script is not invoked by `supabase db push`, and a bare push on a fresh environment applies only the Supabase files, leaving every application table absent while RLS policies reference them (BE-033).

**Actual.** Colliding prefixes, four snapshot-less migrations, an orphaned file, and an ordering that only one script knows.

**Expected.** A fresh install and an upgrade both derivable from the repository, with every file journaled and snapshotted.

**Impact.** A new environment can be created whose schema does not match the code, and no check detects it.

**Severity.** P2.

**Affected files.** `packages/db/migrations/**`, `packages/db/migrations/meta/_journal.json`, `supabase/migrations/**`, `scripts/migrate-ordered.mjs`.

**Affected routes.** None directly; every deployment depends on it.

**Related API.** `pnpm --filter @snapbox/db generate|migrate`, `supabase db push`, `scripts/migrate-ordered.mjs`.

**Status.** CONFIRMED (static). What is applied to any live environment is UNVERIFIED (AUDIT-LIM-02, AUDIT-LIM-04).

**Recommended next action (direction only).** Reconcile journal and snapshots, rename the colliding prefixes, and document the two supported paths (fresh install, upgrade) as first-class procedures.

---

### BE-020 — P0 — `0005_owner_promo_code_scope.sql` is orphaned and will never be applied

**Finding.** P0. A migration that exists on disk and cannot be executed by the tool that reads migrations.

**Evidence.**

- `packages/db/migrations/0005_owner_promo_code_scope.sql` exists; `meta/_journal.json` contains only `0005_phase_2_owner_rls` (entry `idx 5`). Drizzle's migrator is journal-driven.
- Its only novel artifact is `CREATE INDEX IF NOT EXISTS promo_redemptions_tenant_customer_idx ON public.promo_redemptions (tenant_id, promo_id, customer_email)` (`:12-13`).
- Lines 2-10 are no-ops against `0004`: it drops `promos_code_lower_idx`, which `0004:51` already dropped, then re-creates the same two indexes `0004:53-54` creates.

**Actual.** The index the redemption path depends on does not exist in any database built from this repository.

**Expected.** Every file in `migrations/` has a journal entry and is applied in order.

**Impact.** `promos/actions.ts:165-169` runs `count(*) where promo_id=? and customer_email=?` per redemption against a table that grows with every customer transaction — a sequential scan, permanently. Plus silent divergence between claimed and deployed schema. `migrate-ordered.mjs` will not notice, because it checks Supabase file counts, not Drizzle journal parity.

**Severity.** P0 — one journal entry fixes it; a `migrate --dry-run` in CI would have caught it.

**Affected files.** `packages/db/migrations/0005_owner_promo_code_scope.sql`, `meta/_journal.json`, `promos/actions.ts:165-169`.

**Affected routes.** `/owner-dashboard/promos` (only once `redeemPromo` gains a caller — FE-013).

**Related API.** `redeemPromo`. Table: `promo_redemptions`.

**Status.** CONFIRMED (static). Live DB state UNVERIFIED (AUDIT-LIM-02).

**Recommended next action (direction only).** Add the journal entry or drop the file, and assert journal/file parity in CI.

---

### BE-021 — P1 — Three tables in `schema.ts`, in no snapshot ⇒ the next `generate` emits forbidden DDL

**Finding.** P1. The ORM schema, the snapshots, and the applied migrations disagree; a routine command will silently break two internal endpoints.

**Evidence.**

- `security_events`, `auth_sessions`, `system_health_checks` are declared at `packages/db/src/schema.ts:897,922,940`. `meta/` holds only 0000/0002/0004, and only `platform_settings` matches. `0004_snapshot.json` predates these three.
- `supabase/…00500:10-13` forbids exactly this: _"tidak boleh ada migration Drizzle yang membuat tabel ini lagi: dua DDL divergen dengan `IF NOT EXISTS` akan membuat yang dijalankan kedua menjadi no-op senyap, sehingga kolom DB bisa tidak cocok dengan query runtime."_

**Actual.** Three tables exist in the ORM schema and in a Supabase migration, and in no snapshot.

**Expected.** Schema, snapshots, and migrations describe one database.

**Impact.** The next `pnpm --filter @snapbox/db generate` emits `CREATE TABLE` for all three; `00500:26,65,91` then no-ops via `IF NOT EXISTS`, leaving possible column drift. `recordWafEvent` / `recordHealthHeartbeat` / `recordAuthSession` start throwing on column mismatch; `api/internal/telemetry/waf/route.ts:70-73` returns 500 — **WAF ingest fails, and the WAF is the compensating control for several P2 abuse findings** (BE-010, BE-028).

**Severity.** P1.

**Affected files.** `packages/db/src/schema.ts:897,922,940`, `meta/0004_snapshot.json`, `supabase/migrations/20260101000500_system_health_security.sql:10-13,26,65,91`, `app/api/internal/telemetry/waf/route.ts:70-73`, `api/internal/telemetry/heartbeat/route.ts`.

**Affected routes.** `/api/internal/telemetry/waf`, `/api/internal/telemetry/heartbeat`, `/ceo-dashboard/system-health`, `/ceo-dashboard/security`.

**Related API.** `recordWafEvent`, `recordHealthHeartbeat`, `recordAuthSession`, `revokeAuthSession`, `revokeAuthSessionsForUser`. Tables: `security_events`, `auth_sessions`, `system_health_checks`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Restore snapshot parity **before** anyone runs `generate`, or remove those three tables from the Drizzle schema since `…00500` owns their DDL. Then add a CI assertion that `meta/` snapshot count matches the journal count.

---

### BE-022 — P2 — `app.is_ceo()` fails open when `public.users` is unreadable

**Finding.** P2. One branch inside a security function returns the permissive answer.

**Evidence.** `supabase/…00100:166-168`: `if to_regclass('public.users') is null then return true; end if;`. The claim check at `:152-164` is otherwise sound — layer 2 requires a real `users` row with `firebase_uid = claims->>'sub' AND role='CEO' AND NOT disabled AND deleted_at IS NULL`, so claim forgery alone is insufficient (**a genuinely good two-layer gate**). The authors already fixed an analogous NULL-fail-open at `:146-151`; this branch survived.

**Actual.** If `users` is missing, renamed, or misconfigured in `search_path`, **any** token carrying `app_role='CEO'` (or the `app.role` GUC) becomes CEO.

**Expected.** Unreadable ⇒ deny.

**Impact.** Narrow trigger, catastrophic outcome: tenant provisioning, plan pricing, global settings, global promos, broadcasts. Note the interaction with BE-001 — this function is currently reached only from the non-owner paths, which is the one reason the blast radius is smaller than it looks.

**Severity.** P2.

**Affected files.** `supabase/migrations/20260101000100_rls_foundation.sql:146-168`.

**Affected routes.** All `/ceo-dashboard/**` data paths; every RLS policy that calls `app.is_ceo()`.

**Related API.** `app.is_ceo()`. Tables: `tenants`, `users`, `platform_settings`, `promos`, `broadcasts`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Return `false` when the table cannot be read. Add a test that exercises the missing-`users` branch.

---

### BE-023 — P2 — `promo_redemptions.transactionId` is a client-supplied UUID with no FK

**Finding.** P2. A client-provided identifier is stored as a foreign reference with nothing validating it.

**Evidence.** `promos/actions.ts:176-182` inserts with `transactionId: p.data.transactionId ?? null`. `schema.ts:526` declares `tenantId NOT NULL` with **no** `.references()`; `transactionId` has **no FK**. `0005_phase_2_owner_rls.sql:107` cross-checks the transaction's tenant — but the app connects as the table owner (BE-001), so that policy never runs.

**Actual.** A redemption row can reference any transaction id in the database.

**Expected.** A composite FK, or a server-derived transaction id.

**Impact.** A tenant can attach a redemption record to another tenant's transaction id. Not exploitable for money today (`redeemPromo` has zero callers) — but it is a live storage-layer hole that survives the moment the kiosk ships.

**Severity.** P2. Category: `POTENTIAL IDOR` / `TENANT SCOPING RISK`.

**Affected files.** `promos/actions.ts:176-182`, `packages/db/src/schema.ts:526`, `0005_phase_2_owner_rls.sql:107`.

**Affected routes.** `/owner-dashboard/promos` (when `redeemPromo` gains a caller).

**Related API.** `redeemPromo`. Tables: `promo_redemptions`, `transactions`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Stop accepting a client-supplied `transactionId`, or add a composite FK. The RLS cross-check is **not** a substitute while BE-001 stands — that is the exact trap this finding sits in.

---

### BE-027 — P2 — Index gaps that will bite at volume

**Finding.** P2. No security impact; query cost degrades as data accumulates.

**Evidence.**

- **Zero indexes at all** (no second `pgTable` argument): `frame_versions`, `templates`, `packages`, `kiosk_themes`, `kiosk_theme_versions`, `broadcasts`, `webhook_failures`.
- `templates` and `packages` are `NOT NULL`-scoped tenant tables read on **every** Owner dashboard load via `eq(x.tenantId, tenantId)` — a full scan each, and the surprise of the set.
- **`tenant_id` not indexed:** `pairing_tokens`, `promo_redemptions`, `sessions`, `download_tokens`, `device_logs`, `paper_logs`, `booth_frames`.
- `webhook_failures` has no index on `provider`, `resolved`, or `created_at`, so the documented retention purge is sequential. `broadcasts.target_tenant_ids` is unindexed jsonb scanned per row by `jsonb_exists` (`supabase/…00600:33`).

**Actual.** 7 tables with no indexes; 7 more with no `tenant_id` index.

**Expected.** An index on the tenant key of every tenant-scoped table, and at least one index on every table read or purged on a schedule.

**Impact.** `templates` and `packages` are scanned on every Owner dashboard load; the retention purge is sequential; the redemption count is sequential (compounded by BE-020). PRD §8.5 performance targets are **unmeasured** and no claim is made here (AUDIT-LIM-01).

**Severity.** P2.

**Affected files.** `packages/db/src/schema.ts` (the 14 tables named), `supabase/migrations/20260101000600_broadcast_tenant_scope.sql:33`.

**Affected routes.** All `/owner-dashboard/**` (dashboard load), `/ceo-dashboard/system-health` (purge).

**Related API.** `listTemplates`, `listPackages`, `recordHealthHeartbeat`, `redeemPromo`.

**Status.** CONFIRMED (static) for the absence of indexes; actual latency UNVERIFIED (AUDIT-LIM-01).

**Recommended next action (direction only).** Add `tenant_id` indexes on the 7 uncovered tables, then a first index set for the 7 zero-index tables, `templates` and `packages` first. Measure before and after — see `10_RECOMMENDED_REPAIR_ORDER.md` §8B item 34 on why no performance claim can be made yet.

---

### BE-029 — P2/P3 — Foreign-key and deletion-integrity gaps

**Finding.** P2 for the FK/tenant-key gaps, P3 for the two shape issues. Deleting a tenant leaves orphans.

**Evidence.**

- **`tenant_id` declared but with no FK to `tenants`:** `users` (`:92`), `promo_redemptions` (`:526`), `sessions` (`:812`), `download_tokens` (`:860`), `activity_logs` (`:636`), `device_logs` (`:755`).
- **Other missing FKs:** `sessions.booth_id`, `sessions.device_id`; `device_logs.booth_id`; `promo_redemptions.transaction_id`; `pairing_tokens.created_by_user_id`; `activity_logs.booth_id/device_id`.
- **Impact:** `ON DELETE CASCADE FROM tenants` (declared on 15 other tables) does **not** clean these, so deleting a tenant orphans `activity_logs` (5-year retention), `sessions`, `download_tokens`, `promo_redemptions`.
- `deleteTemplate` (`templates/actions.ts:62-71`) is a **hard `DELETE`**, while `deletePackage` and both `deletePromo` variants soft-delete via `isActive` — and `templates.isActive` exists (`schema.ts:418`), so the column is there and unused.
- `auth_sessions` has **no `tenant_id`** (`schema.ts:922`) — documented as deliberate (`supabase/…00500:119-123`), but it means "active sessions for tenant X" is a two-hop join and there is **no bulk tenant-level session kill**. This is the same capability BE-007 needs.
- `device_calibrations` (`:330-345`) is keyed only on `(deviceFingerprint, cameraId)` with RLS **revoked from every role** (`0001:121`, `0005:173`); isolation rests entirely on the global uniqueness of `booths.device_fingerprint` — a real but **undocumented** invariant.

**Actual.** Six tenant keys with no referential integrity; inconsistent delete semantics across three sibling features; one load-bearing uniqueness invariant that exists only in a comment.

**Expected.** Every `tenant_id` references `tenants`; delete semantics consistent per feature; invariants documented where they are load-bearing.

**Impact.** Tenant deletion silently orphans four tables, one with a 5-year retention commitment. A revoked or deleted device can keep operating if nothing else checks. If `booths.device_fingerprint` uniqueness is ever relaxed, `device_calibrations` becomes globally readable with no RLS at all.

**Severity.** P2 for the FK/tenant-key gaps; P3 for `deleteTemplate` and the `auth_sessions` shape.

**Affected files.** `packages/db/src/schema.ts:92,330-345,418,526,636,755,812,860,922`, `templates/actions.ts:62-71`, `packages/db/migrations/0001_rls_and_realtime.sql:121`, `0005_phase_2_owner_rls.sql:173`, `supabase/migrations/20260101000500_system_health_security.sql:119-123`.

**Affected routes.** `/ceo-dashboard/tenants/[id]` (delete tenant), `/owner-dashboard/templates`, `/owner-dashboard/devices`.

**Related API.** `deleteTenant`, `deleteTemplate`, `deletePackage`, `deletePromo`. Tables: `tenants`, `users`, `sessions`, `activity_logs`, `device_logs`, `download_tokens`, `promo_redemptions`, `auth_sessions`, `device_calibrations`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Add the missing FKs so cascade actually cleans up; align `deleteTemplate` with the soft-delete convention; document the `booths.device_fingerprint` uniqueness invariant as an enforced constraint, not a comment; and decide whether `auth_sessions` needs a tenant key for the bulk kill that BE-007 requires.

---

## 5. What is correct here — do not weaken

| Control                                           | Evidence                                                                                                                                                                                                                                          | Note                                                                                                                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layered tenant predicates                         | every query, session-derived only                                                                                                                                                                                                                 | BE-004                                                                                                                                                                                               |
| 404 not 403 on cross-tenant                       | `pair-session/route.ts:88-89`, `tenant-server.ts:100-117`                                                                                                                                                                                         | Avoids leaking existence                                                                                                                                                                             |
| `requireOwnerTenant` re-reads the tenant row      | `outlet-server.ts:7-36`, incl. `status='ACTIVE' AND deleted_at IS NULL`                                                                                                                                                                           | Fresh, not cached                                                                                                                                                                                    |
| Policy text quality                               | nullable-`tenant_id` platform exclusion (`0001:28`); parent-FK inheritance instead of duplicated columns (`0001:55-56`); least-privilege grants (`0001:25-26`); 64-bit `split_part` UUID round-trip for the deferred booth topic (`0001:144-166`) | The policies are the asset; the role is the gap                                                                                                                                                      |
| `app.is_ceo()` requires a real `users` row        | `…00100:152-164`                                                                                                                                                                                                                                  | Two-layer, unforgeable by claim alone                                                                                                                                                                |
| The limitation is **documented in the migration** | `…00400:32-47`                                                                                                                                                                                                                                    | Including the concrete upgrade path — this should be promoted into an ADR, not left in a comment                                                                                                     |
| `app.enforce_rls` is a single chokepoint          | `…00100:215` → `…00400:56`                                                                                                                                                                                                                        | No table can be missed; the helper is `security invoker` with `search_path = pg_catalog, pg_temp` and its EXECUTE is revoked from `public`/`anon`/`authenticated` and granted only to `service_role` |
| No browser INSERT policy on `realtime.messages`   | `…00300`                                                                                                                                                                                                                                          | Publish is `service_role`-only — correct                                                                                                                                                             |
| Storage policies bucket- and tenant-prefix-scoped | `…00200`                                                                                                                                                                                                                                          | select + insert only, no delete policy for browsers                                                                                                                                                  |
| Cross-sequence order is implemented               | `scripts/migrate-ordered.mjs`                                                                                                                                                                                                                     | Remote allowlist, `mkdtemp`, `rm -rf` in `finally` — brittle only in its exact-count assertion (BE-033)                                                                                              |

---

## 6. What a runtime pass would need to test

1. Connect as the application's real `DATABASE_URL` role and run a cross-tenant `SELECT`; confirm whether policies fire (predicted: they do not — BE-001).
2. Repeat the same read through PostgREST/`authenticated`; confirm policies **do** fire there (predicted: yes). The difference between these two results is the whole finding.
3. Attempt the BE-023 cross-tenant redemption attachment directly in SQL; confirm the RLS cross-check at `0005:107` does not run on the owner path.
4. Delete a tenant and count orphans in `activity_logs`, `sessions`, `download_tokens`, `promo_redemptions` (predicted: all four retain rows — BE-029).
5. `EXPLAIN` the Owner dashboard load and confirm `templates`/`packages` are sequential scans (predicted: yes — BE-027).
6. Inspect `\d promo_redemptions` in a database built from the repo and confirm the `tenant_id` index is absent (predicted: yes — BE-020).
7. Rename or revoke USAGE on `public.users`, call `app.is_ceo()`, and confirm it returns `true` (predicted: yes — BE-022).

---

## Cross-references

- Canonical statements: `05_BACKEND_API_AUDIT.md` (BE-001, BE-004, BE-015, BE-020…BE-023, BE-027, BE-029), `05_BACKEND_API_AUDIT.md` §BE-004 and §BE-030 for the positive layers.
- Attacker-reachable ordering: `06_SECURITY_AUDIT.md` §2.
- Realtime policies on the same database: `07_REALTIME_AUDIT.md` §2.5.
- Migration-history contradictions: `05_BACKEND_API_AUDIT.md` BE-033.
- Ordered remediation direction: `10_RECOMMENDED_REPAIR_ORDER.md` §8B items P0-a, P0-b, P1-a, and 8-10, 14-22.
