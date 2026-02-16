# ADR-184: Building Spaces Tabs (Storage, Parking, Units)

## Status
**IMPLEMENTED** (2026-02-16)

## Context
Η σελίδα κτιρίου χρειαζόταν 3 νέες καρτέλες για πλήρη διαχείριση χώρων:
- **Αποθήκες**: Υπήρχε ως stub (24 γρ.) — πλέον πλήρης CRUD
- **Θέσεις Στάθμευσης**: Νέα καρτέλα
- **Μονάδες**: Νέα καρτέλα

Κάθε καρτέλα: λίστα items φιλτραρισμένα κατά `buildingId` + inline CRUD.

## Decision
**Bidirectional Sync**: Τα ίδια Firestore collections (`storage_units`, `parking_spots`, `units`) χρησιμοποιούνται τόσο από τα building tabs όσο και από τις sidebar pages (/spaces/storage, /spaces/parking). Δεν χρειάζεται ειδικός sync mechanism.

**Pattern**: Ακολουθούμε το FloorsTabContent pattern — inline CRUD με `apiClient`, semantic HTML, i18n.

## Architecture

### API Layer
| Resource | Collection | API Endpoint | `buildingId` filter |
|----------|-----------|--------------|---------------------|
| Storage | `storage_units` | `GET /api/storages` | `?buildingId=xxx` (ADR-184) |
| Parking | `parking_spots` | `GET /api/parking` | `?buildingId=xxx` (existing) |
| Units | `units` | `GET /api/units` | `?buildingId=xxx` (existing) |

### Hooks
| Hook | File | `buildingId` support |
|------|------|---------------------|
| `useFirestoreStorages` | `src/hooks/useFirestoreStorages.ts` | Added (ADR-184) |
| `useFirestoreParkingSpots` | `src/hooks/useFirestoreParkingSpots.ts` | Existing |
| `useFirestoreUnits` | `src/hooks/useFirestoreUnits.ts` | New (ADR-184) |

### Tab Components
| Tab | Component | File |
|-----|-----------|------|
| Αποθήκες | `StorageTab` | `src/components/building-management/StorageTab/index.tsx` |
| Θ. Στάθμευσης | `ParkingTabContent` | `src/components/building-management/tabs/ParkingTabContent.tsx` |
| Μονάδες | `UnitsTabContent` | `src/components/building-management/tabs/UnitsTabContent.tsx` |

### Tab Factory Integration
- `unified-tabs-factory.ts`: 2 νέα tabs (parking order:7, units order:8)
- `buildingMappings.ts`: 2 νέα component registrations
- i18n labels: Ήδη υπήρχαν (`tabs.labels.parking`, `tabs.labels.units`)

## Files Changed
| File | Action |
|------|--------|
| `src/app/api/storages/route.ts` | MODIFIED — Added `buildingId` filter |
| `src/hooks/useFirestoreStorages.ts` | REWRITTEN — Added `buildingId` param, `useBuildingStorages()` |
| `src/hooks/useFirestoreUnits.ts` | NEW — Matching parking hook pattern |
| `src/components/building-management/StorageTab/index.tsx` | REWRITTEN — Full CRUD implementation |
| `src/components/building-management/tabs/ParkingTabContent.tsx` | NEW — Full CRUD |
| `src/components/building-management/tabs/UnitsTabContent.tsx` | NEW — Full CRUD |
| `src/config/unified-tabs-factory.ts` | MODIFIED — Added parking + units tabs |
| `src/components/generic/mappings/buildingMappings.ts` | MODIFIED — Registered new components |
| `src/subapps/dxf-viewer/config/modal-select/core/labels/tabs.ts` | MODIFIED — Added `parking` to BuildingTabLabelsConfig |

## Consequences
- Building detail pages now have 14 tabs (was 12)
- Storage/Parking/Units data created from building tabs appears automatically in sidebar pages
- No new npm packages required
