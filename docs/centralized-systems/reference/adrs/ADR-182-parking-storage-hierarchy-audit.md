# ADR-182: Parking & Storage Hierarchy Audit

> **Status**: AUDIT_COMPLETE
> **Date**: 2026-02-16
> **Author**: Claude (Anthropic AI) + Giorgos Pagonis
> **Category**: Data Architecture / Real Estate Hierarchy
> **References**: `REAL_ESTATE_ARCHITECTURE_DECISIONS.md` (LOCKED)

---

## 1. Context

Audit of the full codebase to verify that **parking spots** and **storage units** are correctly modeled as **parallel categories at the Building level**, as mandated by the locked architecture:

```
Company -> Project -> Building -> [Units | Storage | Parking] (parallel)
```

Parking and Storage are **peer categories** alongside Units, **NOT children** of Units.

---

## 2. Decision

The locked architecture (`REAL_ESTATE_ARCHITECTURE_DECISIONS.md`) is the single source of truth.
This ADR documents **compliance findings** and tracks remediation of inconsistencies.

---

## 3. Compliance Findings

### 3.1 Correct (5 points)

| # | What | Source |
|---|------|--------|
| 1 | Firestore collections: `parking_spots`, `storage_units`, `units` - separate | `src/config/firestore-collections.ts:96-122` |
| 2 | Firestore rules: Explicit "PARALLEL category" comments | `firestore.rules:556-557, 586-587` |
| 3 | BuildingNode.tsx: Correct tabs Units / Storage / Parking | `src/components/building-management/BuildingNode.tsx` |
| 4 | Navigation: Separate pages `/spaces/parking`, `/spaces/storage` | `src/config/smart-navigation-factory.ts:393-446` |
| 5 | API: Separate endpoints `/api/parking`, `/api/storages` | `src/app/api/parking/route.ts`, `src/app/api/storages/route.ts` |

### 3.2 Bugs / Inconsistencies (5 items)

---

#### BUG-1: `Building.storageAreas` typed as `Unit[]` instead of `StorageUnit[]`

**File**: `src/subapps/dxf-viewer/contexts/ProjectHierarchyContext.tsx:50`

```typescript
// CURRENT (wrong):
export interface Building {
  storageAreas?: Unit[]; // Uses Unit type for storage areas
}

// CORRECT (should be):
export interface Building {
  storageAreas?: StorageUnit[]; // From @/types/storage/contracts
}
```

**Impact**: Storage areas are treated as Units in the DXF viewer context, losing storage-specific fields (`code`, `features`, `linkedProperty`, `coordinates`).

**Canonical type**: `StorageUnit` at `src/types/storage/contracts.ts:35`

---

#### BUG-2: `parkingSpots` at **Project** level instead of **Building** level

**File**: `src/subapps/dxf-viewer/contexts/ProjectHierarchyContext.tsx:58`

```typescript
// CURRENT (wrong):
export interface Project {
  parkingSpots?: ParkingSpot[];  // Parking at Project level
}

// CORRECT (should be in Building):
export interface Building {
  parkingSpots?: ParkingSpot[];  // Parking is a parallel category at Building level
}
```

**Impact**: Violates the locked architecture where parking is a Building-level parallel category, not a Project-level entity. The `getAvailableDestinations()` function (line 392) also generates parking destinations at Project level.

---

#### BUG-3: Duplicate `ParkingSpot` interface - diverges from canonical

**Files**:
- LOCAL (wrong): `src/subapps/dxf-viewer/contexts/ProjectHierarchyContext.tsx:61-67`
- CANONICAL (correct): `src/types/parking.ts:3-23`

| Field | Local (DXF Viewer) | Canonical (`types/parking.ts`) |
|-------|-------------------|-------------------------------|
| Identifier | `number: string` | `code: string` |
| Type | `'standard' \| 'disabled' \| 'electric'` | `'underground' \| 'covered' \| 'open'` |
| Status | `'owner' \| 'sold' \| 'forRent' \| 'forSale' \| 'reserved'` | `'sold' \| 'owner' \| 'available' \| 'reserved'` |
| Location | `location: 'ground' \| 'basement' \| 'pilotis'` | `level: string` |
| Building FK | **MISSING** | `buildingId?: string` |
| Financial | **MISSING** | `price`, `value`, `valueWithSyndicate` |

**Impact**: Two completely different ParkingSpot models exist. Data from Firestore uses the canonical model, but the DXF viewer context expects the local one.

**Resolution**: Remove local interface, import from `@/types/parking`.

---

#### BUG-4: Duplicate `Unit` interface - simplified version

**Files**:
- LOCAL: `src/subapps/dxf-viewer/contexts/ProjectHierarchyContext.tsx:25-36` (7 fields)
- CANONICAL: `src/types/unit.ts:156+` (40+ fields)

**Impact**: The local Unit interface is a minimal subset. This can cause type mismatches when passing DXF viewer data to components expecting the full Unit type.

**Resolution**: Import from canonical `@/types/unit` or create a `Pick<Unit, ...>` subset type.

---

#### BUG-5: Documentation typo in `REAL_ESTATE_ARCHITECTURE_DECISIONS.md`

**File**: `docs/centralized-systems/reference/REAL_ESTATE_ARCHITECTURE_DECISIONS.md:90`

```markdown
| Parking spots | parking_spaces |  <-- WRONG
```

**Actual collection name**: `parking_spots`
- `firestore-collections.ts:98`: `PARKING_SPACES: 'parking_spots'`
- `firestore.rules:594`: `match /parking_spots/{spotId}`

**Note**: The Firestore constant is named `PARKING_SPACES` but its **value** is `parking_spots`. The documentation shows a third name `parking_spaces` which does not exist anywhere.

**Resolution**: Fix documentation to show `parking_spots`. **FIXED in this ADR commit.**

---

## 4. Action Items

| # | Bug | Priority | Status | Action |
|---|-----|----------|--------|--------|
| 1 | BUG-1: storageAreas type | Medium | PENDING | Change `Unit[]` to `StorageUnit[]` or remove embedded field |
| 2 | BUG-2: parkingSpots at Project | Medium | PENDING | Move to `Building` interface; update `getAvailableDestinations()` |
| 3 | BUG-3: Duplicate ParkingSpot | Medium | PENDING | Remove local interface, import from `@/types/parking` |
| 4 | BUG-4: Duplicate Unit | Low | PENDING | Import from `@/types/unit` or create `Pick<>` subset |
| 5 | BUG-5: Doc typo parking_spaces | Low | FIXED | Corrected to `parking_spots` in this commit |

**Note**: BUG-1 through BUG-4 are in the DXF viewer's `ProjectHierarchyContext.tsx`. This context is used internally by the DXF viewer subapp and does not affect the main application's Building/Parking/Storage management pages. Fixing these requires verifying that all consumers of this context are updated accordingly.

---

## 5. Architecture Diagram (Correct)

```
Company
  |
  +-- Project
        |
        +-- Building
              |
              +-- [Tab: Units]     -> Firestore: units/
              +-- [Tab: Storage]   -> Firestore: storage_units/
              +-- [Tab: Parking]   -> Firestore: parking_spots/
```

All three are **parallel categories** at the Building level. None is a child of the other.

---

## 6. References

| Resource | Path |
|----------|------|
| Locked Architecture | `docs/centralized-systems/reference/REAL_ESTATE_ARCHITECTURE_DECISIONS.md` |
| Firestore Collections | `src/config/firestore-collections.ts` |
| Canonical ParkingSpot type | `src/types/parking.ts` |
| Canonical StorageUnit type | `src/types/storage/contracts.ts` |
| Canonical Unit type | `src/types/unit.ts` |
| DXF Viewer Context (bugs) | `src/subapps/dxf-viewer/contexts/ProjectHierarchyContext.tsx` |
| BuildingNode tabs | `src/components/building-management/BuildingNode.tsx` |
| Firestore rules | `firestore.rules` |

---

## 7. Changelog

| Date | Change |
|------|--------|
| 2026-02-16 | Initial audit, 5 findings documented, BUG-5 fixed |
