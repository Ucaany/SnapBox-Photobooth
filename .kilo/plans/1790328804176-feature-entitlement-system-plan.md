# Task 1.7 Feature Entitlement System

## Goal

Implement a server-only `EntitlementService.checkEntitlement(tenantId, feature)` that resolves plan JSONB features plus the existing device add-on, then make entitlement checks use this service instead of scattered plan-tier capability logic. Preserve the current DB schema and fail closed when tenant, plan, or subscription state cannot be verified.

## Decisions

- Canonical plan capability data remains `plans.features` / `PlanFeatures` from `@snapbox/db`; no second feature schema.
- MVP add-on scope is the existing `tenants.addOnDevices` column only. Effective device limit is `features.deviceIncluded + addOnDevices`; Extra Storage and Extra Frame Slot remain explicitly out of scope until schema support exists.
- `EntitlementResult` is a discriminated typed result containing `allowed`, `feature`, `value`, `source`, and `reason`. Boolean features return boolean values, numeric features return effective numeric limits, and enum/string features return their plan value.
- Unknown tenant, missing plan, missing subscription, unusable subscription, invalid feature, and database failures return `allowed: false`; callers do not receive raw DB errors or sensitive details.
- A subscription is usable under the existing authorization policy: `ACTIVE`, `EXPIRING`, or `GRACE_PERIOD`, with a non-expired applicable deadline. `PENDING`, `EXPIRED`, `SUSPENDED`, `CANCELLED`, missing dates, and blocked tenant states do not grant entitlement.
- This task does not add subscription cron, owner subscription UI, generic add-on tables, or entitlement caching. Reads are request-time and reflect plan editor changes immediately.

## Implementation

1. Add a framework-independent entitlement contract/resolver under `apps/web/src/lib/entitlement/`.
   - Define `EntitlementFeature` as `keyof PlanFeatures` plus the derived `deviceQuota` feature needed for add-on composition.
   - Define typed success/failure result shapes, source values (`plan`, `plan+add-on`, `denied`), safe denial reasons, and the tenant/subscription/plan input used by the pure resolver.
   - Implement the pure resolver: validate feature key, enforce feature-specific value semantics, add `addOnDevices` only to device quota, and preserve `-1` as unlimited without arithmetic corruption.
   - Keep the module free of Next.js, Drizzle, and Node-only imports so its behavior is directly testable.

2. Add server-only `EntitlementService` in `apps/web/src/lib/entitlement/entitlement-service.ts`.
   - Query one tenant by ID, the canonical plan joined through the latest relevant `b2b_subscriptions` row, and the tenant add-on count in one scoped query or equivalent minimal query sequence.
   - Reuse the same subscription status/deadline rules as `apps/web/src/lib/auth/authorization.ts`; centralize the rule in a shared entitlement helper rather than duplicating divergent arrays.
   - Expose `checkEntitlement(tenantId: string, feature: EntitlementFeature): Promise<EntitlementResult>` and return safe fail-closed results for all expected lookup/DB failures.
   - Export only server-safe service entry points from the entitlement server module; never import it into client components.

3. Integrate existing capability consumers.
   - Replace future/current feature gates that would inspect plan tier or copied quota values with `EntitlementService`; device pairing/quota, frame upload, storage/retention, staff, outlet, promo, gateway, kiosk, camera, chroma/filter, and realtime checks must use feature keys through the service at their server trust boundaries.
   - Update tenant detail/provisioning helpers so displayed or enforced entitlement values come from the canonical service/resolver where a tenant ID is available. Keep provisioning snapshot columns only as denormalized compatibility data, not as the capability decision source.
   - Preserve plan comparison used only for a user-requested plan transition (`tenant.planTier === targetPlan.tier`) as a transition conflict check, not an entitlement gate.
   - Add a repository guard/self-check that fails if production TypeScript introduces `plan === 'GROWTH'`, `planTier === 'GROWTH'`, or equivalent tier-specific capability checks outside plan-management/transition code.

4. Add focused tests following the existing `node --test` self-check style.
   - Pure resolver matrix: every `PlanFeatures` field, boolean false/true, numeric limits, `-1`, enum/string values, unknown feature, and device add-on composition.
   - Subscription matrix: active, expiring, grace period before/after deadline, pending, expired, suspended, cancelled, missing date, blocked tenant, missing plan, and missing tenant.
   - Failure behavior: DB/query failure produces a safe denied result; no raw SQL error, plan data, or secret appears in the result.
   - Regression guard: scan source for forbidden hardcoded Growth entitlement checks and assert only explicit transition/editor contexts are exempted.

5. Validate and document boundaries.
   - Run `pnpm --filter @snapbox/web lint`, `pnpm --filter @snapbox/web typecheck`, `pnpm --filter @snapbox/db typecheck`, and the focused entitlement Node self-check.
   - Run the web build and inspect output for accidental client bundling of the DB/service module.
   - Verify no migration is generated, because the selected MVP add-on source already exists.
   - Record out-of-scope Extra Storage/Extra Frame Slot and the required future generic add-on schema in the implementation comments or task notes, without creating placeholder entitlement fields.

## Failure and security rules

- `tenantId` is always server-derived from the authenticated user/resource context; browser-provided tenant IDs are not trusted.
- Cross-tenant or unknown tenant access is denied without revealing whether the tenant exists.
- Entitlement denial never silently falls back to a tier name, cached snapshot, or permissive default.
- Plan editor updates take effect on the next service read; existing subscription historical pricing remains unchanged.
- Add-on counts are clamped/validated as non-negative integers before composition; malformed persisted values deny rather than grant excess capacity.

## Out of scope

- Generic `tenant_add_ons` table and pricing for storage/frame add-ons.
- Subscription expiry cron/grace automation and owner subscription page.
- Client-side authorization as a security boundary.
- UI redesign or new entitlement dashboard.
