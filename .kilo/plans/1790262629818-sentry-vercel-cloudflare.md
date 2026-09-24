# Task 0.6 (Sentry + Vercel + Cloudflare): Implementation Plan

PRD line 1971: "Deploy dummy Next.js to Vercel, Cloudflare DNS pointing, WAF rule draft,
Turnstile site key. Sentry project created (web + desktop source maps)."

Fase 0 acceptance (PRD line 1976): "Repo build hijau, dummy page render di Vercel,
Supabase + Firebase reachable, CI pass, **Sentry capture test error**."

## Goal

Wire observability and edge protection so the repo can (a) capture errors from web and
desktop with readable stack traces via uploaded source maps, and (b) ship a versioned,
reviewable Cloudflare WAF / rate-limit / Turnstile draft matching PRD Bab 8.2 and 8.4.
No business features. Cloud accounts and real secrets are out of scope (see below).

## Resolved decisions (from user)

1. **Sentry depth = full.** Add `@sentry/nextjs` with client/server/edge instrumentation,
   error boundaries, `tunnelRoute`, and a `/sentry-example` trigger route so Fase 0
   acceptance "Sentry capture test error" is provable locally, not deferred.
2. **Cloudflare artifact = committed JSON drafts** under `infra/cloudflare/` (WAF custom
   rules, rate-limit rules, Turnstile widget) plus a runbook. Nothing executes until an API
   token/zone id is supplied; drafts are declarative and reviewable.

## Prior art in repo (do not duplicate)

- `.env.example` + `packages/shared/src/env.ts` already declare every var Task 0.6 needs:
  `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`,
  `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `TURNSTILE_SECRET_KEY`,
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. **No new env vars.** `SENTRY_DSN` (server DSN) does
  not exist yet — add it to `publicEnvSchema`/`.env.example` only if the server SDK needs a
  distinct DSN; default plan reuses `NEXT_PUBLIC_SENTRY_DSN` for both and adds nothing.
- `apps/web/src/app/api/health/route.ts` already exists (PRD 8.6). Task 0.6 does not modify it.
- `.github/workflows/ci.yml` runs lint, guards, typecheck, format — unchanged by 0.6.
- `.lintstagedrc.json` already gates token/claims sync. Add a Sentry `.gitignore` entry only.
- `docs/PHASE-0.md` is the progress ledger; Task 0.5 completed and prefixed the "Sentry /
  Vercel / Cloudflare → Task 0.6" deferral. Append a Task 0.6 section, do not rewrite 0.1–0.5.
- Pre-existing `prettier --check` failures (Task 0.2 list: `schema.ts`,
  `packages/shared/src/auth.ts`, `domain.ts`, generated Tauri files) must NOT be reformatted.

## Scope boundary: what runs vs what is documented

| Item                               | Runnable in repo?            | Deliverable                                                                                                                |
| :--------------------------------- | :--------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| Sentry web SDK (Next.js)           | Yes                          | `@sentry/nextjs` config + instrumentation + example route                                                                  |
| Sentry source maps upload          | Yes, on Vercel/CI with token | build config + `.sentryclirc`-free env-based upload                                                                        |
| Sentry desktop (Tauri)             | Partially                    | `@sentry/react` init in `apps/desktop` + sourcemap + release wiring in `vite.config.ts`; Rust-side `sentry` crate deferred |
| Vercel deploy of dummy page        | No (needs account)           | `vercel.json` + runbook steps                                                                                              |
| Cloudflare DNS pointing            | No (needs zone)              | runbook only                                                                                                               |
| WAF / rate-limit / Turnstile draft | Draft only                   | `infra/cloudflare/*.json` + runbook                                                                                        |

## Tasks (ordered)

### 1. Sentry web SDK — dependencies and config

- Add to `apps/web/package.json` `dependencies`: `@sentry/nextjs` (pin latest v10.x; verify
  with `pnpm view @sentry/nextjs version` before writing, then pin exact like siblings).
- Do **not** run the Sentry wizard interactively; create files by hand to control content.
- Add `apps/web/.gitignore`-worthy entries at repo `.gitignore`: `.sentryclirc` (never used
  here) is unnecessary; instead ensure build output already covered. No gitignore change for
  Sentry secrets because all secrets stay in env.

### 2. `apps/web` Sentry runtime config

Create these four files (Sentry v10 App Router layout), each DSN-gated so builds and local
dev without a DSN remain inert:

- `apps/web/src/instrumentation-client.ts` — `Sentry.init({ dsn, tracesSampleRate, replays, tunnel: '/monitoring-tunnel' })` guarded by `if (process.env.NEXT_PUBLIC_SENTRY_DSN)`. Export `onRouterTransitionStart = Sentry.captureRouterTransitionStart`.
- `apps/web/src/instrumentation.ts` — `export async function register()` that dynamic-imports
  `./sentry.server.config` when `NEXT_RUNTIME === 'nodejs'` and `./sentry.edge.config` when
  `'edge'`; also export `onRequestError = Sentry.captureRequestError` (v10 API).
- `apps/web/src/sentry.server.config.ts` — server init, same DSN gate.
- `apps/web/src/sentry.edge.config.ts` — edge init, same DSN gate.
- Sampling: `tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1`. Replays
  off except `onError` (`replaysOnErrorSampleRate: 1.0`, `replaysSessionSampleRate: 0`),
  matching the cost-conscious posture in PRD 10.15.
- `sendDefaultPii: false` explicitly (PRD 8.7 forbids logging sensitive customer data).

### 3. `next.config.ts` Sentry integration

- Wrap existing config with `withSentryConfig(nextConfig, {...})` from `@sentry/nextjs`.
  Keep all current `headers()`, `typedRoutes`, `transpilePackages` intact.
- Options: `org`/`project` from `SENTRY_ORG`/`SENTRY_PROJECT`, `authToken` from
  `SENTRY_AUTH_TOKEN`, `tunnelRoute: '/monitoring-tunnel'` (matches client `tunnel`),
  `widenClientFileUpload: true`, `sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN }`,
  `silent: process.env.CI !== 'true'`.
- `tunnelRoute` must be excluded from `robots.txt` later; note in runbook, no robots change
  now (public robots work is Task 1.1).
- Verify the tunnel route does not collide with existing `/api/health`.

### 4. Error boundaries + example trigger (Fase 0 acceptance)

- `apps/web/src/app/global-error.tsx` — App Router top-level boundary calling
  `Sentry.captureException(error)`; styled minimally with existing neobrutalism tokens
  (`bg-background`, `text-foreground`, `--font-display`); no new components.
- `apps/web/src/app/api/sentry-example/route.ts` — `GET` that throws
  `new Error('SnapBox Sentry verification error')`, `dynamic = 'force-dynamic'`. This is the
  provable trigger for "Sentry capture test error".
- Add a temporary client trigger only if needed for browser-runtime proof; prefer the API
  route (server capture) plus one `<button>` in the existing gallery if browser proof is
  required. Keep the gallery change additive and clearly marked so it can be deleted.
- The example route must be deleted (or gated behind `NODE_ENV !== 'production'`) at the end
  of Fase 0; record this as a deliberate boundary in PHASE-0.

### 5. Sentry desktop (Tauri) — webview only

- Add `@sentry/react` to `apps/desktop/package.json` dependencies (pin exact, verify latest).
- `apps/desktop/src/main.tsx`: init inside `if (import.meta.env.VITE_SENTRY_DSN)`, with
  `release` from `VITE_SENTRY_RELEASE`. Read env via `import.meta.env` (Vite convention);
  add `VITE_SENTRY_DSN` to `.env.example` under a new "DESKTOP" comment group **only if**
  a distinct DSN is desired; default recommendation: reuse the web DSN name is wrong for
  Vite, so add `VITE_SENTRY_DSN` + document it.
- `apps/desktop/vite.config.ts`: set `build.sourcemap: 'hidden'` in production and emit a
  release id; wire `sentryVitePlugin` from `@sentry/vite-plugin` for source-map upload,
  gated on `SENTRY_AUTH_TOKEN`. Add `@sentry/vite-plugin` to `devDependencies`.
- Rust-side panic capture (`sentry` crate) and Tauri crash reporting are **out of scope** for
  Task 0.6; document as deferred (Phase 4/7).
- Confirm this does not break the 33-module Vite build or the `cargo` CI job.

### 6. Cloudflare drafts — `infra/cloudflare/`

New directory, declarative JSON plus runbook. Each JSON is human-applicable and mirrors a
dashboard/API shape; add a `$comment` field citing the PRD line it implements.

- `infra/cloudflare/README.md` — the runbook: prerequisites (API token scopes: Zone:Read,
  Zone WAF:Edit, Zone Settings:Edit, Account Turnstile:Edit), `wrangler` vs API curl usage,
  DNS pointing steps (CNAME `@`/`www` → `cname.vercel-dns.com`, proxy ON, SSL/TLS Full
  Strict per PRD 8.4), verification steps, and rollback.
- `infra/cloudflare/rate-limit-rules.json` — one rule per PRD 8.2 entry:
  `/api/webhooks/*` 300/min per IP with gateway-IP allowlist note, `/api/auth/*` 10/min per
  IP + 5/min per email, `/api/booth/*` 60/min per device fingerprint, `/api/payment/create`
  30/min per booth, `/api/contact` 5/hour per IP, `/api/operator/*` 20/min per booth,
  `/api/pairing/*` 10/min per tenant. Include `mitigation_timeout` and a burst (`requests_per_period`
  - `period`) per Cloudflare's rate-limit schema; mark device-fingerprint rules as requiring
    a Worker/Transform to attach the header (PRD 10.5 Workers KV counter) — draft the rule with
    the header match and note the Worker dependency.
- `infra/cloudflare/waf-custom-rules.json` — OWASP-style managed-rule references (SQLi, XSS,
  bot fight) plus custom rules: block non-allowlisted methods on webhook paths, challenge
  suspicious API abuse, and a rule excluding `/monitoring-tunnel` and `/api/health` from
  Turnstile challenge. Cite PRD 8.4.
- `infra/cloudflare/turnstile-widget.json` — widget config (name `snapbox-web-contact`,
  domains `snapbox.id` + `www.snapbox.id` + preview `*.vercel.app`, mode `managed`,
  `clearance_level` default). This is the "Turnstile site key" artifact; the actual site key
  is produced when applied, and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`
  receive the values.
- `infra/cloudflare/workers/rate-limit-counter.md` (or `.js.draft`) — **draft only**: the
  Workers KV counter design for per-device/per-tenant identity (PRD 10.5, Task 7.1 owns the
  real implementation). Keep as a documented draft, not deployed code.

### 7. Vercel dummy deploy config

- `vercel.json` at repo root (or `apps/web/vercel.json` if monorepo root config is preferred
  by Vercel's current monorepo handling): set `"framework": "nextjs"`,
  `"buildCommand": "pnpm --filter @snapbox/web build"`, `"installCommand": "pnpm install --frozen-lockfile"`,
  `"rootDirectory": "apps/web"` if using per-app config, and region `sin1` (Singapore, closest
  to target market) — confirm region choice in runbook.
- The dummy page already exists (`apps/web/src/app/page.tsx` gallery). No new page needed;
  the runbook verifies it renders on the Vercel preview/production URL.
- Env wiring on Vercel is Task 0.9 (Env Vault). Task 0.6 runbook only lists which vars must
  exist for the dummy render + Sentry capture to work, without provisioning them.

### 8. Guard script (optional but idiomatic here)

- Add `scripts/check-infra-drafts.mjs` (dependency-free, mirrors
  `check-firebase-project-id.mjs` style): assert the three Cloudflare JSON files parse, that
  every `/api/...` path in `rate-limit-rules.json` also appears in the PRD 8.2 list hardcoded
  in the script, and that `infra/cloudflare/README.md` exists. Wire as root script
  `check:infra-drafts` and add to CI after `check:claims-sync` and to lint-staged on
  `infra/cloudflare/**`.
- Skip this only if the user prefers fewer files; otherwise it keeps the drafts from drifting
  from the PRD the same way claims are guarded.

### 9. Docs

- `docs/PHASE-0.md`: append `## Task 0.6: Sentry + Vercel + Cloudflare` with checklist,
  "Detail", "Batas sengaja" table, and "Verifikasi" table, matching 0.1–0.5 style. Explicitly
  record: Sentry example route must be removed end of Fase 0; Rust/Tauri crash capture
  deferred; Vercel/Cloudflare account actions are manual; Workers KV counter is draft only.
- `README.md`: add a short "Observability & Edge (Task 0.6)" subsection under the Firebase
  area pointing at `infra/cloudflare/README.md`, the `vercel.json`, and the env vars already
  listed in `.env.example`. Add the `check:infra-drafts` row to the Perintah table.
- Consider `docs/ADR-004-sentry-cloudflare.md` only if a non-obvious decision arises (e.g.
  reusing one DSN vs two, tunnel route vs proxy). If decisions stay obvious, fold rationale
  into the PHASE-0 "Detail" prose instead of a new ADR — do not create an ADR for form's sake.

### 10. Verification

Run and record in the PHASE-0 table (do not run `pnpm format` on the known-failing files):

- `pnpm install` — lockfile updated with `@sentry/nextjs`, `@sentry/react`,
  `@sentry/vite-plugin`.
- `pnpm typecheck` — expect 6/6 packages (auth already added in 0.5).
- `pnpm lint` — 6/6, `--max-warnings=0`.
- `pnpm --filter @snapbox/web build` — must pass with no DSN set (inert SDK).
- `pnpm --filter @snapbox/desktop build` — Vite build still passes with sourcemap config.
- `node scripts/check-infra-drafts.mjs` — exit 0.
- Manual (document as "belum dijalankan di lingkungan ini", matching 0.4/0.5 honesty):
  deploy to Vercel, hit `/api/sentry-example`, confirm event lands in Sentry with resolved
  source maps; apply Cloudflare drafts via WAF API/dashboard; Turnstile widget issues keys.
- Confirm `pnpm check:token-sync` and `pnpm check:claims-sync` still pass (unchanged).

## Failure modes to handle

- **No DSN present** (local/CI/PR build): all Sentry inits must no-op; `next build` and
  `vite build` must succeed. This is the default path and must be tested.
- **No `SENTRY_AUTH_TOKEN`**: source-map upload disabled, build still succeeds, warning
  printed. Never fail the build on missing upload token.
- **Tunnel route**: must not be caught by the future `/api/*` robots disallow or by
  Cloudflare Turnstile challenge (added to WAF exclusion draft).
- **Desktop env var namespace**: Vite needs `VITE_*`, not `NEXT_PUBLIC_*`; document the
  distinct name so Task 0.9 provisions both.
- **Monorepo source maps**: with `transpilePackages`, verify `widenClientFileUpload` and that
  workspace package frames resolve; note if `@snapbox/*` frames stay minified.
- **Do not break the Rust CI job** (`cargo check/clippy`): Task 0.6 touches no Rust.

## Out of scope (deliberately)

- Creating the real Sentry org/projects, Vercel project, Cloudflare zone, or Turnstile
  widget: manual account actions. Repository code only consumes the resulting keys/DSNs.
- Provisioning Vercel/Cloudflare/GitHub secrets: Task 0.9 (Env Vault & Secret Strategy).
- Actual WAF rule deployment and per-device-pattern rate limiting (Workers KV): Task 7.1.
- Rust-side Tauri panic/crash reporting: Phase 4/7.
- `robots.txt` / sitemap exclusions for the tunnel route: Task 1.1.
- Turning on `test` in `turbo.json`: Phase 7.

## Open question

None blocking. The only judgment call left is whether to add the optional
`scripts/check-infra-drafts.mjs` guard (§8); default is to include it because the repo already
guards Firebase and claims the same way. If the implementer prefers the smallest diff, drop
§8 and instead add one line to `infra/cloudflare/README.md` stating the drafts must be
re-checked against PRD 8.2 manually.
