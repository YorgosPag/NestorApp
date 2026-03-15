# ADR-231: Cascade Entity Linking — Αυτόματη Διάδοση Ιεραρχίας

**Status**: ✅ IMPLEMENTED
**Date**: 2026-03-14
**Author**: Claude (ADR-driven workflow)

## Context

Η εφαρμογή επιτρέπει δημιουργία entities σε οποιαδήποτε σειρά και σύνδεσή τους αργότερα μέσω EntityLinkCard. Χωρίς cascade, όταν ένα building συνδέεται με project, τα units/floors/parking/storage ΔΕΝ κληρονομούν τα parent IDs — η commercial validation αποτυγχάνει.

## Hierarchy

```
Company (root)
  └── Project (companyId)
        └── Building (projectId, companyId)
              ├── Floor (buildingId, projectId, companyId)
              ├── Unit (buildingId, floorId, projectId, companyId)
              ├── Parking (buildingId, projectId, companyId)
              └── Storage (buildingId, projectId, companyId)
```

## Cascade Rules

| Rule | Trigger | Action |
|------|---------|--------|
| **Rule 1** | Building gains/changes `projectId` | Resolve project.companyId → update ALL children with projectId + companyId |
| **Rule 2** | Project gains/changes `companyId` | Update ALL buildings + their children with companyId |
| **Rule 3** | Unit gains/changes `buildingId` | Resolve building→project→company chain → update unit with projectId + companyId |
| **Rule 4** | Any link removed (null) | Children lose inherited fields (set to null) |

## Implementation

### Core Service
**File**: `src/lib/firestore/cascade-propagation.service.ts`

3 exported functions:
- `propagateBuildingProjectLink(buildingId, newProjectId)` — Rule 1
- `propagateProjectCompanyLink(projectId, newCompanyId)` — Rule 2
- `propagateUnitBuildingLink(unitId, newBuildingId)` — Rule 3

All use Firestore batched writes (atomic per batch, chunked at 450).

### API Route Integration

| Route | When | Cascade Function |
|-------|------|-----------------|
| `PATCH /api/buildings` | `projectId` in update payload | `propagateBuildingProjectLink()` |
| `PATCH /api/projects/[id]` | `companyId` changed | `propagateProjectCompanyLink()` |
| `PATCH /api/units/[id]` | `buildingId` changed | `propagateUnitBuildingLink()` |

All cascade calls are **fire-and-forget** — parent update succeeds regardless.

### Real-time Event
**Event**: `CASCADE_PROPAGATED` (in `REALTIME_EVENTS`)
**Payload**: `CascadePropagatedPayload` — sourceEntityType, changedField, newValue
**Subscriber**: `useUnitHierarchyValidation` hook — triggers re-validation on cascade

## Error Handling

- Batched writes are atomic per batch (all-or-nothing within 450 ops)
- Cascade failure does NOT rollback the parent update
- Errors are logged but non-blocking (fire-and-forget pattern)

## Files Changed

| File | Action |
|------|--------|
| `src/lib/firestore/cascade-propagation.service.ts` | **NEW** — Core cascade engine |
| `src/app/api/buildings/route.ts` | MODIFIED — Wire cascade after PATCH |
| `src/app/api/projects/[projectId]/route.ts` | MODIFIED — Wire cascade after PATCH |
| `src/app/api/units/[id]/route.ts` | MODIFIED — Wire cascade after PATCH |
| `src/services/realtime/types.ts` | MODIFIED — Added CASCADE_PROPAGATED event + payload |
| `src/hooks/sales/useUnitHierarchyValidation.ts` | MODIFIED — Subscribe to CASCADE_PROPAGATED |

## Changelog

| Date | Change |
|------|--------|
| 2026-03-14 | Initial implementation — 3 cascade rules, fire-and-forget pattern |
