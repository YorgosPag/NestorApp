# Work Log: Authorization Phase 2 - RBAC Rollout

**Date**: 2026-01-14
**Topic**: RBAC Rollout to All API Endpoints
**Status**: IN PROGRESS
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

---

## Inventory Results

**Total API Routes**: 86
**Already Protected (Phase 1)**: 2
**Need Protection**: 84

### Priority Classification

| Priority | Domain | Routes | Status |
|----------|--------|--------|--------|
| 🔴 HIGH | Buildings | 5 | 🟢 3/5 |
| 🔴 HIGH | Contacts | 6 | ⏳ |
| 🔴 HIGH | Projects | 8 | ⏳ |
| 🔴 HIGH | Units | 8 | ⏳ |
| 🔴 HIGH | Conversations | 3 | ⏳ |
| 🟡 MEDIUM | Notifications | 5 | ⏳ |
| 🟡 MEDIUM | Storages | 1 | ⏳ |
| 🟡 MEDIUM | Parking | 1 | ⏳ |
| 🟢 LOW | Admin/Debug | ~30 | ⏳ |
| 🟢 LOW | Migrations/Fix | ~15 | ⏳ |

---

## Implementation Log

### Step 1 — Pre-check & Inventory
**Time**: 2026-01-14 16:30
**Action**: Repository-wide search for API routes

```bash
find src/app/api -name "route.ts" | wc -l
# Result: 86 routes

grep -rl "withAuth" src/app/api/
# Result: Only 2 routes protected (communications/email/*)
```

**Conclusion**: 84 routes need `withAuth()` protection.

---

### Step 2 — Buildings Main Route (Commit #1)
**Time**: 2026-01-14 17:00
**Commit**: `1196a156`

#### Files Changed
| File | Change |
|------|--------|
| `src/lib/auth/types.ts` | Added 4 Buildings permissions |
| `src/app/api/buildings/route.ts` | Added `withAuth()` + tenant isolation |
| `docs/worklogs/2026-01-14_authz-phase2.md` | Created worklog |

#### Permissions Added
```typescript
'buildings:buildings:view': true,
'buildings:buildings:create': true,
'buildings:buildings:update': true,
'buildings:buildings:delete': true,
```

---

### Step 3 — Admin SDK Refactor (Commit #2)
**Time**: 2026-01-14 17:30
**Commit**: `d70700c1`

#### CRITICAL SECURITY FIX
**Problem**: `buildings/route.ts` was using Client SDK (`firebase/firestore`)
**Risk**: Client SDK in API routes has no server-side auth enforcement
**Solution**: Refactored to use Admin SDK (`firebase-admin`)

#### Files Changed
| File | Change |
|------|--------|
| `src/app/api/buildings/route.ts` | Changed to Admin SDK |

#### Code Changes
```typescript
// Before (INSECURE - Client SDK)
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// After (SECURE - Admin SDK)
import { db as getAdminDb } from '@/lib/firebase-admin';
const adminDb = getAdminDb();
queryRef = adminDb.collection(COLLECTIONS.BUILDINGS)
  .where('companyId', '==', tenantCompanyId);
```

---

### Step 4 — Buildings Domain Protection (Commit #3)
**Time**: 2026-01-14 18:00

#### Files Changed
| File | Change |
|------|--------|
| `src/app/api/buildings/[buildingId]/customers/route.ts` | Added `withAuth()` + tenant isolation |
| `src/app/api/buildings/fix-project-ids/route.ts` | Added `withAuth()` + super_admin check |

#### Security Implementations

**customers/route.ts**:
- ✅ Authentication: `withAuth()` wrapper
- ✅ Permission: `buildings:buildings:view`
- ✅ Tenant isolation: Verifies building belongs to `ctx.companyId`
- ✅ Access denied if building belongs to different company

**fix-project-ids/route.ts**:
- ✅ Authentication: `withAuth()` wrapper
- ✅ Role check: `ctx.globalRole === 'super_admin'`
- ✅ 403 returned for non-super_admin users

#### Pending Routes (populate/seed)
The `populate` and `seed` routes use `handleBuildingInstantiation` handler
which has existing auth checks. These will be addressed in a follow-up commit
to avoid breaking the shared handler pattern.

---

## Quality Gates Evidence

### Lint Check
```bash
pnpm run lint 2>&1 | grep -E "(buildings/route|lib/auth)"
# Result: No lint errors in modified files
```

### TypeScript Check
```bash
pnpm run typecheck 2>&1 | grep -E "(buildings/route|lib/auth/types)"
# Result: No type errors in modified files (existing errors in other files)
```

---

## Buildings Routes Matrix

| Route | Method | Permission | Tenant Isolation | Status |
|-------|--------|------------|------------------|--------|
| `buildings/route.ts` | GET | `buildings:buildings:view` | Query filter | ✅ |
| `buildings/[id]/customers/route.ts` | GET | `buildings:buildings:view` | Building ownership check | ✅ |
| `buildings/fix-project-ids/route.ts` | POST | super_admin only | N/A (break-glass) | ✅ |
| `buildings/populate/route.ts` | GET/POST | Existing handler auth | Existing | ⏳ |
| `buildings/seed/route.ts` | POST | Existing handler auth | Existing | ⏳ |

---

## Commits Summary

| # | Hash | Message |
|---|------|---------|
| 1 | `1196a156` | feat(authz): enforce tenant-scoped auth on buildings API |
| 2 | `d70700c1` | refactor(authz): buildings API uses Admin SDK for security |
| 3 | TBD | feat(authz): protect buildings domain routes |

---

## Deliverables

- [ ] PR: `authz/phase2-rollout` → `main`
- [ ] Updated RFC with Phase 2 permission map
- [x] This work log (in progress)
