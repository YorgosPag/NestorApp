# ADR-181: IFC-Compliant Floor Management System

## Status: IMPLEMENTED

## Date: 2026-02-14

## Context

After ADR-179 (floor-first import), the inline floor creation form in the DXF wizard only asked for a text name — it was missing the **level number** and **elevation**. Additionally, there was no "Floors" tab in building details — users could not view or manage floors after creation.

Per IFC 4.3 (`IfcBuildingStorey`), a storey has:
- **Name**: short identifier (e.g. "Level 01")
- **LongName**: human-readable (e.g. "Ground Floor")
- **Elevation**: elevation in metres (e.g. 0.00, +3.50, -3.00)

## Decision

1. **Enhance Floor data model** with `elevation` field (optional, in metres)
2. **Enhance DXF wizard inline form** to include number + name + elevation inputs
3. **Create new "Floors" tab** in building details for full CRUD management
4. **Add PATCH/DELETE API endpoints** for floor updates and deletion

## Changes

### A. Data Model — `elevation` field
- `src/config/firestore-schema-map.ts` — added `elevation: 'number?'`
- `src/app/api/floors/route.ts` — added `elevation` to POST, new PATCH and DELETE handlers
- `src/subapps/dxf-viewer/contexts/ProjectHierarchyContext.tsx` — added `elevation?: number` to Floor interface

### B. API Endpoints
- **POST** `/api/floors` — now accepts `elevation` (optional)
- **PATCH** `/api/floors` — new: update floor name/number/elevation
- **DELETE** `/api/floors?floorId=X` — new: delete a floor

### C. FloorsTabContent Component
- New: `src/components/building-management/tabs/FloorsTabContent.tsx`
- Features: sortable table, inline add/edit/delete, elevation display
- Uses: `apiClient`, `useTranslation('building')`, semantic HTML

### D. Tab Registration
- `src/config/unified-tabs-factory.ts` — new `floors` tab (order 2, after general)
- `src/components/generic/mappings/buildingMappings.ts` — mapped `FloorsTabContent`
- Tab label reuses existing `tabs.labels.floors` i18n key

### E. DXF Wizard Enhancement
- `src/subapps/dxf-viewer/components/SimpleProjectDialog.tsx`
- Inline form expanded from 1 input to 3: number + name + elevation
- New state: `newFloorNumber`, `newFloorElevation`

### F. i18n
- `building.json` (el/en): 15 new keys under `tabs.floors.*`
- `dxf-viewer.json` (el/en): 4 new keys under `floorplanSections.*`

## Files Changed

| File | Change |
|------|--------|
| `src/config/firestore-schema-map.ts` | +elevation field |
| `src/app/api/floors/route.ts` | +elevation, +PATCH, +DELETE |
| `src/subapps/dxf-viewer/contexts/ProjectHierarchyContext.tsx` | +elevation in Floor |
| `src/subapps/dxf-viewer/components/SimpleProjectDialog.tsx` | +number/elevation inputs |
| `src/components/building-management/tabs/FloorsTabContent.tsx` | **NEW** |
| `src/config/unified-tabs-factory.ts` | +floors tab entry |
| `src/components/generic/mappings/buildingMappings.ts` | +FloorsTabContent |
| `src/i18n/locales/el/building.json` | +floors keys |
| `src/i18n/locales/en/building.json` | +floors keys (EN) |
| `src/i18n/locales/el/dxf-viewer.json` | +number/elevation placeholders |
| `src/i18n/locales/en/dxf-viewer.json` | +number/elevation placeholders (EN) |

## Consequences

- Users can now manage floors with IFC-compliant data (level number, name, elevation)
- Building details → "Floors" tab provides full CRUD for floor records
- DXF wizard inline form captures complete floor data on creation
- Elevation data enables future 3D/BIM integrations
