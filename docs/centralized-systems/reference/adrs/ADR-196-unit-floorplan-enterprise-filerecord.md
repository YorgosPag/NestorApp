# ADR-196: Unit Floorplan Enterprise FileRecord Migration

| Metadata | Value |
|----------|-------|
| **Category** | Backend Systems / File Management |
| **Status** | ✅ IMPLEMENTED |
| **Date** | 2026-03-10 |
| **Owners** | Platform / Storage |

## Related

- ADR-060: Building Floorplan Enterprise Storage (same pattern)
- ADR-031: Enterprise File Storage System (FileRecord SSoT)
- ADR-191: Enterprise Document Management System
- Collection: `unit_floorplans` (legacy), `files` (enterprise)

## Context

Unit floorplans uploaded via the DXF Import pipeline were invisible in the unit's
FloorPlanTab. Three bugs were identified across multiple layers:

### Bug 1: Dual Write System Mismatch
- **DXF Import** saved to legacy `unit_floorplans` collection
- **FloorPlanTab** (EntityFilesManager) reads from enterprise `files` collection
- No FileRecord was created → floorplan invisible in FloorPlanTab

### Bug 2: CompanyId Mismatch
- DXF Import wizard used `selectedCompanyId` (company from step 1) for FileRecord
- FloorPlanTab queries with `unitCompanyId` (unit's own companyId from Firestore)
- When these differ → query returns empty results

### Bug 3: Firestore Rules Missing Super Admin Bypass
- `unit_floorplans` CREATE rule: `request.resource.data.companyId == getUserCompanyId()`
- Missing `|| isSuperAdminOnly()` → super_admin writes always failed
- Legacy write didn't include `companyId` → rule rejection
- Error caught silently → entire save flow aborted before FileRecord creation

## Decision

### 1. Migrate UnitFloorplanService to FileRecord Pattern

Follow the same 3-step canonical upload as BuildingFloorplanService (ADR-060):
1. `createPendingFileRecord()` → Firestore `files` collection (status: pending)
2. Upload binary to Firebase Storage (gzip compressed for DXF)
3. `finalizeFileRecord()` → status: ready + downloadUrl

### 2. Use Unit's CompanyId (Not Wizard's)

```typescript
// BEFORE (Bug)
const unitFileRecordOptions = {
  companyId: selectedCompanyId,  // ❌ From wizard step 1
  ...
};

// AFTER (Fix)
const selectedUnit = units.find(u => u.id === selectedUnitId);
const unitCompanyId = (selectedUnit as Record<string, unknown>)?.companyId;
const fileRecordCompanyId = unitCompanyId || selectedCompanyId;
const unitFileRecordOptions = {
  companyId: fileRecordCompanyId,  // ✅ From unit's Firestore data
  ...
};
```

### 3. Fix Firestore Rules + Legacy Write

- Added `|| isSuperAdminOnly()` to `unit_floorplans` CREATE rule
- Legacy write now includes `companyId` and `createdBy` from options

### 4. Unicode Path Validation

Fixed `isValidPathSegment()` regex to support:
- Greek characters in entity IDs (e.g., `Α-101`, `ΤΕΣΤ`)
- Dots in entity IDs (e.g., `A_D0.1`)

```typescript
// BEFORE
/^[a-zA-Z0-9_-]+$/

// AFTER
/^[\p{L}\p{N}_.\-]+$/u
```

## Architecture

```
DXF Import Pipeline
  └── SimpleProjectDialog.tsx
        └── UnitFloorplanService.saveFloorplan()
              ├── 1. Legacy write (unit_floorplans) — backward compat
              ├── 2. RealtimeService.dispatch('FLOORPLAN_CREATED')
              └── 3. createFileRecord()
                    ├── a. FileRecordService.createPendingFileRecord()
                    ├── b. Upload to Firebase Storage (gzip for DXF)
                    ├── c. Generate thumbnail (non-blocking)
                    └── d. FileRecordService.finalizeFileRecord()

Unit Management Page
  └── FloorPlanTab
        └── EntityFilesManager (companyId = unit's companyId)
              └── useEntityFiles → FileRecordService.getFilesByEntity()
                    Query: entityType=unit, entityId, status=ready,
                           companyId, domain=construction, category=floorplans
```

## CompanyId Resolution Pattern

```
DXF Import saves with:     unit's companyId (from Firestore)
FloorPlanTab reads with:   unit's companyId (from Firestore)
                           ↳ MATCH ✓
```

Enterprise pattern (same as Google Drive / SAP DMS):
- File belongs to the **entity's tenant**, not the user's tenant
- Super admin can create cross-tenant files via `isSuperAdminOnly()` bypass

## Files Changed

| File | Change |
|------|--------|
| `src/services/floorplans/UnitFloorplanService.ts` | Added FileRecord creation (3-step canonical), toast feedback |
| `src/subapps/dxf-viewer/components/SimpleProjectDialog.tsx` | Use unit's companyId for FileRecord |
| `src/services/upload/utils/storage-path.ts` | Unicode-aware `isValidPathSegment()` |
| `src/features/units-sidebar/components/FloorPlanTab.tsx` | Use unit's companyId for query |
| `src/app/api/units/route.ts` | Super admin queries by buildingId directly |
| `src/app/api/units/create/route.ts` | CompanyId inheritance from parent building |
| `src/app/api/units/[id]/route.ts` | Super admin bypass for PATCH/DELETE |
| `firestore.rules` | `unit_floorplans` CREATE: added `isSuperAdminOnly()` |
| `firestore.indexes.json` | Composite index: `units(buildingId + name)` |

## Related Commits

- `ac121ba9` - feat(floorplans): migrate unit floorplan save to enterprise FileRecord system
- `f74a1f7c` - fix(floorplans): Unicode path validation + visible FileRecord toast feedback
- `3ec689c6` - fix(floorplans): use unit's companyId for FileRecord instead of wizard's selectedCompanyId
- `b0d24415` - fix(floorplans): add super_admin bypass to unit_floorplans rules + include companyId in legacy write

## Guardrails

- **ALWAYS** use unit's `companyId` (from Firestore), not wizard's `selectedCompanyId`
- **NEVER** write to `unit_floorplans` without `companyId` field
- All `*_floorplans` collections MUST have `|| isSuperAdminOnly()` in CREATE rules
- `isValidPathSegment()` MUST support Unicode (`\p{L}`) for Greek entity IDs

---

## Related Documents (Upload Architecture)

| Document | Relationship | Context |
|----------|-------------|---------|
| **[ADR-292](./ADR-292-floorplan-upload-consolidation-map.md)** | **Hub** | Full upload architecture map — all 6 paths, service diagram, consolidation roadmap |
| **[ADR-202](./ADR-202-floorplan-save-orchestrator.md)** | Upstream | 4-step save orchestrator — canonical pattern this migration adopted |
| **[ADR-240](./ADR-240-floorplan-pipeline-unification.md)** | Downstream | Pipeline unification — fixed visibility issues revealed by this migration |
| **[ADR-179](./ADR-179-ifc-compliant-floorplan-hierarchy.md)** | Sibling | IFC hierarchy — defines the floor/unit structure this ADR integrates with |
| **[ADR-285](./ADR-285-dxf-tenant-scoping-and-module-split.md)** | Sibling | Tenant scoping — parallel fix for companyId issues in cadFiles/levels |
