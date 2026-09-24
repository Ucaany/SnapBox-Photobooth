# Task 0.8: Drizzle Base & Migration Harness

## Context

- `packages/db` already contains the 31-table Drizzle schema, client, config, and an idempotent `plans` seed, but `packages/db/migrations/` has no generated migration.
- Supabase infra migrations run first and provide `app.current_tenant_id()`, `app.is_ceo()`, and `app.enforce_rls(regclass)`.
- Runtime should use Supabase pooler; Drizzle migration tooling must use a direct Postgres connection. The user approved separate `DATABASE_URL` and `DIRECT_URL` variables.
- Do not duplicate application tables in `supabase/migrations`; `packages/db/src/schema.ts` remains the single schema source.

## Implementation

1. **Connection contract**
   - Add `DIRECT_URL` to `.env.example` with a direct Supabase Postgres example and clarify that `DATABASE_URL` is the runtime/session-pooler URL.
   - Update `packages/shared/src/env.ts` server schema so `DIRECT_URL` is optional for runtime, while tooling resolves `DIRECT_URL ?? DATABASE_URL`.
   - Keep `packages/db/src/client.ts` on `DATABASE_URL`; preserve pooler-safe `prepare: false`, bounded pool, idle/connect timeouts, and dev `globalThis` reuse.
   - Update `packages/db/drizzle.config.ts` to resolve `DIRECT_URL ?? DATABASE_URL`, expose a clear error naming both variables, and keep migration output at `./migrations`.
   - Ensure `generate`, `migrate`, `push`, and `studio` all load the same config and never silently target a transaction-mode pooler when `DIRECT_URL` is available.

2. **Generate the baseline migration**
   - Run `pnpm --filter @snapbox/db generate` from the repository root.
   - Review the generated SQL for all enums, 31 tables, foreign keys, indexes, unique constraints, and defaults. Do not hand-maintain a second schema definition.
   - Keep generated journal/meta files in `packages/db/migrations/`; remove only `.gitkeep` if the generator makes it unnecessary.
   - Confirm migration ordering is after every `supabase/migrations/*` file, because generated policies depend on the `app` helper schema.

3. **Add application RLS and Realtime handoff migration**
   - Add a numbered SQL migration after the generated baseline (or append carefully to the generated migration only if generation has not been applied anywhere) that:
     - calls `app.enforce_rls()` for every application table;
     - creates explicit `authenticated` policies with matching `USING` and `WITH CHECK` predicates;
     - scopes required `tenant_id` tables to `app.current_tenant_id()` or CEO;
     - handles nullable platform rows without a fail-open `tenant_id IS NULL` branch;
     - uses parent-table `exists` predicates for child tables without `tenant_id`;
     - leaves `device_calibrations` service-layer-only as documented by the infra migration;
     - avoids `app.is_ceo()` recursion in the `users` policy;
     - creates extension-scoped `snapbox_realtime_booth_select` on `realtime.messages` after `public.booths` exists, using booth UUID lookup plus tenant/CEO authorization;
     - grants only the required table/schema privileges to `authenticated`; migration and service-role paths remain functional.
   - Make the custom SQL idempotent (`drop policy if exists`, `create policy`, or guarded `do` blocks) and preserve the required acceptance query:
     `select * from pg_policies where policyname = 'snapbox_realtime_booth_select';`
   - Review generated SQL for statements that would fail on Supabase-managed ownership; do not alter `realtime.messages` RLS ownership or add Postgres Changes publication entries.

4. **Seed and scripts**
   - Keep `packages/db/src/seed.ts` as the minimal bootstrap seed for the three canonical plans. It is already idempotent via `onConflictDoUpdate`; do not add tenant/demo data.
   - Ensure seed uses the runtime client only after migration and exits non-zero on failure while always closing the pool.
   - If a dedicated direct connection is required for seed execution, make that explicit in the seed command/env handling rather than changing application runtime behavior.

5. **Documentation and acceptance notes**
   - Update `README.md` and `docs/PHASE-0.md` with the `DIRECT_URL`/pooler distinction, exact local order (`supabase db reset` before Drizzle migration), migration and seed commands, and the limitation that remote Supabase execution requires credentials/Docker.
   - Mark Task 0.8 as verified only for artifacts and local checks actually run; do not claim a remote migration was applied without a linked project.

## Validation

- `pnpm --filter @snapbox/db typecheck`
- `pnpm --filter @snapbox/db lint`
- `pnpm --filter @snapbox/db generate` produces no unexpected schema diff on a second run.
- With local Supabase available: `pnpm supabase:db:reset`, then `pnpm --filter @snapbox/db migrate`, then `pnpm --filter @snapbox/db seed`.
- Query the required `snapbox_realtime_booth_select` policy and inspect `pg_policies` for RLS coverage.
- Run a small SQL smoke check for tenant isolation, CEO access, cross-tenant denial, nullable platform-row denial, and booth Realtime authorization. If no test runner exists, use one checked-in/assert-based script or documented SQL check; do not add a framework solely for this task.
- Run workspace `pnpm typecheck` and `pnpm lint` after package/config changes.

## Risks / boundaries

- No remote Supabase project or pooler credential is available in the repository; migration application remains an operator/CI action.
- RLS is enabled without `FORCE` per the existing ADR; owner/direct and `service_role` paths bypass it by design. A dedicated non-owner DML role is a later hardening task.
- Do not modify UI/design-system files; Task 0.8 is backend infrastructure only.
