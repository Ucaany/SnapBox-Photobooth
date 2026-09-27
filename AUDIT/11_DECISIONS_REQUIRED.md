# 11 — Decisions Required

**Companion to:** `10_RECOMMENDED_REPAIR_ORDER.md` (the queues) and `12_REMEDIATION_PROMPTS.md` (the executable prompts).
**Status:** decision register. Nothing here was decided by the audit — each item is a choice only the product owner can make, with the evidence and the blast radius stated so the choice can be made once and applied everywhere.

**How to read this.** Each decision lists: what is actually in conflict, the options as they exist today, what each option costs, and **exactly which queue items stay frozen until it is answered.** Nothing in `10` or `12` that is marked blocked may be executed before its decision is recorded here.

**Rule:** answering a decision is cheap. Not answering it is not free — it silently freezes queue items, and in two cases (D-01, D-04) it makes the _next_ piece of work actively dangerous to start.

---

## Summary

| #        | Decision                                                   | Tier | Freezes                              | Answer first?          |
| -------- | ---------------------------------------------------------- | ---- | ------------------------------------ | ---------------------- |
| **D-01** | Brand palette and border/shadow language                   | 1    | ~~17 items~~ **ANSWERED 2026-09-26** | **Answered**           |
| **D-04** | Granular RBAC: wire it or delete it                        | 1    | 2 items + all of `/staff-dashboard`  | **Yes**                |
| **D-03** | Runtime database role and `FORCE ROW LEVEL SECURITY`       | 1    | 4 items                              | **Yes**                |
| **D-06** | API error envelope                                         | 1    | 1 item, all error handling           | **Yes**                |
| **D-05** | Demo vs real for the five data-light surfaces              | 2    | 1 item + a PRD revision              | Yes                    |
| **D-02** | Pairing code: QR-only vs QR + manual code                  | 2    | 2 items                              | Yes                    |
| **D-07** | B2C launch provider set                                    | 2    | 2 items                              | Before payment work    |
| **D-10** | Telemetry tables: snapshot or exclude from Drizzle         | 2    | 1 item                               | Before any `generate`  |
| **D-08** | `/download/[token]` and `/legal/*`: build or amend the PRD | 2    | 1 item                               | Before Fase 8          |
| **D-09** | Device Console: Fase 3 reality or PRD correction           | 2    | 1 item                               | Before Fase 2 sign-off |
| **D-12** | Cloudflare WAF / Turnstile: deploy or drop                 | 3    | 2 items                              | Before launch          |
| **D-11** | UI primitives vs hand-rolled as the Owner standard         | 3    | 1 item                               | With D-01              |
| **D-13** | Dark mode: implement or remove the toggle                  | 3    | 1 item                               | With D-01              |
| **D-15** | `/gallery`: gate, keep public, or delete                   | 3    | 1 item                               | Anytime                |
| **D-14** | How `app_role` claims are seeded for OWNER/CEO             | 1    | 1 item, but a **live outage risk**   | **Yes — check first**  |

---

## D-01 — Brand palette, border width, and shadow language · **TIER 1** · ✅ **ANSWERED 2026-09-26**

> ### ANSWERED — full blue palette, no gradients
>
> **The owner's decision:**
>
> 1. **The palette is fully blue.** The neobrutalism.dev blue already in the dashboard token block becomes the single brand palette across all three surfaces — the Owner/CEO dashboards, the public marketing site, and the auth pages. The PRD yellow/violet/pink (`#FFDD00 / #8B5CF6 / #FF1F8F`) and the kiosk editor's red/violet/cream default (`#D40000 / #4C1D95 / #FFFEF5`) are retired.
> 2. **No gradients.** Brand gradients are removed from every surface, in every file.
> 3. Applied across **all files**, not only the surfaces where it is currently wrong.
>
> **This resolves option B** of the three below, and it supersedes `ADR-002` — which becomes _correct_ rather than half-true, since the blue it recorded is now the whole product rather than only the dashboards.
>
> **Three consequences to carry into the work:**
>
> - **The PRD now needs amending.** PRD §4 specifies the yellow/violet/pink palette, and PRD Task 1.1 explicitly requires _"Hero neobrutalism + stagger text + gradient sengaja"_ — a **deliberate gradient**. "No gradient" directly contradicts both. This is a new conflict, recorded as **PC-15**.
> - **`BRAND` in `content/public.ts:240-258` must be rewritten to the blue palette** and given real consumers. It is currently exported and imported by zero files, which is the mechanism by which the three-way split went unnoticed.
> - **One judgment call, flagged for confirmation:** the 8px transparency checkerboard at `globals.css:2668-2676` is built from four `linear-gradient()` calls but is **not a brand gradient** — it is the standard affordance for showing image transparency, and PRD Task 2.5 explicitly requires a checkerboard preview in Frame Studio. **It is retained.** If you want it gone too, say so and it becomes one more line in Phase 1.
>
> **IMPLEMENTED 2026-09-26.** Shipped as `docs/ADR-005-blue-palette-no-gradients.md`.
> `BRAND.palette` in `content/public.ts` is now the single source of truth, generated
> into both CSS files by `pnpm brand:sync` and enforced by `pnpm check:brand` (in CI).
> All three brand gradients are removed, the `.public-gradient-text` class was replaced
> by `.public-vision-text` (solid, not `color: transparent`), `themeColor` is blue, and
> PC-15 is closed below. **Border width and shadow offset remain unresolved and are
> marked PENDING rather than guessed.** Two additional palette sources the audit missed
> are recorded in the PC-15 closure.

**What the blue palette resolves.** Three identities ship in one application today, and no token exists that would let anyone change any of them:

| Surface                    | Palette                                                                        | Where it is defined                      | Has tokens?                            |
| -------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------- | -------------------------------------- |
| Owner + CEO dashboards     | neobrutalism.dev default **blue** (`--main: hsl(217 100% 66%)` ≈ `#5294ff`)    | `globals.css:43-73`                      | Yes, 13 tokens                         |
| Public marketing + auth    | PRD **yellow/violet/pink** (`#FFDD00 #8B5CF6 #FF1F8F #FFFEF5 #F5F0DC #141414`) | `globals.css:378-676` + ~30 inline hexes | **No** — 208 arbitrary Tailwind values |
| Kiosk theme editor default | **red/violet/cream** (`#D40000 / #4C1D95 / #FFFEF5`)                           | `kiosk-theme-contract.ts:77-81`          | No                                     |

`ADR-002` records the blue decision as deliberate and declares PRD §4 "usang" — then marketing shipped with the PRD palette anyway, so **ADR-002 is currently half-true.** PRD §4 also mandates **3–4px** borders; 318 of 358 border declarations are `border-2`. PRD §4 mandates a `6px 6px 0` shadow; the token is `4px 4px 0`, `.public-hard-shadow` is `6px`, `.ceo-dialog` is `8px`, and 28 arbitrary `shadow-[…]` values bypass all of it.

**The problem this caused.** `content/public.ts:240-258` exports a `BRAND` object that is **the intended single source of the public palette — and zero files import it.** So a decision made in ADR-002 could not propagate, and nobody noticed that marketing had been built in a different palette. That is the mechanism, not a symptom.

### Options

| Option                                   | What it means                                                                        | What it costs                                                                                     | What it unblocks                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **A — PRD palette wins** ✅ _not chosen_ | `#FFDD00 / #8B5CF6 / #FF1F8F` everywhere; dashboards re-themed from blue to yellow   | Rewriting the dashboard token block and every blue-derived surface                                | All 17 blocked items                                               |
| **B — ADR-002 blue wins** ✅ **CHOSEN**  | Blue is the brand, everywhere, with no gradients; PRD §4 and marketing are re-themed | Re-theming 8 public routes with 208 hardcoded hexes; removing 3 brand gradients; rewriting PRD §4 | Same 17 items, and `ADR-002` becomes correct rather than half-true |
| **C — Third decision**                   | A new palette neither document contains                                              | A design decision plus both of the above                                                          | Same, plus a new superseding ADR                                   |

**Chosen:** option **B**, with the added constraint of **no gradients**. `ADR-002` is therefore superseded _in confirmation_ — its recorded decision becomes the product's decision.

**The border and shadow sub-decisions were not answered explicitly** and remain open as P-F-01's items 3. The working assumption, to be confirmed during Phase 1: **border 2px** (318 of 358 declarations already are, and `ADR-002` recorded it deliberately) and **one hard-shadow offset** rather than the current four (4px token, 6px `.public-hard-shadow`, 8px `.ceo-dialog`, 28 arbitrary values).

**Freezes until answered:** ~~F-01, F-02, F-04, F-09, F-10, F-11, F-12, F-14, F-15, F-16, F-43, F-52, and the visual half of F-05, F-34, F-45, F-49, F-50.~~ — **released.** All 17 are executable once Phase 1 runs.

---

## D-02 — Pairing code: QR only, or QR + manual code? · **TIER 2**

**Finding:** `PC-02`, `FE-021g`. Canonical: `04_FRONTEND_API_CONTRACT.md` FE-021g; `05` BE-003.

**What is in conflict.** `ADR-001` and PRD §6.B both require **QR + a manual code**, with server-side hashing, rate limiting, and lockout. The implementation generates a 24-character 144-bit token, stores only its SHA-256 hash, and returns **`manualCode: null`** — hardcoded at `pair-session/route.ts:114`. `machine-contract.ts:110` declares the field, and `machines-view.tsx:305` renders a branch that **can never execute**. PRD §6.B separately describes a 6-digit `booths.pairing_code`, which exists as dead columns never written.

**Note the security direction is currently _better_ than the spec:** 144 bits of entropy with a bare SHA-256 hash is safe. If the code is ever shortened to 6 digits to match the PRD, that same unsalted hash becomes a lookup-attack target. **The decision must state which property is being protected** — convenience of manual entry, or brute-force resistance. They are in tension.

### Options

| Option                                | What it means                                                                                                           | Cost                                                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **A — QR only, formally**             | Delete the `manualCode` field, the dead branch, and the PRD's 6-digit language. Pairing requires a device with a camera | One PRD + one ADR amendment. No code risk                                                                    |
| **B — QR + high-entropy manual code** | Keep 144-bit entropy, show a copyable short-ish code as a fallback                                                      | New UI, new redemption input, lockout counters that do not exist yet                                         |
| **C — 6-digit manual code per PRD**   | Short numeric code with lockout                                                                                         | **Weakens** the current posture; requires rate limiting and lockout to be real _first_, or it is a downgrade |

**Freezes until answered:** F-01, F-43, and the redemption design in B-30/B-31.

---

## D-03 — Runtime database role and `FORCE ROW LEVEL SECURITY` · **TIER 1**

**Finding:** `BE-001`. Canonical: `08_DATABASE_TENANT_AUDIT.md` §2 and §5c.

**What is in conflict.** Nothing conflicts — the code is simply honest about the gap. `packages/db/src/client.ts:30-56` connects with `postgres(DATABASE_URL)`, which per the migration comments is the Supabase **table owner**. RLS is `ENABLE`d on all 35 tables but **not `FORCE`d**, so PostgreSQL exempts the owner. The migration set states this itself:

> _"KETERBATASAN (eksplisit): `DATABASE_URL` aplikasi connect sebagai owner tabel, dan owner MELEWATI RLS kecuali FORCE di-set. Jadi helper ini, dengan `enable` saja, TIDAK bisa menjadi security boundary tunggal."_

**The consequence:** the ~40 carefully written policies are dead code for **100% of application traffic**. Tenant isolation rests entirely on roughly sixty `WHERE tenant_id = …` predicates. The application layer is disciplined — 55 of 55 actions gate correctly, zero client-supplied `tenantId` — which is why nothing leaks today. That is a single unbacked line of defence, not two.

**There is a hard ordering constraint, not a preference:** `FORCE` **cannot** be enabled before the connection role changes, or the Drizzle migrate/seed path — which also runs as the owner — is rejected outright. The sequence is role → test → `FORCE`.

### Options

| Option                                                                        | What it means                                                                                          | Cost / risk                                                                                                                                                                             |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — Dedicated non-owner DML role** (the path the prior audit already named) | Create a least-privilege role for `DATABASE_URL`; keep the owner role for migrations; then `FORCE RLS` | Requires the deployment to support a second credential. Through the Supabase pooler the username must carry the project ref. **Must be verified in the target deployment, not assumed** |
| **B — Keep owner, accept single layer**                                       | Document RLS as PostgREST/Realtime-only protection and rely on the app layer                           | Zero cost, zero risk — and PRD §5.5's "second layer" stays aspirational. Acceptable **only if written down as a decision**                                                              |
| **C — `supabase db push` + per-request `SET LOCAL app.tenant_id`**            | Keep the owner but set the GUC per transaction                                                         | Does **not** help: the owner still bypasses RLS. Listed only because it is a plausible-sounding wrong answer                                                                            |

**Freezes until answered:** B-00b, B-08, B-17, B-42. Also blocks PRD Task 8.2 and every IDOR/privilege-escalation test in Fase 7.

**Verification required before choosing A:** connect as the application's actual role and confirm whether policies fire. If they do not, option A's premise is confirmed rather than assumed. This is item 1 on the runtime pass list (`06_SECURITY_AUDIT.md` §5).

---

## D-04 — Granular RBAC: wire the 75 permissions, or delete them? · **TIER 1**

**Finding:** `BE-005`. Canonical: `06_SECURITY_AUDIT.md` BE-005.

**What is in conflict.** `packages/shared/src/auth.ts` defines 75 `PERMISSIONS`, three role-permission sets, `hasPermission()`, and `canAccessTenant()`. A repo-wide grep returns **matches only inside `auth.ts` itself — zero importers.** Real enforcement is role-string equality: `requireCeo()` checks `role !== 'CEO'`, `requireOwnerTenant()` checks `role !== 'OWNER'`.

`STAFF_PERMISSIONS` is explicitly documented as _"Staff hanya monitoring. Destructive action sengaja tidak ada di daftar ini"_ — and is never consulted. **Staff safety today is accidental:** `/staff-dashboard` does not exist, so a Staff login lands on `/unauthorized`. The restriction is a missing route, not an enforced rule.

### The hazard

**Adding `/staff-dashboard` before this decision hands Staff Owner-class destructive access.** The moment that route exists, the only thing standing between a Staff session and `requireOwnerTenant()` is one `requireOwnerTenant()` call per action — 41 of them, maintained by hand, with no test asserting the gate (PRD Task 7.9 is `MISSING`).

### Options

| Option                             | What it means                                                                                                                           | Cost                                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **A — Wire it**                    | `hasPermission(role, permission)` called in every mutation; the Staff Dashboard becomes safe to build                                   | ~41 call sites plus a permission matrix per action. Real work, and it is the only option that makes PRD §5.1 true |
| **B — Delete it, role-level only** | Remove the 75 permissions, amend PRD §5.1 and §5.4 to say role-level, and accept that any OWNER is fully privileged within their tenant | Small. Honest. Does not enable fine-grained Staff limits                                                          |
| **C — Defer**                      | Leave it dead and **do not build `/staff-dashboard`**                                                                                   | Zero cost, and the status quo is safe — but only while the route stays absent. This must be recorded, not assumed |

**Freezes until answered:** F-19, B-06, and PRD Task 2.18 in its entirety.

**Recommendation (direction):** option **A** if the Staff Dashboard is on the roadmap, **B** if it is not. What is not acceptable is leaving it dead while building the route.

---

## D-05 — Demo vs real for five data-light surfaces · **TIER 2**

**Finding:** `FE-006`. Canonical: `01_FRONTEND_AUDIT.md` FE-006.

**What is in conflict.** Five Owner nav slots render data that does not come from the database:

| Surface                 | Reality                                                                                                           | Labelled in UI?        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `/owner-dashboard` root | 4 real scalars; PRD requires revenue-today, paper alert, 7-day chart, quick actions                               | n/a — it is a stub     |
| `/finance`              | `finance-analytics-demo.ts` — fixed rupiah figures, "Contoh Outlet A/B/C", a procedurally generated 30-day series | **Yes**                |
| `/analytics`            | same module                                                                                                       | **Yes**                |
| `/reports`              | hardcoded `DAILY_ROWS`, epoch `Date.UTC(2026, 8, 26)`; CSV built in-browser; schedule is local `useState`         | **Yes**                |
| `/customers`            | 15-line stub calling no data function                                                                             | Yes ("belum tersedia") |

**The mocks are honest** — disclosure banners are present, and that discipline is a genuine strength worth preserving. The problem is that they occupy **4 of 20 Owner nav slots** and display plausible rupiah figures for a tenant with no transactions. A screenshot of `/finance` is indistinguishable from a real one outside the banner.

**The dependency nobody has written down:** real `finance` and `analytics` require a `transactions` writer — and **there is none**. `insert(transactions)` appears zero times in the application. So "make it real" is blocked behind D-07/B-23.

### Options

| Option                              | What it means                                                                                       | Cost                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **A — Make them real**              | Build a `finance-analytics-server.ts` over `transactions`                                           | Blocked on the payment path existing first. Then genuinely useful      |
| **B — Keep them as labelled demos** | Correct, but move them out of the production nav — e.g. behind a "Preview" grouping or a query flag | Small, honest, and removes the credibility risk immediately            |
| **C — Remove them**                 | Delete the routes until the data exists                                                             | Loses the design work; PRD §11 Fase 2 acceptance claims these surfaces |

**Freezes until answered:** F-24, and PRD Task 2.14/2.15 acceptance.

---

## D-06 — API error envelope · **TIER 1**

**Finding:** `FE-021b`. Canonical: `04_FRONTEND_API_CONTRACT.md` FE-021b.

**What is in conflict.** Three shapes coexist across 9 route files, and the canonical one is used by **zero** handlers:

| Shape                                            | Where                                                                    | Fields                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| **PRD §10.13** / `packages/shared/src/errors.ts` | defined, **never used by a handler**                                     | `{success:false, error:{code, message, requestId, developerMessage, retryable}}` |
| Intermediate                                     | `api/booth/pair-session`, `api/auth/staff-pin`                           | `{ok:false, code, message}`                                                      |
| Bare                                             | `transactions/export/route.ts`, `api/health`, `api/internal/telemetry/*` | `{message}`                                                                      |

**The cost is not aesthetic.** Error handling cannot be written once. `retryable` and `requestId` — the two fields that let a client decide between retrying and showing a real message — exist in the spec and in no response.

### Options

| Option                           | What it means                                                   | Cost                                                    |
| -------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| **A — Adopt the PRD envelope**   | Convert all 9 handlers; `developerMessage` stays server-side    | 9 files, mechanical                                     |
| **B — Adopt the de-facto shape** | Standardise on `{ok:false, code, message}` and amend PRD §10.13 | Cheaper, but loses `retryable`/`requestId` unless added |
| **C — Keep three**               | Not viable — this is the finding                                | —                                                       |

**Freezes until answered:** F-29, plus every error-handling decision in both queues.

**Recommendation (direction):** **A**, because `retryable` is what lets a client distinguish "try again" from "this will never work", and the current three shapes make that impossible to express.

---

## D-07 — B2C launch provider set · **TIER 2**

**Finding:** `BE-011`. Canonical: `05_BACKEND_API_AUDIT.md` BE-011.

**What is in conflict.** Nothing is decided. `GATEWAY_PROVIDERS` lists all four (`MIDTRANS`, `XENDIT`, `DOKU`, `PAKASIR`) as types, and `payment-provider-test.ts:11-25` performs **real** connectivity calls against all four live sandbox and production hosts. But there is **no** `PaymentProvider` implementation, **no** `POST /api/payment/create`, **no** `/api/webhooks/b2c/[provider]`, and **no** writer to `transactions`. The PRD's B2C payment is schema plus credential storage.

One B2C path exists: **B2B** via Pakasir, and its webhook is production-grade.

### The decision that cannot be deferred

**Adapters and webhook must land together.** Shipping `createPayment` without `/api/webhooks/b2c/[provider]` re-opens exactly the hole ADR-002 was written to close: a client could mark a transaction paid. Today that is impossible only because no payment path exists.

**Options:** one gateway at launch (Midtrans is the most common in the PRD's own copy) or all four. Four means four signature schemes, four failure taxonomies, and four reconciliation paths before any revenue exists.

**Freezes until answered:** B-23, B-24, B-25, and F-24 (real `finance` needs transactions to exist).

---

## D-08 — `/download/[token]` and `/legal/*`: build, or amend the PRD? · **TIER 2**

**Finding:** `PC-04`, `PC-05`. Canonical: `09` §2.

**What is in conflict.** PRD §3.A and §7.2 list `/download/[token]`, `/legal/privacy`, and `/legal/terms` as routes. None exists. `robots.ts:10-12` documents omitting the legal sitemaps _"because they don't exist yet"_ — so the PRD is knowingly unmet and the robots file is compensating. `robots.ts:20` blocks a `/download/` path that does not exist.

PRD Task 8.7 also requires a DPA and cookie consent, neither of which has a route or a mechanism.

**Options:** build them (Fase 5 / Fase 8 scope), or amend PRD §3.A to remove them from the current route list and keep them in a "planned" section. **The middle path — leaving them listed and compensating in `robots.ts` — is what exists now and is the one option that makes the PRD unusable as a checklist.**

**Freezes until answered:** F-44, F-45, PRD Task 5.14, PRD Task 8.7.

---

## D-09 — Device Console: Fase 3 reality, or Fase 2 claim? · **TIER 2**

**Finding:** `PC-09`. Canonical: `09` §2.

**What is in conflict.** PRD §3.C requires six routes under `/owner-dashboard/devices/[boothId]/diagnostics/*`. They are scheduled in **Fase 3**, which comes _after_ Fase 2 — but Fase 2's acceptance says _"Owner bisa navigasi seluruh dashboard."_ Those two statements cannot both hold. All six routes are absent; there is no `devices/[boothId]` folder at all.

**Options:** schedule them explicitly in Fase 3 and amend Fase 2's acceptance text, or pull them into Fase 2 and accept the schedule slip. What does not work is leaving both statements as they are.

**Freezes until answered:** F-44, and Fase 2 sign-off.

---

## D-10 — Telemetry tables: snapshot them, or exclude them from Drizzle? · **TIER 2**

**Finding:** `BE-021`. Canonical: `05_BACKEND_API_AUDIT.md` BE-021.

**What is in conflict.** `security_events`, `auth_sessions`, and `system_health_checks` are declared in `packages/db/src/schema.ts` but appear in **no** Drizzle snapshot (`meta/` holds 0000, 0002, 0004 only). Meanwhile `supabase/migrations/20260101000500:10-13` states the invariant: _"tidak boleh ada migration Drizzle yang membuat tabel ini lagi"_ — because two DDL sources with `IF NOT EXISTS` make the second a silent no-op with possible column drift.

**This is a dated landmine.** The next `pnpm --filter @snapbox/db generate` diffs against the newest snapshot (`0004`), which predates these three tables, and will emit `CREATE TABLE` for all three. The resulting migration then no-ops against `00500`, and `recordWafEvent` / `recordHealthHeartbeat` / `recordAuthSession` begin throwing on column mismatch — taking **WAF ingest down exactly when it is needed**.

**Options:** (A) restore snapshot parity so the generator sees them; (B) remove the three from the Drizzle schema, since `00500` is their single source of DDL. Either works; what does not work is running `generate` first.

**Freezes until answered:** B-15, and any use of `drizzle-kit generate`.

---

## D-12 — Cloudflare WAF / rate limiting / Turnstile: deploy or drop? · **TIER 3**

**Finding:** `BE-010`, `BE-028`. Canonical: `06_SECURITY_AUDIT.md`.

**What is in conflict.** `infra/cloudflare/README.md:6-7` states plainly that nothing in that directory is executed against any account. The drafts are **complete but inert**:

- 5 of 8 rate-limit rules target endpoints that **do not exist** (`/api/payment/create`, `/api/contact`, `/api/operator/*`, `/api/pairing/*`, and `/api/booth/*` which is blocked by a `$requiresWorker` flag with no Worker in the repo).
- The README's own **verification procedure** curls `/api/contact` and expects a 429 it will never receive.
- Turnstile keys are declared and used **zero times**.
- Meanwhile the only rate limiting that actually runs is in-memory, per-instance, spoofable via a rotating `x-forwarded-for`, and **globally clearable** — `rate-limit.ts:51` wipes every counter at 5 000 keys.

`check:infra-drafts` validates the drafts against the **PRD allowlist**, not against the codebase, so CI cannot catch this drift.

**Options:** deploy (after fixing the ruleset), or delete the drafts and stop claiming edge protection in the docs. **Deploying as written would produce a false negative and a false sense of protection** — worse than an honest "not deployed".

**Freezes until answered:** B-37, B-38.

---

## D-11 — UI primitives vs hand-rolled, as the Owner-dashboard standard · **TIER 3**

**Finding:** `FE-014`, `FE-003d`. Canonical: `01_FRONTEND_AUDIT.md` FE-014.

**What is in conflict.** `packages/ui` ships 64 primitives, all genuinely neobrutalist. **15 of 21 Owner views bypass them**, 6 mix both systems on one screen, and **41 of the 64 exist only to serve `/gallery`**.

Nothing forces a choice, which is why the drift happened. Either the library is the standard and the views converge on it, or hand-rolled controls are the standard and the library shrinks to what is used. Both are defensible; the current state is not.

**Freezes until answered:** F-11. Pair with D-01, since the primitives encode the palette.

---

## D-13 — Dark mode: implement the tokens, or remove the toggle? · **TIER 3**

**Finding:** `FE-009`. Canonical: `01_FRONTEND_AUDIT.md` FE-009.

**What is in conflict.** `ThemeToggle` and `themeInitScript` write `data-theme="dark"` and `style.colorScheme = 'dark'`. **`globals.css` contains no `[data-theme='dark']`, `.dark`, or `prefers-color-scheme` rule at all** (grep: 0 matches). The toggle renders in the CEO header only; the Owner header has none.

**Impact:** clicking it changes native scrollbar and form-control colours and nothing else — a _partial_ dark rendering, which is worse than no toggle. And `themeColor: '#FFDD00'` still contradicts the blue dashboard (F-14).

**Freezes until answered:** F-15. Pair with D-01.

---

## D-15 — `/gallery`: gate it, keep it public, or delete it? · **TIER 3**

**Finding:** `FE-003d`. Canonical: `01_FRONTEND_AUDIT.md` FE-003d.

**What is in conflict.** `app/gallery/` is a ~4 200-line internal design-system catalog. It is **not in the middleware matcher**, so it has **no auth and no role check**. `robots.ts` and `noindex` are advisory to crawlers, not access control. It is **unlinked** — 3 grep hits, all comments — so any anonymous visitor who types `/gallery` gets it, including 20 dummy tenant names and heavy-dependency chunks (`@tanstack/react-table`, `react-day-picker`, `recharts`, `react-hook-form`, `zod`) served as public downloads.

**Why it matters beyond tidiness:** 41 of 64 UI primitives justify their existence by this one page.

**Options:** gate behind auth; `notFound()` outside development; or delete it and keep only the primitives that product UI uses. **Keeping it public in production is a choice**, and it should be recorded as one.

**Freezes until answered:** F-06, and F-11 / D-11 (how much of `packages/ui` is actually needed).

---

## D-14 — How are `app_role` claims seeded for OWNER and CEO? · **TIER 1 — CHECK BEFORE ANY DEPLOY**

**Finding:** `BE-005` adjacent, `00` §9 item 6. Canonical: `06_SECURITY_AUDIT.md` §2d.

**What is in conflict.** `packages/auth/src/claims.ts:33-39` validates custom claims, and `authorization.ts:257-259` rejects a mismatch between the token claim and the DB row with `CLAIMS_STALE`. `setUserClaims` (`packages/auth/src/admin.ts:105-107`) has **exactly one call site in the entire repository**: `staff/actions.ts:70-77`, staff creation only.

**No claim is ever written for OWNER or CEO.** If `app_role` is not seeded for those users out of band — by a script, a migration, or manual Firebase console work — then `CLAIMS_STALE` will reject **every Owner and CEO password login in production**.

**This is not a security hole. It is a potential production login outage, and it is the one item in this register that must be checked against live data before anything else in the backend queue is deployed.**

**What to decide:** where claim seeding lives (migration, script, or admin action), and whether `CLAIMS_STALE` should be a hard failure for OWNER/CEO given that it depends on data this repository does not control.

**Verification required:** one real OWNER login succeeds in production. Nothing else in the backend queue can be considered safe until this is confirmed.

---

## Recording an answer

When a decision is made, record it in three places so it cannot be re-litigated:

1. **A superseding ADR** in `docs/` — for D-01, D-02, D-04, D-11, D-13. `ADR-002` and `ADR-004` are currently half-true and stale respectively; the failure mode is contradiction in place rather than supersession.
2. **The PRD** — for anything where the PRD is the thing that is wrong: D-01 (if blue wins), D-02, D-05, D-08, D-09, D-06 (if the de-facto shape wins), and PC-10/PC-11/PC-12/PC-13.
3. **This file** — flip the tier to "answered" with the date and the ADR/PRD reference, so `10`'s blocked items can be unblocked with a pointer rather than re-derived.

---

## PC-15 — New PRD conflict created by the D-01 answer

**Recorded 2026-09-26.** Answering D-01 with "full blue, no gradients" makes the PRD wrong in two places that were previously correct. The PRD must be amended, or it will keep sending people back to a gradient that no longer exists.

| PRD location              | What it requires                                                                    | Why it is now wrong                                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §4 design system          | Palette `#FFDD00 / #8B5CF6 / #FF1F8F`; border 3–4px; shadow `6px 6px 0`             | The palette is retired in favour of blue. The border and shadow values are separately unresolved — see P-F-01 item 3                                      |
| §11 Task 1.1              | _"Hero neobrutalism + stagger text + **gradient sengaja**"_ — a deliberate gradient | The gradient is removed by decision. This is the most specific instruction, and it is now the opposite of the requirement                                 |
| §4 / ADR-002 relationship | ADR-002 declares PRD §4 "usang"                                                     | ADR-002 becomes _correct_ rather than half-true, so the PRD's "usang" claim inverts: the PRD is now the stale document and ADR-002 is the source of truth |

**What must be amended:** PRD §4 palette, border, and shadow rows; Task 1.1's gradient clause; and the status of ADR-002 relative to the PRD. Phase 1 of `13_PHASE_PROMPTS.md` carries the amendment as a deliverable so it lands with the code change rather than as a separate documentation task that drifts.

**Also amend:** the two comments that will become lies — `globals.css:375` (_"Gradient hero dari identitas PRD"_) and `app/(public)/layout.tsx:8` (_"menetralkan overflow horizontal dari gradient hero"_). The second is load-bearing: the `<main>` neutralises hero overflow _because_ the gradient can exceed the viewport, so removing the gradient may make that rule unnecessary.

### CLOSED 2026-09-26 — amended alongside the code change

All three rows above are now amended in the PRD, and the superseding ADR exists:
`docs/ADR-005-blue-palette-no-gradients.md`.

| Item                     | Landed as                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| §4 palette row           | Replaced with the blue ramp. The retired hexes are gone from the PRD entirely.                                                                    |
| §4 border + shadow rows  | Marked **PENDING**, not guessed. `BRAND` deliberately has no `border`/`shadow` field so a wrong guess cannot look decided. Needs an owner answer. |
| Task 1.1 gradient clause | Struck through and annotated as withdrawn.                                                                                                        |
| §4 vs ADR-002            | The inversion is now written into the PRD: the PRD is the stale document, the ADRs are the source of truth.                                       |

**Correction to the "load-bearing" note above.** The audit assumed the `<main>` rule
existed and would become dead. It does not. `app/(public)/layout.tsx` renders
`<main className="flex-1">` and there is **no `main` selector in `globals.css` at
all**, so nothing there was ever neutralising overflow — the comment was already
false before the gradient was removed. The actual clipping is
`.public-shell { overflow-x: clip }` plus `.public-hero { overflow: hidden }`, and
both are still doing real work for hard-shadows and the marquee. No rule needed
deleting; only the comment needed correcting.

**Two findings the audit did not list**, both now fixed:

1. A **fourth** palette existed: the `kiosk_themes` column defaults in
   `packages/db/src/schema.ts` were still the PRD yellow/violet/warm-white, and
   `kiosk-theme-server.ts` inserts kiosk themes **without** supplying colours, so
   those defaults were the palette that actually shipped. The audit's table said
   "three identities"; it was four.
2. The kiosk editor's contract defaults (`#D40000 / #4C1D95`) already disagreed
   with those same DB defaults, so two different palettes were fighting over the
   same table.

**Still open after the amendment:** the DB default change is in the Drizzle schema
but has **no migration**, because `scripts/migrate-ordered.mjs` pins
`Drizzle 0000-0005` and uncommitted 0005 work is in the tree. Run
`pnpm --filter @snapbox/db generate` in the migration phase. Existing
`kiosk_themes` rows keep their stored colours; backfilling those is a separate
data decision, not part of the palette decision.

---

## Cross-references

- The queues these decisions freeze: `10_RECOMMENDED_REPAIR_ORDER.md` §0 and the per-item "Blocked by" column.
- The executable prompts, each naming the decision it depends on: `12_REMEDIATION_PROMPTS.md`.
- Full evidence for every decision: the `PC-*` table in `09_PRD_IMPLEMENTATION_MATRIX.md` §2 and the `BE-*` / `FE-*` findings in `01`–`08`.
- Runtime checks required before choosing D-03 and closing D-14: `06_SECURITY_AUDIT.md` §5.
