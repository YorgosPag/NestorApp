# SPEC-245B1: High-Priority Consumer Migration — Buildings, Spaces, Projects, Files, Floorplans

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-245 (API Routes Centralization) |
| **Phase** | B1 (High-Priority Consumer Migration) |
| **Scope** | Buildings, Floors, Units, Parking, Storages, Projects, Files, Floorplans, Contacts |
| **Date** | 2026-03-19 |
| **Estimated Files** | ~30 τροποποιήσεις + 1 αφαίρεση duplicate registry |
| **Estimated Instances** | ~55 hardcoded paths → `API_ROUTES` |
| **Status** | ✅ **COMPLETE** (2026-03-19) |
| **Actual Changes** | 6 αρχεία χρειάστηκαν αλλαγές, ~50 ήταν ήδη migrated από Phase A |

---

## 1. Στόχος

Αντικατάσταση **ΟΛΩΝ** των hardcoded `/api/…` strings σε client-side αρχεία (hooks, components, services, features) με αντίστοιχα entries από `API_ROUTES` στο `src/config/domain-constants.ts`.

**Εκτός scope**: Server-side `route.ts` (αυτά ορίζουν τα endpoints, δεν τα καλούν), middleware config, comments/docs, test files.

---

## 2. Προαπαιτούμενα

Δεν χρειάζονται νέα `API_ROUTES` entries — **ΟΛΑ υπάρχουν ήδη** από τη Φάση A.

Υπάρχοντα entries που χρησιμοποιούνται σε αυτό το SPEC:

| API_ROUTES Path | Value |
|-----------------|-------|
| `API_ROUTES.BUILDINGS.LIST` | `'/api/buildings'` |
| `API_ROUTES.BUILDINGS.BY_ID(id)` | `` `/api/buildings/${id}` `` |
| `API_ROUTES.BUILDINGS.CONSTRUCTION_PHASES(id)` | `` `/api/buildings/${id}/construction-phases` `` |
| `API_ROUTES.BUILDINGS.MILESTONES(id)` | `` `/api/buildings/${id}/milestones` `` |
| `API_ROUTES.FLOORS.LIST` | `'/api/floors'` |
| `API_ROUTES.FLOORS.BY_ID(id)` | `` `/api/floors/${id}` `` |
| `API_ROUTES.UNITS.LIST` | `'/api/units'` |
| `API_ROUTES.UNITS.CREATE` | `'/api/units/create'` |
| `API_ROUTES.UNITS.BY_ID(id)` | `` `/api/units/${id}` `` |
| `API_ROUTES.UNITS.ADMIN_LINK` | `'/api/units/admin-link'` |
| `API_ROUTES.UNITS.HIERARCHY(id)` | `` `/api/units/${id}/hierarchy` `` |
| `API_ROUTES.UNITS.ACTIVITY(id)` | `` `/api/units/${id}/activity` `` |
| `API_ROUTES.UNITS.PAYMENT_PLAN(id)` | `` `/api/units/${id}/payment-plan` `` |
| `API_ROUTES.UNITS.PAYMENTS(id)` | `` `/api/units/${id}/payments` `` |
| `API_ROUTES.UNITS.INSTALLMENTS(id)` | `` `/api/units/${id}/payment-plan/installments` `` |
| `API_ROUTES.UNITS.LOAN(id)` | `` `/api/units/${id}/payment-plan/loan` `` |
| `API_ROUTES.UNITS.LOANS(id)` | `` `/api/units/${id}/payment-plan/loans` `` |
| `API_ROUTES.UNITS.CHEQUES(id)` | `` `/api/units/${id}/cheques` `` |
| `API_ROUTES.PARKING.LIST` | `'/api/parking'` |
| `API_ROUTES.PARKING.BY_ID(id)` | `` `/api/parking/${id}` `` |
| `API_ROUTES.STORAGES.LIST` | `'/api/storages'` |
| `API_ROUTES.STORAGES.BY_ID(id)` | `` `/api/storages/${id}` `` |
| `API_ROUTES.PROJECTS.LIST` | `'/api/projects/list'` |
| `API_ROUTES.PROJECTS.BY_ID(id)` | `` `/api/projects/${id}` `` |
| `API_ROUTES.PROJECTS.BY_COMPANY(id)` | `` `/api/projects/by-company/${id}` `` |
| `API_ROUTES.PROJECTS.CUSTOMERS(id)` | `` `/api/projects/${id}/customers` `` |
| `API_ROUTES.PROJECTS.STRUCTURE(id)` | `` `/api/projects/structure/${id}` `` |
| `API_ROUTES.FILES.CLASSIFY` | `'/api/files/classify'` |
| `API_ROUTES.FILES.BATCH_DOWNLOAD` | `'/api/files/batch-download'` |
| `API_ROUTES.FILES.ARCHIVE` | `'/api/files/archive'` |
| `API_ROUTES.DOWNLOAD` | `'/api/download'` |
| `API_ROUTES.FLOORPLANS.PROCESS` | `'/api/floorplans/process'` |
| `API_ROUTES.FLOORPLANS.SCENE(fileId)` | `` `/api/floorplans/scene?fileId=${fileId}` `` |
| `API_ROUTES.CONTACTS.BY_ID(id)` | `` `/api/contacts/${id}` `` |
| `API_ROUTES.ACCOUNTING.INVOICES.LIST` | `'/api/accounting/invoices'` |

---

## 3. File-by-File Migration Table

### 3.1 Buildings Domain

#### `src/components/building-management/building-services.ts`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 63 | `'/api/buildings'` | `API_ROUTES.BUILDINGS.LIST` | PATCH |
| 134 | `'/api/buildings'` | `API_ROUTES.BUILDINGS.LIST` | POST |
| 177 | `` `/api/buildings/${buildingId}` `` | `API_ROUTES.BUILDINGS.BY_ID(buildingId)` | DELETE |
| 285 | `` `/api/projects/${projectId}` `` | `API_ROUTES.PROJECTS.BY_ID(projectId)` | GET |
| 351 | `'/api/buildings'` | `API_ROUTES.BUILDINGS.LIST` | GET |

#### `src/components/building-management/construction-services.ts`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 61 | `` `/api/buildings/${buildingId}/construction-phases` `` | `API_ROUTES.BUILDINGS.CONSTRUCTION_PHASES(buildingId)` | POST |
| 82 | `` `/api/buildings/${buildingId}/construction-phases` `` | `API_ROUTES.BUILDINGS.CONSTRUCTION_PHASES(buildingId)` | PATCH |
| 105 | `` `/api/buildings/${buildingId}/construction-phases` `` | `API_ROUTES.BUILDINGS.CONSTRUCTION_PHASES(buildingId)` | PATCH |
| 127 | `` `/api/buildings/${buildingId}/construction-phases?type=phase&id=…` `` | `${API_ROUTES.BUILDINGS.CONSTRUCTION_PHASES(buildingId)}?type=phase&id=…` | DELETE |
| 148 | `` `/api/buildings/${buildingId}/construction-phases` `` | `API_ROUTES.BUILDINGS.CONSTRUCTION_PHASES(buildingId)` | POST |
| 171 | `` `/api/buildings/${buildingId}/construction-phases` `` | `API_ROUTES.BUILDINGS.CONSTRUCTION_PHASES(buildingId)` | PATCH |
| 193 | `` `/api/buildings/${buildingId}/construction-phases?type=task&id=…` `` | `${API_ROUTES.BUILDINGS.CONSTRUCTION_PHASES(buildingId)}?type=task&id=…` | DELETE |

#### `src/hooks/useFirestoreBuildings.ts`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 42 | `'/api/buildings'` | `API_ROUTES.BUILDINGS.LIST` | GET |

#### `src/components/navigation/core/services/navigationApi.ts`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 106 | `` `/api/projects/by-company/${companyId}` `` | `API_ROUTES.PROJECTS.BY_COMPANY(companyId)` | GET |
| 150 | `` `/api/buildings?projectId=${projectId}` `` | `` `${API_ROUTES.BUILDINGS.LIST}?projectId=${projectId}` `` | GET |
| 187 | `` `/api/floors?buildingId=${buildingId}` `` | `` `${API_ROUTES.FLOORS.LIST}?buildingId=${buildingId}` `` | GET |
| 222 | `` `/api/units?floorId=${floorId}&buildingId=${buildingId}` `` | `` `${API_ROUTES.UNITS.LIST}?floorId=${floorId}&buildingId=${buildingId}` `` | GET |
| 257 | `` `/api/units?buildingId=${buildingId}` `` | `` `${API_ROUTES.UNITS.LIST}?buildingId=${buildingId}` `` | GET |

#### `src/components/projects/ProjectTimelineTab.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 62 | `` `/api/buildings?projectId=${project.id}` `` | `` `${API_ROUTES.BUILDINGS.LIST}?projectId=${project.id}` `` | GET |

#### `src/components/projects/tabs/ProjectMeasurementsTab.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 112 | `` `/api/buildings?projectId=${project.id}` `` | `` `${API_ROUTES.BUILDINGS.LIST}?projectId=${project.id}` `` | GET |

#### `src/components/shared/files/LinkToBuildingModal.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 106 | `` `/api/buildings?projectId=${encodeURIComponent(projectId)}` `` | `` `${API_ROUTES.BUILDINGS.LIST}?projectId=${encodeURIComponent(projectId)}` `` | GET |

#### `src/features/property-details/components/BuildingSelectorCard.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 149 | `'/api/buildings'` | `API_ROUTES.BUILDINGS.LIST` | GET |
| 206 | `` `/api/floors?buildingId=${draftBuildingId}` `` | `` `${API_ROUTES.FLOORS.LIST}?buildingId=${draftBuildingId}` `` | GET |

#### `src/features/floorplan-import/hooks/useFloorplanImportState.ts`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 298 | `` `/api/projects/by-company/${selection.companyId}` `` | `API_ROUTES.PROJECTS.BY_COMPANY(selection.companyId)` | GET |
| 328 | `` `/api/buildings?projectId=${selection.projectId}` `` | `` `${API_ROUTES.BUILDINGS.LIST}?projectId=${selection.projectId}` `` | GET |
| 358 | `` `/api/floors?buildingId=${selection.buildingId}` `` | `` `${API_ROUTES.FLOORS.LIST}?buildingId=${selection.buildingId}` `` | GET |

#### `src/app/obligations/[id]/edit/page.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 156 | `` `/api/buildings${query}` `` | `` `${API_ROUTES.BUILDINGS.LIST}${query}` `` | GET |
| 162 | `'/api/buildings'` | `API_ROUTES.BUILDINGS.LIST` | GET |

#### `src/subapps/dxf-viewer/components/SimpleProjectDialog.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 201 | `` `/api/buildings?projectId=${projectId}${companyParam}` `` | `` `${API_ROUTES.BUILDINGS.LIST}?projectId=${projectId}${companyParam}` `` | GET |
| 334 | `` `/api/floors?buildingId=${buildingId}` `` | `` `${API_ROUTES.FLOORS.LIST}?buildingId=${buildingId}` `` | GET |
| 365 | `` `/api/units?${queryString}` `` | `` `${API_ROUTES.UNITS.LIST}?${queryString}` `` | GET |
| 488 | `` `/api/units/${selectedUnitId}/activity` `` | `API_ROUTES.UNITS.ACTIVITY(selectedUnitId)` | POST |

#### `src/subapps/dxf-viewer/contexts/ProjectHierarchyContext.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 257 | `` `/api/projects/by-company/${companyId}` `` | `API_ROUTES.PROJECTS.BY_COMPANY(companyId)` | GET |

#### `src/services/milestone-service.ts`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 40 | `` `/api/buildings/${buildingId}/milestones` `` | `API_ROUTES.BUILDINGS.MILESTONES(buildingId)` | POST |
| 57 | `` `/api/buildings/${buildingId}/milestones` `` | `API_ROUTES.BUILDINGS.MILESTONES(buildingId)` | PATCH |
| 79 | `` `/api/buildings/${buildingId}/milestones` `` | `API_ROUTES.BUILDINGS.MILESTONES(buildingId)` | PATCH |
| 100 | `` `/api/buildings/${buildingId}/milestones?id=…` `` | `` `${API_ROUTES.BUILDINGS.MILESTONES(buildingId)}?id=…` `` | DELETE |

---

### 3.2 Floors Domain

#### `src/components/shared/FloorSelectField.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 99 | `` `/api/floors?buildingId=${bId}` `` | `` `${API_ROUTES.FLOORS.LIST}?buildingId=${bId}` `` | GET |

#### `src/components/building-management/tabs/UnitsTabContent.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 171 | `` `/api/floors?buildingId=${building.id}` `` | `` `${API_ROUTES.FLOORS.LIST}?buildingId=${building.id}` `` | GET |

---

### 3.3 Units Domain

#### `src/services/units.service.ts`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 80 | `'/api/units/create'` | `API_ROUTES.UNITS.CREATE` | POST |
| 168 | `` `/api/units/${unitId}` `` | `API_ROUTES.UNITS.BY_ID(unitId)` | PATCH |
| 218 | `` `/api/units/${unitId}` `` | `API_ROUTES.UNITS.BY_ID(unitId)` | DELETE |
| 328 | `` `/api/units/${unitId}` `` | `API_ROUTES.UNITS.BY_ID(unitId)` | PATCH |

#### `src/components/building-management/tabs/UnitsTabContent.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 187 | `` `/api/units?buildingId=${building.id}` `` | `` `${API_ROUTES.UNITS.LIST}?buildingId=${building.id}` `` | GET |
| 323 | `` `/api/units/${editingId}` `` | `API_ROUTES.UNITS.BY_ID(editingId)` | PATCH |
| 365 | `` `/api/units/${item.id}` `` | `API_ROUTES.UNITS.BY_ID(item.id)` | DELETE |
| 369 | `` `/api/units/${item.id}` `` | `API_ROUTES.UNITS.BY_ID(item.id)` | PATCH |
| 389 | `'/api/units'` | `API_ROUTES.UNITS.LIST` | GET |
| 401 | `` `/api/units/${itemId}` `` | `API_ROUTES.UNITS.BY_ID(itemId)` | PATCH |

#### `src/hooks/useFirestoreUnits.ts`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 61 | `` `/api/units?${queryString}` `` or `'/api/units'` | `` `${API_ROUTES.UNITS.LIST}?${queryString}` `` or `API_ROUTES.UNITS.LIST` | GET |

#### `src/components/admin/SoldUnitsPreview.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 66 | `'/api/units'` | `API_ROUTES.UNITS.LIST` | GET |

#### `src/components/admin/LinkSoldUnitsToCustomers.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 46 | `'/api/units/admin-link'` | `API_ROUTES.UNITS.ADMIN_LINK` | POST |

#### `src/components/sales/cards/UnitHierarchyCard.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 51 | `` `/api/units/${encodeURIComponent(unitId)}/hierarchy` `` | `API_ROUTES.UNITS.HIERARCHY(encodeURIComponent(unitId))` | GET |

#### `src/app/units/page.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 214 | `` `/api/units/${encodeURIComponent(selectedUnit!.id)}/hierarchy` `` | `API_ROUTES.UNITS.HIERARCHY(encodeURIComponent(selectedUnit!.id))` | GET |

#### `src/components/sales/dialogs/SalesActionDialogs.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 126 | `` `/api/units/${unit.id}` `` | `API_ROUTES.UNITS.BY_ID(unit.id)` | PATCH |
| 273 | `` `/api/units/${unit.id}` `` | `API_ROUTES.UNITS.BY_ID(unit.id)` | PATCH |
| 575 | `` `/api/units/${unit.id}` `` | `API_ROUTES.UNITS.BY_ID(unit.id)` | PATCH |
| 900 | `` `/api/units/${unit.id}` `` | `API_ROUTES.UNITS.BY_ID(unit.id)` | PATCH |

#### `src/components/sales/legal/ProfessionalsCard.tsx` ⚠️ **fetch → apiClient**

| Line | Before | After | HTTP | Note |
|------|--------|-------|------|------|
| 212 | `fetch(\`/api/units/${unitId}/activity\`, …)` | `apiClient.post(API_ROUTES.UNITS.ACTIVITY(unitId), …)` | POST | **Migrate fetch→apiClient** |
| 312 | `fetch(\`/api/units/${unitId}/activity\`, …)` | `apiClient.post(API_ROUTES.UNITS.ACTIVITY(unitId), …)` | POST | **Migrate fetch→apiClient** |

#### `src/features/property-details/components/LinkedSpacesCard.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 236 | `` `/api/units/${unitId}` `` | `API_ROUTES.UNITS.BY_ID(unitId)` | PATCH |

#### `src/hooks/usePaymentPlan.ts` ⚠️ **fetchJson → apiClient (ιδανικά)**

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 81 | `` `/api/units/${unitId}/payment-plan` `` | `API_ROUTES.UNITS.PAYMENT_PLAN(unitId)` | GET |
| 84 | `` `/api/units/${unitId}/payments` `` | `API_ROUTES.UNITS.PAYMENTS(unitId)` | GET |
| 107 | `` `/api/units/${unitId}/payment-plan` `` | `API_ROUTES.UNITS.PAYMENT_PLAN(unitId)` | POST |
| 129 | `` `/api/units/${unitId}/payment-plan` `` | `API_ROUTES.UNITS.PAYMENT_PLAN(unitId)` | PATCH |
| 151 | `` `/api/units/${unitId}/payments` `` | `API_ROUTES.UNITS.PAYMENTS(unitId)` | POST |
| 173 | `` `/api/units/${unitId}/payment-plan/installments` `` | `API_ROUTES.UNITS.INSTALLMENTS(unitId)` | POST |
| 195 | `` `/api/units/${unitId}/payment-plan/installments` `` | `API_ROUTES.UNITS.INSTALLMENTS(unitId)` | PATCH |
| 217 | `` `/api/units/${unitId}/payment-plan/installments` `` | `API_ROUTES.UNITS.INSTALLMENTS(unitId)` | DELETE |
| 239 | `` `/api/units/${unitId}/payment-plan/loan` `` | `API_ROUTES.UNITS.LOAN(unitId)` | PATCH |
| 259 | `` `/api/units/${unitId}/payment-plan?planId=…` `` | `` `${API_ROUTES.UNITS.PAYMENT_PLAN(unitId)}?planId=…` `` | DELETE |

#### `src/hooks/useChequeRegistry.ts` ⚠️ **fetch → apiClient (ιδανικά)**

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 68 | `` `/api/units/${unitId}/cheques` `` | `API_ROUTES.UNITS.CHEQUES(unitId)` | GET |

#### `src/hooks/useLoanTracking.ts` ⚠️ **fetch → apiClient (ιδανικά)**

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 69 | `` `/api/units/${unitId}/payment-plan/loans` `` | `API_ROUTES.UNITS.LOANS(unitId)` | GET |

---

### 3.4 Parking Domain

#### `src/hooks/useFirestoreParkingSpots.ts`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 71 | `` `/api/parking?${params.toString()}` `` or `'/api/parking'` | `` `${API_ROUTES.PARKING.LIST}?${params.toString()}` `` or `API_ROUTES.PARKING.LIST` | GET |

#### `src/components/space-management/ParkingPage/AddParkingDialog.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 143 | `'/api/parking'` | `API_ROUTES.PARKING.LIST` | POST |

#### `src/components/space-management/ParkingPage/ParkingDetails/tabs/ParkingGeneralTab.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 185 | `'/api/parking'` | `API_ROUTES.PARKING.LIST` | POST |
| 223 | `` `/api/parking/${parking.id}` `` | `API_ROUTES.PARKING.BY_ID(parking.id)` | PATCH |

#### `src/components/building-management/tabs/ParkingTabContent.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 350 | `` `/api/parking/${itemId}` `` | `API_ROUTES.PARKING.BY_ID(itemId)` | PATCH |

#### `src/features/property-details/components/LinkedSpacesCard.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 156 | `` `/api/parking?buildingId=${buildingId}` `` | `` `${API_ROUTES.PARKING.LIST}?buildingId=${buildingId}` `` | GET |

#### `src/app/spaces/parking/page.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 155 | `` `/api/parking/${selectedParking.id}` `` | `API_ROUTES.PARKING.BY_ID(selectedParking.id)` | DELETE |

#### `src/hooks/sales/useLinkedSpacesForSale.ts`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 100 | `` `/api/parking/${ls.spaceId}` `` | `API_ROUTES.PARKING.BY_ID(ls.spaceId)` | GET |

---

### 3.5 Storages Domain

#### `src/hooks/useFirestoreStorages.ts`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 57 | `` `/api/storages?buildingId=${encodeURIComponent(buildingId)}` `` | `` `${API_ROUTES.STORAGES.LIST}?buildingId=${encodeURIComponent(buildingId)}` `` | GET |
| 58 | `'/api/storages'` | `API_ROUTES.STORAGES.LIST` | GET |

#### `src/components/space-management/StoragesPage/AddStorageDialog.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 123 | `'/api/storages'` | `API_ROUTES.STORAGES.LIST` | POST |

#### `src/components/space-management/StoragesPage/StorageDetails/tabs/StorageGeneralTab.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 191 | `'/api/storages'` | `API_ROUTES.STORAGES.LIST` | POST |
| 229 | `` `/api/storages/${storage.id}` `` | `API_ROUTES.STORAGES.BY_ID(storage.id)` | PATCH |

#### `src/components/building-management/StorageTab/index.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 93 | `` `/api/storages?buildingId=${building.id}` `` | `` `${API_ROUTES.STORAGES.LIST}?buildingId=${building.id}` `` | GET |
| 117 | `'/api/storages'` | `API_ROUTES.STORAGES.LIST` | POST |
| 162 | `` `/api/storages/${editingId}` `` | `API_ROUTES.STORAGES.BY_ID(editingId)` | PATCH |
| 195 | `` `/api/storages/${storage.id}` `` | `API_ROUTES.STORAGES.BY_ID(storage.id)` | DELETE |

#### `src/components/building-management/StorageTab.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 155 | `` `/api/storages?buildingId=${building.id}` `` | `` `${API_ROUTES.STORAGES.LIST}?buildingId=${building.id}` `` | GET |
| 219 | `'/api/storages'` | `API_ROUTES.STORAGES.LIST` | POST |
| 266 | `` `/api/storages/${editingId}` `` | `API_ROUTES.STORAGES.BY_ID(editingId)` | PATCH |
| 302 | `` `/api/storages/${confirmDelete.id}` `` | `API_ROUTES.STORAGES.BY_ID(confirmDelete.id)` | DELETE |
| 330 | `` `/api/storages/${confirmUnlink.id}` `` | `API_ROUTES.STORAGES.BY_ID(confirmUnlink.id)` | PATCH |
| 358 | `'/api/storages'` | `API_ROUTES.STORAGES.LIST` | GET |

#### `src/features/property-details/components/LinkedSpacesCard.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 193 | `` `/api/storages?buildingId=${buildingId}` `` | `` `${API_ROUTES.STORAGES.LIST}?buildingId=${buildingId}` `` | GET |

#### `src/app/spaces/storage/page.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 108 | `` `/api/storages/${selectedStorage.id}` `` | `API_ROUTES.STORAGES.BY_ID(selectedStorage.id)` | DELETE |

#### `src/hooks/sales/useLinkedSpacesForSale.ts`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 101 | `` `/api/storages/${ls.spaceId}` `` | `API_ROUTES.STORAGES.BY_ID(ls.spaceId)` | GET |

---

### 3.6 Projects Domain

#### `src/services/projects-client.service.ts`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 91 | `'/api/projects/list'` | `API_ROUTES.PROJECTS.LIST` | POST |
| 136 | `` `/api/projects/${projectId}` `` | `API_ROUTES.PROJECTS.BY_ID(projectId)` | PATCH |
| 181 | `` `/api/projects/${projectId}` `` | `API_ROUTES.PROJECTS.BY_ID(projectId)` | DELETE |

#### `src/hooks/useFirestoreProjects.ts`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 157 | `'/api/projects/list'` | `API_ROUTES.PROJECTS.LIST` | GET |

#### `src/app/obligations/new/page.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 265 | `'/api/projects/list'` | `API_ROUTES.PROJECTS.LIST` | GET |

#### `src/app/admin/role-management/components/ProjectMembersTab.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 93 | `'/api/projects/list'` | `API_ROUTES.PROJECTS.LIST` | GET |

#### `src/components/projects/customers-tab/hooks/useProjectCustomers.ts`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 72 | `` `/api/projects/${projectId}/customers` `` | `API_ROUTES.PROJECTS.CUSTOMERS(projectId)` | GET |

#### `src/components/projects/structure-tab/hooks/useProjectStructure.ts`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 74 | `` `/api/projects/structure/${projectId}` `` | `API_ROUTES.PROJECTS.STRUCTURE(projectId)` | GET |

---

### 3.7 Files & Floorplans Domain

#### `src/components/shared/files/EntityFilesManager.tsx` ⚠️ **fetch → apiClient**

| Line | Before | After | HTTP | Note |
|------|--------|-------|------|------|
| 321 | `fetch('/api/floorplans/process', …)` | `fetch(API_ROUTES.FLOORPLANS.PROCESS, …)` | POST | **fetch** (multipart upload — keep fetch) |
| 558 | `fetch('/api/files/classify', …)` | `fetch(API_ROUTES.FILES.CLASSIFY, …)` | POST | **fetch** (streaming) |
| 769 | `` `/api/download?url=…&filename=…` `` | `` `${API_ROUTES.DOWNLOAD}?url=…&filename=…` `` | — | URL construction |

#### `src/components/shared/files/media/FloorplanGallery.tsx` ⚠️ **fetch**

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 718 | `` fetch(\`/api/floorplans/scene?fileId=${currentFile.id}\`, …) `` | `fetch(API_ROUTES.FLOORPLANS.SCENE(currentFile.id), …)` | GET |

#### `src/components/shared/files/hooks/useFileClassification.ts` ⚠️ **fetch**

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 71 | `fetch('/api/files/classify', …)` | `fetch(API_ROUTES.FILES.CLASSIFY, …)` | POST |

#### `src/components/shared/files/hooks/useBatchFileOperations.ts` ⚠️ **fetch**

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 106 | `fetch('/api/files/batch-download', …)` | `fetch(API_ROUTES.FILES.BATCH_DOWNLOAD, …)` | POST |
| 152 | `fetch('/api/files/archive', …)` | `fetch(API_ROUTES.FILES.ARCHIVE, …)` | POST |

#### `src/components/shared/files/hooks/usePdfThumbnail.ts`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 137 | `` `/api/download?url=…&filename=thumb.pdf` `` | `` `${API_ROUTES.DOWNLOAD}?url=…&filename=thumb.pdf` `` | — |

#### `src/components/file-manager/FileManagerPageContent.tsx` ⚠️ **fetch**

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 541 | `fetch('/api/files/batch-download', …)` | `fetch(API_ROUTES.FILES.BATCH_DOWNLOAD, …)` | POST |
| 585 | `fetch('/api/files/archive', …)` | `fetch(API_ROUTES.FILES.ARCHIVE, …)` | POST |
| 659 | `fetch('/api/files/classify', …)` | `fetch(API_ROUTES.FILES.CLASSIFY, …)` | POST |

#### `src/components/file-manager/PdfCanvasViewer.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 146 | `` `/api/download?url=…&filename=preview.pdf` `` | `` `${API_ROUTES.DOWNLOAD}?url=…&filename=preview.pdf` `` | — |

---

### 3.8 Contacts Domain

#### `src/components/units/tabs/hooks/useOptimizedCustomerInfo.ts`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 124 | `` `/api/contacts/${id}` `` | `API_ROUTES.CONTACTS.BY_ID(id)` | GET |

#### `src/components/sales/tabs/SaleInfoContent.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 98 | `` `/api/contacts/${encodeURIComponent(contactId)}` `` | `API_ROUTES.CONTACTS.BY_ID(encodeURIComponent(contactId))` | GET |

#### `src/components/sales/cards/SalesUnitListCard.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 167 | `` `/api/contacts/${encodeURIComponent(contactId)}` `` | `API_ROUTES.CONTACTS.BY_ID(encodeURIComponent(contactId))` | GET |

---

### 3.9 Accounting (cross-reference from sales)

#### `src/components/sales/cards/TransactionChainCard.tsx`

| Line | Before | After | HTTP |
|------|--------|-------|------|
| 90 | `` `/api/accounting/invoices?unitId=${encodeURIComponent(unitId)}` `` | `` `${API_ROUTES.ACCOUNTING.INVOICES.LIST}?unitId=${encodeURIComponent(unitId)}` `` | GET |

---

## 4. Duplicate Registry: `ENTITY_API_ENDPOINTS`

### Τι είναι

`src/services/entity-linking/config.ts:86-92` ορίζει `ENTITY_API_ENDPOINTS` — ένα **duplicate** του `API_ROUTES` για 5 entity types.

```typescript
// ❌ DUPLICATE — πρέπει να αφαιρεθεί
export const ENTITY_API_ENDPOINTS: Record<EntityType, string> = {
  company: '/api/companies',
  project: '/api/projects',
  building: '/api/buildings',
  unit: '/api/units',
  floor: '/api/floors',
} as const;
```

### Migration

```typescript
// ✅ ΑΝΤΙΚΑΤΑΣΤΑΣΗ
import { API_ROUTES } from '@/config/domain-constants';

export const ENTITY_API_ENDPOINTS: Record<EntityType, string> = {
  company: API_ROUTES.COMPANIES.LIST,
  project: API_ROUTES.PROJECTS.LIST,
  building: API_ROUTES.BUILDINGS.LIST,
  unit: API_ROUTES.UNITS.LIST,
  floor: API_ROUTES.FLOORS.LIST,
} as const;
```

### Consumers

| Αρχείο | Χρήση |
|--------|-------|
| `src/services/entity-linking/EntityLinkingService.ts:396` | `ENTITY_API_ENDPOINTS[entityType]` |
| `src/services/entity-linking/index.ts:50` | Barrel export |
| `src/services/entity-linking/config.ts:161-163` | `getEntityApiEndpoint()` helper |

**Σημείωση**: Η helper function `getEntityApiEndpoint()` (line 161-163) μπορεί να αφαιρεθεί αν δεν χρησιμοποιείται εκτός `EntityLinkingService`. Εναλλακτικά, παραμένει ως convenience wrapper.

---

## 5. Σημείωση: `fetch()` vs `apiClient`

Τα ακόλουθα αρχεία χρησιμοποιούν raw `fetch()` αντί `apiClient`. Σε αυτή τη φάση αντικαθιστούμε **ΜΟΝΟ το hardcoded path** με `API_ROUTES`. Η μετάβαση `fetch→apiClient` είναι ξεχωριστό refactoring.

| Αρχείο | Λόγος fetch |
|--------|-------------|
| `EntityFilesManager.tsx` | Multipart upload + streaming |
| `FloorplanGallery.tsx` | Auth header manual |
| `useFileClassification.ts` | Auth header manual |
| `useBatchFileOperations.ts` | Blob response (download) |
| `FileManagerPageContent.tsx` | Blob response + streaming |
| `ProfessionalsCard.tsx` | Fire-and-forget activity log |
| `usePaymentPlan.ts` | Uses custom `fetchJson` wrapper |
| `useChequeRegistry.ts` | SWR + fetch |
| `useLoanTracking.ts` | SWR + fetch |

---

## 6. Code Example — Before/After

### Building List with Query Params

```typescript
// ❌ BEFORE
const result = await apiClient.get<BuildingsApiResponse>(
  `/api/buildings?projectId=${projectId}`
);

// ✅ AFTER
import { API_ROUTES } from '@/config/domain-constants';

const result = await apiClient.get<BuildingsApiResponse>(
  `${API_ROUTES.BUILDINGS.LIST}?projectId=${projectId}`
);
```

### Dynamic ID

```typescript
// ❌ BEFORE
await apiClient.patch(`/api/units/${unitId}`, updates);

// ✅ AFTER
await apiClient.patch(API_ROUTES.UNITS.BY_ID(unitId), updates);
```

### Fetch with auth header

```typescript
// ❌ BEFORE
const response = await fetch('/api/files/classify', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});

// ✅ AFTER (path only — fetch stays)
const response = await fetch(API_ROUTES.FILES.CLASSIFY, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});
```

---

## 7. Migration Checklist

- [x] **Import**: Κάθε αρχείο πρέπει να προσθέσει `import { API_ROUTES } from '@/config/domain-constants';`
- [x] **Buildings** (11 αρχεία): building-services, construction-services, useFirestoreBuildings, navigationApi, ProjectTimelineTab, ProjectMeasurementsTab, LinkToBuildingModal, BuildingSelectorCard, useFloorplanImportState, obligations/edit, SimpleProjectDialog
- [x] **Floors** (7 αρχεία): FloorSelectField, UnitsTabContent, navigationApi, BuildingSelectorCard, useFloorplanImportState, SimpleProjectDialog (ΗΔΗ στο Buildings list)
- [x] **Units** (15 αρχεία): units.service, UnitsTabContent, useFirestoreUnits, SoldUnitsPreview, LinkSoldUnitsToCustomers, UnitHierarchyCard, units/page, SalesActionDialogs, ProfessionalsCard, LinkedSpacesCard, usePaymentPlan, useChequeRegistry, useLoanTracking, SimpleProjectDialog
- [x] **Parking** (7 αρχεία): useFirestoreParkingSpots, AddParkingDialog, ParkingGeneralTab, ParkingTabContent, LinkedSpacesCard, spaces/parking/page, useLinkedSpacesForSale
- [x] **Storages** (9 αρχεία): useFirestoreStorages, AddStorageDialog, StorageGeneralTab, StorageTab/index, StorageTab, LinkedSpacesCard, spaces/storage/page, useLinkedSpacesForSale
- [x] **Projects** (8 αρχεία): projects-client.service, useFirestoreProjects, obligations/new/page, ProjectMembersTab, useProjectCustomers, useProjectStructure, navigationApi, useFloorplanImportState, ProjectHierarchyContext
- [x] **Files & Floorplans** (7 αρχεία): EntityFilesManager, FloorplanGallery, useFileClassification, useBatchFileOperations, FileManagerPageContent, PdfCanvasViewer, usePdfThumbnail
- [x] **Contacts** (3 αρχεία): useOptimizedCustomerInfo, SaleInfoContent, SalesUnitListCard
- [x] **Accounting cross-ref** (1 αρχείο): TransactionChainCard
- [x] **Duplicate registry** (1 αρχείο): entity-linking/config.ts
- [x] **Milestones** (1 αρχείο): milestone-service.ts
- [x] **TypeScript compile check**: `npx tsc --noEmit` (background)

---

## 8. Στατιστικά Σύνοψη

| Μετρική | Τιμή |
|---------|------|
| Αρχεία προς τροποποίηση | **~35** (μερικά εμφανίζονται σε πολλά domains) |
| Hardcoded instances προς αντικατάσταση | **~105** |
| Νέα API_ROUTES entries | **0** (ΟΛΑ υπάρχουν ήδη) |
| Αρχεία με `fetch()` αντί `apiClient` | **9** (δευτερεύον — path migration μόνο) |
| Duplicate registries προς αφαίρεση | **1** (`ENTITY_API_ENDPOINTS`) |

---

*SPEC-245B1 — Created 2026-03-19 by Claude Code (Anthropic AI)*
