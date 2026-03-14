# ADR-232: Tenant Isolation vs Business Entity Link Separation

## Status
**IMPLEMENTED** — 2026-03-15

## Context

The `companyId` field was used for TWO conflicting purposes:
1. **Tenant isolation** (security) — every entity gets `companyId: ctx.companyId` on creation
2. **Business entity link** (domain) — "Link to Company" writes to the same `companyId`

This caused a critical bug: Super admin creates entities → auto-gets their `companyId` → sales validation passes without explicit company link.

**Precedent**: Buildings ALREADY had `linkedCompanyId` (separate field). This ADR extends the same pattern to ALL entity types.

## Decision

| Field | Purpose | Set by | Mutable |
|-------|---------|--------|---------|
| `companyId` | Tenant isolation (security) | Server auto / null for super admin | **Immutable** |
| `linkedCompanyId` | Business entity link (domain) | User via EntityLinkCard | **Mutable** |

### Entity Creation
- **Regular user** → `companyId: ctx.companyId`, `linkedCompanyId: null`
- **Super admin** → `companyId: null`, `linkedCompanyId: null`

### Query Behavior (UNCHANGED — 51+ files NOT touched)
- Regular users: `.where('companyId', '==', ctx.companyId)` → unchanged
- Super admin: bypass (already works) → sees ALL

## Implementation

### Phase 1: Core Separation (DONE)

#### Types Updated
- `src/types/project.ts` — Added `linkedCompanyId`, `linkedCompanyName`
- `src/types/unit.ts` — Added `linkedCompanyId`
- `src/types/parking.ts` — Added `linkedCompanyId`
- `src/types/storage/contracts.ts` — Added `linkedCompanyId`
- `src/types/building/contracts.ts` — Already had `linkedCompanyId`

#### Entity Linking
- `src/hooks/useEntityLink.ts` — `FOREIGN_KEY_MAP['project-company']`: `'companyId'` → `'linkedCompanyId'`
- `src/components/projects/general-tab/GeneralProjectTab.tsx` — Uses `project.linkedCompanyId`, saves to `linkedCompanyId`

#### API Routes (conditional companyId)
All POST handlers: `companyId: isSuperAdmin ? null : ctx.companyId, linkedCompanyId: null`
- `src/app/api/projects/list/route.ts`
- `src/app/api/buildings/route.ts`
- `src/app/api/units/create/route.ts`
- `src/app/api/floors/route.ts`
- `src/app/api/storages/route.ts`
- `src/app/api/parking/route.ts`

#### Cascade Propagation
- `src/lib/firestore/cascade-propagation.service.ts` — All 3 rules now propagate `linkedCompanyId` (NOT `companyId`)

#### Sales Validation
- `src/hooks/sales/useUnitHierarchyValidation.ts` — Checks `project.linkedCompanyId`
- `src/app/api/units/[id]/route.ts` — Server-side check uses `project.linkedCompanyId`

#### Tenant Isolation
- `src/lib/auth/tenant-isolation.ts` — Allows `companyId: null` for super admin entities
- `src/app/api/projects/[projectId]/route.ts` — `companyId` is immutable in PATCH, cascade uses `linkedCompanyId`

#### Navigation & UI
- Navigation sidebar filters projects by `linkedCompanyId` for company→project display
- Breadcrumb lookups use `linkedCompanyId` for company name resolution
- All `.where('companyId', '==', ...)` queries remain unchanged (tenant filtering)

### Phase 2: User Management UI (PENDING)
- Extend `/admin/users/claims-repair` with company assignment

### Phase 3: Migration (PENDING)
- One-time script: copy existing `companyId` → `linkedCompanyId` for test data
- Or: delete test data and start fresh

## Files Changed (Phase 1)

### Core (18 files)
1. `src/types/project.ts`
2. `src/types/unit.ts`
3. `src/types/parking.ts`
4. `src/types/storage/contracts.ts`
5. `src/hooks/useEntityLink.ts`
6. `src/components/projects/general-tab/GeneralProjectTab.tsx`
7. `src/services/projects-client.service.ts`
8. `src/app/api/projects/list/route.ts`
9. `src/app/api/projects/[projectId]/route.ts`
10. `src/app/api/buildings/route.ts`
11. `src/app/api/units/create/route.ts`
12. `src/app/api/units/[id]/route.ts`
13. `src/app/api/units/[id]/hierarchy/route.ts`
14. `src/app/api/floors/route.ts`
15. `src/app/api/storages/route.ts`
16. `src/app/api/parking/route.ts`
17. `src/lib/firestore/cascade-propagation.service.ts`
18. `src/hooks/sales/useUnitHierarchyValidation.ts`
19. `src/lib/auth/tenant-isolation.ts`

### UI/Navigation (6 files)
20. `src/components/building-management/BuildingsPageContent.tsx`
21. `src/components/building-management/tabs/TimelineTabContent.tsx`
22. `src/components/building-management/building-services.ts`
23. `src/components/navigation/core/ContextualNavigationHandler.tsx`
24. `src/components/navigation/components/MobileNavigation.tsx`
25. `src/components/navigation/components/DesktopMultiColumn.tsx`
26. `src/components/projects/ProjectViewSwitch.tsx`
27. `src/app/spaces/storage/page.tsx`
28. `src/app/spaces/parking/page.tsx`
29. `src/app/obligations/new/page.tsx`

## Files NOT Changed (51+)
All `.where('companyId', '==', ...)` tenant isolation queries remain unchanged. This is the key reason the change is safe — `companyId` continues to function as the tenant key.

## Changelog
- **2026-03-15**: Phase 1 implemented — Core separation across 29 files
