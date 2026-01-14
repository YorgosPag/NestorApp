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
| 🔴 HIGH | Buildings | 5 | 🟡 1/5 |
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

### Step 2 — Buildings Vertical Slice (Commit #1)
**Time**: 2026-01-14 17:00
**Strategy**: Enterprise approach - one domain end-to-end before expanding

#### 2.1 Files Changed

| File | Change |
|------|--------|
| `src/lib/auth/types.ts` | Added 4 Buildings permissions |
| `src/app/api/buildings/route.ts` | Added `withAuth()` + tenant isolation |

#### 2.2 Permissions Added

```typescript
// Added to PERMISSIONS registry in src/lib/auth/types.ts
'buildings:buildings:view': true,
'buildings:buildings:create': true,
'buildings:buildings:update': true,
'buildings:buildings:delete': true,
```

#### 2.3 Tenant Isolation Implementation

**File**: `src/app/api/buildings/route.ts`

**Before** (INSECURE):
```typescript
// No auth, no tenant filtering
buildingsQuery = query(collection(db, COLLECTIONS.BUILDINGS));
```

**After** (SECURE):
```typescript
export const GET = withAuth<BuildingsResponse>(
  async (request: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
    // 🔒 TENANT ISOLATION: Always scope to user's company
    const tenantCompanyId = ctx.companyId;

    // Query ALWAYS includes tenant filter
    buildingsQuery = query(
      collection(db, COLLECTIONS.BUILDINGS),
      where('companyId', '==', tenantCompanyId),
      where('projectId', '==', projectId)  // if projectId provided
    );
  },
  { permissions: 'buildings:buildings:view' }
);
```

#### 2.4 Security Guarantees

- ✅ **Authentication required**: `withAuth()` wrapper
- ✅ **Permission required**: `buildings:buildings:view`
- ✅ **Tenant isolation**: Query always filtered by `ctx.companyId`
- ✅ **No cross-tenant data leak**: User can only see their company's buildings

---

## Quality Gates Checklist

- [ ] `pnpm lint` passes
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` passes
- [x] Zero `any` types
- [x] Zero hardcoded values
- [x] Zero duplicates

---

## Remaining Buildings Routes (Next Commits)

| Route | Method | Permission | Status |
|-------|--------|------------|--------|
| `buildings/route.ts` | GET | `buildings:buildings:view` | ✅ Done |
| `buildings/[id]/customers/route.ts` | GET | TBD | ⏳ |
| `buildings/fix-project-ids/route.ts` | POST | `super_admin` only | ⏳ |
| `buildings/populate/route.ts` | GET/POST | `super_admin` only | ⏳ |
| `buildings/seed/route.ts` | POST | `super_admin` only | ⏳ |

---

## Deliverables

- [ ] PR: `authz/phase2-rollout` → `main`
- [ ] Updated RFC with Phase 2 permission map
- [x] This work log (in progress)
