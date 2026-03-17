# ADR-239: Entity Linking Centralization

| Field | Value |
|-------|-------|
| **Status** | ✅ IMPLEMENTED |
| **Date** | 2026-03-17 |
| **Category** | Entity Systems |
| **Author** | ADR-Driven Workflow |
| **Related** | ADR-238 (Entity Creation), ADR-231 (Cascade), ADR-195 (Entity Audit) |

---

## Context

During end-to-end testing of the entity creation chain (ADR-238), the entity **linking** layer (PATCH operations) was found to have 4 bugs and inconsistent patterns across 5 endpoints:

### Bugs Found

| Endpoint | Bug |
|----------|-----|
| `storages/[id]` PATCH | No change detection — cascade fired even when `buildingId` was unchanged |
| `parking/[id]` PATCH | No change detection — same bug as storage |
| `buildings` PATCH | No change detection for `projectId` cascade |
| `floors` PATCH | `new Date().toISOString()` instead of `FieldValue.serverTimestamp()` |
| `storages/[id]`, `parking/[id]`, `buildings` PATCH | No entity audit trail for link changes |

### Root Cause

Each PATCH endpoint had its own inline cascade block. None shared a pattern for:
- Change detection (compare existing vs new value before dispatching cascade)
- Field locking validation (sold/rented entities should block link changes)
- Entity-level audit trail (only `units/[id]` had `EntityAuditService`)

---

## Decision

Introduce `linkEntity()` — a centralized server-side function following the same registry-driven pattern as `createEntity()` (ADR-238).

**REUSE without modification:**
- `cascade-propagation.service.ts` — all 4 cascade functions unchanged
- `entity-audit.service.ts` — `EntityAuditService.recordChange()` unchanged
- `lib/auth/audit.ts` — `logAuditEvent()` unchanged

---

## Implementation

### New Files

#### `src/lib/firestore/entity-linking.types.ts`
Type definitions: `LinkCascadeType`, `LinkRegistryEntry`, `LINK_REGISTRY`, `LinkEntityParams`, `LinkEntityResult`.

**Registry entries:**

| Registry Key | Collection | Cascade Type | Locked Statuses | Skip Audit |
|---|---|---|---|---|
| `storage:buildingId` | STORAGE | child-building | `['sold']` | false |
| `parking:buildingId` | PARKING_SPACES | child-building | `['sold']` | false |
| `unit:buildingId` | UNITS | unit-building | `['sold', 'rented']` | **true** |
| `building:projectId` | BUILDINGS | building-project | none | false |
| `project:linkedCompanyId` | PROJECTS | project-company | none | false |

> `unit:buildingId` has `skipAudit: true` because `units/[id]` PATCH already runs `EntityAuditService.diffFieldsWithResolution()` for `buildingId`, which would produce a duplicate audit entry.

#### `src/lib/firestore/entity-linking.service.ts`
`linkEntity(registryKey, params)` — 7-step pipeline:

```
1. Registry lookup     → resolve LinkRegistryEntry
2. Change detection    → early return { changed: false } if existingDoc[linkField] === newLinkValue
3. Field locking check → throw ApiError(403) if entity is in a locked status
4. Cascade dispatch    → fire-and-forget (failure is non-blocking)
5. Entity audit        → EntityAuditService.recordChange (skipped if skipAudit = true)
6. Auth audit          → logAuditEvent (backward compat)
7. Return              → { changed: true, oldValue, newValue, cascadeResult: null }
```

### Modified Files (Phase 1 — Canary)

#### `src/app/api/storages/[id]/route.ts`
- Replaced: `propagateChildBuildingLink(...)` (inline, no change detection)
- With: `linkEntity('storage:buildingId', { auth: ctx, entityId: id, newLinkValue, existingDoc: existing, apiPath })`
- Fixes: change detection + field locking (status='sold') + entity audit trail

#### `src/app/api/parking/[id]/route.ts`
- Same migration as storages (identical pattern)
- Fixes: change detection + field locking (status='sold') + entity audit trail

### Modified Files (Phase 2)

#### `src/app/api/buildings/route.ts`
- Replaced: `propagateBuildingProjectLink(...)` inline block
- With: `linkEntity('building:projectId', { ... })`
- Fixes: change detection + entity audit trail

#### `src/app/api/projects/[projectId]/route.ts`
- Replaced: inline block with manual change detection (`body.linkedCompanyId !== projectData?.linkedCompanyId`)
- With: `linkEntity('project:linkedCompanyId', { ... })`
- Note: change detection was already present here — now centralized

#### `src/app/api/units/[id]/route.ts`
- Replaced: `propagateUnitBuildingLink(...)` with manual change detection
- With: `linkEntity('unit:buildingId', { ... })` with `skipAudit: true`
- Change detection was already correct — now centralized
- Cascade is registered in `unit:buildingId` registry entry

### Modified Files (Phase 3 — Timestamp Fix)

#### `src/app/api/floors/route.ts`
- Fixed: `updates.updatedAt = new Date().toISOString()` → `FieldValue.serverTimestamp()`
- Added: `FieldValue` import from `@/lib/firebaseAdmin`

---

## Interface

```typescript
// Calling pattern from PATCH handlers:
if (body.buildingId !== undefined) {
  linkEntity('storage:buildingId', {
    auth: ctx,
    entityId: id,
    newLinkValue: body.buildingId ?? null,
    existingDoc: existing,     // already fetched — no extra Firestore read
    apiPath: '/api/storages/[id] (PATCH)',
  }).catch(err => logger.warn('linkEntity failed', { id, error: String(err) }));
}
```

```typescript
export interface LinkEntityResult {
  changed: boolean;          // false = cascade + audit skipped (value unchanged)
  oldValue: string | null;   // previous link value from existingDoc
  newValue: string | null;   // new link value written to Firestore
  cascadeResult: null;       // cascade is fire-and-forget, result not awaited
}
```

---

## Consequences

### Benefits
- **Change detection everywhere**: Cascade no longer fires when value is unchanged
- **Field locking**: Storage and parking now block link changes on sold entities
- **Entity audit trail**: Storage, parking, building PATCH now record link changes in `entity_audit_trail`
- **Zero duplication**: All 5 endpoints use the same 7-step pipeline
- **Floors timestamp**: `updatedAt` is now a Firestore Timestamp (not an ISO string)

### Trade-offs
- New indirection layer (2 new files) — acceptable for enterprise-grade patterns
- `cascadeResult` is always `null` (cascade is fire-and-forget) — intentional design

### Files NOT modified
- `cascade-propagation.service.ts` — reused as-is
- `entity-audit.service.ts` — reused as-is
- `src/services/entity-linking/` (client-side) — separate concern, untouched

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-17 | Initial implementation — 2 new files, 6 endpoints migrated, 1 timestamp fix |
