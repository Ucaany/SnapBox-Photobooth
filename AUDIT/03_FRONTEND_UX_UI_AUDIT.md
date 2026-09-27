# 03 — Frontend UX / UI Audit

**Source:** `.kilo/plans/1790436768946-snapbox-forensic-audit.md` §3 — findings FE-003 (a–e), FE-006, FE-011 … FE-018, plus §3B (duplication quantification)
**Status of this document:** audit result. No source file was modified.
**Canonical form:** these findings are also stated in `01_FRONTEND_AUDIT.md`. This file is the UX/UI deep dive: it reorganises the same evidence by user-visible symptom.

**Per-finding template:** Finding / Evidence / Actual / Expected / Impact / Severity / Affected files / Affected routes / Related API / Status / Recommended next action (direction only, never code).

**Critical read-limit reminder (AUDIT-LIM-01):** no build, typecheck, lint, test, rendered UI, bundle-size, or network inspection was possible. Every finding below is static-code evidence. **Nothing here may be read as runtime acceptance.** In particular FE-017 and FE-018 are partly or wholly UNVERIFIED.

---

## Symptom → cause map

The reported complaint is "dashboard berantakan / tidak konsisten". This audit found that the cause is **not** slop (FE-016: the primitives are genuinely neobrutalist) and **not** responsive breakage (FE-017: the sidebar is correct). It is five distinct mechanisms:

| #   | Mechanism                                                                                                                                             | Findings                      | User-visible symptom                                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Silent token drops.** Tailwind v4 emits nothing for a utility whose theme variable is undefined — no error, no warning.                             | FE-002                        | Every "secondary/eyebrow/hint" line renders at inherited black → no typographic hierarchy. Every validation error renders as normal text → errors are invisible. **This is the single mechanical cause of "berantakan".** |
| 2   | **Missing primitives.** Classes used but defined nowhere.                                                                                             | FE-003 (a–e), FE-003b, FE-004 | Six CEO pages render unstyled sections; two Owner pages render browser-default form controls inside a styled shell.                                                                                                       |
| 3   | **Unguarded and unlayered CSS.** 87% of `globals.css` is outside every CI guard and outside any `@layer`, so it silently outranks Tailwind utilities. | FE-003b, FE-003c              | Dead classes persist, and two live `bg-*` utilities already lose to hand-written rules.                                                                                                                                   |
| 4   | **Empty surface area.** Real routes with no data, hardcoded data, or no data function.                                                                | FE-005, FE-006                | The dashboard root shows 4 numbers; finance shows Rp 48.9 M for a tenant with zero transactions; notifications is always empty.                                                                                           |
| 5   | **No state contract.** No loading/error/empty boundaries anywhere in `app/`.                                                                          | FE-011                        | No loading feedback on 19+ routes; a DB error destroys the whole layout.                                                                                                                                                  |

Two further UI findings are systemic rather than symptomatic: design-system drift (FE-014) and a hardcoded editor (FE-015).

---

## FE-006 — P1 — `/owner-dashboard` root is a **3-number stub**; `finance`, `analytics`, `reports` are **hardcoded mocks**; `customers` is a **static stub**

**Finding.** P1 (data integrity) for finance/analytics/reports; P1 for the hollow dashboard root; P2 for customers. Four of twenty Owner nav slots show fabricated or absent data.

**Evidence.**

- `page.tsx:13-29` renders `ownerName`, `planName`, `deviceUsage`, `deviceQuota` only. **No** revenue-today, paper-stock alert, 7-day chart, booth online/offline summary, or quick actions (PRD §3.C).
- `finance/page.tsx` and `analytics/page.tsx` are **8-line files passing no data prop**; `finance-analytics-view.tsx:19-29` imports `finance-analytics-demo.ts`:
  - `FINANCE_SUMMARY` (Rp 1 840 000 / 12 460 000 / 48 920 000)
  - `OUTLET_BREAKDOWN` ("Contoh Outlet A/B/C")
  - `REVENUE_30_DAYS` (procedural `1_120_000 + ((day*173_000 + (day%4)*91_000) % 1_420_000)`)
  - `PAYMENT_METHODS`, `CONVERSION_FUNNEL`, `WEEKLY_RETENTION`.
- `reports/page.tsx` + `reports-view.tsx:6-35` synthesise rows from `DAILY_ROWS` with hardcoded epoch `Date.UTC(2026, 8, 26)`; CSV/PDF/schedule are client-only; schedule toggles `useState` with no persistence.
- `customers/page.tsx:5-14` calls **no data function at all**.
- Disclosure banners do exist: `finance-analytics-view.tsx:360-369`, `reports-view.tsx:66-72,200`.

**Actual.** The dashboard root renders four scalars. Two 8-line pages render procedural numbers from a demo module. One page synthesises rows from a hardcoded epoch. One page calls no data function at all.

**Expected.** DB-backed metrics (PRD §3.C: revenue today, paper-stock alert, 7-day chart, booth online/offline summary, quick actions).

**Impact.** An Owner sees fabricated Rp 48.9 M "monthly revenue" for a tenant with zero transactions. Disclosure banners exist — so these are **honest mocks**, but they occupy 4 of 20 Owner nav slots and will be read as real numbers in screenshots/demos. `finance-analytics-view` and `reports-view` also have no empty state at all (see FE-011).

**Severity.** P1 (data integrity) for finance/analytics/reports; P1 for the hollow dashboard root; P2 for customers.

**Affected files.** `app/(owner-dashboard)/owner-dashboard/page.tsx`, `finance/page.tsx`, `analytics/page.tsx`, `reports/page.tsx`, `reports-view.tsx`, `customers/page.tsx`, `finance-analytics-view.tsx`, `finance-analytics-demo.ts`.

**Affected routes.** `/owner-dashboard`, `/owner-dashboard/finance`, `/owner-dashboard/analytics`, `/owner-dashboard/reports`, `/owner-dashboard/customers`.

**Related API.** None. No data function exists for any of the four. A real implementation would need a `finance-analytics-server.ts` over `transactions`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Decide demo-vs-real per route. If real, they need a `finance-analytics-server.ts` over `transactions`; if demo, they must not sit behind a nav slot that implies live business data.

---

## FE-003 (a) — P0 — **Four class families are used but never defined**, and 63 further CSS rules are dead

**Finding.** P0 (`.ceo-panel`) / P1 (owner trio). The second silent-failure class: `className` values that resolve to nothing. 22 references across 9 files have no matching rule; 63 more rules have zero usages.

**Evidence.**

| Undefined class                                   | Used    | Where                                                                                                                                                                                                                                     | Rendering result                                                                                                                                                                                                     |
| ------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.ceo-panel`                                      | **13×** | `tenants/[id]/page.tsx:90,103,121,132,173,193`; `tenants/new/tenant-provisioning-wizard.tsx:183,210`; `tenants/[id]/tenant-detail-actions.tsx:216`; `subscriptions-client.tsx:135`; `promos-editor.tsx:197`; `views/tenants-view.tsx:110` | 6 live Super-Admin pages render major sections as bare unstyled `<section>`. The intended rule **`.ceo-panel-static` exists (`globals.css:2019-2025`) and is used 0 times**                                          |
| `.ceo-kicker`                                     | 2×      | `tenants/[id]/page.tsx:77`; `tenant-provisioning-wizard.tsx:184`                                                                                                                                                                          | undefined (`.ceo-header-kicker` at `globals.css:865` exists)                                                                                                                                                         |
| `.ceo-icon`                                       | 1×      | `ceo-header.tsx:48`                                                                                                                                                                                                                       | undefined — icon sizing lost                                                                                                                                                                                         |
| `.ceo-tenant-actions`                             | 1×      | `tenant-detail-actions.tsx:216`                                                                                                                                                                                                           | undefined                                                                                                                                                                                                            |
| `.owner-section`, `.owner-eyebrow`, `.owner-form` | 6×      | `settings-view.tsx:27,28,30`; `support-view.tsx:26,27,30`                                                                                                                                                                                 | **browser-default HTML** — bare `<input>`/`<select>`/`<textarea>`/`<button>` with **zero Tailwind classes and zero `@snapbox/ui`**: no border, no shadow, no radius, no brand, no 44px tap target, **no focus ring** |

Additionally dead: 44 lines of `.owner-outlet-*` (`globals.css:1372-1455`, 0 usages — including `.owner-outlet-table-scroll`, the exact fix FE-017 needs) and 19 `.ceo-*` rules (`ceo-compare*`, `ceo-cron*`, `ceo-plan*`, `ceo-queue*`, `ceo-setting-{caret,list,note,trigger}`, `ceo-inline-toggle`, `ceo-plans`).

**Actual.** Four families referenced 22 times, defined zero times; 63 rules defined and used zero times.

**Expected.** Every referenced class resolves; every rule has a consumer or is deleted.

**Impact.** Six Super-Admin pages including the tenant-PII detail page render unstyled sections. Two Owner pages render browser-default controls with no focus ring.

**Severity.** P0 for `.ceo-panel`; P1 for the owner trio.

**Affected files.** `globals.css`, `ceo-dashboard/tenants/[id]/page.tsx`, `tenant-provisioning-wizard.tsx`, `tenant-detail-actions.tsx`, `subscriptions-client.tsx`, `promos-editor.tsx`, `views/tenants-view.tsx`, `ceo-header.tsx`, `settings-view.tsx`, `support-view.tsx`.

**Affected routes.** `/ceo-dashboard/tenants`, `/ceo-dashboard/tenants/[id]`, `/ceo-dashboard/tenants/new`, `/ceo-dashboard/subscriptions`, `/ceo-dashboard/promos`, `/owner-dashboard/settings`, `/owner-dashboard/support`.

**Related API.** None (styling layer); affects every CEO loader-backed page.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Add a CI guard that every `className` matching `\.(ceo|owner|public|auth)-[a-z-]+` has a matching CSS rule — closing the class, not the 22 instances.

---

## FE-003b — P1 — `check-token-sync.mjs` guards **13% of `globals.css`**

**Finding.** P1. The only CSS guard in CI covers ~13% of the file — and every dead-class bug lives in the other 87%.

**Evidence.** The guard compares only `:root`, `@theme inline`, `@layer base`, `@utility`, `@layer components` (`scripts/check-token-sync.mjs`) between `globals.css` and `packages/ui/src/styles.css`. Lines **378-2681** (`.public-*`, `.auth-*`, `.ceo-*`, `.owner-*`, `.ceo-promo-*`) are 2 300+ lines, entirely unguarded, self-documented at `globals.css:368-373`. The guard passes and is correct inside its scope.

**Actual.** A working guard pointed at the wrong 13%.

**Expected.** Guard scope proportional to the file's risk.

**Impact.** FE-002 and FE-003 are invisible to CI, and no future instance will be caught.

**Severity.** P1.

**Affected files.** `scripts/check-token-sync.mjs`, `globals.css`, `.github/workflows/ci.yml`.

**Affected routes.** None directly; it is the guard for all of them.

**Related API.** `pnpm check:token-sync` (CI step "7 repo guards").

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Extend the guard past the token block, or wrap the hand-written lines in a layer the guard can see.

---

## FE-003c — P1 — The hand-written CSS scopes are **unlayered**, so they silently outrank Tailwind utilities

**Finding.** P1. `globals.css:378+` writes `.public-*` / `.ceo-*` / `.owner-*` outside any `@layer`; unlayered declarations beat Tailwind's `utilities` layer at equal specificity. Two collisions are already live.

**Evidence.**

- `(public)/layout.tsx:14` renders `class="public-shell … bg-background"`; `.public-shell{background-color:#fffef5}` (`globals.css:380`) wins ⇒ `bg-background` is dead. It works — by accident.
- `ceo-sidebar.tsx:45` renders `<SidebarInset className="ceo-shell">`; `SidebarInset`'s `bg-secondary-background` (`sidebar.tsx:297`) is overridden by `.ceo-shell{background-color:var(--background)}` (`globals.css:723`).
- Adding any `@layer` to `globals.css` would flip every one of these at once, with no diff to review.

**Actual.** Precedence is decided by file position rather than stated intent; two utilities are already dead.

**Expected.** A deliberate, documented precedence order between hand-written scopes and Tailwind utilities.

**Impact.** Two live dead classes now; an unenumerable number of latent ones.

**Severity.** P1.

**Affected files.** `globals.css`, `(public)/layout.tsx`, `ceo-sidebar.tsx`, `packages/ui/src/components/sidebar.tsx`.

**Affected routes.** All public routes, all `/ceo-dashboard/**`.

**Related API.** None.

**Status.** CONFIRMED (static) for the two collisions; UNVERIFIED for the remainder (AUDIT-LIM-01).

**Recommended next action (direction only).** Put the hand-written scopes into an explicit layer with a deliberate precedence over `utilities`, and record it in an ADR. Enumerate existing collisions first — they will change when the layer is added.

---

## FE-003d — P1 — `/gallery` is **public, unauthenticated, and unlinked** — and it justifies 64% of the design system

**Finding.** P1. An internal component catalog is anonymously reachable and is the primary consumer of the UI library.

**Evidence.**

- `middleware.ts:43-49` matcher omits `/gallery` ⇒ no auth, no role check. `robots.ts:15`, `sitemap.ts:41`, `gallery/page.tsx:12-17` are all **advisory to crawlers, not access control**.
- `grep '/gallery'` outside `app/gallery/` returns 3 hits, all comments — zero `<Link>`, zero nav entry.
- It renders **41 of the 64 UI primitives**; only **20 (31%)** are used in product UI, 3 are used nowhere.
- It ships `@tanstack/react-table`, `react-day-picker`, `recharts`, `react-hook-form`, `zod` as publicly downloadable chunks (`gallery-heavy-data.tsx:1-17`, `primitives-section.tsx:134`) and displays 20 dummy tenant names + 3 dummy device IDs.
- `ADR-002:42-43, 57-60` is stale: it claims `/` is the gallery and `/` is noindex (PC-13).

**Actual.** A noindex, robots-blocked, unlinked, unauthenticated page is the main consumer of the component library and five heavy client dependencies.

**Expected.** Gate an internal catalog by auth or environment; make the ADR true.

**Impact.** Anonymous visitors can inventory the internal component surface and demo data model; the library's true adoption (20/64) is hidden from readers of the repo.

**Severity.** P1.

**Affected files.** `middleware.ts:43-49`, `app/gallery/**`, `gallery-heavy-data.tsx`, `primitives-section.tsx`, `example-data.ts`, `robots.ts`, `sitemap.ts`, `packages/ui/src/components/**`, `docs/ADR-002-neobrutalism-tokens.md:42-43,57-60`.

**Affected routes.** `/gallery`.

**Related API.** None.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Gate `/gallery` behind non-production or `notFound()`; that one decision also scopes how much of `packages/ui` is required. Correct ADR-002 (PC-13).

---

## FE-003e — P2 — `global-error.tsx` is **off-system and probably unstyled**

**Finding.** P2. The last-resort error page is the only page that does not use the design system, and it may not load the stylesheet.

**Evidence.** `global-error.tsx:32` renders a bare `<html lang="id-ID">`, **replacing `layout.tsx`**, so `next/font` variables (`spaceGrotesk.variable`, `layout.tsx:88`) never apply; `font-[family-name:var(--font-display)]` (`:33`) falls back to `ui-sans-serif`. Whether `globals.css` survives this boundary is **UNVERIFIED** — if not, `bg-background`/`border-border`/`bg-main` (`:33,45`) are dead. The button (`:42-48`) is a bare `<button>` with **no `rounded-base`, no `shadow-shadow`, no `min-h-11`**. Layout `flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center` (`:34`).

**Actual.** Off-system page replacing the root layout, using no primitive, depending on CSS that may not apply.

**Expected.** The error boundary renders in the same design system, with fonts re-applied explicitly.

**Impact.** Every unhandled error — including any of the 19+ routes with no `error.tsx` — lands on a page with the wrong font and possibly no styles.

**Severity.** P2.

**Affected files.** `app/global-error.tsx`, `app/layout.tsx:19-38,88`.

**Affected routes.** None directly; the boundary for all.

**Related API.** None.

**Status.** CONFIRMED (static) structurally; UNVERIFIED for stylesheet survival (AUDIT-LIM-01).

**Recommended next action (direction only).** Re-apply the font variables explicitly and use the `Button` primitive with `rounded-base` + `shadow-shadow` + `min-h-11`. Confirm stylesheet survival with a build.

---

## FE-011 — P2 — Zero `loading.tsx` / `error.tsx` / `not-found.tsx` in the entire `app/` tree

**Finding.** P1 per PRD §11 Definition of Done, which explicitly requires loading state, empty state, and skeleton state for a feature to count as done.

**Evidence.** Only `app/global-error.tsx` exists. No route uses `<Suspense>`, so **all 19+ data routes have no loading UI**; a DB throw escalates to full-page `global-error.tsx`, which replaces the whole layout. `finance-analytics-view.tsx` and `reports-view.tsx` have no empty state at all.

**Actual.** Zero route-level loading, error, or not-found boundaries; no `<Suspense>` anywhere in the app tree.

**Expected.** Per-segment boundaries, per PRD §11 Definition of Done: "Loading state, empty state, skeleton state selesai".

**Impact.** Every data route blocks on a full-page navigation with no feedback. Any DB error destroys the entire layout — sidebar, header, and all — instead of failing the segment. Two views have no empty state, so a genuinely empty result and a pending one are indistinguishable.

**Severity.** P1 (PRD §11 DoD), filed as P2 heading.

**Affected files.** `apps/web/src/app/**` (the files that do not exist), `app/global-error.tsx`, `finance-analytics-view.tsx`, `reports-view.tsx`.

**Affected routes.** All 19+ data routes under `/owner-dashboard/**` and `/ceo-dashboard/**`.

**Related API.** All 55 server actions and every loader.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Add `loading.tsx` + `error.tsx` per dashboard segment and a `not-found.tsx`; wrap data fetches in `<Suspense>` so no route falls through to `global-error.tsx`.

---

## FE-012 — P2 — `/owner-dashboard/outlets` deactivation is **irreversible from the UI**

**Finding.** P1. A destructive action with no inverse path.

**Evidence.** `outlets/page.tsx:14` calls `listOwnerOutlets(tenantId)` with `includeInactive` defaulting to `false`; `outlet-server.ts:58` filters `eq(outlets.isActive, true)`. `outlets-view.tsx:28,70-77` then offers a "Tampilkan nonaktif" filter over rows that never contain inactive outlets. `OutletsView` seeds `useState(outlets)` once (`:22`) with no prop sync.

**Actual.** Inactive outlets are filtered out server-side; the UI filter that would reveal them operates on rows that never contain them.

**Expected.** A deactivated entity remains visible and can be reactivated.

**Impact.** An Owner who deactivates an outlet can never re-activate it. Contrast `staff-view.tsx:28` / `packages-view.tsx:37`, which have no `isActive` predicate and work. The "Tampilkan nonaktif" control is a dead filter — the UI advertises a capability the data layer prevents.

**Severity.** P1.

**Affected files.** `outlets/page.tsx`, `outlet-server.ts`, `outlets-view.tsx`, `outlets/actions.ts`.

**Affected routes.** `/owner-dashboard/outlets`, `/owner-dashboard/outlets/[id]`.

**Related API.** `listOwnerOutlets` (loader), `setOutletActive` (server action, `outlets/actions.ts:66`). Table: `outlets.is_active`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Make `outlets` show inactive rows (pass `includeInactive` through, or drop the dead filter).

---

## FE-013 — P2 — Dead, misleading, and self-defeating controls

_(This finding is a control-level inventory and is stated in full in `01_FRONTEND_AUDIT.md` → FE-013. It is repeated here because six of its items are pure UX defects.)_

**Finding.** P2. Twelve control-level defects across seven Owner views and the contract layer.

| Control                                             | Evidence                                                                                                                                           | Note                                                                                                                                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `[...segments]` "Segera hadir"                      | `[...segments]/page.tsx:55`                                                                                                                        | **Currently unreachable** dead code (all 19 nav slugs have real pages) but the 18-entry denylist duplicates `OWNER_NAV_ITEMS`; drift already proven by `.orig` lacking `'customers'` |
| 3 of 4 Subscription CTAs                            | `subscription-view.tsx:100,146,174` `disabled`                                                                                                     | honest labelling                                                                                                                                                                     |
| `updatePromo`, `batchGeneratePromos`, `redeemPromo` | `promos/actions.ts:50,99,135`                                                                                                                      | exported actions with **zero callers** — the only path to 500-code batch generation and the only writer to `promo_redemptions`                                                       |
| "Hapus" = soft disable                              | `promos/actions.ts:85-98` sets `isActive:false`                                                                                                    | misleading label                                                                                                                                                                     |
| `getOwnerSettings`                                  | `settings/actions.ts:28`                                                                                                                           | a **read** exported from `'use server'` → network-callable action                                                                                                                    |
| `canConfigure` / `canUseBackup`                     | `payment-settings/page.tsx:10`                                                                                                                     | computed then **discarded**; no saved-config list, no delete, `useState` seeded once                                                                                                 |
| `outlet-detail-view.tsx:1`                          | no `'use client'`                                                                                                                                  | 100% read-only despite `updateOutlet`/`setOutletActive` existing                                                                                                                     |
| `loadOwnerKioskTheme`                               | `kiosk-theme-server.ts:59,66`                                                                                                                      | **INSERT during a GET render** (advisory-locked every load)                                                                                                                          |
| Double pairing mint                                 | `machines-view.tsx:68-77,85-94`                                                                                                                    | server action issues+discards a token, then `POST /api/booth/pair-session` issues again and invalidates the first                                                                    |
| 6× `window.location.reload()`                       | `outlets-view.tsx:36`, `staff-view.tsx:36`, `packages-view.tsx:62`, `promos-view.tsx:45`, `templates-view.tsx:58`, `frame-studio-view.tsx:110,125` | full reload instead of `router.refresh()`                                                                                                                                            |
| 6× `useState(props)` seeded once                    | `outlets/packages/templates/promos/staff/notifications-view.tsx`                                                                                   | stale lists after `revalidatePath`                                                                                                                                                   |
| `machineActionErrorCodes`                           | `machine-contract.ts:83-84`                                                                                                                        | duplicate `'LIMIT_REACHED'`                                                                                                                                                          |

**Actual.** Twelve distinct control-level defects.

**Expected.** Every visible control performs the action its label promises; every exported server action has a caller or is removed.

**Impact.** Users click controls that reload the whole page, see lists that are stale, hit "Hapus" expecting deletion and get a soft disable, and can regenerate pairing sessions that are discarded on arrival. The `outlet-detail-view` is read-only while `updateOutlet`/`setOutletActive` exist one level up.

**Severity.** P2 (P1 for the pairing double-mint and the "Hapus" mislabel).

**Affected files.** `[...segments]/page.tsx`, `subscription-view.tsx`, `promos/actions.ts`, `promos-view.tsx`, `settings/actions.ts`, `payment-settings/page.tsx`, `outlet-detail-view.tsx`, `kiosk-theme-server.ts`, `machines-view.tsx`, `outlets-view.tsx`, `staff-view.tsx`, `packages-view.tsx`, `templates-view.tsx`, `frame-studio-view.tsx`, `notifications-view.tsx`, `machine-contract.ts`.

**Affected routes.** `/owner-dashboard/subscription`, `/promos`, `/payment-settings`, `/outlets/[id]`, `/kiosk-theme`, `/machines`, `/outlets`, `/staff`, `/packages`, `/templates`, `/frame-studio`, `/notifications`.

**Related API.** `POST /api/booth/pair-session`; server actions `updatePromo`, `batchGenerate`, `redeemPromo`, `getOwnerSettings`, `setOutletActive`, `updateOutlet`, `regeneratePairingSession`, `deletePromo`, `togglePromo`. Table: `promo_redemptions`.

> Naming note: at HEAD the owner `promos/actions.ts` exports are `updatePromo` (`:71`), `batchGenerate` (`:99`), `redeemPromo` (`:135`). The plan's `promos/actions.ts:50,99,135` / `batchGeneratePromos` citation is approximate; the finding is unchanged.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Per-item: delete or implement each dead action; relabel "Hapus" as "Nonaktifkan"; stop exporting reads from `'use server'`; replace `window.location.reload()` with `router.refresh()`; sync `useState(props)` after server updates; remove the INSERT-on-GET in `loadOwnerKioskTheme`; emit a pairing token exactly once per user action.

---

## FE-014 — P2 — Design-system drift: **two incompatible Tailwind vocabularies** in one directory

**Finding.** P2 — DESIGN SYSTEM DRIFT.

**Evidence.**

- Vocabulary A `border-foreground` + `shadow-[4px_4px_0_0_currentColor]`: `staff-view.tsx:161`, `packages-view.tsx:286`, `outlets-view.tsx:166`, `promos-view.tsx:193`, `transactions-view.tsx:21,54`, `reports-view.tsx:167`.
- Vocabulary B `border-border` + `shadow-[6px_6px_0_0_var(--color-border)]`: `templates-view.tsx:29`, `kiosk-theme-view.tsx:30`, `machines-view.tsx:128`, `machine-detail-view.tsx:13-14`.
- Vocabulary C: `focus-visible:outline-violet-600` (`transactions-view.tsx:21`), `focus-visible:outline-ring` (`templates-view.tsx:29`), `bg-primary` + `shadow-[3px_3px_0_0_currentColor]` (`finance-analytics-view.tsx:61`).
- 5 arbitrary hexes in one file: `transactions-view.tsx:71,77,86,91,92` (`#F5F0DC #FFDD00 #FFFEF5`).
- Raw palette colours: `reports-view.tsx:67` amber-500/50/950, `kiosk-theme-view.tsx:450-453` `border-black` + `#1A1A1A`, `frame-studio-view.tsx:230` `accent-black`.
- `STATUS_CLASS` duplicated 3× (`machines-view.tsx:36-41`, `machine-detail-view.tsx:154-157`, `machines-view.tsx:118`).
- Input class duplicated 3× with divergent border token (`packages-view.tsx:86`, `templates-view.tsx:26`, `kiosk-theme-view.tsx:27`).
- Empty states: `border-2 border-dashed` **with no colour** in 6 files vs `border-dashed border-border` in 7 files.
- 7 of 21 views hand-roll `<button>`; 6 of 21 use `@snapbox/ui` primitives.

**Actual.** Three distinct border/shadow vocabularies, three focus-ring tokens, hardcoded hexes, triplicated status maps, triplicated input classes with divergent border tokens, and two incompatible empty-state treatments. `packages/ui` ships 64 primitives that 6 of 21 views actually use.

**Expected.** One vocabulary for border token, shadow offset, focus ring, status colour, and empty state.

**Impact.** A theme change requires per-file edits and will be missed. Two views using the same component name can render with different borders and shadows. A designer cannot reason about the system from the code.

**Severity.** P2 → DESIGN SYSTEM DRIFT.

**Affected files.** 12+ owner view components (enumerated above); `packages/ui/src/components/**` (64 primitives, under-used).

**Affected routes.** `/owner-dashboard/staff`, `/packages`, `/outlets`, `/promos`, `/transactions`, `/reports`, `/templates`, `/kiosk-theme`, `/machines`, `/machines/[boothId]`, `/finance`, `/analytics`.

**Related API.** None (rendering layer).

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Converge the vocabularies, focus-ring tokens, arbitrary hexes, duplicated status-class maps, and divergent dashed empty states. Introduce one status-colour map. Decide whether `@snapbox/ui` primitives or hand-rolled `<button>` is the standard.

---

## FE-015 — P2 — Kiosk Theme editor hardcodes its own neobrutalism values

**Finding.** P2. The theme editor does not use the theme tokens it is editing.

**Evidence.** `kiosk-theme-view.tsx:450-453` uses `border-black` + `shadow-[4px_4px_0_0_#1A1A1A]`; the live preview does not use `--border`/`--shadow`. The contrast gate itself is real and server-enforced (`kiosk-theme-contract.ts:88-92`, `kiosk-theme/actions.ts`).

**Actual.** The editor hardcodes its own neobrutalism values instead of consuming the design tokens.

**Expected.** The editor previews the tokens the app actually ships.

**Impact.** The editor can look correct while the published theme renders differently — a preview/published divergence.

**Severity.** P2.

**Affected files.** `kiosk-theme-view.tsx`, `kiosk-theme-contract.ts`.

**Affected routes.** `/owner-dashboard/kiosk-theme`.

**Related API.** `saveKioskTheme`, `publishKioskTheme`, `restoreKioskThemeVersion` (server actions). Tables: `kiosk_themes`, `kiosk_theme_versions`.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Drive the editor preview from the same tokens the published theme consumes.

---

## FE-016 — P2 — Anti-slop: the **primitives are genuinely neobrutalist**; the failure is _consistency_, and only 4 pages are templated

**Finding.** P2. There is no slop in the component library. There is a consistency problem across pages, and a small number of genuinely templated pages.

**Evidence — verified compliant, do NOT "fix" these:**

- 0 `rounded-lg/md/xl/2xl/sm` in `apps/web/src` (83 × `rounded-base` = the 5px token, 4 deliberate `rounded-full/none`). 0 `shadow-sm/md/lg/inner`. 0 `text-gray-500`. 0 `bg-gradient-to-*` in TSX. 0 `backdrop-blur` / `backdrop-filter`. 0 blob shapes. 0 giant decorative icons (all inline SVG are `size-4`/`size-5`/`size-6`).
- **Neomorphism absent** — no `shadow-inner`, no soft/blur shadow, no inset highlight. Correct.
- **Borders 100% thick.** `border-2` 237× + `border-4` 21× in `apps/web`; `border-2` 81× in `packages/ui`. **Zero bare 1px `border`** across 1 026 border declarations.
- **Press physics intentional:** `hover:translate-x-boxShadowX/Y hover:shadow-none` on 3 button variants (`button.tsx:18,21,23`); `.public-hard-shadow:active` → `2px 2px` (`globals.css:441-444`); `.ceo-plan-foot button[aria-pressed=true]` → `translate(4px,4px)` + `shadow:none` (`:2006-2012`).
- **Content integrity: excellent.** Zero fabricated prices, logos, testimonials, team profiles, or camera-model counts. `[REAL DATA]` / `Coming soon` / fully-disabled controls used throughout as a deliberate anti-fabrication policy (`content/public.ts:8-13`). Preserve this.
- `/fitur` and `/tentang` are **genuinely non-repeating** — 6 distinct module layouts, alternating section backgrounds, deliberate `[&:nth-last-child(-n+2)]` hairline surgery (`tentang/page.tsx:184`).

**Genuinely templated — document these, do not generalize:**

| Page                                                                                                                                                                                                                                                          | Rating        | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                                                                                                                                                                                                                           | **GENERIC**   | 7 stacked full-width sections sharing one skeleton (mono eyebrow → h2 → para → box) at `133-150, 206-221, 268-277, 303-322, 328-341, 349-361`. Two `md:grid-cols-3` rows (`:152, :223`). "Enam modul" grid (`:152-172`) is a **3-up card row with a fake 3-bar chart decoration per card** (`:164-169`) — textbook filler. 6 × `public-pending` badges + 6 dashed logo slots + 3 dashed mini-chart placeholders. 49 `#141414` classes in this one file. _Mitigation:_ the pending labels are the anti-fabrication policy. |
| `/harga`                                                                                                                                                                                                                                                      | SLOPPY (mild) | Hero → 3-up plans (`:47`) → comparison section **structurally present but content-empty** (`:86-93`) → add-on section **also empty** (`:109-111`) → CTA. Two sections of nothing.                                                                                                                                                                                                                                                                                                                                         |
| `/kamera`                                                                                                                                                                                                                                                     | SLOPPY (mild) | 4 identical brand cards, `sm:grid-cols-2 lg:grid-cols-4` (`:78-87`) — a repeated card row for 4 words. Registry section is a single empty dashed box (`:48-55`).                                                                                                                                                                                                                                                                                                                                                          |
| `/docs/troubleshooting`                                                                                                                                                                                                                                       | SLOPPY (mild) | 6 identical step cards in a 1-col stack (`:45-76`), each = yellow number chip + mono label + `public-pending` pill + h3 + 2 pending `dd`s. **100% pending content.**                                                                                                                                                                                                                                                                                                                                                      |
| `/unduh-aplikasi`                                                                                                                                                                                                                                             | SLOPPY (mild) | 2 identical platform cards (`:44-66`), 2 identical info cards (`:74-90`), then a **disabled button "Buka Konsol Perangkat (Web)" pointing at a route that does not exist** (`:93-105`). `md:grid-cols-2` twice.                                                                                                                                                                                                                                                                                                           |
| `reports-view.tsx`                                                                                                                                                                                                                                            | SLOPPY        | `border-amber-500 bg-amber-50 text-amber-950` (`:67`) — **the single most shadcn-looking snippet in the repo**. `bg-yellow-400 hover:bg-yellow-300` (`:167`). Two `<h1>` in one tree (`:62`, `:202`).                                                                                                                                                                                                                                                                                                                     |
| `global-error.tsx`                                                                                                                                                                                                                                            | SLOPPY        | `flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center` (`:34`) — centered-everything, bare `<button>`. See FE-003e.                                                                                                                                                                                                                                                                                                                                                                               |
| `/ceo-dashboard/tenants/[id]`                                                                                                                                                                                                                                 | **BROKEN**    | 6 × undefined `.ceo-panel` (FE-003) + a raw `<table>` with no overflow wrapper (`:138`). `.ceo-panel-static` exists, used 0×.                                                                                                                                                                                                                                                                                                                                                                                             |
| `kiosk-theme-view.tsx`                                                                                                                                                                                                                                        | GENERIC       | `font-black` ×2 of only 3 in the repo (`:119, :427`), `border-black` ×4 (`:450,452,453,463`), `shadow-[4px_4px_0_0_#1A1A1A]` — a **third shadow colour literal** (`:452`). 8 dead `text-muted-foreground`. 15 raw controls. 3 × `sm:grid-cols-3`.                                                                                                                                                                                                                                                                         |
| 15 Owner views (`packages-`, `staff-`, `outlets-`, `templates-`, `frame-studio-`, `promos-`, `devices-`, `machines-`, `transactions-`, `notifications-`, `outlet-detail-`, `machine-detail-`, `payment-settings-`, `subscription-`, `finance-analytics-view`) | GENERIC       | All share `border-2 border-foreground` with **no radius token**, arbitrary `shadow-[…currentColor]` instead of `shadow-shadow`, `tracking-[0.18em]`, raw Tailwind palette. Six **mix `@snapbox/ui` with raw controls on the same screen** — two visual languages per page.                                                                                                                                                                                                                                                |
| `ceo-sidebar` / `ceo-header` / `panel` / `view-switch` / `owner-sidebar` / `owner-header` / `plans` / `system-health` / `security`                                                                                                                            | CLEAN         | Token-driven, dense by design (`globals.css:718`). `Panel` centralizes `DataBadge` so the "data contoh" label **cannot be forgotten** (`panel.tsx:10-11, 133`) — a real design-system guard. `StatusBadge` is never colour-only (`:38-41`).                                                                                                                                                                                                                                                                               |

**Actual.** 4 public pages + 7 owner views + 2 CEO screens are templated; 16 of 21 owner views use a non-token design language; **0 of 21 owner views use the `rounded-base` radius token**.

**Expected.** One design language per surface, expressed in tokens and primitives, with composition chosen per content rather than by default.

**Impact.** The product reads as inconsistent exactly where the PRD promised coherence. The clean screens prove the standard is achievable — this is a coverage problem, not a language problem.

**Severity.** P2 → `DESIGN SYSTEM DRIFT`.

**Affected files.** `app/(public)/page.tsx`, `harga/page.tsx`, `kamera/page.tsx`, `docs/troubleshooting/page.tsx`, `unduh-aplikasi/page.tsx`, `reports-view.tsx`, `global-error.tsx`, `ceo-dashboard/tenants/[id]/page.tsx`, `kiosk-theme-view.tsx`, plus the 15 owner views.

**Affected routes.** `/`, `/harga`, `/kamera`, `/docs/troubleshooting`, `/unduh-aplikasi`, `/ceo-dashboard/tenants/[id]`, 15 `/owner-dashboard/**` routes, and any route whose error escalates to `global-error.tsx`.

**Related API.** None (rendering layer).

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Choose the design language per surface area, then converge (FE-014, §3B). Preserve the anti-fabrication policy and the pending labels — they are correct, not slop.

---

## FE-017 — P2 — Responsive: **the sidebar is correct**; one unwrapped table and three fixed-column grids are the real gaps

**Finding.** P2. An earlier concern that the sidebar was fixed-width is **corrected**: it is not. The real defects are narrow and specific.

**Evidence — CORRECTION:**

- The sidebar is **not** fixed-width. `use-mobile.ts:6` sets `MOBILE_BREAKPOINT = 768`; `sidebar.tsx:171-195` renders a **`Sheet` drawer** below 768px with `sr-only` `SheetTitle`/`SheetDescription`; the desktop branch is `hidden md:block` (`:199`) with `--sidebar-width: 16rem` (`:21`) collapsing to `3rem` (`:23`). Both dashboards use `<Sidebar collapsible="icon">` + `SidebarRail`. `Cmd/Ctrl+B` keyboard toggle (`:88-98`). **No `<1024px` breakage.**
- Tables: 11 raw `<table>` in `apps/web`; 12 `overflow-x-auto`; **10 of 11 wrapped**; the `Table` primitive auto-wraps in `overflow-auto` (`table.tsx:7`).

**Evidence — the real gaps:**

- **The one unwrapped table:** `ceo-dashboard/tenants/[id]/page.tsx:137-138` — a bare `<table>` inside `.ceo-table-wrap`, which **has no `overflow` rule** (`globals.css:1836-1841` defines only `min-width: 0`). 5 columns of rupiah/dates overflow below 768px. The dead `.owner-outlet-table-scroll` rule (`globals.css:1421-1425`) is the exact fix that already exists, unused.
- Three **fixed 3-column grids with no collapse**: `.ceo-plans` (3× until 900px, `globals.css:1920-1924`), `.ceo-promo-grid` (3× until 720px, `:2656-2660`), `kiosk-theme-view` `sm:grid-cols-3` ×3. At 390px these are three-across with no fallback.
- Two hamburger buttons coexist at **768-1023px** (header `owner-header.tsx:32-40` + rail `owner-sidebar.tsx:64-67`), both toggling the same state, because `md:hidden` is used **0 times** repo-wide — the pattern was inverted instead.
- Minor: `useIsMobile` returns `false` on first paint (`use-mobile.ts:18,30`), so below 768px there is a brief invisible-sidebar gap. `.ceo-metrics` (`globals.css:1519-1520`) lacks the `min-width: 0` that `.owner-main` (`:1050`) and `.ceo-main` (`:733`) both declare.

**Actual.** Responsive architecture sound; one 5-column table has no scroll container, three 3-column grids have no collapse below 640px, one breakpoint band renders two competing menu buttons.

**Expected.** No horizontal overflow at 375px; one menu affordance per breakpoint.

**Impact.** One CEO page scrolls sideways on a phone; three grids crush; a 768-1023px user sees two hamburger buttons controlling the same state.

**Severity.** P2.

**Affected files.** `ceo-dashboard/tenants/[id]/page.tsx:137-138`, `globals.css:1421-1425,1836-1841,1920-1924,2656-2660`, `kiosk-theme-view.tsx`, `owner-header.tsx:32-40`, `owner-sidebar.tsx:64-67`, `use-mobile.ts:6,18,30`, `sidebar.tsx`.

**Affected routes.** `/ceo-dashboard/tenants/[id]`, `/ceo-dashboard/plans`, `/ceo-dashboard/promos`, `/owner-dashboard/kiosk-theme`, and all `/owner-dashboard/**` in the 768-1023px band.

**Related API.** None.

**Status.** PARTLY UNVERIFIED — **all 7 viewport-width claims (375/390/768/1024/1280/1440/1920) remain UNVERIFIED (AUDIT-LIM-01)**. Structure is CONFIRMED (static); rendered behaviour is not.

**Recommended next action (direction only).** Add `overflow-x: auto` to `.ceo-table-wrap`; collapse `.ceo-plans`, `.ceo-promo-grid` and the three `kiosk-theme` `sm:grid-cols-3` blocks below 640px; remove the duplicate 768-1023px hamburger. Validate at 7 viewports once runtime is available.

---

## FE-018 — P2 — Accessibility: strong foundations, seven concrete gaps

**Finding.** P2, UNVERIFIED (WCAG 2.2 AA cannot be asserted in either direction without tooling).

**Evidence — verified compliant, do NOT "fix" these:**

- 151 `aria-label`, 61 `aria-labelledby`, 100 `<label>` + 33 `<Label>`. Every icon-only control is labelled; `sr-only` "Toggle Sidebar" (`sidebar.tsx:262`) and "Close" (`dialog.tsx:68`). 5/5 images have alt text; all other imagery is `aria-hidden`.
- 34 `role="status"`, 24 `role="alert"`, 6 `role="note"`, 3 `role="dialog"`, 4 `role="img"`. `StatusBadge` is `text + tone`, **never colour-only** (`panel.tsx:38-41`); `machines-view.tsx:6-7` documents the rule. `lang="id-ID"` on both `<html>` elements.
- Landmarks correct on every shell (`<main>`, `<header>`, `<footer>`, `<nav aria-label>`).
- Tap targets: `button.tsx:9-13` uses a `before:h-11` transparent hit-area to extend `xs`/`sm` to 44px without changing visual height. Dashboards declare `min-height:44px` on all interactive chrome.
- `prefers-reduced-motion` in 4 scope scrims + framer-motion `useReducedMotion` in `motion.tsx`; the marquee degrades to `overflow-x:auto` (`globals.css:527-529`).
- Exactly one `<h1>` per public page (8/8) and dashboard page (`panel.tsx:101` shared `PageIntro`).

**Real gaps:**

1. **No `.owner-shell` focus-visible scrim.** `.public-shell` (`:471-475`), `.auth-shell` (`:693-697`) and `.ceo-shell` (`:2608-2612`) each have a global `outline: 3px` rule. **`.owner-shell` has none** — it relies only on per-element `focus-visible:outline-2/ring-2`. Combined with FE-003, `settings-view.tsx` and `support-view.tsx` inputs have **no focus styling at all**.
2. **No skip link.** `id="owner-main"` (`owner-sidebar.tsx:39`) and `id="ceo-main"` (`ceo-sidebar.tsx:47`) **exist, but nothing links to them** — `grep -rn skip` returns 0. 40+ nav items × 2 dashboards to tab through.
3. **Contrast risks, UNVERIFIED** (need computed ratios): `text-[#8B5CF6]` violet on `#FFFEF5` cream — 7 uses, 10-12px mono (`(public)/page.tsx:120,139,333`; `fitur/page.tsx:95,109,113`; `tentang/page.tsx:186`) — estimated ≈4.1:1, **likely below AA 4.5:1 for small text**; `text-[#16A34A]` on cream ≈3.4:1 (`fitur/page.tsx:290`); `bg-red-200`/`bg-green-200`/`bg-amber-200` + inherited black (`machines-view.tsx:37-39,118,309`); `border-amber-500` on `bg-amber-50` (`reports-view.tsx:67`). ADR-002:86-97 only audited `red-500`→`red-700` in the reference components.
4. `reports-view.tsx` renders **two `<h1>`** in one DOM tree (`:62`, `:202`). `promos-view.tsx` has two (`:34`, `:53`) but in mutually exclusive branches — safe.
5. `notifications-view.tsx:44-46` renders an **empty, always-present** `role="status"` region.
6. `focus-visible:outline-violet-600` (`transactions-view.tsx:21`) is a third focus-ring token, unverified for 3:1 on blue.
7. **`no axe-core` and no a11y test anywhere** (PRD Task 7.14 missing). WCAG 2.2 AA **cannot be asserted** either way without tooling.

**Actual.** The semantic foundation is among the better parts of the codebase; one shell lacks a focus scrim, no skip link exists, four contrast pairs are unverified, one page has two `<h1>`, and the verification tooling does not exist.

**Expected.** PRD Task 7.14: WCAG 2.2 AA with axe-core integrated.

**Impact.** Keyboard users on the Owner dashboard get weaker focus affordances than on the other three shells; small-text violet on cream is likely below AA; no automated gate exists to prevent regressions.

**Severity.** P2, UNVERIFIED.

**Affected files.** `globals.css:471-475,693-697,2608-2612`, `owner-sidebar.tsx:39`, `ceo-sidebar.tsx:47`, `settings-view.tsx`, `support-view.tsx`, `reports-view.tsx:62,202`, `notifications-view.tsx:44-46`, `transactions-view.tsx:21`, `machines-view.tsx:37-39,118,309`, `(public)/page.tsx`, `fitur/page.tsx`, `tentang/page.tsx`.

**Affected routes.** All `/owner-dashboard/**` (focus scrim), all `/ceo-dashboard/**` (skip link), `/` `/fitur` `/tentang` (contrast), `/owner-dashboard/reports` (two `<h1>`), `/owner-dashboard/notifications`, `/owner-dashboard/transactions`.

**Related API.** None.

**Status.** UNVERIFIED — no runtime, no a11y tooling (AUDIT-LIM-01). The compliance list is CONFIRMED (static); the contrast claims are estimates until computed.

**Recommended next action (direction only).** Add a `.owner-shell` focus-visible scrim; add skip links to `#owner-main`/`#ceo-main`; integrate `axe-core`; compute the four flagged contrast ratios; fix the two `<h1>`s in `reports-view`; drop the empty always-present `role="status"`; resolve the third focus-ring token.

---

## §3B — Duplicated / hardcoded CSS strings (quantified)

**Finding.** P2. Every visual constant that should be a token is a literal somewhere, 208 times, while the intended token object is imported by nothing.

**Evidence.**

- **208 arbitrary-hex Tailwind values** in `.tsx`, concentrated in public marketing: 69 × `border-[#141414]`, 43 × `text-[#141414]`, 22 × `bg-[#FFFEF5]`, 21 × `bg-[#FFDD00]`, 11 × `bg-[#F5F0DC]`, 8 × `text-[#FFFEF5]`, 7 × `text-[#8B5CF6]`, 5 × `bg-[#141414]`, plus `#FF1F8F`/`#8B5CF6`/`#16A34A`/`#F59E0B`/`#DC2626`. Worst files: `(public)/page.tsx` (49), `fitur/page.tsx` (21), `tentang/page.tsx` (11), `public-header.tsx` (8), `public-header-menu.tsx` (6).
- **6 of the 7 public brand colours have no token at all.** Changing the brand today is a repo-wide find/replace.
- **`BRAND` — the intended single source of that palette — is dead code:** `content/public.ts:240-258` exports it and **0 files import it**.
- **28 arbitrary `shadow-[…]` values** bypass `--shadow`/`--shadow-nav`; `packages/ui` itself hardcodes `ring-black`/`ring-offset-white` 7× instead of `ring-ring`/`ring-offset-background` (`button.tsx:13`, `input.tsx:11`, `textarea.tsx:10`, `select.tsx:43`, `dialog.tsx:65`, `toast.tsx:47`, `sidebar.tsx:648`).
- **Six distinct hard-shadow offsets** for one idea: `4px` (token), `6px` (`.public-hard-shadow`), `8px` (`.ceo-dialog`, `.ceo-plan-active`), plus arbitrary `3px`/`4px`/`6px`/`currentColor`/`#1A1A1A`. `--shadow-nav` is declared and used **0 times**.
- **~8 duplicate inline-SVG icon sets** because `lucide-react` is `@snapbox/ui`'s dependency and not `apps/web`'s. Two independent nav-glyph maps: `owner-sidebar.tsx:134-156` vs `ceo-sidebar.tsx:158-232`. Also `theme-toggle.tsx:50-83` and three gallery section files.
- **9 hand-rolled `@media` breakpoints** (480/640/700/720/768/860/900/1024/1100px) inline in `globals.css`; none tokenized. `max-width: 1300px` (`:388`) duplicates `--spacing-container` (`:114`).
- **Dead tokens:** `--chart-active-dot` declared in `:root` (`:72`) but never mapped in `@theme inline`, so never generated; `--chart-1: #5294ff` is a raw hex duplicating `--main: hsl(217 100% 66%)`.
- **Dead reference-library leftovers:** `px-rounded-md` / `px-border-md` / `px-ring` (8-bit pixel utilities, `globals.css:236-345`, 110 lines) and `[data-slot='star-ring']` (`:347-362`) have **0 usages** in SnapBox.
- `font-black` (900) ×3 bypasses `--font-weight-heading: 700` — `kiosk-theme-view.tsx:119,427`, `frame-studio-view.tsx:136` — making those three `h1`s visibly heavier than every other.
- `Alert` `destructive: 'bg-black text-white'` (`packages/ui/src/components/alert.tsx:13`) is an **undocumented** divergence from ADR-002:86-91, which specifies `bg-red-700`.

**Actual.** 208 hex literals, 28 arbitrary shadows, 6 shadow offsets, 9 breakpoints, ~8 icon sets, and a `BRAND` object imported by zero files.

**Expected.** One place per constant; a brand change is one edit, not a find/replace.

**Impact.** This is the mechanism that let PC-01 be half-implemented unnoticed: there is no single place to change the brand.

**Severity.** P2.

**Affected files.** `app/globals.css`, `packages/ui/src/components/**`, `app/(public)/**`, `components/public/**`, `content/public.ts:240-258`, 15 owner views.

**Affected routes.** All.

**Related API.** None.

**Status.** CONFIRMED (static).

**Recommended next action (direction only).** Wire the public brand palette into tokens and start consuming the already-exported `BRAND` object (PC-14); consolidate shadow offsets and breakpoints; delete the dead tokens and reference-library leftovers rather than leaving them.

---

## Cross-references

- Canonical statements: `01_FRONTEND_AUDIT.md` FE-003 (a–e), FE-006, FE-011 … FE-018, plus §3A (verified good) and §3B.
- Route coverage for every finding above: `02_FRONTEND_ROUTE_MATRIX.md`.
- Design-token root cause (FE-001, FE-002, FE-003) is the strongest single lever and is repaired first in `10_RECOMMENDED_REPAIR_ORDER.md` steps 1–3.
