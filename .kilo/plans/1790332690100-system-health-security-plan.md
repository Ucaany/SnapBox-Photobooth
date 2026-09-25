# Task 1.11 System Health & Security

## Context and Decisions

- Existing `/ceo-dashboard/system-health` and `/security` render local example data. They must become server-backed CEO pages.
- Existing tables cover webhook idempotency/dead-letter (`webhook_events`, `webhook_failures`) and immutable audit (`activity_logs`), but not failed login, rate-limit, WAF, cron heartbeat, or web login sessions.
- Add three persistence boundaries:
  - `security_events`: normalized `LOGIN_FAILED`, `RATE_LIMIT_HIT`, `WAF_EVENT`; timestamp, source, route/provider, subject fingerprint or masked subject, severity, safe detail metadata, request ID. Never store token, password, raw signature, full sensitive payload, or raw IP.
  - `auth_sessions`: user reference, role, created/last-seen/expires/revoked timestamps, one-way IP hash, bounded user-agent summary. No cookie value or token.
  - `system_health_checks`: check key, component, status, latency, observed timestamp, last success timestamp, safe detail. Keys include `supabase`, `firebase`, `cloudflare`, `pakasir`, `webhook-queue`, `subscription-expiry`, `retention-cleanup`, `heartbeat-timeout`, `sentry`.
- Unknown/unconfigured is rendered as `Belum tersedia` or `Belum ada heartbeat`, never as healthy and never as fabricated numeric uptime.
- CEO authorization remains server-side via `requireCeo()` on every read/mutation. RLS migration covers platform-only rows; service-layer authorization remains mandatory.
- Antislop/design read: operational CEO console, SnapBox neobrutalism, `ENERGY 2 / RHYTHM 2 / MOTION 1`. Dense tables for event triage, one prominent health summary, no decorative dashboard cards. Existing Space Grotesk + Inter + JetBrains Mono and hard borders/shadows remain authoritative.

## Implementation Plan

1. **Database schema and migration**
   - Add Drizzle tables, indexes on event kind/created time, session active lookup, and health key/observed time in `packages/db/src/schema.ts`.
   - Add migration creating tables, foreign keys where safe, constraints for bounded enums/status, and RLS/policies in Supabase migration. Platform telemetry is CEO-only; auth session rows are never tenant-readable.
   - Add retention guidance in SQL/comments: security events and health snapshots are operational telemetry, not audit replacements. Do not alter immutable audit semantics.
   - Add schema/typecheck coverage and migration validation.

2. **Telemetry contracts and server service**
   - Add `apps/web/src/lib/ceo-dashboard/health-security-contract.ts` with Zod input/output schemas, safe display types, event/status unions, redaction helpers, and serializable date conversion.
   - Add `health-security-server.ts`: `listSystemHealth()`, `listSecurityEvents(filters)`, `getSecuritySummary()`, `countActiveAuthSessions()`, `recordHealthHeartbeat()`, and safe pagination/limits. Every public reader calls `requireCeo()`; heartbeat/ingest paths use separate secret/signature authorization.
   - Aggregate webhook queue from `webhook_events` and `webhook_failures`: pending/unprocessed, unresolved failures, oldest age, latest processed timestamp. Empty queue is a real zero; missing source is unavailable.
   - Health checks use bounded timeouts and `Promise.allSettled`; one dependency failure must not hide other checks or fail the whole CEO page.

3. **Auth and rate-limit instrumentation**
   - Extend `/api/auth/session` and `/api/auth/staff-pin` to record safe failed-login and rate-limit events after validation, including route, masked/hashed subject, coarse source identifier, reason category, and request ID. Keep client responses generic and preserve current anti-enumeration behavior.
   - Extend `apps/web/src/lib/auth/rate-limit.ts` with an optional event callback/recording boundary; do not make login success depend on telemetry availability. Keep current in-memory limitation explicit in health output.
   - Extend session creation/deletion flow to insert/revoke `auth_sessions`; add a lightweight authenticated last-seen update with throttling. Cleanup expired/revoked rows in the cron path. Failure to record telemetry must not grant access or expose secrets.
   - Hash IP with server-only salt using Web Crypto or Node crypto at the server boundary; never send raw IP to the UI.

4. **WAF, Sentry, and cron integrations**
   - Add a server-only WAF ingest route under `/api/internal/telemetry/waf` (exact path documented in code): verify Cloudflare shared secret/signature, validate schema, cap body size, redact fields, and make event insertion idempotent by provider event ID. Reject replay/invalid signatures without leaking details.
   - Add server-only Sentry health adapter using configured Sentry API env values. Return `unavailable` when credentials/project config is absent; never expose the token or call Sentry from the browser. Record only aggregate status and latency.
   - Add an internal cron heartbeat route/helper authenticated by a dedicated secret. Jobs call it after a completed attempt with key, status, duration, and safe error category. Idempotency key prevents duplicate heartbeat writes.
   - Extend `/api/health` aggregation only with non-sensitive status, or reuse the same health service without making the public endpoint reveal operational detail.
   - Keep gateway webhook handlers writing existing dead-letter tables; add health heartbeat/event updates without changing payment state-machine behavior.

5. **Real CEO routes**
   - Add explicit `apps/web/src/app/(ceo-dashboard)/ceo-dashboard/system-health/page.tsx` and `security/page.tsx`, matching the established `requireCeo()` and metadata pattern.
   - Add server page loaders that fetch independent sections safely and pass serializable snapshots to client components. Use `dynamic = 'force-dynamic'` through existing dashboard layout behavior; no dummy fallback.
   - Update catch-all guard so `system-health` and `security` cannot regress to skeleton views. Remove these slugs from `view-switch.tsx` and delete/retire example-only view imports without touching unrelated skeleton routes.

6. **System health UI**
   - Add `system-health-client.tsx`: focal summary strip with overall status and last observed time, service table for Supabase/Firebase/Cloudflare/gateway/Sentry, webhook queue panel, and cron heartbeat table.
   - Display textual status (`Normal`, `Perhatian`, `Gangguan`, `Belum tersedia`) plus existing status tones. No uptime percentages unless sourced from persisted real observations.
   - Include refresh action using `router.refresh()`, disabled/pending state, error feedback, empty queue state, no-heartbeat state, and partial-failure messaging. Refresh is a real control, not decoration.
   - Preserve mobile readability: tables use existing overflow wrapper, no page-level horizontal overflow, controls meet 44px target, keyboard focus remains visible.

7. **Security UI**
   - Add `security-client.tsx`: summary counts for a selected time window, filterable/paginated event table, active session count/list with revoked/expired distinction, and explicit source/config availability.
   - Filters: event type, severity, route/source, and date window. Subject/source display is masked or hashed; no raw IP, token, email credential, request body, or signature.
   - Include loading, empty, error, partial-data, and no-config states. Status meaning does not rely on color alone. Keep actions limited to real refresh/filter/reset behavior; no fake “block”, “retry”, or “terminate” control unless a separate server action is implemented.

8. **Tests and verification**
   - Add contract tests for redaction, event validation, signature/replay rejection, heartbeat idempotency, status aggregation, pagination limits, and unavailable external adapters.
   - Add auth route tests proving generic failure responses remain unchanged while safe telemetry rows are written; telemetry DB failure must not turn valid login into failure.
   - Run `pnpm --filter @snapbox/db typecheck`, `pnpm --filter @snapbox/db lint`, `pnpm --filter @snapbox/web typecheck`, `pnpm --filter @snapbox/web lint`, contract tests, and migration validation.
   - Manual route checks: CEO access, non-CEO rejection, empty DB, partial dependency failure, WAF invalid signature, cron heartbeat, duplicate heartbeat, failed login, rate-limit hit, session expiry/revoke, refresh, filters, keyboard navigation, Escape where applicable, and mobile viewport.
   - Record click-through evidence for every interactive control and verify no console errors/build regressions.

## Files Expected

- `packages/db/src/schema.ts`
- `supabase/migrations/<new_task_1_11_telemetry>.sql`
- `apps/web/src/lib/ceo-dashboard/health-security-contract.ts`
- `apps/web/src/lib/ceo-dashboard/health-security-server.ts`
- `apps/web/src/app/(ceo-dashboard)/ceo-dashboard/system-health/page.tsx`
- `apps/web/src/app/(ceo-dashboard)/ceo-dashboard/system-health/system-health-client.tsx`
- `apps/web/src/app/(ceo-dashboard)/ceo-dashboard/security/page.tsx`
- `apps/web/src/app/(ceo-dashboard)/ceo-dashboard/security/security-client.tsx`
- `apps/web/src/app/api/internal/telemetry/waf/route.ts`
- `apps/web/src/app/api/internal/telemetry/heartbeat/route.ts`
- `apps/web/src/app/api/auth/session/route.ts`
- `apps/web/src/app/api/auth/staff-pin/route.ts`
- `apps/web/src/lib/auth/rate-limit.ts`
- `apps/web/src/lib/auth/session.ts`
- `apps/web/src/components/ceo-dashboard/view-switch.tsx`
- `apps/web/src/app/(ceo-dashboard)/ceo-dashboard/[...segments]/page.tsx`
- Contract/unit tests adjacent to each new contract and telemetry boundary.

## Risks and Guardrails

- Do not call Sentry/Cloudflare APIs from client code or expose provider credentials.
- Do not treat `activity_logs` as a security-event stream; it is immutable audit and has different retention/privacy rules.
- Do not log raw IP, auth token, password, webhook signature, request payload, or customer data. Hash/mask before persistence.
- Telemetry is best-effort for auth success, but authorization, signature verification, and audit writes remain fail-closed where currently required.
- In-memory rate limiting remains per-instance until the distributed store task; show that limitation as an operational note, not a security claim.
- Public health endpoint must remain non-sensitive and always avoid secrets or detailed event lists.
- No example rows, fabricated uptime, or synthetic “normal” status may remain in either completed route.
