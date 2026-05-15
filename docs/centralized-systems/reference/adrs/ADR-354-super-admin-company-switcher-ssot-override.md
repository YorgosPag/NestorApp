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

Extend the two existing SSoT entry points instead of patching per route:

1. **Server entry point** — `buildRequestContext()` in `src/lib/auth/auth-context.ts`. After extracting JWT claims, if `isRoleBypass(claims.globalRole)` and the request carries header `X-Super-Admin-Company-Id`, override `ctx.companyId` with that header value. The new helper `resolveEffectiveCompanyId(request, claims, uid)` is applied to both authentication paths (Bearer header + `__session` cookie). An audit log entry is emitted on every override.

2. **Client entry point** — `EnterpriseApiClient.buildHeaders()` in `src/lib/api/enterprise-api-client.ts`. The class now exposes `setSuperAdminCompanyId(id | null)` and stores the value on the singleton. When set, every authenticated request automatically includes the `X-Super-Admin-Company-Id` header.

3. **Glue** — `SuperAdminCompanyContext` provider effect propagates `isSuperAdmin ? activeCompanyId : null` to the apiClient singleton on every change. No component needs to know about the header.

4. **Client-side Firestore queries** — already covered by `useCompanyId()` (ADR-201 Phase 2 + 2026-05-15 patch in `src/hooks/useCompanyId.ts`): when super admin + active selection, the switcher value wins over `user.companyId`. The 7 components with direct `where('companyId', '==', ...)` queries inherit the fix transparently.

5. **Per-route revert** — `src/app/api/org-structure/route.ts` had the ad-hoc helper removed. It is now generic code consuming `ctx.companyId`, and stands as the reference pattern for all 229 routes.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  User clicks CompanySwitcher → setActiveCompanyId(id)        │
│         │                                                     │
│         ▼                                                     │
│  SuperAdminCompanyContext (React state + localStorage)        │
│         │                                                     │
│         ├──► useEffect: apiClient.setSuperAdminCompanyId(id)  │
│         │            │                                        │
│         │            ▼                                        │
│         │    EnterpriseApiClient (singleton)                  │
│         │    buildHeaders adds X-Super-Admin-Company-Id       │
│         │                                                     │
│         └──► useCompanyId() → Firestore SDK queries           │
│                                                                │
│         ──────── HTTPS ─────────►                              │
│                                                                │
│  Server: buildRequestContext(req)                              │
│    if isRoleBypass(role) && header present                     │
│      → ctx.companyId = header                                  │
│    else                                                        │
│      → ctx.companyId = JWT claim                               │
│                                                                │
│  All 229 route handlers consume ctx.companyId (unchanged)      │
└─────────────────────────────────────────────────────────────┘
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
| `src/contexts/SuperAdminCompanyContext.tsx` | useEffect propagates state to apiClient singleton |
| `src/app/api/org-structure/route.ts` | Reverted ad-hoc `resolveCompanyId` helper — now generic |
| `src/hooks/useCompanyId.ts` | (Already updated 2026-05-15 in tentativo 1) — Firestore client path |

## Trade-offs Considered

- **Per-route helper (rejected)**: imposing a `getEffectiveCompanyId(req, ctx)` import on 229 handlers. SSoT violation, copy-paste prone, and ineffective without a client mechanism.
- **JWT re-mint on switch (rejected)**: would require a server endpoint that re-mints the user's token with a different `companyId` claim per switch. Expensive (token refresh + 55-min apiClient cache invalidation) and brittle (Firebase custom claims propagation latency is ~1 min).
- **URL query param (rejected)**: pollutes every URL, exposes tenant ID in logs/analytics, no automatic injection for FormData/binary requests.

The header approach is invisible to consumer code, idempotent, and aligned with how Procore/Salesforce/Microsoft 365 Admin Center handle multi-tenant context.

## Verification

1. **Localhost happy path**: `/settings/company` → switch company → Network tab shows `X-Super-Admin-Company-Id: <newId>` on `GET /api/org-structure` → response body reflects the selected tenant.
2. **App-wide propagation**: `/contacts`, `/projects`, `/buildings` with switcher active → data scoped to selected tenant.
3. **Security negative**: as `company_admin` (non-bypass role) inject header manually → server logs no override, response data scoped to JWT claim.
4. **Reset**: clear switcher (or sign in as non-super) → `setSuperAdminCompanyId(null)` → header no longer sent → behavior identical to pre-switcher era.

## Changelog

- **2026-05-15** — Initial implementation. Server override in `buildRequestContext` + client setter in `EnterpriseApiClient` + context propagation. Reverted ad-hoc `/api/org-structure/route.ts` helper.
