# ADR-329: Measurement Task Scope — Property-Granular Selection

**Status**: ✅ ACCEPTED (2026-05-01) — ready for implementation
**Date**: 2026-04-30 (initial), 2026-05-01 (multi-level resolution + final unblock)
**Author**: Giorgio Pagonis (with Claude Opus 4.7)
**Extends**: ADR-175 (Quantity Surveying / BOQ System) §4.4.3
**References**: ADR-145, ADR-175, ADR-233, ADR-236, ADR-326

---

## 1. Context / Σκοπός

Το ADR-175 εισήγαγε το σύστημα BOQ (Bill of Quantities) για παρακολούθηση επιμετρήσεων ανά κτίριο. Κάθε `BOQItem` έχει πεδίο `scope` με 2 τιμές: `'building' | 'property'`. Το πεδίο `linkedUnitId: string | null` υπάρχει ήδη στο schema (`src/types/boq/boq.ts:48`) **αλλά δεν συμπληρώνεται ποτέ** επειδή το UI δεν προσφέρει property picker.

**Πρόβλημα**: η επιλογή `'property'` (Μεμονωμένη Μονάδα) δεν προσδιορίζει ΠΟΙΟ ακίνητο. Είναι σημασιολογικά κενή τιμή — dead field στη βάση δεδομένων.

### Τρέχουσα ροή χρήστη

1. Building Management → επιλογή κτιρίου
2. Right pane → tab `Επιμετρήσεις`
3. Κουμπί `Νέα Εργασία` → modal `BOQItemEditor`
4. Πεδίο `Εύρος Εφαρμογής` (radio buttons):
   - `Ολόκληρο Κτίριο` (`scope='building'`)
   - `Μεμονωμένη Μονάδα` (`scope='property'`)
5. Σε κανένα point ο χρήστης δεν επιλέγει ΠΟΙΟ ακίνητο.

---

## 2. Problem Statement

| # | Issue | Impact |
|---|-------|--------|
| 1 | "Μεμονωμένη Μονάδα" δεν ταυτοποιεί συγκεκριμένη unit | Costing per unit αδύνατο |
| 2 | Κοινόχρηστα μπερδεμένα με whole-building | Λάθος ριφή κοινόχρηστων κατά millesimali |
| 3 | Εργασίες που καλύπτουν N μονάδες (όχι όλες) δεν αναπαρίστανται | Forced workaround: N duplicate tasks |
| 4 | Πεδίο `linkedUnitId` υπάρχει αλλά μένει πάντα `null` | Schema dirty / dead field |
| 5 | Reporting "πόσο κόστισε το Διαμέρισμα Α2;" αδύνατο | Τυφλές business decisions |
| 6 | Audit trail per unit (claim, garanzia, manutenzione) απών | Δεν τηρείται historical record |

---

## 3. Decision / Αποφάσεις

### 3.0. UI Container — Slide-over Drawer (αντί για Modal)

**Decision** (2026-04-30): Το νέο form για `BOQItem` create/edit μετακινείται από **modal** σε **slide-over drawer** που σύρεται από τα δεξιά της οθόνης.

**Rationale**:
- Το modal κρύβει την υπάρχουσα λίστα εργασιών — ο χρήστης δεν βλέπει τι υπάρχει ήδη όταν δημιουργεί καινούργια
- Το form έχει 5 sections + ~15 fields. Με την προσθήκη του property picker (§3.4) γίνεται scroll-hell σε modal πλάτους 600px
- Drawer 800-900px επιτρέπει 2 στήλες (Quantities | Costs) δίπλα-δίπλα
- Sticky footer με Save/Cancel πάντα ορατός
- Industry-standard pattern: Linear, Asana, Notion, Gmail, Google Calendar, Salesforce Lightning, Microsoft Dynamics 365

**Layout**:

```
┌──────────────────────┬──────────────────────────────┐
│ TAB ΕΠΙΜΕΤΡΗΣΕΙΣ     │ DRAWER (800-900px)           │
│ ─────────────────    │ ─────────────────────────    │
│ • Διαμέρισμα Α1 €5k │ Νέα Εργασία              ✕  │
│ • Διαμέρισμα Α2 €3k │                              │
│ • Κατάστημα Ι1 €12k │ [Basic Info]                 │
│ • Parking Π3 €800   │ Κατηγορία: [____ ▼]          │
│ • Κοινόχρηστα €25k  │ Τίτλος:    [_______________] │
│                      │                              │
│ (scroll independent) │ [Scope]                      │
│                      │ ◯ Ολόκληρο Κτίριο            │
│ ← list always        │ ◯ Κοινόχρηστοι Χώροι         │
│   visible            │ ◯ Ολόκληρος Όροφος           │
│                      │ ● Συγκεκριμένο Ακίνητο       │
│                      │   Ακίνητο: [Διαμέρισμα Α2 ▼]│
│                      │ ◯ Πολλαπλά Ακίνητα           │
│                      │                              │
│                      │ [Quantities] | [Costs]       │
│                      │ ─────────────────────────    │
│                      │ Σύνολο: €4,250  (sticky)     │
│                      │ [Ακύρωση]      [Αποθήκευση]  │
└──────────────────────┴──────────────────────────────┘
```

**Component**: `@/components/ui/sheet` (Radix UI Sheet — shadcn primitive). Da verificare se esiste già nel codebase, altrimenti add as new dependency (Radix UI MIT license, già usato per Dialog/Select).

**Behavior**:
- Άνοιγμα: trigger `Νέα Εργασία` → slide-in animation 200ms
- Κλείσιμο: Esc, click overlay, X button, Cancel, ή post-Save
- **Width**: **900px σταθερό** + **auto-overlay** σε στενές οθόνες (decision 2026-04-30)
- Backdrop: dimmed overlay (semi-transparent, click-to-close)

**Responsive layout strategy**:

| Viewport width | Drawer mode | Behavior |
|----------------|-------------|----------|
| ≥ 1440px | **side-by-side** | Drawer 900px δεξιά, λίστα ορατή αριστερά |
| 1100px – 1439px | **overlay** | Drawer 900px overlays τη λίστα (semi-transparent backdrop) |
| 768px – 1099px | **overlay** | Drawer width = `min(900px, 90vw)`, full overlay |
| < 768px (mobile) | **full-screen** | Drawer = 100vw, sticky header + footer |

**Implementation hint**: media query `@media (min-width: 1440px) { .drawer-side-by-side }`. Use Tailwind `2xl:` breakpoint ή custom `@container` query με `useMediaQuery` hook.

**Rationale**: στο 1366px laptop (συνηθισμένη οθόνη), 900px σταθερό drawer + side-by-side θα άφηνε λίστα ~116px (απαράδεκτη). Auto-overlay σε αυτές τις οθόνες διατηρεί quality form + λογική UX (λίστα ξαναεμφανίζεται όταν κλείσει το drawer).

**Migration impact**: μόνο `BOQItemEditor.tsx` wrapping change — `Dialog` → `Sheet`. Internal form structure rimane invariato. Stima: 1 file modified, ~10 lines changed.

### 3.1. Scope σε 5 επίπεδα

```typescript
type BOQScope =
  | 'building'      // ολόκληρο κτίριο (shell, struttura, facciata, tetto)
  | 'common_areas'  // κοινόχρηστοι χώροι (κλιμακοστάσιο, lobby, ανελκυστήρας)
  | 'floor'         // ολόκληρος όροφος (όλα τα ακίνητα ενός ορόφου)
  | 'property'      // 1 ακίνητο specifico
  | 'properties';   // cherry-picked subset N ακινήτων (cross-floor)
```

| Scope | Καθεστώς κόστους | Παράδειγμα |
|-------|--------------------|-------------|
| `building` | Ενσωματώνεται στο τιμολόγιο πώλησης ή κατανέμεται σε όλες τις μονάδες κατά εμβαδό | Σκελετός, στέγη, εξωτερική επένδυση |
| `common_areas` | Κατανέμεται κατά millesimali στους ιδιοκτήτες (κοινόχρηστο καθεστώς) | Ανελκυστήρας, θυρωρείο, αυλή |
| `floor` | Κατανέμεται μεταξύ όλων των μονάδων του ορόφου (κατά εμβαδό ή ισόποσα) | Πλακάκια διαδρόμου 2ου ορόφου, parquet 3ου ορόφου |
| `property` | Χρεώνεται directly στη συγκεκριμένη unit | Πλακάκια Διαμερίσματος Α2 |
| `properties` | Cherry-picked subset (cross-floor allowed). Κατανέμεται μεταξύ N μονάδων | Ίδια κουζίνα σε 3 διαμερίσματα διαφορετικών ορόφων |

**Σχέση `floor` vs `properties`**: Το `floor` υπονοεί **όλα** τα properties του συγκεκριμένου ορόφου (auto-included, ο χρήστης δεν τα διαλέγει — επιλέγει μόνο τον όροφο). Το `properties` είναι για **cherry-pick** όπου ο χρήστης επιλέγει manual ακίνητα (συνήθως cross-floor). Αν ο χρήστης διαλέξει "όλα του ορόφου X" στο `properties` picker, το UI κάνει suggest fallback to `scope='floor'`.

### 3.1.1. Cost Allocation Method (για multi-property scopes)

Όταν scope ∈ {`floor`, `properties`, `common_areas`, `building`}, το `totalCost` πρέπει να κατανέμεται μεταξύ N ακινήτων για per-unit reporting/billing.

**Decision (2026-04-30)**: **Hybrid με default «κατά εμβαδόν» (proportional by area)**.

**Νέο field στο `BOQItem`**:

```typescript
type CostAllocationMethod =
  | 'by_area'      // αναλογικά κατά εμβαδόν (DEFAULT) — formula: cost_i = total * (area_i / Σ area)
  | 'equal'        // ισόποσα — formula: cost_i = total / N
  | 'custom';      // χειροκίνητα ποσοστά — με customAllocations field

interface BOQItem {
  // ...existing
  costAllocationMethod: CostAllocationMethod;        // default 'by_area'
  customAllocations: Record<string, number> | null;  // populated SE method='custom'.
                                                     // key = propertyId, value = percentage (0-100), Σ = 100
}
```

**Validation**:
| Method | Required | Constraint |
|--------|----------|------------|
| `by_area` | — | Όλα τα target properties έχουν `area > 0` (else fallback `equal` με warning) |
| `equal` | — | — |
| `custom` | `customAllocations !== null` | `Σ values === 100` (±0.01 tolerance), keys ⊆ target properties |

**Validity per scope**:
| Scope | Allowed methods | Notes |
|-------|-----------------|-------|
| `building` | `by_area`, `equal`, `custom` | Distribuito σε όλα τα properties του κτιρίου |
| `common_areas` | `by_area`, `custom` | Default `by_area` (κατά millesimali — Greek law). `equal` αποκλείεται για legal compliance |
| `floor` | `by_area`, `equal`, `custom` | Distribuito σε όλα τα properties του ορόφου |
| `property` | N/A | Only 1 unit, no split |
| `properties` | `by_area`, `equal`, `custom` | Distribuito στα selected properties |

**UI**:

```
┌─ Κατανομή Κόστους ─────────────────────────────────┐
│ ◉ Κατά εμβαδόν (αυτόματο)        ← default        │
│ ◯ Ισόποσα                                          │
│ ◯ Χειροκίνητα ποσοστά  ← κλικ ανοίγει custom panel│
│                                                    │
│ [μόνο όταν 'custom']:                              │
│   Β1:  [_30_]%   €720                              │
│   Β2:  [_25_]%   €600                              │
│   Β3:  [_45_]%   €1080                             │
│   ─────────────────                                │
│   Σύνολο: 100%   €2.400 ✓                          │
└────────────────────────────────────────────────────┘
```

- Default mode: **collapsed** ("Κατά εμβαδόν" επιλεγμένο, hidden εκτός αν ο χρήστης ανοίξει)
- Show preview table με υπολογισμένα κόστη ανά property (read-only εκτός `custom`)
- Validation: Σ percentages = 100 (real-time)
- Auto-fallback: αν επιλέξει `by_area` αλλά κάποιο property έχει `area === 0` → toast warning + auto-switch to `equal`

### 3.2. Schema `BOQItem` (extension)

```typescript
interface BOQItem {
  // ...existing fields
  scope: BOQScope;
  linkedFloorId: string | null;    // populated SE scope='floor' (NEW field)
  linkedUnitId: string | null;     // populated SE scope='property'
  linkedUnitIds: string[] | null;  // populated SE scope='properties' (NEW field)
}
```

**Migration**:
- Fields `linkedFloorId` + `linkedUnitIds` προστίθενται ως `null` σε υπάρχοντα documents
- Documents με `scope='property'` υπάρχοντα: καμία αλλαγή (field ήδη παρόν)
- Backfill δεν χρειάζεται (test data, θα γίνει wipe pre-production)
- Floor entity reference: `floors` collection (ήδη υπάρχει), key: `floorId` με `where('buildingId', '==', bid)`

### 3.3. Validation Rules

| Scope | Required | Forbidden | Cross-check |
|-------|----------|-----------|-------------|
| `building` | — | any of `linkedFloorId`, `linkedUnitId`, `linkedUnitIds` non-null | — |
| `common_areas` | — | any of `linkedFloorId`, `linkedUnitId`, `linkedUnitIds` non-null | — |
| `floor` | `linkedFloorId !== null` | `linkedUnitId !== null`, `linkedUnitIds !== null` | `floors[linkedFloorId].buildingId === task.buildingId` |
| `property` | `linkedUnitId !== null` | `linkedFloorId !== null`, `linkedUnitIds !== null` | `properties[linkedUnitId].buildingId === task.buildingId` |
| `properties` | `linkedUnitIds.length >= 2` | `linkedFloorId !== null`, `linkedUnitId !== null` | `∀ id ∈ linkedUnitIds: properties[id].buildingId === task.buildingId` |

**Επιβολή σε 3 layers**:
1. **Client-side** (form): cascading reveal + required + min-count
2. **Service layer** (`boq-service.ts`): validation πριν το write
3. **Firestore rules** (`firestore.rules`): tenant + buildingId match enforcement

### 3.3.1. Scope Mutability — Draft-Only Edit

**Decision (2026-04-30)**: scope-related fields (`scope`, `linkedFloorId`, `linkedUnitId`, `linkedUnitIds`, `costAllocationMethod`, `customAllocations`) είναι **mutable μόνο όσο status === 'draft'**. Από `submitted` και πέρα, **κλειδώνουν**.

**Status lifecycle** (από ADR-175 §units.ts:70-76):
```
draft → submitted → approved → certified → locked
  ↑
  εδώ μόνο επιτρέπεται αλλαγή scope
```

**UI behavior**:
- Σε `draft`: scope picker + property/floor pickers + cost allocation = enabled
- Σε `submitted` και πέρα: scope picker + dependents = `disabled` με tooltip "Δεν αλλάζει μετά την υποβολή. Ακυρώστε και δημιουργήστε νέα εργασία."
- "Reopen to draft" action (σε approved/certified) → resets to `draft`, ξεκλειδώνει scope (ADR-175 lifecycle hook)

**Validation (service + Firestore rules)**:
```typescript
// boq-service.ts pseudocode
if (existingItem.status !== 'draft') {
  const scopeFields = ['scope', 'linkedFloorId', 'linkedUnitId', 'linkedUnitIds',
                       'costAllocationMethod', 'customAllocations'];
  scopeFields.forEach(f => {
    if (input[f] !== existingItem[f]) {
      throw new Error('SCOPE_LOCKED_AFTER_SUBMIT');
    }
  });
}
```

**Audit trail**: αλλαγές scope σε draft → `EntityAuditService.recordChange()` (ADR-195) σε κάθε edit. Σύμφωνα με ADR-310 entity-audit-coverage baseline.

**Rationale**:
- Draft = πρόχειρο, ο χρήστης πειραματίζεται
- Submitted/approved = δέσμευση κόστους + reporting visibility — αλλαγή = corruption του ιστορικού
- Versioning (SAP-style) = overkill για current project scale
- Διαφορά από Procore: ίδιο pattern (lock στο submitted)

### 3.4. UI Behavior — Cascading Reveal

```
[Εύρος Εφαρμογής]  (select / segmented control, 5 options)
      │
      ├─ Ολόκληρο Κτίριο        → no follow-up
      ├─ Κοινόχρηστοι Χώροι      → no follow-up
      ├─ Ολόκληρος Όροφος        → [Floor Select]              (required, single)
      ├─ Συγκεκριμένο Ακίνητο    → [Property Select]           (required, single)
      └─ Πολλαπλά Ακίνητα        → [Property Multi-Select Tree] (required, min 2)
```

#### Floor Select (scope=`floor`)

- **Source**: `floors` collection, `where('companyId', '==', cid), where('buildingId', '==', bid)`
- **Display format**: `{floorOrder} — {floorLabel}` π.χ. `0 — Ισόγειο`, `2 — 2ος Όροφος`
- **Sort**: by `floorOrder` ASC (basement → ground → upper floors)
- **Empty state**: "Δεν υπάρχουν όροφοι για αυτό το κτίριο. Δημιουργήστε πρώτα ορόφους."
- **Disabled state**: όταν scope ≠ `floor`
- **Hint** (κάτω από το picker): "Η εργασία θα συνδεθεί με όλα τα ακίνητα του ορόφου ({N} ακίνητα)"

#### Property Select (scope=`property`)

- **Source**: `properties` collection, `where('companyId', '==', cid), where('buildingId', '==', bid)`
- **Display format**: `{code} — {name} ({floorLabel})` π.χ. `DI-A1 — Διαμέρισμα Α1 (Ισόγειο)`
- **Sort**: `floor` ASC, then `code` ASC
- **Empty state**: "Δεν υπάρχουν ακίνητα για αυτό το κτίριο. Δημιουργήστε πρώτα ένα ακίνητο."
- **Disabled state**: όταν scope ≠ `property`

#### Property Multi-Select Tree (scope=`properties`) — Hybrid Pattern

**Decision (2026-04-30)**: Hybrid UI — **chips επάνω** (selected items) + **δέντρο κάτω** (group by floor).

**Layout**:

```
┌────────────────────────────────────────────────┐
│ Επιλεγμένα (3):                                │
│ [Α1 ✕] [Α3 ✕] [Β1 ✕]    ← chips, click ✕ to remove │
├────────────────────────────────────────────────┤
│ ☐ Ισόγειο (2 ακίνητα)                       ▼  │
│    ☐ Κατάστημα Ι1                              │
│    ☐ Κατάστημα Ι2                              │
│                                                │
│ ☑ 1ος Όροφος (3 ακίνητα)                     ▼ │  ← parent checkbox = "select all on floor"
│    ☑ Διαμέρισμα Α1                             │
│    ☐ Διαμέρισμα Α2                             │
│    ☑ Διαμέρισμα Α3                             │
│                                                │
│ ☐ 2ος Όροφος (2 ακίνητα)                    ▶  │  ← collapsed
└────────────────────────────────────────────────┘
```

**Specs**:
- **Same datasource**: `properties` collection, `where('buildingId', '==', bid)`
- **Top section (chips)**: horizontal scrollable list of selected properties. Each chip: `{code} ✕`. Click ✕ → remove from selection. Empty state: hidden (chips area shown only if selection.length > 0).
- **Bottom section (tree)**: 
  - **Group by `floor`** (collapsible — chevron ▶/▼)
  - **Group header** = checkbox + "{floorLabel} ({N} ακίνητα)" → toggle "select all/none on floor"
  - **Group state**: indeterminate (some selected) | checked (all selected) | unchecked (none)
  - **Children**: checkbox + property name
  - **Default state**: all groups expanded if total properties ≤ 15, else only groups with selection are expanded
- **Selection counter**: "X ακίνητα επιλεγμένα" (above chips area, in legend)
- **Search**: optional input field στην κορυφή φιλτράρει tree (per name + code)
- **Validation**: 
  - min 2 selected → block save
  - Αν 1 selected → toast hint "Επιλέξτε τουλάχιστον 2 ακίνητα ή χρησιμοποιήστε «Συγκεκριμένο Ακίνητο»"
  - Αν user επιλέξει όλα τα ακίνητα ενός μόνο ορόφου → toast suggest "Φαίνεται ότι θέλετε «Ολόκληρος Όροφος». Να αλλάξει αυτόματα;"

**Component**: `PropertyMultiSelectByBuilding` (νέο, υλοποιείται στο implementation phase). Reuse hooks από `useNewUnitHierarchy`.

### 3.5. Reuse Existing Patterns

Το component `NewUnitHierarchySection.tsx` έχει ήδη το cascading building→floor→property pattern. Εξάγουμε:

| Νέο Component | Path | Source |
|----------------|------|--------|
| `FloorSelectByBuilding` | `src/components/properties/shared/FloorSelectByBuilding.tsx` | Extracted from `NewUnitHierarchySection` floor logic |
| `PropertySelectByBuilding` | `src/components/properties/shared/PropertySelectByBuilding.tsx` | Extracted from `NewUnitHierarchySection` |
| `PropertyMultiSelectByBuilding` | `src/components/properties/shared/PropertyMultiSelectByBuilding.tsx` | New (uses same query hook) |

Reuse query hook: `useNewUnitHierarchy.subscribeProperties(buildingId)` (`src/components/properties/shared/useNewUnitHierarchy.ts:173`).

### 3.6. i18n Keys

**`src/i18n/locales/el/building-tabs.json`**:

```json
"scope": {
  "label": "Εύρος Εφαρμογής",
  "building": "Ολόκληρο Κτίριο",
  "commonAreas": "Κοινόχρηστοι Χώροι",
  "floor": "Ολόκληρος Όροφος",
  "property": "Συγκεκριμένο Ακίνητο",
  "properties": "Πολλαπλά Ακίνητα",

  "floorPickerLabel": "Όροφος",
  "floorPickerPlaceholder": "Επιλέξτε όροφο...",
  "floorPickerEmpty": "Δεν υπάρχουν όροφοι για αυτό το κτίριο.",
  "floorPickerHint": "Η εργασία θα συνδεθεί με όλα τα ακίνητα του ορόφου ({{count}} ακίνητα)",

  "propertyPickerLabel": "Ακίνητο",
  "propertyPickerPlaceholder": "Επιλέξτε ακίνητο...",
  "propertiesPickerLabel": "Ακίνητα",
  "propertiesPickerEmpty": "Δεν υπάρχουν ακίνητα για αυτό το κτίριο.",
  "propertiesPickerMinError": "Επιλέξτε τουλάχιστον 2 ακίνητα ή χρησιμοποιήστε «Συγκεκριμένο Ακίνητο».",

  "multiSelect": {
    "selectedHeader": "Επιλεγμένα ({{count}})",
    "selectedEmpty": "Δεν έχει επιλεγεί κανένα ακίνητο",
    "groupHeader": "{{floorName}} ({{count}} ακίνητα)",
    "searchPlaceholder": "Αναζήτηση ακινήτου (όνομα ή κωδικός)...",
    "selectAllOnFloor": "Επιλογή όλων του ορόφου",
    "removeChip": "Αφαίρεση",
    "suggestSwitchToFloor": "Φαίνεται ότι θέλετε «Ολόκληρος Όροφος». Να αλλάξει αυτόματα;",
    "suggestSwitchConfirm": "Ναι, αλλαγή",
    "suggestSwitchDismiss": "Όχι, συνέχεια"
  },

  "costAllocation": {
    "label": "Κατανομή Κόστους",
    "byArea": "Κατά εμβαδόν (αυτόματο)",
    "byAreaHint": "Αναλογικά με τα τετραγωνικά κάθε ακινήτου",
    "equal": "Ισόποσα",
    "equalHint": "Ίδιο ποσό σε κάθε ακίνητο",
    "custom": "Χειροκίνητα ποσοστά",
    "customHint": "Ορίστε εσείς το ποσοστό κάθε ακινήτου",
    "customTotalLabel": "Σύνολο",
    "customTotalValid": "✓ 100%",
    "customTotalInvalid": "Σύνολο: {{percent}}% (πρέπει να είναι 100%)",
    "previewHeader": "Προεπισκόπηση κατανομής",
    "byAreaFallbackWarning": "Το ακίνητο {{code}} δεν έχει εμβαδόν. Αυτόματη μετάβαση σε «Ισόποσα».",
    "partialAreaWarning": "Το ακίνητο {{code}} δεν έχει per-level εμβαδά. Συνεισφέρει με το συνολικό του εμβαδόν."
  },

  "scopeLock": {
    "tooltip": "Δεν αλλάζει μετά την υποβολή. Ακυρώστε και δημιουργήστε νέα εργασία ή χρησιμοποιήστε «Επαναφορά σε Πρόχειρο».",
    "reopenButton": "Επαναφορά σε Πρόχειρο",
    "reopenConfirmTitle": "Επαναφορά σε Πρόχειρο",
    "reopenConfirmBody": "Η εργασία θα επιστρέψει σε κατάσταση «Πρόχειρη». Τα στοιχεία scope θα ξεκλειδώσουν για επεξεργασία.",
    "reopenSuccess": "Η εργασία επανέφερε σε πρόχειρο."
  },

  "singlePropertyFloorToast": {
    "title": "Ο όροφος έχει 1 ακίνητο",
    "body": "Ο {{floorName}} έχει μόνο 1 ακίνητο ({{propertyCode}}). Μήπως εννοείτε «Συγκεκριμένο Ακίνητο»;",
    "confirm": "Ναι, αλλαγή",
    "dismiss": "Όχι, συνέχεια"
  }
}
```

**`src/i18n/locales/el/properties.json`** (deletion safeguards § 3.9):

```json
"deletion": {
  "blockedTitle": "Δεν είναι δυνατή η διαγραφή του «{{propertyName}}»",
  "blockedBody": "Το ακίνητο χρησιμοποιείται σε {{count}} εργασίες επιμετρήσεων:",
  "draftRefs": "{{count}} πρόχειρες (draft)",
  "submittedRefs": "{{count}} οριστικές (submitted/approved/certified)",
  "lockedRefs": "{{count}} κλειδωμένες (locked)",
  "viewTasksLink": "Δείτε τις εργασίες",
  "archiveOption": "Εναλλακτικά, μπορείτε να αρχειοθετήσετε το ακίνητο. Θα κρυφτεί από λίστες/pickers αλλά οι εργασίες παραμένουν άθικτες.",
  "cancel": "Ακύρωση",
  "archiveButton": "Αρχειοθέτηση αντί για διαγραφή",
  "archiveSuccess": "Το ακίνητο αρχειοθετήθηκε.",
  "restoreButton": "Επαναφορά",
  "archivedBadge": "αρχειοθετημένο"
}
```

**`src/i18n/locales/en/building-tabs.json`** (parallel keys):

```json
"scope": {
  "label": "Scope of Application",
  "building": "Whole Building",
  "commonAreas": "Common Areas",
  "floor": "Whole Floor",
  "property": "Specific Property",
  "properties": "Multiple Properties",

  "floorPickerLabel": "Floor",
  "floorPickerPlaceholder": "Select floor...",
  "floorPickerEmpty": "No floors exist for this building.",
  "floorPickerHint": "Task will be linked to all properties on the floor ({{count}} properties)",

  "propertyPickerLabel": "Property",
  "propertyPickerPlaceholder": "Select property...",
  "propertiesPickerLabel": "Properties",
  "propertiesPickerEmpty": "No properties exist for this building.",
  "propertiesPickerMinError": "Select at least 2 properties or use «Specific Property».",

  "multiSelect": {
    "selectedHeader": "Selected ({{count}})",
    "selectedEmpty": "No properties selected",
    "groupHeader": "{{floorName}} ({{count}} properties)",
    "searchPlaceholder": "Search property (name or code)...",
    "selectAllOnFloor": "Select all on floor",
    "removeChip": "Remove",
    "suggestSwitchToFloor": "Looks like you mean «Whole Floor». Auto-switch?",
    "suggestSwitchConfirm": "Yes, switch",
    "suggestSwitchDismiss": "No, continue"
  },

  "costAllocation": {
    "label": "Cost Allocation",
    "byArea": "By area (automatic)",
    "byAreaHint": "Proportional to each property's area",
    "equal": "Equal",
    "equalHint": "Same amount per property",
    "custom": "Custom percentages",
    "customHint": "You set the percentage for each property",
    "customTotalLabel": "Total",
    "customTotalValid": "✓ 100%",
    "customTotalInvalid": "Total: {{percent}}% (must be 100%)",
    "previewHeader": "Allocation preview",
    "byAreaFallbackWarning": "Property {{code}} has no area. Auto-fallback to «Equal».",
    "partialAreaWarning": "Property {{code}} has no per-level areas. Contributes with its total area."
  },

  "scopeLock": {
    "tooltip": "Cannot change after submission. Cancel and create a new task or use «Reopen to Draft».",
    "reopenButton": "Reopen to Draft",
    "reopenConfirmTitle": "Reopen to Draft",
    "reopenConfirmBody": "The task will return to «Draft» status. Scope fields will unlock for editing.",
    "reopenSuccess": "Task reopened to draft."
  },

  "singlePropertyFloorToast": {
    "title": "Floor has only 1 property",
    "body": "{{floorName}} has only 1 property ({{propertyCode}}). Did you mean «Specific Property»?",
    "confirm": "Yes, switch",
    "dismiss": "No, continue"
  }
}
```

**`src/i18n/locales/en/properties.json`** (deletion safeguards § 3.9):

```json
"deletion": {
  "blockedTitle": "Cannot delete «{{propertyName}}»",
  "blockedBody": "This property is used in {{count}} measurement tasks:",
  "draftRefs": "{{count}} drafts",
  "submittedRefs": "{{count}} submitted (incl. approved/certified)",
  "lockedRefs": "{{count}} locked",
  "viewTasksLink": "View tasks",
  "archiveOption": "Alternatively, you can archive the property. It will be hidden from lists/pickers but the tasks remain intact.",
  "cancel": "Cancel",
  "archiveButton": "Archive instead of deleting",
  "archiveSuccess": "Property archived.",
  "restoreButton": "Restore",
  "archivedBadge": "archived"
}
```

---

## 4. Industry Alignment

| Vendor | Pattern | Application εδώ |
|--------|---------|----------------|
| **Primavera P6** | WBS hierarchy: Project→Building→Floor→Unit. Activity πάντα linked σε WBS node. | 5 scopes = 5 valid WBS levels (building / common_areas / floor / property / properties) |
| **Procore** | Location tree picker, multi-select tree | Cascading + multi-select tree (§3.4) |
| **SAP RE-FX** | WBE → RE Object obligatory link | `linkedUnitId` required when scope=`property`; `linkedFloorId` required when scope=`floor` |
| **Google Material Design** | Progressive disclosure, cascading select, child validation | Scope → property/floor picker (conditional reveal §3.4) |
| **Greek Real Estate Practice** | «Κοινόχρηστοι Χώροι» = separate cost regime (millesimali, όχι per-unit) | Distinct `common_areas` scope με allowed methods = `by_area` ∪ `custom` (legal compliance §3.1.1) |
| **ADR-236 Multi-Level** (in-house) | `levels[]` + `levelData` partial-area schema | Multi-level properties εμφανίζονται σε όλους τους ορόφους που πιάνουν, με partial-area cost allocation (§3.7) |

---

## 5. Consequences

### Positive

- ✅ **Costing per unit** ενεργοποιείται (Google-level reporting)
- ✅ **Billing condominiale** automatable (`common_areas` → ριφή millesimali)
- ✅ **Audit trail** per unit (claim, garanzia, manutenzione tracciabili)
- ✅ **SAP-grade granularity** — αντιστοιχεί σε enterprise standard
- ✅ Pattern cascading **riusabile** σε άλλες φόρμες (work orders, inspections, defects)
- ✅ Schema `linkedUnitId` finally populated (no more dead field)
- ✅ **Backward compatible**: documents με `scope='building'` ή `scope='property'` παραμένουν valid

### Negative / Mitigation

| Issue | Mitigation |
|-------|-----------|
| Migration υπαρχόντων docs (4 νέα BOQItem fields: `linkedFloorId`, `linkedUnitIds`, `costAllocationMethod`, `customAllocations` + 2 Property fields: `archivedAt`, `archivedBy`) | Mitigated: test data, θα γίνει wipe pre-production. Νέα fields default σε `null` / `'by_area'`. Backward compatible reads. |
| UI complexity (multi-select tree, cost allocation panel, deletion safeguards) | Mitigated: reuse `NewUnitHierarchySection` query hook + Radix Sheet primitive. Cost allocation collapsed by default. Deletion modal εμφανίζεται μόνο όταν υπάρχουν refs. |
| Cross-collection validation (`property.buildingId === task.buildingId`, multi-level `linkedFloorId ∈ property.levels[]`) | Cost: Firestore rules + service layer (acceptable). Helper `propertiesOnFloor()` pure function για test coverage. |
| Multi-level partial-area lookup performance | Cost: `levelData[floorId]` is direct property access (O(1)). Fallback σε flat `areas.gross` με WARN log όταν legacy property. |
| ADR-175 §4.4.3 references το παλιό 2-level scope | Mitigated: cross-reference σε ADR-175 changelog (Step 16 του Implementation Plan). |
| ADR-236 implementation contract — BOQ τώρα consumer του multi-level data | Mitigated: §3.7 codifies the contract. ADR-236 cross-ref step 17. |

---

## 6. Implementation Plan

Phase-by-phase rollout. Ξεκινάει αφού approval (Status: ACCEPTED 2026-05-01).

| # | Step | Files | New/Modified |
|---|------|-------|--------------|
| 1 | Extend `BOQItem` schema: add `linkedFloorId`, `linkedUnitIds`, `costAllocationMethod`, `customAllocations` | `src/types/boq/boq.ts` | Modified |
| 2 | Add `BOQScope` 5-value type, `CostAllocationMethod` type | `src/types/boq/boq.ts` | Modified |
| 3 | Add `Property.archivedAt` + `archivedBy` (§3.9) | `src/types/property.ts` | Modified |
| 4 | Extract `FloorSelectByBuilding` from `NewUnitHierarchySection` | `src/components/properties/shared/FloorSelectByBuilding.tsx` | NEW |
| 5 | Extract `PropertySelectByBuilding` (single) — multi-level aware (`propertiesOnFloor` helper §3.7.1) | `src/components/properties/shared/PropertySelectByBuilding.tsx` | NEW |
| 6 | Create `PropertyMultiSelectByBuilding` — hybrid chips+tree (§3.4) | `src/components/properties/shared/PropertyMultiSelectByBuilding.tsx` | NEW |
| 7a | Wrap `BOQItemEditor.tsx` in `Sheet` (drawer) instead of `Dialog` (§3.0) | `BOQItemEditor.tsx` | Modified |
| 7b | Replace radio with segmented control (5 scopes) + conditional reveal | `BOQItemEditor.tsx` | Modified |
| 7c | Add Cost Allocation panel (§3.1.1) — segmented control + custom percentages table | `BOQItemEditor.tsx` | Modified |
| 7d | Add 2-column layout (Quantities · Costs) + sticky footer | `BOQItemEditor.tsx` | Modified |
| 7e | Add «Reopen to draft» button when `status !== 'draft' && status !== 'locked'` (§3.3.1 — backend ήδη υπάρχει στο `boq-service.transition`) | `BOQItemEditor.tsx` | Modified |
| 8 | Single-property-floor toast suggestion (§3.8) — wired στο `FloorSelectByBuilding.onChange` | `BOQItemEditor.tsx` + i18n | Modified |
| 9 | Update `useBOQEditorState.ts` — handle 5 scopes, validation rules (§3.3 + §3.7.3), draft-lock guard | `useBOQEditorState.ts` | Modified |
| 10 | Update `boq-service.ts` — validation, scope mutability lock, partial-area cost allocation (§3.7.2) | `boq-service.ts` | Modified |
| 11 | Add `cost-engine.ts` allocation helper (`allocateByArea` με multi-level partial areas) | `cost-engine.ts` | Modified |
| 12 | Property deletion guard (§3.9) — pre-delete BOQ reference check + restrict modal + soft archive flow | `src/services/property/property-mutation-gateway.ts` + UI dialog | Modified + NEW dialog |
| 13 | Update `firestore.rules` — enforce `buildingId` match, `archivedAt` filter για list reads, multi-level validation | `firestore.rules` | Modified |
| 14 | Add i18n keys (el + en) — scope labels, cost allocation, deletion safeguards, single-property toast | `building-tabs.json`, `properties.json` (×2 each) | Modified |
| 15 | Tests: service unit (5 scopes × multi-level matrix), schema validation, UI integration, deletion flow | `__tests__/` | NEW |
| 16 | Update ADR-175 changelog: add cross-reference to ADR-329 §4.4.3 extension | `ADR-175-quantity-surveying-measurements-system.md` | Modified |
| 17 | Update ADR-236 cross-ref: BOQ as multi-level consumer (§3.7) | `ADR-236-multi-level-property-management.md` | Modified |

**Estimate**: ~12 modified files + 4 new files + 1 new dialog component. 3 domains (`building-management`, `properties`, `boq` services + UI). Execution mode: **Orchestrator** (>5 files, >2 domains per ADR-261). Time estimate: 2-3 sessions.

---

## 7. Alternatives Considered

| Alternative | Rejected because |
|-------------|------------------|
| Keep 2-level scope, add separate "property" task type entity | Forces N tasks per unit-spanning work — duplicate data |
| 3-level (no `common_areas`) | Greek real estate έχει separate κοινόχρηστα regime — must distinguish |
| Tag-based (free-form labels) | No referential integrity, no validation possible, breaks reporting |
| Subcollections per property (`buildings/{id}/properties/{pid}/boq_items`) | Breaks BOQ aggregation queries (per-building reporting), violates SSoT |
| Cascading single-picker (Building→Floor→Unit, αυτόματη επιβολή granularity) | Forces user to drill through unwanted levels. Πολύ μικρότερη ευελιξία από radio με 5 explicit scopes. |
| 4-level scope (no `floor`) | Floor-level εργασίες είναι κοινές στην ελληνική κατασκευαστική πρακτική (μπογιά διαδρόμων, πλακάκια ορόφου). Forced workaround σε `properties` cherry-pick = δουλειά πολλαπλών κλικ. |
| ADR-330 «Multi-Floor Properties» as prerequisite | Investigated 2026-05-01: ADR-236 ήδη παρέχει το schema (`isMultiLevel`, `levels[]`, `levelData`). Νέο ADR θα ήταν duplicate documentation. Αντί αυτού: §3.7 codifies BOQ↔ADR-236 contract. |

---

## 8. Open Questions (για discussion με Giorgio)

**Resolved**:
- ✅ UI Container: **drawer** (slide-over από δεξιά) — confirmed 2026-04-30
- ✅ ADR number: **329** — confirmed (next clean dopo 328)
- ✅ Greek terminology για `common_areas`: **«Κοινόχρηστοι Χώροι»** — confirmed 2026-04-30 (rationale: δεν υπάρχει σύγχυση με τα μηνιαία κοινόχρηστα έξοδα)
- ✅ Floor scope: **NAI** — προστέθηκε 5ο επίπεδο `floor` (scope=«Ολόκληρος Όροφος») με `linkedFloorId` — confirmed 2026-04-30. Rationale: ταιριάζει με την ελληνική κατασκευαστική πρακτική (συμβόλαια ανά όροφο), reporting πιο καθαρό, ευθυγράμμιση με Procore/SAP/Primavera.
- ✅ Multi-select UI (scope=`properties`): **Hybrid** — chips επάνω (selected) + δέντρο κάτω (group by floor, collapsible) — confirmed 2026-04-30. Rationale: best of both — άμεση ορατότητα επιλογών + οργάνωση ιεραρχίας + scale σε 50+ ακίνητα.
- ✅ Cost allocation: **Hybrid με default «κατά εμβαδόν»** (`by_area` | `equal` | `custom`) — confirmed 2026-04-30. Default καλύπτει 90% σεναρίων (μπογιά/πλακάκια/parquet), custom για ειδικές περιπτώσεις. Common areas: `by_area` ή `custom` only (Greek millesimali law). Νέα fields `costAllocationMethod` + `customAllocations` στο `BOQItem`.
- ✅ Scope mutability: **draft-only** (κλειδώνει σε `submitted` και πέρα) — confirmed 2026-04-30. Reopen action για unlock. Audit trail σε κάθε draft edit. Rationale: ισορροπία ευελιξίας/integrity, ίδιο pattern με Procore.
- ✅ Drawer width: **900px σταθερό + auto-overlay σε στενές οθόνες** — confirmed 2026-04-30. ≥1440px = side-by-side, 768-1439px = overlay, <768px = full-screen. Rationale: quality form 2-column + αποφυγή στενής λίστας σε 1366px laptops + mobile-friendly.

**All questions resolved (6/6).** Status → ready for **ACCEPTED** + implementation phase.

---

## 8.1. Multi-Level Properties — Resolved via ADR-236 (NOT a blocker)

**Initial assumption (2026-05-01)**: Το ADR-329 χρειάζεται νέο ADR-330 για multi-floor properties (μεζονέτες, καταστήματα 4 επιπέδων κλπ).

**Verification (2026-05-01)**: Code-as-truth check έδειξε ότι **το multi-level schema υπάρχει ήδη** από ADR-236 «Multi-Level Property Management» (IMPLEMENTED 2026-03-16, Phases 1-5 complete μέχρι 2026-04-17).

`Property` interface (`src/types/property.ts:476-482`) ήδη έχει:
```typescript
isMultiLevel?: boolean;
levels?: PropertyLevel[];                     // [{floorId, floorNumber, name, isPrimary}]
levelData?: Record<string, LevelData>;        // partial areas/layout per floor
```

`MULTI_LEVEL_CAPABLE_TYPES` (στο `src/config/domain-constants.ts`) περιλαμβάνει: maisonette, penthouse, loft, **shop**, **hall**, detached_house, villa (+ legacy Greek: Μεζονέτα, Κατάστημα). `aggregateLevelData()` στο `src/services/multi-level.service.ts` αθροίζει cross-level totals.

Και τα 4 παραδείγματα του Giorgio καλύπτονται:

| Παράδειγμα | Coverage |
|------------|----------|
| Μεζονέτα (1ος+2ος) | ✅ `maisonette` type → auto-create 2 levels (Phase 4) |
| Κατάστημα 6μ (ισόγειο+1ος) | ✅ `shop` type → optionally-multi-level confirm dialog |
| Σύνθετο ισόγειο | ✅ Κάθε property μπορεί να έχει αυθαίρετα `levels[]` |
| Κατάστημα 4 επιπέδων | ✅ `levels: PropertyLevel[]` χωρίς όριο μήκους |

**Conclusion**: Δεν χρειάζεται ADR-330. Το ADR-329 **ξεκλειδώνει** και προχωρά. Μένουν μόνο 3 BOQ-specific design questions (§3.7).

---

## 3.7. Multi-Level Property Compatibility (NEW — 2026-05-01)

Η ενσωμάτωση του BOQ scope picker με τα multi-level properties του ADR-236 απαιτεί 3 σχεδιαστικές αποφάσεις (όχι schema αλλαγές).

### 3.7.1. Visibility — Σε ποιον όροφο εμφανίζεται μια μεζονέτα στο Floor Select;

**Decision (2026-05-01)**: **Επιλογή Γ** — εμφάνιση **σε όλους τους ορόφους που πιάνει** το multi-level property (όχι μόνο στον primary).

**Παράδειγμα**: Μεζονέτα Μ1 με `levels = [{floorId:'1', name:'1ος'}, {floorId:'2', name:'2ος', isPrimary:false}]` και `levels[0].isPrimary=true`. Όταν ο χρήστης επιλέξει `scope='floor'` με `linkedFloorId='2'`, το Μ1 **συμπεριλαμβάνεται** στη λίστα ακινήτων του 2ου ορόφου.

**Implementation hint** (για floor-aware property listing):
```typescript
function propertiesOnFloor(floorId: string, properties: Property[]): Property[] {
  return properties.filter(p =>
    p.floorId === floorId ||                              // single-level
    (p.levels?.some(l => l.floorId === floorId) ?? false) // multi-level
  );
}
```

**Rationale**: Δίκαιη αναπαράσταση της φυσικής πραγματικότητας. Η μεζονέτα όντως **έχει** χώρους και στους δύο ορόφους — οπότε εργασίες σε οποιονδήποτε από τους δύο ορόφους πρέπει να την αφορούν.

### 3.7.2. Cost Allocation — Συνολικά ή μερικά τετραγωνικά για multi-level properties;

**Decision (2026-05-01)** (αυτόματη συνέπεια του 3.7.1): Όταν `scope='floor'` και υπάρχει multi-level property στη λίστα, η `by_area` allocation χρησιμοποιεί **το μερικό εμβαδόν του ορόφου**, όχι το συνολικό.

**Πηγή δεδομένων**: `levelData[floorId].areas.gross` (ήδη υπάρχει από ADR-236 Phase 2).

**Παράδειγμα υπολογισμού**: Εργασία «Μπογιά διαδρόμων 1ου ορόφου», `totalCost=1.200€`, `costAllocationMethod='by_area'`. Στον 1ο όροφο:
- Α1: 80τ.μ. (single-level)
- Α2: 70τ.μ. (single-level)
- Μ1: μεζονέτα — `levelData['floor-1-id'].areas.gross = 60` (όχι το συνολικό 120)

```
Σ areas στον 1ο = 80 + 70 + 60 = 210τ.μ.
Α1: (80/210) × 1.200 = 457€
Α2: (70/210) × 1.200 = 400€
Μ1: (60/210) × 1.200 = 343€
```

Έτσι αν δημιουργηθεί δεύτερη εργασία «Μπογιά διαδρόμων 2ου ορόφου», η Μ1 ξανα-χρεώνεται για το **άλλο** 60τ.μ. — μηδέν διπλές χρεώσεις.

**Fallback**: αν `levelData[floorId]?.areas?.gross == null` (legacy property χωρίς per-level data) → πέφτει σε `property.areas.gross` (συνολικό) με WARNING στο log + toast στον χρήστη: «Το ακίνητο {code} δεν έχει per-level εμβαδά. Συνεισφέρει με το συνολικό του εμβαδόν.»

### 3.7.3. Validation — Building/Floor Cross-Check για multi-level

**Decision (2026-05-01)**: Επιβολή με τα array semantics του ADR-236.

| Scope | Validation |
|-------|------------|
| `floor` | `linkedFloorId === floors[*].id` AND `floors[linkedFloorId].buildingId === task.buildingId` |
| `property` (single-level) | `properties[linkedUnitId].floorId === currentFloorContext` (όπου εφαρμόζεται) |
| `property` (multi-level) | `currentFloorContext ∈ properties[linkedUnitId].levels[].floorId` |
| `properties` | Όλα τα `linkedUnitIds` ανήκουν στο `task.buildingId` (μέσω `floorId` ή `levels[]`) |

Καμία απόφαση χρήστη — μηχανική διόρθωση κώδικα κατά την υλοποίηση.

---

## 3.8. Single-Property Floor — Suggest, Don't Block (NEW — 2026-05-01)

**Scenario**: Όροφος που έχει ακριβώς 1 ακίνητο. Π.χ. ρετιρέ-διαμέρισμα Α5 που πιάνει όλο τον 3ο όροφο. Σημασιολογικά `scope='floor' + linkedFloorId='3rd'` ≡ `scope='property' + linkedUnitId='A5-id'`.

**Decision (2026-05-01)**: **Επιλογή Β** — toast suggestion **χωρίς block**.

**Behavior**:
- Ο χρήστης επιλέγει `scope='floor'` + όροφο που έχει 1 ακίνητο.
- Toast πάνω-δεξιά (auto-dismiss 8s):
  > «Ο {floorName} έχει μόνο 1 ακίνητο ({propertyCode}). Μήπως εννοείτε «Συγκεκριμένο Ακίνητο»;»
  >
  > [Ναι, αλλαγή] [Όχι, συνέχεια]
- Αν `Ναι` → `scope='property'`, `linkedUnitId=<that property>`, `linkedFloorId=null` (auto-mutation).
- Αν `Όχι` ή dismiss → συνεχίζει με floor scope κανονικά.

**Rationale**: Ο χρήστης μπορεί να έχει legitimate reason να κρατήσει floor scope (μελλοντική προσθήκη unit, semantic clarity reporting). Δεν εμποδίζουμε. Suggest, don't block.

**i18n keys (νέα)**:
```json
"scope.singlePropertyFloorToast.title": "Ο όροφος έχει 1 ακίνητο",
"scope.singlePropertyFloorToast.body": "Ο {{floorName}} έχει μόνο 1 ακίνητο ({{propertyCode}}). Μήπως εννοείτε «Συγκεκριμένο Ακίνητο»;",
"scope.singlePropertyFloorToast.confirm": "Ναι, αλλαγή",
"scope.singlePropertyFloorToast.dismiss": "Όχι, συνέχεια"
```

---

## 3.9. Property Deletion Safeguards (NEW — 2026-05-01)

**Scenario**: Ο χρήστης πάει στη λίστα ακινήτων και πατά «Διαγραφή Α2», αλλά το Α2 αναφέρεται σε υπάρχοντα BOQ items (ως `linkedUnitId` ή μέσα σε `linkedUnitIds[]`).

**Decision (2026-05-01)**: **Συνδυασμός Β+Γ** — restrict by default + προσφορά soft archive ως διέξοδο.

**Flow**:

1. **Pre-delete check** (στο service layer): query BOQ items όπου `linkedUnitId == propertyId OR propertyId in linkedUnitIds`.

2. **Αν 0 references** → κανονική διαγραφή.

3. **Αν N references** → modal:
   ```
   ┌─────────────────────────────────────────────────────┐
   │ ⚠️ Δεν είναι δυνατή η διαγραφή του «{propertyName}» │
   ├─────────────────────────────────────────────────────┤
   │ Το ακίνητο χρησιμοποιείται σε {N} εργασίες          │
   │ επιμετρήσεων:                                       │
   │ • {N1} πρόχειρες (draft)                           │
   │ • {N2} οριστικές (submitted/approved/certified)     │
   │ • {N3} κλειδωμένες (locked)                        │
   │                                                    │
   │ [Δείτε τις εργασίες] (link → BOQ list filtered)    │
   │                                                    │
   │ Εναλλακτικά, μπορείτε να αρχειοθετήσετε το         │
   │ ακίνητο. Θα κρυφτεί από λίστες/pickers αλλά οι     │
   │ εργασίες παραμένουν άθικτες.                       │
   ├─────────────────────────────────────────────────────┤
   │ [Ακύρωση]  [Αρχειοθέτηση αντί για διαγραφή]        │
   └─────────────────────────────────────────────────────┘
   ```

4. **Soft Archive Action**:
   - `Property.archivedAt: Timestamp` (νέο πεδίο)
   - `Property.archivedBy: string | null` (userId)
   - List queries προσθέτουν `where('archivedAt', '==', null)` filter
   - BOQ items που reference το archived property εξακολουθούν να λειτουργούν (read-only display: «{propertyName} (αρχειοθετημένο)»)
   - Reverse action: «Επαναφορά» button στη λίστα archived properties (από admin panel)

**Schema additions**:
```typescript
interface Property {
  // ...existing
  archivedAt: Timestamp | null;       // NEW — null = active, Timestamp = soft-deleted
  archivedBy: string | null;          // NEW — userId of who archived
}
```

**Firestore rule update**: archived properties read-only για non-admin users. Delete blocked at rule level εκτός αν `archivedAt != null AND no BOQ references` (re-check).

**Rationale**: Greek real estate context. Properties έχουν legal/financial weight (συμβόλαια, χιλιοστά, τιμολόγια). Ένα κλικ delete θα ήταν destructive. Restrict + archive = ισορροπία ασφάλειας/ευχρηστίας. Πρότυπο: GitHub repo archiving, Notion page archive.

**Out of scope** (για future ADR αν χρειαστεί): hard delete με admin override, bulk archive, retention policy για auto-purge after N years.

---

## 9. References

- [ADR-175: Quantity Surveying / BOQ System](./ADR-175-quantity-surveying-measurements-system.md) §4.4.3 (parent)
- [ADR-236: Multi-Level Property Management](./ADR-236-multi-level-property-management.md) — provides `levels[]` + `levelData` schema consumed in §3.7
- [ADR-145: Property Types SSoT](./ADR-145-property-types-ssot.md)
- [ADR-233: Entity Coding System](./ADR-233-entity-coding-system.md)
- [ADR-326: Tenant Org Structure & Departmental Routing](../../../../adrs/ADR-326-tenant-org-structure-departmental-routing.md) (lives στο root `adrs/` dir)
- [ADR-261: Execution Mode Evaluation](./ADR-261-execution-mode-evaluation.md) — implementation classified as Orchestrator
- Primavera P6 WBS documentation (Oracle docs)
- Procore Location Hierarchy (procore.com support)
- SAP RE-FX Real Estate Object model (SAP Help Portal)
- Google Material Design — Progressive Disclosure pattern

---

## 10. Changelog

| Date | Change |
|------|--------|
| 2026-04-30 | Initial proposal (status: 📋 PROPOSED) — awaiting discussion |
| 2026-04-30 | §3.0 added — UI Container decision: **drawer** instead of modal. Open Questions §8 reordered (drawer + ADR-329 resolved). |
| 2026-04-30 | Q1 resolved: terminology «Κοινόχρηστοι Χώροι» (επίσημη μορφή, αποφεύγει σύγχυση με μηνιαία κοινόχρηστα). |
| 2026-04-30 | Q2 resolved: 5ο επίπεδο `floor` προστέθηκε (scope=«Ολόκληρος Όροφος», `linkedFloorId` field). §3.1 + §3.2 + §3.3 + §3.4 + §3.5 + §3.6 ενημερωμένα. |
| 2026-04-30 | Q3 resolved: Multi-select UI = **Hybrid** (chips επάνω + δέντρο κάτω group by floor). §3.4 Property Multi-Select Tree αναλυτικό spec προστέθηκε. |
| 2026-04-30 | Q4 resolved: Cost allocation = **Hybrid** με default `by_area`. §3.1.1 νέα προστέθηκε με `CostAllocationMethod` enum + `customAllocations` field + UI spec + per-scope validity matrix. |
| 2026-04-30 | Q5 resolved: scope mutability = **draft-only**. §3.3.1 νέα προστέθηκε με lifecycle behavior + lock validation + audit trail. |
| 2026-04-30 | Q6 resolved: drawer width = **900px + auto-overlay σε <1440px viewports**. §3.0 responsive layout strategy table προστέθηκε. **Status → ACCEPTED.** Όλα τα open questions έλυσαν (6/6). |
| 2026-05-01 | Critical Q1 resolved: floor without properties = **block selection** (Επιλογή Α). Workaround: scope=building για κατασκευαζόμενους ορόφους. |
| 2026-05-01 | **Multi-floor blocker investigated and dismissed.** Code-as-truth verification έδειξε ότι ADR-236 «Multi-Level Property Management» ήδη implemented (Phases 1-5, 2026-03-16 → 2026-04-17). Schema πλήρες (`isMultiLevel`, `levels[]`, `levelData`). Δεν χρειάζεται ADR-330. §8.1 αντικαταστάθηκε με rationale + verification. |
| 2026-05-01 | §3.7 Multi-Level Property Compatibility added (3 sub-decisions): visibility = **Επιλογή Γ** (multi-level property εμφανίζεται σε όλους τους ορόφους που πιάνει), cost allocation = **partial areas** μέσω `levelData[floorId].areas.gross`, validation = array semantics. |
| 2026-05-01 | §3.8 Single-Property Floor Handling added: **Επιλογή Β** (toast suggest, no block). Νέες i18n keys προστέθηκαν. |
| 2026-05-01 | §3.9 Property Deletion Safeguards added: **Β+Γ συνδυασμός** (restrict by default + soft archive option). Νέα `Property` schema fields: `archivedAt`, `archivedBy`. |
| 2026-05-01 | §3.3.1 Reopen action verified: backend υπάρχει ήδη στο `boq-service.ts:34-40` (`BOQ_ALLOWED_TRANSITIONS`). Λείπει μόνο UI button — προστέθηκε ως step 7e στο Implementation Plan. |
| 2026-05-01 | §6 Implementation Plan rewritten: ~12 modified + 4 new files + 1 new dialog. Mode: Orchestrator. Steps 7e (reopen UI), 8 (single-floor toast), 11 (partial-area allocation), 12 (deletion guard) προστέθηκαν. |
| 2026-05-01 | §9 References: ADR-236 + ADR-261 cross-references προστέθηκαν. |
| 2026-05-01 | **Status: ⛔ BLOCKED → ✅ ACCEPTED.** All design questions resolved (6/6 original + 3 multi-level + 3 carry-over from handoff = 12/12 total). Ready for implementation phase. |
| 2026-05-01 | **BLOCKER identified**: multi-floor properties (μεζονέτες, καταστήματα 6μ, μεγάλα καταστήματα 4-επιπέδων). Status → ⛔ BLOCKED. §8.1 added. ADR-330 prerequisite. Implementation order: ADR-330 first → ADR-329 second. |
