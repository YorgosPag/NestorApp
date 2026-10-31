# UC-BOQ-002: Price Inheritance + Waste

**Parent ADR:** ADR-175 — Σύστημα Επιμετρήσεων (Quantity Surveying / BOQ)
**Phase:** 1C (Τιμοκατάλογος + Excel Import/Export — price part)
**Status:** ⚠️ Αντικαταστάθηκε (2026-10-31): ο τιμοκατάλογος υλοποιήθηκε στο ενιαίο μοντέλο του ADR-923 §5.11 «3ε». Οι συλλογές `boq_price_*` αυτού του εγγράφου δεν υπήρξαν ποτέ. Κρατιέται ως ιστορικό σχεδιασμού.
**Date:** 2026-02-11
**Depends on:** UC-BOQ-001
**Blocks:** UC-BOQ-003, UC-BOQ-005

---

## 1. Σκοπός

Υλοποίηση **κεντρικού τιμοκαταλόγου** με 3-level inheritance (Master → Project → Item) και **αυτόματη διαχείριση φύρας** ανά κατηγορία. Πρότυπο: Autodesk, RIB iTWO, Trimble Vico.

---

## 2. Actors

| Actor | Ρόλος | Ενέργειες |
|-------|-------|-----------|
| **Διαχειριστής / Cost Manager** | Κύριος | CRUD τιμοκαταλόγου, version management |
| **Μηχανικός Έργου** | Project-level | Project overrides, waste adjustments |
| **Χρήστης** | Item-level | Item-level price override |

---

## 3. Preconditions

1. UC-BOQ-001 ολοκληρωμένο (types, service, repository)
2. BOQ Categories φορτωμένες (boq-categories.ts)
3. Τουλάχιστον 1 Company + 1 Project

---

## 4. Data Model

### 4.1 Price List (Master τιμοκατάλογος)

```typescript
interface BOQPriceList {
  id: string;
  companyId: string;
  name: string;                    // "Τιμοκατάλογος 2026"
  year: number;                    // 2026
  version: string;                 // "2026.02.v1"
  region: string | null;           // "Αττική" | "Θεσσαλονίκη" | "Νησιά" | null (default)
  isDefault: boolean;              // true = εφαρμόζεται αν δεν υπάρχει project override
  status: 'draft' | 'active' | 'archived';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}
```

### 4.2 Price Item (γραμμή τιμοκαταλόγου)

```typescript
interface BOQPriceItem {
  id: string;
  priceListId: string;            // FK → boq_price_lists
  categoryCode: string;           // 'CONCRETE_REINFORCEMENT'
  articleCode: string | null;     // 'OIK-2.1' — optional specific article
  description: string;            // "Σκυρόδεμα C25/30"
  unit: MeasurementUnit;          // 'm3'
  materialUnitCost: number;       // 85.00 €/m³
  laborUnitCost: number;          // 35.00 €/m³
  equipmentUnitCost: number;      // 13.00 €/m³
  defaultWastePct: number;        // 0.05 = 5%
  notes: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 4.3 Project Override

```typescript
interface BOQProjectOverride {
  id: string;
  projectId: string;             // FK → projects
  priceItemId: string;           // FK → boq_price_items (τι κάνει override)
  categoryCode: string;          // Για query convenience
  materialUnitCost: number | null;     // null = δεν κάνει override αυτό
  laborUnitCost: number | null;
  equipmentUnitCost: number | null;
  wastePctOverride: number | null;
  reason: string | null;         // "Νησιωτικό κόστος +10%"
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}
```

### 4.4 Inheritance Resolution Algorithm

```typescript
function resolvePrice(
  item: BOQItem,
  priceList: BOQPriceItem | null,
  projectOverride: BOQProjectOverride | null
): ResolvedPrice {
  // Επίπεδο 3: Item-level override → τελική τιμή
  if (item.priceOverridden) {
    return {
      materialUnitCost: item.materialUnitCost,
      laborUnitCost: item.laborUnitCost,
      equipmentUnitCost: item.equipmentUnitCost,
      wasteFactor: item.wasteFactor,
      source: 'item-override',
    };
  }

  // Επίπεδο 2: Project override
  if (projectOverride) {
    return {
      materialUnitCost: projectOverride.materialUnitCost ?? priceList?.materialUnitCost ?? 0,
      laborUnitCost: projectOverride.laborUnitCost ?? priceList?.laborUnitCost ?? 0,
      equipmentUnitCost: projectOverride.equipmentUnitCost ?? priceList?.equipmentUnitCost ?? 0,
      wasteFactor: projectOverride.wastePctOverride ?? priceList?.defaultWastePct ?? 0,
      source: 'project-override',
    };
  }

  // Επίπεδο 1: Master Price List
  if (priceList) {
    return {
      materialUnitCost: priceList.materialUnitCost,
      laborUnitCost: priceList.laborUnitCost,
      equipmentUnitCost: priceList.equipmentUnitCost,
      wasteFactor: priceList.defaultWastePct,
      source: 'master-inherited',
    };
  }

  // Fallback: Category defaults (from boq-categories.ts)
  return {
    materialUnitCost: 0,
    laborUnitCost: 0,
    equipmentUnitCost: 0,
    wasteFactor: getCategoryDefaultWaste(item.categoryCode),
    source: 'category-default',
  };
}
```

---

## 5. Happy Path

### 5.1 Flow: Δημιουργία Master Price List

```
1. Admin → Settings → Τιμοκατάλογοι
2. Click "+ Νέος Κατάλογος"
3. Συμπληρώνει: Όνομα, Έτος, Περιοχή (opt)
4. Αποθήκευση → status = 'draft'
5. Προσθήκη price items:
   • Επιλογή κατηγορίας → auto-fill unit + waste
   • Εισαγωγή: description, materialCost, laborCost, equipmentCost
   • Ή: Import από Excel (UC-BOQ-006)
6. Ενεργοποίηση → status = 'active'
7. Ο τιμοκατάλογος εφαρμόζεται σε ΟΛΑ τα νέα projects
```

### 5.2 Flow: Project Override

```
1. Μηχανικός → Project Detail → Tab "Τιμολόγηση"
2. Βλέπει inherited τιμές (πράσινο indicator "από τιμοκατάλογο")
3. Click "Override" σε συγκεκριμένο item
4. Εισάγει νέα τιμή + λόγο (π.χ. "Νησιωτικό κόστος")
5. Αποθήκευση → override icon (✏️) αντί inherited (🔗)
6. Override εφαρμόζεται σε ΟΛΑ τα κτίρια του έργου
```

### 5.3 Flow: Item-Level Override

```
1. Χρήστης → BOQ Item Editor
2. Βλέπει κόστος με indicator:
   • "🔗 Από τιμοκατάλογο" = inherited
   • "📋 Από project override" = project level
3. Αλλάζει τιμή → indicator γίνεται "✏️ Overridden"
4. priceOverridden = true στο Firestore
5. Αν θέλει reset → Click "Επαναφορά από τιμοκατάλογο"
   → Τιμές re-inherited, priceOverridden = false
```

### 5.4 Flow: Waste Management

```
1. Κατηγορία "Πλακάκια" → default waste 8%
2. Νέο BOQ item στα πλακάκια → wasteFactor = 0.08 (auto)
3. Χρήστης βλέπει: "Φύρα: 8% (default)"
4. Μπορεί να αλλάξει: "Φύρα: 10%" → "(override)"
5. Αν waste > 15% → κίτρινο warning
6. grossQuantity ανανεώνεται real-time
```

### 5.5 Flow: Master Price Update (cascade)

```
1. Admin αλλάζει τιμή τσιμέντου στο Master: 85€→90€
2. Σύστημα:
   • ΟΛΑ τα items με source='master-inherited' → αυτόματη ενημέρωση
   • Items με priceOverridden=true → ΔΕΝ αλλάζουν
   • Items με project override → ΔΕΝ αλλάζουν (project override κερδίζει)
3. Dashboard δείχνει: "15 items updated, 3 project-overridden, 2 item-overridden"
```

---

## 6. Edge Cases

| # | Σενάριο | Συμπεριφορά |
|---|---------|-------------|
| 1 | Κανένας τιμοκατάλογος active | Τιμές = 0, warning στο UI |
| 2 | Πολλοί active τιμοκατάλογοι ίδιας χρονιάς | Χρησιμοποιείται αυτός με isDefault=true |
| 3 | Αρχειοποίηση ενεργού τιμοκαταλόγου | Warning: "X items χρησιμοποιούν αυτόν" |
| 4 | Delete price item ενώ referenced | Soft delete (archived), existing BOQ items κρατάνε τιμές |
| 5 | Project override μερικό (μόνο material) | Τα null fields κληρονομούν από Master |
| 6 | Waste = 0 σε κατηγορία 'required' | Validation error — απαιτείται τιμή > 0 |
| 7 | Import τιμοκαταλόγου με αλλαγμένες κατηγορίες | Normalization + mapping attempt, unmatched → error report |
| 8 | Αλλαγή region σε project | Re-resolve prices from correct regional price list |

---

## 7. UI Components

### 7.1 Price List Management (Settings page)

```
<PriceListPage>
  <PriceListHeader title={name} year={year} status={status} />
  <PriceListFilters category={...} search={...} />
  <PriceListTable items={priceItems}>
    <PriceItemRow code={...} desc={...} unit={...} material={...} labor={...} equip={...} waste={...} />
  </PriceListTable>
  <PriceListActions onImport={...} onExport={...} onCopyToNextYear={...} />
</PriceListPage>
```

### 7.2 Project Override Panel

```
<ProjectPriceOverrides projectId={projectId}>
  <OverrideTable items={resolvedPrices} onOverride={...} onReset={...} />
</ProjectPriceOverrides>
```

### 7.3 Price Indicator (in BOQItemEditor)

```
<PriceField
  value={85.00}
  source="master-inherited"    // 🔗 | 📋 | ✏️
  onOverride={(newValue) => {...}}
  onReset={() => {...}}
/>
```

---

## 8. Service Operations

```typescript
interface PriceListService {
  // Price List CRUD
  createPriceList(data: CreatePriceListInput): Promise<BOQPriceList>;
  getPriceList(id: string): Promise<BOQPriceList | null>;
  updatePriceList(id: string, data: Partial<BOQPriceList>): Promise<void>;
  activatePriceList(id: string): Promise<void>;
  archivePriceList(id: string): Promise<void>;
  copyPriceList(sourceId: string, targetYear: number): Promise<BOQPriceList>;

  // Price Items
  addPriceItem(priceListId: string, data: CreatePriceItemInput): Promise<BOQPriceItem>;
  updatePriceItem(itemId: string, data: Partial<BOQPriceItem>): Promise<void>;
  deletePriceItem(itemId: string): Promise<void>;
  getPriceItems(priceListId: string, categoryCode?: string): Promise<BOQPriceItem[]>;

  // Project Overrides
  setProjectOverride(projectId: string, data: CreateOverrideInput): Promise<BOQProjectOverride>;
  removeProjectOverride(overrideId: string): Promise<void>;
  getProjectOverrides(projectId: string): Promise<BOQProjectOverride[]>;

  // Resolution
  resolvePrice(item: BOQItem): Promise<ResolvedPrice>;
  resolveWaste(categoryCode: string, projectId?: string): Promise<number>;
  getActivePriceList(companyId: string, region?: string): Promise<BOQPriceList | null>;
}
```

---

## 9. Firestore

### 9.1 Collections

```
boq_price_lists               # Master τιμοκατάλογοι (ανά εταιρεία/έτος)
boq_price_items               # Items τιμοκαταλόγου (rate build-ups)
boq_project_overrides          # Overrides τιμών ανά έργο
```

### 9.2 Composite Indexes

```
boq_price_lists: companyId ASC, status ASC, year DESC
boq_price_items: priceListId ASC, categoryCode ASC, sortOrder ASC
boq_project_overrides: projectId ASC, categoryCode ASC
```

---

## 10. Affected Files

### 10.1 Νέα Αρχεία

```
src/types/measurements/price.ts                      # BOQPriceList, BOQPriceItem, BOQProjectOverride
src/services/measurements/price-list-service.ts      # Price CRUD + resolution
src/services/measurements/price-repository.ts        # Firestore for price collections
src/components/settings/PriceListPage.tsx             # Settings → Τιμοκατάλογοι
src/components/settings/price-list/PriceListTable.tsx
src/components/settings/price-list/PriceItemRow.tsx
src/components/settings/price-list/PriceListActions.tsx
src/components/building-management/measurements/PriceIndicator.tsx
src/components/project/ProjectPriceOverrides.tsx
```

### 10.2 Τροποποιούμενα Αρχεία

```
src/config/firestore-collections.ts    # +BOQ_PRICE_LISTS, +BOQ_PRICE_ITEMS, +BOQ_PROJECT_OVERRIDES
src/services/measurements/boq-service.ts         # Integration with price resolution
src/components/building-management/measurements/BOQItemEditor.tsx  # Price inheritance UI
src/i18n/locales/el/measurements.json  # +price-related translations
src/i18n/locales/en/measurements.json
firestore.indexes.json                 # +price indexes
```

---

## 11. Acceptance Criteria

- [ ] Master Price List: CRUD + activate/archive/copy-to-year
- [ ] Price Items: CRUD ανά τιμοκατάλογο
- [ ] 3-level inheritance: Master → Project → Item resolves σωστά
- [ ] Price indicator: 🔗 inherited / 📋 project / ✏️ overridden
- [ ] Override: manual change → priceOverridden=true, indicator αλλάζει
- [ ] Reset: Click "Επαναφορά" → τιμές re-inherited
- [ ] Waste: auto-fill από category default, editable ανά item
- [ ] Waste warning: > 15% δείχνει κίτρινο
- [ ] Master update cascade: inherited items ενημερώνονται, overridden δεν αλλάζουν
- [ ] Copy to next year: δημιουργεί νέο price list με ίδια items
- [ ] i18n: EL + EN

---

## 12. Out of Scope

- Excel import/export τιμοκαταλόγου → UC-BOQ-006
- Subcontractor contract pricing → UC-BOQ-005
- Regional price variations UI → Future enhancement
- Price history chart → Future enhancement

---

*Implementation contract for ADR-175 Phase 1C (price part). Inheritance algorithm MUST follow §4.1.3 of ADR-175.*
