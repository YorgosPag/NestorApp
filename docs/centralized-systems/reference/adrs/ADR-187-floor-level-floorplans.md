# ADR-187: Floor-Level Floorplans (IFC-Compliant)

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-02-19 |
| **Category** | Architecture / Building Management |
| **Related** | ADR-031, ADR-033, ADR-179, ADR-180 |

## Context

The application already had a floorplan tab at the **building level** (Tab #3 "Κάτοψη"),
but the IFC 4.3 standard (ISO 16739) specifies that floor plans belong to
`IfcBuildingStorey` (floor/storey), **not** to `IfcBuilding`.

Industry leaders follow this pattern:
- **Autodesk Revit**: Floor Plan views are per-Level (automatic)
- **ArchiCAD**: Floor Plan per Story
- **Procore**: Drawing Areas → Sheets per floor
- **PlanGrid**: Sheets per Discipline + Level
- **Yardi**: Floor-level with CAD overlay

The codebase already had `FloorFloorplanService` and `useFloorFloorplans` hook
implemented (ADR-179) but no UI was connected to them.

## Decision

**Floor-level floorplans are placed inside the "Floors" tab as expandable rows.**

Each floor row in the table gains an expand/collapse button. Clicking it reveals
an inline `EntityFilesManager` (`FloorFloorplanInline` component) for uploading
and viewing that specific floor's floorplan.

The existing building-level floorplan tab is renamed to **"Γενική Κάτοψη"**
("General Floor Plan") and shows an informational banner directing users to the
Floors tab for per-floor plans.

### Architecture

```
Tab "Όροφοι" (order: 2) ← PRIMARY FLOORPLAN LOCATION
│
├── Floor Table with expandable rows
│   ├── Row: "Υπόγειο" → expand → EntityFilesManager(floor, floor_id)
│   ├── Row: "Ισόγειο" → expand → EntityFilesManager(floor, floor_id)
│   └── Row: "1ος Όροφος" → expand → EntityFilesManager(floor, floor_id)
│
Tab "Γενική Κάτοψη" (order: 3) ← RENAMED
    └── Building-level overview (site plan)
    └── Info banner: "For per-floor plans → Floors tab"
```

### Storage Path

```
companies/{companyId}/entities/floor/{floorId}/domains/construction/categories/floorplans/
```

## Consequences

### Positive
- **IFC 4.3 compliant**: Follows ISO 16739 — floor plans at IfcBuildingStorey level
- **Zero navigation friction**: Users see floors + floorplans in the same tab
- **100% reuse**: Uses existing EntityFilesManager + FloorFloorplanService
- **Industry standard**: Same pattern as Revit, ArchiCAD, Procore

### Negative
- Building-level floorplan tab retains legacy data (no migration needed)
- Users must learn the new expand pattern (minimal — one click)

## Files Changed

| File | Action |
|------|--------|
| `src/components/building-management/tabs/FloorFloorplanInline.tsx` | **NEW** — Inline floorplan per floor |
| `src/components/building-management/tabs/FloorsTabContent.tsx` | **MODIFIED** — Expandable rows |
| `src/components/building-management/tabs/BuildingFloorplanTab.tsx` | **MODIFIED** — Info banner |
| `src/i18n/locales/el/building.json` | **MODIFIED** — New keys + rename |
| `src/i18n/locales/en/building.json` | **MODIFIED** — New keys + rename |

## Changelog

- **2026-02-19**: Initial implementation — expandable floor rows with inline EntityFilesManager
- **2026-02-19**: Extended expand pattern to Storage, Parking, Units tabs via centralized shared components
  - NEW: `SpaceFloorplanInline` — generic inline floorplan for storage_unit, parking_spot, unit
  - MODIFIED: `BuildingSpaceTable` — added expandedId/onToggleExpand/renderExpandedContent props
  - MODIFIED: `BuildingSpaceCardGrid` — same expand props for cards view
  - MODIFIED: `StorageTab`, `ParkingTabContent`, `UnitsTabContent` — wired expandable floorplans
  - Storage path pattern: `companies/{companyId}/entities/{entityType}/{id}/domains/construction/categories/floorplans/`
- **2026-02-19**: Added dedicated Floorplan tab to Parking detail page (sidebar → Θέσεις Στάθμευσης → select → tab "Κάτοψη Θ.Σ.")
  - NEW: `ParkingFloorplanTab` — standalone tab with EntityFilesManager for parking_spot floorplans
  - MODIFIED: `unified-tabs-factory.ts` — added parkingFloorplan tab (order: 2, icon: map)
  - MODIFIED: `parkingMappings.ts` + `mappings/index.ts` — registered ParkingFloorplanTab component
  - MODIFIED: `tabs.ts` labels — added parkingFloorplan to ParkingTabLabelsConfig
  - Bidirectional: same Firestore path as building's ParkingTabContent expandable row
