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

Extend the **three** existing SSoT entry points instead of patching per route / per hook:

1. **Server entry point** — `buildRequestContext()` in `src/lib/auth/auth-context.ts`. After extracting JWT claims, if `isRoleBypass(claims.globalRole)` and the request carries header `X-Super-Admin-Company-Id`, override `ctx.companyId` with that header value. The new helper `resolveEffectiveCompanyId(request, claims, uid)` is applied to both authentication paths (Bearer header + `__session` cookie). An audit log entry is emitted on every override.

2. **Client HTTP entry point** — `EnterpriseApiClient.buildHeaders()` in `src/lib/api/enterprise-api-client.ts`. The class now exposes `setSuperAdminCompanyId(id | null)` and stores the value on the singleton. When set, every authenticated request automatically includes the `X-Super-Admin-Company-Id` header.

3. **Client Firestore SDK entry point** — `firestoreQueryService.subscribe()` in `src/services/firestore/firestore-query.service.ts`. Real-time listeners (used by 30+ hooks: `useRealtimeBuildings`, `useRealtimeProperties`, `subscribeToContacts`, etc.) used to skip the `where('companyId', '==', ...)` filter entirely for super admins (line 82 `if (ctx.isSuperAdmin) return [];`), so the cross-tenant view returned **all** companies' documents and the switcher had zero effect. Fix:
   - New module `src/services/firestore/super-admin-active-company.ts` — module-level registry with `setSuperAdminActiveCompanyId(id)`, `getSuperAdminActiveCompanyId()`, and `onSuperAdminActiveCompanyChange(listener)`. Zero React deps so it can be read from any service.
   - `TenantContext` extended with `effectiveCompanyId: string | null` (`firestore-query.types.ts`). `requireAuthContext` (`firestore/auth-context.ts`) populates it from the registry for super admin sessions.
   - `buildTenantConstraints` changed: super admin with `effectiveCompanyId` → emit `where('companyId', '==', effectiveCompanyId)`; super admin without selection → unchanged (skip filter, full cross-tenant view).
   - `subscribe()` refactored to a `rebuild()` function. On every switcher change, `onSuperAdminActiveCompanyChange` fires and `rebuild()` tears down the previous `onSnapshot` and creates a new one with the updated `where` clause. **All 30+ subscription hooks inherit the fix transparently** with no code changes.

4. **Glue** — `SuperAdminCompanyContext` provider effect propagates `isSuperAdmin ? activeCompanyId : null` to both transports (`apiClient` + Firestore registry) on every change. No component needs to know about either mechanism.

5. **Client-side Firestore SDK direct queries** (the 7 components with their own `where('companyId', '==', ...)` outside `firestoreQueryService`) — covered by `useCompanyId()` (ADR-201 Phase 2 + 2026-05-15 patch in `src/hooks/useCompanyId.ts`): when super admin + active selection, the switcher value wins over `user.companyId`.

6. **Per-route revert** — `src/app/api/org-structure/route.ts` had the ad-hoc helper removed. It is now generic code consuming `ctx.companyId`, and stands as the reference pattern for all 229 routes.

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
│         │            └─► firestoreQueryService.subscribe rebuilds    │
│         │                 onSnapshot with new where('companyId'…)    │
│         │                 → 30+ real-time hooks re-scope             │
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

## Changelog

- **2026-05-15** — Initial implementation. Server override in `buildRequestContext` + client setter in `EnterpriseApiClient` + context propagation. Reverted ad-hoc `/api/org-structure/route.ts` helper.
- **2026-05-15 (extension)** — Discovered third gap: client-side Firestore SDK real-time listeners (`firestoreQueryService.subscribe`, used by `useRealtimeBuildings`, `useRealtimeProperties`, `subscribeToContacts`, etc.) skipped the `companyId` filter entirely for super admin (line 82 `if (ctx.isSuperAdmin) return [];`), so cross-tenant lists were unaffected by the switcher. Fixed by adding `super-admin-active-company.ts` registry + listener pattern, `effectiveCompanyId` on `TenantContext`, and `subscribe()` rebuild-on-change. 30+ subscription hooks now inherit the fix with zero per-hook changes.
