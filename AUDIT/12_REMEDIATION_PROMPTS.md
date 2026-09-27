# 12 — Remediation Prompts

**What this file is:** one runnable prompt per queue item in `10_RECOMMENDED_REPAIR_ORDER.md` — **F-01…F-52** (frontend, 52) and **B-00a…B-44** (backend, 47) — plus the runtime pass and the close-out gate.

**How to run them.** Each prompt is self-contained: copy the fenced block into a fresh session with the repository open. They are ordered by wave and declare their own prerequisites, so a session that lacks context will stop rather than guess.

**Three rules that apply to every prompt in this file.**

1. **Do not run a prompt whose `Needs decision` is unanswered.** Those are recorded in `11_DECISIONS_REQUIRED.md`. Guessing a palette or an RBAC model and encoding it is how the current three-identity state happened.
2. **Every prompt ends in a verification, not "it looks right".** The audit could not build, typecheck, lint, test, or render anything (`AUDIT-LIM-01`), so no item may be closed on inspection alone. Run the stated check.
3. **Never close a prompt by weakening its check.** Several prompts add a guard precisely so the class of defect cannot recur; a guard that passes because the check was narrowed is worse than no guard.

**Conventions used below.**
`P-F-##` / `P-B-##` = prompt id · `Wave` = sequencing group from `10` §4 · `Needs decision` = blocker from `11` · `Fixes` = findings closed · `Done when` = the check that closes it.

---

## Wave 0 — Decisions (not prompts; read `11` first)

Fifteen decisions are outstanding. Four of them change the risk profile:

| Decision                 | Gates                                  | Read      |
| ------------------------ | -------------------------------------- | --------- |
| **D-01** palette         | 17 items, every visual change          | `11` D-01 |
| **D-04** granular RBAC   | `/staff-dashboard` entirely            | `11` D-04 |
| **D-03** runtime DB role | 4 items + Fase 7 tests                 | `11` D-03 |
| **D-14** claim seeding   | **a possible production login outage** | `11` D-14 |

Record each answer in a superseding ADR, in the PRD where the PRD is wrong, and in `11` itself. `ADR-002` and `ADR-004` are already half-true and stale; contradiction in place is the failure mode to avoid.

---

## Wave 1 — Cheap and structural

No prerequisites. These are safe to start immediately and two of them close P0/P1 backend findings in a single line.

### P-B-00a · Journal entry for the orphaned migration

**Queue** B-00a · **Finding** BE-020 · **P0** · **Wave** 1 · **Needs decision** — · **Fixes** BE-020

```text
In /Users/ucaany/Documents/Snap Box - Main, fix the orphaned Drizzle migration.

packages/db/migrations/0005_owner_promo_code_scope.sql exists on disk but has NO
entry in meta/_journal.json, so the Drizzle migrator will never execute it. Its
only novel artifact is the index
  promo_redemptions_tenant_customer_idx ON (tenant_id, promo_id, customer_email)
which therefore does not exist in any database, leaving owner/promos/actions.ts:165
to run a sequential scan per redemption.

Tasks:
1. Read meta/_journal.json and confirm 0005_owner_promo_code_scope is absent.
2. Decide with the owner whether to journal the file or delete it — its lines 2-10
   are no-ops against 0004 (it drops an index 0004 already dropped, then re-creates
   two indexes 0004 creates). Deleting is the cleaner option if the index is not wanted.
3. Apply the chosen option consistently, and rename the remaining 0005 file to a
   distinct prefix so two files cannot share one.
4. Add a CI assertion that every file in packages/db/migrations/ has a journal entry.

Constraints: do not change the index definition itself. Do not regenerate snapshots.
Do not run migrations against any database.

Done when: the journal/file parity assertion exists and FAILS when you add a
deliberately-orphaned file, and passes when you remove it.
```

### P-B-00c · Snapshot parity before the next `generate`

**Queue** B-00c · **Finding** BE-021 · **P1** · **Wave** 1 · **Needs decision** D-10 · **Fixes** BE-021

```text
In /Users/ucaany/Documents/Snap Box - Main, restore Drizzle snapshot parity for the
three telemetry tables.

security_events (schema.ts:897), auth_sessions (:922) and system_health_checks (:940)
are declared in packages/db/src/schema.ts but appear in NO snapshot — meta/ holds
0000, 0002 and 0004 only. supabase/migrations/20260101000500:10-13 forbids a Drizzle
migration from creating these tables, because two DDL sources plus IF NOT EXISTS make
the second a silent no-op with possible column drift.

The next `pnpm --filter @snapbox/db generate` will diff against 0004 and emit CREATE
TABLE for all three, which is exactly the divergence the migration forbids.

Tasks:
1. Confirm the three tables are absent from every meta/*_snapshot.json.
2. Per decision D-10, either (A) restore snapshot parity so the generator sees them, or
   (B) remove them from the Drizzle schema since 20260101000500 is their single source of
   DDL. Do not do both.
3. Update the comment in 20260101000500 so the next author does not re-open this.
4. Run `pnpm --filter @snapbox/db generate` and confirm the diff is empty.

Constraints: do NOT run `generate` before step 2 is complete — that is the hazard.
Do not edit any existing snapshot by hand to "make it match"; snapshots are generated.

Done when: `generate` produces an empty diff, and the three tables are either in the
snapshot chain or explicitly excluded with the reason recorded in the migration.
```

### P-F-02 · Define the semantic colour set and add the CI guard

**Queue** F-02 · **Finding** FE-002 · **P0** · **Wave** 1 · **Needs decision** D-01 · **Fixes** FE-002

```text
In /Users/ucaany/Documents/Snap Box - Main, close the silent-token-drop class.

globals.css @theme inline defines exactly 13 colour tokens. 66 classes reference
tokens that do not exist: text-muted-foreground x63 across 16 owner views,
text-destructive x6, bg-primary / text-primary-foreground x3, focus-visible:ring-foreground.
Tailwind v4 emits NOTHING for a utility whose theme variable is undefined — no error,
no warning, no build failure. Result: the Owner dashboard has no typographic hierarchy
and its validation errors are invisible; the Finance segmented controls have no active
state and one bar chart has no colour.

Tasks:
1. Decide the semantic colour set (per D-01): muted-foreground, destructive,
   primary, sidebar, a status set, and a metric-type scale. Add them to :root AND to
   @theme inline in globals.css, keeping packages/ui/src/styles.css byte-identical
   (pnpm check:token-sync enforces this).
2. Write a repo guard that fails the build when any text-/bg-/border-/ring-/fill-
   utility in apps/web or packages/ui names a colour token that is not defined.
3. Demonstrate the guard: it must FAIL on a deliberately-added bad utility, then PASS
   once removed.
4. Then replace the 66 usages — most will resolve automatically once the tokens exist.
   Only fix by hand the ones whose intent was wrong, e.g. bg-primary on a chart fill.

Constraints: do not silence a usage to make the guard pass. Do not weaken the guard to
allow a class it should reject. Do not change the palette itself — that is D-01.

Done when: the guard fails on a bad input and passes on a good one, `pnpm check:token-sync`
passes, and no undefined-token class remains in apps/web or packages/ui.
```

### P-F-03 · Add the undefined-class CI guard

**Queue** F-03 · **Finding** FE-003 · **P0** · **Wave** 1 · **Needs decision** — · **Fixes** FE-003

```text
In /Users/ucaany/Documents/Snap Box - Main, close the undefined-class class.

Four class families are used in className but defined nowhere:
  .ceo-panel          x13  (6 live Super-Admin pages render bare unstyled <section>)
  .ceo-kicker         x2
  .ceo-icon           x1
  .ceo-tenant-actions x1
  .owner-section / .owner-eyebrow / .owner-form  x6  (settings-view, support-view)

64 more CSS rules are dead: 44 .owner-outlet-* and 19 .ceo-* with zero usages.

Tasks:
1. Write a repo guard that fails the build when a className matching
   \.(ceo|owner|public|auth)-[a-z-]+ has no matching rule in globals.css.
2. Demonstrate: it must FAIL on a deliberately-added undefined class, then PASS.
3. Decide per class: define the rule, or replace the usage.
   - .ceo-panel: the intended rule .ceo-panel-static already exists (globals.css:2019)
     and is used 0 times. Adopt it.
   - .ceo-kicker: .ceo-header-kicker exists (:865). Adopt or define.
   - .owner-*: see prompt P-F-05.
4. Run the guard, then decide the fate of the 64 dead rules — adopt or delete.
   Do not leave them. Note that .owner-outlet-table-scroll (:1421) is the exact
   overflow-x:auto rule that a live table needs (see P-F-49).

Constraints: do not add a rule whose only purpose is to silence the guard — if a class
has no meaning, remove the usage instead.

Done when: the guard fails on a bad input and passes on a good one, and a dead-rule
check reports zero.
```

### P-F-51 · Remove the committed merge artefacts

**Queue** F-51 · **Finding** — · **P3** · **Wave** 1 · **Needs decision** — · **Fixes** hygiene

```text
In /Users/ucaany/Documents/Snap Box - Main, clean the working tree of patch residue.

These non-source files are committed or sitting untracked inside source trees:
  apps/web/src/app/(owner-dashboard)/owner-dashboard/[...segments]/page.tsx.orig
  apps/web/src/components/owner-dashboard/content.test.mjs.orig
  apps/web/src/components/owner-dashboard/content.test.mjs.rej
  apps/web/src/lib/owner-dashboard/payment-crypto.test.mjs.orig
  PRD_...md.orig
  PRD_...md.rej.orig
plus apps/desktop/dist/ which appears to contain a build artefact including a ~2.3 MB
source map.

Tasks:
1. Confirm none of these is imported or referenced by any build, test, or script.
   content.test.mjs.rej is a literal rejected patch hunk — read it before deleting to
   confirm nothing in it was meant to land.
2. Delete them.
3. Decide whether apps/desktop/dist/ belongs in the tree. If not, add it to .gitignore
   and remove it; a committed source map is an information-disclosure concern.
4. Verify the build and test scripts still pass afterwards.

Constraints: do not delete anything that git reports as modified-and-tracked source.
Do not "clean up" any other file while you are in here.

Done when: `git status --porcelain` shows no .orig/.rej residue, and the build and
node --test both still pass.
```

### P-B-12 · Move `SUPPORT_EMAIL` into the env schema

**Queue** B-12 · **Finding** FE-021i · **P2** · **Wave** 1 · **Needs decision** — · **Fixes** FE-021i

```text
In /Users/ucaany/Documents/Snap Box - Main, confirm and complete the SUPPORT_EMAIL
environment contract.

The audit found that lib/email/resend.ts:121 read process.env.SUPPORT_EMAIL directly
rather than through thirdPartyEnvSchema, and that the key was absent from .env.example
— so the support form failed closed and pnpm check:env-example could not see it.

The working tree now shows packages/shared/src/env.ts, .env.example and
scripts/check-env-example.mjs as modified, which suggests this was already fixed.
VERIFY rather than assume:

Tasks:
1. Read the current state of packages/shared/src/env.ts, .env.example and resend.ts.
   Establish what is already done.
2. Complete anything outstanding: the key declared in thirdPartyEnvSchema, present in
   .env.example, and covered by scripts/check-env-example.mjs.
3. Run `pnpm check:env-example` and confirm it passes.
4. If the support form now works, note that the residual part of the original finding
   still stands separately: settings-view and support-view have no field-level error
   state and render unstyled (prompt P-F-05). Those are NOT closed by this prompt.

Constraints: do not read or print any secret VALUE. Variable names only.
Do not commit .env.

Done when: check:env-example passes, and the audit's original claim is either
confirmed-fixed or restated with current file:line evidence.
```

### P-B-13 · Stop `/api/health` leaking driver error text

**Queue** B-13 · **Finding** BE-018 · **P2** · **Wave** 1 · **Needs decision** — · **Fixes** BE-018

```text
In /Users/ucaany/Documents/Snap Box - Main, fix the unauthenticated information
disclosure in the health endpoint.

apps/web/src/app/api/health/route.ts:32-38 returns
  error instanceof Error ? error.message : 'Koneksi gagal.'
on a route that is fully public, cache:no-store, and returns HTTP 200 even on failure.
The file's own header comment at :8 forbids loading any secret or credential version.
Postgres/Supabase driver messages can carry hostname, port, user and database names.

Tasks:
1. Replace the raw error message with a generic detail string.
2. Return a non-200 status on failure so a degraded dependency is visible to a monitor.
3. Decide whether to split into a minimal public /api/health and a detailed internal
   endpoint. If you do, the internal one needs the existing telemetry secret pattern
   (constant-time compare, fail-closed 503 when the secret is unset) used by
   api/internal/telemetry/heartbeat/route.ts.
4. Note in infra/cloudflare/waf-custom-rules.json:40 that the WAF draft currently
   EXEMPTS /api/health from rate limiting and challenges — decide whether that stays.

Constraints: do not remove the endpoint; uptime probes depend on it. Do not log the raw
error to the client; logging it server-side is fine.

Done when: an induced database error produces a response with no driver text, and the
route returns a non-200.
```

### P-B-27 · Stop a sales number from gating webhook verification

**Queue** B-27 · **Finding** BE-026 · **P2** · **Wave** 1 · **Needs decision** — · **Fixes** BE-026

```text
In /Users/ucaany/Documents/Snap Box - Main, decouple the Pakasir webhook secret from an
unrelated required environment variable.

thirdPartyEnvSchema requires WHATSAPP_SALES_NUMBER non-emptily
(packages/shared/src/env.ts:111), and lib/ceo-dashboard/pakasir-b2b.ts:87 validates the
WHOLE schema before reading webhookSecret. If that variable is unset,
readPakasirConfig throws, verifyPakasirSignature catches and returns false, and every
payment webhook returns 401.

Tasks:
1. Split the schema so the webhook secret is read from a schema containing only what
   signature verification needs.
2. Make a missing webhook secret a loud startup or per-request configuration error,
   not a silent 401.
3. Add a test: unset the unrelated variable and confirm webhook verification still works.
4. Update docs/ENVIRONMENT-AND-SECRETS.md to remove the implied coupling.

Constraints: do not weaken signature verification. Do not change the HMAC algorithm.
Do not make the secret optional in a way that silently disables verification.

Done when: unsetting an unrelated variable leaves webhook verification working, and a
test covers it.
```

### P-B-20 · Make `app.is_ceo()` fail closed

**Queue** B-20 · **Finding** BE-022 · **P2** · **Wave** 1 · **Needs decision** — · **Fixes** BE-022

```text
In /Users/ucaany/Documents/Snap Box - Main, fix a fail-open branch in the CEO
authorization function.

supabase/migrations/20260101000100_rls_foundation.sql:166-168 reads
  if to_regclass('public.users') is null then
    return true;
  end if;

If public.users is ever missing, renamed, or misconfigured in search_path, a token
carrying app_role='CEO' becomes CEO with no database verification. The rest of the
function is well designed — layer 2 requires a real users row matching claims->>'sub'
with role='CEO' AND NOT disabled AND deleted_at IS NULL — and the comment at :146-151
shows an analogous NULL-fail-open was already fixed in this same function.

Tasks:
1. Change the branch to return false.
2. Preserve create-time tolerance: the to_regclass guard exists so the function can be
   created before Task 0.8. Guard on migration phase or on a separate bootstrap flag
   rather than on table absence conferring authority.
3. Add a test for the missing-table branch.
4. Check the sibling recursion case and document it: snapbox_notifications_scope
   (0001:95-118) reads public.users while snapbox_users_scope is `for all`, so
   evaluating one re-enters the other. Confirm the bound and record the finding.

Constraints: do not remove the layer-2 users check. Do not change any other policy.

Done when: a test covers the missing-table branch and asserts false, and the existing
CEO authorization tests still pass.
```

---

## Wave 2 — The P0: make RLS real

**Blocked by D-03.** This is the single change that turns ~40 well-written policies from
dead code into a real second layer.

### P-B-00b / P-B-08 · Non-owner DB role, then `FORCE ROW LEVEL SECURITY`

**Queue** B-00b, B-08 · **Finding** BE-001 · **P0** · **Wave** 2 · **Needs decision** D-03 · **Fixes** BE-001

```text
In /Users/ucaany/Documents/Snap Box - Main, make the Postgres RLS policies the security
boundary they are documented to be.

THE PROBLEM. packages/db/src/client.ts:30-56 connects with postgres(DATABASE_URL),
which per the migration comments is the Supabase table-owner role. RLS is ENABLEd on all
35 tables but not FORCEd, and PostgreSQL exempts the owner. So 100% of application
traffic bypasses every policy, and tenant isolation rests entirely on roughly sixty
WHERE tenant_id = ... predicates in the service layer. The migration set documents this
itself at 20260101000100:200-205 and 20260101000400:32-51.

HARD ORDERING CONSTRAINT: FORCE cannot be enabled before the connection role changes.
The Drizzle migrate/seed path also runs as the owner and would be rejected outright.

Tasks, in this order:
1. FIRST verify the premise. Connect as the application's actual role and determine
   whether policies fire. If they do fire, stop and report — the audit's P0 is wrong.
2. Per decision D-03, provision a dedicated least-privilege DML role for DATABASE_URL.
   Keep the owner role for migrations and seed. Verify the role works through the
   Supabase pooler in the target deployment — the username may need the project-ref
   suffix. Do not assume; test.
3. Switch DATABASE_URL to the new role. Run every read and write path in the
   application and confirm nothing regressed. Expect this to surface actions that
   relied on owner privileges.
4. Only then enable FORCE ROW LEVEL SECURITY, table by table, testing between each.
5. Update the misleading comments in 20260101000100 and 20260101000400 so the next
   operator sees the current architecture, not the old limitation.
6. Add prompt P-B-42's CI check: every table with a tenant_id has an FK to tenants.

Constraints: do not enable FORCE before step 3 is verified. Do not change any
application query to work around a policy failure — a policy failure is a finding,
not an obstacle. Never point the app at the owner role in any environment.

Done when: a cross-tenant read is refused BY THE DATABASE, not only by the app. Prove it:
run a query as the app role that selects another tenant's row and show it returns zero
rows, with the policy in the query plan.
```

---

## Wave 3 — Security truthfulness

### P-B-04 · Verify `app_role` claim seeding (do this before anything ships)

**Queue** B-04 · **Finding** BE-005 adjacent · **P1** · **Wave** 3 · **Needs decision** D-14 · **Fixes** potential outage

```text
In /Users/ucaany/Documents/Snap Box - Main, determine whether Owner and CEO accounts can
log in at all in production.

setUserClaims (packages/auth/src/admin.ts:105-107) has EXACTLY ONE call site in the
whole repository: owner-dashboard/staff/actions.ts:70, staff creation only. No claim is
ever written for OWNER or CEO.

authorization.ts:257-259 rejects a mismatch between the token claim and the DB row with
CLAIMS_STALE. If app_role is not seeded for Owner/CEO out of band, CLAIMS_STALE will
reject EVERY Owner and CEO password login in production.

This audit could not check it — it needs live data (AUDIT-LIM-02). This is a potential
production outage, not a security hole.

Tasks:
1. Against the real project, determine whether app_role is present on Owner and CEO
   Firebase users. Report the actual state before changing anything.
2. Per decision D-14, choose where claim seeding lives: a migration, a script, or an
   admin action. Make it idempotent.
3. Implement it and run it.
4. Verify: one real Owner login and one real CEO login both succeed.
5. Decide whether CLAIMS_STALE should be a hard failure for Owner/CEO given it depends
   on data this repository does not control. If you soften it, document exactly what
   is still enforced — role and tenant always come from the DB row regardless.

Constraints: do not remove the claims cross-check without replacing it. Never print
service-account credentials or ID tokens.

Done when: an Owner login and a CEO login both succeed in production, and claim seeding
is reproducible by running a committed command.
```

### P-B-01 · Enforce session revocation

**Queue** B-01 · **Finding** BE-007 · **P1** · **Wave** 3 · **Needs decision** — · **Fixes** BE-007

```text
In /Users/ucaany/Documents/Snap Box - Main, make logout and revoke actually revoke.

revokeAuthSession and revokeAuthSessionsForUser
(lib/ceo-dashboard/health-security-server.ts:287-319) write auth_sessions.revokedAt.
verifySession (lib/auth/session.ts:193-236) reads only HMAC, zod and exp. A revoked or
logged-out cookie stays valid for its full 12 hours. changeTenantStatus
(ceo/tenants/actions.ts:323-326, 349-351) and deleteTenant (:586-589, 611-613) disable the
Firebase account and the users row but never call revokeAuthSessionsForUser — despite
health-security-server.ts:302-306 saying that function is provided for exactly that path.

The CEO Security page renders a "Dicabut" label for a state enforcement ignores.

Tasks:
1. Note the constraint: verifySession runs on Edge and CANNOT do a DB read. The
   predicate belongs in requireCeo() and requireOwnerTenant(), both of which already
   query users. Decide and implement that placement.
2. Call revokeAuthSessionsForUser from changeTenantStatus and deleteTenant.
3. Add a test: authenticate, revoke, then reuse the cookie and show it fails.
4. Also decide whether auth_sessions needs a tenant_id column. Today "active sessions
   for tenant X" is a two-hop join and there is no bulk tenant-level session kill.

Constraints: do not add a DB read to the Edge middleware. Preserve the current fail-closed
behaviour of the Node-side gates.

Done when: a revoked cookie no longer authenticates, and a test proves it.
```

### P-B-05 · Add `requireCeo()` to the tenant loaders

**Queue** B-05 · **Finding** BE-006 · **P1** · **Wave** 3 · **Needs decision** — · **Fixes** BE-006

```text
In /Users/ucaany/Documents/Snap Box - Main, close the authorization gap on two Super-Admin
pages that read real tenant PII.

ceo-dashboard/tenants/[id]/page.tsx:58-67 and tenants/new/page.tsx:29 call
getTenantByIdOr404, findTenantOwner, listTenantSubscriptions, listTenantBooths,
listTenantActivity, listPlanOptions and checkEntitlements — none of which call
requireCeo() (lib/ceo-dashboard/tenant-server.ts:100, 132, 166, 186, 197, 215).

Every sibling page does: subscriptions/page.tsx:34, plans/page.tsx:34, promos:31,
broadcast:31, settings:30, and system-health/security inside their loaders.

This violates the repository's own rule at middleware.ts:17-21, and
ceo-dashboard/layout.tsx:12-14 explicitly delegates authorization to middleware and
requires each DB-touching route to repeat the check. Exposed data: ownerEmail,
ownerPhone, address, notes, plan tiers, subscription amounts, booth names, audit actor
emails — for up to SESSION_MAX_AGE_SECONDS = 43200 after a role change.

Tasks:
1. Put the check inside the tenant-server.ts LOADERS, not the pages. That closes the
   class of defect rather than the two instances — a new page that forgets will still
   be protected.
2. Add a test: a session whose DB role is not CEO receives 404 or a redirect on both routes.
3. Do the same sweep for any other loader in that file that lacks the check.

Constraints: return 404, not 403, for a tenant that exists but is not visible — do not
leak existence. Do not weaken any existing check while adding this one.

Done when: a non-CEO session cannot read either page, and the check lives in the loader
so a new page inherits it.
```

### P-B-11 · Add the missing same-origin check to the staff-PIN route

**Queue** B-11 · **Finding** BE-009 · **P2** · **Wave** 3 · **Needs decision** — · **Fixes** BE-009

```text
In /Users/ucaany/Documents/Snap Box - Main, close a login-CSRF gap.

api/auth/session/route.ts:61-70 implements isSameOrigin(request) and calls it at
:119-121. Its docstring at :48-59 identifies the exact risk: SameSite=Lax still sends the
cookie on a top-level cross-site POST, so without the check an attacker can bind the
victim's session cookie to the attacker's ID token.

api/auth/staff-pin/route.ts:62 goes straight to checkAuthRateLimit with no origin check
anywhere in the file — and it mints a session cookie from a POST body, identically.

Currently latent: nothing writes booths.operatorPinHash, so the endpoint can only return
PIN_REJECTED. It becomes live the moment the PIN path is implemented (see P-F-20).

Tasks:
1. Extract isSameOrigin into a shared module.
2. Call it from both routes.
3. Decide whether DELETE /api/auth/session also needs it — cross-site forced logout is
   currently possible. SameSite=Lax does not protect a top-level DELETE navigation in
   all clients.
4. Add a test: a cross-origin POST to /api/auth/staff-pin is rejected before any
   credential comparison runs.

Constraints: preserve the deliberate "no Origin header means non-browser client, allow it"
behaviour at session/route.ts:63. Do not weaken the existing session route.

Done when: both routes call the shared helper, and a cross-origin POST is rejected.
```

### P-B-30 / P-B-31 / P-B-33 · Implement pairing redemption

**Queue** B-30, B-31, B-33 · **Finding** BE-003 · **P1** · **Wave** 3 · **Needs decision** D-02 · **Fixes** BE-003, BE-014

```text
In /Users/ucaany/Documents/Snap Box - Main, close the pairing chain.

POST /api/booth/pair does not exist. pair-session/route.ts:9-10 says so and declines to
guess the contract. Consequently pairing_tokens.used, usedAt, expiresAt and attemptCount
have ZERO readers and ZERO writers; devices is never inserted into; and deviceQuota —
which counts devices — is permanently 0, so pairing is UNLIMITED ON EVERY PLAN TIER.

Tasks:
1. Implement POST /api/booth/pair per PRD 3.2. The single most important line is an
   ATOMIC claim. It must be a single statement that both validates and consumes, e.g.
     UPDATE pairing_tokens SET used=true, used_at=now()
     WHERE code_hash = $1 AND used = false AND expires_at > now()
   RETURNING booth_id, tenant_id
   and must reject when it returns no row. Do NOT read-then-write.
2. Increment attempt_count in the same statement, and define the lockout threshold.
3. Insert into devices. This is what makes deviceQuota enforceable (BE-014) — without
   it the plan tier is a promise the system cannot keep.
4. Mint the device session credential and store ONLY its hash in devices.sessionJwtHash.
   Per PRD 6.M it is 30-day and belongs in OS secure storage on the client side.
5. Audit DEVICE_PAIRED.
6. Wire pairing_tokens.expires_at and attempt_count into the redemption predicate.
7. Add tests: a token cannot be redeemed twice (including concurrently), cannot be
   redeemed after expiry, and cannot be redeemed after the attempt limit.

Constraints: do not store a plaintext credential anywhere. Do not accept a tenant or
booth id from the request body — derive both from the redeemed token. Keep the existing
144-bit entropy and SHA-256 hash-only storage. Cross-tenant booth id must return 404,
not 403.

Done when: the four tests pass, a second redemption of the same token is refused, and
deviceQuota reflects real rows.
```

### P-B-32 · Implement the heartbeat

**Queue** B-32 · **Finding** BE-016 · **P1** · **Wave** 3 · **Needs decision** — · **Fixes** BE-016

```text
In /Users/ucaany/Documents/Snap Box - Main, implement booth liveness.

booths.last_heartbeat_at and devices.last_heartbeat_at have ZERO writers repo-wide — only
readers (machine-server.ts:61,227 and device-server.ts:53). Consequences: every booth
permanently displays OFFLINE or UNPAIRED via deriveDisplayStatus (machine-contract.ts:206),
DEVICE_ONLINE/OFFLINE and BOOTH_ONLINE/OFFLINE can never fire, and PRD 6.L's
"booth offline since 15 min" alerting is non-functional.

This is the cheapest item in the realtime list and it unblocks the most.

Tasks:
1. Implement POST /api/booth/heartbeat per PRD 3.3: verify the device JWT and fingerprint,
   then update booths.last_heartbeat_at, paper_count and status.
2. Emit BOOTH_ONLINE when a booth transitions from OFFLINE, using publishRealtimeEvent so
   the event passes realtimeEventSchema.
3. Implement the offline cron: a booth with no heartbeat beyond the threshold transitions
   to OFFLINE, emits BOOTH_OFFLINE, and notifies the Owner.
4. Note the interval conflict for the owner: PRD 3.3 says heartbeat and a 90s offline
   cron; PRD 4.11 says 30s heartbeat, 15s for Growth/Enterprise. Pick one and record it.
5. Add a test: a booth that stops heartbeating goes OFFLINE without human action.

Constraints: the heartbeat endpoint is unauthenticated-by-booth but device-authenticated —
verify the JWT and the fingerprint, never trust a booth id from the body. Do not create
the offline cron until the retention/cron decision (B-22) has an owner, so you do not
create a second unscheduled job.

Done when: a silent booth transitions to OFFLINE on its own, and the transition is audited.
```

### P-B-37 / P-B-38 · Fix the Cloudflare ruleset, then decide deploy

**Queue** B-37, B-38 · **Finding** BE-010, BE-028 · **P2** · **Wave** 3 · **Needs decision** D-12 · **Fixes** BE-010, BE-028

```text
In /Users/ucaany/Documents/Snap Box - Main, correct the edge-protection drafts BEFORE
anyone deploys them.

infra/cloudflare/README.md:6-7 states nothing in that directory is executed against any
account. The drafts are complete but inert, and two of them are wrong:

1. Five of eight rate-limit rules target endpoints that DO NOT EXIST:
     /api/payment/create  (rate-limit-rules.json:62)
     /api/contact        (:75)
     /api/operator/*     (:88)
     /api/pairing/*      (:103)   <- the real path is /api/booth/*
   and the /api/booth/* rule is blocked by $requiresWorker: true (:48) with no Worker in
   the repo — so it cannot match at all.
2. The README's own verification procedure (:145-151) curls /api/contact and expects a
   429. It will get a 404. The runbook would report a false negative.
3. Turnstile keys are declared in packages/shared/src/env.ts:37,110 and
   infra/cloudflare/turnstile-widget.json exists, but "turnstile" appears ZERO times in
   apps/web/src. No endpoint has a bot challenge.

Meanwhile the only rate limiting that actually runs is lib/auth/rate-limit.ts: an
in-memory Map, per-instance, with a spoofable x-forwarded-for source, and
  :51  if (buckets.size >= MAX_BUCKETS) buckets.clear();
which lets one attacker generate 5000 keys and WIPE EVERY COUNTER FOR EVERY USER.

Tasks:
1. Fix the ruleset: point each rule at a path that exists, or mark it as forward-looking
   with a comment naming the PRD task that will create it. Fix the README verification
   procedure to test a path that exists.
2. Either write the Worker the $requiresWorker rules depend on, or remove those rules.
3. Per decision D-12, deploy or drop. If dropping, delete the drafts and stop claiming
   edge protection in the docs — an honest "not deployed" beats a false sense of safety.
4. Replace buckets.clear() with LRU expiry of expired entries (prompt P-B-36).
5. Either wire Turnstile into at least /api/auth/*, or delete the declarations so the env
   inventory reflects reality.
6. Make check:infra-drafts validate against the CODEBASE, not only the PRD allowlist, so
   a rule targeting a non-existent route fails CI.

Constraints: do not deploy a ruleset that has not been fixed first. Do not widen any
rule's scope. Do not print API tokens while testing.

Done when: the documented verification procedure passes against a real deployment, or
the drafts are deleted and the docs say so.
```

### P-B-39 / P-B-40 · Response headers and server-only assertions

**Queue** B-39, B-40 · **Finding** BE-008, BE-017, BE-034 · **P2** · **Wave** 3 · **Needs decision** — · **Fixes** BE-008, BE-017, BE-034

```text
In /Users/ucaany/Documents/Snap Box - Main, add the two missing security headers and
close the server-only gap.

MISSING HEADERS. next.config.ts:28-43 sets X-Content-Type-Options, Referrer-Policy,
X-Frame-Options and Permissions-Policy. It does NOT set Strict-Transport-Security or
Content-Security-Policy, and PRD 8.2 requires XSS sanitisation. The Tauri CSP
(tauri.conf.json:26) is already strict — script-src 'self' with no unsafe-inline — so the
web app is the weaker of the two.

SERVER-ONLY. import 'server-only' appears on only 2 of roughly 15 server modules.
Absent from: packages/db/src/client.ts, lib/owner-dashboard/outlet-server.ts,
lib/ceo-dashboard/broadcast-server.ts, lib/entitlement/entitlement-service.ts,
lib/ceo-dashboard/pakasir-b2b.ts, lib/email/resend.ts,
lib/owner-dashboard/payment-server.ts.
broadcast-server.ts is the priority: it reads SUPABASE_SERVICE_ROLE_KEY (:116) and
transmits it (:126-127) with no assertion.

Tasks:
1. Add HSTS and a CSP to next.config.ts. Start in report-only if you need to measure
   first, and record that you did. Add object-src/base-uri/form-action to the Tauri CSP.
2. Also fix session.ts:276 — secure is NODE_ENV === 'production', so preview and staging
   serve the session cookie over plain HTTP. Make it unconditional outside local dev.
3. Add import 'server-only' to the listed modules, starting with broadcast-server.ts and
   packages/db/src/client.ts.
4. Verify: a client component importing a server module now fails to build.

Constraints: the CSP must not break the app — the Tauri config already shows a working
connect-src for Supabase realtime (wss://*.supabase.co) and the API host. Do not add
unsafe-eval. Do not add object-src * .

Done when: response headers carry both HSTS and CSP, and a deliberate client import of a
server module fails the build.
```

---

## Wave 4 — Frontend rewrite

**All of Wave 4 except F-07, F-08, F-06, F-16, F-33 depends on D-01.**

### P-F-01 · Record the palette decision

**Queue** F-01 · **Finding** FE-001 · **P0** · **Wave 0** · **Needs decision** ~~D-01~~ ✅ **ANSWERED** · **Fixes** FE-001

> **D-01 IS ANSWERED (2026-09-26): the palette is fully blue, and there are no gradients, applied across all files.** This prompt is superseded by **Phase 1 in `13_PHASE_PROMPTS.md`**, which carries the full instruction set including the three gradients to remove, the PRD amendment, and the new CI guard. Run Phase 1, not this prompt.
>
> Recorded here so the queue item is not read as blocked. The one sub-decision still open is the border width and shadow offset, which Phase 1 explicitly declines to guess.

```text
SUPERSEDED — see Phase 1 in AUDIT/13_PHASE_PROMPTS.md.

The original direction, for the record: apply the recorded palette decision consistently
across all three surfaces, move the public brand palette into tokens and start consuming
the already-exported BRAND object, resolve border width and the shadow language, write a
superseding ADR, and update PRD section 4.

Why it is superseded: the decision is now ANSWERED (full blue, no gradients), so this is
no longer a decision prompt — it is an execution prompt, and Phase 1 carries the complete
version including the three specific brand gradients at globals.css:412, :418 and :422-426.
```

<details><summary>Original prompt (superseded)</summary>

```text
In /Users/ucaany/Documents/Snap Box - Main, execute the recorded palette decision.

READ FIRST: AUDIT/11_DECISIONS_REQUIRED.md D-01. Do not proceed until D-01 is answered.

Three identities currently ship: blue dashboards (globals.css:43-73), PRD yellow/violet/
pink marketing (globals.css:378-676 plus ~30 inline hexes), and a red/violet/cream
kiosk-editor default (kiosk-theme-contract.ts:77-81). ADR-002 declares PRD section 4
"usang" and is therefore half-true. 208 arbitrary hexes exist and the intended BRAND
object (content/public.ts:240-258) is imported by zero files.

Tasks:
1. Apply the recorded decision consistently across all three surfaces.
2. Move the public brand palette into tokens and start consuming the already-exported
   BRAND object, so a brand change is one edit (this is PC-14 and the mechanism by which
   the current split went unnoticed).
3. Resolve border width (PRD says 3-4px, 318 of 358 declarations are border-2) and the
   shadow language (4px token, 6px .public-hard-shadow, 8px .ceo-dialog, 28 arbitrary
   values).
4. Write a superseding ADR in docs/. Do not edit ADR-002 in place.
5. Update PRD section 4 to match the decision, and record in AUDIT/11 that D-01 is
   answered.

Constraints: do not leave any surface on the old palette "for now" — a third identity is
how this happened. Do not hand-edit snapshots or generated files.

Done when: one palette governs all three surfaces, the BRAND object has consumers, and
ADR-002 is either superseded or marked superseded.
```

</details>

### P-F-05 · Re-express the two unstyled views

**Queue** F-05 · **Finding** FE-003 · **P1** · **Wave** 4 · **Needs decision** D-01 · **Fixes** FE-003

```text
In /Users/ucaany/Documents/Snap Box - Main, fix the two Owner pages that render
browser-default HTML.

settings-view.tsx:27,28,30 and support-view.tsx:26,27,30 use owner-section,
owner-eyebrow and owner-form — three classes defined NOWHERE. Both views then render bare
<input>/<select>/<textarea>/<button> with zero Tailwind classes and zero @snapbox/ui, so
they have no border, no shadow, no radius, no brand, no 44px tap target, and NO focus
ring at all.

Tasks:
1. Decide: add the three owner-* rules, or re-express both views in the existing
   primitive vocabulary. The rest of the dashboard uses the vocabulary, so re-expressing
   is the smaller long-term cost — but a decision is required, not a preference.
2. Whatever you choose, both views must render with a focus ring and a 44px target.
3. These two views are also the only ones with no field-level error state. Add them
   (see P-F-34).
4. Run P-F-03's guard to confirm no undefined class remains.

Constraints: do not fix this by adding classes that only satisfy the guard. The test is
whether the page looks like the other 19, not whether the guard is quiet.

Done when: both pages render inside the design system, keyboard-focusable with a visible
ring, and the undefined-class guard passes.
```

### P-F-06 · Gate `/gallery`

**Queue** F-06 · **Finding** FE-003d · **P1** · **Wave** 1 · **Needs decision** D-15 · **Fixes** FE-003d

```text
In /Users/ucaany/Documents/Snap Box - Main, decide and enforce the status of /gallery.

app/gallery/ is a ~4200-line internal design-system catalog. It is NOT in the middleware
matcher (middleware.ts:43-49), so it has no auth and no role check. robots.ts:15 and
noindex are advisory to crawlers, not access control. It is unlinked — 3 grep hits, all
comments. Any anonymous visitor who types /gallery receives it, including 20 dummy tenant
names, 3 dummy device ids, and heavy-dependency chunks (@tanstack/react-table,
react-day-picker, recharts, react-hook-form, zod) served as public downloads.

41 of the 64 primitives in packages/ui exist only to serve this page.

Tasks, in order:
1. Per decision D-15, choose: gate behind auth, notFound() outside development, or
   delete. Whichever you choose, ENFORCE it in middleware or in the route — not in
   robots.txt.
2. Record the consequence: this decision scopes how much of packages/ui is actually
   required. If the gallery goes, most of those 41 primitives should follow it.
3. If the gallery is kept, add access control to the matcher and re-check the dependency
   chunk sizes.
4. Note that ADR-002:42-43 and :57-60 are stale — they claim / is the gallery and that /
   is noindex, while the gallery is at /gallery and / is the indexable landing.

Constraints: do not rely on robots.txt or noindex as access control — say so in a comment
wherever they are used for that purpose.

Done when: an anonymous request to /gallery outside development is refused by the
application, not by a crawler directive.
```

### P-F-07 / P-F-08 · Layout states and the error boundary

**Queue** F-07, F-08 · **Finding** FE-011, FE-003e · **P1/P2** · **Wave** 4 · **Needs decision** — · **Fixes** FE-011, FE-003e

```text
In /Users/ucaany/Documents/Snap Box - Main, give the app the state contract PRD 11
Definition of Done item 11 requires.

THE GAP. There are ZERO loading.tsx and ZERO error.tsx and ZERO not-found.tsx files in
the entire app/ tree — only app/global-error.tsx. No route uses <Suspense>. So 19+ data
routes have no loading UI, and a database throw escalates to a full-page error that
replaces the entire layout.

Tasks:
1. Add loading.tsx and error.tsx per dashboard segment and a not-found.tsx. Each
   error.tsx must offer a recovery action, not just "Something went wrong" (PRD 10.13).
2. Wrap data fetching in <Suspense> with a real skeleton so the loading state actually
   renders. 05 provides a skeleton primitive.
3. Fix global-error.tsx. It renders a bare <html> that REPLACES layout.tsx, so the
   next/font variables are never applied — font-[family-name:var(--font-display)] at :33
   falls back to ui-sans-serif. It also uses a bare <button> at :42-48 with no
   rounded-base, no shadow-shadow and no min-h-11. Re-apply the font variables explicitly
   and use the Button primitive.
4. Verify whether globals.css survives into global-error.tsx at all — if it does not, the
   bg-background/border-border/bg-main classes there are dead too. This is UNVERIFIED in
   the audit and needs a real build.

Constraints: a deliberately-thrown loader error must stay INSIDE its segment and not
replace the whole layout. Do not add a generic "Something went wrong" string.

Done when: a deliberately-thrown error renders a recoverable error state inside the
segment, and a triggered root error renders with the app's font and a full-size button.
```

### P-F-09 / F-10 / F-11 / F-12 / F-13 / F-14 / F-16 · Design-system convergence

**Queue** F-09…F-16 · **Finding** FE-014, FE-015, §3B · **P2** · **Wave** 4 · **Needs decision** D-01, D-11 · **Fixes** FE-014, FE-015

```text
In /Users/ucaany/Documents/Snap Box - Main, converge the Owner dashboard onto one design
language. Read AUDIT/11 D-01 and D-11 first.

THE DRIFT. Two incompatible Tailwind vocabularies coexist in
components/owner-dashboard/:
  border-foreground + shadow-[4px_4px_0_0_currentColor]
    staff-view.tsx:161, packages-view.tsx:286, outlets-view.tsx:166, promos-view.tsx:193,
    transactions-view.tsx:21,54, reports-view.tsx:167
  border-border + shadow-[6px_6px_0_0_var(--color-border)]
    templates-view.tsx:29, kiosk-theme-view.tsx:30, machines-view.tsx:128
Three focus-ring tokens coexist (outline-violet-600, outline-ring, ring-foreground).
STATUS_CLASS is duplicated 3x. Input classes are duplicated 3x with divergent border
tokens. Dashed empty states diverge across 13 files. 15 of 21 views bypass @snapbox/ui
and 6 mix both systems on one screen. 0 of 21 owner views use the rounded-base radius token.

Tasks, each independently verifiable:
1. One vocabulary for border token, shadow offset, focus ring, status colour, empty state.
2. ONE status-colour map replacing all three STATUS_CLASS copies.
3. Replace font-black x3 (kiosk-theme-view.tsx:119,427; frame-studio-view.tsx:136) with
   the font-heading token — those three h1s are visibly heavier than every other.
4. Align Alert destructive (packages/ui/src/components/alert.tsx:13, bg-black text-white)
   with ADR-002, which specifies bg-red-700 — or amend the ADR deliberately.
5. Replace ring-black / ring-offset-white x7 in packages/ui with ring-ring /
   ring-offset-background.
6. Delete the 63 dead CSS rules (44 .owner-outlet-*, 19 .ceo-*) or adopt them. Do not
   leave them. NOTE: .owner-outlet-table-scroll is the exact overflow-x:auto rule a live
   table needs — see P-F-49 before deleting it.
7. Delete the dead reference-library leftovers (px-rounded-md, px-border-md, px-ring,
   [data-slot='star-ring']) which have zero usages.
8. Per D-11, either wire every owner view onto @snapbox/ui or state that hand-rolled is
   the standard and shrink the library to what is used.
9. Fix themeColor in layout.tsx:70 to the decided palette.
10. Consolidate the ~8 duplicate inline-SVG icon sets, or promote lucide-react to an
    apps/web dependency. Two independent nav-glyph maps exist today.

Constraints: do not change a colour to make a grep quiet. Do not close a duplication by
copying it a third time. Preserve the anti-fabrication policy and the "pending" labels —
they are correct, not slop.

Done when: grep finds no arbitrary hex or shadow value in the owner views, each of the 21
views is single-language, and a theme change requires one edit.
```

### F-15 · Dark mode

**Queue** F-15 · **Finding** FE-009 · **P2** · **Wave** 4 · **Needs decision** D-13 · **Fixes** FE-009

```text
In /Users/ucaany/Documents/Snap Box - Main, resolve the dead dark-mode control.

ThemeToggle and themeInitScript write data-theme="dark" and style.colorScheme='dark',
but globals.css contains NO [data-theme='dark'], .dark, or prefers-color-scheme rule at
all (grep: 0 matches). Toggling changes native scrollbar and form-control colours and
nothing else — a PARTIAL dark rendering, which is worse than no toggle. ThemeToggle
renders in the CEO header only; the Owner header has none.

Tasks, per decision D-13:
1. Either implement a real dark token set, or remove ThemeToggle and themeInitScript.
2. If implementing: define the dark palette in :root under a [data-theme='dark'] block,
   keep packages/ui/src/styles.css byte-identical, and verify every semantic token has a
   dark value — including the ones added by P-F-02.
3. If removing: delete the component, the init script, and the header usage.

Constraints: do not ship a toggle that changes only native widget colours. Do not
half-implement: a partial dark theme is the current defect.

Done when: toggling visibly changes the rendering, or the control does not exist.
```

### P-F-34 / F-35 / F-36 / F-37 / F-38 · State handling and dead controls

**Queue** F-34…F-38 · **Finding** FE-013 · **P2** · **Wave** 7 · **Needs decision** — · **Fixes** FE-013

```text
In /Users/ucaany/Documents/Snap Box - Main, agree one state contract and resolve the
twelve dead or misleading controls.

STATE CONTRACT. Standardise pending / error / retry / empty across all 21 owner views.
finance-analytics-view and reports-view have NO empty state at all. Every control should
pass through Idle -> Loading -> Success -> Error -> Retry, not just a click handler.

DEAD AND MISLEADING CONTROLS:
- [owner-dashboard]/[...segments]/page.tsx:55 renders "Segera hadir" and is currently
  UNREACHABLE, but its 18-entry denylist duplicates OWNER_NAV_ITEMS and has already
  drifted — the .orig sibling lacks 'customers'. Delete the branch (P-F-18 also touches
  this file).
- subscription-view.tsx:100,146,174 — 3 of 4 CTAs are disabled with no handler.
- promos/actions.ts exports updatePromo, batchGenerate and redeemPromo with ZERO
  callers. batchGenerate is the only route to 500-code generation; redeemPromo is the
  only writer to promo_redemptions. Implement or delete.
- deletePromo is a soft disable behind a "Hapus" label. Relabel it "Nonaktifkan".
- promos-view.tsx exposes no quotaTotal / quotaPerCustomer inputs, so every UI-created
  promo is unlimited and 1-per-customer.
- settings/actions.ts:28 getOwnerSettings is a READ exported from a 'use server' module,
  making it a network-callable action. Move it to a plain server function.
- payment-settings/page.tsx:10 computes canConfigure and canUseBackup and DISCARDS both.
  Surface them; add a saved-config list and a deactivate path; useState is seeded once so
  a new save never appears.
- outlet-detail-view.tsx has no 'use client' — it is 100% read-only while
  updateOutlet and setOutletActive exist one level up.
- 6 views call window.location.reload() instead of router.refresh(); 6 seed
  useState(props) once with no prop sync, so lists go stale after revalidatePath.
- machines-view.tsx:219-228 — regeneratePairingSession has no confirmation, while the
  same action family IS confirmed in machine-detail-view. kiosk-theme publish also has none.
- loadOwnerKioskTheme (kiosk-theme-server.ts:59,66) performs an INSERT during a GET render,
  advisory-locked on every load. A page render must not write.

Constraints: do not delete an action that is the only path to a real capability without
recording the decision. Do not add a confirmation dialog to a non-destructive action.

Done when: every view has all four states, no exported action has zero callers, no label
misdescribes its behaviour, and loading a page performs no write.
```

### P-F-45 · Fill or remove the empty public sections

**Queue** F-45 · **Finding** — · **P2** · **Wave** 4 · **Needs decision** D-08, PC-06 · **Fixes** §3B

```text
In /Users/ucaany/Documents/Snap Box - Main, resolve four public sections that render as
structurally-present but content-empty boxes.

  /harga          comparison matrix (:86-93) and add-on table (:109-111) — both empty
  /kamera         registry section is one empty dashed box (:48-55)
  /unduh-aplikasi a DISABLED button labelled "Buka Konsol Perangkat (Web)" pointing at a
                  route that does not exist (:93-105)
  /               6 "pending" badges + 6 dashed logo slots + 3 dashed mini-chart
                  placeholders, plus 7 stacked sections sharing one skeleton

For /kamera specifically, the DB table camera_compatibility EXISTS with a public read
policy and a unique (brand, model) constraint, but the page does not fetch it.
content/public.ts:433 states the registry is unavailable and claims no model count.

Tasks, per the relevant decisions:
1. /kamera: either fetch camera_compatibility and render it, or state plainly that the
   registry is not yet populated. PRD 4.15 and ADR-009 want the fetch; PC-06 is the
   conflict to resolve first.
2. /harga: fill the comparison and add-on sections from the real plans table, or remove
   them. PRD 3.3 lists both as required content.
3. /unduh-aplikasi: remove the dead button, or build the route it points at.
4. /: keep the pending labels — they are the anti-fabrication policy and are correct. But
   reduce the repetition: 7 sections sharing one skeleton (mono eyebrow, h2, paragraph,
   box) is the templated pattern to break up, not the honesty.

Constraints: do NOT fabricate content to fill a section — no invented prices, logos,
testimonials, or camera model counts. An honest "not yet available" that is designed to
look deliberate beats an empty box that looks broken.

Done when: no public section renders as a structurally-empty box.
```

### P-F-49 · Responsive fixes, then validate at 7 viewports

**Queue** F-49 · **Finding** FE-017 · **P2** · **Wave** 4 · **Needs decision** — · **Fixes** FE-017

```text
In /Users/ucaany/Documents/Snap Box - Main, fix the responsive gaps, THEN validate.

THE GAPS.
1. One unwrapped table: ceo-dashboard/tenants/[id]/page.tsx:137-138 — a bare <table>
   inside .ceo-table-wrap, which has NO overflow rule (globals.css:1836-1841 defines only
   min-width: 0). 5 columns of rupiah/dates overflow below 768px. The fix already exists
   UNUSED as .owner-outlet-table-scroll (globals.css:1421-1425) — do not delete it in
   P-F-09 before using it here.
2. Three fixed 3-column grids that never collapse below 640px: .ceo-plans (3x until
   900px, :1920-1924), .ceo-promo-grid (3x until 720px, :2656-2660), and three
   sm:grid-cols-3 blocks in kiosk-theme-view.
3. Two hamburger buttons coexist at 768-1023px (owner-header.tsx:32-40 and
   owner-sidebar.tsx:64-67), both toggling the same state, because md:hidden is used
   ZERO times repo-wide — the pattern was inverted instead.
4. Minor: useIsMobile returns false on first paint, so below 768px there is a brief
   invisible-sidebar gap. .ceo-metrics lacks the min-width: 0 that .owner-main and
   .ceo-main both declare.

VERIFICATION — this is the first item in the whole audit that genuinely requires runtime
(AUDIT-LIM-01). The audit could not build or render anything.

5. Build the app, then measure at 375 / 390 / 768 / 1024 / 1280 / 1440 / 1920. Check:
   horizontal scroll, clipped content, table overflow, modal fit, form usability, chart
   legibility, nav reachability, touch targets, text wrapping.
6. Record the results. Any viewport claim in the audit is UNVERIFIED until this runs.

Constraints: the sidebar drawer at 768px is CORRECT — do not "fix" it into a fixed rail.
A previous reading of the audit mistook it for one.

Done when: no horizontal overflow at 375px, one menu affordance per breakpoint, and a
recorded result for all 7 viewports.
```

### P-F-50 · Accessibility gate

**Queue** F-50 · **Finding** FE-018 · **P2** · **Wave** 4 · **Needs decision** — · **Fixes** FE-018

```text
In /Users/ucaany/Documents/Snap Box - Main, close the accessibility gaps and make AA
verifiable.

VERIFIED GOOD — do not regress these. 151 aria-label, 61 aria-labelledby, 100 <label> +
33 <Label>; every icon-only control labelled; 5/5 images with alt text; 34 role="status",
24 role="alert"; StatusBadge is text+tone and never colour-only (panel.tsx:38-41);
tap targets extended to 44px via a before:h-11 pseudo hit-area (button.tsx:9-13);
prefers-reduced-motion in 4 scope scrims plus framer-motion useReducedMotion; correct
landmarks; exactly one <h1> per page.

THE GAPS.
1. No .owner-shell focus-visible scrim. .public-shell (:471-475), .auth-shell (:693-697)
   and .ceo-shell (:2608-2612) each have a global outline: 3px rule. .owner-shell has
   NONE — so settings-view and support-view inputs have no focus styling at all.
2. No skip link. id="owner-main" (owner-sidebar.tsx:39) and id="ceo-main"
   (ceo-sidebar.tsx:47) exist but nothing links to them — 40+ nav items in two dashboards.
3. Four contrast pairs are UNVERIFIED and need computing, not estimating:
   text-[#8B5CF6] on #FFFEF5 cream, 7 uses at 10-12px mono (public/page.tsx:120,139,333;
   fitur/page.tsx:95,109,113; tentang/page.tsx:186) — estimated ~4.1:1, likely below AA
   4.5:1 for small text; text-[#16A34A] on cream (fitur/page.tsx:290); the
   bg-red-200 / bg-green-200 / bg-amber-200 rows with inherited black
   (machines-view.tsx:37-39,118,309); border-amber-500 on bg-amber-50
   (reports-view.tsx:67). ADR-002:86-97 only audited red-500 in the reference components.
4. focus-visible:outline-violet-600 (transactions-view.tsx:21) is a third focus-ring
   token, unverified for 3:1 on blue. Resolve with P-F-09.
5. reports-view.tsx renders TWO <h1> in one DOM tree (:62 page title, :202 print header).
6. notifications-view.tsx:44-46 renders an empty, always-present role="status" region.
7. The account menu moves no focus into role="menu" and has no arrow-key navigation.
8. NO axe-core and no a11y test exists anywhere. PRD Task 7.14 is MISSING, so WCAG 2.2 AA
   CANNOT be certified in either direction.

Tasks:
1. Integrate axe-core into the test suite and make it gate CI.
2. Fix items 1, 2, 5, 6, 7.
3. COMPUTE the four contrast ratios and fix any that fail. Do not estimate.
4. Run the full axe sweep and record the result per route.

Constraints: do not suppress an axe violation to make the gate green — fix the cause or
record an explicit, justified exception. Do not claim AA conformance without running it.

Done when: axe-core runs in CI, the four contrast ratios are measured rather than
estimated, and the computed values are recorded in this file's findings.
```

---

## Wave 5 — Data integrity

### P-F-23 · Fix the swapped notification arguments

**Queue** F-23 · **Finding** FE-005 · **P1** · **Wave** 5 · **Needs decision** — · **Fixes** FE-005

```text
In /Users/ucaany/Documents/Snap Box - Main, fix a shipped feature that is silently dead.

notifications/page.tsx:15 calls
  listOwnerNotifications(auth.tenantId, auth.session.userId)
but the signature at notifications-server.ts:5 is
  listOwnerNotifications(userId: string, tenantId: string)
The arguments are SWAPPED. The WHERE becomes user_id = <tenantId> OR
tenant_id = <userId>, so every owner-addressed notification is filtered out and the page
is permanently empty. The empty state "Belum ada notifikasi baru."
(notifications-view.tsx:47-48) makes the bug indistinguishable from "no data".

Compounding: notifications-server.ts:19-25 and notifications/actions.ts:17-27 both AND
together a redundant third or(userId = me, tenantId = mine) group that NULLIFIES the
intended userId IS NULL (tenant-broadcast) clause. So broadcast notifications can never
be listed or marked read — by design or by bug, nobody can tell.

No test covers this; owner-account-contract.test.mjs:10 asserts against a DELETED module.

Tasks:
1. Fix the call site or the signature. Make the mismatch impossible to reintroduce —
   consider a single object argument rather than two positional strings.
2. Decide whether tenant-broadcast semantics is wanted. If yes, remove the nullifying OR
   group so a broadcast row is readable and markable. If no, delete the IS NULL clauses
   so the intent is honest.
3. Add a test that seeds a tenant notification and asserts it appears, and a second that
   seeds a broadcast and asserts the chosen behaviour.
4. Then build the bell: owner-header.tsx:52-58 is a plain <Link> with no unread count and
   no dropdown. PRD 6.9 requires a bell dropdown plus a /notifications page for Owner,
   Staff and CEO.

Constraints: do not change the empty-state copy to hide the bug. The test must seed real
rows, not assert on a regex over source.

Done when: a seeded tenant notification appears on the page, the chosen broadcast
behaviour is covered by a test, and the bell shows an unread count.
```

### P-F-24 · Decide demo vs real for the five data-light surfaces

**Queue** F-24 · **Finding** FE-006 · **P1** · **Wave** 5 · **Needs decision** D-05 · **Fixes** FE-006

```text
In /Users/ucaany/Documents/Snap Box - Main, resolve the five data-light Owner surfaces.

Per decision D-05. Do not proceed until it is answered.

The dashboard root is a 4-number stub; PRD 3.C requires revenue-today, a paper-stock
alert, a 7-day chart, a booth online/offline summary, and quick actions.
finance, analytics and reports render finance-analytics-demo.ts or hardcoded DAILY_ROWS.
customers is a 15-line stub calling no data function.

IMPORTANT DEPENDENCY: real finance and analytics need a transactions writer, and there
is NONE — insert(transactions) appears zero times in the application (see P-B-23/B-24).
"Make it real" is therefore blocked behind the payment path.

Tasks:
1. Apply the decision.
2. If option A (make real): build a finance-analytics-server.ts over transactions and
   calculate from the same queries transaction-server.ts already uses. Do not introduce a
   second source of truth for revenue.
3. If option B (keep as labelled demos): move them out of the production nav so a
   screenshot of /finance is not mistaken for a real figure. Keep the disclosure banners.
4. For the dashboard root, implement the five PRD 3.C elements regardless of the
   finance/analytics decision — the quick actions and the booth summary do not depend on
   payment existing.

Constraints: do NOT fabricate data to fill a real surface. If a number cannot be computed
yet, show an explicit unavailable state rather than a plausible figure.

Done when: each of the five either queries the database or is unambiguously labelled as
a demo in navigation, and the dashboard root carries the five PRD 3.C elements.
```

### P-F-25 / F-26 / F-27 · Data-fetching mechanics

**Queue** F-25…F-27 · **Finding** FE-013 · **P2** · **Wave** 5 · **Needs decision** — · **Fixes** FE-013

```text
In /Users/ucaany/Documents/Snap Box - Main, fix three data-fetching mechanics.

1. kiosk-theme-server.ts:59,66 performs an INSERT during a GET render (advisory-locked on
   every subsequent load). A page render must not write. Move the lazy-create to an
   explicit action, or ensure the row at tenant-provisioning time.
2. Six views call window.location.reload() instead of router.refresh():
   outlets-view.tsx:36, staff-view.tsx:36, packages-view.tsx:62, promos-view.tsx:45,
   templates-view.tsx:58, frame-studio-view.tsx:110,125.
3. Six views seed useState(props) once with no prop sync, so lists go stale after
   revalidatePath: outlets-view.tsx:22, packages-view.tsx:31, templates-view.tsx:32,
   promos-view.tsx:27, staff-view.tsx:21, notifications-view.tsx:17.

Also: getOwnerSettings (settings/actions.ts:28) is a read exported from a 'use server'
module, which makes it a remotely-invocable endpoint. Move it to a plain server function
called from the server component.

Tasks: fix all four. For the useState cases, either sync on prop change or drive the list
from the server component after the action.

Constraints: do not solve staleness by adding more client state. Do not keep a read in a
'use server' module.

Done when: loading any page performs no write, no view calls window.location.reload, and
a mutation is reflected in the list without a full page load.
```

### P-F-28 / F-29 / F-30 / F-31 / F-32 / F-33 · API contract

**Queue** F-28…F-33 · **Finding** FE-021 · **P2** · **Wave** 5 · **Needs decision** D-06 · **Fixes** FE-021

```text
In /Users/ucaany/Documents/Snap Box - Main, close the frontend-to-API contract gaps.
Read AUDIT/11 D-06 before starting item 2.

1. boothStatusSchema: machine-contract.ts:28 RE-DECLARES the same export name as
   domain.ts:25 with only 4 members, dropping DEGRADED. A DEGRADED booth therefore fails
   validation in the Owner Machine Manager. Import the shared schema instead.
2. Error envelope. Three shapes coexist across 9 route files, and the PRD 10.13 envelope
   in packages/shared/src/errors.ts is used by ZERO handlers. Per D-06, adopt one. The
   shared envelope carries retryable and requestId, which is what lets a client decide
   between retrying and showing a real message — preserve those fields.
3. Five locally re-declared enums: transaction-contract.ts:5 (a third identical copy of
   payment_status), template-contract.ts:41 (LOWERCASE against a free-text column),
   package-contract.ts:12, health-security-contract.ts:15 (3 severity members vs the
   domain's 4 — ERROR is missing, so a notifications row of severity ERROR is unreadable
   through the CEO security surface), machine-contract.ts:79-87 (a duplicated
   'LIMIT_REACHED' entry). Adopt the shared definitions or delete the shared ones.
4. user:{userId}: events.ts:15 is a generic builder, but
   supabase/…00300_realtime.sql:46-49 requires the suffix to be the FIREBASE UID, while
   Session.userId (auth.ts:105) is a UUID. Currently latent because nothing publishes
   there, but any future subscriber is denied by its own policy. Make the helper and the
   policy agree.
5. SUPPORT_EMAIL — handled by prompt P-B-12; confirm, do not duplicate the work.
6. robots.ts:13-22 disallows /owner (which prefix-covers /owner-dashboard incidentally)
   but NOT /ceo-dashboard. PRD 8.1 requires blocking all three dashboard prefixes
   explicitly. Add /ceo-dashboard, /owner-dashboard, /staff-dashboard. Note that
   noindex metadata already exists in both dashboard layouts — PRD 8.1 asks for the
   robots block specifically, so add it, and decide whether the per-layout noindex is
   then redundant.

Constraints: do not remove a contract field a consumer reads. Do not resolve a mismatch
by loosening a zod schema to accept a value the database cannot store.

Done when: one definition per enum, one error shape across all 9 route files, a DEGRADED
booth renders, and all three dashboard prefixes appear in robots.txt.
```

### P-B-14 … B-22 · Database integrity

**Queue** B-14…B-22 · **Findings** BE-015, BE-020, BE-021, BE-023, BE-024, BE-027, BE-029, BE-033 · **Wave** 5

```text
In /Users/ucaany/Documents/Snap Box - Main, close the database-integrity gaps. This
prompt covers nine items; run them in this order.

1. (B-00a, if not already done) Journal the orphaned 0005 migration and add a CI
   assertion that every file in migrations/ has a journal entry.
2. (B-00c) Restore snapshot parity for security_events, auth_sessions and
   system_health_checks BEFORE anyone runs drizzle-kit generate. See P-B-00c and D-10.
3. (B-16) Add the six missing tenant_id foreign keys: users (schema.ts:92),
   promo_redemptions (:526), sessions (:812), download_tokens (:860), activity_logs
   (:636), device_logs (:755). Plus sessions.booth_id, sessions.device_id,
   device_logs.booth_id, promo_redemptions.transaction_id, pairing_tokens.created_by_user_id.
   Consequence today: ON DELETE CASCADE FROM tenants is declared on 15 other tables and
   does NOT clean these, so deleting a tenant orphans audit logs (5-year retention),
   sessions, download tokens and redemptions.
4. (B-17) Stop accepting a client-supplied transactionId in owner/promos/actions.ts:176-182.
   It is written to a column with no FK, and the cross-tenant RLS check that would catch
   it (0005_phase_2_owner_rls.sql:107) NEVER RUNS because the app connects as the table
   owner. Validate inside the action. Do this even before B-08 lands — it is exploitable
   in the service layer today.
5. (B-18) Add SELECT ... FOR UPDATE to the Pakasir subscription write path. Read
   route.ts:126 (read) and :172-182 (write) — the monotonic guard is computed from a
   stale read and there is no transaction, so two concurrent events with DIFFERENT
   eventIds for one invoice can interleave. The pattern already exists at
   owner/promos/actions.ts:146.
6. (B-19) Widen redeemPromo's lookup at promos/actions.ts:146 from
   tenant_id = ${a.tenantId} to (tenant_id = me OR tenant_id IS NULL) so CEO-global
   promos are reachable. The RLS policy at 0005:118-122 is already correct; the
   application query is narrower than the policy, and the query wins.
7. (B-20) app.is_ceo() fail-open branch — see prompt P-B-20.
8. (B-21) Add indexes. SEVEN tables have ZERO indexes of any kind: frame_versions,
   templates, packages, kiosk_themes, kiosk_theme_versions, broadcasts, webhook_failures.
   templates and packages are the urgent pair — they are NOT NULL-scoped tenant tables
   queried on EVERY Owner dashboard load via eq(x.tenantId, tenantId), so each is a
   sequential scan. Also add tenant_id indexes on pairing_tokens, promo_redemptions,
   sessions, download_tokens, device_logs, paper_logs, booth_frames; and index
   webhook_failures on provider/resolved/created_at, since the documented retention purge
   is currently sequential. Note broadcasts.target_tenant_ids is unindexed jsonb scanned
   per row by jsonb_exists.
9. (B-22) Reconcile the contradictory migration-history comments:
   20260101000100:7-15 says "never applied to any environment";
   20260101000400:5-6 says "already pushed to origin/main and now frozen". Both cannot be
   true. Establish the real state against a live database, then correct both. Also
   replace migrate-ordered.mjs's exact-file-count assertion (:66-67) with a phase-aware
   check that REPORTS what changed — adding a 9th Supabase migration currently crashes
   the script with a bare throw.

Constraints: do not enable FORCE RLS as part of this prompt — that is P-B-08 and has its
own ordering. Do not add an FK that would fail on existing orphan rows without first
reporting how many there are. Never drop a table to resolve a constraint.

Done when: every file in migrations/ has a journal entry, generate produces an empty
diff, deleting a tenant leaves zero orphans, a redemption cannot reference another
tenant's transaction, and EXPLAIN shows index scans on the dashboard load path.
```

---

## Wave 6 — New capability

### P-B-23 / P-B-24 · B2C payment, shipped as one change

**Queue** B-23, B-24 · **Finding** BE-011 · **P1** · **Wave** 6 · **Needs decision** D-07 · **Fixes** BE-011

```text
In /Users/ucaany/Documents/Snap Box - Main, implement B2C payment. Read D-07 first.

THESE TWO ARE ONE CHANGE. Shipping createPayment without the webhook re-opens exactly
the hole ADR-002 was written to close: a client could mark a transaction paid. Today
that is impossible ONLY because no payment path exists. Do not land one without the other.

CURRENT STATE. payment-provider-test.ts:11-25 performs real connectivity calls against
all four live gateway hosts, and payment-crypto.ts does AES-256-GCM correctly. But there
is no PaymentProvider implementation, no POST /api/payment/create, no
/api/webhooks/b2c/[provider], and NO WRITER TO transactions — insert(transactions)
appears zero times in the application, so every revenue surface is permanently empty.

Tasks:
1. Implement the PaymentProvider interface per PRD 10.8: createPayment, verifyPayment,
   refund, testConnection. Per D-07, the provider set for launch.
2. Implement POST /api/payment/create. It must NOT set payment_status to PAID. The
   server sets PENDING; only a verified webhook advances it.
3. Implement /api/webhooks/b2c/[provider] with per-provider signature verification:
   Midtrans SHA512 over the documented field order, Xendit constant-time callback-token
   compare, DOKU HMAC, Pakasir HMAC-SHA256. Verify over the RAW BODY BEFORE PARSE, as
   the existing Pakasir route already does correctly at route.ts:231-244.
4. Idempotency: UNIQUE(gateway_transaction_id) already exists (schema.ts:588). Use the
   same claim-marker pattern the Pakasir route uses, and RELEASE the marker on any
   non-2xx so a provider retry reprocesses instead of silently dropping. This is the
   failure mode most webhook handlers get wrong and the existing code gets right — reuse
   it rather than reinventing.
5. Server-authoritative amount check before activating, exactly as
   pakasir-b2b/route.ts:146-149 does.
6. Add a signed timestamp with a +/-5 minute freshness window (P-B-26 applies to B2C too).
7. Add a DB-level invariant that forbids a client-writable payment_status.
8. Add a test: a forged callback is rejected, a replayed one is a no-op, and a
   same-amount-different-ordering callback is idempotent.

Constraints: do not ship an adapter without its webhook. Do not trust a client-supplied
amount, status, or gateway_transaction_id. Do not log full webhook bodies if they can
carry customer PII.

Done when: a payment intent can be created, a verified webhook activates the
transaction, a forged one is rejected, and a replayed one changes nothing.
```

### P-B-25 / B-26 · Webhook hardening

**Queue** B-25, B-26 · **Finding** BE-012, BE-025 · **P2** · **Wave** 6 · **Needs decision** — · **Fixes** BE-012, BE-025

```text
In /Users/ucaany/Documents/Snap Box - Main, generalise and harden the webhook layer.

The Pakasir B2B route (332 lines) is production-grade: raw-body HMAC before parse,
timingSafeEqual with length and hex pre-checks, unique (provider, provider_event_id)
idempotency with the marker RELEASED on any non-2xx, server-authoritative amount check,
monotonic paidAt/validUntil guard, dead-letter on every failure class, and 23505
unwrapped through the cause chain. Preserve all of it.

Tasks:
1. (B-25) Extract the idempotency-marker + dead-letter pattern into a shared helper so
   the B2C webhooks (P-B-24) cannot get it wrong. The helper must preserve: claim-first,
   release-on-any-non-2xx, duplicate-with-processedAt returns 200, duplicate-without
   releases and re-claims, non-unique-violation insert failure returns 500 so the
   provider retries.
2. (B-26) Add a signed timestamp header with a +/-5 minute freshness window, and reject a
   paidAt older than that window. Today a captured signed body can be re-asserted under a
   FRESH eventId; the unique index only catches byte-identical replays. Bounded by
   MAX_VALIDITY_WINDOW_MS = 400 days and the amount check, so it is not a free-money path
   — but it is a real entitlement-integrity gap.
3. Measure the body cap in BYTES (content-length or a stream), not rawBody.length, which
   is UTF-16 code units measured AFTER request.text() has buffered the whole body
   (route.ts:232). A 64 KiB multi-byte payload can be ~128 KiB on the wire.
4. Keep webhook_events idempotency, and note that owner-only visibility of a tenant's own
   billing events is a separate gap (08 section 3b) — decide, do not assume.

Constraints: do not weaken signature verification while generalising it. Do not convert
the synchronous flow to a queue in this prompt — Task 3.12 is a separate decision. Preserve
the dead-letter failure swallow at route.ts:89-91, which is deliberate: a dead-letter
insert failure must not mask the primary error.

Done when: both webhook families share one helper, and a captured body replayed under a
fresh eventId is refused.
```

### P-B-28 / B-29 · Subscription lifecycle and Owner checkout

**Queue** B-28, B-29 · **Finding** BE-013 · **P1** · **Wave** 6 · **Needs decision** — · **Fixes** BE-013

```text
In /Users/ucaany/Documents/Snap Box - Main, implement time-based subscription enforcement.

THE GAP. SUBSCRIPTION_STATUSES declares PENDING, ACTIVE, EXPIRING, GRACE_PERIOD, EXPIRED,
SUSPENDED, CANCELLED. Reachable today: PENDING, ACTIVE, EXPIRED, CANCELLED. NEVER written
anywhere: EXPIRING and GRACE_PERIOD. grace_period_until (schema.ts:191) is never set.
There is NO CRON AT ALL — supabase/…00000:13-15 states it plainly: "BELUM ADA job
terjadwal yang dibuat (cron.schedule(...) nol pemanggil di repo)". So a tenant whose
valid_until passes keeps whatever status the last webhook left, indefinitely.

Tasks:
1. Implement the hourly expiry cron per PRD 6.J. pg_cron is already enabled.
2. Implement the transitions: ACTIVE -> EXPIRING at T-7; EXPIRING -> GRACE_PERIOD at
   expiry; -> EXPIRED after grace. Write grace_period_until when entering grace.
3. Emit H-7 / H-3 / H-1 notifications at the right thresholds (7 days, 3 days, 1 day).
4. Trigger kiosk maintenance mode when a subscription lapses. The web-side
   booths.maintenanceMode column and its toggle already exist.
5. Decide whether SUSPENDED is a subscription status or only a tenant status — today only
   tenants.status is ever set to SUSPENDED, so the subscription column value is unreachable.
6. (B-29) Implement the Owner checkout behind the three disabled CTAs at
   subscription-view.tsx:100,146,174: renew, upgrade/downgrade, add-on purchase. Depends
   on P-B-23.
7. Add a test: a subscription past valid_until transitions without human action, and the
   Owner loses access at the right point.

Constraints: do not enter GRACE_PERIOD without setting grace_period_until — the
entitlement resolver reads that column when the status is GRACE_PERIOD
(entitlement-contract.ts:110-114), and today that branch is dead code. Do not create a
second unscheduled job; one cron, clearly owned.

Done when: a subscription past valid_until transitions on its own, the Owner is notified,
and kiosk maintenance engages.
```

### P-B-35 / P-B-36 · Realtime emission and rate-limit durability

**Queue** B-35, B-36 · **Finding** BE-016, BE-010 · **P2** · **Wave** 6 · **Needs decision** — · **Fixes** BE-016, BE-010

```text
In /Users/ucaany/Documents/Snap Box - Main, make realtime emit and make rate limiting
durable.

REALTIME. events.ts:26-58 defines 22 events. Exactly ONE is ever emitted —
THEME_UPDATED (kiosk-theme/actions.ts:121,136) to tenant:{id}, and tenant: has NO
SUBSCRIBER. Twenty-one are never emitted. Zero of the 22 is ever consumed. The one
subscriber, use-booth-realtime.ts, listens to booth:{id} which NOBODY publishes to.

Tasks:
1. Decide the launch event set and publish it. The ones that matter most:
   DEVICE_REVOKED (machines/actions.ts:298-375 does a complete transactional revoke but
   publishes NOTHING — a revoked kiosk is never told to stop, which PRD 6.K requires);
   BOOTH_ONLINE/OFFLINE (needs P-B-32 first or they mean nothing); CONFIG_UPDATED.
2. Wire EventDeduplicator (events.ts:95-132) — it is DEAD CODE, imported by zero files.
   PRD 10.6 requires idempotent handlers and ADR-011 requires a version check; the live
   subscriber has neither.
3. Normalise broadcast.created through publishRealtimeEvent so it passes
   realtimeEventSchema. It currently publishes lowercase-dotted with a snake_case payload
   and no validation — self-documented as debt at broadcast-server.ts:106-108.
4. (B-36) Replace rate-limit.ts:51  if (buckets.size >= MAX_BUCKETS) buckets.clear()
   with LRU expiry of expired entries. Today one attacker generating 5000 keys WIPES EVERY
   COUNTER FOR EVERY USER, including their own. Also move state to a shared store
   (Vercel KV / Upstash / a Cloudflare Durable Object) and derive the client IP from a
   platform-rewritten header rather than x-forwarded-for, which is rotatable.

Constraints: do not publish an event that bypasses realtimeEventSchema — that is how
broadcast.created got into this state. Do not keep any in-memory bucket as the only
limit on an auth endpoint.

Done when: at least one event is observed end to end, a duplicate delivery is
de-duplicated by eventId, every published name is in REALTIME_EVENTS, and clearing one
client's buckets leaves others intact.
```

### P-B-44 · Replace the hand-rolled binary encoders

**Queue** B-44 · **Finding** FE-021f · **P2** · **Wave** 6 · **Needs decision** — · **Fixes** FE-021f

```text
In /Users/ucaany/Documents/Snap Box - Main, resolve two hand-rolled binary
implementations.

1. transactions/export/route.ts:48-86 is a hand-rolled ZIP writer producing a STORED
   (uncompressed) archive. It is not wrong, but it is unmaintainable, and the archive it
   produces contains ONE CSV — not the photo bundle PRD 3.C describes. transactions-view.tsx:87
   discloses this honestly.
2. machine-contract.ts:242-644 is ~400 lines of hand-rolled Reed-Solomon, mask
   selection, and PNG/zlib encoding to produce a pairing QR. NO TEST asserts that a
   produced QR decodes. A single bit error produces an unscannable pairing code.

Tasks: for each, either replace it with an audited library, or add a round-trip test that
proves the existing implementation produces output a standard decoder accepts. Then
decide, per PRD 3.C, whether "bulk ZIP" means a photo archive or a CSV manifest, and
align the PRD, the implementation and the disclosure text.

Constraints: if you keep a hand-rolled encoder, the round-trip test is not optional — an
unverifiable encoder that produces pairing codes is a production risk. Do not change the
pairing token's entropy or hashing while touching the QR encoder.

Done when: a test decodes a generated QR with a standard decoder and extracts a generated
ZIP with a standard tool.
```

---

## Wave 7 — Surface the rest

### P-B-41 / B-42 / B-41a · Dead code and CI consistency checks

**Queue** B-41, B-42, B-41a · **Findings** FE-013, BE-029, BE-032 · **P3** · **Wave** 7 · **Needs decision** — · **Fixes** hygiene

```text
In /Users/ucaany/Documents/Snap Box - Main, remove dead surface and add the consistency
guards that stop it returning.

1. Implement or delete the five dead server actions. Each has real database side effects
   and zero callers: updatePromo, batchGenerate, redeemPromo (promos/actions.ts);
   getOwnerTemplate (template-server.ts); getOwnerProfile / listOwnerNotifications
   (the whole owner-account-server.ts). Also the dead exports deviceIdSchema,
   maskCredential, validateFrameFileMetadata, retainLatestFrameVersions.
2. Delete api/sentry-example AND its WAF exemption in
   infra/cloudflare/waf-custom-rules.json:40 together. It throws an unhandled Error on
   every GET outside production — correctly gated, but a standing tripwire for error-budget
   alerts and for anyone who sets NODE_ENV=development in a shared environment.
3. Remove NEXT_PUBLIC_MIDTRANS_CLIENT_KEY or wire it. It is declared in env.ts:38 and
   .env.example and referenced by ZERO application code.
4. Remove the dead reference-library CSS leftovers and the dead tokens
   (--chart-active-dot is declared in :root but never mapped in @theme inline, so it is
   never generated; --shadow-nav is declared and used zero times).
5. (B-42) Add the CI consistency check: every table with a tenant_id has an FK to
   tenants. It must fail on a deliberately-missing FK.
6. Consider a guard that every 'use server' module contains a requireCeo or
   requireOwnerTenant call, so a new action file cannot skip the gate. This is the
   property that makes BE-001 survivable, and it is currently maintained by hand across
   41 call sites.

Constraints: do not delete an action that is the only path to a real capability without
recording the decision. Do not remove the Sentry route without removing its WAF exemption
in the same change.

Done when: no exported action has zero callers, no route throws by design, the FK check
fails on a bad input and passes on a good one, and the Sentry route and its exemption are
gone together.
```

### P-F-17 / F-18 / F-19 / F-20 / F-21 / F-22 · Auth and role, frontend view

**Queue** F-17…F-22 · **Findings** BE-006, BE-007, FE-020 · **P0/P1** · **Wave** 3 · **Needs decision** D-04 · **Fixes** as listed

```text
In /Users/ucaany/Documents/Snap Box - Main, close the frontend auth and role gaps. The
backend half of items 1, 2 and 4 is in P-B-05, P-B-07 and P-B-11 — do not duplicate.

1. (F-17) The visible effect of P-B-05: confirm a non-CEO session cannot read
   /ceo-dashboard/tenants/[id] or /ceo-dashboard/tenants/new.
2. (F-18) /owner-dashboard/subscription is an INFINITE REDIRECT LOOP for expired owners.
   layout.tsx:14 calls getOwnerLayoutData() with NO options, so
   owner-layout-data.ts:66-71 redirects to /owner-dashboard/subscription — the page it is
   already rendering. The allowInactiveSubscription escape hatch is passed ONLY by the
   catch-all at [...segments]/page.tsx:46, which is shadowed by the real route and
   notFound()s 'subscription' at :35. Decide where the exemption is granted (layout, for
   that path) and fix it. The PRD-mandated recovery page is unreachable for exactly the
   owners who need it. Then delete the now-dead catch-all branch — all 19 nav slugs have
   real pages, so "Segera hadir" at :55 is unreachable dead code whose 18-entry denylist
   duplicates OWNER_NAV_ITEMS and has already drifted (the .orig lacks 'customers').
3. (F-19) Per decision D-04: wire hasPermission into the mutations, or delete the module.
   Until this is decided, DO NOT BUILD /staff-dashboard — adding it hands Staff
   Owner-class destructive access, because the only barrier is one requireOwnerTenant()
   call per action across 41 sites with no test asserting it (PRD Task 7.9 is MISSING).
4. (F-20) Decide the Staff PIN tab's fate. booths.operatorPinHash is only ever SELECTed
   (authorization.ts:318) and never written, so /api/auth/staff-pin can only ever return
   PIN_REJECTED — the tab can NEVER succeed. Either build the Owner-side "set operator
   PIN" action, or remove the tab and the endpoint. Do not leave a login mode that always
   fails. Then do P-B-11 for the CSRF gap.
5. (F-21) The visible effect of P-B-01: a revoked session stops authenticating.
6. (F-22) loadOwnerKioskTheme has NO tenant scoping. It is reached from a page that calls
   requireOwnerTenant(), so the session is checked, but the query itself does not filter
   by tenantId (see P-B-10). Add the predicate.

Constraints: do not add /staff-dashboard in this prompt. Do not weaken requireOwnerTenant
to make a flow work.

Done when: an expired owner reaches the recovery page instead of looping, a non-CEO
cannot read the two tenant pages, a revoked session fails, and the Staff PIN tab either
works or is gone.
```

### P-F-39 / F-40 / F-41 / F-42 / F-43 / F-44 · Feature UI

**Queue** F-39…F-44 · **Findings** FE-008, FE-005, FE-012, FE-013, FE-021g · **P1** · **Wave** 7 · **Needs decision** D-08, D-09, D-02 · **Fixes** as listed

```text
In /Users/ucaany/Documents/Snap Box - Main, close the feature-UI gaps.

1. (F-39) THE HIGHEST-VISIBILITY DEFECT IN THE PRODUCT. public-header.tsx:32-47,71,77
   renders a DisabledLogin button labelled "Belum tersedia" with title "Login tersedia
   setelah rute autentikasi dirilis". But /login EXISTS and works completely
   (app/(auth)/login/page.tsx + components/auth/login-form.tsx, real Firebase sign-in,
   real /api/auth/session, accessible labels, real pending/error states). No visitor can
   reach login from ANY public page. Replace the disabled control with a real /login link
   in the header, the footer, and the mobile menu. Also remove the stale comment above it,
   which is now false.
2. (F-40) Build the notification bell per PRD 6.9: unread count badge + 10-item dropdown +
   realtime. Today owner-header.tsx:52-58 is a plain <Link>. Depends on P-F-23.
3. (F-41) /owner-dashboard/outlets deactivation is IRREVERSIBLE from the UI.
   outlets/page.tsx:14 calls listOwnerOutlets(tenantId) with includeInactive defaulting to
   false, so the server never returns inactive rows (outlet-server.ts:58), yet
   outlets-view.tsx:70-77 offers a "Tampilkan nonaktif" filter over rows that cannot
   contain them. OutletsView also seeds useState(outlets) once (:22) with no prop sync.
   Pass includeInactive through, or drop the dead filter — but not leave a control that
   can never reveal anything. Contrast staff-view.tsx:28 and packages-view.tsx:37, which
   work correctly because their queries have no isActive predicate.
4. (F-42) outlet-detail-view.tsx has no 'use client' — it is 100% read-only while
   updateOutlet and setOutletActive exist one level up. Make it interactive.
5. (F-43) One user action currently mints TWO pairing tokens. createBoothWithPairing
   (machines/actions.ts:79) calls insertPairingSession and DISCARDS the returned code,
   then machines-view.tsx:72 immediately POSTs /api/booth/pair-session, which invalidates
   the first token (pairing-session.ts:43-52) and mints a second. Same double-mint at
   machine-detail-view.tsx:122-128. Mint exactly once. Then resolve manualCode per D-02 —
   machines-view.tsx:305 is a permanently dead branch because
   pair-session/route.ts:114 hardcodes null.
6. (F-44) Per decision D-09: build the six Device Console routes, or amend PRD 3 to state
   they are Fase 3. Do not leave PRD 3 listing them while Fase 2's acceptance claims the
   Owner can navigate the entire dashboard.

Constraints: do not leave a disabled control labelled "Belum tersedia" where the feature
exists. Do not add a filter that cannot match. Do not add /staff-dashboard here — see
P-F-19 item 3.

Done when: an anonymous visitor can reach a working login, a notification increments the
badge, a deactivated outlet can be reactivated, one action mints one token, and either
the Device Console routes exist or the PRD does not list them.
```

---

## Wave 8 — Kiosk (Fase 3/4/5)

**This is a programme, not a repair.** PRD `09` §1 records 36 `MISSING` tasks concentrated here. Scope and staff it separately.

```text
In /Users/ucaany/Documents/Snap Box - Main, this is a scoping task, not an implementation.

The desktop app is 518 lines: 274 TypeScript across 3 files, 154 Rust. App.tsx is 25
lines and self-declares "Shell kiosk Fase 0 ... Hardware engine belum terpasang". One
Rust command exists (get_app_info) and is never called. 0 of 17 states in PRD 6.R, 0 of
18 features in PRD Bab F, 0 of 9 hardware traits in 10.9, 0 of 15 Fase 5 tasks.

Tasks:
1. Confirm the inventory above against the current tree.
2. Write a Fase 3/4/5 implementation plan that sequences: pairing redemption (done in
   P-B-30) -> secure storage and the 4 Rust device commands -> the state machine with
   SQLite persistence and crash recovery -> hardware adapters -> the customer flow.
3. Identify the two decisions that gate the programme: the payment adapter set (D-07) and
   the photo pipeline's storage and processing contract.
4. Record which PRD tasks in Fase 3/4/5 must be re-scoped or dropped.

Constraints: do NOT start implementing the kiosk in this prompt. 36 tasks across three
phases with hardware dependencies is a programme; a partial attempt produces another
518-line shell.

Done when: a sequenced plan exists with owners, and the two gating decisions are named.
```

---

## R-01 · The runtime pass (gates most verification)

**Nothing below can be closed without this.** The audit could not build, typecheck, lint, test, render, or measure bundle size (`AUDIT-LIM-01`). Run this early, and re-run it after each wave.

```text
In /Users/ucaany/Documents/Snap Box - Main, run the runtime verification pass the audit
could not run, and record the results.

WHY. Every claim in AUDIT/ is static-code evidence. No finding may be closed on
inspection alone. This pass converts the UNVERIFIED items into real acceptance, and it is
the only way to satisfy the PRD's own numeric targets (8.5: API P95 < 200ms, webhook
P95 < 500ms, realtime < 2s, bundle < 250KB gzip) and Task 7.14 (WCAG 2.2 AA).

Tasks, in order:
1. Establish that the build works at all: pnpm lint, pnpm typecheck, pnpm test, pnpm build.
   Record the first failure honestly rather than working around it.
2. Prove or disprove BE-001, the P0. Connect using the application's ACTUAL DATABASE_URL
   role and determine whether RLS policies fire. If they do not, the P0 is confirmed
   rather than assumed. Attempt a cross-tenant read through one Owner action with a
   second tenant's id, and show what the database returns.
3. Check D-14 / P-B-04 against live data: does an Owner login succeed? If CLAIMS_STALE
   rejects Owner/CEO logins, that is a production outage and takes priority over
   everything else in this list.
4. Security spot-checks, in the order 06 section 5 lists them:
   - revoke a session, then reuse the cookie
   - revoke a CEO role, then request /ceo-dashboard/tenants/[id] with the old cookie
   - replay a captured Pakasir body with a fresh eventId
   - unset an unrelated env var and confirm webhooks still verify
   - generate 5000 rate-limit keys, then check another client's counter
   - request /gallery anonymously; request /api/health with an induced DB error
5. Responsive: measure at 375 / 390 / 768 / 1024 / 1280 / 1440 / 1920. Record per
   viewport: horizontal scroll, clipped content, table overflow, modal fit, form
   usability, nav reachability, touch targets, text wrapping.
6. Accessibility: run axe-core over every public and dashboard route. Compute the four
   contrast ratios the audit could only estimate.
7. Performance: establish a bundle-size baseline and a P95 latency baseline. Verify
   whether recharts — a declared dependency — is in any bundle at all.
8. E2E: add Playwright and write the journeys that are currently writable. Note that
   four of the seven cannot be written until Fase 3/4/5 exist.

Output: a dated report appended to AUDIT/ as an addendum. Do NOT edit the existing
findings in place — if a conclusion changes, add a dated addendum so the record of what
the code said on 2026-09-26 survives.

Constraints: do not print secret values, ID tokens, or service-account credentials. Do
not modify findings to match the runtime result. Read-only against any production system.
```

---

## C-01 · Close-out gate

```text
In /Users/ucaany/Documents/Snap Box - Main, run the final consistency check across the
audit deliverable and the repaired tree.

Tasks:
1. Re-run R-01. Confirm no regression was introduced by any wave.
2. For every P0 and P1 finding in AUDIT/01 and AUDIT/05, state VERIFIED-FIXED,
   STILL-OPEN, or PARTIALLY-FIXED, with the evidence for that status.
3. Re-score PRD 8.3's 20 security acceptance criteria. It is currently 7 PASS / 8 FAIL /
   4 PARTIAL / 4 MISSING, and the PRD requires 100%.
4. Re-score the 118 PRD 11 tasks in AUDIT/09 and compare against the baseline in 09
   section 1a. Account for every status change with a finding reference.
5. Re-run the 17-item Definition of Done. Baseline: 2 COMPLETE of 17.
6. Confirm the two CI guards actually gate: deliberately break a colour token and an
   undefined class, confirm the build fails, then revert.
7. Confirm every answer in AUDIT/11 is recorded in a superseding ADR and, where the PRD
   is the thing that is wrong, in the PRD itself.

Constraints: do not mark anything FIXED on the strength of a grep. AUDIT-LIM-01 applies
to this prompt too — a fix is fixed when the runtime check passes.

Done when: every P0 and P1 has a terminal status with evidence, 8.3 is re-scored, and no
guard has been weakened to make a check pass.
```

### P-F-04 · Extend the token guard, or layer the hand-written CSS

**Queue** F-04 · **Finding** FE-003b, FE-003c · **P1** · **Wave** 1 · **Needs decision** D-01 · **Fixes** FE-003b, FE-003c

```text
In /Users/ucaany/Documents/Snap Box - Main, close the gap that lets the design system
drift in the 87% of globals.css no guard covers.

THE GAP. scripts/check-token-sync.mjs compares only :root, @theme inline, @layer base,
@utility and @layer components. globals.css lines 378-2681 — the .public-*, .auth-*,
.ceo-*, .owner-* and .ceo-promo-* scopes, more than 2300 lines and about 87% of the file —
are entirely unguarded. Every dead-class bug in FE-002 and FE-003 lives inside that
unguarded region. globals.css:368-373 documents the split as intentional.

A SECOND PROBLEM, which is a decision rather than a defect. Those hand-written scopes are
UNLAYERED. Unlayered declarations beat Tailwind's utilities layer at equal specificity, and
two collisions are already live:
  (public)/layout.tsx:14 renders class="public-shell ... bg-background", and
    .public-shell{background-color:#fffef5} (:380) wins — so bg-background is dead and
    the public shell is cream rather than the --background blue. It works by accident.
  ceo-sidebar.tsx:45 renders <SidebarInset className="ceo-shell">, and SidebarInset's
    own bg-secondary-background (packages/ui/src/components/sidebar.tsx:297) is silently
    overridden by .ceo-shell{background-color:var(--background)} (:723).
Adding any @layer to globals.css would flip every one of these at once.

Tasks — choose ONE of the two options, do not do both:
  A. Extend check-token-sync.mjs to cover the hand-written scopes, and document in
     globals.css:368-373 why they remain outside the token system.
  B. Move the hand-written scopes into an explicit @layer with a deliberate precedence
     over utilities, then fix every collision the move exposes. This requires D-01 first,
     because layering will change which colour wins in places.
Either way, enumerate the two known collisions before and after, so the change is
observable rather than silent.

Constraints: do not wrap the scopes in a layer without first listing what will change —
option B is not reversible by inspection. Do not weaken check-token-sync.mjs to make it
pass.

Done when: either the guard's scope covers the hand-written lines and reports its own
coverage, or the scopes are layered and the two collisions are fixed with before/after
evidence.
```

### P-B-02 · Make secret rotation deployment-safe

**Queue** B-02 · **Finding** BE-007 · **P1** · **Wave** 3 · **Needs decision** — · **Fixes** BE-007

```text
In /Users/ucaany/Documents/Snap Box - Main, make SESSION_COOKIE_SECRET rotation
non-breaking.

THE PROBLEM. session.ts:130-145 caches the derived CryptoKey per instance and only
refreshes it when the module-level cachedSecret differs. On a rolling deploy, an instance
holding the new secret rejects cookies signed by the old one and vice versa, producing a
/login <-> dashboard redirect loop. The code comments at :108-113 describe this, and the
offered mitigation is procedural: "jangan rotasi di tengah deploy".

Procedural mitigation is not a control. Add a key identifier.

Tasks:
1. Prefix the cookie value with a key id, e.g. base64url(kid).base64url(payload).base64url(hmac),
   where kid identifies which secret signed it.
2. Support a set of active verification keys, so a cookie signed by a retired key is still
   accepted until it expires, while new cookies are signed with the current key.
3. Keep the fail-closed behaviour: an unknown kid must be rejected, not ignored.
4. Write a test: sign with key A, add key B, verify the old cookie still works; retire A
   and verify old cookies stop working only after the max age.
5. Document the rotation procedure in docs/ENVIRONMENT-AND-SECRETS.md as a command, not
   as a caution.

Constraints: do not accept a cookie with an unrecognised kid. Do not extend the 12-hour
max age to paper over rotation. Never log a cookie value.

Done when: a rolling deploy with a new secret does not sign anyone out, and a test proves
both the overlap window and the retirement.
```

### P-B-03 · Serve the session cookie over HTTPS everywhere

**Queue** B-03 · **Finding** BE-008 · **P2** · **Wave** 3 · **Needs decision** — · **Fixes** BE-008

```text
In /Users/ucaany/Documents/Snap Box - Main, stop serving the session cookie over plain
HTTP outside production.

session.ts:276 sets secure: process.env.NODE_ENV === 'production'. Any preview, staging,
or self-hosted environment therefore receives a session cookie without the Secure flag,
which makes it replayable over HTTP. Meanwhile the application forces HTTPS in several
places — realtime-server.ts:41-43, pakasir-b2b.ts:101-103 — so nothing asserts it at the
edge.

Tasks:
1. Make secure: true unconditional except for an explicit local-development signal, not
   a NODE_ENV inference. An env var like SESSION_COOKIE_INSECURE_DEV=1 is preferable to
   NODE_ENV, because preview deploys often run NODE_ENV=production while sitting behind
   a different hostname.
2. Confirm no local-development flow breaks: document how a developer opts out.
3. Note the interaction with middleware: verifySession runs on Edge and does not set the
   cookie, so this change affects only the issuing route.
4. Verify the Set-Cookie header actually carries Secure in a preview-like environment.

Constraints: do not leave NODE_ENV as the switch. Do not weaken the session cookie's
httpOnly or sameSite while changing secure.

Done when: Set-Cookie carries Secure in a non-local environment, and the documented
opt-out is the only way to disable it.
```

### P-B-06 · Wire the granular permissions, or delete them

**Queue** B-06 · **Finding** BE-005 · **P1** · **Wave** 3 · **Needs decision** D-04 · **Fixes** BE-005

```text
In /Users/ucaany/Documents/Snap Box - Main, resolve the dead RBAC module.
READ AUDIT/11 DECISIONS_REQUIRED.md D-04 FIRST. Do not proceed until it is answered.

THE PROBLEM. packages/shared/src/auth.ts defines 75 PERMISSIONS, three role-permission
sets, hasPermission() and canAccessTenant(). A repo-wide grep returns matches ONLY inside
auth.ts — zero importers. Real enforcement is role-string equality in requireCeo() and
requireOwnerTenant().

STAFF_PERMISSIONS is documented as "Staff hanya monitoring. Destructive action sengaja
tidak ada di daftar ini" and is never consulted. Staff safety today is ACCIDENTAL:
/staff-dashboard does not exist, so a Staff login lands on /unauthorized. The restriction
is a missing route, not an enforced rule.

The hazard: /staff-dashboard must NOT be built until this is resolved. The moment that
route exists, the only barrier between a Staff session and a destructive action is one
requireOwnerTenant() call per action — 41 of them, hand-maintained, with no test asserting
it (PRD Task 7.9 is MISSING).

OPTION A — wire it:
1. Define which permission each of the 55 server actions requires, in the shared module,
   not at the call site.
2. Enforce it in the shared gate — prefer inside requireCeo/requireOwnerTenant, or a
   wrapper they call — so a new action inherits the check by construction rather than by
   remembering it.
3. Make STAFF_PERMISSIONS genuinely restrictive and prove it with a test: a Staff session
   invoking each destructive action receives a refusal.
4. Add the CI guard from P-B-41 item 6: every 'use server' module must route through a gate.

OPTION B — delete it:
1. Remove PERMISSIONS, the role-permission sets, hasPermission, canAccessTenant and
   ROLE_HOME_ROUTE.
2. Amend PRD 5.1 and 5.4 to state role-level granularity, and record in AUDIT/11 that
   D-04 is answered.
3. Do NOT build /staff-dashboard without a fresh decision, since role-level means any
   authenticated member of a role is fully privileged within it.

Constraints: do not leave the module in place unused. Do not build /staff-dashboard in
this prompt under either option. Do not weaken requireOwnerTenant to accommodate a
permission that does not exist.

Done when: hasPermission has real callers and a Staff-destructive-action test passes, or
the module is gone and the PRD matches reality.
```

### P-B-34 · Rate-limit the booth API per device fingerprint

**Queue** B-34 · **Finding** BE-010 · **P2** · **Wave** 3 · **Needs decision** — · **Fixes** BE-010

```text
In /Users/ucaany/Documents/Snap Box - Main, give the booth API the rate-limit dimension
the PRD specifies.

THE GAP. PRD 8.2 requires /api/booth/* at 60 req/min PER DEVICE FINGERPRINT. The only
rate limiting on the booth path is lib/auth/rate-limit.ts keyed on IP via authRateLimitKey
(:89-91) — so there is no per-device dimension at all. Two consequences: a shared-office
NAT exhausts the shared IP bucket and blocks all pairing for everyone behind it, and a
single device can rotate its IP to get a fresh budget.

Tasks, in order:
1. This depends on P-B-30: pairing redemption must exist and devices must be inserted
   before there is a fingerprint to key on. Do not key on a fingerprint the client can
   choose freely — the fingerprint must be established during redemption and stored in
   devices, and the rate-limit key must be derived server-side from the stored value, not
   from a request header.
2. Add a per-fingerprint bucket alongside the existing per-IP one, so a device is limited
   even when its IP is shared and an IP is limited even when it hosts many devices.
3. Keep the two-stage pattern the staff-pin route already uses (IP plus a second,
   identity-derived key) at :63 and :102.
4. Add a test: many requests from one fingerprint behind one IP are limited on the
   fingerprint, not on the IP.

Constraints: do not trust a client-supplied fingerprint header for the rate-limit key. Do
not remove the per-IP bucket — it is the defence against a rotating-fingerprint attack.

Done when: a device is limited per fingerprint, an IP is limited per device-count, and a
test distinguishes the two.
```

### P-B-43 · Add measurement before claiming any performance target

**Queue** B-43 · **Finding** AUDIT-LIM-01 · **P2** · **Wave** 6 · **Needs decision** — · **Fixes** performance claims

```text
In /Users/ucaany/Documents/Snap Box - Main, add the instrumentation that makes any
performance claim possible at all.

WHY. PRD 8.5 states API P95 < 200ms, webhook P95 < 500ms, realtime < 2s, and landing
bundle < 250KB gzip. NONE of these has ever been measured, and this audit could not
measure them either (AUDIT-LIM-01: no build, no runtime, no network inspection). A target
nobody measures is not a target.

Tasks:
1. Bundle budget: record current per-route bundle sizes, add a CI check with a threshold
   set just above today's reality so regressions fail but the baseline passes.
2. Latency: add middleware or instrumentation that records P50/P95/P99 per route, and
   surface it on /ceo-dashboard/system-health — which already exists and already claims
   to show operational metrics (PRD Task 6.3) but measures no latency at all.
3. Webhook latency: record the provider's reported latency and the handler's own duration
   at the three points the existing handler already logs.
4. Establish a Lighthouse or Playwright baseline for the public routes.
5. Verify whether recharts — declared in package.json — is actually in any bundle. If the
   only surfaces that would use it render synthetic data, it may be dead weight shipping
   to every visitor. Report the finding; do not remove the dependency unilaterally.
6. Re-measure after P-B-21 (indexes). templates and packages currently have NO index of
   any kind and are read on every Owner dashboard load, so they will dominate.

Constraints: do not assert any PRD 8.5 target is met until this prompt has run and the
number is real. Do not set a threshold so tight that the build is permanently red.

Done when: a baseline exists, a regression fails CI, and every PRD 8.5 claim can be
backed by a number rather than an estimate.
```

### P-F-46 · Make the realtime indicator honest

**Queue** F-46 · **Finding** FE-022 · **P1** · **Wave** 6 · **Needs decision** — · **Fixes** FE-022

```text
In /Users/ucaany/Documents/Snap Box - Main, stop the Owner dashboard from reporting
realtime as connected when it is not.

THE DEFECT. use-booth-realtime.ts:70-73:
    if (message.event === 'phx_reply' && message.topic && message.ref) {
      joined = true;
      setStatus((current) => ({ ...current, connected: true }));
      return;
    }
phx_reply is Phoenix's GENERIC response frame and carries status: 'ok' | 'error'. This
handler ignores status, so a join REJECTED BY RLS sets connected: true and renders the
green "Realtime aktif" dot. Given that no booth: event is ever published and the booth:
policy has never been exercised by a real subscriber, this is the state the UI is in
today.

Three further defects in the same file:
  - :36 declares a single `joined` boolean for N channels; :70-73 sets it on the first
    reply of any topic; :104 gates every phx_leave on it. A partial join is treated as
    complete.
  - :79 increments a counter on EVERY message. No eventId check, no version check —
    PRD 10.6 requires idempotent handlers and ADR-011 requires a version check.
    EventDeduplicator exists at events.ts:95-132 and is imported by zero files.
  - :90 reconnects on a fixed 5s timer with no backoff, no jitter and no attempt cap. A
    Supabase outage means every Owner tab retries every 5 seconds forever.

Tasks:
1. Treat a phx_reply with status 'error' as a failure, and surface the server's reason.
2. Make joined per-topic, so a partial join is visible and leave is reliable.
3. Add backoff with jitter and an attempt cap. On sustained failure, say so rather than
   retrying silently forever.
4. Adopt EventDeduplicator for eventId dedup, and implement the version check, so
   reconnect replays and duplicate broadcasts do not each cause another router.refresh().
5. Decide whether the payload should still be discarded. Discarding it and calling
   router.refresh() is a defensible "server is the source of truth" design — the code says
   so at :4-5 — but it leaves the client blind to which event arrived. Record the decision
   either way.
6. Keep the honest empty state already present: "Realtime terputus — data dapat usang"
   (machines-view.tsx:118-124) is good UI and should stay.

Constraints: the indicator must never be more optimistic than the connection. Do not
make the client derive authoritative state from a broadcast payload.

Done when: a join rejected by RLS shows a failed state, not a green dot, and a test
covers the error-reply path.
```

### P-F-47 / P-F-48 · Publish the events, and normalise the one real publisher

**Queue** F-47, F-48 · **Finding** BE-016 · **P2** · **Wave** 6 · **Needs decision** — · **Fixes** BE-016

```text
In /Users/ucaany/Documents/Snap Box - Main, close the realtime loop from the publish side.
The backend emission work is P-B-35 and P-B-32; this prompt covers the two items that sit
on the frontend/API contract.

F-48 FIRST, because it is small and it is a contract violation:
  broadcast-server.ts:110-149 publishes to tenant:{id} with event name 'broadcast.created'
  — lowercase-dotted and NOT in REALTIME_EVENTS — a SNAKE_CASE payload, and NO
  realtimeEventSchema.parse() at all. realtime-server.ts:53 does validate; this path does
  not. The file self-documents this at :106-108: "ponytail: event di sini memakai bentuk
  payload sendiri ... Saat Fase 6 menyeragamkan amplop realtime, ganti ke schema itu".
  Task: route it through publishRealtimeEvent so the name comes from REALTIME_EVENTS and
  the payload passes realtimeEventSchema. If the schema genuinely cannot express a
  broadcast, EXTEND the schema and document why — do not leave a second envelope.

F-47 — the frontend-visible half of event emission:
  Task: define which events the Owner dashboard should react to WITHOUT a full page
  reload. Today every event causes router.refresh(), which re-renders the whole route's
  server tree — for machines-view that is a fresh listOwnerMachines plus machineQuota
  plus active-outlets query per event. If event volume becomes non-trivial, that is a
  per-event full page revalidation rather than an incremental update.
  Decide, per event, whether a field-level update is warranted or a refresh is correct.
  Record the decision — a full refresh on a low-frequency event is fine and simpler.
  This depends on P-B-32 for heartbeats and P-B-35 for emission; do not start it before
  at least one event actually arrives, or you are optimising an empty path.

Constraints: every published event name must be in REALTIME_EVENTS. Every payload must
pass realtimeEventSchema. Never let a client publish — the RLS correctly permits
service_role only, and adding a browser INSERT policy would be the vulnerability, not the
fix.

Done when: the published name is in REALTIME_EVENTS, the payload is schema-validated, and
the per-event refresh cost is a recorded decision rather than an accident.
```

---

## Coverage check

### Aliases — three queue IDs name two items

`10` assigns distinct numbers to the same work in more than one place. The mapping, so no item looks unaddressed:

| Queue IDs        | Single prompt         | What it is                                                                                     |
| ---------------- | --------------------- | ---------------------------------------------------------------------------------------------- |
| `B-00a` + `B-14` | `P-B-00a`             | Journal entry for the orphaned `0005_owner_promo_code_scope.sql`, plus the CI parity assertion |
| `B-00c` + `B-15` | `P-B-00c`             | Snapshot parity for the three telemetry tables, before any `generate`                          |
| `B-09` + `B-18`  | `P-B-14…B-22`, item 5 | `SELECT … FOR UPDATE` on the Pakasir subscription write path                                   |

`10` §2.6 notes the B-18/B-19 overlap itself; B-00a/B-14 and B-00c/B-15 are the same pattern. **Fix the numbering in `10` if you want a one-to-one map** — the work is covered either way.

### Prompt index

| Wave                      | Prompts                                                                                                                            | Items covered                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1 — cheap and structural  | `P-B-00a`, `P-B-00c`, `P-F-02`, `P-F-03`, `P-F-04`, `P-F-51`, `P-B-12`, `P-B-13`, `P-B-20`, `P-B-27`                               | B-00a, B-00c/B-15, B-12, B-13, B-14, B-20, B-27 · F-02, F-03, F-04, F-51                                                     |
| 2 — the P0                | `P-B-00b / P-B-08`                                                                                                                 | B-00b, B-08                                                                                                                  |
| 3 — security truthfulness | `P-B-01`, `P-B-02`, `P-B-03`, `P-B-04`, `P-B-05`, `P-B-06`, `P-B-11`, `P-B-30/31/33`, `P-B-32`, `P-B-34`, `P-B-37/38`, `P-B-39/40` | B-01, B-02, B-03, B-04, B-05, B-06, B-11, B-30, B-31, B-32, B-33, B-34, B-37, B-38, B-39, B-40                               |
| 4 — frontend rewrite      | `P-F-01`, `P-F-05`, `P-F-06`, `P-F-07/08`, `P-F-09…F-16`, `P-F-15`, `P-F-34…F-38`, `P-F-45`, `P-F-49`, `P-F-50`                    | F-01, F-05, F-06, F-07, F-08, F-09, F-10, F-11, F-12, F-13, F-14, F-15, F-16, F-34, F-35, F-36, F-37, F-38, F-45, F-49, F-50 |
| 5 — data integrity        | `P-F-23`, `P-F-24`, `P-F-25/26/27`, `P-F-28…F-33`, `P-B-14…B-22`                                                                   | F-23…F-33 · B-09/B-18, B-16, B-17, B-19, B-21, B-22                                                                          |
| 6 — new capability        | `P-B-23/24`, `P-B-25/26`, `P-B-28/29`, `P-B-35/36`, `P-B-43`, `P-B-44`, `P-F-46`, `P-F-47/48`                                      | B-23, B-24, B-25, B-26, B-28, B-29, B-35, B-36, B-43, B-44 · F-46, F-47, F-48                                                |
| 7 — surface the rest      | `P-B-41/42`, `P-F-17…F-22`, `P-F-39…F-44`                                                                                          | B-41, B-42 · F-17, F-18, F-19, F-20, F-21, F-22, F-39, F-40, F-41, F-42, F-43, F-44                                          |
| 8 — kiosk                 | scoping task                                                                                                                       | Fase 3/4/5 `MISSING` tasks                                                                                                   |
| Gates                     | `R-01` runtime pass, `C-01` close-out                                                                                              | verification for every prompt above                                                                                          |

**52 of 52** frontend items (`F-01`…`F-52`) and **47 of 47** backend items (`B-00a`…`B-44`) are covered, plus the two gates.

Prompts are grouped where several queue items share one coherent change — `B-30/31/33`, `B-23/24`, `F-09…F-16`, `B-14…B-22`, `F-07/08`, `F-17…F-22`. Splitting those would be wrong: a pairing endpoint without its attempt counter, or a payment adapter without its webhook, is the defect the audit found.

---

## Cross-references

- The 15 open decisions: `11_DECISIONS_REQUIRED.md`.
- Queue definitions, blockers, and verification per item: `10_RECOMMENDED_REPAIR_ORDER.md`.
- Evidence for every finding: `01`–`08`. Task-level status: `09_PRD_IMPLEMENTATION_MATRIX.md`.
- Runtime-pass scope and the ordered security spot-checks: `06_SECURITY_AUDIT.md` §5.
