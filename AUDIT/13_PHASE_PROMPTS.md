# 13 — Phase Prompts: Audit Findings to Completion

**Purpose:** ten ordered phases that take the repository from "audited" to "verified complete". Each phase has an **entry gate**, **one runnable prompt**, and an **exit gate**. A phase is not finished because its prompt ran; it is finished when its exit gate is true.

**D-01 is answered.** The palette is **fully blue** and there are **no gradients**, applied across all files. Phase 1 carries that. Recorded in `11_DECISIONS_REQUIRED.md` D-01, with the resulting PRD conflict as **PC-15**.

**Detail prompts** for the individual findings live in `12_REMEDIATION_PROMPTS.md`. Phase prompts here orchestrate; they do not re-specify every `file:line`. Where a phase covers detail prompts, they are named so nothing is invented twice.

**Two rules that apply to every phase.**

1. **No phase may be closed on inspection.** The audit could not build, typecheck, lint, test, render, or measure anything (`AUDIT-LIM-01`). Every exit gate names a check that must actually run. `R-01` in Phase 0 establishes the baseline that makes this possible.
2. **No guard may be weakened to make a check pass.** Phases 2, 3, and 5 add guards precisely so a defect class cannot recur. A guard that passes because its check was narrowed is worse than no guard.

**Sequencing rationale.** Phases 1–2 are visual and structural, so the two CI guards exist before any of the convergence work they are meant to catch. Phase 3 is the P0 backend. Phase 4 is security truthfulness. Phases 5–6 are the bulk of the frontend and data work. Phase 7 is new capability and is the longest. Phase 8 surfaces the remainder. Phase 9 is the kiosk, which is a programme rather than a repair. Phase 10 closes.

---

## Phase 0 — Decisions and the runtime baseline

**Entry gate:** none. Start here.
**Exit gate:** every decision in `11` is answered or explicitly deferred with a reason, and `R-01` has produced a dated baseline report.

```text
In /Users/ucaany/Documents/Snap Box - Main, establish the baseline and close the open
decisions before any repair work begins.

PART 1 — run the runtime pass. The audit could not build, typecheck, lint, test, render,
or measure anything (AUDIT-LIM-01), so every finding is static evidence and no item may
be closed on it. This is detail prompt R-01 in AUDIT/12_REMEDIATION_PROMPTS.md. Run it
in full. Do not skip to the parts that look easy.

Order matters:
1. Establish that the build works at all: pnpm lint, pnpm typecheck, pnpm test,
   pnpm build. Record the first failure honestly rather than working around it.
2. PROVE OR DISPROVE BE-001, the P0. Connect using the application's ACTUAL DATABASE_URL
   role and determine whether RLS policies fire. Attempt a cross-tenant read through one
   Owner action with a second tenant's id, and record what the DATABASE returns. If the
   policies do not fire, the P0 is confirmed rather than assumed — that is the expected
   result and it is what Phase 3 fixes.
3. Check the claim-seeding question against live data. Does an Owner login succeed? If
   CLAIMS_STALE rejects Owner/CEO logins, that is a PRODUCTION OUTAGE and takes priority
   over every other item in this file. Report it before doing anything else.
4. Security spot-checks, in the order AUDIT/06_SECURITY_AUDIT.md section 5 lists them:
   revoke a session then reuse the cookie; revoke a CEO role then read
   /ceo-dashboard/tenants/[id]; replay a captured Pakasir body with a fresh eventId;
   unset an unrelated env var and check webhook verification; generate 5000 rate-limit
   keys and check another client's counter; request /gallery anonymously; request
   /api/health with an induced database error.
5. Responsive measurement at 375 / 390 / 768 / 1024 / 1280 / 1440 / 1920. Record per
   viewport: horizontal scroll, clipped content, table overflow, modal fit, form
   usability, nav reachability, touch targets, text wrapping.
6. Run axe-core over every public and dashboard route, and COMPUTE the four contrast
   ratios the audit could only estimate.
7. Establish a bundle-size baseline and a P95 latency baseline. Verify whether recharts —
   a declared dependency — is in any bundle at all.

PART 2 — answer the remaining decisions. D-01 is already answered (full blue, no
gradients). Still open: D-02 pairing code, D-03 runtime DB role, D-04 granular RBAC,
D-05 demo vs real, D-06 error envelope, D-07 B2C provider set, D-08 download/legal
routes, D-09 Device Console phase, D-10 telemetry snapshot, D-11 primitives vs
hand-rolled, D-12 Cloudflare deploy, D-13 dark mode, D-14 claim seeding, D-15 gallery.

For each, record the answer in three places: a superseding ADR in docs/, the PRD where
the PRD is the thing that is wrong, and AUDIT/11 itself. ADR-002 and ADR-004 are currently
half-true and stale respectively — supersede them, do not contradict them in place.

PART 3 — write the baseline report. Append it to AUDIT/ as a dated addendum. Do NOT edit
the existing findings: if the runtime result contradicts a finding, ADD a dated addendum
so the record of what the code said on 2026-09-26 survives.

Constraints: do not print secret values, ID tokens, or service-account credentials. Do not
modify an existing finding to match the runtime result. Read-only against any production
system. Do not start repairing anything in this phase.

Done when: every decision is answered or explicitly deferred with a reason, and a dated
baseline report exists in AUDIT/ recording build status, the RLS determination, the
login check, and the 7-viewport, axe, and bundle results.
```

---

## Phase 1 — The palette: full blue, no gradients

**Answers:** D-01. **Unblocks:** 17 queue items. **Entry gate:** Phase 0 Part 1 complete enough to see the pages render.
**Exit gate:** zero yellow/violet/pink brand colours remain in any surface; zero brand gradients remain; a CI guard fails on a reintroduced non-blue brand colour or a reintroduced gradient.

```text
In /Users/ucaany/Documents/Snap Box - Main, make the palette fully blue and remove every
brand gradient, across ALL files.

DECISION OF RECORD (AUDIT/11 D-01, answered 2026-09-26): the palette is fully blue, and
there are no gradients. This supersedes PRD section 4 and confirms ADR-002's recorded
blue as the product decision.

WHAT EXISTS TODAY. Three identities ship in one application:
  dashboards   neobrutalism.dev blue, globals.css:43-73, 13 tokens
  public+auth  PRD yellow/violet/pink, globals.css:378-676 plus ~30 inline hexes
  kiosk editor red/violet/cream, kiosk-theme-contract.ts:77-81
and content/public.ts:240-258 exports a BRAND object — the intended single source — that
ZERO files import. That is the mechanism by which the split went unnoticed: a decision
could not propagate because there was nowhere to put it.

THREE BRAND GRADIENTS TO REMOVE:
  1. globals.css:412  .public-hero background:
       linear-gradient(135deg, #ffdd00 0%, #8b5cf6 52%, #ff1f8f 100%)
  2. globals.css:418  .public-hero at >=768px:
       linear-gradient(120deg, #ffdd00 0%, #8b5cf6 55%, #ff1f8f 100%)
  3. globals.css:422-426  .public-gradient-text
       background-image: linear-gradient(92deg, #141414 0%, #8b5cf6 48%, #ff1f8f 100%)
       with background-clip: text and color: transparent
     Used at app/(public)/page.tsx:86 — the hero vision line.

RETAIN ONE: the 8px transparency checkerboard at globals.css:2668-2676, built from four
linear-gradient() calls. It is NOT a brand gradient — it is the standard affordance for
showing image transparency, and PRD Task 2.5 explicitly requires a checkerboard preview in
Frame Studio. Keep it. If you want it gone, that is a separate instruction; do not assume
it either way.

TASKS:
1. Rewrite BRAND in content/public.ts:240-258 as the blue palette, and give it real
   consumers: replace the arbitrary hex utilities across apps/web with BRAND-derived
   tokens. The test of success is that changing a brand colour is ONE edit, not a
   repo-wide find and replace.
2. Re-theme the public and auth surfaces from yellow/violet/pink to blue. globals.css
   :378-676 plus ~30 raw literals plus ~208 arbitrary Tailwind values in the public scope.
3. Re-theme the kiosk editor default palette at kiosk-theme-contract.ts:77-81 to blue.
4. Remove the three brand gradients. Replace .public-gradient-text at
   app/(public)/page.tsx:86 with a solid brand colour — do not simply delete the class and
   leave the element unstyled, and do not replace it with a different gradient.
5. After removing the hero gradient, check whether app/(public)/layout.tsx:8's <main>
   rule that neutralises hero horizontal overflow is still needed. It exists BECAUSE the
   gradient could exceed the viewport; if the gradient is gone the rule may be dead. Decide
   and record either way.
6. Fix themeColor: '#FFDD00' in app/layout.tsx:70 to the decided blue. It currently
   contradicts the dashboard background it sits on top of.
7. Fix the two comments that become lies: globals.css:375 ("Gradient hero dari identitas
   PRD") and app/(public)/layout.tsx:8.
8. Add a CI guard that fails the build when: a non-blue brand colour appears as a
   hardcoded hex in apps/web, OR a linear-gradient/radial-gradient is introduced outside
   an explicit allowlist containing only the checkerboard. Demonstrate the guard fails on a
   deliberately-added yellow hex and a deliberately-added gradient, then passes.
9. Write a superseding ADR recording the decision. ADR-002 becomes CORRECT rather than
   half-true — say that explicitly, since the audit found it half-true.
10. Amend the PRD (this is PC-15, recorded in AUDIT/11):
    - PRD section 4: the palette row becomes blue; the border and shadow rows are
      SEPARATELY unresolved, so mark them pending rather than guessing.
    - PRD Task 1.1: "Hero neobrutalism + stagger text + gradient sengaja" — the deliberate
      gradient is removed. Fix the clause so it stops sending people back to a gradient
      that no longer exists.
    - PRD section 4 vs ADR-002: the PRD is now the stale document. Record that.

UNRESOLVED AND DELIBERATELY NOT GUESSED: border width and the shadow offset. The working
assumption is border 2px (318 of 358 declarations already are, and ADR-002 recorded it)
and ONE hard-shadow offset rather than the current four (4px token, 6px
.public-hard-shadow, 8px .ceo-dialog, 28 arbitrary values). Confirm with the owner during
this phase, and do not encode a guess into the token block.

Constraints: do not remove a gradient without replacing the element it styled. Do not
touch the checkerboard. Do not re-introduce a non-blue brand colour while removing one.
Do not change layout or content in this phase — colour only, plus the two comments and the
dead overflow rule.

Done when: no yellow, violet, or pink brand hex exists in apps/web; no brand gradient
exists outside the checkerboard; BRAND has consumers; the guard fails on a bad input and
passes on a good one; the ADR and the PRD are amended; and the rendered pages are
visually coherent in one palette at all 7 viewports.
```

---

## Phase 2 — Guards and CSS foundation

**Covers:** `P-F-02`, `P-F-03`, `P-F-04`, `P-F-06`, `P-F-51`, `P-B-12`, `P-B-13`, `P-B-20`, `P-B-27`.
**Entry gate:** Phase 1 complete.
**Exit gate:** three CI guards exist and each fails on a bad input; the token-sync guard covers the hand-written scopes; `/gallery` is refused by the application outside development; the working tree has no merge residue.

```text
In /Users/ucaany/Documents/Snap Box - Main, close the defect CLASSES before doing
convergence work, so none of them can recur during Phases 5 and 6.

Run the detail prompts in AUDIT/12_REMEDIATION_PROMPTS.md:
  P-F-02  define the semantic colour set and add the undefined-token guard
  P-F-03  add the undefined-class guard
  P-F-04  extend check-token-sync.mjs, or move the hand-written CSS into an explicit @layer
  P-F-06  gate /gallery
  P-F-51  remove the committed merge artefacts
  P-B-12  move SUPPORT_EMAIL into the env schema
  P-B-13  stop /api/health leaking driver error text
  P-B-20  make app.is_ceo() fail closed
  P-B-27  stop WHATSAPP_SALES_NUMBER gating webhook verification

THE THREE GUARDS ARE THE POINT OF THIS PHASE. The audit found 66 dead colour classes and
19 dead class families that produced NO error, NO warning, and NO build failure — Tailwind v4
emits nothing for a utility whose theme variable is undefined. That is why the Owner
dashboard has no typographic hierarchy and why six Super-Admin screens render bare
unstyled <section> elements, and it went unnoticed for as long as it did.

1. Undefined-colour-token guard: fails when a text-/bg-/border-/ring-/fill- utility names a
   colour token that is not defined. Semantic tokens to define: muted-foreground,
   destructive, primary, sidebar, a status set, a metric-type scale.
2. Undefined-class guard: fails when a className matching \.(ceo|owner|public|auth)-[a-z-]+
   has no matching rule in globals.css. This catches the .ceo-panel family (13 uses) and
   the .owner-section/eyebrow/form family (6 uses).
3. Migration-journal parity guard: fails when a file in packages/db/migrations/ has no
   _journal.json entry. This is the P0 from BE-020, which will otherwise recur silently.

On P-F-04: check-token-sync.mjs currently covers only the token blocks, leaving about 2300
lines — roughly 87% of globals.css — unguarded, and every dead-class bug lives in that
region. The hand-written scopes are also UNLAYERED, so they beat Tailwind's utilities layer
at equal specificity, and two collisions are already live: (public)/layout.tsx:14 where
.public-shell beats bg-background, and ceo-sidebar.tsx:45 where .ceo-shell beats
SidebarInset's own background. Extending the guard is the lower-risk option; layering
flips every collision at once and must be done deliberately, after Phase 1 has settled the
palette.

On P-F-06: /gallery is not in the middleware matcher, so it has no auth and no role check.
robots.txt and noindex are advisory to crawlers, not access control. Enforce the decision
(D-15) in middleware or in the route. Also decide the consequence: 41 of the 64 primitives
in packages/ui exist only to serve that page, so the answer scopes how much of the library
is actually needed.

Constraints: demonstrate every guard failing on a bad input before trusting it to pass on a
good one. Do not weaken a guard to make existing code pass — fix the code. Do not rely on
robots.txt or noindex as access control, and say so in a comment wherever they are used for
that purpose. Never print secret values when touching the env schema.

Done when: all three guards fail on a bad input and pass on a good one, the token-sync guard
reports its own coverage, /gallery is refused by the application outside development, and
git status shows no .orig/.rej residue.
```

---

## Phase 3 — The P0 backend: make RLS real

**Covers:** `P-B-00a`, `P-B-00c`, `P-B-00b`/`P-B-08`. **Answers:** D-03, D-10.
**Entry gate:** Phase 0 confirmed whether policies currently fire; D-03 answered; the Phase 0 login check came back clean.
**Exit gate:** a cross-tenant read is refused by the DATABASE, with the policy visible in the query plan.

```text
In /Users/ucaany/Documents/Snap Box - Main, turn the RLS policies from dead code into the
security boundary they are documented to be.

This is the single most important phase in the sequence. Read AUDIT/08 and
AUDIT/11 D-03 first.

THE PROBLEM. packages/db/src/client.ts:30-56 connects with postgres(DATABASE_URL), which
per the migration comments is the Supabase table-owner role. RLS is ENABLEd on all 35
tables but not FORCEd, and PostgreSQL exempts the owner. So 100% of application traffic
bypasses every policy, and tenant isolation rests entirely on roughly sixty
WHERE tenant_id = ... predicates in the service layer. The migration set says so itself at
20260101000100:200-205 and 20260101000400:32-51.

Why this matters even though nothing leaks today: the application layer is disciplined —
55 of 55 server actions re-derive role and tenant from a fresh database read, zero
client-supplied tenant_id, cross-tenant reads return 404 not 403. That is ONE unbacked
line of defence, not two. A single missed predicate anywhere is a cross-tenant leak with
nothing behind it.

HARD ORDERING CONSTRAINT: FORCE cannot be enabled before the connection role changes. The
Drizzle migrate/seed path also runs as the owner and would be rejected outright. The
sequence is role, then test, then FORCE.

TASKS, IN THIS ORDER:
1. FIRST verify the premise. Connect as the application's actual role and determine
   whether policies fire. If they do fire, STOP and report — the audit's P0 is wrong and
   the plan changes. Do not proceed on the assumption.
2. Provision a dedicated least-privilege DML role per decision D-03. Keep the owner role
   for migrations and seed. Verify the role works through the Supabase pooler in the target
   deployment — the username may need the project-ref suffix. Do not assume; test.
3. Switch DATABASE_URL to the new role. Exercise every read and write path in the
   application and confirm nothing regressed. EXPECT this to surface actions that were
   relying on owner privileges — each one surfaced is a finding, not an obstacle.
4. Only then enable FORCE ROW LEVEL SECURITY, table by table, testing between each.
5. Also close the two cheap P0/P1 database items first or alongside:
   - Journal entry for the orphaned packages/db/migrations/0005_owner_promo_code_scope.sql.
     It has NO _journal.json entry, so the Drizzle migrator will never execute it, and its
     only novel artifact — the promo_redemptions index — does not exist in any database.
     That leaves the redemption path running a sequential scan per redemption.
   - Snapshot parity for security_events, auth_sessions and system_health_checks before
     anyone runs drizzle-kit generate. They are in schema.ts but in NO snapshot, and
     20260101000500:10-13 forbids a Drizzle migration from creating them. The next
     generate will emit exactly that CREATE TABLE, IF NOT EXISTS will make it a silent
     no-op, and WAF ingest will break on column drift.
6. Update the misleading comments in 20260101000100 and 20260101000400 so the next operator
   sees the current architecture rather than the old limitation.
7. Add the tenant_id-FK CI check from P-B-42.

Constraints: do not enable FORCE before step 3 is verified. Do not change an application
query to work around a policy failure. Never point the app at the owner role in any
environment. Do not run drizzle-kit generate before the snapshot parity question is settled.

Done when: a cross-tenant read is refused BY THE DATABASE. Prove it — run a query as the
app role selecting another tenant's row, show it returns zero rows, and show the policy in
the query plan. Every migration file has a journal entry, and generate produces an empty
diff.
```

---

## Phase 4 — Security truthfulness

**Covers:** `P-B-04`, `P-B-01`, `P-B-02`, `P-B-03`, `P-B-05`, `P-B-06`, `P-B-11`, `P-B-30/31/33`, `P-B-32`, `P-B-34`, `P-B-37/38`, `P-B-39/40`. **Answers:** D-04, D-12, D-14.
**Entry gate:** Phase 3 exit gate passed; D-04, D-12, D-14 answered.
**Exit gate:** a revoked session fails; a non-CEO cannot read the two tenant pages; a pairing token cannot be redeemed twice; a silent booth goes OFFLINE on its own; response headers carry CSP and HSTS.

```text
In /Users/ucaany/Documents/Snap Box - Main, make the security controls true rather than
merely present. Read AUDIT/06 first — it states the auth chain trace and the ordered
spot-checks.

Run the detail prompts in AUDIT/12_REMEDIATION_PROMPTS.md, in this order.

DO THIS ONE FIRST — it is the only item in the whole audit that can be a live outage.
P-B-04: setUserClaims has exactly ONE call site in the repository, staff/actions.ts:70.
No claim is ever written for OWNER or CEO. authorization.ts:257-259 rejects a
claim-versus-database mismatch with CLAIMS_STALE. If app_role is not seeded for those
users, CLAIMS_STALE will reject EVERY Owner and CEO password login in production.
Check against the real project, implement idempotent claim seeding per D-14, and prove one
Owner login and one CEO login both succeed. If Phase 0 already found this broken, it
outranks everything else in this phase.

THEN:
P-B-01  enforce auth_sessions.revoked_at. It is written by revokeAuthSession and
        revokeAuthSessionsForUser and read by NOTHING, so logout and revoke are UI
        actions, not security controls. verifySession runs on Edge and cannot do a
        database read, so the predicate belongs in requireCeo and requireOwnerTenant, which
        already query users. Also call revokeAuthSessionsForUser from changeTenantStatus
        and deleteTenant, which currently disable the account but never revoke.
P-B-02  add a kid prefix so SESSION_COOKIE_SECRET rotation stops causing a
        /login-to-dashboard loop on a rolling deploy. The current mitigation is a
        procedural caution, which is not a control.
P-B-03  secure: true outside local development, keyed on an explicit flag rather than
        NODE_ENV, because preview deploys often run NODE_ENV=production.
P-B-05  add requireCeo() inside the tenant-server.ts LOADERS, not the pages, so the class
        of defect closes rather than the two instances. Two Super-Admin pages currently read
        real ownerEmail, ownerPhone, address, notes, and billing behind middleware only.
P-B-06  per D-04, wire the 75 permissions or delete the module. If wiring: enforce in the
        shared gate so a new action inherits the check by construction, and prove
        STAFF_PERMISSIONS is restrictive with a test. If deleting: amend PRD 5.1 and 5.4.
        EITHER WAY, /staff-dashboard may not be built in this phase — today Staff safety is
        accidental, resting on the route not existing, and adding it hands Staff
        Owner-class destructive access.
P-B-11  extract isSameOrigin and call it from /api/auth/staff-pin as well as
        /api/auth/session. Latent today, live the moment the PIN path works.
P-B-30/31/33  implement POST /api/booth/pair. The single-use claim MUST be one atomic
        statement that validates and consumes; a read-then-write will silently have no
        single-use protection. Also increment attempt_count, and insert into devices — which
        is what makes deviceQuota enforceable, so today pairing is UNLIMITED ON EVERY PLAN
        TIER.
P-B-32  implement the heartbeat. No code writes last_heartbeat_at anywhere, so every booth
        permanently shows OFFLINE or UNPAIRED and four catalogue events can never fire.
        Cheapest item in the audit, unblocks the most.
P-B-34  rate-limit the booth API per device fingerprint, derived server-side from the
        stored fingerprint — never from a client header.
P-B-37/38  fix the Cloudflare ruleset BEFORE deploying: 5 of 8 rate-limit rules target
        endpoints that do not exist, and the README's own verification procedure curls
        /api/contact and expects a 429 it will never get. Then deploy or drop per D-12.
        Either wire Turnstile into /api/auth/* or delete the keys.
P-B-39/40  add CSP and HSTS, add object-src/base-uri/form-action to the Tauri CSP, and add
        import 'server-only' to the ~13 server modules that lack it.

Constraints: do not add a database read to the Edge middleware. Do not ship a pairing
redemption without the atomic claim. Do not deploy the edge ruleset before fixing it.
Return 404 rather than 403 for a resource that exists but is not visible. Never print
secret values, ID tokens, or credentials.

Done when: a revoked cookie no longer authenticates; a non-CEO session receives 404 on
both tenant pages; a pairing token cannot be redeemed twice, concurrently or after expiry;
a silent booth transitions to OFFLINE without human action; response headers carry CSP and
HSTS; and a Staff session is refused on every destructive action.
```

---

## Phase 5 — Frontend rewrite

**Covers:** `P-F-01`, `P-F-05`, `P-F-07/08`, `P-F-09…F-16`, `P-F-15`, `P-F-45`, `P-F-49`, `P-F-50`.
**Entry gate:** Phase 1 palette complete; Phase 2 guards in place.
**Exit gate:** no undefined colour token or class remains; every route has loading, error, and not-found; axe-core gates CI; 7 viewports recorded; contrast ratios measured.

```text
In /Users/ucaany/Documents/Snap Box - Main, converge the frontend onto one design language
and give every route a real state contract.

Run the detail prompts in AUDIT/12_REMEDIATION_PROMPTS.md.

IN ORDER:
P-F-07/08  Add loading.tsx, error.tsx per dashboard segment and not-found.tsx; wrap data
           fetching in Suspense with a real skeleton. There are currently ZERO of each in
           the entire app tree, so 19+ data routes have no loading UI and a database throw
           replaces the whole layout. Then fix global-error.tsx, which renders a bare
           <html> that REPLACES layout.tsx, so the next/font variables never apply and its
           button has no radius, no shadow, and no 44px target.
P-F-05     Re-express settings-view and support-view. They use owner-section,
           owner-eyebrow and owner-form — three classes defined nowhere — and then render
           bare inputs and buttons with zero Tailwind classes and zero primitives. They are
           the only two Owner pages with no focus ring at all.
P-F-09…16  Converge the design system. Two incompatible Tailwind vocabularies coexist in
           components/owner-dashboard/; three focus-ring tokens; STATUS_CLASS duplicated 3x;
           input classes duplicated 3x with divergent border tokens; dashed empty states
           diverging across 13 files; 15 of 21 views bypassing @snapbox/ui with 6 mixing
           both systems on one screen; 0 of 21 using the rounded-base radius token; 28
           arbitrary shadows across four different offsets; font-black x3; ring-black
           x7 in the primitives themselves; and 63 dead CSS rules to adopt or delete.
           Note: .owner-outlet-table-scroll is the exact overflow-x:auto rule the unwrapped
           table in P-F-49 needs — do not delete it before using it.
P-F-15     Per D-13, implement dark tokens or remove ThemeToggle. Today the toggle sets
           data-theme="dark" and changes only native widget colours, because globals.css has
           no dark rule at all — a PARTIAL dark theme, which is worse than none.
P-F-45     Fill or remove four structurally-empty public sections: the /harga comparison
           matrix and add-on table, the /kamera registry box, and the /unduh-aplikasi
           button pointing at a route that does not exist. Keep the pending labels — they
           are the anti-fabrication policy and are correct. An honest unavailable state
           that looks deliberate beats an empty box that looks broken.
P-F-49     Give .ceo-table-wrap an overflow-x rule, collapse .ceo-plans, .ceo-promo-grid and
           the three kiosk-theme sm:grid-cols-3 blocks below 640px, and remove the duplicate
           768-1023px hamburger (md:hidden is used zero times repo-wide). THEN measure at
           375/390/768/1024/1280/1440/1920 and record the results. The sidebar drawer at
           768px is CORRECT — do not "fix" it into a fixed rail.
P-F-50     Add the .owner-shell focus-visible scrim that the other three shells have; add
           skip links to #owner-main and #ceo-main, which exist but nothing links to them;
           integrate axe-core into CI; COMPUTE the four contrast ratios the audit could only
           estimate, including #8B5CF6 on cream at 10-12px; resolve the third focus-ring
           token; fix the two <h1> in reports-view; drop the empty always-present
           role="status"; move focus into the account menu.

Constraints: do not suppress an axe violation to make the gate green — fix the cause or
record a justified exception. Do not claim AA conformance without running axe. Do not
fabricate content to fill a section. Do not close a duplication by copying it a third time.
Preserve the anti-fabrication policy and the pending labels.

Done when: no undefined token or class remains, every route has loading/error/not-found, a
deliberately-thrown error stays inside its segment, axe-core runs in CI, the four contrast
ratios are measured rather than estimated, and results are recorded for all 7 viewports.
```

---

## Phase 6 — Data integrity

**Covers:** `P-F-23`, `P-F-24`, `P-F-25/26/27`, `P-F-28…F-33`, `P-B-14…B-22`. **Answers:** D-05, D-06.
**Entry gate:** Phase 3 complete (the FK and index work depends on the RLS role change).
**Exit gate:** a seeded tenant notification appears; one error shape across all 9 route files; deleting a tenant leaves zero orphans; `EXPLAIN` shows index scans on the dashboard load path.

```text
In /Users/ucaany/Documents/Snap Box - Main, close the data-integrity gaps: the silently
dead feature, the contract drift, and the database gaps.

FRONTEND:
P-F-23  Fix the swapped arguments at notifications/page.tsx:15, which passes
        (tenantId, userId) into a (userId, tenantId) signature. The page is permanently
        empty today and the empty state makes the bug look like normal operation. Make the
        mismatch impossible to reintroduce — a single object argument beats two positional
        strings. Then decide the tenant-broadcast semantics and REMOVE the redundant OR
        group in notifications-server.ts:19-25 and notifications/actions.ts:17-27 that
        nullifies the userId IS NULL clause, so the intent is honest either way. Add tests
        that seed real rows. Then build the bell: owner-header.tsx:52-58 is a plain link
        with no unread count and no dropdown.
P-F-24  Per D-05, resolve the five data-light surfaces. Note the dependency: real finance
        and analytics need a transactions writer and there is NONE — insert(transactions)
        appears zero times in the application — so "make it real" is blocked behind Phase 7.
        Whichever option is chosen, do NOT fabricate figures: an explicit unavailable state
        beats a plausible number.
P-F-25/26/27  Stop the INSERT during a GET render in kiosk-theme-server.ts:59,66; replace
        the 6 window.location.reload() calls with router.refresh(); sync the 6
        useState(props)-seeded views after server updates; move getOwnerSettings out of the
        'use server' module so a read is not a network-callable endpoint.
P-F-28…33  Per D-06, adopt ONE error envelope across all 9 route files — the PRD 10.13
        shape carries retryable and requestId, which is what lets a client choose between
        retrying and showing a real message, so preserve those fields. Then: import the
        shared boothStatusSchema instead of redeclaring it without DEGRADED, so a degraded
        booth renders; resolve the 5 locally redeclared enums; fix the user:{userId}
        Firebase-UID contract; and block /ceo-dashboard and /staff-dashboard explicitly in
        robots.ts.

BACKEND:
P-B-14…22  Add the six missing tenant_id foreign keys — users, promo_redemptions, sessions,
        download_tokens, activity_logs, device_logs — plus sessions.booth_id and
        device_id and promo_redemptions.transaction_id, so ON DELETE CASCADE FROM tenants
        actually cleans up. Today it is declared on 15 other tables and does NOT clean
        these, so deleting a tenant orphans audit logs with 5-year retention. Then stop
        accepting a client-supplied transactionId in redeemPromo — it goes into a column
        with no FK and the cross-tenant RLS check that would catch it never runs, because
        the app is the table owner. Do this even if Phase 3 is not yet done; it is
        exploitable in the service layer today. Add SELECT FOR UPDATE to the Pakasir
        subscription write path — the pattern already exists at promos/actions.ts:146.
        Widen redeemPromo's lookup to tenant_id = me OR tenant_id IS NULL so CEO-global
        promos are reachable, matching the policy that is already correct. Add indexes:
        seven tables have ZERO indexes of any kind, and templates plus packages are the
        urgent pair because they are NOT NULL-scoped tenant tables queried on EVERY Owner
        dashboard load. Add tenant_id indexes to the seven uncovered tables, and index
        webhook_failures on provider/resolved/created_at since the documented retention
        purge is sequential. Finally reconcile the contradictory migration-history comments
        at 20260101000100:7-15 and 20260101000400:5-6, and replace
        migrate-ordered.mjs's exact-file-count assertion with a phase-aware check that
        reports what changed — adding a 9th migration currently crashes the script.

Constraints: do not add an FK that fails on existing orphan rows without first reporting
how many there are. Never drop a table to resolve a constraint. Do not change the
empty-state copy to hide a bug. Do not remove a contract field a consumer reads. Do not
loosen a zod schema to accept a value the database cannot store.

Done when: a seeded tenant notification appears and the bell shows an unread count; every
error response has the same shape; a DEGRADED booth renders; deleting a tenant leaves zero
orphans; a redemption cannot reference another tenant's transaction; and EXPLAIN shows
index scans on the dashboard load path.
```

---

## Phase 7 — New capability

**Covers:** `P-B-23/24`, `P-B-25/26`, `P-B-28/29`, `P-B-35/36`, `P-B-43`, `P-B-44`, `P-F-46`, `P-F-47/48`. **Answers:** D-07.
**Entry gate:** Phase 6 complete; D-07 answered.
**Exit gate:** a verified webhook activates a transaction and a forged one is rejected; a subscription past `valid_until` transitions on its own; at least one realtime event is observed end to end.

```text
In /Users/ucaany/Documents/Snap Box - Main, add the capability the product is missing:
money moving, time-based enforcement, and a working realtime loop.

THE PAYMENT PAIR IS ONE CHANGE. Shipping createPayment without the webhook re-opens exactly
the hole ADR-002 was written to close: a client could mark a transaction paid. Today that
is impossible ONLY because no payment path exists. Do not land one without the other.

P-B-23/24  Implement the PaymentProvider interface per PRD 10.8 and
           POST /api/payment/create, then /api/webhooks/b2c/[provider] with per-provider
           signature verification: Midtrans SHA512 over the documented field order, Xendit
           constant-time callback-token compare, DOKU HMAC, Pakasir HMAC-SHA256. Verify over
           the RAW BODY BEFORE PARSE, as the existing Pakasir route already does correctly.
           Use UNIQUE(gateway_transaction_id) for idempotency and reuse the existing
           claim-marker pattern INCLUDING the release-on-any-non-2xx behaviour — that is the
           failure mode most webhook handlers get wrong and the existing code gets right.
           Add a server-authoritative amount check. Add a signed timestamp with a +/-5
           minute window. Add a database-level invariant that forbids a client-writable
           payment_status. Server sets PENDING; only a verified webhook advances it.
P-B-25/26  Extract the idempotency-marker and dead-letter pattern into a shared helper so
           the B2C webhooks cannot get it wrong, and add the freshness window to Pakasir.
           Measure the body cap in BYTES, not rawBody.length, which is UTF-16 code units
           measured after the body is already buffered.
P-B-28/29  Implement the hourly expiry cron that does not exist today — pg_cron is enabled
           with zero scheduled jobs, so EXPIRING and GRACE_PERIOD are never written,
           grace_period_until is never set, and a tenant past valid_until keeps their
           status indefinitely. Implement the transitions, the H-7/H-3/H-1 notifications,
           and kiosk maintenance mode. Then implement the Owner checkout behind the three
           disabled CTAs.
P-B-35/36  Publish the catalogue events. Exactly ONE of 22 is ever emitted today and ZERO
           are consumed; DEVICE_REVOKED is not published even though the database-side
           revoke is complete and transactional, so a revoked kiosk is never told to stop.
           Wire EventDeduplicator, which is dead code imported by zero files. Normalise
           broadcast.created through publishRealtimeEvent so it passes realtimeEventSchema.
           Replace rate-limit.ts's buckets.clear() with LRU expiry — today one attacker
           generating 5000 keys wipes every counter for every user.
P-B-43     Add the instrumentation that makes any performance claim possible. PRD 8.5's
           targets have never been measured. Add a bundle budget, P50/P95/P99 latency
           instrumentation surfaced on the system-health page that already claims to show
           operational metrics, webhook latency, and a Lighthouse baseline. Verify whether
           recharts is in any bundle at all.
P-B-44     Resolve the two hand-rolled binary encoders: a stored-mode ZIP writer and a
           ~400-line Reed-Solomon QR encoder with no test proving the output decodes. Either
           an audited library or a round-trip test — for the QR that test is not optional.
P-F-46     Make the realtime indicator honest. use-booth-realtime.ts treats ANY phx_reply as
           success, ignoring status, so a join REJECTED BY RLS renders a green "Realtime
           aktif" dot. Treat an error reply as failure, make joined per-topic, add backoff
           with jitter and a cap, and adopt EventDeduplicator.
P-F-47/48  Route broadcast.created through publishRealtimeEvent, and decide per event
           whether a field-level update is warranted or a full router.refresh() is correct.

Constraints: do not ship a payment adapter without its webhook. Do not trust a
client-supplied amount, status, or gateway_transaction_id. Do not publish an event that
bypasses realtimeEventSchema. Never add a browser INSERT policy on realtime.messages — that
would be the vulnerability, not the fix. Do not claim any PRD 8.5 target is met until P-B-43
has run. Do not create a second unscheduled cron.

Done when: a payment intent can be created, a verified webhook activates the transaction, a
forged one is rejected and a replayed one changes nothing; a subscription past valid_until
transitions without human action; at least one realtime event is observed end to end; and a
performance baseline exists with a regression failing CI.
```

---

## Phase 8 — Surface the rest

**Covers:** `P-B-41/42`, `P-F-17…F-22`, `P-F-39…F-44`. **Answers:** D-08, D-09, D-15.
**Entry gate:** Phase 7 complete.
**Exit gate:** an anonymous visitor can reach a working login; a deactivated outlet can be reactivated; no exported action has zero callers; the `/staff-dashboard` question is decided.

```text
In /Users/ucaany/Documents/Snap Box - Main, surface the remaining work: the two most
visible defects, the remaining dead surface, and the documentation that now misleads.

P-F-39  THE HIGHEST-VISIBILITY DEFECT IN THE PRODUCT. public-header.tsx:32-47,71,77
       renders a disabled button labelled "Belum tersedia" with the title "Login tersedia
       setelah rute autentikasi dirilis" — but /login EXISTS and works completely: real
       Firebase sign-in, a real /api/auth/session, accessible labels, real pending and
       error states, and a validated redirect with no open-redirect. No visitor can reach
       login from ANY public page. Replace the disabled control with a real link in the
       header, the footer, and the mobile menu, and remove the stale comment above it.
P-F-40  Build the notification bell: unread count badge, 10-item dropdown, realtime. Today
       it is a plain link.
P-F-41  /owner-dashboard/outlets deactivation is IRREVERSIBLE from the UI. The server never
       returns inactive rows because includeInactive defaults to false, yet the view offers
       a "Tampilkan nonaktif" filter over rows that cannot contain them. Pass
       includeInactive through, or drop the dead filter — but not leave a control that can
       never reveal anything. Contrast staff-view and packages-view, which work correctly.
P-F-42  outlet-detail-view.tsx is 100% read-only while updateOutlet and setOutletActive
       exist one level up.
P-F-43  One user action currently mints TWO pairing tokens: createBoothWithPairing discards
       the code it minted, then the client immediately POSTs /api/booth/pair-session, which
       invalidates the first and mints a second. Mint exactly once. Then resolve manualCode
       per D-02 — machines-view.tsx:305 is a permanently dead branch because
       pair-session/route.ts:114 hardcodes null.
P-F-17…22  The frontend-visible effects of the Phase 4 backend work, plus: fix the
       /owner-dashboard/subscription INFINITE REDIRECT LOOP for expired owners — the layout
       redirects to the page it is already rendering, and the escape hatch is passed only by
       the shadowed catch-all. Then delete that catch-all branch, which is unreachable dead
       code whose 18-entry denylist duplicates OWNER_NAV_ITEMS and has already drifted.
P-B-41/42  Implement or delete the five dead server actions, each with real database side
       effects and zero callers — updatePromo, batchGenerate, redeemPromo,
       getOwnerTemplate, and the whole owner-account-server.ts. Delete
       api/sentry-example AND its WAF exemption together. Remove the dead
       NEXT_PUBLIC_MIDTRANS_CLIENT_KEY. Add the CI guard that every 'use server' module
       routes through a gate, so a new action cannot skip it — that property is currently
       maintained by hand across 41 call sites.
P-F-44  Per D-09: build the six Device Console routes or amend PRD 3 to state they are
       Fase 3. Do not leave PRD 3 listing them while Fase 2's acceptance claims the Owner
       can navigate the entire dashboard.
P-F-52  Documentation. Fix the comment at lib/auth/session.ts:17 that instructs a future
       author to call getSession(), a function that does not exist anywhere in the
       repository. Fix the nav copy that promises a "kunci API master" the product
       deliberately does not render. Supersede ADR-002 and ADR-004 rather than
       contradicting them in place. Move the Fase 2 status block out of the PRD's
       requirements section, and regenerate it rather than hand-editing it.

Constraints: do not build /staff-dashboard in this phase. do not leave a disabled control
labelled "Belum tersedia" where the feature exists. Do not delete an action that is the
only path to a real capability without recording the decision. Do not remove the Sentry
route without its WAF exemption in the same change.

Done when: an anonymous visitor reaches a working login; a notification increments the
badge without a page visit; a deactivated outlet can be reactivated; one user action mints
one pairing token; no exported action has zero callers; and every ADR is either true or
explicitly superseded.
```

---

## Phase 9 — The kiosk programme

**Entry gate:** Phases 0–8 complete. Pairing redemption, heartbeats, and the payment path all exist.
**Exit gate:** a sequenced Fase 3/4/5 plan exists with owners, and the kiosk can be staffed.

```text
In /Users/ucaany/Documents/Snap Box - Main, produce a sequenced implementation plan for the
Tauri kiosk. This phase is a PLAN, not an implementation.

THE MEASUREMENT. The desktop app is 518 lines: 274 TypeScript across 3 files, 154 Rust.
App.tsx is 25 lines and self-declares "Shell kiosk Fase 0 ... Hardware engine belum
terpasang". Exactly one Rust command exists (get_app_info) and it is never called. Zero of
17 states in PRD 6.R, zero of 18 features in PRD Bab F, zero of 9 hardware traits in 10.9,
zero of 15 Fase 5 tasks. AUDIT/09 records 36 MISSING tasks concentrated here.

TASKS:
1. Confirm the inventory above against the current tree. The audit could not build the
   Tauri app, so verify before planning.
2. Write a sequenced Fase 3/4/5 plan in this order: pairing redemption (done in Phase 4) ->
   secure storage and the four Rust device commands (get_fingerprint, store_session,
   read_session, wipe_session) -> the state machine with SQLite persistence and crash
   recovery -> hardware adapters -> the customer flow.
3. Name the decisions that gate the programme. The photo pipeline's storage and processing
   contract is one; the adapter set follows D-07.
4. Record which PRD tasks in Fase 3/4/5 must be re-scoped or dropped. PRD 5.13/5.14 assume
   a download-token flow that Phase 7 will have changed.
5. Identify what Phase 4 and Phase 7 already unblocked, so the plan does not re-specify
   pairing, heartbeats, or payments.

PRESERVE, do not regress — these are the good parts of the current desktop code:
  tauri.conf.json:26 CSP, script-src 'self' with no unsafe-inline and no unsafe-eval
  capabilities/default.json scoped to the single kiosk window, core:default + opener:default
  no shell or process command exposed, satisfying the PRD 10.10 ban
  error.rs — a genuinely good typed-error module with retryable and a secret-free
  developer_message, ready for the device commands
  fullscreen, undecorated, non-resizable window
Note: opener:default is granted with zero consumers and is the BROAD variant, allowing
open-path and reveal-in-dir as well as open-url. Narrow or remove it.
Note: macos is not a bundle target while main.rs carries a windows_subsystem attribute,
so local verification on darwin is not possible.

Constraints: do NOT start implementing the kiosk in this phase. 36 tasks across three
phases with hardware dependencies is a programme; a partial attempt produces another
518-line shell.

Done when: a sequenced plan with owners exists, the two gating decisions are named, and the
security posture to preserve is listed explicitly.
```

---

## Phase 10 — Close-out

**Entry gate:** Phases 0–9 complete.
**Exit gate:** every P0 and P1 has a terminal status with evidence; PRD §8.3 re-scored; the 118-task matrix re-scored; all three guards proven to gate.

```text
In /Users/ucaany/Documents/Snap Box - Main, run the final consistency check. Detail
prompt C-01 in AUDIT/12_REMEDIATION_PROMPTS.md.

TASKS:
1. Re-run the Phase 0 runtime pass in full. Confirm no phase introduced a regression.
2. For every P0 and P1 finding in AUDIT/01 and AUDIT/05, state VERIFIED-FIXED,
   STILL-OPEN, or PARTIALLY-FIXED, with the evidence for that status. A finding is fixed
   when its runtime check passes, not when a grep is quiet.
3. Re-score PRD 8.3's 20 security acceptance criteria. Baseline in AUDIT/06 section 5:
   7 PASS / 8 FAIL / 4 PARTIAL / 4 MISSING. The PRD requires 100%. Report the new score
   honestly, including any item still failing.
4. Re-score the 118 PRD 11 tasks against the baseline in AUDIT/09 section 1, and account
   for every status change with a finding reference. Note that AUDIT/09 section 1a records
   two different roll-ups for the same rows; state which reading you used.
5. Re-score the 17-item Definition of Done. Baseline: 2 COMPLETE of 17.
6. PROVE all three CI guards gate: deliberately break a colour token, an undefined class,
   and a migration journal entry, confirm each fails the build, then revert.
7. Confirm every decision in AUDIT/11 is recorded in a superseding ADR and, where the PRD
   is the thing that is wrong, in the PRD itself. Confirm PC-15 was applied — the PRD must
   no longer require a gradient.
8. Write the final close-out report as a dated addendum in AUDIT/. Do NOT edit the original
   findings; the record of what the code said on 2026-09-26 must survive.

Constraints: do not mark anything FIXED on the strength of a grep. Do not weaken a guard to
make a check pass. Do not edit an original finding to match the result.

Done when: every P0 and P1 has a terminal status with runtime evidence, 8.3 is re-scored
against its 35% baseline, the task matrix is re-scored, all three guards demonstrably fail
on a bad input, and the PRD no longer contradicts the shipped palette.
```

---

## Phase summary

| Phase  | What it is                          | Items                                                | Gate before the next                                   |
| ------ | ----------------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| **0**  | Decisions + runtime baseline        | R-01, 14 decisions                                   | A dated baseline report exists                         |
| **1**  | **Full blue palette, no gradients** | D-01, PC-15, 8 tasks                                 | No non-blue brand hex, no brand gradient, guard passes |
| **2**  | Guards and CSS foundation           | F-02, F-03, F-04, F-06, F-51, B-12, B-13, B-20, B-27 | 3 guards fail on bad input; `/gallery` refused         |
| **3**  | **The P0: make RLS real**           | D-03, D-10, B-00a, B-00c, B-08                       | Cross-tenant read refused by the DATABASE              |
| **4**  | Security truthfulness               | D-04, D-12, D-14, 12 prompts                         | Revoked session fails; pairing is atomic               |
| **5**  | Frontend rewrite                    | F-05, F-07/08, F-09…F-16, F-15, F-45, F-49, F-50     | axe gates CI; 7 viewports recorded                     |
| **6**  | Data integrity                      | D-05, D-06, 8 prompts                                | Zero orphans; index scans on the load path             |
| **7**  | New capability                      | D-07, 8 prompts                                      | Payment verified end to end; 1 event observed          |
| **8**  | Surface the rest                    | D-08, D-09, 6 prompts                                | Login reachable; no zero-caller actions                |
| **9**  | Kiosk programme                     | 36 MISSING tasks                                     | A staffed, sequenced plan                              |
| **10** | Close-out                           | C-01                                                 | Every P0/P1 terminal; guards proven                    |

**Phases 1, 3, and 4 are the ones that change the risk profile.** Phase 1 is already unblocked by your decision. Phase 3 is the only change that turns ~40 well-written policies from dead code into a real second layer. Phase 4 is the only phase that can surface a production outage — and that is item 1 in it, not last.

---

## Cross-references

- The 15 decisions and the D-01 answer: `11_DECISIONS_REQUIRED.md`.
- Per-finding runnable prompts: `12_REMEDIATION_PROMPTS.md`.
- Queue definitions and per-item verification: `10_RECOMMENDED_REPAIR_ORDER.md`.
- Evidence for every finding: `01`–`08`. Task status: `09_PRD_IMPLEMENTATION_MATRIX.md`.
