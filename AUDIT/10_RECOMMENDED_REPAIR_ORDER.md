# 10 — Recommended Repair Order

**Source:** `.kilo/plans/1790436768946-snapbox-forensic-audit.md` §8 (repair queues)
**Status of this document:** **direction only.** No fix, refactor, migration, dependency change, or UI change was made, and none is prescribed at code level. Every item says _what decision to make_ or _what to reconcile_, never _which snippet to paste_.
**Structure:** two queues that are **never merged** — §1 frontend (§8A, 52 items) and §2 backend/API (§8B, 35 items + 3 gate items). Do not interleave them into a single backlog; they have different owners, different risk profiles, and different verification methods.

---

## How to use this document

| Field             | Meaning                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------ |
| **ID**            | Stable reference. `F-##` for the frontend queue, `B-##` for the backend queue.             |
| **Direction**     | What to decide or reconcile. Not an implementation.                                        |
| **Blocked by**    | Items that must land first, or an open question in `00_EXECUTIVE_SUMMARY.md` §9.           |
| **Verifies with** | How a reader can tell it is done — a test, a build, an inspection. Never "it looks right". |

**Severity reference:** P0 blocker · P1 critical · P2 major · P3 minor · P4 observation.

**Audit limitation carried into this document (AUDIT-LIM-01):** no build, typecheck, lint, test, rendered UI, bundle-size, or network inspection was possible. So **no item here may be closed on the strength of this audit alone** — each needs the runtime pass described in `00_EXECUTIVE_SUMMARY.md` §11.

---

## 0. Before any repair: three decisions that unblock the most work

These are not code. They are choices only the owner can make, and four P0/P1 clusters are waiting on them.

| Question                                                                                                                                                                   | Blocks                                                                                                           | Reference                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **PC-01 — the palette.** PRD yellow/violet/pink, ADR-002 blue, or a third decision?                                                                                        | F-01 and every visual item in the frontend queue. The marketing half and the dashboard half are currently split. | `09` §2 PC-01, `01` FE-001 |
| **BE-001 — the runtime DB role.** Is a dedicated non-owner DML role acceptable in this deployment (Supabase pooler + Vercel) so `FORCE ROW LEVEL SECURITY` can be enabled? | B-08, and the confidence of every tenant-isolation claim in this audit.                                          | `08` BE-001, `00` §9 Q4    |
| **BE-005 — granular RBAC.** Wire the 75-permission model, or delete it and accept role-level granularity?                                                                  | Whether `/staff-dashboard` may be built at all. **Adding it today hands Staff OWNER-class destructive access.**  | `06` BE-005, `00` §9 Q3    |

A fourth question gates a large feature rather than a fix: **FE-006 — demo vs real** for `finance` / `analytics` / `reports` / `customers` and the dashboard root (`00` §9 Q5).

---

## 1. FRONTEND QUEUE (§8A — dependency-ordered, 52 items)

### 1.1 Foundation

| ID       | Direction                                                                                                                                                                                                                                                                                | Blocked by        | Verifies with                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| **F-01** | Resolve PC-01 (palette) and PC-02 (pairing code). Every visual and pairing decision below depends on these.                                                                                                                                                                              | owner decision    | A superseding ADR + an updated PRD §4                                                                                 |
| **F-02** | Define the complete semantic colour set (`muted-foreground`, `destructive`, `primary`, `sidebar`, a status set, a metric-type scale), then add a **CI guard that fails the build** on any `text-/bg-/border-/ring-` utility naming an undefined colour token. Closes FE-002 permanently. | F-01              | The guard fails on a deliberately-added bad utility, then passes                                                      |
| **F-03** | Add a **second CI guard** that every `className` matching `\.(ceo\|owner\|public\|auth)-[a-z-]+` has a matching CSS rule. Closes the `.ceo-panel` (13×) and `.owner-section/eyebrow/form` (6×) families.                                                                                 | —                 | The guard fails on a deliberately-added undefined class, then passes                                                  |
| **F-04** | Extend `check-token-sync.mjs` beyond the token block to cover the 2 300 hand-written lines, **or** move those lines into an explicit `@layer` with a deliberate precedence over `utilities`.                                                                                             | F-01 (precedence) | The guard's scope is visible in its own output; if layering, the two known collisions are enumerated before and after |
| **F-05** | Re-express `settings-view.tsx` / `support-view.tsx` in the primitive vocabulary, **or** add the three missing `owner-*` rules.                                                                                                                                                           | F-03              | Both views render with a focus ring and a 44px target                                                                 |
| **F-06** | Gate `/gallery` behind non-production or `notFound()`. That one decision also scopes how much of `packages/ui` is required — 41 of 64 primitives serve only that page.                                                                                                                   | —                 | An anonymous request to `/gallery` is refused outside development                                                     |

### 1.2 Layout

| ID       | Direction                                                                                                                                                                     | Blocked by | Verifies with                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------- |
| **F-07** | Add `loading.tsx` + `error.tsx` per dashboard segment and a `not-found.tsx`; wrap data fetches in `<Suspense>` so no route falls through to `global-error.tsx`.               | —          | A deliberately-thrown loader error stays inside the segment          |
| **F-08** | Fix `global-error.tsx`: re-apply the font variables explicitly (it replaces `layout.tsx`), and use the `Button` primitive with `rounded-base` + `shadow-shadow` + `min-h-11`. | —          | A triggered error renders with the app's font and a full-size button |

### 1.3 Design system

| ID       | Direction                                                                                                                                                                                                                                                               | Blocked by | Verifies with                                                             |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------- |
| **F-09** | Converge the two Tailwind vocabularies, the three focus-ring tokens, the 208 arbitrary hexes, the 28 arbitrary shadows, the six hard-shadow offsets, the 3× duplicated `STATUS_CLASS` maps, and the divergent dashed empty states. Introduce **one** status-colour map. | F-01, F-02 | `grep` for arbitrary hex/shadow values in the owner views returns nothing |
| **F-10** | Wire the public brand palette into tokens and start consuming the already-exported `BRAND` object.                                                                                                                                                                      | F-01       | `BRAND` has consumers; changing a brand colour is one edit (PC-14)        |
| **F-11** | Wire every owner view onto `@snapbox/ui` primitives — **or** decide that hand-rolled is the standard and say so. 15 of 21 currently bypass them, and 6 mix both systems on one screen.                                                                                  | F-01       | Each of the 21 views is single-language                                   |
| **F-12** | Replace `font-black` ×3 with the `font-heading` token; align `Alert` `destructive` with ADR-002.                                                                                                                                                                        | F-09       | The three `h1`s match every other heading's weight                        |
| **F-13** | Delete the 63 dead CSS rules (44 `.owner-outlet-*` + 19 `.ceo-*`) or adopt them. Do not leave them.                                                                                                                                                                     | F-03       | A dead-rule check reports zero                                            |
| **F-14** | Fix `themeColor` to match the decided palette.                                                                                                                                                                                                                          | F-01       | The manifest colour matches the shell it opens                            |
| **F-15** | Either implement dark tokens or remove `ThemeToggle`.                                                                                                                                                                                                                   | F-01       | Toggling changes the rendering, or the control does not exist             |
| **F-16** | Consolidate the ~8 duplicate inline-SVG icon sets, **or** promote `lucide-react` to an `apps/web` dependency.                                                                                                                                                           | —          | One icon source per surface                                               |

### 1.4 Auth / role

| ID       | Direction                                                                                                                                                             | Blocked by              | Verifies with                                                            |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------ |
| **F-17** | Add `requireCeo()` to `tenants/[id]` and `tenants/new` — preferably inside the `tenant-server.ts` loaders so the class is closed.                                     | —                       | A non-CEO session receives 404/redirect on both routes                   |
| **F-18** | Fix the `/owner-dashboard/subscription` self-redirect loop: pass `allowInactiveSubscription` from the layout for that path, and delete the now-dead catch-all branch. | —                       | An expired owner reaches the recovery page instead of looping            |
| **F-19** | Decide granular RBAC: wire `hasPermission` into mutations **or** delete the dead module. **Do not add `/staff-dashboard` before this is decided.**                    | owner decision (BE-005) | `hasPermission` has callers, or the module is gone and the docs match    |
| **F-20** | Remove or implement the Staff PIN tab; then add the missing `isSameOrigin` check on `/api/auth/staff-pin`.                                                            | —                       | The login mode either works or is not offered; the CSRF check is present |
| **F-21** | Enforce `auth_sessions.revoked_at` in `requireCeo` / `requireOwnerTenant`, and call `revokeAuthSessionsForUser` from suspend/ban/delete.                              | —                       | A revoked cookie stops authenticating                                    |
| **F-22** | Enforce `tenant_id` in `loadOwnerKioskTheme` (currently none) and confirm `requireOwnerTenant` covers every mutation — it does today.                                 | —                       | Cross-tenant kiosk-theme reads return 404                                |

### 1.5 Data fetching

| ID       | Direction                                                                                                                                                               | Blocked by              | Verifies with                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------- |
| **F-23** | Fix the swapped arguments at `notifications/page.tsx:15`; then decide the tenant-broadcast semantics and delete the nullified OR-groups.                                | —                       | A seeded tenant notification appears; a broadcast can be marked read   |
| **F-24** | Decide demo-vs-real for `finance`, `analytics`, `reports`, `customers`, and the dashboard root. If real, they need a `finance-analytics-server.ts` over `transactions`. | owner decision (FE-006) | Each of the five either queries the DB or is labelled as a demo in nav |
| **F-25** | Stop the INSERT-on-GET in `loadOwnerKioskTheme`.                                                                                                                        | —                       | Loading the page performs no write                                     |
| **F-26** | Replace the 6 `window.location.reload()` calls with `router.refresh()`; sync `useState(props)` after server updates.                                                    | —                       | Lists stay fresh after a mutation without a full reload                |
| **F-27** | Move `getOwnerSettings` out of the `'use server'` module.                                                                                                               | —                       | No read is exported from a `'use server'` file                         |

### 1.6 API contract

| ID       | Direction                                                                                                                                        | Blocked by                                    | Verifies with                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------- |
| **F-28** | Single `boothStatusSchema` import in `machine-contract.ts`.                                                                                      | —                                             | A `DEGRADED` booth renders in the Machine Manager |
| **F-29** | One error envelope: adopt `packages/shared/src/errors.ts` in all 9 route handlers, **or** amend PRD §10.13 to the de-facto shape — but pick one. | —                                             | Every error response has the same shape           |
| **F-30** | Delete or wire the duplicate local enums (`transaction-contract`, `template-contract`, `package-contract`, `health-security-contract`).          | —                                             | One definition per enum                           |
| **F-31** | Fix the `user:{userId}` Firebase-UID contract.                                                                                                   | —                                             | A per-user channel join is authorized             |
| **F-32** | Add `SUPPORT_EMAIL` to the env schema + `.env.example` so the guard can see it.                                                                  | — (already done in the working tree; confirm) | `pnpm check:env-example` covers it                |
| **F-33** | `robots.ts`: block `/ceo-dashboard`, `/owner-dashboard`, `/staff-dashboard` explicitly.                                                          | —                                             | Each prefix appears in `robots.txt`               |

### 1.7 State handling

| ID       | Direction                                                                                                                                                  | Blocked by | Verifies with                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| **F-34** | Standardise a `pending / error / retry / empty` contract across all 21 views; add the missing empty states in `finance-analytics-view` and `reports-view`. | F-07       | Every view has all four states                                        |
| **F-35** | Add confirmation to `regeneratePairingSession` and `publishKioskTheme`.                                                                                    | —          | Both actions prompt first                                             |
| **F-36** | Surface the computed `canConfigure` / `canUseBackup`; add a saved-config list and a deactivate path.                                                       | —          | Entitlement is visible before the click, and a config can be disabled |
| **F-37** | Add promo edit UI, `quotaTotal` / `quotaPerCustomer` inputs, and relabel "Hapus" as "Nonaktifkan".                                                         | —          | The label matches the behaviour                                       |
| **F-38** | Implement or delete `updatePromo` / `batchGenerate` / `redeemPromo`.                                                                                       | —          | No exported action has zero callers, or they are gone                 |

### 1.8 Feature UI

| ID       | Direction                                                                                                                                                    | Blocked by          | Verifies with                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------ |
| **F-39** | Link `/login` from the public header, footer, and mobile menu.                                                                                               | —                   | An anonymous visitor can reach a working login               |
| **F-40** | Build the notification bell: unread count + 10-item dropdown + realtime, wired to a working `/notifications`.                                                | F-23                | A new notification increments the badge without a page visit |
| **F-41** | Make `outlets` show inactive rows: pass `includeInactive` through, or drop the dead filter.                                                                  | —                   | A deactivated outlet can be reactivated                      |
| **F-42** | Make `outlet-detail-view` interactive.                                                                                                                       | —                   | An edit on the detail page persists                          |
| **F-43** | Emit a pairing code exactly once per user action; delete the duplicate `POST` and the `manualCode` dead branch — **or** implement the manual code per PC-02. | F-01 (PC-02)        | One user action mints one token                              |
| **F-44** | Add the six missing Device Console routes, **or** state explicitly that they are Fase 3 and remove them from PRD §3.                                         | PC-09               | Either the routes exist or the PRD does not list them        |
| **F-45** | Fill or remove the four content-empty public sections (`/harga` comparison + add-on, `/kamera` registry, `/unduh-aplikasi` non-existent route).              | PC-06 for `/kamera` | No section renders as a structurally-empty box               |

### 1.9 Realtime

| ID       | Direction                                                                                                                                                                                                                      | Blocked by | Verifies with                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------ |
| **F-46** | Fix the false "Realtime aktif" indicator: treat an errored `phx_reply` as a failure; make `joined` per-topic; add backoff + jitter + cap; add `event_id` dedup and a `version` check (adopt the existing `EventDeduplicator`). | —          | A rejected join shows a failed state       |
| **F-47** | Publish `DEVICE_REVOKED`, `BOOTH_*`, `CONFIG_UPDATED`, `PAYMENT_*`; implement heartbeats.                                                                                                                                      | B-21…B-24  | A real revoke pushes to the device         |
| **F-48** | Route `broadcast.created` through `publishRealtimeEvent` so it passes `realtimeEventSchema`.                                                                                                                                   | —          | The published name is in `REALTIME_EVENTS` |

### 1.10 Responsive

| ID       | Direction                                                                                                                                                                                                                                                                 | Blocked by | Verifies with                                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **F-49** | Add an `overflow-x: auto` rule to `.ceo-table-wrap` — the fix already exists unused as `.owner-outlet-table-scroll`. Collapse `.ceo-plans`, `.ceo-promo-grid` and the three `kiosk-theme` `sm:grid-cols-3` blocks below 640px. Remove the duplicate 768-1023px hamburger. | —          | **Then validate at 375/390/768/1024/1280/1440/1920 — this is the first item in the whole audit that requires runtime (AUDIT-LIM-01)** |

### 1.11 Accessibility

| ID       | Direction                                                                                                                                                                                                                                                                                                                                                           | Blocked by | Verifies with                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------- |
| **F-50** | Add a `.owner-shell` focus-visible scrim to match the three that exist. Add skip links to `#owner-main` / `#ceo-main`. Integrate `axe-core`. Fix the unverified `outline-violet-600` ring and **compute** the four flagged contrast ratios. Move focus into the account menu. Drop the empty always-present `role="status"`. Fix the two `<h1>`s in `reports-view`. | —          | axe-core runs in CI; contrast values are measured, not estimated |

### 1.12 Polish

| ID       | Direction                                                                                                                                                                              | Blocked by | Verifies with                                     |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------- |
| **F-51** | Delete the four committed merge artifacts (`.orig`/`.rej`) and decide whether `apps/desktop/dist/**` belongs in the tree.                                                              | —          | `git status` is clean of residue                  |
| **F-52** | Fix the stale `getSession()` comment and the "kunci API master" nav copy; supersede ADR-002 (gallery location, border width) and ADR-004; move the Fase 2 status block out of the PRD. | F-01       | Every ADR is either true or explicitly superseded |

---

## 2. BACKEND / API QUEUE (§8B — dependency-ordered, 3 gate items + 35 items)

### 2.1 Do these three first

They are cheap, and they gate the confidence of everything below.

| ID             | Item                                                                                                              | Why first                                                                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B-00a (P0)** | Journal entry for `0005_owner_promo_code_scope.sql` (BE-020)                                                      | One line. Today the index silently does not exist and the redemption path is a sequential scan                                                                                     |
| **B-00b (P0)** | Decide the runtime DB role; move `DATABASE_URL` to a non-owner DML role; then `FORCE ROW LEVEL SECURITY` (BE-001) | The only change that turns the ~40 RLS policies from dead code into a real second layer. Until it lands, every future predicate mistake is a cross-tenant leak with no DB backstop |
| **B-00c (P1)** | Snapshot parity before the next `drizzle-kit generate` (BE-021)                                                   | The next generate will emit DDL that `…00500` explicitly forbids, and `IF NOT EXISTS` will turn it into a silent no-op with possible column drift — taking WAF ingest down with it |

### 2.2 Authentication

| ID       | Direction                                                                                                                                                                                                                                                                      | Blocked by | Verifies with                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------- |
| **B-01** | Enforce `auth_sessions.revoked_at` in the Node-side callers of `verifySession`; call `revokeAuthSessionsForUser` on suspend/ban/delete.                                                                                                                                        | —          | A revoked session stops authenticating                                                                |
| **B-02** | Adopt a `kid` prefix on the session cookie so `SESSION_COOKIE_SECRET` rotation is non-breaking (today a rolling deploy causes a `/login` ↔ dashboard loop, `session.ts:108-113`).                                                                                              | —          | A rolling deploy does not sign users out                                                              |
| **B-03** | Set `secure: true` outside local dev (preview/staging currently serves the cookie over HTTP).                                                                                                                                                                                  | —          | The `Set-Cookie` header carries `Secure` in preview                                                   |
| **B-04** | **Confirm whether `app_role` claims are actually planted for OWNER/CEO.** `setUserClaims` has exactly one call site and it is staff-only (`staff/actions.ts:70`). If they are not, `CLAIMS_STALE` (`authorization.ts:258`) may reject **every** OWNER/CEO login in production. | live data  | One real OWNER login succeeds in production. **Treat as a potential production outage until checked** |

### 2.3 Authorization

| ID       | Direction                                                                               | Blocked by              | Verifies with                                |
| -------- | --------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------- |
| **B-05** | Add `requireCeo()` to the `tenant-server.ts` loaders.                                   | —                       | A non-CEO session gets 404 on both PII pages |
| **B-06** | Wire `hasPermission` into every mutation, **or** delete the granular RBAC module.       | owner decision (BE-005) | The module has callers, or it is gone        |
| **B-07** | Decide Owner subscription self-redirect behaviour and gate the exemption at the layout. | F-18                    | An expired owner is not redirected to itself |

### 2.4 Tenant isolation

| ID       | Direction                                                                                                                                                                                                                | Blocked by            | Verifies with                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------- |
| **B-08** | Choose the runtime DB role: dedicated non-owner DML role, `DATABASE_URL` switched to it, `FORCE ROW LEVEL SECURITY` **after all paths are tested**. This is the single change that turns ADR-004 from nominal into real. | B-00b, owner decision | A cross-tenant read is refused by the database, not only by the app |
| **B-09** | Add `FOR UPDATE` to the Pakasir subscription write path.                                                                                                                                                                 | —                     | Two concurrent distinct events cannot interleave on one invoice     |
| **B-10** | Add `tenantId` scoping to `loadOwnerKioskTheme`.                                                                                                                                                                         | —                     | Cross-tenant reads return 404                                       |

### 2.5 Validation

| ID       | Direction                                                         | Blocked by                          | Verifies with                            |
| -------- | ----------------------------------------------------------------- | ----------------------------------- | ---------------------------------------- |
| **B-11** | Add the missing `isSameOrigin` to `/api/auth/staff-pin`.          | —                                   | A cross-origin login POST is rejected    |
| **B-12** | Move `SUPPORT_EMAIL` into `thirdPartyEnvSchema` + `.env.example`. | (done in the working tree; confirm) | The env guard covers it                  |
| **B-13** | Stop the raw `error.message` return from `/api/health`.           | —                                   | The response body carries no driver text |

### 2.6 Database integrity

| ID       | Direction                                                                                                                                                                                                                                                              | Blocked by | Verifies with                                                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------- |
| **B-14** | Add the missing `_journal.json` entry for `0005_owner_promo_code_scope.sql`, then run the redemption path once and confirm the index exists. Add a CI assertion that every file in `migrations/` has a journal entry.                                                  | B-00a      | The parity assertion fails on a deliberately-added orphan file       |
| **B-15** | Restore snapshot parity **before** anyone runs `drizzle-kit generate` — either snapshot `security_events` / `auth_sessions` / `system_health_checks`, or remove them from the Drizzle schema since `…00500` owns their DDL.                                            | B-00c      | `generate` produces an empty diff                                    |
| **B-16** | Add the six missing `tenant_id` FKs (`users`, `promo_redemptions`, `sessions`, `download_tokens`, `activity_logs`, `device_logs`) plus `sessions.booth_id`/`device_id` and `promo_redemptions.transaction_id`, so `ON DELETE CASCADE FROM tenants` actually cleans up. | —          | Deleting a tenant leaves zero orphans                                |
| **B-17** | Stop accepting a client-supplied `transactionId` in `redeemPromo`, or add a composite FK.                                                                                                                                                                              | B-08       | A redemption cannot reference another tenant's transaction           |
| **B-18** | Add `FOR UPDATE` to the Pakasir subscription write path (the pattern already exists at `promos/actions.ts:146`).                                                                                                                                                       | B-09       | Same as B-09 — one item, listed with both groups in the source queue |
| **B-19** | Widen `redeemPromo`'s lookup to `tenant_id = me OR tenant_id IS NULL` so CEO-global promos are reachable, matching the RLS policy.                                                                                                                                     | —          | A global voucher redeems                                             |
| **B-20** | Change `app.is_ceo()` to return `false` when `public.users` is unreadable.                                                                                                                                                                                             | —          | A test covers the missing-table branch                               |
| **B-21** | Add indexes: `tenant_id` on the 7 uncovered tables, and a first index set for the 7 zero-index tables — `templates` and `packages` are urgent (they are read on **every** Owner dashboard load).                                                                       | —          | `EXPLAIN` shows index scans on the dashboard load                    |
| **B-22** | Reconcile the contradictory migration-history comments so the next operator is not misled, and replace `migrate-ordered.mjs`'s exact-file-count assertion with a phase-aware check that reports what changed.                                                          | —          | A 9th migration does not crash the script with a bare throw          |

> **Ordering note.** B-18 and B-19 in the source queue carry overlapping numbering with the payment and device groups below. IDs here are disambiguated; the source order is preserved.

### 2.7 Payment — ship these two together or neither

| ID       | Direction                                                                                                                                                                                                                                                           | Blocked by | Verifies with                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------- |
| **B-23** | Implement the `PaymentProvider` interface (PRD §10.8) with `createPayment` / `verifyPayment` / `refund` / `testConnection`, and `POST /api/payment/create`.                                                                                                         | —          | A payment intent can be created                          |
| **B-24** | Implement `/api/webhooks/b2c/[provider]` with per-provider signature verification (Midtrans SHA512, Xendit constant-time callback token, DOKU HMAC, Pakasir HMAC-SHA256), `UNIQUE(gateway_transaction_id)` idempotency, and **no client-writable `payment_status``. | —          | A forged callback is rejected; a replayed one is a no-op |

**These two are one change.** Shipping an adapter without the webhook re-opens the hole ADR-002 was written to close. The `test-connection` path that exists today is the only real payment code, and it moves no money.

### 2.8 Webhook

| ID       | Direction                                                                                                                                                                            | Blocked by | Verifies with                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------- |
| **B-25** | Extract the idempotency-marker + dead-letter pattern from the Pakasir route into a shared helper so the B2C webhooks cannot get it wrong.                                            | B-24       | Both webhook families use one helper                  |
| **B-26** | Add a signed timestamp + ±5 min freshness window to the Pakasir webhook; measure the body cap in **bytes** (`content-length` or a stream), not `rawBody.length` (UTF-16 code units). | —          | A captured body with a fresh `eventId` is refused     |
| **B-27** | Stop `WHATSAPP_SALES_NUMBER` from gating webhook signature verification — read the secret from its own schema.                                                                       | —          | Unsetting an unrelated var does not 401 every webhook |

### 2.9 Subscription

| ID       | Direction                                                                                                                         | Blocked by  | Verifies with                                                      |
| -------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------ |
| **B-28** | Implement the hourly expiry cron, `EXPIRING` / `GRACE_PERIOD` transitions, H-7/H-3/H-1 notifications, and kiosk maintenance mode. | B-22 (cron) | A subscription past `valid_until` transitions without human action |
| **B-29** | Implement the Owner checkout (renew / upgrade / downgrade / add-on) that the page currently renders as three `disabled` buttons.  | B-23        | A renewal produces a subscription mutation                         |

### 2.10 Device

| ID       | Direction                                                                                                                                                                           | Blocked by  | Verifies with                                                  |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------- |
| **B-30** | Implement `POST /api/booth/pair` with an **atomic** `UPDATE pairing_tokens SET used=true WHERE used=false AND expires_at>now()`, increment `attempt_count`, and mint `session_jwt`. | —           | A token cannot be redeemed twice, concurrently or after expiry |
| **B-31** | Wire `pairing_tokens.expires_at` and `attempt_count` into the redemption predicate.                                                                                                 | B-30        | Expired tokens and over-attempt tokens are refused             |
| **B-32** | Implement `POST /api/booth/heartbeat` writing `booths.last_heartbeat_at`, and the 90 s offline cron.                                                                                | B-28 (cron) | A silent booth goes `OFFLINE` without human action             |
| **B-33** | Insert into `devices` on first pair so `deviceQuota` becomes enforceable.                                                                                                           | B-30        | A plan's device limit is actually consumed                     |
| **B-34** | Rate-limit `/api/booth/*` per device fingerprint, not per IP.                                                                                                                       | B-39        | Limits are per device                                          |

### 2.11 Realtime

| ID       | Direction                                                                                                                              | Blocked by | Verifies with                                                          |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------- |
| **B-35** | Publish the catalog events; wire `EventDeduplicator` + `version` checks; normalise `broadcast.created` through `publishRealtimeEvent`. | F-48       | 1-of-25 becomes most-of-25, and every published name is in the catalog |
| **B-36** | Replace `buckets.clear()` with LRU expiry; move rate-limit state to a shared store.                                                    | B-34       | Clearing one IP's buckets leaves others intact                         |

### 2.12 Observability

| ID       | Direction                                                                                                                                                                                                                                             | Blocked by                             | Verifies with                                                  |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| **B-37** | Deploy the Cloudflare WAF/rate-limit/Turnstile drafts, then **fix the ruleset first** — 5 of 8 rate-limit rules target endpoints that do not exist, and the README's verification procedure curls `/api/contact` and expects a 429 it will never get. | B-23 (so `/api/payment/create` exists) | The documented verification procedure passes                   |
| **B-38** | Wire Turnstile into at least `/api/auth/*`, **or** delete the declarations so the env inventory reflects reality.                                                                                                                                     | —                                      | A bot challenge runs, or the keys are gone                     |
| **B-39** | Add a CSP (and HSTS) to `next.config.ts`; add `object-src` / `base-uri` / `form-action` to the Tauri CSP.                                                                                                                                             | —                                      | Response headers carry both                                    |
| **B-40** | Add `import 'server-only'` to the ~13 server modules that lack it, starting with `broadcast-server.ts` and `packages/db/src/client.ts`.                                                                                                               | —                                      | A client component importing a server module fails to build    |
| **B-41** | Delete the five dead server actions or wire them; delete `api/sentry-example` **and** its WAF exemption together.                                                                                                                                     | F-38                                   | No exported action has zero callers; no route throws by design |
| **B-42** | Add a DB-ownership consistency check: a `tenant_id` FK on every table that has one, enforced in CI.                                                                                                                                                   | B-16                                   | The check fails on a deliberately-missing FK                   |

### 2.13 Performance — measure before claiming

| ID       | Direction                                                                                                                                                                                                                                                                                       | Blocked by   | Verifies with                                                |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------ |
| **B-43** | **No performance claim can be made today** (AUDIT-LIM-01). Before asserting any PRD §8.5 target, add measurement: a bundle-size budget in CI, P95 latency middleware, and a Lighthouse/Playwright baseline. Also verify whether `recharts` — a declared dependency — is actually in any bundle. | runtime pass | A baseline exists and a regression fails CI                  |
| **B-44** | Replace the two hand-rolled binary/encoder implementations (`zipFile`, `qrPngDataUrl` — Reed–Solomon) with audited libraries, **or** add round-trip tests proving they decode. Both are crypto-adjacent, unverified, and unmaintainable.                                                        | —            | A round-trip test decodes a generated QR and a generated ZIP |

---

## 3. Cross-queue dependencies

The two queues are separate, but these edges connect them. Each is a **dependency**, not a merge.

| Frontend item                | Depends on   | Backend item | Why                                                                                      |
| ---------------------------- | ------------ | ------------ | ---------------------------------------------------------------------------------------- |
| F-17 (CEO PII authz)         | —            | B-05         | Same edit, different layer. Do B-05 in the loaders; F-17 is the visible effect           |
| F-19 (RBAC decision)         | —            | B-06         | One decision, two expressions. Neither lands without the other                           |
| F-23 (notifications args)    | —            | B-01         | Both touch the same query path; a revoked session should also stop listing notifications |
| F-43 (pairing mint once)     | PC-02        | B-30, B-31   | The manual code decision (F-43) is meaningless until redemption exists (B-30)            |
| F-46 (realtime indicator)    | —            | B-35         | The indicator can only be truthful once events actually arrive                           |
| F-47 (publish events)        | —            | B-32, B-35   | Heartbeats must exist before online/offline events mean anything                         |
| F-49 (responsive validation) | runtime pass | B-43         | Both need the same 7-viewport runtime session                                            |
| F-50 (axe-core)              | runtime pass | B-39 (CSP)   | Contrast results change when a CSP restricts nothing but fonts are fixed                 |
| F-24 (demo vs real)          | —            | B-23         | If finance becomes real, it needs the payment/transaction writers to exist               |

---

## 4. Suggested sequencing (direction, not a schedule)

| Wave                          | Contents                                                          | Gate to pass before starting                                                                  |
| ----------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **0 — Decide**                | The three decisions in §0 (palette, DB role, RBAC) + demo-vs-real | Owner answers                                                                                 |
| **1 — Cheap and structural**  | B-00a, B-00c, F-02, F-03, F-51, B-12, B-13, B-27, B-20            | B-00a/B-00c verified; the two new CI guards fail on a bad input and pass on a good one        |
| **2 — The P0**                | B-00b / B-08 (non-owner role + `FORCE RLS`)                       | Every tenant-isolation path re-tested; cross-tenant attempts return 404 **from the database** |
| **3 — Security truthfulness** | B-01, B-05, B-11, B-30…B-34, B-37, B-39, B-40                     | Revocation, CSRF, pairing redemption, headers, and `server-only` all verified                 |
| **4 — The frontend rewrite**  | F-01…F-16, F-34, F-45, F-49, F-50                                 | axe-core in CI; 7 viewports validated; a bundle baseline exists (B-43)                        |
| **5 — Data integrity**        | F-23…F-33, B-15…B-22                                              | Two-tenant test exists; deleting a tenant leaves zero orphans                                 |
| **6 — New capability**        | B-23+B-24 (together), B-28, B-29, B-35, B-44                      | One end-to-end payment, one expiry cycle, one realtime event observed                         |
| **7 — Surface the rest**      | F-34…F-52, B-41, B-42                                             | Every PRD-claimed surface either exists or is removed from the PRD                            |
| **8 — Kiosk**                 | Fase 3/4/5 items (36 `MISSING` tasks in `09`)                     | Scoped and staffed as its own programme, not as a repair                                      |

**Waves 2 and 6 are the two that change the risk profile of the product.** Everything else reduces friction.

---

## 5. What this document deliberately does not do

- It does not merge the two queues. A frontend PR should not carry a migration, and a migration PR should not carry a design decision.
- It does not estimate effort. Without a runtime pass (AUDIT-LIM-01), any estimate would be fiction.
- It does not mark anything `PASS`. The strongest claim available today is `CONFIRMED (static)`.
- It does not decide PC-01, PC-02, BE-001, BE-005, or FE-006. Those are owner decisions, listed in §0 and in `00_EXECUTIVE_SUMMARY.md` §9.
- It does not propose code. Every "direction" is a decision or a reconciliation.

---

## Cross-references

- Severity and finding definitions: `00_EXECUTIVE_SUMMARY.md` §1, §4.
- Canonical `FE-*` findings: `01_FRONTEND_AUDIT.md`, `03_FRONTEND_UX_UI_AUDIT.md`, `04_FRONTEND_API_CONTRACT.md`.
- Canonical `BE-*` findings: `05_BACKEND_API_AUDIT.md`, `06_SECURITY_AUDIT.md`, `07_REALTIME_AUDIT.md`, `08_DATABASE_TENANT_AUDIT.md`.
- Task-level status: `09_PRD_IMPLEMENTATION_MATRIX.md`.
- Runtime pass scope: `00_EXECUTIVE_SUMMARY.md` §11; `06_SECURITY_AUDIT.md` §5; `07_REALTIME_AUDIT.md` §6; `08_DATABASE_TENANT_AUDIT.md` §6.
