# ADR-236: Multi-Level Property Management (Πολυεπίπεδη Διαχείριση Ακινήτων)

## Status
✅ **IMPLEMENTED** — 2026-03-16

## Context
Units (ακίνητα) could only be linked to ONE floor (`floorId`). In reality, maisonettes, penthouses, lofts, shops, and villas can span multiple floors. The infrastructure existed partially (interfaces, components) but `levels` array was always empty.

### Bugs Fixed
- Detection only checked `type === 'Μεζονέτα'` (ignored `maisonette`, `penthouse`, `loft`, etc.)
- Debug `console.log` removed from `PropertyDetailsContent`

## Decision

### UnitLevel Interface
```typescript
export interface UnitLevel {
  floorId: string;       // Firestore floor doc ID
  floorNumber: number;   // Floor number (sorting)
  name: string;          // "Ισόγειο", "1ος Όροφος"
  isPrimary: boolean;    // Primary floor (entrance level)
}
```

### Multi-Level Detection SSoT
- **Location**: `src/config/domain-constants.ts`
- **Function**: `isMultiLevelCapableType(type)`
- **Set**: `MULTI_LEVEL_CAPABLE_TYPES` — includes both canonical English codes and legacy Greek values
- **Types**: maisonette, penthouse, loft, shop, hall, detached_house, villa (+ Μεζονέτα, Κατάστημα)

### Component: FloorMultiSelectField
- **Location**: `src/components/shared/FloorMultiSelectField.tsx`
- **Pattern**: Radix Select (ADR-001) + Badge list (LinkedSpacesCard pattern)
- **Features**: Real-time Firestore subscription, add/remove floors, set primary, badge UI

### Service: multi-level.service.ts
- **Location**: `src/services/multi-level.service.ts`
- **Functions**: `buildLevelsFromSelection()`, `deriveMultiLevelFields()`, `validateMultiLevelFloors()`

## Backward Compatibility
- Existing single-floor units: **ZERO CHANGE** — `isMultiLevel = undefined`, `levels = undefined`
- `floor` / `floorId` remain as aliases of the primary floor
- No migration script — "migrate on touch"

## Files Changed

| File | Action |
|------|--------|
| `src/types/unit.ts` | Added `UnitLevel`, `isMultiLevel`, `levels` to Unit + UnitDoc |
| `src/types/property-viewer.ts` | Updated `levels` type from inline to `UnitLevel[]` |
| `src/config/domain-constants.ts` | Added `MULTI_LEVEL_CAPABLE_TYPES` + `isMultiLevelCapableType()` |
| `src/components/shared/FloorMultiSelectField.tsx` | **NEW** — Multi-floor selector |
| `src/services/multi-level.service.ts` | **NEW** — Utility functions |
| `src/features/property-details/PropertyDetailsContent.tsx` | Conditional rendering + fix detection + removed debug log |
| `src/components/property-viewer/FloorPlanCanvas/PropertyPolygon.tsx` | Fix detection |
| `src/components/units/dialogs/AddUnitDialog.tsx` | Multi-floor support in creation dialog |
| `src/components/units/hooks/useUnitForm.ts` | Added `levels` to form state + `handleLevelsChange` |
| `src/app/api/units/create/route.ts` | Extended payload + validation |
| `src/app/api/units/[id]/route.ts` | PATCH levels + validation + field locking |
| `src/i18n/locales/el/units.json` | Added `multiLevel` i18n keys |
| `src/i18n/locales/en/units.json` | Added `multiLevel` i18n keys |

## Phase 2: Per-Level Data Entry (ADR-236 Phase 2)

### LevelData Interface
```typescript
export interface LevelData {
  areas?: { gross: number; net?: number; balcony?: number; terrace?: number; garden?: number };
  layout?: { bedrooms?: number; bathrooms?: number; wc?: number };
  orientations?: OrientationType[];
  finishes?: { flooring?: FlooringType[]; windowFrames?: FrameType; glazing?: GlazingType };
}
```

### Data Model
- **Storage**: `levelData: Record<floorId, LevelData>` on the Unit/Property document
- **Aggregation**: `aggregateLevelData()` pure function in `multi-level.service.ts`
  - Areas: SUM per field across all levels
  - Layout: SUM bedrooms, bathrooms, wc
  - Orientations: UNION (unique values)
  - Finishes: NOT aggregated (each level keeps its own)
- **Backward Compat**: Aggregated totals stored in top-level `areas`, `layout`, `orientations` — queries/list views unchanged

### Per-Level vs Unit-Level Fields
| Per-Level (changes per floor) | Unit-Level (shared) |
|---|---|
| areas, layout, orientations, finishes | condition, energy, systemsOverride, interiorFeatures, securityFeatures |

### UI: LevelTabStrip
- Shows one button per level + "Σύνολα" (totals) tab
- Visible ONLY when `isMultiLevel && levels.length >= 2`
- Totals tab: read-only computed values from `aggregateLevelData()`
- Level tab: editable per-level areas/layout/orientations/finishes

### API Changes
- `levelData` added to `soldLockedFields` (locked after sale)
- Validation: each key in `levelData` must match a `floorId` in `levels`
- Auto-aggregation: server recomputes top-level totals from `levelData`

### Files Changed (Phase 2)
| File | Action |
|------|--------|
| `src/types/unit.ts` | Added `LevelData` interface + `levelData` field on Unit/UnitDoc |
| `src/types/property-viewer.ts` | Added `levelData` field on Property |
| `src/services/multi-level.service.ts` | Added `aggregateLevelData()` + `AggregatedUnitData` |
| `src/app/api/units/[id]/route.ts` | Added levelData validation + auto-aggregation + field locking |
| `src/features/property-details/components/UnitFieldsBlock.tsx` | Level tabs, per-level editing for Areas/Layout/Orientation/Finishes |
| `src/i18n/locales/el/units.json` | Added `multiLevel.perLevel.*` keys |
| `src/i18n/locales/en/units.json` | Added `multiLevel.perLevel.*` keys |

## Phase 3: Per-Level Unit Floorplan Tabs (ADR-236 Phase 3)

### Problem
Multi-level units (maisonettes etc.) showed ONE "Κάτοψη Μονάδας" tab for ALL unit floorplans. Need N tabs (one per level).

### Root Cause
`FileRecord` had no `levelFloorId` field — no way to link a unit floorplan file to a specific level.

### Schema Change
Added **optional** `levelFloorId?: string` to:
- `FileRecord` (Firestore contract)
- `CreateFileRecordInput` (upload API)
- `BuildPendingFileRecordInput` (SSoT core)
- `FileRecordBase` (SSoT core)
- Persisted in `buildPendingFileRecordData()` when present

### Service/Hook Changes
- `FileRecordService.getFilesByEntity()` — added `levelFloorId` filter option
- `useEntityFiles` hook — added `levelFloorId` param, passed to service

### UI Changes (ReadOnlyMediaViewer)
- **New component**: `UnitFloorplanTabContent` — filters pre-fetched files by `levelFloorId`, with first-level fallback for untagged legacy files
- **Tab ordering (multi-level)**: Unit FP tabs → Floor FP tabs → Photos → Videos
- **Tab naming**: "Κάτ. Επιπέδου {name}" (unit) / "Κάτ. Ορόφου {name}" (floor)
- **URL deep-linking**: Added `unit-floorplan-{floorId}` prefix to `parseMediaTabParam`
- **Default tab (multi-level)**: `unit-floorplan-{levels[0].floorId}`
- **Single-level**: Zero change — existing behavior preserved

### Tab Structure
```
Multi-level (2 levels): 6 tabs
[Κάτ.Επιπ.Ισόγ.] [Κάτ.Επιπ.1ος] [Κάτ.Ορόφ.Ισόγ.] [Κάτ.Ορόφ.1ος] [Φωτο] [Βίντεο]
 unit-floorplan     unit-floorplan  floorplan-floor   floorplan-floor

Single-level: 4 tabs (unchanged)
[Κάτοψη Μονάδας] [Κάτοψη Ορόφου] [Φωτογραφίες] [Βίντεο]
```

### Backward Compatibility
- Fully backward compatible — `levelFloorId` is optional
- Existing unit floorplans (without `levelFloorId`) → shown in first unit level tab (fallback)
- Single-level units → unchanged behavior
- Upload flow with `levelFloorId` → future Phase 4 work

### Files Changed (Phase 3)
| File | Action |
|------|--------|
| `src/types/file-record.ts` | Added `levelFloorId` to `FileRecord` + `CreateFileRecordInput` |
| `src/services/file-record/file-record-core.ts` | Added `levelFloorId` to `BuildPendingFileRecordInput` + `FileRecordBase` + persist logic |
| `src/services/file-record.service.ts` | Added `levelFloorId` filter to `getFilesByEntity()` |
| `src/components/shared/files/hooks/useEntityFiles.ts` | Added `levelFloorId` param |
| `src/features/read-only-viewer/components/ReadOnlyMediaViewer.tsx` | Multi-level unit FP tabs + `UnitFloorplanTabContent` + tab reordering |

## Phase 4: Auto-Level Creation on Type Change (ADR-236 Phase 4)

### Problem
When user changed property type to multi-level (e.g. maisonette), levels had to be created manually via FloorMultiSelectField. This was a poor UX for types that are always multi-level.

### Decision
Auto-create levels on type change with three behaviors:
- **Always multi-level** (maisonette, penthouse, loft): Auto-create 2 levels (current floor + next) + info toast
- **Optionally multi-level** (shop, hall): Show confirm dialog asking user if unit spans multiple floors
- **No next floor available** (last floor in building): Show warning dialog explaining the limitation

### New Constants
- `ALWAYS_MULTI_LEVEL_TYPES` — Set of types that always require ≥2 levels
- `OPTIONALLY_MULTI_LEVEL_TYPES` — Set of types where user decides
- `isAlwaysMultiLevelType()` / `isOptionallyMultiLevelType()` — checker functions

### New Hook
- **Location**: `src/features/property-details/hooks/useAutoLevelCreation.ts`
- Subscribes to building floors via onSnapshot (same pattern as FloorMultiSelectField)
- Exposes `triggerAutoLevelCreation(newType)` called from `safeOnUpdateProperty` on type change
- Reuses `buildLevelsFromSelection()` + `deriveMultiLevelFields()` from multi-level.service.ts
- Skips auto-creation if levels already exist (prevents overwriting manual selections)

### Files Changed (Phase 4)
| File | Action |
|------|--------|
| `src/config/domain-constants.ts` | Added `ALWAYS_MULTI_LEVEL_TYPES`, `OPTIONALLY_MULTI_LEVEL_TYPES` + checker functions |
| `src/features/property-details/hooks/useAutoLevelCreation.ts` | **NEW** — Auto-level creation hook |
| `src/features/property-details/PropertyDetailsContent.tsx` | Integrated hook + dialog rendering |
| `src/i18n/locales/el/properties.json` | Added `multiLevel.*` i18n keys |
| `src/i18n/locales/en/properties.json` | Added `multiLevel.*` i18n keys |

## Phase 5: Bidirectional Type Symmetry (ADR-236 Phase 5 / ADR-287 Batch 22)

### Problem
Forward direction (single → multi auto-create) εφαρμόστηκε στο Phase 4. Reverse direction (multi → single cleanup) έλειπε. Όταν ο χρήστης άλλαζε τύπο από maisonette/penthouse/loft σε apartment/studio, τα level tabs παρέμεναν orphan στο UI — state leak + UX confusion.

Επιπλέον, σε edit mode το `isMultiLevel` και `effectiveLevels` διάβαζαν `property.*` (Firestore prop) αντί για `formData` — άρα ακόμα και αν cleanup του formData γινόταν, η UI δεν αντιδρούσε μέχρι save+refetch.

### Decision
Google contract: **αν A→B δημιουργεί N level cards, τότε B→A τα αφαιρεί**. Silent cleanup με aggregation των per-level totals σε flat fields πριν το clear (zero perceived data loss).

### SSoT Helper
- **Location**: `src/services/property/level-reconciliation.ts`
- **Function**: `reconcileLevelsForType({ oldType, newType, currentLevels, currentLevelData, flatFields })`
- **Returns**: `{ transition, newLevels, newLevelData, flatPatch, clearActiveLevel, shouldAutoCreate, autoSavePayload }`
- **Pure**: zero side effects, server-safe, fully testable

### Transitions
| From | To | Action |
|------|----|----|
| single | multi | Signal `shouldAutoCreate=true`. Caller (`useAutoLevelCreation`) δημιουργεί 2 levels με floor query. |
| multi | single | Aggregate `levelData` → flat fields (areas SUM, layout SUM, orientations UNION). Clear `levels=[]`, `levelData={}`. Reset active tab. Auto-save payload για edit-mode persist. |
| multi | multi (e.g. maisonette → penthouse) | No-op. State preserved. |
| single | single | No-op. |

### Edit-Mode Parity
- `PropertyFieldsBlock.tsx`: `isMultiLevel` και `effectiveLevels` derive ΑΠΟ `formData` και στα δύο modes.
- `useAutoLevelCreation`: gate `isCreatingNewUnit` αφαιρέθηκε. Auto-create simmetricos σε edit mode (apartment → maisonette σε edit τώρα δημιουργεί 2 levels αυτόματα).
- `onUpdateProperty` callback: σε edit mode αναμεταδίδει `{ levels, isMultiLevel, floor, floorId }` στο `onAutoSaveFields` για άμεσο Firestore persist.

### Auto-Save Extension
Σε multi → single edit mode, `onAutoSaveFields` καλείται με merged payload σε ένα Firestore write:
```typescript
{
  type: newType,
  name: newName,
  isMultiLevel: false,
  levels: [],
  levelData: {},
  areas: { gross, net, balcony, terrace, garden },
  layout: { bedrooms, bathrooms, wc },
  orientations: [...]
}
```

### Data Loss Boundaries
- **Preserved**: areas, layout, orientations (aggregated into flat fields)
- **Lost**: per-level finishes (Phase 2 contract: finishes are per-level-only — σκόπιμη απώλεια στο reverse, undo via type re-selection)

### Files Changed (Phase 5)
| File | Action |
|------|--------|
| `src/services/property/level-reconciliation.ts` | **NEW** — SSoT pure helper |
| `src/services/property/__tests__/level-reconciliation.test.ts` | **NEW** — 9 unit tests |
| `src/features/property-details/components/usePropertyFieldHandlers.ts` | Refactor — calls helper, drop `isCreatingNewUnit` gate, extends auto-save payload |
| `src/features/property-details/components/PropertyFieldsBlock.tsx` | Derive `isMultiLevel`/`effectiveLevels` από formData στα δύο modes; `useAutoLevelCreation` σε edit mode + auto-save propagation |

### Out of Scope (V1)
- Undo toast με snapshot restore (silent cleanup ακολουθώντας Google Docs/Sheets pattern)
- Confirmation modal πριν destructive cleanup (decision: silent, user can re-select multi-type to recreate)
- Per-level finishes preservation σε flat (Phase 2 contract immutable)

## Changelog
- **2026-04-17**: Phase 5 — Bidirectional type symmetry, SSoT reconciliation helper, edit-mode parity, auto-save propagation (ADR-287 Batch 22)
- **2026-04-06**: Phase 4 — Auto-level creation on type change with always/optional/warning flows
- **2026-03-16**: Phase 3 — Per-level unit floorplan tabs with `levelFloorId` schema field
- **2026-03-16**: Phase 2 — Per-level data entry (areas, layout, orientations, finishes) with auto-aggregation
- **2026-03-16**: Initial implementation — all 3 phases complete
