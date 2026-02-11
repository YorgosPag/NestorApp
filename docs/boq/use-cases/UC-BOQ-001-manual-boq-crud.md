# UC-BOQ-001: Manual BOQ CRUD

**Parent ADR:** ADR-175 — Σύστημα Επιμετρήσεων (Quantity Surveying / BOQ)
**Phase:** 1A (Types + Service + Repository) + 1B (UI Tab + CRUD)
**Status:** Draft — Implementation Contract
**Date:** 2026-02-11
**Depends on:** —
**Blocks:** UC-BOQ-002, UC-BOQ-003, UC-BOQ-006

---

## 1. Σκοπός

Χειρωνακτική δημιουργία, ανάγνωση, τροποποίηση και διαγραφή BOQ items στο επίπεδο **κτιρίου**. Αποτελεί τον πυρήνα ολόκληρου του συστήματος επιμετρήσεων — χωρίς αυτό τα υπόλοιπα UC δεν λειτουργούν.

---

## 2. Actors

| Actor | Ρόλος | Ενέργειες |
|-------|-------|-----------|
| **Μηχανικός** | Κύριος χρήστης | CRUD items, scope selection, quantity entry |
| **Εργοδηγός** | Field user | Ενημέρωση actual quantities |
| **Διαχειριστής** | Admin | Governance transitions (approve, certify, lock) |

---

## 3. Preconditions

1. Υπάρχει Company + Project + Building στο Firestore
2. Master BOQ Categories (ΑΤΟΕ) φορτωμένες στο `boq_categories` collection ή στο `config/boq-categories.ts`
3. Ο χρήστης έχει authentication + company membership

---

## 4. Data Model (σχετικό subset)

### 4.1 Κύρια Entities

**BOQItem** — Πλήρες model από ADR-175 §5.3:

```typescript
interface BOQItem {
  id: string;
  companyId: string;
  projectId: string;
  buildingId: string;
  scope: 'building' | 'unit';
  linkedUnitId: string | null;
  categoryCode: string;
  ifcQuantityType: IfcQuantityType;
  description: string;
  specifications: string | null;

  // Ποσότητες
  estimatedNetQuantity: number;
  orderedQuantity: number | null;
  installedQuantity: number | null;
  certifiedQuantity: number | null;
  paidQuantity: number | null;
  unit: MeasurementUnit;

  // Φύρα
  wasteFactor: number;

  // Κόστος
  materialUnitCost: number;
  laborUnitCost: number;
  equipmentUnitCost: number;
  priceOverridden: boolean;

  // Provenance
  source: 'manual' | 'dxf-auto' | 'dxf-verified';
  measurementMethod: MeasurementMethod;
  catalogVersion: string;
  baselineVersion: number;
  drawingRevisionId: string | null;

  // Connections (nullable — bridge now, build later)
  linkedPhaseId: string | null;
  linkedTaskId: string | null;
  linkedFloorId: string | null;
  linkedRoomType: RoomType | null;
  linkedInvoiceId: string | null;
  linkedContractorId: string | null;

  // Change Order (bridge)
  changeOrderId: string | null;
  isOriginalBudget: boolean;

  // DXF confidence (bridge — Phase C)
  confidenceScore: number | null;
  qaStatus: 'pending' | 'accepted' | 'rejected' | null;
  qaReasonCodes: string[];

  // Governance
  status: BOQItemStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

type BOQItemStatus = 'draft' | 'submitted' | 'approved' | 'certified' | 'locked';
```

**BOQCategory** — Πλήρες model από ADR-175 §5.2 (master data, shared):

```typescript
interface BOQCategory {
  id: string;
  code: string;
  legacyCode: string | null;
  nameEl: string;
  nameEn: string;
  level: 'group' | 'category' | 'subcategory';
  parentCode: string | null;
  ifcQuantityType: IfcQuantityType;
  defaultUnit: MeasurementUnit;
  allowedUnits: MeasurementUnit[];
  defaultWastePct: number;
  wastePolicy: 'none' | 'optional' | 'required';
  active: boolean;
  sortOrder: number;
  tags: string[];
  synonymsEl: string[];
  synonymsEn: string[];
  sourceAuthority: 'GGDE' | 'SATE' | 'INTERNAL';
  sourceVersion: string;
  deprecated: boolean;
  replacementCode: string | null;
  createdAt: string;
  updatedAt: string;
}
```

**BOQSummary** — Computed rollup (δεν αποθηκεύεται):

```typescript
interface BOQSummary {
  buildingId: string;
  totalItems: number;
  totalMaterialCost: number;
  totalLaborCost: number;
  totalEquipmentCost: number;
  totalCost: number;
  completionPercentage: number;
  byCategory: Record<string, {
    categoryCode: string;
    categoryName: string;
    itemCount: number;
    totalCost: number;
  }>;
}
```

### 4.2 Computed Values (ΔΕΝ αποθηκεύονται)

```typescript
// Για κάθε BOQItem:
grossQuantity = estimatedNetQuantity × (1 + wasteFactor)
totalMaterialCost = grossQuantity × materialUnitCost
totalLaborCost = grossQuantity × laborUnitCost
totalEquipmentCost = grossQuantity × equipmentUnitCost
totalCost = totalMaterialCost + totalLaborCost + totalEquipmentCost
variance = certifiedQuantity
  ? ((certifiedQuantity - estimatedNetQuantity) / estimatedNetQuantity × 100)
  : null
```

### 4.3 Default Values (νέο BOQItem)

```typescript
const BOQ_ITEM_DEFAULTS: Partial<BOQItem> = {
  scope: 'building',
  linkedUnitId: null,
  specifications: null,
  orderedQuantity: null,
  installedQuantity: null,
  certifiedQuantity: null,
  paidQuantity: null,
  wasteFactor: 0,           // Override από category default
  materialUnitCost: 0,
  laborUnitCost: 0,
  equipmentUnitCost: 0,
  priceOverridden: false,
  source: 'manual',
  measurementMethod: 'manual',
  baselineVersion: 1,
  drawingRevisionId: null,
  linkedPhaseId: null,
  linkedTaskId: null,
  linkedFloorId: null,
  linkedRoomType: null,
  linkedInvoiceId: null,
  linkedContractorId: null,
  changeOrderId: null,
  isOriginalBudget: true,
  confidenceScore: null,
  qaStatus: null,
  qaReasonCodes: [],
  status: 'draft',
  notes: null,
};
```

---

## 5. Happy Path — Δημιουργία BOQ Item

### 5.1 Flow: Νέο Item

```
1. Χρήστης → Building Detail → Tab "Επιμετρήσεις"
2. Βλέπει κατηγορίες ΑΤΟΕ (accordion) + summary cards
3. Click "+ Νέο Item" ή "+" μέσα σε κατηγορία
4. Ανοίγει modal/drawer "Νέα Εργασία" (SCREEN 2 — ADR-175 §4.4.3)
5. Επιλέγει κατηγορία → auto-fill:
   • μονάδα μέτρησης (defaultUnit)
   • φύρα (defaultWastePct)
   • ifcQuantityType
6. Συμπληρώνει:
   • Περιγραφή (required)
   • Scope: κτίριο ή μονάδα
   • Αν μονάδα → επιλέγει μονάδα από dropdown
   • estimatedNetQuantity (required)
   • Κόστος ανά μονάδα (manual ή μέσω τιμοκαταλόγου — UC-BOQ-002)
7. Σύστημα υπολογίζει real-time:
   • grossQuantity
   • totalCost (materials + labor + equipment)
8. Click "Αποθήκευση"
9. Validation:
   • description μη κενό
   • estimatedNetQuantity > 0
   • unit ∈ allowedUnits[categoryCode]
   • κόστος ≥ 0
10. Firestore write → boq_items collection
11. Summary cards ενημερώνονται
12. Item εμφανίζεται στην κατηγορία
```

### 5.2 Flow: Inline Edit

```
1. Χρήστης βλέπει item σε πίνακα κατηγορίας
2. Click σε πεδίο (ποσότητα, φύρα, κόστος)
3. Πεδίο γίνεται editable (inline)
4. Τροποποίηση τιμής
5. Blur/Enter → save + summary refresh
6. Governance check: αν status >= 'submitted' → block edit
   (εκτός αν role = admin → warning modal)
```

### 5.3 Flow: Governance Transition

```
1. Item σε status 'draft'
2. Μηχανικός → Click "Υποβολή" → status = 'submitted'
3. Διαχειριστής → Click "Έγκριση" → status = 'approved'
   • Κλειδώνουν: actualQuantity, unitCosts, wasteFactor
   • Αλλαγές μόνο μέσω Change Order (UC-BOQ-005)
4. Μηχανικός (Πιστοποιητής) → Click "Πιστοποίηση" → status = 'certified'
   • certifiedQuantity πρέπει να είναι συμπληρωμένο
5. Τελική κλείδωμα → status = 'locked'
   • Κανένα πεδίο δεν μπορεί να αλλάξει
```

### 5.4 Flow: Διαγραφή Item

```
1. Item σε status 'draft' → soft delete (archived flag ή Firestore delete)
2. Item σε status >= 'submitted' → ΑΠΑΓΟΡΕΥΕΤΑΙ διαγραφή
   • Μόνο ακύρωση (cancel) → δημιουργεί αρνητική εγγραφή ή Change Order
```

---

## 6. Edge Cases

| # | Σενάριο | Συμπεριφορά |
|---|---------|-------------|
| 1 | Κατηγορία deprecated | Warning + link to replacementCode, block save αν replacementCode != null |
| 2 | Unit δεν ανήκει σε allowedUnits | Validation error, highlight πεδίο |
| 3 | Duplicate detection | Ίδιο buildingId + categoryCode + description → warning (not block) |
| 4 | Μονάδα αλλάζει scope mid-flow | Reset linkedUnitId → null, re-validate |
| 5 | wasteFactor > 15% | Visual warning (κίτρινο), allow save |
| 6 | estimatedNetQuantity = 0 | Validation error — ποσότητα πρέπει > 0 |
| 7 | Edit approved item | Block edit → show "Αλλαγή μέσω Change Order" prompt |
| 8 | Concurrent edit (2 users) | Firestore optimistic locking (updatedAt check) |
| 9 | Building without phases (Gantt) | linkedPhaseId = null, BOQ λειτουργεί κανονικά |
| 10 | Building without units | scope = 'building' only, unit scope disabled |

---

## 7. UI Components

### 7.1 Building Tab — MeasurementsTabContent

**Τοποθεσία:** Building Detail → νέο tab μετά το "Χρονοδιάγραμμα"

**Δομή:**
```
<MeasurementsTabContent buildingId={buildingId}>
  <BOQSummaryCards summary={summary} />
  <BOQFilters scope={scope} status={status} category={category} />
  <BOQCategoryAccordion categories={categories}>
    <BOQItemTable items={items} onEdit={...} onDelete={...} />
  </BOQCategoryAccordion>
  <BOQActionsBar onAdd={...} onImport={...} onExport={...} onPrint={...} />
</MeasurementsTabContent>
```

**Summary Cards:** 4 cards:
- Υλικά (€)
- Εργασίες (€)
- Εξοπλισμός (€)
- ΣΥΝΟΛΟ (€)

**Φίλτρα:**
- Scope: Όλα | Κτίριο | Μονάδα
- Status: Όλα | Draft | Submitted | Approved | Certified | Locked
- Κατηγορία: Dropdown (ΑΤΟΕ groups)
- Αναζήτηση: Free text

### 7.2 Item Editor (Modal/Drawer)

Βλέπε ADR-175 §4.4.3 SCREEN 2. Modal με sections:
1. Κατηγορία + Περιγραφή
2. Scope (building/unit toggle)
3. Ποσότητες (estimated, waste, gross)
4. Κόστος ανά μονάδα (3 πεδία + inherited/overridden indicator)
5. Σύνολα (auto-computed, read-only)
6. Συνδέσεις (Gantt phase, contractor — dropdowns)
7. Status + Notes
8. Actions: Ακύρωση / Αποθήκευση

### 7.3 Category Accordion

- Κλειστό: `▶ ΟΙΚ-2: Σκυροδέματα (5 items — 22.400€)`
- Ανοιχτό: πίνακας items (description, unit, qty, waste%, cost)
- "+" button μέσα σε κάθε κατηγορία

### 7.4 Variance Indicators

- Πράσινο badge: ≤5% απόκλιση
- Κίτρινο badge: 5–15% απόκλιση
- Κόκκινο badge: >15% απόκλιση
- Εμφανίζεται μόνο αν certifiedQuantity ≠ null

---

## 8. Service Operations

### 8.1 BOQ Service (boq-service.ts)

```typescript
interface BOQService {
  // CRUD
  createItem(buildingId: string, data: CreateBOQItemInput): Promise<BOQItem>;
  getItem(itemId: string): Promise<BOQItem | null>;
  updateItem(itemId: string, data: UpdateBOQItemInput): Promise<BOQItem>;
  deleteItem(itemId: string): Promise<void>;

  // Queries
  getItemsByBuilding(buildingId: string, filters?: BOQFilters): Promise<BOQItem[]>;
  getItemsByCategory(buildingId: string, categoryCode: string): Promise<BOQItem[]>;
  getItemsByUnit(unitId: string): Promise<BOQItem[]>;

  // Summary
  getBuildingSummary(buildingId: string): Promise<BOQSummary>;
  getProjectSummary(projectId: string): Promise<BOQProjectSummary>;

  // Governance
  submitItem(itemId: string): Promise<BOQItem>;      // draft → submitted
  approveItem(itemId: string): Promise<BOQItem>;     // submitted → approved
  certifyItem(itemId: string): Promise<BOQItem>;     // approved → certified
  lockItem(itemId: string): Promise<BOQItem>;         // certified → locked

  // Batch
  createItemsFromTemplate(buildingId: string, templateId: string): Promise<BOQItem[]>;
}
```

### 8.2 BOQ Repository (boq-repository.ts)

```typescript
interface BOQRepository {
  create(item: BOQItem): Promise<string>;
  get(id: string): Promise<BOQItem | null>;
  update(id: string, data: Partial<BOQItem>): Promise<void>;
  delete(id: string): Promise<void>;
  queryByBuilding(buildingId: string, filters?: FirestoreFilters): Promise<BOQItem[]>;
  queryByProject(projectId: string): Promise<BOQItem[]>;
}
```

### 8.3 Cost Engine (cost-engine.ts)

```typescript
interface CostEngine {
  computeGrossQuantity(netQty: number, wasteFactor: number): number;
  computeItemCost(item: BOQItem): BOQItemCostBreakdown;
  computeCategoryCost(items: BOQItem[]): BOQCategoryCost;
  computeBuildingSummary(items: BOQItem[]): BOQSummary;
  computeVariance(estimated: number, certified: number | null): VarianceResult | null;
}
```

---

## 9. Firestore

### 9.1 Collections

```
boq_items                     # Κύριο collection
boq_categories                # Master categories (shared/read-mostly)
boq_templates                 # Πρότυπα (π.χ. "Τυπική κατοικία 100m²")
```

### 9.2 Composite Indexes (boq_items)

```
companyId ASC, projectId ASC, buildingId ASC
buildingId ASC, categoryCode ASC, createdAt ASC
buildingId ASC, scope ASC, status ASC
buildingId ASC, source ASC, status ASC
buildingId ASC, linkedPhaseId ASC
buildingId ASC, linkedUnitId ASC
```

### 9.3 Security Rules

```
- Authenticated users only
- companyId must match user's company claim
- Write: only if status = 'draft' OR user.role in ['admin', 'engineer']
- Delete: only if status = 'draft'
```

---

## 10. Affected Files

### 10.1 Νέα Αρχεία (Phase 1A — Types + Service)

```
src/types/measurements/boq.ts                        # BOQItem, BOQCategory, BOQSummary types
src/types/measurements/cost.ts                       # CostBreakdown, PriceListItem types
src/types/measurements/units.ts                      # MeasurementUnit, IfcQuantityType, RoomType
src/types/measurements/index.ts                      # Barrel exports
src/services/measurements/boq-service.ts             # CRUD + governance operations
src/services/measurements/boq-repository.ts          # Firestore access layer
src/services/measurements/cost-engine.ts             # Computed values, summaries
src/services/measurements/index.ts                   # Barrel exports
src/config/boq-categories.ts                         # ΑΤΟΕ master categories (static data)
src/i18n/locales/el/measurements.json                # Ελληνικά translations
src/i18n/locales/en/measurements.json                # English translations
```

### 10.2 Νέα Αρχεία (Phase 1B — UI)

```
src/components/building-management/tabs/MeasurementsTabContent.tsx
src/components/building-management/measurements/BOQSummaryCards.tsx
src/components/building-management/measurements/BOQFilters.tsx
src/components/building-management/measurements/BOQCategoryAccordion.tsx
src/components/building-management/measurements/BOQItemTable.tsx
src/components/building-management/measurements/BOQItemRow.tsx
src/components/building-management/measurements/BOQItemEditor.tsx    # Modal/Drawer
src/components/building-management/measurements/BOQActionsBar.tsx
src/components/building-management/measurements/BOQVarianceBadge.tsx
src/components/building-management/measurements/index.ts
```

### 10.3 Τροποποιούμενα Αρχεία

```
src/config/firestore-collections.ts                  # +BOQ_ITEMS, +BOQ_CATEGORIES, +BOQ_TEMPLATES
src/i18n/locales/el/navigation.json                  # +measurements menu item
src/i18n/locales/en/navigation.json                  # +measurements menu item
src/components/building-management/BuildingTabs.tsx   # +Measurements tab (ή ανάλογο)
firestore.indexes.json                               # +composite indexes
```

---

## 11. Acceptance Criteria

### 11.1 Phase 1A — Types + Service

- [ ] Όλα τα TypeScript types compile χωρίς errors
- [ ] BOQService: createItem, getItem, updateItem, deleteItem λειτουργούν
- [ ] BOQRepository: Firestore CRUD + queries λειτουργούν
- [ ] CostEngine: grossQuantity, totalCost, variance υπολογίζονται σωστά
- [ ] Default values εφαρμόζονται σωστά σε νέο item
- [ ] Governance transitions: draft→submitted→approved→certified→locked
- [ ] Block edit σε approved/certified/locked items
- [ ] Category auto-fill (unit, waste, ifcType) λειτουργεί
- [ ] Composite indexes deployed στο Firebase

### 11.2 Phase 1B — UI

- [ ] Tab "Επιμετρήσεις" εμφανίζεται στο Building Detail
- [ ] Summary cards δείχνουν σωστά σύνολα
- [ ] Category accordion ανοίγει/κλείνει
- [ ] Item table δείχνει items ανά κατηγορία
- [ ] "+ Νέο Item" ανοίγει editor modal
- [ ] Editor: κατηγορία auto-fill (unit, waste)
- [ ] Editor: scope toggle (building/unit)
- [ ] Editor: cost computation real-time
- [ ] Editor: validation errors εμφανίζονται
- [ ] Inline edit λειτουργεί σε draft items
- [ ] Filters (scope, status, category, search) λειτουργούν
- [ ] Variance badges εμφανίζονται σωστά (πράσινο/κίτρινο/κόκκινο)
- [ ] Governance buttons εμφανίζονται ανάλογα με status + role
- [ ] i18n: EL + EN translations

---

## 12. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Query time (building items) | < 500ms για ≤ 500 items |
| Real-time cost computation | < 50ms |
| Concurrent users | Optimistic locking via updatedAt |
| Offline support | Όχι σε Phase 1 (Firestore SDK handles reconnect) |
| Accessibility | Keyboard navigation σε accordion + table |

---

## 13. Out of Scope (handled by other UCs)

- Price List CRUD → UC-BOQ-002
- Gantt linking UI → UC-BOQ-003
- DXF auto extraction → UC-BOQ-004
- Subcontractor/Certification → UC-BOQ-005
- Excel/PDF import-export → UC-BOQ-006

---

*Implementation contract for ADR-175 Phase 1A + 1B. Approved fields and types MUST match ADR-175 §5.*
