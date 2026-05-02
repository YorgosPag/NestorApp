# ADR-339: Floor Management Enhancements — Sequential Validation, Smart Elevation, Floorplan Status

**Status:** ACCEPTED  
**Date:** 2026-05-02  
**Domain:** Building Management → Floors Tab

---

## Context

The "Νέος Όροφος" inline dialog had 3 UX/data quality gaps:

1. **Non-sequential floor creation**: Chevron stepper allowed jumping to floor 4 when only -1, 0, 1 existed — creating architectural gaps.
2. **Static elevation calculation**: `floorNumber × 3.0m` ignored actual floor heights entered by the user, causing incorrect elevation suggestions for buildings with non-standard floor heights.
3. **Missing κάτωψη indicator**: Floor list rows gave no visual feedback when no floor plan (κάτωψη ορόφου) had been uploaded, silently leaving buildings undocumented.

---

## Decisions

### 1 — Sequential floor validation (`FloorInlineCreateForm`)

A floor number N is **valid** iff:  
`existing.has(N-1) || existing.has(N+1)` — or `existing.size === 0` (first floor).

- Chevrons (`handleStepUp/Down`) now use `findNextContiguous()` which skips to the next valid AND contiguous candidate. If no such candidate exists in that direction, the stepper stays on the current value (no wrap-around to arbitrary gaps).
- Submit button is `disabled` when `createNumberNonContiguous === true`.
- Inline warning (red, same pattern as `mismatchWarning`) is shown when a non-contiguous number is manually typed.

### 2 — Smart elevation from actual floor heights (`FloorInlineCreateForm`)

New pure function `computeSmartElevation(floorNumber, existingFloors)`:

- Filters floors with `elevation != null`, sorts by number.
- Finds nearest `below` and `above` neighbors.
- **Both exist**: interpolates `below.elev + (N - below.num) × heightPerFloor`.
- **Only below**: infers `h` from `below − belowBelow` gap (or `DEFAULT_STOREY_HEIGHT` if no second reference).
- **Only above**: symmetrically infers downward.
- **No data**: falls back to `floorNumber × DEFAULT_STOREY_HEIGHT`.

`FloorsTabContent` passes `existingFloors={floors}` to the form on every render, so the suggestion always reflects the current saved state.

### 3 — Floorplan status indicator (server-side enrichment)

`handleListFloors` (floors API) now performs a batch Firestore query after fetching floors:

```
FILES WHERE companyId=X AND entityType='floor'
        AND purpose='floor-floorplan'
        AND entityId IN [floorIds] (≤30 items)
```

Each floor in the response gains `hasFloorplan: boolean`. The client receives this alongside the existing data — zero new API calls, zero new hooks.

`FloorsTabContent` renders an `<AlertTriangle>` icon with tooltip "Χωρίς κάτοψη" in the floor name cell when `!floor.hasFloorplan`.

---

## Files Modified

| File | Change |
|------|--------|
| `FloorInlineCreateForm.tsx` | `isContiguous`, `findNextContiguous`, `computeSmartElevation`, `existingFloors` prop, `createNumberNonContiguous` guard |
| `FloorsTabContent.tsx` | Pass `existingFloors`, render κάτωψη badge |
| `useFloorsTabState.ts` | Add `hasFloorplan?: boolean` to `FloorRecord` |
| `floors.handlers.ts` | Batch FILES query + enrich floors with `hasFloorplan` |
| `floors.types.ts` | Add `hasFloorplan?: boolean` to `FloorDocument` |
| `el/building-tabs.json` + `en/building-tabs.json` | Add `tabs.floors.nonContiguousWarning` |

---

## Limitations

- Firestore `in` query limited to 30 floor IDs per request. Buildings with >30 floors will have incomplete `hasFloorplan` data for floors beyond the 30th. This is acceptable for the current residential/commercial use case (typical max: 20 floors).

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-05-02 | v1.0 | Initial implementation: sequential validation, smart elevation, κάτωψη badge |
| 2026-05-02 | v1.1 | Add `height` field (floor-to-floor meters) to schema, API, create form, edit row, table; fix `computeSmartElevation` to use `adjacent.height` directly instead of inferring from elevation differences |
| 2026-05-02 | v1.2 | Cascade elevation update: when editing a floor's elevation, detect delta, show ConfirmDialog warning (count + delta), batch-update all other floors with elevations on confirm |
| 2026-05-02 | v1.3 | Cascade dialog simplified to confirmation-only (no choice): cancel aborts entire operation (primary floor NOT saved), always cascades on confirm; removed `cascadeElevationSkip` i18n key |
| 2026-05-02 | v1.4 | Block deletion of intermediate floors (client guard in `handleDelete` + server guard in `handleDeleteFloor` returning 422); only top/bottom floors of the sequence are deletable |
| 2026-05-02 | v1.5 | Intermediate-floor block UX: replace toast error with modal warning dialog (confirm pattern, single "Εντάξει" intent) — forces user acknowledgment per enterprise UX standards |
