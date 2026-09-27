# 02 — Frontend Route Matrix

**Source:** `.kilo/plans/1790436768946-snapbox-forensic-audit.md` §4
**Status of this document:** audit result. No source file was modified.
**Method:** filesystem enumeration + first read of each route file. No assumption was taken from a file or folder name.

## Legend

| Term      | Meaning                            |
| --------- | ---------------------------------- |
| `REAL`    | DB-backed                          |
| `MOCK`    | hardcoded / labelled demo          |
| `PARTIAL` | real data, missing requirement     |
| `BROKEN`  | real code path that cannot succeed |
| `STUB`    | renders, no data                   |
| `DEAD`    | unreachable                        |
| `MISSING` | route does not exist               |

**Runtime caveat:** every claim in this matrix is static. No route was rendered (AUDIT-LIM-01). "Renders" means the route file was read and its component tree traced — not that it was observed.

---

## A. Public

| Route                            | Exists    | Renders                                          | Data                                                                                                                         | API                                                  | Auth               | Role   | Scope | Responsive                     | States                               | Status                                                   |
| -------------------------------- | --------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------ | ------ | ----- | ------------------------------ | ------------------------------------ | -------------------------------------------------------- |
| `/`                              | Y         | `app/(public)/page.tsx` 380 LOC                  | `content/public.ts`, typed `pending` markers, 3 real "Coming soon" prices, placeholder logo marquee, real "Demo frame" block | none                                                 | none               | public | n/a   | `public-*` media queries 767px | pending markers                      | **PARTIAL**                                              |
| `/tentang`                       | Y         | 1 file                                           | static copy; mission text explicitly absent                                                                                  | none                                                 | none               | public | n/a   | UNVERIFIED                     | n/a                                  | **PARTIAL**                                              |
| `/fitur`                         | Y         | 1 file                                           | 6 modules w/ labelled `MockupPlaceholder`                                                                                    | none                                                 | none               | public | n/a   | UNVERIFIED                     | pending labels                       | **PARTIAL**                                              |
| `/harga`                         | Y         | 1 file                                           | 3 tiers, prices `"Coming soon"`                                                                                              | none                                                 | none               | public | n/a   | UNVERIFIED                     | n/a                                  | **MOCK**                                                 |
| `/kamera`                        | Y         | 1 file                                           | camera registry explicitly unavailable (`content/public.ts:433`)                                                             | none                                                 | none               | public | n/a   | UNVERIFIED                     | n/a                                  | **STUB** (ADR-009 table absent)                          |
| `/kontak`                        | Y         | 1 file                                           | form **disabled** — "Formulir belum tersedia"                                                                                | none                                                 | none               | public | n/a   | UNVERIFIED                     | disabled+reason                      | **STUB** (Turnstile + Resend absent)                     |
| `/docs/troubleshooting`          | Y         | 1 file                                           | static 6-step                                                                                                                | none                                                 | none               | public | n/a   | UNVERIFIED                     | n/a                                  | **REAL (static)**                                        |
| `/login`                         | Y         | `login-form.tsx` 289 LOC                         | Firebase Client SDK → `POST /api/auth/session`                                                                               | `POST /api/auth/session`, `POST /api/auth/staff-pin` | public             | all    | —     | `auth-*` @860px                | pending, error, `role=alert`, notice | **IMPLEMENTED** (unreachable from header — FE-008)       |
| `/unauthorized`                  | Y         | yes                                              | static                                                                                                                       | none                                                 | public             | any    | n/a   | UNVERIFIED                     | n/a                                  | **REAL**                                                 |
| `/unduh-aplikasi`                | Y         | 1 file                                           | both installers `Coming soon`; changelog `Coming soon`; device-console link disabled ("bukan rute di aplikasi ini")          | none                                                 | none               | public | n/a   | UNVERIFIED                     | disabled+reason                      | **PARTIAL**                                              |
| `/download/[token]`              | **N**     | —                                                | —                                                                                                                            | —                                                    | —                  | —      | —     | —                              | —                                    | **MISSING** (PC-04)                                      |
| `/legal/privacy`, `/legal/terms` | **N**     | —                                                | —                                                                                                                            | —                                                    | —                  | —      | —     | —                              | —                                    | **MISSING** (PC-05)                                      |
| `/gallery`                       | Y (extra) | 5 files, ~64 primitives + `picsum.photos` images | n/a                                                                                                                          | none                                                 | **none — no auth** | public | n/a   | UNVERIFIED                     | n/a                                  | **REACHABLE internal gallery**, `robots.ts:16` blocks it |

**Public notes.**

- `/kontak` is the endpoint Cloudflare's rate-limit draft and README verification procedure both target (BE-028); the route exists but the form is disabled, so a 429 can never be observed.
- `/download/[token]` is required by PRD §3.A and §7.2 and by `robots.ts:20`; it does not exist. See PC-04.
- `/gallery` is a real internal component gallery shipped inside the public group with no auth. It is blocked in `robots.txt` but reachable by URL.

---

## B. CEO (13 nav items)

| Route                          | Exists            | Renders                    | Data                                                                  | Auth layer                                | Status                                                                  |
| ------------------------------ | ----------------- | -------------------------- | --------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| `/ceo-dashboard`               | Y                 | `DashboardView`            | `CONTOH_*`                                                            | middleware only (mock)                    | **MOCK** (labeled)                                                      |
| `/ceo-dashboard/tenants`       | Y                 | `TenantsView`              | `CONTOH_TENANTS` (20 dummy) + UUID lookup                             | middleware only                           | **MOCK** (labeled)                                                      |
| `/ceo-dashboard/tenants/new`   | Y                 | `TenantProvisioningWizard` | **REAL** `listPlanOptions()`                                          | ⚠️ **middleware only, no `requireCeo()`** | **PARTIAL + AUTHZ GAP** (BE-006)                                        |
| `/ceo-dashboard/tenants/[id]`  | Y                 | inline RSC 282 LOC         | **REAL** profile/subs/booths/activity/quota                           | ⚠️ **middleware only, no `requireCeo()`** | **PARTIAL + AUTHZ GAP** (BE-006)                                        |
| `/ceo-dashboard/subscriptions` | Y                 | `SubscriptionsClient`      | **REAL**                                                              | `requireCeo()` + loaders                  | **IMPLEMENTED**                                                         |
| `/ceo-dashboard/plans`         | Y                 | `PlansEditor`              | **REAL**                                                              | `requireCeo()`                            | **IMPLEMENTED**                                                         |
| `/ceo-dashboard/devices`       | **N** (catch-all) | `DevicesView`              | `CONTOH_DEVICES`                                                      | middleware only                           | **MOCK**                                                                |
| `/ceo-dashboard/broadcast`     | Y                 | `BroadcastView`            | **REAL**                                                              | `requireCeo()` ×3 layers                  | **IMPLEMENTED**                                                         |
| `/ceo-dashboard/activity-log`  | **N** (catch-all) | `ActivityLogView`          | `CONTOH_ACTIVITIES`                                                   | middleware only                           | **MOCK**                                                                |
| `/ceo-dashboard/promos`        | Y                 | `PromosEditor`             | **REAL**                                                              | `requireCeo()`                            | **IMPLEMENTED**                                                         |
| `/ceo-dashboard/settings`      | Y                 | `SettingsView`             | **REAL** `platform_settings` (allowlisted non-secret)                 | `requireCeo()`                            | **IMPLEMENTED** (nav copy wrongly promises "kunci API master" — BE-019) |
| `/ceo-dashboard/system-health` | Y                 | `SystemHealthClient`       | **REAL** `system_health_checks`, `webhook_events`, `webhook_failures` | inside loader                             | **PARTIAL** (cron/queue display = "Belum tersedia")                     |
| `/ceo-dashboard/security`      | Y                 | `SecurityClient`           | **REAL** `security_events`, `auth_sessions`                           | inside loader                             | **PARTIAL** (WAF/rate-limit = "Belum tersedia")                         |
| `/ceo-dashboard/[...segments]` | Y                 | `CeoView`                  | mock                                                                  | middleware                                | **DEAD-ish** safety net                                                 |

**CEO notes.**

- 4 of 13 routes are mock. 2 of them (`devices`, `activity-log`) have **no route folder** and are reachable only through the catch-all.
- 2 routes read real PII under middleware-only authorization (BE-006). Exposed fields: `ownerEmail`, `ownerPhone`, `address`, `notes`, plan tiers, subscription amounts, booth names, audit-actor emails.
- `/ceo-dashboard/settings` is the one route where the **code is right and the copy is wrong**: the nav promises a master API key that `settings-view.tsx:97-101` deliberately does not render.
- `system-health` and `security` are real but explicitly render "Belum tersedia" for the cron/queue and WAF/rate-limit panels, which are JSON drafts only (BE-028).

---

## C. Owner (19 nav items + 2 detail + 1 export)

| Route                            | Exists | Data                                                                                     | Status                                                                         |
| -------------------------------- | ------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `/owner-dashboard` (root)        | Y      | **REAL** 4 scalars                                                                       | **PARTIAL** — no KPIs/charts/alerts/quick actions (FE-006)                     |
| `/owner-dashboard/[...segments]` | Y      | —                                                                                        | **DEAD** ("Segera hadir" unreachable)                                          |
| `/outlets`                       | Y      | **REAL** `outlets⋈booths` + quota                                                        | **PARTIAL** — inactive unreachable (FE-012)                                    |
| `/outlets/[id]`                  | Y      | **REAL** incl. `sum(finalAmount) where PAID`                                             | **PARTIAL** — read-only server component (FE-013)                              |
| `/machines`                      | Y      | **REAL** `booths⋈outlets` + quota + realtime badge                                       | **PARTIAL** — double token mint, no confirm on revoke/regenerate               |
| `/machines/[boothId]`            | Y      | **REAL** `booths`, `packages`, `sessions`(15)                                            | **IMPLEMENTED**                                                                |
| `/devices`                       | Y      | **REAL** `devices⋈booths` + add-on count                                                 | **IMPLEMENTED**                                                                |
| `/frame-studio`                  | Y      | **REAL** `frames`, `boothFrames`, signed URLs via `sharp`                                | **IMPLEMENTED** (strongest module)                                             |
| `/templates`                     | Y      | **REAL** `templates`                                                                     | **IMPLEMENTED**                                                                |
| `/packages`                      | Y      | **REAL** `packages⋈booths`                                                               | **IMPLEMENTED**                                                                |
| `/kiosk-theme`                   | Y      | **REAL** `kioskThemes`+versions; server-side 4.5:1 contrast gate                         | **PARTIAL** — INSERT-on-GET, publish without confirm                           |
| `/promos`                        | Y      | **REAL** `promos`+redemption count                                                       | **PARTIAL** — no edit UI, no quota inputs, "Hapus"=disable                     |
| `/payment-settings`              | Y      | **REAL** `b2cPaymentConfigs`; **real** test-connection calls to 4 live gateway endpoints | **PARTIAL** — entitlement result discarded, no list/delete                     |
| `/staff`                         | Y      | **REAL** `users` + quota + Firebase invite                                               | **IMPLEMENTED**                                                                |
| `/customers`                     | Y      | **NONE**                                                                                 | **STUB**                                                                       |
| `/transactions`                  | Y      | **REAL** `transactions⋈booths⋈outlets`, filters, pagination                              | **IMPLEMENTED**                                                                |
| `/transactions/export`           | Y      | **REAL**                                                                                 | **IMPLEMENTED** (hand-rolled ZIP, CSV-only — FE-021f)                          |
| `/finance`                       | Y      | **HARDCODE**                                                                             | **MOCK** (labeled)                                                             |
| `/analytics`                     | Y      | **HARDCODE**                                                                             | **MOCK** (labeled)                                                             |
| `/reports`                       | Y      | **HARDCODE** `DAILY_ROWS`                                                                | **MOCK** (labeled)                                                             |
| `/subscription`                  | Y      | **REAL** `b2bSubscriptions⋈plans`                                                        | **PARTIAL** — 3/4 CTAs dead; **plus P1 self-redirect loop for expired owners** |
| `/notifications`                 | Y      | **REAL query, WRONG ARGS**                                                               | **BROKEN**                                                                     |
| `/settings`                      | Y      | **REAL** `users`                                                                         | **PARTIAL + UNSTYLED** (FE-003)                                                |
| `/support`                       | Y      | **REAL** Resend                                                                          | **PARTIAL + UNSTYLED** (FE-003, FE-021i)                                       |

**Owner scorecard (static):** 8 IMPLEMENTED · 11 PARTIAL · 3 MOCK · 1 STUB · 1 BROKEN · 1 DEAD.

### P1 — `/owner-dashboard/subscription` is an infinite redirect loop for expired owners

`layout.tsx:14` calls `getOwnerLayoutData()` with **no** options; `owner-layout-data.ts:66-71` redirects to `/owner-dashboard/subscription` when the subscription is unusable; that page lives under the same layout, so the layout runs again and redirects again. The `allowInactiveSubscription` escape hatch is passed **only** by the catch-all (`[...segments]/page.tsx:46`), which is shadowed by the real route and `notFound()`s `'subscription'` (`:35`). The PRD-mandated recovery page is unreachable for exactly the users who need it.

- **Actual.** A redirect target that lives under the redirecting layout, with its only bypass shadowed by the real route.
- **Expected.** A recovery page reachable by the users whose subscription is unusable.
- **Impact.** An expired owner cannot load the page that would let them renew.
- **Severity.** P1.
- **Affected files.** `owner-dashboard/layout.tsx:14`, `owner-layout-data.ts:66-71`, `[...segments]/page.tsx:35,46`.
- **Affected routes.** `/owner-dashboard/subscription` (and, transitively, every `/owner-dashboard/**` route for an expired owner).
- **Related API.** `getOwnerLayoutData`, `isSubscriptionUsable` (`authorization.ts`).
- **Status.** CONFIRMED (static).
- **Recommended next action (direction only).** Pass `allowInactiveSubscription` from the layout for that path, and delete the now-dead catch-all branch.

---

## D. Staff

All of `/staff-dashboard`, `/staff-dashboard/machines`, `/staff-dashboard/machines/[boothId]`, `/staff-dashboard/notifications`, `/staff-dashboard/profile`, and the LAN `/staff-auth` (PRD §5.4) are **MISSING**. `middleware.ts:46` and `route-policy.ts:23,44` already reference `/staff-dashboard`, and `safeHomeForRole('STAFF')` returns `null` (`route-policy.ts:81`) → a Staff login lands on `/unauthorized`.

**A Staff account can do nothing at all.**

- **Actual.** Policy, middleware, and role home all reference a dashboard that does not exist, and resolve Staff to `null`.
- **Expected.** A Staff account reaches a working Staff surface, with destructive actions disabled (PRD Task 2.18 / §5.4).
- **Impact.** Staff can authenticate but cannot act. The Staff PIN login path (FE-020) also always fails, so the role is entirely non-functional.
- **Severity.** P1 for a shipped role that does nothing; P2 for the missing LAN route (also PC-03).
- **Affected files.** `middleware.ts:46`, `route-policy.ts:23,44,81`.
- **Affected routes.** `/staff-dashboard/**` (all MISSING), `/staff-auth` (MISSING), `/unauthorized` (where Staff lands).
- **Related API.** `POST /api/auth/staff-pin` (always `PIN_REJECTED`).
- **Related.** BE-005: adding `/staff-dashboard` before granular RBAC is wired would hand Staff OWNER-class destructive access, because `STAFF_PERMISSIONS` is dead code.
- **Status.** CONFIRMED (static).
- **Recommended next action (direction only).** Decide granular RBAC first (BE-005); only then decide whether to build `/staff-dashboard` and `/staff-auth`.

---

## E. Device Console (Web)

All six PRD routes are **MISSING**: `/owner-dashboard/devices/[boothId]/diagnostics` and `…/kamera`, `…/printer`, `…/operator`, `…/sistem`, `…/riwayat`. There is no `devices/[boothId]` folder at all.

- **Actual.** Zero of six routes exist; the parent segment does not exist either.
- **Expected.** PRD §3.E and Tasks 3.6–3.11.
- **Impact.** A REVOKED device has no web fallback. The `/owner-dashboard/devices` list is therefore the entire device surface, and it shows data that no code populates (`devices` is never inserted — BE-003).
- **Severity.** P1 (scheduled as Fase 3; PRD §11 Fase 2 acceptance nonetheless claims full dashboard navigation — PC-09).
- **Affected routes.** All six MISSING.
- **Related API.** None exist.
- **Status.** CONFIRMED (static).
- **Recommended next action (direction only).** Add the six routes, or state explicitly that they are Fase 3 and remove them from PRD §3.

---

## F. Kiosk (Tauri)

**Not a web route.** Tauri desktop is 518 LOC total (274 TS + 154 Rust), 1 `#[tauri::command]` (`get_app_info`, never called), and `App.tsx` is 25 lines rendering one `<h1>`, one `<p>`, and a badge reading `Hardware engine belum terpasang`.

- **0 / 18** PRD §F kiosk features
- **0 / 17** §R kiosk states
- **0 / 9** §10.9 hardware traits
- **0 / 15** Fase 5 customer-flow tasks
- **0 / 8** §7.5 payment steps
- Overall completeness **≈6%** (Fase-0 scaffolding only)

Full detail in `05_BACKEND_API_AUDIT.md` → BE-002.

---

## Route totals

| Group             | Routes in PRD             | Exists | Real/Implemented | Partial | Mock | Broken | Stub | Dead | Missing       |
| ----------------- | ------------------------- | ------ | ---------------- | ------- | ---- | ------ | ---- | ---- | ------------- |
| A. Public         | 11 (+2 legal, 1 download) | 11     | 3                | 4       | 1    | 0      | 2    | 0    | 3             |
| B. CEO            | 13 (+1 catch-all)         | 11     | 6                | 3       | 4    | 0      | 0    | 1    | 2 (no folder) |
| C. Owner          | 19 (+2 detail, +1 export) | 22     | 8                | 11      | 3    | 1      | 1    | 1    | 0             |
| D. Staff          | 6 (incl. LAN)             | 0      | 0                | 0       | 0    | 0      | 0    | 0    | 6             |
| E. Device Console | 6                         | 0      | 0                | 0       | 0    | 0      | 0    | 0    | 6             |
| F. Kiosk          | 1 app (18 features)       | 1      | 0                | 0       | 0    | 0      | 1    | 0    | 0             |

---

## Cross-references

- Per-finding detail for the routes above: `01_FRONTEND_AUDIT.md`.
- UX/UI deep dive (FE-006, FE-011…FE-018): `03_FRONTEND_UX_UI_AUDIT.md`.
- API contract deep dive (FE-005, FE-021, FE-022): `04_FRONTEND_API_CONTRACT.md`.
- PRD conflict rows PC-01…PC-14: `09_PRD_IMPLEMENTATION_MATRIX.md`.
