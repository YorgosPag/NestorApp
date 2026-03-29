# SPEC-013: Πλήρης Χαρτογράφηση — Κτίρια (Buildings)

**ADR**: 268 — Dynamic Report Builder
**Version**: 1.0
**Last Updated**: 2026-03-29
**Source of Truth**: Κώδικας (`src/types/building/contracts.ts`, `src/types/building/construction.ts`, `src/types/building/features.ts`, `src/types/building/milestone.ts`, `src/types/boq/boq.ts`)

---

## 1. Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `buildings` |
| **TypeScript** | `Building` (from `src/types/building/contracts.ts`) |
| **ID Pattern** | Enterprise ID: `bld_XXXXX` (`enterprise-id.service.ts`) |
| **Tenant Isolation** | `companyId` (ADR-029) |
| **Tabs Config** | `src/config/unified-tabs-factory.ts` (case: 'building', 16 tabs) |
| **Deletion Strategy** | `BLOCK` — δεν διαγράφεται αν έχει units/phases (deletion-registry.ts) |
| **Firestore Field Constant** | `BUILDING_ID: 'buildingId'` (firestore-field-constants.ts) |

---

## 2. Πλήρης Κατάλογος Πεδίων

### 2.1 Κύρια Πεδία (Building Interface)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Enterprise ID (`bld_XXXXX`) |
| 2 | `name` | string | Yes | Όνομα κτιρίου (π.χ. "Κτίριο Α") |
| 3 | `projectId` | string | Yes | FK → `projects` collection |
| 4 | `description` | string | No | Περιγραφή κτιρίου |
| 5 | `status` | enum | Yes | `planning` / `construction` / `completed` / `active` |
| 6 | `progress` | number | Yes | Πρόοδος κατασκευής 0-100% |
| 7 | `totalArea` | number | Yes | Συνολικό εμβαδόν (m2) |
| 8 | `builtArea` | number | No | Δομημένο εμβαδόν (m2) |
| 9 | `floors` | number | Yes | Αριθμός ορόφων |
| 10 | `units` | number | No | Αριθμός μονάδων (legacy counter) |
| 11 | `totalUnits` | number | No | Αριθμός μονάδων (extended field) |

### 2.2 Χρονολογικά / Οικονομικά

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 12 | `startDate` | string (ISO) | No | Ημ/νία έναρξης κατασκευής |
| 13 | `completionDate` | string (ISO) | No | Ημ/νία ολοκλήρωσης |
| 14 | `totalValue` | number | No | Συνολική αξία κτιρίου (EUR) |
| 15 | `constructionYear` | number | No | Έτος κατασκευής |

### 2.3 Εταιρεία / Tenant

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 16 | `company` | string | No | Όνομα εταιρείας (legacy) |
| 17 | `companyId` | string | No | Tenant isolation ID |
| 18 | `linkedCompanyId` | string | No | FK → `contacts` (κατασκευαστής, contact ID) |
| 19 | `linkedCompanyName` | string | No | Denormalized name κατασκευαστή |
| 20 | `project` | string | No | Όνομα έργου (legacy denormalized) |

### 2.4 Ταξινόμηση / Κατηγοριοποίηση

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 21 | `category` | enum | No | `mixed` / `residential` / `commercial` / `industrial` |
| 22 | `type` | BuildingType | No | `residential` / `commercial` / `industrial` / `mixed` / `office` / `warehouse` |
| 23 | `priority` | BuildingPriority | No | `low` / `medium` / `high` / `critical` |
| 24 | `energyClass` | EnergyClass | No | `A+` / `A` / `B+` / `B` / `C` / `D` / `E` / `F` / `G` |
| 25 | `renovation` | RenovationStatus | No | `none` / `partial` / `full` / `planned` |
| 26 | `location` | string | No | Τοποθεσία (πόλη/περιοχή) για φιλτράρισμα |

### 2.5 Διευθύνσεις

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 27 | `address` | string | No | Legacy — απλή διεύθυνση |
| 28 | `city` | string | No | Legacy — πόλη |
| 29 | `addresses` | ProjectAddress[] | No | Multi-address (ADR-167, ίδιο pattern με Project) |
| 30 | `addressConfigs` | BuildingAddressReference[] | No | Address inheritance from project (ADR-167) |
| 31 | `primaryProjectAddressId` | string | No | Primary address ID from project addresses |

### 2.6 Boolean Παροχές (Amenities)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 32 | `hasParking` | boolean | No | Διαθέτει parking |
| 33 | `hasElevator` | boolean | No | Διαθέτει ανελκυστήρα |
| 34 | `hasGarden` | boolean | No | Διαθέτει κήπο/αύλειο χώρο |
| 35 | `hasPool` | boolean | No | Διαθέτει πισίνα |
| 36 | `accessibility` | boolean | No | Πρόσβαση ΑμεΑ |
| 37 | `furnished` | boolean | No | Επιπλωμένες μονάδες |

### 2.7 Features (Type-Safe Registry)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 38 | `features` | BuildingFeatureKey[] | No | Array από 36 type-safe feature keys |

### 2.8 Audit Trail

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 39 | `createdAt` | string / Date | No | Ημ/νία δημιουργίας |
| 40 | `updatedAt` | string / Date | No | Ημ/νία τελευταίας ενημέρωσης |

---

## 3. Nested Objects & Arrays

### 3.1 `addresses[]` — ProjectAddress (ADR-167)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `id` | string | Address ID |
| `street` | string | Οδός |
| `number` | string? | Αριθμός |
| `city` | string | Πόλη |
| `postalCode` | string | Τ.Κ. |
| `region` | string? | Περιφέρεια |
| `country` | string | Χώρα |
| `type` | enum | Τύπος (project/site/office/other) |
| `isPrimary` | boolean | Κύρια διεύθυνση |
| `coordinates` | `{ lat, lng }` | GPS |
| `municipality` | string? | Δήμος |
| `municipalityId` | string? | ID Δήμου |

### 3.2 `addressConfigs[]` — BuildingAddressReference

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `projectAddressId` | string | FK → project address |
| `label` | string? | Custom ετικέτα |
| `isInherited` | boolean | Κληρονομημένο από project |

### 3.3 `features[]` — BuildingFeatureKey (36 keys)

| Κατηγορία | Keys |
|-----------|------|
| **Θέρμανση & Κλίμα (5)** | `autonomousHeating`, `solarHeating`, `vrvClimate`, `smartClimate`, `warehouseClimate` |
| **Εξαερισμός (2)** | `automaticVentilation`, `naturalVentilation` |
| **Parking & Μεταφορά (6)** | `parkingSpaces`, `electricVehicleCharging`, `teslaVwCharging`, `parkingGuidanceSystem`, `carWash`, `carWashPlural` |
| **Ανελκυστήρες & Πρόσβαση (6)** | `elevator`, `escalatorsAllFloors`, `disabilityAccess`, `loadingAccess`, `loadingRamps`, `accessControl` |
| **Ασφάλεια (4)** | `securityCameras247`, `securitySystems`, `mechanicalSecurity`, `emergencyExits` |
| **Πυρόσβεση (2)** | `fireSuppression`, `gasFireSuppression` |
| **Ενέργεια (2)** | `energyClassAPlus`, `powerSupply1000kw` |
| **Αρχιτεκτονική (4)** | `balconiesWithView`, `shopWindows`, `naturalLightingAtrium`, `highQualityAcoustics` |
| **Βιομηχανικά (4)** | `craneBridge20Tons`, `dustRemovalSystems`, `highShelving12m`, `rfidTracking` |
| **Αυτοματισμοί (4)** | `automationSystems`, `monitoringSystems`, `videoConferencingAllRooms`, `shopManagementSystem` |
| **Amenities (4)** | `staffCafeteria`, `foodCourt800Seats`, `cinema8Rooms`, `playground300sqm` |

> **Registry**: `src/types/building/features.ts` — BUILDING_FEATURES (SSoT, i18n-ready)

---

## 4. Σχετικές Οντότητες — Ιεραρχία Κτιρίου

### 4.1 Floor (Subcollection: `floors`)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Floor ID |
| 2 | `buildingId` | string | Yes | FK → buildings |
| 3 | `name` | string | Yes | "Υπόγειο", "Ισόγειο", "1ος Όροφος" |
| 4 | `level` | number | Yes | Αριθμητικό επίπεδο (-2, -1, 0, 1, 2...) |
| 5 | `area` | number | Yes | Εμβαδόν ορόφου (m2) |
| 6 | `properties` | Property[] | Yes | Μονάδες στον όροφο |
| 7 | `storageUnits` | unknown[] | Yes | Αποθήκες στον όροφο |

### 4.2 Property (Nested in Floor)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Property ID |
| 2 | `floorId` | string | Yes | FK → floor |
| 3 | `code` | string | Yes | Κωδικός (ADR-233: `{Building}-{Type}-{Floor}.{Seq}`) |
| 4 | `type` | enum | Yes | `studio` / `apartment_1br` / `apartment_2br` / `apartment_3br` / `maisonette` / `store` / `shop` |
| 5 | `area` | number | Yes | Εμβαδόν (m2) |
| 6 | `price` | number | Yes | Τιμή (EUR) |
| 7 | `status` | enum | Yes | `available` / `sold` / `reserved` |
| 8 | `rooms` | number | No | Αριθμός δωματίων |
| 9 | `bathrooms` | number | No | Αριθμός μπάνιων |
| 10 | `hasBalcony` | boolean | No | Διαθέτει μπαλκόνι |
| 11 | `balconyArea` | number | No | Εμβαδόν μπαλκονιού (m2) |
| 12 | `features` | string[] | No | Χαρακτηριστικά μονάδας |
| 13 | `linkedStorageUnits` | string[] | No | Συνδεδεμένες αποθήκες (IDs) |

### 4.3 ConstructionPhase (Collection: `construction_phases`)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Phase ID |
| 2 | `buildingId` | string | Yes | FK → buildings |
| 3 | `companyId` | string | Yes | Tenant isolation |
| 4 | `name` | string | Yes | Όνομα φάσης |
| 5 | `code` | string | Yes | Κωδικός (PH-001, PH-002...) |
| 6 | `order` | number | Yes | Σειρά ταξινόμησης |
| 7 | `status` | ConstructionPhaseStatus | Yes | `planning` / `inProgress` / `completed` / `delayed` / `blocked` |
| 8 | `plannedStartDate` | string (ISO) | Yes | Προγραμματισμένη έναρξη |
| 9 | `plannedEndDate` | string (ISO) | Yes | Προγραμματισμένη λήξη |
| 10 | `actualStartDate` | string (ISO) | No | Πραγματική έναρξη |
| 11 | `actualEndDate` | string (ISO) | No | Πραγματική λήξη |
| 12 | `progress` | number | Yes | 0-100% |
| 13 | `barColor` | string | No | Χρώμα Gantt bar (#RRGGBB) |
| 14 | `description` | string | No | Περιγραφή |
| 15 | `delayReason` | DelayReason / null | No | `weather` / `materials` / `permits` / `subcontractor` / `other` |
| 16 | `delayNote` | string / null | No | Σημείωση καθυστέρησης |
| 17 | `createdAt` | string | No | Audit |
| 18 | `updatedAt` | string | No | Audit |
| 19 | `createdBy` | string | No | Audit |
| 20 | `updatedBy` | string | No | Audit |

### 4.4 ConstructionTask (Collection: `construction_tasks`)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Task ID |
| 2 | `phaseId` | string | Yes | FK → construction_phases |
| 3 | `buildingId` | string | Yes | FK → buildings |
| 4 | `companyId` | string | Yes | Tenant isolation |
| 5 | `name` | string | Yes | Όνομα εργασίας |
| 6 | `code` | string | Yes | Κωδικός (TSK-001, TSK-002...) |
| 7 | `order` | number | Yes | Σειρά ταξινόμησης εντός φάσης |
| 8 | `status` | ConstructionTaskStatus | Yes | `notStarted` / `inProgress` / `completed` / `delayed` / `blocked` |
| 9 | `plannedStartDate` | string (ISO) | Yes | Προγραμματισμένη έναρξη |
| 10 | `plannedEndDate` | string (ISO) | Yes | Προγραμματισμένη λήξη |
| 11 | `actualStartDate` | string (ISO) | No | Πραγματική έναρξη |
| 12 | `actualEndDate` | string (ISO) | No | Πραγματική λήξη |
| 13 | `progress` | number | Yes | 0-100% |
| 14 | `dependencies` | string[] | No | Task IDs εξαρτήσεων |
| 15 | `barColor` | string | No | Χρώμα Gantt bar |
| 16 | `description` | string | No | Περιγραφή |
| 17 | `delayReason` | DelayReason / null | No | Αιτία καθυστέρησης |
| 18 | `delayNote` | string / null | No | Σημείωση |
| 19 | `createdAt` | string | No | Audit |
| 20 | `updatedAt` | string | No | Audit |
| 21 | `createdBy` | string | No | Audit |
| 22 | `updatedBy` | string | No | Audit |

### 4.5 ConstructionBaseline (Collection: `construction_baselines`)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | `cbase_uuid` |
| 2 | `buildingId` | string | Yes | FK → buildings |
| 3 | `companyId` | string | Yes | Tenant isolation |
| 4 | `name` | string | Yes | "Baseline 1 - Initial Schedule" |
| 5 | `version` | number | Yes | Auto-incremented per building |
| 6 | `description` | string / null | No | Περιγραφή |
| 7 | `phases` | ConstructionPhase[] | Yes | Denormalized snapshot φάσεων |
| 8 | `tasks` | ConstructionTask[] | Yes | Denormalized snapshot εργασιών |
| 9 | `createdAt` | string | No | Audit |
| 10 | `createdBy` | string | No | Audit |

### 4.6 ConstructionResourceAssignment (Collection: `construction_resource_assignments`)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | `crasn_uuid` |
| 2 | `taskId` | string | Yes | FK → construction_tasks |
| 3 | `phaseId` | string | Yes | Denormalized FK → construction_phases |
| 4 | `buildingId` | string | Yes | FK → buildings |
| 5 | `companyId` | string | Yes | Tenant isolation |
| 6 | `resourceType` | ResourceType | Yes | `worker` / `equipment` |
| 7 | `contactId` | string / null | No | FK → contacts (μόνο για worker) |
| 8 | `resourceName` | string | Yes | Ονοματεπώνυμο ή label εξοπλισμού |
| 9 | `equipmentLabel` | string / null | No | Label εξοπλισμού (π.χ. "Crane #2") |
| 10 | `allocatedHours` | number | Yes | Ώρες ανάθεσης |
| 11 | `notes` | string / null | No | Σημειώσεις |
| 12 | `createdAt` | string | No | Audit |
| 13 | `updatedAt` | string | No | Audit |
| 14 | `createdBy` | string | No | Audit |
| 15 | `updatedBy` | string | No | Audit |

### 4.7 BuildingMilestone (Collection: `building_milestones`)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Milestone ID |
| 2 | `buildingId` | string | Yes | FK → buildings |
| 3 | `companyId` | string | Yes | Tenant isolation |
| 4 | `title` | string | Yes | Τίτλος milestone |
| 5 | `description` | string | Yes | Περιγραφή |
| 6 | `date` | string (ISO) | Yes | Ημερομηνία |
| 7 | `status` | MilestoneStatus | Yes | `completed` / `in-progress` / `pending` / `delayed` |
| 8 | `progress` | number | Yes | 0-100% |
| 9 | `type` | MilestoneType | Yes | `start` / `construction` / `systems` / `finishing` / `delivery` |
| 10 | `order` | number | Yes | Σειρά ταξινόμησης |
| 11 | `code` | string | Yes | Κωδικός (MS-001, MS-002...) |
| 12 | `phaseId` | string | No | Link → construction phase |
| 13 | `createdAt` | string | No | Audit |
| 14 | `updatedAt` | string | No | Audit |
| 15 | `createdBy` | string | No | Audit |
| 16 | `updatedBy` | string | No | Audit |

### 4.8 BOQItem (Collection: `boq_items`)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Document ID |
| 2 | `companyId` | string | Yes | Tenant isolation |
| 3 | `projectId` | string | Yes | FK → projects |
| 4 | `buildingId` | string | Yes | FK → buildings |
| 5 | `scope` | enum | Yes | `building` / `unit` |
| 6 | `linkedUnitId` | string / null | Yes | FK → units (αν scope='unit') |
| 7 | `categoryCode` | string | Yes | Κωδικός ΑΤΟΕ (π.χ. 'OIK-2') |
| 8 | `title` | string | Yes | Τίτλος εργασίας |
| 9 | `description` | string / null | Yes | Αναλυτική περιγραφή |
| 10 | `unit` | BOQMeasurementUnit | Yes | `m` / `m2` / `m3` / `kg` / `ton` / `pcs` / `lt` / `set` / `hr` / `day` / `lump` |
| 11 | `estimatedQuantity` | number | Yes | Εκτιμώμενη ποσότητα |
| 12 | `actualQuantity` | number / null | Yes | Πραγματική ποσότητα |
| 13 | `wasteFactor` | number | Yes | Ποσοστό φύρας (0.08 = 8%) |
| 14 | `wastePolicy` | WastePolicy | Yes | `inherited` / `overridden` |
| 15 | `materialUnitCost` | number | Yes | Κόστος υλικού/μονάδα (EUR) |
| 16 | `laborUnitCost` | number | Yes | Κόστος εργασίας/μονάδα (EUR) |
| 17 | `equipmentUnitCost` | number | Yes | Κόστος εξοπλισμού/μονάδα (EUR) |
| 18 | `priceAuthority` | SourceAuthority | Yes | `master` / `project` / `item` |
| 19 | `linkedPhaseId` | string / null | Yes | FK → construction_phases |
| 20 | `linkedTaskId` | string / null | Yes | FK → construction_tasks |
| 21 | `linkedInvoiceId` | string / null | Yes | FK → accounting invoices |
| 22 | `linkedContractorId` | string / null | Yes | FK → contacts (υπεργολάβος) |
| 23 | `source` | BOQSource | Yes | `manual` / `template` / `dxf_auto` / `dxf_verified` / `imported` / `duplicate` |
| 24 | `measurementMethod` | MeasurementMethod | Yes | `manual` / `tape` / `laser` / `dxf_auto` / `dxf_verified` / `bim` |
| 25 | `status` | BOQItemStatus | Yes | `draft` / `submitted` / `approved` / `certified` / `locked` |
| 26 | `qaStatus` | QAStatus | Yes | `pending` / `passed` / `failed` / `na` |
| 27 | `notes` | string / null | Yes | Σημειώσεις |
| 28 | `createdBy` | string / null | Yes | Audit |
| 29 | `approvedBy` | string / null | Yes | Audit |
| 30 | `createdAt` | string | Yes | Audit |
| 31 | `updatedAt` | string | Yes | Audit |

---

## 5. Σχέσεις με ΟΛΕΣ τις Οντότητες (Relationship Map)

### 5.1 Διάγραμμα Σχέσεων

```
                              ┌──────────────┐
                              │   ΚΤΙΡΙΟ     │
                              │  (buildings) │
                              └──────┬───────┘
                                     │
     ┌───────────────────────────────┼───────────────────────────────┐
     │                               │                               │
┌────┴─────┐                  ┌──────┴──────┐                 ┌──────┴──────┐
│ ΔΟΜΗ     │                  │ ΚΑΤΑΣΚΕΥΗ   │                 │ ΑΝΘΡΩΠΟΙ   │
│          │                  │             │                 │            │
├──────────┤                  ├─────────────┤                 ├────────────┤
│ projects │ ← projectId     │ constr.     │ → buildingId    │ contact_   │
│ floors   │ → buildingId    │  _phases    │                 │  links     │
│ units    │ → buildingId    │ constr.     │ → buildingId    │ (entity    │
│ parking  │ → buildingId    │  _tasks     │                 │  assoc.)   │
│  _spots  │ (nullable)      │ constr.     │ → buildingId    │            │
│ storage  │ → buildingId    │  _baselines │                 │ linkedCo-  │
│  _units  │ (optional)      │ constr.     │ → buildingId    │  mpanyId   │
│          │                  │  _resource_ │                 │ (κατασκ.)  │
│          │                  │  assignments│                 └────────────┘
│          │                  │ building_   │ → buildingId          │
│          │                  │  milestones │                 ┌──────┴──────┐
│          │                  │ boq_items   │ → buildingId    │ ΟΙΚΟΝΟΜΙΚΑ │
│          │                  └─────────────┘                 │            │
│          │                                                  ├────────────┤
│          │                  ┌─────────────┐                 │ purchase_  │
│          │                  │ CRM         │                 │  orders    │
│          │                  ├─────────────┤                 │ legal_     │
└──────────┘                  │ opportun-   │ → buildingIds[] │  contracts │
                              │  ities      │                 │ payment_   │
                              │ assignment_ │ → buildingIds[] │  plans     │
                              │  policies   │                 │ ownership  │
                              └─────────────┘                 │  _tables   │
                                                              │ obligations│
                                                              └────────────┘
```

### 5.2 Αναλυτικός Πίνακας Σχέσεων

| # | Collection | Πεδίο σύνδεσης | Σχέση | Κατεύθυνση | Περιγραφή |
|---|------------|----------------|-------|------------|-----------|
| 1 | **projects** | `building.projectId` | N:1 | Building → Project | Κάθε κτίριο ανήκει σε 1 έργο |
| 2 | **floors** | `floor.buildingId` | 1:N | Building ← Floors | Κτίριο → πολλοί όροφοι |
| 3 | **units** | `unit.buildingId` | 1:N | Building ← Units | Κτίριο → πολλές μονάδες |
| 4 | **parking_spots** | `parking.buildingId` (nullable) | 1:N | Building ← Parking | Parking μπορεί να μην ανήκει σε κτίριο |
| 5 | **storage_units** | `storage.buildingId` (optional) | 1:N | Building ← Storage | Αποθήκες εντός κτιρίου |
| 6 | **construction_phases** | `phase.buildingId` | 1:N | Building ← Phases | Φάσεις κατασκευής per building |
| 7 | **construction_tasks** | `task.buildingId` | 1:N | Building ← Tasks | Εργασίες per building |
| 8 | **construction_baselines** | `baseline.buildingId` | 1:N | Building ← Baselines | Schedule snapshots |
| 9 | **construction_resource_assignments** | `assignment.buildingId` | 1:N | Building ← Resources | Αναθέσεις πόρων |
| 10 | **building_milestones** | `milestone.buildingId` | 1:N | Building ← Milestones | Ορόσημα κατασκευής |
| 11 | **boq_items** | `boqItem.buildingId` | 1:N | Building ← BOQ Items | Επιμετρήσεις εργασιών |
| 12 | **contact_links** | `link.targetEntityId` (where entity=building) | N:M | Building ↔ Contacts | Μηχανικοί, εργολάβοι, managers |
| 13 | **contacts** (company) | `building.linkedCompanyId` | N:1 | Building → Company | Κατασκευαστική εταιρεία |
| 14 | **ownership_tables** | `table.buildingIds[]` | N:M | Building ↔ OwnershipTable | Πίνακας χιλιοστών (πολλά κτίρια/table) |
| 15 | **purchase_orders** | `po.buildingId` (nullable) | 1:N | Building ← POs | Παραγγελίες αγοράς |
| 16 | **legal_contracts** | `contract.buildingId` | 1:N | Building ← Contracts | Συμβόλαια πώλησης μονάδων |
| 17 | **payment_plans** | `plan.buildingId` | 1:N | Building ← Plans | Πλάνα πληρωμών |
| 18 | **obligations** | `obligation.buildingId` (optional) | 1:N | Building ← Obligations | Υποχρεώσεις (project-wide ή building-specific) |
| 19 | **obligation_transmittals** | `transmittal.buildingId` (optional) | 1:N | Building ← Transmittals | Διαβιβαστικά υποχρεώσεων |
| 20 | **opportunities** | `opportunity.buildingIds[]` | N:M | Building ↔ Opportunities | CRM leads ενδιαφέρον σε κτίρια |
| 21 | **assignment_policies** | `policy.buildingIds[]` | N:M | Building ↔ Policies | Κανόνες ανάθεσης per building |
| 22 | **layers** | `layer.buildingId` | 1:N | Building ← Layers | CAD/floorplan layers |
| 23 | **search_documents** | `doc.entityId` | 1:N | Building ← Search | Search index (deletion cascade) |

### 5.3 Entity Association Roles (ADR-177)

Μέσω `contact_links` (junction collection), τα κτίρια συνδέονται με επαφές με ρόλο:

| Ρόλος | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `supervisor` | BuildingRole | Επιβλέπων μηχανικός |
| `contractor` | BuildingRole | Εργολάβος |
| `manager` | BuildingRole | Υπεύθυνος κτιρίου |
| `engineer` | BuildingRole | Μηχανικός |

---

## 6. Report Builder Impact — Τι σημαίνει αυτό για τα Domains

### 6.1 Domain A2 (Κτίρια) — Ενημερωμένες Στήλες

**Tier 1 (Flat Table) — Primary columns:**

| Στήλη | Πεδίο | Τύπος | Σημείωση |
|-------|-------|-------|----------|
| Όνομα | `name` | text | |
| Έργο | `projectId` → join project.name | text | Cross-join |
| Status | `status` | enum | planning/construction/completed/active |
| Πρόοδος | `progress` | number | 0-100% |
| Τύπος | `type` | enum | residential/commercial/industrial/mixed/office/warehouse |
| Κατηγορία | `category` | enum | |
| Προτεραιότητα | `priority` | enum | low/medium/high/critical |
| Ενεργειακή Κλάση | `energyClass` | enum | A+ → G |
| Ανακαίνιση | `renovation` | enum | none/partial/full/planned |
| Συν. Εμβαδόν | `totalArea` | number | m2 |
| Δομημένο Εμβαδόν | `builtArea` | number | m2 |
| Όροφοι | `floors` | number | |
| Σύν. Μονάδων | `totalUnits` | number | |
| Τοποθεσία | `location` | text | |
| Πόλη | `city` ή `addresses[isPrimary].city` | text | |
| Έναρξη | `startDate` | date | |
| Ολοκλήρωση | `completionDate` | date | |
| Αξία | `totalValue` | currency | EUR |
| Έτος Κατασκευής | `constructionYear` | number | |
| Κατασκευαστής | `linkedCompanyName` | text | Denormalized |
| Parking | `hasParking` | boolean | |
| Ανελκυστήρας | `hasElevator` | boolean | |
| Κήπος | `hasGarden` | boolean | |
| Πισίνα | `hasPool` | boolean | |
| ΑμεΑ | `accessibility` | boolean | |
| Επιπλωμένο | `furnished` | boolean | |
| Ημ/νία Δημιουργίας | `createdAt` | date | |

**Tier 1 — Computed/Joined columns (cross-entity):**

| Στήλη | Join | Τύπος | Σημείωση |
|-------|------|-------|----------|
| Αρ. Μονάδων (actual) | COUNT units WHERE buildingId | number | Live count |
| Πωλημένες Μονάδες | COUNT units WHERE status='sold' | number | |
| Αξία Πωλήσεων | SUM units.finalPrice WHERE sold | currency | |
| % Πωληθέν | sold/total * 100 | number | |
| Αρ. Ορόφων (actual) | COUNT floors WHERE buildingId | number | |
| Αρ. Parking | COUNT parking_spots WHERE buildingId | number | |
| Αρ. Αποθηκών | COUNT storage_units WHERE buildingId | number | |
| Αρ. Φάσεων | COUNT construction_phases WHERE buildingId | number | |
| Αρ. Εργασιών | COUNT construction_tasks WHERE buildingId | number | |
| Καθυστερημένες Φάσεις | COUNT phases WHERE status='delayed' | number | |
| Αρ. Milestones | COUNT building_milestones WHERE buildingId | number | |
| Αρ. BOQ Items | COUNT boq_items WHERE buildingId | number | |
| Κόστος BOQ (εκτ.) | SUM boq computed costs | currency | |
| Αρ. Παραγγελιών | COUNT purchase_orders WHERE buildingId | number | |
| Αρ. Συμβολαίων | COUNT legal_contracts WHERE buildingId | number | |
| Αρ. Resources | COUNT resource_assignments WHERE buildingId | number | |
| Αρ. Contacts | COUNT contact_links WHERE entity=building | number | |
| Αρ. CRM Leads | COUNT opportunities WHERE buildingIds contains | number | |

### 6.2 Tier 2 (Row Repetition) — Arrays που χρειάζονται expansion

| Array | Πεδία ανά row | Μέγιστο πλήθος |
|-------|---------------|----------------|
| `addresses[]` | type, street, city, postalCode, isPrimary | ~3 |
| `features[]` | featureKey (i18n label) | ~36 (max) |
| `floors[]` (from floors collection) | name, level, area | ~20 |
| `construction_phases[]` | code, name, status, progress, dates | ~15 |
| `construction_tasks[]` | code, name, status, progress, phaseId | ~50 |
| `building_milestones[]` | code, title, status, date, type | ~20 |
| `boq_items[]` | categoryCode, title, unit, quantity, cost | ~200 |
| `contact_links[]` | contactName, role | ~10 |
| `resource_assignments[]` | resourceName, type, hours | ~30 |

### 6.3 Tier 3 (Building Card PDF) — Sections

```
┌─────────────────────────────────────────────────┐
│ [LOGO] ΚΤΙΡΙΟ: {name}                          │
│        Έργο: {projectName} | Status: {status}  │
├─────────────────────────────────────────────────┤
│ ΓΕΝΙΚΑ ΣΤΟΙΧΕΙΑ                                 │
│ Τύπος | Κατηγορία | Ενεργειακή | Ανακαίνιση    │
│ Εμβαδόν: {totalArea}m2 | Δομ: {builtArea}m2    │
│ Όροφοι: {floors} | Μονάδες: {totalUnits}       │
│ Αξία: {totalValue}EUR | Έτος: {constructionYear}│
├─────────────────────────────────────────────────┤
│ ΔΙΕΥΘΥΝΣΕΙΣ                                      │
│ [πίνακας addresses]                             │
├─────────────────────────────────────────────────┤
│ ΠΑΡΟΧΕΣ                                          │
│ Parking: ✅ | Ανελκυστήρας: ✅ | Κήπος: ❌     │
│ Πισίνα: ❌ | ΑμεΑ: ✅ | Επιπλωμένο: ❌         │
├─────────────────────────────────────────────────┤
│ ΧΑΡΑΚΤΗΡΙΣΤΙΚΑ (features[])                      │
│ [λίστα features με i18n labels]                 │
├─────────────────────────────────────────────────┤
│ ΟΡΟΦΟΙ                                           │
│ [πίνακας: Όνομα, Επίπεδο, Εμβαδόν, Μονάδες]   │
├─────────────────────────────────────────────────┤
│ ΚΑΤΑΣΚΕΥΑΣΤΙΚΕΣ ΦΑΣΕΙΣ                           │
│ [πίνακας: Κωδικός, Φάση, Status, Πρόοδος, Ημ/νίες]│
├─────────────────────────────────────────────────┤
│ ΕΡΓΑΣΙΕΣ                                         │
│ [πίνακας: Κωδικός, Εργασία, Φάση, Status, %]   │
├─────────────────────────────────────────────────┤
│ MILESTONES                                       │
│ [πίνακας: Κωδικός, Τίτλος, Τύπος, Status, Ημ/νία]│
├─────────────────────────────────────────────────┤
│ ΕΠΙΜΕΤΡΗΣΕΙΣ (BOQ)                               │
│ [πίνακας: Κατηγορία, Τίτλος, Μονάδα, Ποσ., Κόστος]│
│ ΣΥΝΟΛΟ: {totalEstimatedCost}EUR                 │
├─────────────────────────────────────────────────┤
│ ΣΥΝΕΡΓΑΤΕΣ (via contact_links)                   │
│ [πίνακας: Όνομα, Ρόλος (Supervisor/Contractor/...)]│
├─────────────────────────────────────────────────┤
│ ΚΑΤΑΣΚΕΥΑΣΤΗΣ                                    │
│ {linkedCompanyName} (ID: {linkedCompanyId})      │
├─────────────────────────────────────────────────┤
│ ΠΩΛΗΣΕΙΣ                                         │
│ Πωλημένες: {soldUnits}/{totalUnits} ({soldPct}%)│
│ Αξία πωλήσεων: {totalSalesValue}EUR             │
├─────────────────────────────────────────────────┤
│ ΣΗΜΕΙΩΣΕΙΣ                                       │
│ [description]                                   │
└─────────────────────────────────────────────────┘
```

---

## 7. Στατιστικά

| Μέτρηση | Τιμή |
|---------|------|
| Πεδία Building (direct) | 40 |
| Πεδία Floor (nested) | 7 |
| Πεδία Property (nested in Floor) | 13 |
| Πεδία ConstructionPhase | 20 |
| Πεδία ConstructionTask | 22 |
| Πεδία ConstructionBaseline | 10 |
| Πεδία ResourceAssignment | 15 |
| Πεδία BuildingMilestone | 16 |
| Πεδία BOQItem | 31 |
| BuildingFeatureKey values | 36 |
| Building amenity booleans | 6 |
| Cross-entity σχέσεις | 23 collections |
| Entity association roles | 4 (supervisor, contractor, manager, engineer) |
| Building tabs (UI) | 16 |
| **Σύνολο πεδίων (πλήρες κτίριο)** | **~210+** |
