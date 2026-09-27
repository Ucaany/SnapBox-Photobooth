# 00 — Executive Summary

**Audit:** SnapBox — Forensic Audit (Frontend Reality → API/Backend Contract)
**Date of audit:** 2026-09-26
**Source document:** `.kilo/plans/1790436768946-snapbox-forensic-audit.md`
**Status of this document:** audit result. **No source file was modified.** The only work performed was materializing these eleven report files.

---

## 1. Audit limitations (read before trusting any status)

| ID           | Limitation                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Consequence                                                                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUDIT-LIM-01 | Shell permission policy blocks `tsc`, `node --test`, `pnpm build`, `pnpm lint`, `pnpm dev`, pipes, `find`, `sed`, `rg`.                                                                                                                                                                                                                                                                                                                                                         | **No build, no typecheck, no lint, no test, no rendered-UI, no bundle-size, no network-request inspection was possible.** Every finding is static-code evidence. Nothing in this report may be read as runtime acceptance. |
| AUDIT-LIM-02 | No live Supabase / Firebase / Vercel / Cloudflare / Sentry / Resend access.                                                                                                                                                                                                                                                                                                                                                                                                     | RLS effectiveness, claim issuance, webhook delivery, infra rules = `UNVERIFIED` where noted.                                                                                                                               |
| AUDIT-LIM-03 | Working tree is dirty — modified PRD, `middleware.ts`, `route-policy.ts`, `_journal.json`, `layout.tsx`, `owner-layout-data.ts`, `content.ts`, `content.test.mjs`; untracked `owners/`(sic) 11 CEO files, `finance-analytics-demo.ts`, `transactions/`, `reports/`, `customers/`, 5 new owner views, `docs/AUDIT-FASE-0-1-…md`, a stray `package-lock.json`, and a **rejected patch** `content.test.mjs.rej` + three `.orig` siblings + untracked `0005_phase_2_owner_rls.sql`. | The audited state is _not_ the committed state. Findings may reflect work-in-progress.                                                                                                                                     |
| AUDIT-LIM-04 | Prior audit `docs/AUDIT-FASE-0-1-PRD-MIGRATIONS-ENV.md` (2026-09-25) was read as evidence, not as truth. It self-reports as PARTIAL.                                                                                                                                                                                                                                                                                                                                            | Its claims (migrations applied to project `ehoemilzosbzdygqyvzd`, RLS on 35 tables) are **historical and unverified here**.                                                                                                |

**Therefore:** no finding below is marked `PASS` on runtime grounds. The strongest available claim is `CONFIRMED (static)`.

> **Addendum — AUDIT-LIM-03 re-checked at materialization time (additive, does not replace the table above).**
> `git status --porcelain` at the moment these files were written shows the dirty-file set has **shifted** since the audit pass: now modified are `.env.example`, the PRD, `[...segments]/page.tsx`, `owner-dashboard/page.tsx`, `content.test.mjs`, `email/resend.ts`, `owner-layout-data.ts`, `payment-contract.ts`, `payment-crypto.test.mjs`, `docs/ENVIRONMENT-AND-SECRETS.md`, `migrations/meta/_journal.json`, `packages/shared/src/env.ts`, `scripts/check-env-example.mjs`, `scripts/migrate-ordered.mjs` — and **no longer** `middleware.ts`, `route-policy.ts`, `layout.tsx`, or `content.ts`. Also present untracked: the plan file itself, two PRD merge artifacts (`…md.orig`, `…md.rej.orig`), ~24 sibling plan files, and `.kilo/artifacts/`.
>
> **Consequence:** the work-in-progress surface is different from the one the findings were written against, and several findings touch files that are now modified (`resend.ts` / `env.ts` / `payment-contract.ts` / `_journal.json` are directly cited by FE-021i, BE-020, BE-026, BE-032). **Re-verify those specific citations against the current tree before acting on them.** Nothing else in this report is affected.

---

## 2. Verdict in one paragraph

The engineering that exists is **genuinely good**: application-layer tenant isolation is the strongest property in the codebase (all 55 server actions re-derive `tenantId` from a fresh DB read; cross-tenant reads return 404, not 403), the entitlement subsystem is fail-closed at every step with a real CI guard, the Pakasir webhook gets the hard parts right, and the neobrutalist visual language is clean with zero "generic SaaS dashboard" slop. **The problems are not in what was built — they are in what was declared and in what was never connected.** The documented second defence layer (RLS) is dead code at runtime. 24 of 25 realtime events are never emitted and 0 are ever consumed. The device pairing chain terminates at a wall. The desktop app is 6% complete. The payment path does not exist. The migration set is not reproducible from the repo. And on the frontend, the reported "berantakan" complaint has two mechanical causes: Tailwind v4 silently emits nothing for `text-muted-foreground` and `text-destructive` (59 and 6 uses), so the entire Owner dashboard has **no typographic hierarchy** and **no visible error states**; and four class families (22 uses) are referenced but defined nowhere, so six Super-Admin pages and two Owner pages render unstyled — with no error and no warning from the build.

---

## 3. What was audited

| Item                      | Reality                                                                                                                                             | Evidence                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Monorepo                  | pnpm workspace + Turborepo, `apps/*`, `packages/*`                                                                                                  | `pnpm-workspace.yaml`, `turbo.json`                                         |
| Package manager           | `pnpm@12.4.2`, Node `>=22.12.0`                                                                                                                     | `package.json`                                                              |
| Web                       | Next.js **15.5.26** App Router, React **19.3.0**, TS **5.9.3**, `typedRoutes: true`, `serverActions.bodySizeLimit: 6mb`                             | `apps/web/package.json`, `next.config.ts`                                   |
| Styling                   | Tailwind **4.3.3** + `tw-animate-css` + `@tailwindcss/typography`; **`globals.css` = 2681 lines of hand-written per-area CSS**                      | `apps/web/src/app/globals.css`                                              |
| UI                        | `packages/ui` = **64 `.tsx` primitives** (neobrutalism.dev via `@base-ui/react`), barrel `index.ts`; used by ~40 files in `apps/web`                | `packages/ui/src/components/**`                                             |
| Icons                     | Hand-rolled inline `<svg>` glyph maps (owner + CEO nav)                                                                                             | `owner-sidebar.tsx:134-156`                                                 |
| Charts                    | `recharts` declared; owner analytics/finance render **synthetic** data                                                                              | `package.json`, `finance-analytics-demo.ts`                                 |
| Forms                     | `react-hook-form` + `@hookform/resolvers` declared; owner views use raw `useState` + server actions instead                                         | `package.json`                                                              |
| Validation                | `zod@4.6.5` used consistently in contracts                                                                                                          | `lib/*/**-contract.ts`                                                      |
| Auth                      | `firebase@12.19.0` client + `firebase-admin`; HMAC-signed session cookie (`snapbox_session`)                                                        | `packages/auth/**`, `lib/auth/session.ts`                                   |
| DB                        | `drizzle-orm@0.45.3` + `postgres` (direct connection) + `@supabase/supabase-js` (storage/realtime)                                                  | `packages/db/src/client.ts`                                                 |
| Realtime                  | Hand-rolled **Phoenix WebSocket** client. `supabase.channel(`/`.subscribe(` appear **0 times** repo-wide                                            | `use-booth-realtime.ts`                                                     |
| Desktop                   | Tauri v2 + Vite + React. **Total 518 LOC** (274 TS + 154 Rust). **1 Tauri command** (`get_app_info`), never called                                  | `apps/desktop/**`                                                           |
| Testing                   | `node --test` only. **No Playwright, Vitest, Jest, Cypress, axe-core.** `tests/smoke.test.mjs` self-declares "BUKAN cakupan perilaku bisnis"        | `package.json`, lockfile                                                    |
| CI                        | `ci.yml`: lint → 7 repo guards → typecheck → test → build → format:check; separate `rust` job (fmt/clippy/check); preview deploy gated on secrets   | `.github/workflows/ci.yml`                                                  |
| Middleware                | 5-entry matcher, HMAC gate, role prefix rules, subscription gate                                                                                    | `middleware.ts`                                                             |
| Route handlers            | **8** under `/api/**` + 1 nested export route                                                                                                       | `app/api/**`, `transactions/export/route.ts`                                |
| Server actions            | **19** `'use server'` files, **55** exported actions (6 CEO files / 14 actions, 13 owner files / 41 actions)                                        | `app/**/actions.ts`                                                         |
| Migrations                | Two sequences: `packages/db/migrations` 0000–0005 (**two** `0005_*` files) and `supabase/migrations` 8 timestamped files                            | `_journal.json`                                                             |
| Env                       | `.env.example` (9.4 KB) + repo guards; `SUPPORT_EMAIL` **is** now declared in `thirdPartyEnvSchema` and `.env.example` (both modified, uncommitted) | `.env.example`, `packages/shared/src/env.ts:119`, `lib/email/resend.ts:121` |
| TODO/FIXME/HACK           | **0 occurrences**                                                                                                                                   | grep                                                                        |
| `console.log`             | **0 occurrences** in `apps/web/src`                                                                                                                 | grep                                                                        |
| Merge artifacts in source | `[...segments]/page.tsx.orig`, `content.test.mjs.orig`, `content.test.mjs.rej`, `payment-crypto.test.mjs.orig`, `apps/desktop/dist/**`              | git status                                                                  |

---

## 4. Findings at a glance

**60 findings: 26 frontend (`FE-*`) + 34 backend (`BE-*`).** The table counts the `Severity:` field in the canonical file, which is authoritative; five headings differ from their own field and both values are preserved there.

| Severity                        | Count | IDs                                                                                                                                                                                                                                              |
| ------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P0 blocker**                  | 6     | FE-001, FE-002, FE-003 · BE-001, BE-002, BE-020                                                                                                                                                                                                  |
| **P1 critical**                 | 18    | FE-003b, FE-003c, FE-003d, FE-005, FE-006, FE-008, FE-011\*, FE-012\*, FE-019, FE-020\* · BE-003, BE-005, BE-006, BE-007, BE-011, BE-013, BE-014, BE-021                                                                                         |
| **P2 major**                    | 27    | FE-003e, FE-004\*, FE-007\*, FE-009, FE-013\*, FE-014, FE-015, FE-016\*, FE-017\*, FE-018\*, FE-021, FE-022 · BE-008, BE-009, BE-010, BE-012\*\*, BE-015, BE-016, BE-017, BE-018, BE-022, BE-023, BE-024, BE-025, BE-026, BE-027, BE-028, BE-029 |
| **P3 minor**                    | 5     | FE-010 · BE-019, BE-029\*, BE-032, BE-033, BE-034                                                                                                                                                                                                |
| **P4 positive**                 | 4     | BE-004, BE-012\*\*, BE-030, BE-031\*\*                                                                                                                                                                                                           |
| **PRD CONFLICT / ADR REQUIRED** | 14    | PC-01 … PC-14                                                                                                                                                                                                                                    |

\* Heading severity differs from the `Severity:` field: FE-004 (P1→P2), FE-007 (P1→P2), FE-011 (P2→P1, because PRD §11 DoD makes it a DoD failure), FE-012 (P2→P1), FE-013 (P2, with P1 sub-items), FE-016/FE-017/FE-018 (P2, filed P3 by an earlier pass), FE-020 (P2→P1), FE-022 (P1 indicator + P2 remainder).
\*\* Split finding: BE-012 is P4 positive with a P2 gap; BE-029 is P2 with a P3 tail; BE-031 is P4 positive with P3 gaps; FE-003 is P0 (`.ceo-panel`) with a P1 tail (owner trio).

### The six P0s

| ID         | One line                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FE-001** | The app ships **three incompatible colour identities** (blue dashboards, PRD yellow marketing, red/violet kiosk). Needs a superseding ADR.                                                                                                                                                                                                                             |
| **FE-002** | `text-muted-foreground` (59 uses) and `text-destructive` (6 uses) are **undefined Tailwind tokens, silently dropped** — no error, no warning. The Owner dashboard has no typographic hierarchy and no visible error states. **This is the mechanical cause of "dashboard berantakan".**                                                                                |
| **FE-003** | **Four class families are used but never defined** — `.ceo-panel` (13 uses across 6 Super-Admin pages, one of them the tenant-PII detail page), `.ceo-kicker`, `.ceo-icon`, `.ceo-tenant-actions`, plus `.owner-section/eyebrow/form` (6 uses). The rule written for this purpose, `.ceo-panel-static`, exists and is used **0 times**. 63 further CSS rules are dead. |
| **BE-001** | RLS is `ENABLE`d but not `FORCE`d and the app connects as the **table owner** ⇒ ~40 policies never fire. PRD §5.5's "second layer" does not exist.                                                                                                                                                                                                                     |
| **BE-002** | Desktop/kiosk is a **518-line shell**; **0 of 17** kiosk states, 0 of 9 hardware traits, 1 never-called Tauri command. ≈6% complete.                                                                                                                                                                                                                                   |
| **BE-020** | `0005_owner_promo_code_scope.sql` is **orphaned** — no journal entry, so it will never be applied. One line fixes it.                                                                                                                                                                                                                                                  |

### The three highest value-per-effort items

| Item                                                     | Effort        | Why it dominates everything else                                                                                                                                             |
| -------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BE-020** — journal entry                               | 1 line        | Today the redemption index silently does not exist and the redemption path is a table scan. `migrate-ordered.mjs` will not notice.                                           |
| **BE-001** — non-owner DB role + `FORCE RLS`             | architectural | The only change that turns ~40 dead policies into a real second layer. Until it lands, BE-023 and every future predicate mistake is a cross-tenant leak with no DB backstop. |
| **FE-002** — define the semantic tokens + add a CI guard | small         | Permanently closes the root cause of the reported visual complaint, and the guard prevents the entire class of silent token drops from recurring.                            |

---

## 5. Five structural truths (the highest-value findings)

These explain the reported "berantakan / tidak konsisten" and are the highest-value findings in the whole audit.

1. **Three colour identities, no decision.** Blue dashboards, PRD-yellow marketing, red/violet kiosk. Three sets of hardcoded hexes, no shared tokens, and an ADR that is now only half-true.
2. **Silent token drops.** Tailwind v4 emits nothing for an undefined theme variable — **no error, no warning**. Every "secondary/eyebrow/hint" line renders at inherited black; every validation error renders as normal text.
3. **Missing primitives.** `.ceo-panel` (13 uses), `.ceo-kicker`, `.ceo-icon`, `.ceo-tenant-actions`, and `owner-section/eyebrow/form` (6 uses) are defined nowhere. Six Super-Admin pages render major sections as bare `<section>`; two Owner pages render browser-default controls with no focus ring. The intended rule `.ceo-panel-static` exists and is used 0 times.
4. **Empty surfaces.** The dashboard root is a 3-number stub; `finance`/`analytics`/`reports` are honestly-labelled procedural mocks occupying 3 of 19 nav slots; `customers` calls no data function; `notifications` is always empty due to a swapped-argument bug.
5. **No state contract anywhere.** Zero `loading.tsx` / `error.tsx` / `not-found.tsx` in the entire `app/` tree and zero `<Suspense>`, so 19+ data routes have no loading UI and a DB throw replaces the whole layout.

---

## 6. What is genuinely strong (do not regress)

| #   | Property                               | Evidence                                                                                                                                                                                                                                                         |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Application-layer tenant isolation** | All 55 server actions re-derive `tenantId` from a fresh DB read; zero client-supplied `tenant_id`; cross-tenant reads 404 not 403; `requireOwnerTenant()` re-verifies cookie + `users` row + `tenants.status='ACTIVE'` on every page and action (BE-004, BE-030) |
| 2   | **Entitlement subsystem**              | Fail-closed at every one of 6 steps; `effectiveDeviceQuota` correctly special-cases `UNLIMITED` before addition; a real CI guard that **fails the build** on any `plan === 'GROWTH'`-style check outside a justified allowlist (BE-031)                          |
| 3   | **Pakasir B2B webhook**                | Raw-body HMAC before parse, `timingSafeEqual`, 64 KB cap, idempotency marker **released on any non-2xx**, server-authoritative amount check, monotonic `paidAt`/`validUntil`, dead-letter on every failure class (BE-012)                                        |
| 4   | **Secrets structural separation**      | `publicEnvSchema` / `serverEnvSchema` / `secretEnvSchema` / `thirdPartyEnvSchema`; env errors emit `path`+`message` only, never values; `firebase-admin` cannot enter a browser bundle; all 149 `NEXT_PUBLIC_*` reviewed, none a secret (BE-017)                 |
| 5   | **Realtime publish authorization**     | **No browser broadcast-INSERT policy** — a client cannot publish a fake event; extension-scoped `realtime.messages` policies; deferred `booth:{id}` policy with a correct `split_part` UUID round-trip (BE-016)                                                  |
| 6   | **Tauri security posture**             | CSP `script-src 'self'` with no `unsafe-inline`/`unsafe-eval`; capability allowlist scoped to the single kiosk window; no shell/process command exposed (PRD §10.10 respected) (BE-002)                                                                          |
| 7   | **Design-system intent**               | Zero generic-SaaS slop: no glassmorphism, no gradient-on-everything, no floating blobs, no pill-everything; one radius token, genuinely thick borders, hard shadows (FE-016)                                                                                     |
| 8   | **Honest labelling of mocks**          | `DATA_CONTOH` is rendered in the persistent CEO header and auto-injected by `Panel`; finance/analytics/reports carry disclosure banners; `transactions-view.tsx:87` discloses that the "ZIP" is CSV-only                                                         |

---

## 7. PRD compliance

By the PRD's own **Definition of Done** (17 criteria), applied feature-wide:
**1 `COMPLETE` · 10 `PARTIAL` · 4 `MISSING` · 2 `UNKNOWN`.** (The two `UNKNOWN`s are Responsive and Accessibility — both blocked by AUDIT-LIM-01.) **By the PRD's own definition, no feature in this codebase is "done."** Row-by-row: `09_PRD_IMPLEMENTATION_MATRIX.md` §4.

By PRD §8.3 security acceptance checklist — **20 criteria, and the PRD requires 100%**:
**7 implemented in source · 8 fail · 4 partial · 4 not-applicable/absent.** Scored in `06_SECURITY_AUDIT.md` §5, which also explains why the `FAIL` rows cluster on exactly three structural gaps: no enforced revocation, no durable rate limiting or deployed edge layer, and no database-level tenant backstop.

By PRD §11 task — **118 numbered tasks** across Fase 0-8, plus an unnumbered Fase 9 backlog:
**6 `COMPLETE` · 46 `PARTIAL` · 6 `MOCK` · 2 `BROKEN` · 55 `MISSING` · 1 `CONFLICT` · 2 `UNKNOWN`.** These counts are recomputed from the per-task rows, which govern. Per-task evidence: `09_PRD_IMPLEMENTATION_MATRIX.md` §3.

The distribution is sharply **bimodal**: Fase 0/1 foundation work is largely done and largely excellent; everything from Fase 3 onward is either absent or a shell. The 55 `MISSING` tasks are not scattered — **36 are Fase 3-5** (device, kiosk, hardware) and **11 are Fase 7**, the entire test suite the PRD names. **The web platform is substantially built; the machine that is supposed to use it is not.**

---

## 8. Report index

| File                              | Contents                                                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `00_EXECUTIVE_SUMMARY.md`         | This document — limitations, verdict, inventory, severity index, positives, PRD score, open questions                                                                                                        |
| `01_FRONTEND_AUDIT.md`            | **Canonical for every `FE-*` finding.** FE-001 … FE-022 plus FE-003b…e, §3A (verified good) and §3B (duplication quantified) — in the per-finding template                                                   |
| `02_FRONTEND_ROUTE_MATRIX.md`     | Every route: public (14), CEO (14), Owner (24), Staff (6), Device Console (6) — with `REAL`/`MOCK`/`PARTIAL`/`BROKEN`/`STUB`/`DEAD`/`MISSING` status                                                         |
| `03_FRONTEND_UX_UI_AUDIT.md`      | The UX/UI lens: FE-003 (a–e), FE-006, FE-011 … FE-018 + §3B, reorganised by user-visible symptom                                                                                                             |
| `04_FRONTEND_API_CONTRACT.md`     | FE-005, FE-021, FE-022 + the transport inventory (9 route handlers, 19 `'use server'` files, 55 actions) and a contract-drift table                                                                          |
| `05_BACKEND_API_AUDIT.md`         | **Canonical for every `BE-*` finding.** BE-001 … BE-034, the API inventory, and the authorization model                                                                                                      |
| `06_SECURITY_AUDIT.md`            | The security lens: BE-001, BE-005…BE-010, BE-017, BE-018, BE-020…BE-028, BE-032, BE-034 + FE-003d; a ranked attacker-reachable table; a §8.3 scorecard; and the controls that are genuinely correct          |
| `07_REALTIME_AUDIT.md`            | FE-022 + BE-016 end to end: all **25** catalogue events with emit/consume status, 4 channel shapes, the RLS that governs them, and a PRD §10.6 / ADR-011 gap matrix                                          |
| `08_DATABASE_TENANT_AUDIT.md`     | BE-001, BE-004, BE-015, BE-020…BE-023, BE-027, BE-029 — the five isolation layers, the migration topology, the RLS inventory, and why the policies are correct while the connection role is not              |
| `09_PRD_IMPLEMENTATION_MATRIX.md` | PC-01 … PC-14 conflicts + a status row for all **118** PRD §11 tasks + the 17-item DoD score + per-phase acceptance verdicts                                                                                 |
| `10_RECOMMENDED_REPAIR_ORDER.md`  | §8A frontend queue (**52** items) and §8B backend queue (**35** items + 3 gating items), kept strictly separate, plus the cross-queue dependency edges — **direction only, never code**                      |
| `11_DECISIONS_REQUIRED.md`        | The **15 open decisions**: what conflicts, the options as they exist today, what each costs, and exactly which queue items stay frozen until it is answered                                                  |
| `12_REMEDIATION_PROMPTS.md`       | One runnable prompt per queue item — **52 of 52** frontend, **47 of 47** backend — plus the runtime pass (`R-01`) and the close-out gate (`C-01`)                                                            |
| `13_PHASE_PROMPTS.md`             | **Ten ordered phases from audit to completion** (Phase 0 → Phase 10), each with an entry gate, one runnable prompt, and an exit gate. Phase 1 carries the answered **D-01**: full blue palette, no gradients |

### Finding ID → file

| ID range                                                                      | Canonical file                                     |
| ----------------------------------------------------------------------------- | -------------------------------------------------- |
| FE-001 … FE-022 (+ FE-003b…e)                                                 | `01_FRONTEND_AUDIT.md`                             |
| FE-003 (a–e), FE-006, FE-011 … FE-018                                         | also `03_FRONTEND_UX_UI_AUDIT.md` (UX/UI view)     |
| FE-005, FE-021, FE-022                                                        | also `04_FRONTEND_API_CONTRACT.md` (contract view) |
| FE-022, BE-016, FE-021c                                                       | also `07_REALTIME_AUDIT.md` (realtime view)        |
| BE-001 … BE-034                                                               | `05_BACKEND_API_AUDIT.md`                          |
| BE-001, BE-005…BE-010, BE-017, BE-018, BE-020…BE-028, BE-032, BE-034, FE-003d | also `06_SECURITY_AUDIT.md` (security view)        |
| BE-001, BE-004, BE-015, BE-020…BE-023, BE-027, BE-029                         | also `08_DATABASE_TENANT_AUDIT.md` (database view) |
| PC-01 … PC-14                                                                 | `09_PRD_IMPLEMENTATION_MATRIX.md`                  |

---

## 9. Validation plan for the audit itself

- Every finding cites `file:line`; nothing is asserted from file or folder names.
- `IMPLEMENTED` is used only where a DB query, a real mutation, or a real external call was read in source.
- Anything not verifiable without execution is explicitly `UNVERIFIED` and listed in §1.
- No fix, refactor, migration, dependency install, or UI change is part of this task.

**If runtime evidence becomes available later, the correct follow-up is a second, separate audit pass — not edits to these findings.**

---

## 10. Open questions for the owner

**These six are the shortlist. The full decision register — 15 items, with options, costs, and the exact queue items each one freezes — is `11_DECISIONS_REQUIRED.md`. The executable prompts that depend on them are `12_REMEDIATION_PROMPTS.md`.**

| #   | Question                                                                                                                                                                                                                                                                                                                                              | Freezes                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | **PC-01 (palette)** — yellow/violet/pink per PRD, or blue per ADR-002, or a third decision? Everything visual queues behind this.                                                                                                                                                                                                                     | **17 items**                                                        |
| 2   | **BE-005 (RBAC)** — wire the 75-permission model, or delete it and accept role-level granularity?                                                                                                                                                                                                                                                     | 2 items, **and `/staff-dashboard` may not be built** until answered |
| 3   | **BE-001 (RLS)** — is a dedicated non-owner DML role acceptable in this deployment (Supabase pooler, Vercel), so `FORCE ROW LEVEL SECURITY` can be enabled?                                                                                                                                                                                           | 4 items + every Fase 7 isolation test                               |
| 4   | **FE-006 (demo vs real)** — should `finance`/`analytics`/`reports` stay as labeled demos, or be backed by a real `transactions` query? They currently occupy 3 of 20 nav slots.                                                                                                                                                                       | 1 item, blocked behind the payment path                             |
| 5   | **AUDIT-LIM-01** — a follow-up runtime pass (build + Playwright at 7 viewports + Lighthouse) is needed before any responsive/performance/AA claim. Should that be scoped as a second audit?                                                                                                                                                           | verification of nearly every item                                   |
| 6   | **§8B item 4 (claims)** — `setUserClaims` has exactly one call site and it is staff-only. If OWNER/CEO `app_role` claims are not actually planted, `CLAIMS_STALE` may reject **every** OWNER/CEO login in production. This is a potential production login outage and should be verified against live data before anything else in the backend queue. | **a possible live outage**                                          |

**Answer 6 first.** It is the only item that can be an outage rather than a defect, and it is answerable with one login attempt against the real project. Answer 1, 2, and 3 next: they unblock 23 queue items between them.
