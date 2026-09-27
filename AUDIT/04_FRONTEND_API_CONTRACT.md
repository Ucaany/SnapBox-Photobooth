# 04 — Frontend ↔ API Contract Audit

**Source:** `.kilo/plans/1790436768946-snapbox-forensic-audit.md` §3 — findings FE-005, FE-021, FE-022
**Status of this document:** audit result. No source file was modified.
**Canonical form:** these findings are also stated in `01_FRONTEND_AUDIT.md`. This file is the contract deep dive: it adds the full API inventory (all 8 `/api/**` route handlers + 1 nested export route + all 55 server actions) so each mismatch can be traced to a concrete endpoint.

**Per-finding template:** Finding / Evidence / Actual / Expected / Impact / Severity / Affected files / Affected routes / Related API / Status / Recommended next action (direction only, never code).

---

## 1. Transport inventory

### 1a. Route handlers — 8 under `/api/**` + 1 nested export route

| #   | Route                                      | Methods                 | Auth                                                                | Rate limit       | Error envelope            | Status                                                                                                |
| --- | ------------------------------------------ | ----------------------- | ------------------------------------------------------------------- | ---------------- | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | `/api/auth/session`                        | `POST`, `DELETE`, `GET` | none (login) / HMAC cookie (logout, session)                        | yes (IP + email) | —                         | **IMPLEMENTED**; has `isSameOrigin` (`:61-70,119-121`)                                                |
| 2   | `/api/auth/staff-pin`                      | `POST`, `GET`           | none (PIN)                                                          | yes (IP)         | `{ok:false,code,message}` | **BROKEN** — can only return `PIN_REJECTED` (FE-020); **lacks `isSameOrigin`** (BE-009)               |
| 3   | `/api/booth/pair-session`                  | `POST`, `GET`           | `requireOwnerTenant()`                                              | yes (IP only)    | `{ok:false,code,message}` | **IMPLEMENTED**; best-implemented part of the pairing chain, which then terminates at a wall (BE-003) |
| 4   | `/api/health`                              | `GET`                   | **none**                                                            | no               | `{message}`               | **PARTIAL** — leaks raw DB `error.message` (BE-018)                                                   |
| 5   | `/api/internal/telemetry/heartbeat`        | `POST`, `GET`           | shared secret `x-snapbox-heartbeat-secret`, constant-time           | no               | `{ok:false,message}`      | **IMPLEMENTED**; fails closed 503 without `HEARTBEAT_SECRET`                                          |
| 6   | `/api/internal/telemetry/waf`              | `POST`, `GET`           | shared secret `x-snapbox-waf-secret`, constant-time                 | no               | `{ok:false,message}`      | **IMPLEMENTED**; fails closed 503 without `WAF_INGEST_SECRET`; **at risk from BE-021**                |
| 7   | `/api/sentry-example`                      | `GET`                   | none                                                                | no               | n/a                       | **DEAD** — throws an unhandled `Error` on every GET outside production (BE-032)                       |
| 8   | `/api/webhooks/pakasir-b2b`                | `POST`, `GET`           | HMAC-SHA256 signature on the **raw body before parse** (`:236-240`) | no               | n/a                       | **IMPLEMENTED** — production-grade (BE-012)                                                           |
| 9   | `GET /owner-dashboard/transactions/export` | `GET`, `POST`           | session cookie                                                      | no               | `{message}`               | **IMPLEMENTED**; hand-rolled ZIP containing one CSV (FE-021f)                                         |

**Total route-handler surface: 9 files. `GET` health-style descriptors exist on 7 of them; `POST` mutations on 5.**

### 1b. Server actions — 19 `'use server'` files, 55 exported actions

All 55 call `requireCeo()` or `requireOwnerTenant()` (a **fresh DB read** of the `users`/`tenants` row, not a cookie snapshot), all use zod, 20 use transactions, and **no action trusts a client-supplied `tenantId`** (BE-030, P4 POSITIVE).

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
| `settings/actions.ts`         | `updateOwnerProfile`, `getOwnerSettings`                                                                                                              |
| `staff/actions.ts`            | `createStaff`, `updateStaff`, `setStaffActive`, `resendStaffInvite`                                                                                   |
| `support/actions.ts`          | `submitOwnerSupport`                                                                                                                                  |
| `templates/actions.ts`        | `createTemplate`, `updateTemplate`, `deleteTemplate`, `setTemplateActive`                                                                             |

`ceo-dashboard/tenants/[id]/tenant-detail-actions.tsx` is a **component** (`export function TenantDetailActions`), not a `'use server'` module; it reuses the same shared `statusTransitionError` guard as `tenants/actions.ts:296`.

### 1c. Frontend→API fetch is only 5 calls in the whole app

| Call                                       | Site                           |
| ------------------------------------------ | ------------------------------ |
| `POST /api/auth/session`                   | login + logout                 |
| `POST /api/auth/staff-pin`                 | `/login` staff tab             |
| `POST /api/booth/pair-session`             | 2 sites (double mint — FE-013) |
| `GET /owner-dashboard/transactions/export` | `transactions-view.tsx`        |

Everything else is a Server Action. **This is a good architectural property — no client-supplied `tenantId` anywhere** (FE-021h, POSITIVE).

---

## FE-005 — P1 — `/owner-dashboard/notifications` is **silently always empty** (argument-order bug)

**Finding.** P1. A swapped argument list at the call site makes every owner-addressed notification invisible, and the empty state makes the failure indistinguishable from "no data".

**Evidence.**

- Signature is `listOwnerNotifications(userId, tenantId)` (`notifications-server.ts:5`); call site passes `(auth.tenantId, auth.session.userId)` (`notifications/page.tsx:15`). Arguments are swapped.
- `notifications-view.tsx:47-48` — empty state `"Belum ada notifikasi baru."`
- `owner-header.tsx:52-58` — plain `<Link>`, no unread count, no dropdown.
- Compounding: `notifications-server.ts:19-25` and `notifications/actions.ts:17-27` both AND together a redundant third `or(userId = me, tenantId = mine)` group that **nullifies** the intended `userId IS NULL` (tenant-broadcast) clause — so broadcast notifications can never be listed or marked read, by design or bug.
- **No test covers it**; `owner-account-contract.test.mjs:10` asserts against dead `owner-account-server.ts`.

**Actual.** The WHERE becomes `user_id = <tenantId> OR tenant_id = <userId>`. Every owner-addressed notification is filtered out; only rows with both columns NULL survive. The PRD-mandated bell badge/dropdown is not built either.

**Expected.** Rows addressed to the owner appear; a broadcast clause can be read and marked read.

**Impact.** The page is silently always empty. The empty state string makes a bug look like normal operation. The PRD-mandated bell badge/dropdown does not exist, so a notification is never surfaced anywhere in the UI. The single test touching this area asserts against a deleted module, so CI cannot catch it.

**Severity.** P1.

**Affected files.** `notifications-server.ts`, `notifications/page.tsx`, `notifications-view.tsx`, `notifications/actions.ts`, `owner-header.tsx`, `owner-account-contract.test.mjs:10`.

**Affected routes.** `/owner-dashboard/notifications`; the Owner header on every `/owner-dashboard/**` route.

**Related API.** `listOwnerNotifications` (server loader), `markOwnerNotificationRead` (server action, `notifications/actions.ts:9`). Table: `notifications`. No route handler involved.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Fix call-site/signature, then decide whether tenant-broadcast semantics is wanted, and add a test that seeds a tenant notification.

---

## FE-021 — P2 — Frontend↔API contract mismatches (concrete)

**Finding.** P2. Nine concrete contract defects between the frontend and the API/DB layer.

| #       | Mismatch                                                                                                                                                                                                                                                                                                                                                                                                                                      | Evidence                                      |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| FE-021a | **`boothStatusSchema` name collision, `DEGRADED` missing.** `domain.ts:25` has 5 members incl. `DEGRADED`; `machine-contract.ts:28` re-declares the **same export name** with 4. A `DEGRADED` booth fails validation in the Owner Machine Manager.                                                                                                                                                                                            | `machine-contract.ts:28` vs `domain.ts:25,78` |
| FE-021b | **Three incompatible API error envelopes.** (a) PRD §10.13 / `packages/shared/src/errors.ts` `{success:false,error:{code,message,requestId,developerMessage,retryable}}`; (b) `{ok:false,code,message}` (`api/booth/pair-session`, `api/auth/staff-pin`); (c) `{message}` only (`transactions/export/route.ts:18,22,27,31,33,44`, `api/health`, `api/internal/telemetry/*`). The shared envelope is defined but **used by no route handler**. | as cited                                      |
| FE-021c | **`user:{userId}` channel vs its own RLS.** `events.ts:15` is generic, but `20260101000300_realtime.sql:46-49,84` requires the suffix to be the **Firebase UID**; `Session.userId` is a **UUID**. Any future `user:` subscriber is denied. Latent (nothing publishes there yet).                                                                                                                                                              | as cited                                      |
| FE-021d | **`payment_status` / `template layoutType` / `package printSize` re-declared locally** in `transaction-contract.ts:5` (identical, 3rd copy), `template-contract.ts:41` (**lowercase** vs free-text column), `package-contract.ts:12` — 5 local enum re-declarations that will drift.                                                                                                                                                          | as cited                                      |
| FE-021e | **`securitySeveritySchema` 3 members vs `NOTIFICATION_SEVERITIES` 4** (`health-security-contract.ts:15` lacks `ERROR`).                                                                                                                                                                                                                                                                                                                       | as cited                                      |
| FE-021f | **Bulk ZIP is not photos.** `transactions/export/route.ts:48-86` is a hand-rolled _stored_ (uncompressed) ZIP writer containing **one CSV**. `transactions-view.tsx:87` discloses it. PRD §3.C "bulk ZIP" = not met.                                                                                                                                                                                                                          | as cited                                      |
| FE-021g | **Manual pairing code always null.** `machine-contract.ts:110` declares `manualCode: string \| null`; `pairing-session/route.ts:114` hardcodes `null`; `machines-view.tsx:305` is a **permanently dead branch**. ADR-001 requires a manual fallback.                                                                                                                                                                                          | as cited                                      |
| FE-021h | **Frontend→API fetch is only 5 calls** in the whole app: `POST /api/auth/session` (login+logout), `POST /api/auth/staff-pin`, `POST /api/booth/pair-session` (×2 sites), `GET /owner-dashboard/transactions/export`. Everything else is Server Actions. **This is a good architectural property** — no client-supplied `tenantId` anywhere.                                                                                                   | grep                                          |
| FE-021i | **`SUPPORT_EMAIL`** consumed by `resend.ts:121` but absent from `.env.example`; the support form fails closed.                                                                                                                                                                                                                                                                                                                                | as cited                                      |

**Actual.** Nine concrete mismatches: a schema name collision, three error envelopes, a channel-name type conflict, five drifted local enum copies, a short severity enum, a ZIP that contains only a CSV, a permanently null manual code, and an undeclared env var. One item (FE-021h) is a positive.

**Expected.** Single source of truth for schemas, error envelopes, and channel names.

**Impact.** A `DEGRADED` booth cannot render in the Machine Manager; error handling cannot be written once (3 shapes across 9 route files); the "bulk ZIP" deliverable is a CSV in a ZIP wrapper; the manual pairing fallback required by ADR-001 does not exist; a future `user:` realtime channel will be denied by its own RLS.

**Severity.** P2 (P1 for FE-021a and FE-021g, which break or erase required behaviour).

**Affected files.** `machine-contract.ts`, `domain.ts`, `events.ts`, `transaction-contract.ts`, `template-contract.ts`, `package-contract.ts`, `health-security-contract.ts`, `transactions/export/route.ts`, `pairing-session/route.ts`, `machines-view.tsx`, `transactions-view.tsx`, `resend.ts`, `.env.example`, all 8 `/api/**` route handlers.

**Affected routes.** `/owner-dashboard/machines`, `/owner-dashboard/machines/[boothId]`, `/owner-dashboard/transactions`, `/owner-dashboard/transactions/export`, `/owner-dashboard/support`, `/login`.

**Related API.** `POST /api/booth/pair-session`; all 9 route-handler files; 55 server actions; channel `user:{firebaseUid}`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Single `boothStatusSchema` import in `machine-contract.ts`; one error envelope across all 9 route files; delete or wire the duplicate local enums; fix the `user:{userId}` Firebase-UID contract; add `SUPPORT_EMAIL` to the env schema + `.env.example`; implement the manual pairing code or remove the dead branch per PC-02.

---

## FE-022 — P2 — Realtime (frontend side) is a **5-second poll triggered by nothing**

**Finding.** P1 for the false "Realtime aktif" indicator; P2 for the rest.

**Evidence.**

- `use-booth-realtime.ts` is the **only** realtime subscription in the codebase (no `supabase.channel(`/`.subscribe(` anywhere).
- **Contract break:** `phx_reply` of **any** topic sets `connected: true` (`:70-73`) — including a **rejected** join. The UI shows a green **"Realtime aktif"** dot while the RLS policy silently drops the channel. No `event_id` dedup, no `version` check (violates PRD §10.6 and ADR-011). Fixed 5 s reconnect, no backoff/jitter/cap (`:90`). `joined` is one boolean for N channels, so `phx_leave` is unreliable (`:36,104`).
- **Payload is discarded** (`:63-81`): the only effect is `tick++` → `router.refresh()` (`machines-view.tsx:62`, `machine-detail-view.tsx:66`). Defensible (server = source of truth) but means **no field-level update, and no way to know which event arrived**.
- **Nothing publishes to `booth:`** (BE-016). So the subscription can never fire.

**Actual.** A hand-rolled Phoenix WebSocket client reports success on any reply, reconnects on a fixed 5 s timer, discards every payload, and subscribes to a topic nothing publishes to.

**Expected.** A realtime indicator that reflects reality; dedup + version per PRD §10.6 and ADR-011; backoff with jitter and a cap; a payload that identifies which event arrived.

**Impact.** A green "Realtime aktif" dot is shown while the channel is being dropped by RLS. Even if it connected, the user would get a full `router.refresh()` with no field-level update and no indication of which event arrived. A fixed 5 s reconnect with no backoff or cap is a self-inflicted load amplifier.

**Severity.** P1 for the false indicator; P2 for the rest.

**Affected files.** `use-booth-realtime.ts`, `machines-view.tsx`, `machine-detail-view.tsx`.

**Affected routes.** `/owner-dashboard/machines`, `/owner-dashboard/machines/[boothId]`.

**Related API.** Phoenix channel `booth:{boothId}`; realtime RLS in `20260101000300_realtime.sql`; `publishRealtimeEvent` (`events.ts`).

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Treat a `phx_reply` error as a failure; make `joined` per-topic; add backoff + jitter + cap; add `event_id` dedup and `version` check.

---

## Contract-summary table

| Contract surface             | Declared once                                         | Actual copies                                             | Drift today                                  |
| ---------------------------- | ----------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------- |
| Booth status enum            | `domain.ts:25` (5 members)                            | 2 (`machine-contract.ts:28` has 4)                        | **YES** — `DEGRADED` fails validation        |
| API error envelope           | `packages/shared/src/errors.ts` (PRD §10.13)          | 3 shapes across 9 route files                             | **YES** — shared envelope used by 0 handlers |
| `payment_status`             | schema enum                                           | 3 (`transaction-contract.ts:5` is the 3rd identical copy) | latent                                       |
| Template `layoutType`        | free-text column                                      | 1 local enum, **lowercase**                               | latent                                       |
| Package `printSize`          | schema enum                                           | 1 local enum (`package-contract.ts:12`)                   | latent                                       |
| Notification severity        | `NOTIFICATION_SEVERITIES` (4)                         | 1 local (`securitySeverityContract.ts:15` has 3)          | **YES** — `ERROR` missing                    |
| Realtime channel `user:{id}` | `20260101000300_realtime.sql:46-49,84` (Firebase UID) | 1 generic builder (`events.ts:15`) feeding a UUID         | latent                                       |
| `SUPPORT_EMAIL`              | `thirdPartyEnvSchema`                                 | 0 (read directly, not declared)                           | **YES** — fails closed                       |

---

## Cross-references

- Canonical statements: `01_FRONTEND_AUDIT.md` FE-005, FE-021, FE-022.
- Realtime catalogue and publisher side: `07_REALTIME_AUDIT.md`.
- Server-action and route-handler findings: `05_BACKEND_API_AUDIT.md`.
- `isSameOrigin` and `staff-pin` findings: `06_SECURITY_AUDIT.md` (BE-009, BE-010).
