# SPEC-020: Πλήρης Χαρτογράφηση — Κατασκευή (Construction)

**ADR**: 268 — Dynamic Report Builder
**Version**: 1.0
**Last Updated**: 2026-03-29
**Source of Truth**: Κώδικας (`src/types/building/construction.ts`, `src/types/building/milestone.ts`, `src/types/boq/boq.ts`, `src/types/boq/units.ts`, `src/types/boq/cost.ts`)
**Σχέση**: ADR-266 (Gantt Construction Reports), ADR-175 (BOQ)

---

> **ΣΗΜΑΝΤΙΚΟ**: Ο Report Builder κάνει ΜΟΝΟ cross-building tabular queries.
> Specialized visualizations (S-Curve, CPM, Resource Histogram) παραμένουν **αποκλειστικά** στο ADR-266.

---

## Περιεχόμενα

- [Οντότητα 1: BOQ Items (Κοστολόγηση)](#οντότητα-1-boq-items-κοστολόγηση)
- [Οντότητα 2: Construction Phases (Φάσεις Κατασκευής)](#οντότητα-2-construction-phases-φάσεις-κατασκευής)
- [Οντότητα 3: Construction Tasks (Εργασίες)](#οντότητα-3-construction-tasks-εργασίες)
- [Οντότητα 4: Construction Resource Assignments](#οντότητα-4-construction-resource-assignments)
- [Οντότητα 5: Construction Baselines (Snapshots)](#οντότητα-5-construction-baselines-snapshots)
- [Οντότητα 6: Building Milestones (Ορόσημα)](#οντότητα-6-building-milestones-ορόσημα)
- [§5. Σχέσεις μεταξύ ΟΛΩΝ των Οντοτήτων](#5-σχέσεις-μεταξύ-ολων-των-οντοτήτων)
- [§6. Report Builder Impact](#6-report-builder-impact)
- [§7. Στατιστικά](#7-στατιστικά)

---

## Οντότητα 1: BOQ Items (Κοστολόγηση)

### 1.1 Ταυτότητα

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `boq_items` (via `COLLECTIONS.BOQ_ITEMS`) |
| **TypeScript** | `BOQItem` (`src/types/boq/boq.ts`) |
| **ID Pattern** | Enterprise ID via `enterprise-id.service.ts` |
| **Tenant Isolation** | `companyId` |
| **Related Collections** | `boq_categories`, `boq_price_lists`, `boq_templates` |
| **Service** | `src/services/measurements/boq-service.ts` |
| **Repository** | `src/services/measurements/boq-repository.ts` |
| **ADR** | ADR-175 (BOQ / Quantity Surveying) |

### 1.2 Πλήρης Κατάλογος Πεδίων

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Enterprise ID |
| 2 | `companyId` | string | Yes | Tenant isolation |
| 3 | `projectId` | string | Yes | FK → projects |
| 4 | `buildingId` | string | Yes | FK → buildings |
| 5 | `scope` | `'building'` / `'unit'` | Yes | Εύρος: κτίριο ή μονάδα |
| 6 | `linkedUnitId` | string / null | No | FK → units (αν scope=unit) |
| 7 | `categoryCode` | string | Yes | ΑΤΟΕ κωδικός (π.χ. "OIK-2") |
| 8 | `title` | string | Yes | Τίτλος εργασίας |
| 9 | `description` | string / null | No | Περιγραφή |
| 10 | `unit` | BOQMeasurementUnit | Yes | Μονάδα μέτρησης (m, m2, m3, kg, ton, pcs, lt, set, hr, day, lump) |
| 11 | `estimatedQuantity` | number | Yes | Εκτιμώμενη ποσότητα (net) |
| 12 | `actualQuantity` | number / null | No | Πραγματική ποσότητα |
| 13 | `wasteFactor` | number | Yes | Ποσοστό φύρας (0.08 = 8%) |
| 14 | `wastePolicy` | WastePolicy | Yes | `inherited` / `overridden` |
| 15 | `materialUnitCost` | number | Yes | Κόστος υλικών (EUR/μονάδα) |
| 16 | `laborUnitCost` | number | Yes | Κόστος εργασίας (EUR/μονάδα) |
| 17 | `equipmentUnitCost` | number | Yes | Κόστος εξοπλισμού (EUR/μονάδα) |
| 18 | `priceAuthority` | SourceAuthority | Yes | `master` / `project` / `item` (3-level inheritance) |
| 19 | `linkedPhaseId` | string / null | No | FK → construction_phases |
| 20 | `linkedTaskId` | string / null | No | FK → construction_tasks |
| 21 | `linkedInvoiceId` | string / null | No | FK → accounting_invoices |
| 22 | `linkedContractorId` | string / null | No | FK → contacts (εργολάβος) |
| 23 | `source` | BOQSource | Yes | `manual` / `template` / `dxf_auto` / `dxf_verified` / `imported` / `duplicate` |
| 24 | `measurementMethod` | MeasurementMethod | Yes | `manual` / `tape` / `laser` / `dxf_auto` / `dxf_verified` / `bim` |
| 25 | `status` | BOQItemStatus | Yes | `draft` / `submitted` / `approved` / `certified` / `locked` |
| 26 | `qaStatus` | QAStatus | Yes | `pending` / `passed` / `failed` / `na` |
| 27 | `notes` | string / null | No | Σημειώσεις |
| 28 | `createdBy` | string / null | No | User ID δημιουργού |
| 29 | `approvedBy` | string / null | No | User ID εγκρίνοντος |
| 30 | `createdAt` | string (ISO) | Yes | Ημ/νία δημιουργίας |
| 31 | `updatedAt` | string (ISO) | Yes | Ημ/νία ενημέρωσης |

### 1.3 Enums (BOQ)

**BOQMeasurementUnit** (11 τιμές):
`m`, `m2`, `m3`, `kg`, `ton`, `pcs`, `lt`, `set`, `hr`, `day`, `lump`

**BOQItemStatus** (5 τιμές — governance lifecycle):
`draft` → `submitted` → `approved` → `certified` → `locked`

**BOQSource** (6 τιμές):
`manual`, `template`, `dxf_auto`, `dxf_verified`, `imported`, `duplicate`

**MeasurementMethod** (6 τιμές):
`manual`, `tape`, `laser`, `dxf_auto`, `dxf_verified`, `bim`

**QAStatus** (4 τιμές):
`pending`, `passed`, `failed`, `na`

**WastePolicy** (2 τιμές):
`inherited`, `overridden`

**SourceAuthority** (3 τιμές — price list inheritance):
`master`, `project`, `item`

**CategoryLevel** (3 τιμές — ΑΤΟΕ hierarchy):
`group`, `subgroup`, `item`

### 1.4 Computed Types (ΔΕΝ αποθηκεύονται στο Firestore)

**CostBreakdown** (per item):

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `netQuantity` | number | Καθαρή ποσότητα |
| `grossQuantity` | number | Μεικτή (net × (1 + wasteFactor)) |
| `materialCost` | number | Κόστος υλικών |
| `laborCost` | number | Κόστος εργασίας |
| `equipmentCost` | number | Κόστος εξοπλισμού |
| `unitCost` | number | Κόστος ανά μονάδα |
| `totalCost` | number | Συνολικό κόστος |
| `wasteFactorApplied` | number | Εφαρμοσμένη φύρα |

**VarianceResult** (estimate vs actual):

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `estimated` | number | Εκτιμώμενη ποσότητα |
| `actual` | number | Πραγματική ποσότητα |
| `delta` | number | Διαφορά ποσότητας |
| `percent` | number | Ποσοστό απόκλισης |
| `estimatedCost` | number | Εκτιμώμενο κόστος |
| `actualCost` | number | Πραγματικό κόστος |
| `costDelta` | number | Κοστολογική απόκλιση |

### 1.5 BOQCategory (ΑΤΟΕ Master Data)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Enterprise ID |
| 2 | `companyId` | string | Yes | Tenant isolation |
| 3 | `code` | string | Yes | ΑΤΟΕ κωδικός (π.χ. "OIK-1", "OIK-2.1") |
| 4 | `nameEL` | string | Yes | Ελληνικό όνομα |
| 5 | `nameEN` | string | Yes | Αγγλικό όνομα |
| 6 | `description` | string / null | No | Περιγραφή |
| 7 | `level` | CategoryLevel | Yes | `group` / `subgroup` / `item` |
| 8 | `parentId` | string / null | No | FK → boq_categories (parent) |
| 9 | `sortOrder` | number | Yes | Σειρά ταξινόμησης |
| 10 | `defaultWasteFactor` | number | Yes | Default φύρα (0.05 = 5%) |
| 11 | `allowedUnits` | BOQMeasurementUnit[] | Yes | Επιτρεπόμενες μονάδες |
| 12 | `isActive` | boolean | Yes | Ενεργή κατηγορία |
| 13 | `createdAt` | string (ISO) | Yes | Ημ/νία δημιουργίας |
| 14 | `updatedAt` | string (ISO) | Yes | Ημ/νία ενημέρωσης |

---

## Οντότητα 2: Construction Phases (Φάσεις Κατασκευής)

### 2.1 Ταυτότητα

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `construction_phases` (via `COLLECTIONS.CONSTRUCTION_PHASES`) |
| **TypeScript** | `ConstructionPhase` (`src/types/building/construction.ts`) |
| **ID Pattern** | Enterprise ID |
| **Tenant Isolation** | `companyId` |
| **API Route** | `GET/POST/PATCH/DELETE /api/buildings/[buildingId]/construction-phases` |

### 2.2 Πλήρης Κατάλογος Πεδίων

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Enterprise ID |
| 2 | `buildingId` | string | Yes | FK → buildings |
| 3 | `companyId` | string | Yes | Tenant isolation |
| 4 | `name` | string | Yes | Όνομα φάσης |
| 5 | `code` | string | Yes | Κωδικός (PH-001 format) |
| 6 | `order` | number | Yes | Σειρά εμφάνισης |
| 7 | `status` | ConstructionPhaseStatus | Yes | `planning` / `inProgress` / `completed` / `delayed` / `blocked` |
| 8 | `plannedStartDate` | string (ISO) | Yes | Προγρ. ημ/νία έναρξης |
| 9 | `plannedEndDate` | string (ISO) | Yes | Προγρ. ημ/νία λήξης |
| 10 | `actualStartDate` | string (ISO) | No | Πραγμ. ημ/νία έναρξης |
| 11 | `actualEndDate` | string (ISO) | No | Πραγμ. ημ/νία λήξης |
| 12 | `progress` | number (0-100) | Yes | Ποσοστό ολοκλήρωσης |
| 13 | `barColor` | string (hex) | No | Χρώμα Gantt bar |
| 14 | `description` | string | No | Περιγραφή |
| 15 | `delayReason` | DelayReason / null | No | Λόγος καθυστέρησης |
| 16 | `delayNote` | string / null | No | Σημείωση καθυστέρησης |
| 17 | `createdAt` | string (ISO) | No | Ημ/νία δημιουργίας |
| 18 | `updatedAt` | string (ISO) | No | Ημ/νία ενημέρωσης |
| 19 | `createdBy` | string | No | User ID δημιουργού |
| 20 | `updatedBy` | string | No | User ID ενημέρωσης |

### 2.3 Enums (Phases)

**ConstructionPhaseStatus** (5 τιμές):
`planning`, `inProgress`, `completed`, `delayed`, `blocked`

**DelayReason** (5 τιμές):
`weather`, `materials`, `permits`, `subcontractor`, `other`

---

## Οντότητα 3: Construction Tasks (Εργασίες)

### 3.1 Ταυτότητα

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `construction_tasks` (via `COLLECTIONS.CONSTRUCTION_TASKS`) |
| **TypeScript** | `ConstructionTask` (`src/types/building/construction.ts`) |
| **ID Pattern** | Enterprise ID |
| **Tenant Isolation** | `companyId` |
| **API Route** | Via `/api/buildings/[buildingId]/construction-phases` (tasks embedded in same route) |

### 3.2 Πλήρης Κατάλογος Πεδίων

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Enterprise ID |
| 2 | `phaseId` | string | Yes | FK → construction_phases |
| 3 | `buildingId` | string | Yes | FK → buildings (denormalized) |
| 4 | `companyId` | string | Yes | Tenant isolation |
| 5 | `name` | string | Yes | Όνομα εργασίας |
| 6 | `code` | string | Yes | Κωδικός (TSK-001 format) |
| 7 | `order` | number | Yes | Σειρά εμφάνισης |
| 8 | `status` | ConstructionTaskStatus | Yes | `notStarted` / `inProgress` / `completed` / `delayed` / `blocked` |
| 9 | `plannedStartDate` | string (ISO) | Yes | Προγρ. ημ/νία έναρξης |
| 10 | `plannedEndDate` | string (ISO) | Yes | Προγρ. ημ/νία λήξης |
| 11 | `actualStartDate` | string (ISO) | No | Πραγμ. ημ/νία έναρξης |
| 12 | `actualEndDate` | string (ISO) | No | Πραγμ. ημ/νία λήξης |
| 13 | `progress` | number (0-100) | Yes | Ποσοστό ολοκλήρωσης |
| 14 | `dependencies` | string[] | No | Task IDs — Critical Path Method |
| 15 | `barColor` | string (hex) | No | Χρώμα Gantt bar |
| 16 | `description` | string | No | Περιγραφή |
| 17 | `delayReason` | DelayReason / null | No | Λόγος καθυστέρησης |
| 18 | `delayNote` | string / null | No | Σημείωση καθυστέρησης |
| 19 | `createdAt` | string (ISO) | No | Ημ/νία δημιουργίας |
| 20 | `updatedAt` | string (ISO) | No | Ημ/νία ενημέρωσης |
| 21 | `createdBy` | string | No | User ID δημιουργού |
| 22 | `updatedBy` | string | No | User ID ενημέρωσης |

### 3.3 Enums (Tasks)

**ConstructionTaskStatus** (5 τιμές):
`notStarted`, `inProgress`, `completed`, `delayed`, `blocked`

---

## Οντότητα 4: Construction Resource Assignments

### 4.1 Ταυτότητα

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `construction_resource_assignments` (via `COLLECTIONS.CONSTRUCTION_RESOURCE_ASSIGNMENTS`) |
| **TypeScript** | `ConstructionResourceAssignment` (`src/types/building/construction.ts`) |
| **ID Pattern** | `crasn_uuid` |
| **Tenant Isolation** | `companyId` |
| **API Route** | `GET/POST/PATCH/DELETE /api/buildings/[buildingId]/construction-resource-assignments` |
| **Max per task** | 20 (enforced by API) |

### 4.2 Πλήρης Κατάλογος Πεδίων

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Enterprise ID (`crasn_uuid`) |
| 2 | `taskId` | string | Yes | FK → construction_tasks |
| 3 | `phaseId` | string | Yes | FK → construction_phases (denormalized for histogram queries) |
| 4 | `buildingId` | string | Yes | FK → buildings |
| 5 | `companyId` | string | Yes | Tenant isolation |
| 6 | `resourceType` | ResourceType | Yes | `worker` / `equipment` |
| 7 | `contactId` | string / null | No | FK → contacts (μόνο αν resourceType=worker) |
| 8 | `resourceName` | string | Yes | Εμφανιζόμενο όνομα πόρου |
| 9 | `equipmentLabel` | string / null | No | Ετικέτα εξοπλισμού |
| 10 | `allocatedHours` | number | Yes | Κατανεμημένες ώρες |
| 11 | `notes` | string / null | No | Σημειώσεις |
| 12 | `createdAt` | string (ISO) | No | Ημ/νία δημιουργίας |
| 13 | `updatedAt` | string (ISO) | No | Ημ/νία ενημέρωσης |
| 14 | `createdBy` | string | No | User ID δημιουργού |
| 15 | `updatedBy` | string | No | User ID ενημέρωσης |

### 4.3 Enums (Resources)

**ResourceType** (2 τιμές):
`worker`, `equipment`

---

## Οντότητα 5: Construction Baselines (Snapshots)

### 5.1 Ταυτότητα

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `construction_baselines` (via `COLLECTIONS.CONSTRUCTION_BASELINES`) |
| **TypeScript** | `ConstructionBaseline` (`src/types/building/construction.ts`) |
| **ID Pattern** | `cbase_uuid` |
| **Tenant Isolation** | `companyId` |
| **API Route** | `GET/POST/DELETE /api/buildings/[buildingId]/construction-baselines` |
| **Max per building** | 10 (enforced by API) |

### 5.2 Πλήρης Κατάλογος Πεδίων

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Enterprise ID (`cbase_uuid`) |
| 2 | `buildingId` | string | Yes | FK → buildings |
| 3 | `companyId` | string | Yes | Tenant isolation |
| 4 | `name` | string | Yes | Όνομα baseline |
| 5 | `version` | number | Yes | Auto-increment version |
| 6 | `description` | string / null | No | Περιγραφή |
| 7 | `phases` | ConstructionPhase[] | Yes | **Denormalized full copy** — frozen snapshot φάσεων |
| 8 | `tasks` | ConstructionTask[] | Yes | **Denormalized full copy** — frozen snapshot εργασιών |
| 9 | `createdAt` | string (ISO) | No | Ημ/νία δημιουργίας |
| 10 | `createdBy` | string | No | User ID δημιουργού |

### 5.3 Summary Interface (Lightweight)

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `id` | string | Baseline ID |
| `name` | string | Όνομα |
| `version` | number | Version |
| `createdAt` | string | Ημ/νία |
| `phaseCount` | number | Πλήθος φάσεων |
| `taskCount` | number | Πλήθος εργασιών |

---

## Οντότητα 6: Building Milestones (Ορόσημα)

### 6.1 Ταυτότητα

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `building_milestones` (via `COLLECTIONS.BUILDING_MILESTONES`) |
| **TypeScript** | `BuildingMilestone` (`src/types/building/milestone.ts`) |
| **ID Pattern** | Enterprise ID |
| **Tenant Isolation** | `companyId` |
| **API Route** | `GET/POST/PATCH/DELETE /api/buildings/[buildingId]/milestones` |
| **Code Pattern** | MS-001, MS-002, ... (auto-generated) |

### 6.2 Πλήρης Κατάλογος Πεδίων

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Enterprise ID |
| 2 | `buildingId` | string | Yes | FK → buildings |
| 3 | `companyId` | string | Yes | Tenant isolation |
| 4 | `title` | string | Yes | Τίτλος ορόσημου |
| 5 | `description` | string | No | Περιγραφή |
| 6 | `date` | string (ISO) | Yes | Ημ/νία ορόσημου |
| 7 | `status` | MilestoneStatus | Yes | `completed` / `in-progress` / `pending` / `delayed` |
| 8 | `progress` | number (0-100) | Yes | Ποσοστό ολοκλήρωσης |
| 9 | `type` | MilestoneType | Yes | `start` / `construction` / `systems` / `finishing` / `delivery` |
| 10 | `order` | number | Yes | Σειρά εμφάνισης |
| 11 | `code` | string | Yes | Κωδικός (MS-001 format) |
| 12 | `phaseId` | string | No | FK → construction_phases (optional link) |
| 13 | `createdAt` | string (ISO) | No | Ημ/νία δημιουργίας |
| 14 | `updatedAt` | string (ISO) | No | Ημ/νία ενημέρωσης |
| 15 | `createdBy` | string | No | User ID δημιουργού |
| 16 | `updatedBy` | string | No | User ID ενημέρωσης |

### 6.3 Enums (Milestones)

**MilestoneStatus** (4 τιμές):
`completed`, `in-progress`, `pending`, `delayed`

**MilestoneType** (5 τιμές):
`start`, `construction`, `systems`, `finishing`, `delivery`

---

## 5. Σχέσεις μεταξύ ΟΛΩΝ των Οντοτήτων

### 5.1 Διάγραμμα Σχέσεων

```
                    ┌─────────────┐
                    │  PROJECTS   │
                    └──────┬──────┘
                           │ projectId
                    ┌──────┴──────┐
                    │  BUILDINGS  │
                    └──────┬──────┘
                           │ buildingId
          ┌────────────────┼────────────────┐
          │                │                │
  ┌───────┴───────┐ ┌─────┴──────┐  ┌──────┴──────┐
  │ CONSTRUCTION  │ │    BOQ     │  │  BUILDING   │
  │   PHASES      │ │   ITEMS   │  │ MILESTONES  │
  │ (PH-001)      │ │ (OIK-2)   │  │ (MS-001)    │
  └───────┬───────┘ └─────┬──────┘  └─────────────┘
          │               │ linkedPhaseId       ▲
          │ phaseId        │ linkedTaskId   phaseId (opt)
  ┌───────┴───────┐       │
  │ CONSTRUCTION  │◄──────┘
  │   TASKS       │
  │ (TSK-001)     │
  └───────┬───────┘
          │ taskId
  ┌───────┴───────┐
  │  RESOURCE     │
  │ ASSIGNMENTS   │
  │ (crasn_xxx)   │──── contactId ────► CONTACTS
  └───────────────┘

  ┌───────────────┐
  │ CONSTRUCTION  │ = Frozen snapshot of:
  │  BASELINES    │   - phases[] (denormalized)
  │ (cbase_xxx)   │   - tasks[] (denormalized)
  └───────────────┘

  EXTERNAL LINKS:
  BOQ ──── linkedContractorId ────► CONTACTS
  BOQ ──── linkedInvoiceId ────► ACCOUNTING_INVOICES
  BOQ ──── linkedUnitId ────► UNITS
  BOQ ──── categoryCode ────► BOQ_CATEGORIES (master data)
  PO items ──── boqItemId ────► BOQ_ITEMS
```

### 5.2 Αναλυτικός Πίνακας Σχέσεων (ΟΛΕΣ οι οντότητες)

| # | Source | Πεδίο | Target | Σχέση | Περιγραφή |
|---|--------|-------|--------|-------|-----------|
| 1 | **boq_items** | `projectId` | projects | N:1 | BOQ ανήκει σε έργο |
| 2 | **boq_items** | `buildingId` | buildings | N:1 | BOQ ανήκει σε κτίριο |
| 3 | **boq_items** | `linkedUnitId` | units | N:1 | BOQ σε επίπεδο μονάδας (scope=unit) |
| 4 | **boq_items** | `linkedPhaseId` | construction_phases | N:1 | BOQ συνδέεται με φάση |
| 5 | **boq_items** | `linkedTaskId` | construction_tasks | N:1 | BOQ συνδέεται με εργασία |
| 6 | **boq_items** | `linkedInvoiceId` | accounting_invoices | N:1 | BOQ συνδέεται με τιμολόγιο |
| 7 | **boq_items** | `linkedContractorId` | contacts | N:1 | Εργολάβος |
| 8 | **boq_items** | `categoryCode` | boq_categories | N:1 | ΑΤΟΕ κατηγορία (master data) |
| 9 | **construction_phases** | `buildingId` | buildings | N:1 | Φάση ανήκει σε κτίριο |
| 10 | **construction_tasks** | `phaseId` | construction_phases | N:1 | Εργασία ανήκει σε φάση |
| 11 | **construction_tasks** | `buildingId` | buildings | N:1 | Denormalized FK |
| 12 | **construction_tasks** | `dependencies[]` | construction_tasks | N:M | CPM dependencies |
| 13 | **resource_assignments** | `taskId` | construction_tasks | N:1 | Πόρος σε εργασία |
| 14 | **resource_assignments** | `phaseId` | construction_phases | N:1 | Denormalized for histograms |
| 15 | **resource_assignments** | `buildingId` | buildings | N:1 | Denormalized FK |
| 16 | **resource_assignments** | `contactId` | contacts | N:1 | Εργάτης (αν worker) |
| 17 | **construction_baselines** | `buildingId` | buildings | N:1 | Baseline ανήκει σε κτίριο |
| 18 | **construction_baselines** | `phases[]` | (denormalized) | embed | Frozen copy φάσεων |
| 19 | **construction_baselines** | `tasks[]` | (denormalized) | embed | Frozen copy εργασιών |
| 20 | **building_milestones** | `buildingId` | buildings | N:1 | Ορόσημο ανήκει σε κτίριο |
| 21 | **building_milestones** | `phaseId` | construction_phases | N:1 | Optional link σε φάση |
| 22 | **purchase_orders** | `items[].boqItemId` | boq_items | N:M | PO line items → BOQ |
| 23 | **purchase_orders** | `buildingId` | buildings | N:1 | PO ανήκει σε κτίριο |

### 5.3 Deletion Guard (Referential Integrity)

| Entity Deleted | Blocked By | Field |
|---------------|------------|-------|
| Project | construction_phases | projectId |
| Building | building_milestones | buildingId |
| Unit | boq_items | linkedUnitId |

---

## 6. Report Builder Impact

### 6.1 BOQ Items — Domain D4

**Tier 1 (Flat Table) — Primary columns:**

| Στήλη | Πεδίο | Τύπος | Σημείωση |
|-------|-------|-------|----------|
| Τίτλος | `title` | text | |
| Κατηγορία ΑΤΟΕ | `categoryCode` | text | Join → boq_categories.nameEL |
| Εύρος | `scope` | enum | building / unit |
| Μονάδα | `unit` | enum | m, m2, m3, kg, κλπ |
| Εκτ. Ποσότητα | `estimatedQuantity` | number | |
| Πραγμ. Ποσότητα | `actualQuantity` | number | |
| Φύρα % | `wasteFactor` | number | ×100 για εμφάνιση |
| Κόστος Υλικών/μον. | `materialUnitCost` | currency | |
| Κόστος Εργασίας/μον. | `laborUnitCost` | currency | |
| Κόστος Εξοπλ./μον. | `equipmentUnitCost` | currency | |
| Status | `status` | enum | 5-state lifecycle |
| QA | `qaStatus` | enum | |
| Πηγή | `source` | enum | manual/template/dxf/κλπ |
| Μέθοδος Μέτρησης | `measurementMethod` | enum | |
| Σημειώσεις | `notes` | text | |

**Tier 1 — Computed/Joined columns:**

| Στήλη | Join / Formula | Τύπος | Σημείωση |
|-------|----------------|-------|----------|
| Κτίριο | JOIN buildings.name | text | |
| Έργο | JOIN projects.name | text | |
| Μονάδα (αν unit) | JOIN units.name | text | Μόνο αν scope=unit |
| Φάση | JOIN construction_phases.name | text | via linkedPhaseId |
| Εργασία | JOIN construction_tasks.name | text | via linkedTaskId |
| Εργολάβος | JOIN contacts.displayName | text | via linkedContractorId |
| Συν. Κόστος (εκτ.) | COMPUTED: gross × unitCost | currency | CostBreakdown.totalCost |
| Συν. Κόστος (πραγμ.) | COMPUTED: actual × unitCost | currency | |
| Απόκλιση % | COMPUTED: (actual-est)/est | percent | VarianceResult |
| Κατηγορία (EL) | JOIN boq_categories.nameEL | text | |

### 6.2 Construction Phases — Domain D1

**Tier 1 (Flat Table):**

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Κωδικός | `code` | text |
| Όνομα | `name` | text |
| Κατάσταση | `status` | enum |
| Προγρ. Έναρξη | `plannedStartDate` | date |
| Προγρ. Λήξη | `plannedEndDate` | date |
| Πραγμ. Έναρξη | `actualStartDate` | date |
| Πραγμ. Λήξη | `actualEndDate` | date |
| Πρόοδος % | `progress` | number |
| Λόγος Καθυστ. | `delayReason` | enum |
| Κτίριο | JOIN buildings.name | text |
| Έργο | JOIN projects.name (via building) | text |
| Αρ. Εργασιών | COUNT construction_tasks | number |
| Αρ. BOQ Items | COUNT boq_items WHERE linkedPhaseId | number |
| Κόστος Φάσης | SUM boq_items.totalCost | currency |
| Αρ. Πόρων | COUNT resource_assignments | number |
| Διάρκεια (ημέρες) | COMPUTED: endDate - startDate | number |
| Καθυστέρηση (ημ.) | COMPUTED: actual vs planned | number |

### 6.3 Construction Tasks — Domain D2

**Tier 1 (Flat Table):**

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Κωδικός | `code` | text |
| Όνομα | `name` | text |
| Φάση | JOIN construction_phases.name | text |
| Κατάσταση | `status` | enum |
| Προγρ. Έναρξη | `plannedStartDate` | date |
| Προγρ. Λήξη | `plannedEndDate` | date |
| Πραγμ. Έναρξη | `actualStartDate` | date |
| Πραγμ. Λήξη | `actualEndDate` | date |
| Πρόοδος % | `progress` | number |
| Αρ. Dependencies | COUNT dependencies[] | number |
| Αρ. Πόρων | COUNT resource_assignments | number |
| Ώρες Πόρων | SUM resource_assignments.allocatedHours | number |
| Λόγος Καθυστ. | `delayReason` | enum |
| Κτίριο | JOIN buildings.name | text |

### 6.4 Resource Assignments — Domain D3

**Tier 1 (Flat Table):**

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Πόρος | `resourceName` | text |
| Τύπος | `resourceType` | enum |
| Ώρες | `allocatedHours` | number |
| Εργασία | JOIN construction_tasks.name | text |
| Φάση | JOIN construction_phases.name | text |
| Κτίριο | JOIN buildings.name | text |
| Επαφή | JOIN contacts.displayName | text |
| Εξοπλισμός | `equipmentLabel` | text |

### 6.5 Building Milestones

**Tier 1 (Flat Table):**

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Κωδικός | `code` | text |
| Τίτλος | `title` | text |
| Τύπος | `type` | enum |
| Κατάσταση | `status` | enum |
| Ημ/νία | `date` | date |
| Πρόοδος % | `progress` | number |
| Κτίριο | JOIN buildings.name | text |
| Φάση | JOIN construction_phases.name | text |

### 6.6 Tier 2 (Row Repetition) — Arrays

| Οντότητα | Array | Πεδία ανά row | Μέγιστο πλήθος |
|----------|-------|---------------|----------------|
| BOQ Item | (flat — no arrays) | — | — |
| Phase | tasks (reverse query) | code, name, status, progress | ~50 |
| Task | dependencies[] | dependent task code, name | ~10 |
| Task | resource_assignments (reverse) | resourceName, type, hours | ~20 |
| Baseline | phases[] (denormalized) | code, name, status, dates | ~20 |
| Baseline | tasks[] (denormalized) | code, name, status, dates | ~100 |

### 6.7 Tier 3 (Card PDF) — Construction Phase Card

```
┌─────────────────────────────────────────┐
│ [LOGO] ΦΑΣΗ: [code] — [name]           │
│        Κτίριο: [building]              │
├─────────────────────────────────────────┤
│ ΚΑΤΑΣΤΑΣΗ                                │
│ Status: [status] | Πρόοδος: [progress]% │
│ Καθυστέρηση: [delayReason]             │
├─────────────────────────────────────────┤
│ ΧΡΟΝΟΔΙΑΓΡΑΜΜΑ                           │
│ Planned: [startDate] → [endDate]       │
│ Actual:  [actualStart] → [actualEnd]   │
│ Διάρκεια: [X] ημέρες                   │
├─────────────────────────────────────────┤
│ ΕΡΓΑΣΙΕΣ                                 │
│ [πίνακας: Code, Name, Status, Progress]│
├─────────────────────────────────────────┤
│ ΠΟΡΟΙ                                    │
│ [πίνακας: Name, Type, Hours]           │
├─────────────────────────────────────────┤
│ BOQ ΚΟΣΤΟΛΟΓΗΣΗ                          │
│ [πίνακας: ΑΤΟΕ, Title, Qty, Cost]      │
│ ΣΥΝΟΛΟ: [X] EUR                         │
├─────────────────────────────────────────┤
│ ΣΗΜΕΙΩΣΕΙΣ                               │
│ [description] [delayNote]               │
└─────────────────────────────────────────┘
```

### 6.8 Tier 3 — BOQ Item Card

```
┌─────────────────────────────────────────┐
│ [LOGO] BOQ: [categoryCode] — [title]   │
│        Κτίριο: [building]              │
├─────────────────────────────────────────┤
│ ΠΟΣΟΤΗΤΕΣ                                │
│ Εκτίμηση: [estQty] [unit]             │
│ Πραγματ.: [actQty] [unit]             │
│ Φύρα: [wasteFactor]% ([wastePolicy])   │
│ Gross: [grossQty] [unit]              │
├─────────────────────────────────────────┤
│ ΚΟΣΤΟΛΟΓΗΣΗ                              │
│ Υλικά: [material] EUR/[unit]           │
│ Εργασία: [labor] EUR/[unit]            │
│ Εξοπλ.: [equipment] EUR/[unit]         │
│ ΣΥΝΟΛΟ: [totalCost] EUR               │
│ Authority: [priceAuthority]             │
├─────────────────────────────────────────┤
│ ΣΥΝΔΕΣΕΙΣ                                │
│ Φάση: [phaseName] | Εργασία: [taskName]│
│ Εργολάβος: [contractorName]            │
│ Τιμολόγιο: [invoiceId]                │
├─────────────────────────────────────────┤
│ ΠΟΙΟΤΗΤΑ                                 │
│ Status: [status] | QA: [qaStatus]      │
│ Source: [source] | Method: [method]     │
├─────────────────────────────────────────┤
│ ΣΗΜΕΙΩΣΕΙΣ                               │
│ [notes]                                 │
└─────────────────────────────────────────┘
```

---

## 7. Στατιστικά

| Μέτρηση | Τιμή |
|---------|------|
| **Οντότητες** | **6** (BOQ, Phases, Tasks, Resources, Baselines, Milestones) |
| Πεδία BOQ Item | 31 |
| Πεδία BOQ Category | 14 |
| Πεδία Construction Phase | 20 |
| Πεδία Construction Task | 22 |
| Πεδία Resource Assignment | 15 |
| Πεδία Construction Baseline | 10 |
| Πεδία Building Milestone | 16 |
| **Σύνολο πεδίων (όλες οι οντότητες)** | **128** |
| BOQ enums | 8 (BOQMeasurementUnit 11v, BOQItemStatus 5v, BOQSource 6v, MeasurementMethod 6v, QAStatus 4v, WastePolicy 2v, SourceAuthority 3v, CategoryLevel 3v) |
| Phase/Task enums | 3 (PhaseStatus 5v, TaskStatus 5v, DelayReason 5v) |
| Resource enums | 1 (ResourceType 2v) |
| Milestone enums | 2 (MilestoneStatus 4v, MilestoneType 5v) |
| **Σύνολο enum types** | **14** |
| **Σύνολο enum values** | **56** |
| Cross-entity references | 23 |
| Computed types (non-stored) | 4 (CostBreakdown, PriceResolution, VarianceResult, BOQCategoryCost) |
| Firestore collections | 9 (boq_items, boq_categories, boq_price_lists, boq_templates, construction_phases, construction_tasks, construction_baselines, construction_resource_assignments, building_milestones) |
| API route groups | 4 (construction-phases, construction-baselines, construction-resource-assignments, milestones) |
| Services | 6 (boq-service, boq-repository, cost-engine, resource-assignment.service, cpm-calculator, evm-calculator) |

---

## 8. Gap Analysis — Industry Benchmarking (2026-03-30)

### 8.1 Μεθοδολογία

Web research σε 5 construction management platforms:
- **Procore** (construction management leader)
- **Primavera P6 / MS Project** (scheduling, EVM)
- **CostX / Bluebeam** (quantity surveying, BOQ)
- **Buildertrend** (residential construction)
- **PlanGrid / Autodesk Build** (field reports)

### 8.2 Αποφάσεις

| # | Gap | Απόφαση | Phase | Domains |
|---|-----|---------|-------|---------|
| G1 | Πλήρες EVM (SPI, SV) | ✅ Υλοποιήθηκε (document-level) | 6a | Phases, Tasks |
| G2 | Float/Slack/Critical Path | ✅ Υλοποιήθηκε (isCritical flag) | 6a | Tasks |
| G3+G7 | actualHours + utilization% | ✅ Υλοποιήθηκε | 6a | Resources |
| G4 | Auto Risk Indicator | ✅ Υλοποιήθηκε (On Track/At Risk/Late) | 6a | Phases, Tasks |
| G5 | Cost per m² | 📋 Pending | 6b | BOQ |
| G6 | BOQ Revision Tracking | 📋 Post-Phase 6 | Future | BOQ |
| G8 | Budget columns (Est./Act./Rem.) | 📋 Pending (cross-doc aggregation) | 6b | Phases |

### 8.3 Νέο πεδίο: actualHours

Προστέθηκε στο `ConstructionResourceAssignment` type (`src/types/building/construction.ts`):
```typescript
actualHours?: number;  // Actual hours worked — for utilization tracking
```

### 8.4 EVM Implementation Notes

Τα πλήρη EVM πεδία (PV, EV, AC, CV, SPI, CPI, EAC, ETC, VAC, TCPI) απαιτούν
cross-document aggregation (BOQ costs per phase). Στο Phase 6a υλοποιήθηκαν
**document-level estimates** (SPI, SV) βασισμένα στο progress vs elapsed time.

Για full EVM με BOQ cost integration, απαιτείται post-processing step στο
`report-query-executor.ts` (Phase 6b ή μεταγενέστερη).
