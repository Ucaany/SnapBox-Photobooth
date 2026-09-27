# 07 — Realtime Audit

**Source:** `.kilo/plans/1790436768946-snapbox-forensic-audit.md` §5 (BE-016) and §3 (FE-022)
**Status of this document:** audit result. No source file, migration, config, or environment was modified.
**Canonical location:** `05_BACKEND_API_AUDIT.md` holds the canonical `BE-016` and `01_FRONTEND_AUDIT.md` the canonical `FE-022`. This file is the **end-to-end view**: catalog → publisher → transport → RLS → subscriber → UI, and the exact point where the chain breaks.
**Evidence basis:** static code reading only. **No Supabase project, no WebSocket, no rendered UI (AUDIT-LIM-01/02).** Delivery, latency, and RLS effect are all UNVERIFIED.

---

## How to read this file

Same eleven-field template as every other file:
`Finding` · `Evidence` · `Actual` · `Expected` · `Impact` · `Severity` · `Affected files` · `Affected routes` · `Related API` · `Status` · `Recommended next action` (**direction only, never code**).

Severity: **P0** blocker · **P1** critical · **P2** major · **P3** minor · **P4** observation.

---

## 1. The chain, end to end

```
catalog (packages/shared/src/events.ts)
   │  25 event names, 4 channel shapes
   ▼
publisher (lib/ceo-dashboard/realtime-server.ts)      ← server-only, service_role, HTTP /realtime/v1/api/broadcast
   │  realtimeEventSchema.parse() enforced here
   ▼
Supabase Realtime (Broadcast) ── RLS on realtime.messages
   │
   ▼
subscriber (components/owner-dashboard/use-booth-realtime.ts)   ← hand-rolled Phoenix WebSocket, anon key
   │
   ▼
UI (machines-view.tsx, machine-detail-view.tsx)      ← tick++ → router.refresh()
```

**Where it breaks, in one line:** the catalog declares 25 events; exactly **one** is ever published; the only subscriber listens on `booth:{id}`; and **nothing publishes to `booth:` at all**.

---

## 2. Inventory

### 2.1 Event catalog — 25 names, 1 emitted, 0 consumed

Verified at `packages/shared/src/events.ts:26-58`:

| Group                          | Events                                                                                                | Emitted?                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Device & booth lifecycle       | `DEVICE_PAIRED`, `DEVICE_REVOKED`, `DEVICE_ONLINE`, `DEVICE_OFFLINE`, `BOOTH_ONLINE`, `BOOTH_OFFLINE` | **none**                                                        |
| Kiosk configuration            | `CONFIG_UPDATED`, `THEME_UPDATED`, `PACKAGE_UPDATED`, `FRAME_UPDATED`, `PROMO_UPDATED`                | `THEME_UPDATED` only                                            |
| Payment (server-authoritative) | `PAYMENT_PENDING`, `PAYMENT_PAID`, `PAYMENT_FAILED`                                                   | **none** (and no payment path exists — BE-011)                  |
| Photo session                  | `START_CAPTURE`, `PRINT_STARTED`, `PRINT_SUCCESS`, `PRINT_FAILED`                                     | **none** (and no kiosk — BE-002)                                |
| B2B subscription               | `SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_EXPIRING`, `SUBSCRIPTION_EXPIRED`, `BROADCAST_CREATED`          | `BROADCAST_CREATED` published **outside the schema** (see §2.3) |
| Operational                    | `LOW_PAPER`, `MAINTENANCE_MODE_ON`, `MAINTENANCE_MODE_OFF`                                            | **none** (and no heartbeat, no cron — BE-013)                   |

> **Count correction.** The planning pass recorded "22 catalog events". The catalog in the working tree holds **25** (`events.ts:26-58`); the three operational events `LOW_PAPER`, `MAINTENANCE_MODE_ON`, `MAINTENANCE_MODE_OFF` account for the difference. The conclusion is unchanged and slightly worse: **1 of 25 emitted, 0 of 25 consumed.**

Every event must carry `eventId`, `version`, `timestamp`, `tenantId`, `boothId`, `deviceId`, `payload` (`events.ts:69-79`), and handlers are required to be idempotent: drop a seen `event_id`, drop a `version` lower than the last applied (`events.ts:2-7`, `104-124`).

### 2.2 Channels — 4 shapes, 1 subscriber

`REALTIME_CHANNELS` (`events.ts:12-17`): `booth:{boothId}`, `tenant:{tenantId}`, `user:{userId}`, `broadcast:all`.

| Channel         | Published to                                       | Subscribed by                      | Note                                        |
| --------------- | -------------------------------------------------- | ---------------------------------- | ------------------------------------------- |
| `tenant:{id}`   | `kiosk-theme/actions.ts:136` (`THEME_UPDATED`)     | **nobody**                         | the only schema-valid publish in the repo   |
| `booth:{id}`    | **nobody**                                         | `use-booth-realtime.ts:60,105-106` | the only subscription in the repo           |
| `broadcast:all` | `broadcast-server.ts:133` as `'broadcast.created'` | **nobody**                         | name not in the catalog, payload not parsed |
| `user:{id}`     | **nobody**                                         | **nobody**                         | and the name is wrong — see FE-021c         |

**`supabase.channel(` / `.subscribe(` appear 0 times repo-wide.** The only subscription is a hand-rolled Phoenix WebSocket in `use-booth-realtime.ts`.

### 2.3 Publishers

| Site                                         | What it does                                                                                                                                                                                                                                                   | Verdict                                                                                                                                               |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/ceo-dashboard/realtime-server.ts:52-77` | `import 'server-only'`; picks `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from separate schemas; enforces `https:`; `realtimeEventSchema.parse()` at `:53`; `POST /realtime/v1/api/broadcast` with a 5 s `AbortSignal.timeout`; throws on non-2xx | **Correct.** This is the right shape: the service key never crosses the client boundary, and the schema is enforced at the only sanctioned exit point |
| `kiosk-theme/actions.ts:121,136`             | publishes `THEME_UPDATED` to `tenant:{id}` through the helper                                                                                                                                                                                                  | Correct, and has no subscriber                                                                                                                        |
| `broadcast-server.ts:110-149`                | publishes `event: 'broadcast.created'` at `:133` with a **snake_case** payload, **bypassing** `realtimeEventSchema` (self-documented as debt at `:106-108`)                                                                                                    | **Non-conforming.** Name is not in `REALTIME_EVENTS`; payload violates PRD §10.6; no `event_id`, no `version`                                         |

### 2.4 Subscriber

`use-booth-realtime.ts` (116 lines, `'use client'`): raw `WebSocket` to `${url}/realtime/v1/websocket?apikey=…&vsn=1.0.0` (`:55-57`), `phx_join` per booth on open (`:44-52,60`), Phoenix `heartbeat` every 25 s (`:93-95`), fixed 5 s reconnect (`:90`), payload discarded → `tick++` (`:75-80`).

### 2.5 RLS on `realtime.messages` — the strongest control in this layer

Extension-scoped policies; correct `broadcast:all` CEO gate; presence restricted to the caller's own `tenant:`/`user:`; **no browser INSERT policy** (correctly omitted — publish is `service_role`-only); the deferred `booth:{id}` policy is correctly created in `packages/db/migrations/0001_rls_and_realtime.sql:144-166` with the `split_part` UUID round-trip. No `REPLICA IDENTITY` and no publication entries are **correct and deliberate**: the transport is Broadcast/Presence, not Postgres Changes.

**Caveat that matters for every other row in this table:** those policies do not fire for _application_ queries on the app's connection role (BE-001). The realtime path is different — it authenticates as the Supabase anon/service role over WebSocket, not as the table owner — so the booth-subject denial below is the RLS behaving as designed, not another BE-001 casualty.

### 2.6 Heartbeats — two different things, both missing where they matter

| Heartbeat                                | Status                              | Evidence                                  |
| ---------------------------------------- | ----------------------------------- | ----------------------------------------- |
| Phoenix transport heartbeat (keep-alive) | **present**                         | `use-booth-realtime.ts:93-95`, every 25 s |
| `booths.last_heartbeat_at` write         | **absent** — zero writers repo-wide | no `/api/booth/heartbeat`; no cron        |
| `devices.last_heartbeat_at` write        | **absent** — zero writers repo-wide | same                                      |
| 90 s offline detection cron              | **absent**                          | no `pg_cron` schedule in any migration    |

Consequence: every booth is permanently `OFFLINE`/`UNPAIRED`, and `DEVICE_ONLINE`/`DEVICE_OFFLINE`/`BOOTH_ONLINE`/`BOOTH_OFFLINE` can never fire — the events exist, and nothing could raise them even with a subscriber.

---

## 3. Findings

### FE-022 — P1/P2 — Realtime (frontend side) is a **5-second poll triggered by nothing**

**Finding.** P1 for the false "Realtime aktif" indicator; P2 for the rest.

**Evidence.**

- `use-booth-realtime.ts` is the **only** realtime subscription in the codebase; `supabase.channel(`/`.subscribe(` appear **0 times** repo-wide.
- **Contract break:** `phx_reply` of **any** topic sets `connected: true` (`:70-74`) — including a **rejected** join. The UI shows a green **"Realtime aktif"** dot while the `booth:{id}` RLS policy silently denies the channel. No `event_id` dedup, no `version` check (violates PRD §10.6 and ADR-011). Fixed 5 s reconnect, no backoff/jitter/cap (`:90`). `joined` is one boolean for N channels (`:36,88,104`), so `phx_leave` on cleanup is unreliable.
- **Payload is discarded** (`:63-81`): the only effect is `tick++` → `router.refresh()` (`machines-view.tsx:62`, `machine-detail-view.tsx:66`). Defensible — the file's own header comment says the server is the source of truth and status is never computed from the payload — but it means **no field-level update and no way to know which event arrived**.
- **Nothing publishes to `booth:`** (§2.2). The subscription can never fire.

**Actual.** A hand-rolled Phoenix client that reports success on any reply, reconnects on a fixed 5 s timer, discards every payload, and listens to a topic nothing publishes to.

**Expected.** An indicator that reflects reality; dedup + `version` per PRD §10.6 and ADR-011; backoff with jitter and a cap; one `joined` flag per topic.

**Impact.** A green "Realtime aktif" dot while the channel is being dropped by RLS. Even if it connected, the user would get a full `router.refresh()` with no field-level update and no indication of which event arrived.

**Severity.** P1 for the false indicator; P2 for the rest.

**Affected files.** `apps/web/src/components/owner-dashboard/use-booth-realtime.ts`, `machines-view.tsx`, `machine-detail-view.tsx`.

**Affected routes.** `/owner-dashboard/machines`, `/owner-dashboard/machines/[boothId]`.

**Related API.** Phoenix channel `booth:{boothId}`; `realtime.messages` RLS in `20260101000300_realtime.sql`; publisher `publishRealtimeEvent`.

**Status.** CONFIRMED (static). Delivered-event behaviour UNVERIFIED (AUDIT-LIM-02).

**Recommended next action (direction only).** Treat an errored `phx_reply` as a failure; make `joined` per-topic; add backoff + jitter + cap; add `event_id` dedup and a `version` check — ideally by adopting the existing `EventDeduplicator`, which is already written and unused.

---

### BE-016 — P2 — Realtime: **1 of 25 catalog events is ever emitted, 0 are ever consumed**

**Finding.** P2. The catalog, the transport, the publisher helper, and the RLS are all built and correct. The two ends that would make them useful — a publisher at each state change, and a subscriber with handlers — are not.

**Evidence.**

- Emitted: `THEME_UPDATED` only (`kiosk-theme/actions.ts:121,136` → `tenant:{id}`), and it has no subscriber.
- `BROADCAST_CREATED` is published by `broadcast-server.ts:110-149` but as `'broadcast.created'` (lowercase-dotted, **not in `REALTIME_EVENTS`**) with a **snake_case** payload violating PRD §10.6, and **bypassing `realtimeEventSchema.parse()`** entirely (self-documented as debt at `:106-108`).
- `DEVICE_REVOKED` is **never published** on revoke (`machines/actions.ts:298-375` does DB + audit only) — PRD §6.K requires push revocation; a revoked kiosk would keep working forever.
- **No code writes any heartbeat** (§2.6) ⇒ every booth displays `OFFLINE`/`UNPAIRED`, and the four online/offline events can never fire.
- `EventDeduplicator` (`events.ts:95-132`) is **dead code**; PRD §10.6 "handler wajib idempotent" and ADR-011 `version` checking are unenforced.

**Actual.** One event published to nobody, one event published outside the schema, one PRD-mandated event never published, no heartbeat writer, and an unused deduplicator.

**Expected.** Every catalog event emitted on its state change, through `publishRealtimeEvent`, with dedup + `version` enforced on the handler.

**Impact.** Realtime is decorative. Visible symptom: an untrue green dot (FE-022). Invisible symptoms: device revocation never reaches a kiosk, and every booth reads offline.

**Severity.** P2.

**Affected files.** `packages/shared/src/events.ts:26-58,95-132`, `lib/ceo-dashboard/realtime-server.ts:52-77`, `lib/ceo-dashboard/broadcast-server.ts:106-149`, `kiosk-theme/actions.ts:121,136`, `machines/actions.ts:298-375`, `packages/db/migrations/0001_rls_and_realtime.sql:144-166`, `supabase/migrations/20260101000300_realtime.sql`.

**Affected routes.** `/owner-dashboard/machines`, `/owner-dashboard/machines/[boothId]`, `/ceo-dashboard/broadcast`, `/owner-dashboard/kiosk-theme` (publishes), plus every future kiosk route.

**Related API.** `publishRealtimeEvent`, `EventDeduplicator` (uncalled), channels `tenant:{id}` / `booth:{id}` / `broadcast:all` / `user:{uid}`, `POST /api/booth/heartbeat` (**missing**). Table: `realtime.messages`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Publish the catalog events from their state-change sites, wire `EventDeduplicator` and the `version` check, normalise `broadcast.created` through `publishRealtimeEvent`, implement the heartbeat endpoint and the 90 s offline job, and publish `DEVICE_REVOKED` on revoke.

---

### FE-021c (cross-referenced) — P2 — The `user:{userId}` channel contradicts its own RLS

**Finding.** P2, LATENT. The channel name is built from a UUID; the policy that governs it expects a Firebase UID.

**Evidence.** `events.ts:15` builds `user:${userId}` generically, but `20260101000300_realtime.sql:46-49,84` requires the suffix to be the **Firebase UID**; `Session.userId` is a **UUID**. Any future `user:` subscriber is denied.

**Actual.** The two sides of the contract disagree about what `userId` means.

**Expected.** One definition, used by both.

**Impact.** Latent — nothing publishes or subscribes there yet. It becomes a silent authorization failure the moment someone wires a per-user channel, and it will read as "the policy is broken" rather than "the name is wrong".

**Severity.** P2.

**Affected files.** `packages/shared/src/events.ts:15`, `supabase/migrations/20260101000300_realtime.sql:46-49,84`, `lib/auth/session.ts` (`Session.userId`).

**Affected routes.** None today.

**Related API.** `REALTIME_CHANNELS.user`, `realtime.messages` presence policy.

**Status.** LATENT — CONFIRMED (static).

**Recommended next action (direction only).** Decide which identifier the `user:` channel means, then make the helper, the policy, and the session type agree.

---

## 4. What is already correct here

Recorded so a repair pass does not weaken it:

| Control                                     | Evidence                                                                                                                                             | Note                                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Publisher keeps the service key server-side | `realtime-server.ts:8` `import 'server-only'`; HTTP broadcast endpoint instead of the browser client; separate env schemas for URL vs key (`:18-19`) | The browser client never sees the service role                                                           |
| Schema enforced at the publish exit         | `realtimeEventSchema.parse()` at `realtime-server.ts:53`                                                                                             | One chokepoint; the only reason the kiosk-theme publish is conformant                                    |
| HTTPS enforced for the realtime URL         | `realtime-server.ts:40-43`                                                                                                                           | Fails closed on `http:`                                                                                  |
| Bounded publish latency                     | `AbortSignal.timeout(5_000)` at `:71`                                                                                                                | A slow publish cannot hang a server action                                                               |
| `realtime.messages` RLS                     | extension-scoped; `broadcast:all` CEO-gated; presence restricted to own `tenant:`/`user:`; **no browser INSERT policy**                              | The strongest control in the layer                                                                       |
| Deferred `booth:{id}` policy                | `0001_rls_and_realtime.sql:144-166`, `split_part` UUID round-trip                                                                                    | Correctly deferred, correctly written                                                                    |
| No `REPLICA IDENTITY`, no publications      | —                                                                                                                                                    | **Correct**: Broadcast/Presence, not Postgres Changes                                                    |
| Subscriber uses the **anon** key only       | `use-booth-realtime.ts:30,56`; header comment states the service role is never used in a browser                                                     | Correct                                                                                                  |
| Server stays the source of truth            | `use-booth-realtime.ts:3-6`; payload is deliberately not used to compute status                                                                      | A principled decision, not an oversight — the defect is the missing `event_id`/handling, not the discard |
| `EventDeduplicator` is written correctly    | `events.ts:95-132`; LRU-bounded, `stale` vs `duplicate` distinguished                                                                                | It is simply never called                                                                                |

---

## 5. Gap matrix — PRD §10.6 / ADR-011

| Requirement                                 | Implemented                     | Emitted              | Consumed       | Notes                                                                        |
| ------------------------------------------- | ------------------------------- | -------------------- | -------------- | ---------------------------------------------------------------------------- |
| Single event catalog as one source of truth | **yes**                         | —                    | —              | `events.ts:26-58`                                                            |
| Envelope carries `event_id` + `version`     | **yes** (`realtimeEventSchema`) | 1 of 2 publishers    | no             | `broadcast.created` bypasses it                                              |
| Handler idempotent (drop seen `event_id`)   | class written, **never called** | —                    | **no**         | `EventDeduplicator` dead code                                                |
| Drop events with older `version`            | class written, **never called** | —                    | **no**         | ADR-011 unenforced                                                           |
| Publish on device/booth state change        | no                              | **no**               | —              | incl. `DEVICE_REVOKED` (PRD §6.K)                                            |
| Publish on configuration change             | partial                         | `THEME_UPDATED` only | **no**         | `CONFIG_UPDATED`, `PACKAGE_UPDATED`, `FRAME_UPDATED`, `PROMO_UPDATED` silent |
| Publish on payment state change             | no                              | **no**               | —              | no payment path exists (BE-011)                                              |
| Publish on photo-session state change       | no                              | **no**               | —              | no kiosk exists (BE-002)                                                     |
| Publish on subscription state change        | no                              | **no**               | —              | no cron exists (BE-013)                                                      |
| Heartbeat / online detection                | Phoenix keep-alive only         | **no**               | —              | `booths.last_heartbeat_at` never written                                     |
| Indicator reflects real connection state    | **no**                          | —                    | —              | green dot on a rejected join (FE-022)                                        |
| Reconnect with backoff, jitter, cap         | fixed 5 s only                  | —                    | —              | `:90`                                                                        |
| Channel authorization                       | **yes** (RLS)                   | —                    | one subscriber | `user:` naming conflict (FE-021c)                                            |

---

## 6. What a runtime pass would need to test

1. Connect to `/realtime/v1/websocket` with the anon key and attempt `phx_join` on `booth:{someOtherTenantBoothId}` — confirm the RLS denial that the UI currently reports as success.
2. Publish `THEME_UPDATED` to `tenant:{id}` and confirm whether any browser receives it (predicted: no).
3. Publish `DEVICE_REVOKED` on a real revoke and confirm nothing is emitted (predicted: nothing).
4. Measure reconnect behaviour when the socket is refused — confirm the 5 s fixed loop with no jitter (predicted: a tight, synchronised retry storm).
5. Confirm whether `realtime.messages` RLS is even reached from the WebSocket path (predicted: yes — this path authenticates as anon/service, so BE-001 does not apply here).
6. Attempt a `user:{session.userId}` join (a UUID) — predicted: denied, per FE-021c.

---

## Cross-references

- Canonical statements: `01_FRONTEND_AUDIT.md` FE-022, FE-021c; `05_BACKEND_API_AUDIT.md` BE-016, BE-011, BE-013.
- RLS and tenant mechanics: `08_DATABASE_TENANT_AUDIT.md`, `06_SECURITY_AUDIT.md`.
- Ordered remediation direction: `10_RECOMMENDED_REPAIR_ORDER.md` §8A items 46-48 (frontend queue) and §8B items 23, 26 (backend queue) — kept separate.
