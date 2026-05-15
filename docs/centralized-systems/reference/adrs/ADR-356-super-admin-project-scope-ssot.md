# ADR-356 — Super-Admin Project Scope SSOT (server helper + client invalidation hook)

**Status**: Implemented
**Date**: 2026-05-16
**Related**: ADR-354 (Super Admin Company Switcher — server + client override), ADR-355 (Real-time Subscription SSOT Consolidation)
**Owner**: Auth / Multi-tenant

---

## Context

ADR-354 added a `superAdminOverride` flag to `AuthContext` so any project-data route could re-scope its Firestore query when a super admin uses the company switcher. The first wave of fixes (`/api/projects/bootstrap`, `/api/projects/list`) each implemented the rule inline:

- "if `super_admin` and `superAdminOverride` → query with `where('companyId','==', ctx.companyId)` and use cache slot `:super:<id>`"
- "else if `super_admin` → no filter, cache slot `:all`"
- "else → tenant filter, cache slot `:tenant:<id>`"

Inline copies of the same rule mean every new project-data route is one copy-paste away from a tenant-isolation bug — exactly the kind of drift ADR-354 was created to prevent at the request-context layer. On the client side the same problem appeared in `NavigationContext` and `useFirestoreProjects`: both consumers had to wire `onSuperAdminActiveCompanyChange` manually and remember to clear their module cache + arm the server-cache-bust query param.

## Decision

Introduce two SSOTs — one server, one client — that codify the scope-and-invalidation pattern once.

### Server: `resolveSuperAdminProjectScope(ctx)`

Location: `src/lib/auth/super-admin-scope.ts`, re-exported from `@/lib/auth`.

```typescript
type SuperAdminScopeMode = 'tenant' | 'super-admin-global' | 'super-admin-impersonate';

interface SuperAdminProjectScope {
  readonly filterCompanyId: string | null;
  readonly cacheSlot: string;
  readonly mode: SuperAdminScopeMode;
}

function resolveSuperAdminProjectScope(ctx: AuthContext): SuperAdminProjectScope;
```

Decision table:

| `globalRole` | `superAdminOverride` | `filterCompanyId` | `cacheSlot`            | `mode`                     |
|--------------|----------------------|-------------------|------------------------|----------------------------|
| `super_admin`| `true`               | `ctx.companyId`   | `super:<companyId>`    | `super-admin-impersonate`  |
| `super_admin`| `false`/missing      | `null`            | `all`                  | `super-admin-global`       |
| anything else| —                    | `ctx.companyId`   | `tenant:<companyId>`   | `tenant`                   |

Routes consume the helper directly:

```typescript
const scope = resolveSuperAdminProjectScope(ctx);
const cacheKey = `${CACHE_KEY_PREFIX}:${scope.cacheSlot}`;
const snap = scope.filterCompanyId
  ? await db.collection(PROJECTS).where('companyId', '==', scope.filterCompanyId).get()
  : await db.collection(PROJECTS).get();
```

`bootstrap-queries.ts` keeps its `company_admin → navigation_companies` expansion (route-specific business logic), but the super-admin branch now goes through `scope.mode === 'super-admin-impersonate'` instead of an inline boolean.

### Client direct-query helper: `resolveEffectiveCompanyId(ctx)`

Location: `src/services/firestore/auth-context.ts`, re-exported from `@/services/firestore`.

```typescript
function resolveEffectiveCompanyId(ctx: TenantContext): string | null;
```

- Regular user → `ctx.companyId`
- Super admin with active switcher → `ctx.effectiveCompanyId` (impersonated tenant)
- Super admin without switcher selection → `null` (caller skips the `where('companyId', ...)` constraint)

**Full unification (2026-05-16)**: `buildTenantConstraints` inside `firestoreQueryService` was refactored to call `resolveEffectiveCompanyId` for the `companyId` mode (previously it duplicated the same `ctx.isSuperAdmin ? ctx.effectiveCompanyId : ctx.companyId` branching inline). Net result:

- **One source of truth** for the "which companyId is this query's effective tenant?" decision: `resolveEffectiveCompanyId(ctx)` in `src/services/firestore/auth-context.ts`.
- **Two output shapes** that wrap the same value:
  - `firestoreQueryService.subscribe` / `.getAll` → wraps it in `where(...)` automatically (30+ realtime hooks)
  - Custom services (companies, navigation-companies, …) → call it directly and build their own constraint

A future change to the rule (e.g. honoring a different override field) flips both consumer paths at once. The risk of inline-divergent copies is gone.

Every custom service that does direct Firestore queries via `getDocs`/`setDoc`/`deleteDoc` outside `firestoreQueryService` MUST resolve its tenant filter through this helper. Without it, super-admin sessions silently fall through to the JWT-claim companyId and leak cross-tenant data — the bug behind the 2026-05-16 screenshot (super admin selected "Georgios Pagonis" tenant in the switcher; the "Σύνδεση με Εταιρεία" dropdown still showed contacts from the operator's home tenant "Pagonis TEK"). Migrated services as of this ADR:

- `src/services/companies.service.ts` — 4 call sites (`getAllActiveCompanies`, `getCompanyById`, `getCompanyByName`, `getAllCompaniesForSelect`)
- `src/services/navigation-companies.service.ts` — 5 call sites (`addCompanyToNavigation`, `removeCompanyFromNavigation`, `isCompanyInNavigation`, `getNavigationCompanyIds`, `getAllNavigationCompanies`). The per-tenant in-memory cache key continues to follow the effective companyId so switching A → B → A hits separate slots.

### Client subscription helper: `useSuperAdminSwitcherInvalidation(onInvalidate, options?)`

Location: `src/hooks/useSuperAdminSwitcherInvalidation.ts`.

```typescript
function useSuperAdminSwitcherInvalidation(
  onInvalidate: () => void,
  options?: { enabled?: boolean },
): void;
```

Internally subscribes to `onSuperAdminActiveCompanyChange` and cleans up on unmount. Consumers pass a stable `useCallback` that:

1. clears their module-level / ref cache,
2. arms a "bust server cache on next request" flag (e.g. appends `?t=<ts>`),
3. triggers a refetch.

Firestore-listener consumers do **not** need this hook — `firestoreQueryService.subscribe` already rebuilds on switcher change (ADR-354 entry point #3). The hook is for REST/HTTP fetch paths only.

## Migration

| File | Before | After |
|------|--------|-------|
| `src/lib/auth/super-admin-scope.ts` | — | **New file**: helper + types |
| `src/lib/auth/index.ts` | — | Re-exports `resolveSuperAdminProjectScope`, `SuperAdminProjectScope`, `SuperAdminScopeMode` |
| `src/app/api/projects/bootstrap/route.ts` | Inline `ctx.globalRole === 'super_admin' && ctx.superAdminOverride` ternary for cache key | `scope = resolveSuperAdminProjectScope(ctx)` → cache key `${PREFIX}:${scope.cacheSlot}`. Company-admin keeps legacy `:admin` slot (multi-company expansion is bootstrap-specific). |
| `src/app/api/projects/bootstrap/bootstrap-queries.ts` | Inline super-admin/override boolean for `fetchCompaniesTenant` branch | `scope.mode === 'super-admin-impersonate'` |
| `src/app/api/projects/list/route.ts` | Inline `isSuperAdmin` + `superAdminOverride` 3-branch `if`/`else` for cache key + query | Single `scope` resolution; query is `scope.filterCompanyId ? where(...) : .get()`. Removed local `getTenantCacheKey` helper (now obsolete). |
| `src/hooks/useSuperAdminSwitcherInvalidation.ts` | — | **New file**: client hook |
| `src/hooks/useFirestoreProjects.ts` | Inline `onSuperAdminActiveCompanyChange` subscription in the events effect | `useSuperAdminSwitcherInvalidation(handleSwitcherChange)` |
| `src/components/navigation/core/NavigationContext.tsx` | Inline `useEffect` + `onSuperAdminActiveCompanyChange` | `useSuperAdminSwitcherInvalidation(handleSwitcherChange, { enabled: isAuthReady })` |

## Google-Level Checklist (N.7.2)

| # | Question | Answer |
|---|----------|--------|
| 1 | Proactive or reactive? | **Proactive** — every project route gets scope + cache slot decisions from a single function at request entry; no per-route reactive cleanup. |
| 2 | Race condition possible? | **No** — helper is pure, derives from `AuthContext` which is built once per request. Client hook subscribes/unsubscribes in a `useEffect` with stable deps. |
| 3 | Idempotent? | **Yes** — repeated calls return the same scope for the same `ctx`; repeated switcher selection of the same company is no-op (registry skips when `id === activeCompanyId`). |
| 4 | Belt-and-suspenders? | **Yes** — Firestore rules remain the security backstop. The helper drives the **client-visible** behavior (cache slotting + filter) but cannot weaken server-side rule enforcement. |
| 5 | SSoT? | **Yes** — scope decision lives in one function, switcher invalidation lives in one hook. Bug fixes propagate to every caller. |
| 6 | Fire-and-forget or await? | **Await** for server (route awaits Firestore query result with correct scope); client `onInvalidate` is synchronous; the refetch it triggers is awaited inside the consumer. |
| 7 | Lifecycle owner? | **Explicit** — `resolveSuperAdminProjectScope` owns the rule. `useSuperAdminSwitcherInvalidation` owns the listener registration/cleanup. |

## Pre-existing Bug Fixed In Passing

`/api/projects/list` previously cached every company-admin under the same `:all` slot when iterating bug-fix history → actually previously used `:${companyId}` for non-super, so OK; bootstrap used a single `:admin` slot shared across every company-admin tenant — a tenant-isolation bug. The bootstrap route still uses `:admin` because the `navigation_companies` expansion makes the response identical for all company-admins of the same registry; if the registry ever becomes per-tenant, the helper's `tenant:<companyId>` slot can take over without changing call sites.

## Verification

1. `npx tsc --noEmit` clean on all edited + new files.
2. `rg "ctx\.superAdminOverride" src/app/api/projects/` → only occurrences inside helper/scope-related comments (no inline branches).
3. **Bootstrap path**: super admin selects company X → server log `[Bootstrap] Super admin switcher override - tenant-scoped impersonation effectiveCompanyId:X`; cache slot `:super:X` populated; switch to Y → fresh fetch, slot `:super:Y`.
4. **List path**: same trace through `[Projects/List] Starting projects list load scopeMode:super-admin-impersonate effectiveCompanyId:X`; cache key `api:projects:list:super:X`.
5. **Client refetch**: switcher change → both `NavigationContext` and `useFirestoreProjects` log their invalidation message; network shows two requests fire (`/api/projects/bootstrap?t=...` and `/api/projects/list?t=...`).
6. **No regression for company_admin**: cache slot for bootstrap still `:admin`; cache slot for list now `:tenant:<companyId>` (was `:${companyId}` previously — identical content).
7. **No regression for super-admin no-override (cross-tenant)**: cache slot `:all` for both routes, query unfiltered.

## Out of Scope

- `/api/projects/by-company/[companyId]` already takes the target tenant from the URL param for super admin, so it is self-scoping. The shared cache (`CacheHelpers.getCachedProjectsByCompany(companyId)`) is keyed by the URL companyId, naturally per-tenant. No migration needed at this time.
- Other resource families (buildings, properties, etc.) — they already flow through `firestoreQueryService.subscribe` (ADR-354 entry point #3) for real-time and have their own per-tenant cache keys for REST. Apply the helper if/when a new project-like REST endpoint is introduced.
- `EnterpriseAPICache` TTL strategy — unchanged.

## Changelog

- **2026-05-16** — Initial implementation. Server helper `resolveSuperAdminProjectScope` + client hook `useSuperAdminSwitcherInvalidation`. Bootstrap + list routes migrated. NavigationContext + useFirestoreProjects migrated. ADR-354 entry point #6 (Phase C) remains valid; its inline boolean is now sourced from the helper rather than re-implemented.
- **2026-05-16 (cross-tenant leak hotfix)** — `companies.service.ts` (4 sites) and `navigation-companies.service.ts` (5 sites) were destructuring `companyId` from `requireAuthContext()` instead of resolving the effective tenant, so super-admin switcher selections never reached company-contact dropdowns. Added client helper `resolveEffectiveCompanyId(ctx)` in `src/services/firestore/auth-context.ts` and migrated all call sites.
- **2026-05-16 (full unification)** — Removed inline `ctx.isSuperAdmin ? ctx.effectiveCompanyId : ctx.companyId` duplicate inside `firestoreQueryService.buildTenantConstraints`. The function now delegates the companyId-mode decision to `resolveEffectiveCompanyId`. Single source of truth for every client-side tenant filter; two output adapters (Firestore constraint vs. raw value).
