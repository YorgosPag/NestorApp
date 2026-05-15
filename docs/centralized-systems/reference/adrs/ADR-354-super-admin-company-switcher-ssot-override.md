# ADR-354 — Super Admin Company Switcher: SSOT Server + Client Override

**Status**: Implemented
**Date**: 2026-05-15
**Supersedes**: extends ADR-201 (Centralized CompanyId Resolution), complements ADR-340 (Super Admin Switcher UI pattern — Procore/Salesforce)
**Owner**: Auth / Multi-tenant

---

## Context

Super admin users operate across multiple tenants. The UI switcher (`CompanySwitcher` + `SuperAdminCompanyContext`) lets them pick an active company; the selection persists in `localStorage` and updates a React context. ADR-201 Phase 2 wired this context into client-side Firestore queries via `useCompanyId()`.

**The gap**: 229 API route handlers derive `companyId` from the user's JWT custom claims via `buildRequestContext()` in `src/lib/auth/auth-context.ts`. The switcher selection was **not** propagated to the server: regardless of UI state, the server always responded with the super admin's own tenant data. The client-side raw fetch in `CompanySettingsPageContent` and the centralized `EnterpriseApiClient` (used by virtually all other components) also did not transmit any per-request company override header.

A previous attempt patched `/api/org-structure/route.ts` ad-hoc with a `resolveCompanyId(req, ctx)` helper that read an `X-Super-Admin-Company-Id` header. That worked for one route but failed the SSoT bar: it implied 228 future copy-paste patches and no client mechanism to send the header in the first place.

## Decision

Extend the **five** existing SSoT entry points instead of patching per route / per hook:

1. **Server entry point** — `buildRequestContext()` in `src/lib/auth/auth-context.ts`. After extracting JWT claims, if `isRoleBypass(claims.globalRole)` and the request carries header `X-Super-Admin-Company-Id`, override `ctx.companyId` with that header value. The new helper `resolveEffectiveCompanyId(request, claims, uid)` is applied to both authentication paths (Bearer header + `__session` cookie). An audit log entry is emitted on every override.

2. **Client HTTP entry point** — `EnterpriseApiClient.buildHeaders()` in `src/lib/api/enterprise-api-client.ts`. The class now exposes `setSuperAdminCompanyId(id | null)` and stores the value on the singleton. When set, every authenticated request automatically includes the `X-Super-Admin-Company-Id` header.

3. **Client Firestore SDK entry point** — `firestoreQueryService.subscribe()` in `src/services/firestore/firestore-query.service.ts`. Real-time listeners (used by 30+ hooks: `useRealtimeBuildings`, `useRealtimeProperties`, `subscribeToContacts`, etc.) used to skip the `where('companyId', '==', ...)` filter entirely for super admins (line 82 `if (ctx.isSuperAdmin) return [];`), so the cross-tenant view returned **all** companies' documents and the switcher had zero effect. Fix:
   - New module `src/services/firestore/super-admin-active-company.ts` — module-level registry with `setSuperAdminActiveCompanyId(id)`, `getSuperAdminActiveCompanyId()`, and `onSuperAdminActiveCompanyChange(listener)`. Zero React deps so it can be read from any service.
   - `TenantContext` extended with `effectiveCompanyId: string | null` (`firestore-query.types.ts`). `requireAuthContext` (`firestore/auth-context.ts`) populates it from the registry for super admin sessions.
   - `buildTenantConstraints` changed: super admin with `effectiveCompanyId` → emit `where('companyId', '==', effectiveCompanyId)`; super admin without selection → unchanged (skip filter, full cross-tenant view).
   - `subscribe()` refactored to a `rebuild()` function. On every switcher change, `onSuperAdminActiveCompanyChange` fires and `rebuild()` tears down the previous `onSnapshot` and creates a new one with the updated `where` clause. **All 30+ subscription hooks inherit the fix transparently** with no code changes.

4. **Client DXF scene cache entry point** — `useLevelSceneLoader` in `src/subapps/dxf-viewer/systems/levels/hooks/useLevelSceneLoader.ts`. The DXF viewer caches loaded scenes in two places: `useSceneManager.levelScenes` (the in-memory `Record<levelId, SceneModel>` SSOT) and `loadedSceneLevelsRef` (a dedupe `Set<levelId>` to prevent duplicate Firestore loads). Both are React-memory state, completely outside any Firestore listener, so the switcher had no effect on `/dxf/viewer`: real-time counters refreshed (entry point #3 worked) but the rendered scene on canvas survived because nothing invalidated the in-memory cache. Fix: a `useEffect` in `useLevelSceneLoader` subscribes to `onSuperAdminActiveCompanyChange`. On every fire it aborts the pending scene load (race-safety), clears `loadedSceneLevelsRef`, and calls `sceneManager.resetSceneSession()` — a single SSoT reset action on `useAutoSaveSceneManager` that engages the auto-save guard, cancels the pending debounced save, clears `levelScenes`, nulls `injectedFileRecordIdRef`/`injectedSaveContextRef`/`currentFileNameRef`, clears `fileIdCacheRef`/`scenePathCacheRef`/`loadedFilesRef`, and releases the guard on the next animation frame. **A naïve `clearAllScenes()` was insufficient and destructive**: the new tenant's level bootstrap immediately calls `setLevelScene` with an empty scene; since `setLevelScene` is wrapped by `setLevelSceneWithAutoSave`, auto-save would fire — but the saveContext (`fileRecordId`, `canonicalScenePath`, `currentFileName`) still pointed to the previous tenant's file, so the empty scene would be persisted **over the previous tenant's DXF Storage path, destroying their data**. `resetSceneSession` is the SSoT atomic reset that prevents this data loss. The loader is the single owner of both refs (scene cache + dedupe set), so invalidation is atomic. All downstream canvas consumers (`CanvasSection`, `DxfCanvasSubscriber`, `DxfRenderer`, bitmap cache) re-render naturally on the cleared state. No per-component patches in `canvas-v2/`.

5. **Client DXF levels list re-scoping entry point** — `useLevelsFirestoreSync` in `src/subapps/dxf-viewer/systems/levels/hooks/useLevelsFirestoreSync.ts`. This hook uses `RealtimeService.subscribeToCollection` (not `firestoreQueryService.subscribe`), so it does not inherit entry point #3. For super admin the query was previously `[orderBy('order', 'asc')]` with **no `companyId` filter** — a cross-tenant level list that did not react to the switcher. The DXF viewer would then auto-select a level whose `sceneFileId` belonged to an arbitrary tenant, and the scene loader would call Storage with a stale path (`No valid scene found in any Storage path`). Fix: (a) read `getSuperAdminActiveCompanyId()` and, when present, add `where('companyId', '==', effectiveSuperAdminCompanyId)` to the constraints; (b) subscribe to `onSuperAdminActiveCompanyChange` and bump a `superAdminCompanyTick` state so the main subscription `useEffect` tears down the previous `onSnapshot` and rebuilds it with the new filter. The existing snapshot callback already re-elects `currentLevelId` (line 87) when the previous selection disappears from the new tenant's list, so the loader receives a fresh `levelId` + valid `sceneFileId` and the orphan-path load is eliminated.

6. **Projects bootstrap REST endpoint (Phase C)** — `/api/projects/bootstrap` in `src/app/api/projects/bootstrap/route.ts` + `bootstrap-queries.ts`, consumed by `useNavigationData` / `NavigationContext`. Three independent gaps:
   - **Server route**: `fetchCompaniesAdmin` for `super_admin` loaded the global `navigation_companies` registry, **ignoring** the override already applied by `resolveEffectiveCompanyId` on `ctx.companyId`. Entry point #1 was inert for this route.
   - **Server cache**: cache key was `${CACHE_KEY}:admin` — a single slot shared across every effective company. Switch A → B → A always served the first response, even if the route logic had been correct.
   - **Client cache + listener**: `useNavigationData` module-level `bootstrapCache` (3 min TTL) plus `NavigationContext`'s mount-only `loadViaBootstrap` were never invalidated on switcher change. Even with the server fixed, stale data would persist.

   Fix: extend `resolveEffectiveCompanyId` to return `{companyId, overridden}` and propagate `superAdminOverride` onto `AuthContext` (new optional field). `fetchCompanies` early-returns `fetchCompaniesTenant` whenever `super_admin && superAdminOverride` — identical impersonation semantics to a `company_admin` of the target tenant. The cache key becomes `${CACHE_KEY}:super:${ctx.companyId}` for super-admin overrides, so each effective company gets its own slot. Client side: `NavigationContext` subscribes to `onSuperAdminActiveCompanyChange` and calls `refreshNavigation()` (existing function), which already clears `bootstrapCache`, server-busts via `?t=<ts>`, and re-fetches. SSOT: zero new modules, zero per-hook patches.

7. **Glue** — `SuperAdminCompanyContext` provider effect propagates `isSuperAdmin ? activeCompanyId : null` to both transports (`apiClient` + Firestore registry) on every change. No component needs to know about either mechanism.

8. **Client-side Firestore SDK direct queries** (the 7 components with their own `where('companyId', '==', ...)` outside `firestoreQueryService`) — covered by `useCompanyId()` (ADR-201 Phase 2 + 2026-05-15 patch in `src/hooks/useCompanyId.ts`): when super admin + active selection, the switcher value wins over `user.companyId`.

9. **Per-route revert** — `src/app/api/org-structure/route.ts` had the ad-hoc helper removed. It is now generic code consuming `ctx.companyId`, and stands as the reference pattern for all 229 routes.

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  User clicks CompanySwitcher → setActiveCompanyId(id)               │
│         │                                                            │
│         ▼                                                            │
│  SuperAdminCompanyContext (React state + localStorage)               │
│         │                                                            │
│         ├──► apiClient.setSuperAdminCompanyId(id)                    │
│         │       └─► EnterpriseApiClient.buildHeaders                 │
│         │           adds X-Super-Admin-Company-Id ───────► HTTPS     │
│         │                                                            │
│         ├──► setSuperAdminActiveCompanyId(id) [module registry]      │
│         │       └─► fires onSuperAdminActiveCompanyChange listeners  │
│         │            ├─► firestoreQueryService.subscribe rebuilds    │
│         │            │    onSnapshot with new where('companyId'…)    │
│         │            │    → 30+ real-time hooks re-scope             │
│         │            └─► useLevelSceneLoader invalidates DXF cache   │
│         │                 → loadedSceneLevelsRef.clear()             │
│         │                 → sceneManager.clearAllScenes()            │
│         │                                                            │
│         └──► useCompanyId() React hook                               │
│                 └─► direct Firestore SDK queries in 7 components    │
│                                                                      │
│         ──────── HTTPS ─────────►                                    │
│                                                                      │
│  Server: buildRequestContext(req)                                    │
│    if isRoleBypass(role) && header present                           │
│      → ctx.companyId = header (audit log emitted)                    │
│    else                                                              │
│      → ctx.companyId = JWT claim                                     │
│                                                                      │
│  All 229 route handlers consume ctx.companyId (unchanged)            │
└────────────────────────────────────────────────────────────────────┘
```

## Security

- **No privilege escalation**: the override is gated by `isRoleBypass(claims.globalRole)` on the server. A non-super user injecting the header manually has it ignored — `claims.companyId` from the verified JWT wins.
- **JWT verification unchanged**: token still verified via `verifyIdToken` / `verifySessionCookie`. Claims are authoritative; header is a scoped read-write target for an already-authorized identity.
- **Audit trail**: every override emits `logger.info('[AUTH_CONTEXT] Super admin company override', { uid, original, override })` for post-hoc tenant-access reconciliation.
- **Tenant isolation compatibility**: `src/lib/auth/tenant-isolation.ts` already bypasses entity-level checks for `isRoleBypass` roles. With `ctx.companyId` now equal to the override target, validation against entities loaded from that target succeeds naturally (no special case needed).
- **CORS / header passthrough**: `X-Super-Admin-Company-Id` is a custom request header; same-origin Next.js fetches send it without preflight. No CORS config needed.

## Affected Files

| File | Change |
|------|--------|
| `src/lib/auth/auth-context.ts` | Added `resolveEffectiveCompanyId` + applied to both auth paths |
| `src/lib/api/enterprise-api-client.ts` | Added `setSuperAdminCompanyId` + header injection in `buildHeaders` |
| `src/services/firestore/super-admin-active-company.ts` | **NEW** — module-level registry with listener pattern |
| `src/services/firestore/firestore-query.types.ts` | `TenantContext.effectiveCompanyId` field |
| `src/services/firestore/auth-context.ts` | `requireAuthContext` populates `effectiveCompanyId` from registry |
| `src/services/firestore/firestore-query.service.ts` | `buildTenantConstraints` honors `effectiveCompanyId`; `subscribe` rebuilds query on switcher change |
| `src/contexts/SuperAdminCompanyContext.tsx` | useEffect propagates to **both** apiClient + Firestore registry |
| `src/app/api/org-structure/route.ts` | Reverted ad-hoc `resolveCompanyId` helper — now generic |
| `src/hooks/useCompanyId.ts` | Patched 2026-05-15 — Firestore client direct-query path |
| `src/subapps/dxf-viewer/systems/levels/hooks/useLevelSceneLoader.ts` | **Phase B** — subscribes to `onSuperAdminActiveCompanyChange`; aborts pending load + clears `loadedSceneLevelsRef` + calls `sceneManager.resetSceneSession()` |
| `src/subapps/dxf-viewer/systems/levels/hooks/useLevelsFirestoreSync.ts` | **Phase B** — adds `where('companyId', '==', effectiveSuperAdminCompanyId)` to constraints when super admin has a selection; `superAdminCompanyTick` triggers re-subscription on switcher change |
| `src/subapps/dxf-viewer/hooks/scene/useAutoSaveSceneManager.ts` | **Phase B hotfix** — adds `resetSceneSession()` SSoT atomic reset (guard + cancel debounced save + clear scenes + null fileRecordId/saveContext/filename + clear caches + release guard on next frame). Prevents data loss when company switch triggers empty-scene auto-save into previous tenant's path |
| `src/lib/auth/types.ts` | **Phase C** — added optional `superAdminOverride?: boolean` field on `AuthContext` |
| `src/lib/auth/auth-context.ts` | **Phase C** — `resolveEffectiveCompanyId` now returns `{companyId, overridden}`; both auth paths (Bearer + session cookie) propagate `superAdminOverride` onto the returned `AuthContext` |
| `src/app/api/projects/bootstrap/route.ts` | **Phase C** — cache key scoped per effective company for super-admin overrides (`${CACHE_KEY}:super:${ctx.companyId}`) |
| `src/app/api/projects/bootstrap/bootstrap-queries.ts` | **Phase C** — `fetchCompanies` early-returns `fetchCompaniesTenant` when `super_admin && superAdminOverride`, scoping admin endpoint to the effective tenant (impersonation parity) |
| `src/components/navigation/core/NavigationContext.tsx` | **Phase C** — subscribes to `onSuperAdminActiveCompanyChange` and calls existing `refreshNavigation()` (clears `bootstrapCache`, server-busts, re-fetches) |

## Trade-offs Considered

- **Per-route helper (rejected)**: imposing a `getEffectiveCompanyId(req, ctx)` import on 229 handlers. SSoT violation, copy-paste prone, and ineffective without a client mechanism.
- **Per-hook `useEffect` deps (rejected)**: adding `superAdminCompanyId` to 30+ subscription hooks. SSoT violation, every new subscription consumer would need to remember. The `onSuperAdminActiveCompanyChange` rebuild in `firestoreQueryService.subscribe` is invisible to consumers.
- **JWT re-mint on switch (rejected)**: would require a server endpoint that re-mints the user's token with a different `companyId` claim per switch. Expensive (token refresh + 55-min apiClient cache invalidation) and brittle (Firebase custom claims propagation latency is ~1 min).
- **URL query param (rejected)**: pollutes every URL, exposes tenant ID in logs/analytics, no automatic injection for FormData/binary requests.
- **Event emitter on `window` (rejected)**: anti-pattern for cross-module state, breaks SSR, no type safety. Module-level registry with explicit `subscribe` is cleaner.

The header + registry approach is invisible to consumer code, idempotent, and aligned with how Procore/Salesforce/Microsoft 365 Admin Center handle multi-tenant context.

## Verification

1. **Localhost happy path — API**: `/settings/company` → switch from Pagonis TEK to Georgios Pagoni → `GET /api/org-structure` sends `X-Super-Admin-Company-Id`, server returns the selected tenant's `orgStructure` (1 → 0 departments). ✅
2. **Localhost happy path — Firestore SDK**: `/contacts` (or `/buildings`, etc.) → switch company → real-time listener logs show `count` change live (e.g. `useRealtimeBuildings count:1` → `count:0`). ✅
3. **Security negative**: as `company_admin` (non-bypass role) inject header manually → server logs no override, response data scoped to JWT claim. `requireAuthContext` returns `effectiveCompanyId: null` for non-super-admin sessions.
4. **Reset**: clear switcher (or sign in as non-super) → both `apiClient.setSuperAdminCompanyId(null)` and `setSuperAdminActiveCompanyId(null)` → header no longer sent, Firestore subscriptions go back to JWT-claim filter → behavior identical to pre-switcher era.
5. **DXF scene cache (Phase B Part 1)**: `/dxf/viewer` with company A that has a loaded scene → switch to company B → canvas clears immediately; switch back to A → DXF re-loads from Firestore, `loadedSceneLevelsRef` repopulates fresh. PERF_LINE logs (`CanvasSection.commit`, `DxfCanvasSubscriber.commit`) fire with new entity count. ✅
6. **DXF levels list re-scoping (Phase B Part 2)**: as super admin, `/dxf/viewer` levels list reflects only the active company's levels. Switch to a company with no levels → bootstrap creates defaults for that tenant; switch back → levels re-appear correctly. No `[DxfFirestore] No valid scene found in any Storage path` error in console after switch. ✅
7. **DXF data integrity on switch (Phase B hotfix)**: upload a DXF in tenant A → switch to tenant B → switch back to A → DXF entity count unchanged (no `version:2 sizeKB:0 entities:0` log between the original save and the next reload). Storage path NOT overwritten with empty content. Auto-save status remains `idle` during the switch (no `[AutoSave] Storage save complete sizeKB:0 entities:0` immediately after `Default levels created in Firestore`). ✅
8. **Projects bootstrap re-scoping (Phase C)**: as super admin, switch company A → B. Network: `GET /api/projects/bootstrap?t=<ts>` fires automatically (no manual reload). Server log: `[Bootstrap] Super admin switcher override - tenant-scoped impersonation effectiveCompanyId:<B>`. Cache key `:super:<B>` populated independently from `:super:<A>`. UI projects list reflects only company B's projects. Switch back to A → projects re-appear without flicker (cache HIT on `:super:<A>`). Non-super users (`company_admin`, `internal_user`) unaffected — `superAdminOverride` stays undefined, original cache key path preserved. ✅

## Changelog

- **2026-05-15** — Initial implementation. Server override in `buildRequestContext` + client setter in `EnterpriseApiClient` + context propagation. Reverted ad-hoc `/api/org-structure/route.ts` helper.
- **2026-05-15 (extension)** — Discovered third gap: client-side Firestore SDK real-time listeners (`firestoreQueryService.subscribe`, used by `useRealtimeBuildings`, `useRealtimeProperties`, `subscribeToContacts`, etc.) skipped the `companyId` filter entirely for super admin (line 82 `if (ctx.isSuperAdmin) return [];`), so cross-tenant lists were unaffected by the switcher. Fixed by adding `super-admin-active-company.ts` registry + listener pattern, `effectiveCompanyId` on `TenantContext`, and `subscribe()` rebuild-on-change. 30+ subscription hooks now inherit the fix with zero per-hook changes.
- **2026-05-15 (Phase B Part 1)** — Fourth gap: `/dxf/viewer` retained the previous tenant's scene on canvas after company switch because the DXF scene cache lives in React memory (`useSceneManager.levelScenes` + `useLevelSceneLoader.loadedSceneLevelsRef`), completely outside Firestore listeners. Firestore counters refreshed via entry point #3, but the rendered scene survived. Fixed by extending entry point coverage to client DXF scene cache: `useLevelSceneLoader` now subscribes to `onSuperAdminActiveCompanyChange` and on fire it aborts the pending load, clears `loadedSceneLevelsRef`, and calls `sceneManager.clearAllScenes()`. Atomic invalidation in the single loader that owns both refs — no per-component patches in `canvas-v2/`.
- **2026-05-15 (Phase B Part 2)** — Fifth gap surfaced by Part 1: after cache invalidation, the scene loader was re-fetching a stale `sceneFileId` and Storage logged `[DxfFirestore] No valid scene found in any Storage path`. Root cause: `useLevelsFirestoreSync` uses `RealtimeService.subscribeToCollection` (not `firestoreQueryService.subscribe`) so it bypassed entry point #3. For super admin the query had **no `companyId` filter** — cross-tenant level list, no reaction to the switcher. Auto-select would pick an arbitrary tenant's level whose file does not exist for the effective company. Fixed by reading `getSuperAdminActiveCompanyId()` and adding `where('companyId', '==', …)` when present, plus a `superAdminCompanyTick` state bumped by `onSuperAdminActiveCompanyChange` so the main `useEffect` rebuilds the subscription on every switch. The existing snapshot callback re-elects `currentLevelId` when the previous selection disappears from the new tenant's level list, eliminating orphan-path Storage loads.
- **2026-05-15 (Phase B hotfix — DATA LOSS)** — Third regression caught during live testing: uploading a DXF in tenant A (3262 entities saved to Storage v1) then switching company B triggered the empty-scene auto-save to Storage v2 (size=0, entities=0) over tenant A's file path. Switching back to A reloaded the now-empty scene from Storage, falling back to Firestore legacy snapshot — **3262-entity DXF destroyed**. Root cause: Phase B Part 1 listener called `clearAllScenes()` but left `injectedFileRecordIdRef`, `injectedSaveContextRef`, and `currentFileNameRef` pointing to tenant A's file. New tenant B's level bootstrap calls `setLevelScene(id, emptyScene)`; since `setLevelScene === setLevelSceneWithAutoSave`, auto-save fired and resolved its target via the still-set refs → wrote empty scene to tenant A's path. Fix: introduce `resetSceneSession()` SSoT atomic action on `useAutoSaveSceneManager` that engages the load guard, cancels pending debounced save (`saveTimeoutRef`), clears scene state + saveContext + fileRecordId + currentFileName + per-file caches (`fileIdCacheRef`, `scenePathCacheRef`, `loadedFilesRef`), and releases the guard on the next animation frame. The Part 1 listener now calls `sceneManager.resetSceneSession()` instead of `clearAllScenes()`. The asymmetry between scene-state clearing and saveContext clearing is exactly the kind of partial reset that destroys data — `resetSceneSession` is the single canonical action to flip every piece of session state in lockstep.
