# Work Log: Authorization Phase 2 - RBAC Rollout

**Date**: 2026-01-14
**Topic**: RBAC Rollout to All API Endpoints
**Status**: IN PROGRESS (Buildings Domain Complete)
**RFC Reference**: `docs/rfc/authorization-rbac.md` (v6)
**Previous Phase**: `docs/worklogs/2026-01-14_authz-phase1.md`

---

## Scope

Phase 2 extends the RBAC engine (created in Phase 1) to protect ALL API endpoints across the application.

### Goals
- Apply `withAuth()` middleware to all 84 unprotected routes
- Implement fail-closed model (401/403 for failed checks)
- Zero UI changes (working in separate git worktree)
- Full documentation and quality gates
- **Admin SDK only** in API routes (no Client SDK)
- **Centralized role gating** in middleware (not ad-hoc checks)

---

## Buildings Domain - COMPLETE ✅

### Commits Summary

| # | Hash | Message |
|---|------|---------|
| 1 | `1196a156` | feat(authz): enforce tenant-scoped auth on buildings API |
| 2 | `d70700c1` | refactor(authz): buildings API uses Admin SDK for security |
| 3 | `bf69d94e` | feat(authz): protect buildings domain routes with tenant isolation |
| 4 | `438e941f` | feat(authz): Admin SDK + centralized role gating for buildings |

### Routes Matrix

| Route | SDK | Auth | Tenant Isolation | Status |
|-------|-----|------|------------------|--------|
| `buildings/route.ts` | Admin SDK | `buildings:buildings:view` | Query filter | ✅ |
| `buildings/[id]/customers/route.ts` | Admin SDK | `buildings:buildings:view` | Building + Units + Contacts filter | ✅ |
| `buildings/fix-project-ids/route.ts` | Admin SDK | `requiredGlobalRoles: 'super_admin'` | N/A (break-glass) | ✅ |
| `buildings/populate/route.ts` | Existing | Handler auth | Handler auth | ⏳ |
| `buildings/seed/route.ts` | Existing | Handler auth | Handler auth | ⏳ |

---

## Implementation Details

### 1. Middleware Enhancement (Commit #4)

Added `requiredGlobalRoles` option to `withAuth`:

```typescript
// src/lib/auth/middleware.ts
export interface WithAuthOptions {
  permissions?: PermissionId | PermissionId[];
  requiredGlobalRoles?: GlobalRole | GlobalRole[];  // NEW
  // ...
}
```

Usage:
```typescript
export const POST = withAuth(handler, {
  requiredGlobalRoles: 'super_admin'
});
```

### 2. Client SDK → Admin SDK Migration

**Problem**: Client SDK (`firebase/firestore`) in API routes has no server-side auth enforcement

**Solution**: All buildings routes now use Admin SDK (`firebase-admin`)

```typescript
// Before (INSECURE)
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// After (SECURE)
import { db as getAdminDb } from '@/lib/firebase-admin';
const adminDb = getAdminDb();
```

### 3. Hardcoded Defaults Removed

**Problem**: `fix-project-ids` had hardcoded fallbacks:
- `|| "building_1_default"`
- `|| "Main Project"`
- Used `NEXT_PUBLIC_*` env vars in server route

**Solution**: Server-only config with fail-closed:
```typescript
// Server-only env vars (no NEXT_PUBLIC_ prefix)
const buildingId1 = process.env.ADMIN_BUILDING_1_ID;
// ... if missing → 500 with clear error
```

### 4. Full Tenant Isolation (customers route)

Three-level tenant isolation:
1. **Building ownership**: `building.companyId === ctx.companyId`
2. **Units query**: `where('companyId', '==', ctx.companyId)`
3. **Contacts query**: `where('companyId', '==', ctx.companyId)`

---

## Quality Gates Evidence

### Lint Check
```bash
$ pnpm run lint 2>&1 | grep -E "api/buildings|lib/auth/middleware"
# Result: (no output - no errors in modified files)
```

### TypeScript Check
```bash
$ pnpm run typecheck 2>&1 | grep -E "api/buildings|lib/auth/middleware"
# Result: (no output - no errors in modified files)
```

Note: Pre-existing TypeScript errors exist in other files (not introduced by this PR).

---

## Remaining Work

### Buildings Domain (populate/seed)
The `populate` and `seed` routes use `handleBuildingInstantiation` handler.
Need to verify handler auth and potentially wrap with `withAuth`.

### Other Domains (Future PRs)
| Domain | Routes | Priority |
|--------|--------|----------|
| Contacts | 6 | HIGH |
| Projects | 8 | HIGH |
| Units | 8 | HIGH |
| Conversations | 3 | HIGH |
| Notifications | 5 | MEDIUM |
| Admin/Debug | ~30 | LOW |

---

## Required Environment Variables

For `fix-project-ids` route (server-only):
```bash
ADMIN_BUILDING_1_ID=your-building-1-id
ADMIN_BUILDING_2_ID=your-building-2-id
ADMIN_TARGET_PROJECT_ID=your-project-id
```

---

## Deliverables

- [x] Buildings main route protected with Admin SDK + tenant isolation
- [x] Buildings customers route protected with Admin SDK + tenant isolation
- [x] Buildings fix-project-ids protected with Admin SDK + super_admin role
- [x] Middleware enhanced with `requiredGlobalRoles` option
- [x] Zero hardcoded defaults in server routes
- [x] Zero Client SDK in API routes (for buildings)
- [ ] PR: `authz/phase2-rollout` → `main` (ready after populate/seed)
- [x] This work log completed
