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

## Changelog
- **2026-03-16**: Phase 2 — Per-level data entry (areas, layout, orientations, finishes) with auto-aggregation
- **2026-03-16**: Initial implementation — all 3 phases complete
