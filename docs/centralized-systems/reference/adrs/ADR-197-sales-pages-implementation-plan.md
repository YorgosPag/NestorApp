# ADR-197: Sales Pages Implementation Plan

**Status**: PROPOSED
**Date**: 2026-03-10
**Author**: Claude Agent
**Category**: UI Components / Sales Module

---

## 0. ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ ΣΥΣΤΗΜΑΤΑ — ΥΠΟΧΡΕΩΤΙΚΗ ΧΡΗΣΗ

### ΤΕΡΜΑΤΙΚΟΣ ΚΑΝΟΝΑΣ

Οι σελίδες Πωλήσεων **ΠΡΕΠΕΙ** να χρησιμοποιούν τα παρακάτω κεντρικοποιημένα συστήματα. **ΑΠΑΓΟΡΕΥΕΤΑΙ** η δημιουργία νέων implementations.

### 0.1 Page Container (Κεντρικοποιημένο)

| Σύστημα | Path | Χρήση |
|---------|------|-------|
| `PageContainer` | `src/core/containers/PageContainer.tsx` | Wrapper κάθε σελίδας — `<section>` semantic HTML, overflow handling, consistent height |

```tsx
import { PageContainer } from '@/core/containers';
// ✅ ΥΠΟΧΡΕΩΤΙΚΟ: Κάθε σελίδα Πωλήσεων μέσα σε PageContainer
<PageContainer ariaLabel={t('sales.available.title')}>
  {children}
</PageContainer>
```

### 0.2 List Container (Κεντρικοποιημένο)

| Σύστημα | Path | Χρήση |
|---------|------|-------|
| `ListContainer` | `src/core/containers/ListContainer.tsx` | Container για list/grid views — responsive spacing, overflow handling |

```tsx
import { ListContainer } from '@/core/containers';
// ✅ ΥΠΟΧΡΕΩΤΙΚΟ: Όλες οι λίστες/grids μέσα σε ListContainer
<ListContainer>
  {viewMode === 'grid' ? <SalesGridView /> : <SalesListView />}
</ListContainer>
```

### 0.3 Compact Toolbar / PageHeader (Κεντρικοποιημένο)

| Σύστημα | Path | Χρήση |
|---------|------|-------|
| `PageHeader` | `src/core/headers/enterprise-system/components/PageHeader.tsx` | Compact toolbar — view toggle, dashboard toggle, search, actions |
| `HeaderActions` | `src/core/headers/enterprise-system/components/HeaderActions.tsx` | Action buttons (view mode, dashboard, add) |
| `HeaderSearch` | `src/core/headers/enterprise-system/components/HeaderSearch.tsx` | Search input |
| `HeaderTitle` | `src/core/headers/enterprise-system/components/HeaderTitle.tsx` | Title με icon |
| `HeaderViewToggle` | `src/core/headers/enterprise-system/components/HeaderViewToggle.tsx` | List/Grid toggle |

```tsx
import { PageHeader } from '@/core/headers';
// ✅ ΥΠΟΧΡΕΩΤΙΚΟ: Χρήση του κεντρικοποιημένου PageHeader
<PageHeader
  variant="sticky-rounded"
  layout="compact"
  spacing="compact"
  title={{ icon: DollarSign, title: t('...'), subtitle: t('...') }}
  breadcrumb={<NavigationBreadcrumb />}
  search={{ value: searchTerm, onChange: setSearchTerm, placeholder: t('...') }}
  actions={{ showDashboard, onDashboardToggle, viewMode, onViewModeChange, viewModes: ['list', 'grid'] }}
/>
```

### 0.4 Dashboard (Κεντρικοποιημένο)

| Σύστημα | Path | Χρήση |
|---------|------|-------|
| `UnifiedDashboard` | `src/components/property-management/dashboard/UnifiedDashboard.tsx` | Stats cards, distribution charts |

```tsx
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
// ✅ ΥΠΟΧΡΕΩΤΙΚΟ: Χρήση του κεντρικοποιημένου dashboard
<UnifiedDashboard stats={salesStats} columns={6} />
```

### 0.5 Advanced Filters (Κεντρικοποιημένο)

| Σύστημα | Path | Χρήση |
|---------|------|-------|
| `AdvancedFiltersPanel` | `src/components/core/AdvancedFilters/` | Configurable filters panel |

```tsx
import { AdvancedFiltersPanel } from '@/components/core/AdvancedFilters';
// ✅ ΥΠΟΧΡΕΩΤΙΚΟ: Χρήση του κεντρικοποιημένου filter system
// Δημιουργούμε ΜΟΝΟ νέο config (salesUnitsFiltersConfig), ΟΧΙ νέο component
<AdvancedFiltersPanel config={salesUnitsFiltersConfig} filters={filters} onFiltersChange={setFilters} />
```

### 0.6 Mobile Slide-In (Κεντρικοποιημένο)

| Σύστημα | Path | Χρήση |
|---------|------|-------|
| `MobileDetailsSlideIn` | `src/core/layouts/` | Mobile filter/details slide-in panel |

### 0.7 Design Tokens & Hooks (Κεντρικοποιημένα)

| Hook | Path | Χρήση |
|------|------|-------|
| `useIconSizes` | `src/hooks/useIconSizes.ts` | Τυποποιημένα μεγέθη icons |
| `useSemanticColors` | `src/ui-adapters/react/useSemanticColors.ts` | Semantic χρώματα (bg, text, border) |
| `useBorderTokens` | `src/hooks/useBorderTokens.ts` | Border/card styles |
| `useLayoutClasses` | `src/hooks/useLayoutClasses.ts` | Responsive spacing tokens |
| `useTranslation` | `src/i18n/hooks/useTranslation.ts` | i18n μεταφράσεις |

### 0.8 Navigation (Κεντρικοποιημένο)

| Σύστημα | Path | Χρήση |
|---------|------|-------|
| `NavigationBreadcrumb` | `src/components/navigation/components/NavigationBreadcrumb.tsx` | Breadcrumb στο header |
| `useNavigation` | `src/components/navigation/core/NavigationContext.tsx` | Breadcrumb sync |
| `NAVIGATION_ENTITIES` | `src/components/navigation/config/navigation-entities.ts` | Icons, colors, labels (SSoT) |

### 0.9 Effects & Interactions (Κεντρικοποιημένα)

| Σύστημα | Path | Χρήση |
|---------|------|-------|
| `TRANSITION_PRESETS` | `src/components/ui/effects` | Transition animations |
| `INTERACTIVE_PATTERNS` | `src/components/ui/effects` | Hover/focus patterns |

---

## 1. CONTEXT & PROBLEM

### 1.1 Τι ζητήθηκε

Ο Γιώργος ζήτησε έρευνα και σχεδιασμό για τις σελίδες **Πωλήσεων** (Sales), ώστε να υλοποιηθούν πλήρως και να είναι **ομοιόμορφες** με τις σελίδες **Χώρων** (Spaces).

### 1.2 Τρέχουσα Κατάσταση

#### Σελίδες Χώρων (ΠΛΗΡΕΙΣ - Enterprise Pattern)

| Σελίδα | Route | Κατάσταση | Δυνατότητες |
|--------|-------|-----------|-------------|
| Μονάδες | `/units` (redirect `/spaces/apartments`) | ✅ ΠΛΗΡΗΣ | Firestore data, List/Grid views, Details panel, Filters, Dashboard, CRUD |
| Αποθήκες | `/spaces/storage` | ✅ ΠΛΗΡΗΣ | Firestore data, List/Grid views, Details panel, Filters, Dashboard, CRUD |
| Parking | `/spaces/parking` | ✅ ΠΛΗΡΗΣ | Firestore data, List/Grid views, Details panel, Filters, Dashboard, Add/Delete |

**Pattern σελίδων Χώρων:**
```
┌──────────────────────────────────────────────────┐
│ Header (compact toolbar)                          │
│ [ViewMode] [Dashboard] [Search] [Filters] [+Add] │
├──────────────────────────────────────────────────┤
│ Dashboard (toggle-able)                           │
│ [6 stat cards] [Status distribution] [Type dist.] │
├────────┬─────────────────────────────────────────┤
│Filters │ List View      │ Details Panel           │
│(aside) │ ────────────── │ ─────────────           │
│        │ Item cards     │ Header + Tabs           │
│        │ with selection │ (General, Photos, etc.) │
│        │                │                          │
│        │ --- OR ---     │                          │
│        │ Grid View      │                          │
│        │ (full width)   │                          │
├────────┴─────────────────────────────────────────┤
│ Mobile: Slide-in filters                          │
└──────────────────────────────────────────────────┘
```

#### Σελίδες Πωλήσεων (PLACEHOLDER - Mock Data)

| Σελίδα | Route | Κατάσταση | Περιεχόμενο |
|--------|-------|-----------|-------------|
| Πωλήσεις (index) | `/sales` | ⚠️ MOCK | Dashboard + Navigation cards |
| Διαθ. Μονάδες | `/sales/available-apartments` | ⚠️ MOCK | Stats + Type cards (hardcoded τιμές) |
| Διαθ. Αποθήκες | `/sales/available-storage` | ⚠️ MOCK | Stats + Type cards (hardcoded τιμές) |
| Διαθ. Parking | `/sales/available-parking` | ⚠️ MOCK | Stats + Type cards (hardcoded τιμές) |
| Πωληθέντα | `/sales/sold` | ⚠️ MOCK | Stats + Breakdown (hardcoded τιμές) |

**Τρέχον pattern σελίδων Πωλήσεων:**
```
┌──────────────────────────────────────────┐
│ Simple Header (icon + title)              │
├──────────────────────────────────────────┤
│ UnifiedDashboard (mock stats)             │
│                                          │
│ Static cards (hardcoded values):          │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│ │Type Card│ │Type Card│ │Type Card│     │
│ │(mock)   │ │(mock)   │ │(mock)   │     │
│ └─────────┘ └─────────┘ └─────────┘     │
│                                          │
│ Price analysis + Activity (mock)          │
│                                          │
│ Info message                              │
└──────────────────────────────────────────┘
```

### 1.3 Κρίσιμη Διαφορά

| Χαρακτηριστικό | Χώροι (Spaces) | Πωλήσεις (Sales) |
|----------------|----------------|-------------------|
| Data source | Firestore (πραγματικά) | Hardcoded mock values |
| List/Grid views | ✅ Ναι | ❌ Όχι |
| Filters | ✅ Advanced panel | ❌ Τίποτα |
| Details panel | ✅ Με tabs | ❌ Τίποτα |
| CRUD operations | ✅ Add/Edit/Delete | ❌ Τίποτα |
| Search | ✅ Ναι | ❌ Τίποτα |
| View toggle | ✅ List/Grid | ❌ Τίποτα |
| Breadcrumb sync | ✅ Ναι | ❌ Τίποτα |

---

## 2. ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΑΝΑΛΥΣΗ

### 2.1 Domain Model (REAL_ESTATE_HIERARCHY_DOCUMENTATION.md)

```
Physical Space (Χώρος)          Sellable Asset (Πωλήσιμο)
─────────────────────          ────────────────────────
- id                           - id
- name                         - physicalSpaceId → links to Physical Space
- type (apartment/storage/     - price
  parking/common)              - status (available/reserved/sold)
- area (m²)                    - buyerId → links to Contact
- floor                        - saleDate
- buildingId                   - media (photos, videos, DXF)
- NO price                     - contract docs
- NO buyer
- NO sales status
```

### 2.2 Τρέχουσα Πραγματικότητα στον Κώδικα

**Τα types ΗΔΗ έχουν πωλησιακά πεδία στον φυσικό χώρο:**

- `Unit.price` — τιμή μέσα στη μονάδα (deprecated)
- `Unit.status` — legacy sales status (deprecated, αντικαταστάθηκε από `operationalStatus`)
- `Storage.price` — τιμή αποθήκης
- `Storage.status` — περιέχει 'sold', 'available' (μικτό)
- `ParkingSpot.price` — τιμή parking
- `ParkingSpot.status` — περιέχει 'sold', 'available' (μικτό)

**Αυτό σημαίνει**: Δεν χρειάζεται ξεχωριστό `SellableAsset` entity **τώρα**. Μπορούμε να τραβάμε τα ίδια δεδομένα (units/storage/parking) και να φιλτράρουμε κατά status.

### 2.3 ΑΠΟΦΑΣΗ: Ενιαίο Πεδίο `commercialStatus` (Εγκρίθηκε 2026-03-10)

> **Enterprise Pattern**: Yardi Voyager, SAP RE-FX, MRI Software — ένα ενιαίο πεδίο εμπορικής κατάστασης, ανεξάρτητο από το `operationalStatus`.

**Νέο πεδίο**: `commercialStatus` (τύπος: `CommercialStatus`)

| Τιμή | Ελληνικά | Σημασία |
|------|----------|---------|
| `unavailable` | Μη διαθέσιμη | Default — δεν κυκλοφορεί στην αγορά |
| `for-sale` | Προς πώληση | Διαθέσιμη για αγορά |
| `for-rent` | Προς ενοικίαση | Διαθέσιμη για ενοικίαση |
| `for-sale-and-rent` | Προς πώληση & ενοικίαση | Dual listing |
| `reserved` | Κρατημένη | Προκαταβολή δόθηκε |
| `sold` | Πωλημένη | Ολοκληρώθηκε η πώληση |
| `rented` | Ενοικιασμένη | Ενεργό μισθωτήριο |

**Γιατί ΕΝΑ πεδίο** (όχι ξεχωριστά `saleStatus` + `rentalStatus`):
- Μια μονάδα ακολουθεί **ένα εμπορικό μονοπάτι** κάθε φορά
- Αν πωληθεί → τέλος, δεν νοικιάζεται
- Αν νοικιαστεί → δεν πωλείται (εκτός dual listing)
- Μηδέν αντιφάσεις, λιγότερη πολυπλοκότητα

**Ανεξαρτησία από `operationalStatus`:**
- `under-construction` + `for-sale` = pre-sale (επιτρεπτό)
- `ready` + `unavailable` = δεν κυκλοφορεί ακόμα
- `ready` + `for-sale` = κανονική πώληση

**Mapping σε σελίδες:**
| Σελίδα | Φίλτρο `commercialStatus` |
|--------|---------------------------|
| Διαθέσιμες Μονάδες (Πωλήσεις) | `for-sale` ∪ `for-sale-and-rent` |
| Προς Ενοικίαση (μελλοντικό) | `for-rent` ∪ `for-sale-and-rent` |
| Πωλημένα | `sold` |
| Ενοικιασμένα (μελλοντικό) | `rented` |

**Εφαρμόζεται σε**: `Unit`, `Storage`, `ParkingSpot` types

### 2.4 ΑΠΟΦΑΣΗ: Πεδία Τιμολόγησης & Πώλησης (Εγκρίθηκε 2026-03-10)

> **Enterprise Pattern**: Salesforce Property Cloud, Yardi, HubSpot CRM — πλήρες pricing model με negotiation tracking.

**Νέα πεδία** (προστίθενται σε `Unit`, `Storage`, `ParkingSpot`):

| Πεδίο | Τύπος | Default | Σημασία |
|-------|-------|---------|---------|
| `askingPrice` | `number \| null` | `null` | Ζητούμενη τιμή καταλόγου — η τιμή που βλέπει ο αγοραστής |
| `finalPrice` | `number \| null` | `null` | Τελική τιμή πώλησης μετά διαπραγμάτευση (γράφεται στο συμβόλαιο) |
| `pricePerSqm` | computed | — | `askingPrice / area` — υπολογίζεται αυτόματα, δεν αποθηκεύεται |
| `reservationDeposit` | `number \| null` | `null` | Ποσό προκαταβολής κράτησης (status=`reserved`) |
| `buyerContactId` | `string \| null` | `null` | Reference → `contacts` collection (σύνδεση με Επαφή αγοραστή) |
| `saleDate` | `Timestamp \| null` | `null` | Ημερομηνία ολοκλήρωσης πώλησης |
| `listedDate` | `Timestamp \| null` | `null` | Ημερομηνία που μπήκε στην αγορά (υπολογισμός "ημέρες στην αγορά") |

**Computed πεδία (client-side, δεν αποθηκεύονται):**
- `pricePerSqm` = `askingPrice / (areas.gross ?? area)` — €/m²
- `discount` = `(askingPrice - finalPrice) / askingPrice * 100` — % έκπτωσης
- `daysOnMarket` = `today - listedDate` — ημέρες στην αγορά

**Παράδειγμα UI εμφάνισης:**
```
Διαμέρισμα Α-101                    [Κρατημένη]
Ζητούμενη: €285.000 · €/m²: €3.353
Τελική:    €270.000 (−5.3%)
Προκαταβολή: €10.000
Αγοραστής: Ι. Παπαδόπουλος →
Στην αγορά: 45 ημέρες
```

**Σχέσεις:**
- `buyerContactId` → `contacts` collection: κλικ στο όνομα → πλοήγηση στην καρτέλα αγοραστή
- Reverse query: "πόσες μονάδες αγόρασε ο Χ;" → `units.where('buyerContactId', '==', contactId)`

### 2.5 ΑΠΟΦΑΣΗ: Dashboard Stats — Διαθέσιμες Μονάδες (Εγκρίθηκε 2026-03-10)

> **Enterprise Pattern**: Salesforce Sales Cloud, HubSpot Deals — KPI cards στην κορυφή κάθε σελίδας πωλήσεων.

**4 Stat Cards** (ίδιο pattern με `UnifiedDashboard` στη σελίδα Μονάδων):

| # | Card Title | Value Source | Χρώμα | Icon |
|---|-----------|-------------|-------|------|
| 1 | Διαθέσιμες Μονάδες | `units.filter(u => u.commercialStatus === 'for-sale' \|\| u.commercialStatus === 'for-sale-and-rent').length` | `blue` | `ShoppingBag` |
| 2 | Μέση Τιμή | `avg(filteredUnits.map(u => u.askingPrice))` σε € | `green` | `DollarSign` |
| 3 | Συνολική Αξία | `sum(filteredUnits.map(u => u.askingPrice))` σε € | `purple` | `TrendingUp` |
| 4 | Μ.Ο. €/m² | `sum(askingPrice) / sum(areas.gross ?? area)` | `orange` | `Maximize2` |

**Format τιμών:**
- Τιμές: `€285.000` (Intl.NumberFormat, el-GR locale, 0 decimals)
- €/m²: `€3.353/m²` (0 decimals)
- Count: `12` (plain number)

**Reuse:** Χρησιμοποιεί τα ίδια `StatsCard`, `UnifiedDashboard` components — μόνο νέο config object

### 2.6 ΑΠΟΦΑΣΗ: Κάρτα Πώλησης — List Card Layout (Εγκρίθηκε 2026-03-10)

> **Enterprise Pattern**: Salesforce Property listings, Zillow agent dashboard — εμπορικά δεδομένα prominent, φυσικά δεδομένα secondary.

**Δομή κάρτας (SalesUnitListCard):**

```
┌──────────────────────────────────────────────┐
│ Α-101                     [Προς πώληση 🟢]  │  ← Γραμμή 1: Κωδικός + Badge
│ 🏠 Διαμέρισμα 2Δ │ 📐 85 m² │ 🏢 1ος      │  ← Γραμμή 2: Φυσικά στοιχεία
│ 💰 €285.000 · €3.353/m²  │ 📅 45 ημέρες    │  ← Γραμμή 3: Εμπορικά στοιχεία
└──────────────────────────────────────────────┘
```

**Γραμμή 1 — Title + Badge:**
- Title: `unit.code` (π.χ. "Α-101")
- Badge: `commercialStatus` → variant mapping (βλ. πίνακα παρακάτω)
- `inlineBadges={true}` (ίδιο pattern με UnitListCard)

**Γραμμή 2 — Φυσικά στοιχεία (CardStats):**

| Field | Icon | Color | Data |
|-------|------|-------|------|
| Τύπος | `Home` (NAVIGATION_ENTITIES.unit.icon) | `text-teal-600` | `unit.type` |
| Εμβαδόν | `Maximize2` (NAVIGATION_ENTITIES.area.icon) | `text-pink-600` | `unit.areas.gross ?? unit.area` + "m²" |
| Όροφος | `Layers` (NAVIGATION_ENTITIES.floor.icon) | `text-orange-600` | `unit.floor` + "ος" |

**Γραμμή 3 — Εμπορικά στοιχεία (CardStats):**

| Field | Icon | Color | Data |
|-------|------|-------|------|
| Τιμή | `DollarSign` | `text-green-600` | `unit.askingPrice` → `€285.000` |
| €/m² | `Calculator` | `text-blue-600` | `askingPrice / area` → `€3.353/m²` |
| Ημέρες | `Calendar` | `text-gray-500` | `today - listedDate` → `45 ημέρες` |

**Γραμμή 4 — Conditional (μόνο αν `reserved`):**

| Field | Icon | Color | Data |
|-------|------|-------|------|
| Αγοραστής | `User` | `text-violet-600` | `buyerContact.name` (resolved από `buyerContactId`) |
| Προκαταβολή | `CreditCard` | `text-amber-600` | `unit.reservationDeposit` → `€10.000` |

**Badge Variants (commercialStatus → variant):**

| Status | Badge Label | Variant | Χρώμα |
|--------|------------|---------|-------|
| `for-sale` | Προς πώληση | `success` | Green |
| `for-sale-and-rent` | Πώληση & Ενοικίαση | `info` | Blue |
| `for-rent` | Προς ενοικίαση | `warning` | Yellow |
| `reserved` | Κρατημένη | `secondary` | Purple/Gray |
| `sold` | Πωλημένη | `destructive` | Red |
| `rented` | Ενοικιασμένη | `default` | Neutral |

**Reuse:** Extends `ListCard` (design system molecule), ίδιο pattern με `UnitListCard`
- `compact={true}`, `hideIcon={true}`, `hoverVariant="standard"`
- Selection/hover states: ίδια με 8.3

### 2.7 ΑΠΟΦΑΣΗ: Details Panel Tabs — Σελίδα Πωλήσεων (Εγκρίθηκε 2026-03-10)

> **Enterprise Pattern**: Salesforce Opportunity tabs, Yardi deal view — εμπορικά tabs πρώτα, φυσικά δεδομένα ως reference.

**5 Tabs** (μέσω `unified-tabs-factory.ts`, νέο config `sales-units`):

| # | Tab ID | Icon (lucide) | Label i18n | Component | Περιεχόμενο |
|---|--------|--------------|------------|-----------|-------------|
| 1 | `sale-info` | `DollarSign` | `tabs.labels.saleInfo` → "Πώληση" | `SaleInfoContent` (νέο) | Τιμές, status, αγοραστής, προκαταβολή, ημερομηνίες |
| 2 | `unit-summary` | `Home` | `tabs.labels.unitSummary` → "Μονάδα" | `UnitSummaryContent` (νέο) | Read-only preview φυσικών στοιχείων + link "Άνοιγμα στους Χώρους →" |
| 3 | `photos` | `Camera` | `tabs.labels.photos` → "Φωτογραφίες" | `PhotosTab` (reuse) | Ίδιο component — zero duplication |
| 4 | `documents` | `FileText` | `tabs.labels.saleDocuments` → "Έγγραφα" | `DocumentsTab` (reuse) | Συμβόλαια, προσύμφωνα, αποδείξεις προκαταβολής |
| 5 | `history` | `Clock` | `tabs.labels.history` → "Ιστορικό" | `ActivityTab` (reuse) | Αλλαγές status, τιμής, αγοραστή (audit trail) |

**Tab 1 — Πώληση (SaleInfoContent) — Νέο Component:**

```
┌─ Εμπορικά Στοιχεία ──────────────────────────┐
│ Κατάσταση:     [Προς πώληση ▼]               │
│ Ζητούμενη:     €285.000                       │
│ Τελική τιμή:   €270.000  (−5.3%)             │
│ €/m²:          €3.353 (computed)              │
├─ Κράτηση ─────────────────────────────────────┤
│ Προκαταβολή:   €10.000                        │
│ Αγοραστής:     Ι. Παπαδόπουλος →             │  ← clickable → Contacts
├─ Ημερομηνίες ─────────────────────────────────┤
│ Στην αγορά:    15/01/2026                     │
│ Ημ. πώλησης:   — (δεν έχει πωληθεί ακόμα)    │
│ Ημέρες:        45                             │
└───────────────────────────────────────────────┘
```

**Tab 2 — Μονάδα (UnitSummaryContent) — Νέο Component:**

```
┌─ Φυσικά Στοιχεία (read-only) ─────────────────┐
│ Τύπος: Διαμέρισμα 2Δ  │  Εμβαδόν: 85 m²      │
│ Όροφος: 1ος           │  Κτίριο: Α            │
│ Υπνοδωμάτια: 2        │  Μπάνια: 1            │
│ Προσανατολισμός: Βόρειος                       │
│                                                │
│ [📍 Άνοιγμα στους Χώρους →]                    │  ← link → /units?selected={unitId}
└────────────────────────────────────────────────┘
```

**Reuse (3/5 tabs):**
- `PhotosTab` → 100% reuse
- `DocumentsTab` → 100% reuse
- `ActivityTab` → 100% reuse (φιλτραρισμένο για sales events)

**Νέα components (2/5 tabs):**
- `SaleInfoContent` → νέο (εμπορικά πεδία + buyer link)
- `UnitSummaryContent` → νέο (read-only summary + navigation link)

### 2.8 ΑΠΟΦΑΣΗ: Φίλτρα Πωλήσεων — AdvancedFilters Config (Εγκρίθηκε 2026-03-10)

> **Enterprise Pattern**: Salesforce list views, HubSpot deal filters — εμπορικά φίλτρα με smart defaults.

**Νέο config**: `salesUnitsFiltersConfig` (χρησιμοποιεί υπάρχον `AdvancedFiltersPanel`)

**Row 1 Fields:**

| Field ID | Type | Label i18n | Component | Τιμές |
|----------|------|------------|-----------|-------|
| `searchTerm` | `search` | `sales.filters.search` | Input + Search icon (`pl-9 h-9`) | Free text: κωδικός, αγοραστής |
| `priceRange` | `range` (dropdown) | `sales.filters.priceRange` | Radix Select + custom inputs | `all`, `0-100K`, `100-250K`, `250-400K`, `400K+`, `custom` |
| `commercialStatus` | `select` | `sales.filters.commercialStatus` | Radix Select | `for-sale`, `for-sale-and-rent`, `reserved` |

**Row 2 Fields:**

| Field ID | Type | Label i18n | Component | Τιμές |
|----------|------|------------|-----------|-------|
| `type` | `select` | `sales.filters.unitType` | Radix Select | `studio`, `apartment`, `maisonette`, `shop`, `office` |
| `building` | `select` | `sales.filters.building` | Radix Select | Dynamic από Firestore |
| `floor` | `select` | `sales.filters.floor` | Radix Select | Dynamic από Firestore |
| `areaRange` | `range` (dropdown) | `sales.filters.areaRange` | Radix Select + custom inputs | `all`, `0-50m²`, `50-100m²`, `100-200m²`, `200+m²`, `custom` |

**Price Range Presets:**
- `all`: Όλες οι τιμές
- `budget`: €0 – €100.000
- `mid`: €100.000 – €250.000
- `premium`: €250.000 – €400.000
- `luxury`: €400.000+
- `custom`: Custom min/max inputs

**Smart Defaults:**
- `commercialStatus`: pre-selected `for-sale` (ο πωλητής βλέπει μόνο διαθέσιμα by default)
- Υπόλοιπα: `all` (κανένα φίλτρο)

**Reuse:** 100% `AdvancedFiltersPanel` + `FilterField` + `useGenericFilters` — μόνο νέο config object
**i18n namespace:** `sales` (νέο namespace, ξεχωριστό από `units`)

### 2.9 ΑΠΟΦΑΣΗ: Εμπορικές Ενέργειες — Sales Actions (Εγκρίθηκε 2026-03-10)

> **Enterprise Pattern**: Salesforce Opportunity actions, Yardi deal management — πλήρης lifecycle management.

#### Phase 1 — Τώρα (7 actions)

| # | Action | Icon | Gradient | Τι κάνει | Ορατό όταν |
|---|--------|------|----------|----------|------------|
| 1 | **Αλλαγή τιμής** | `DollarSign` | Blue | Ενημέρωση `askingPrice` | `for-sale`, `for-sale-and-rent`, `for-rent` |
| 2 | **Κράτηση** | `UserCheck` | Purple | → `reserved`, ορισμός `buyerContactId` + `reservationDeposit` | `for-sale`, `for-sale-and-rent` |
| 3 | **Πώληση** | `CheckCircle` | Green | → `sold`, ορισμός `finalPrice` + `saleDate` | `for-sale`, `for-sale-and-rent`, `reserved` |
| 4 | **Ακύρωση κράτησης** | `UserX` | Gray | → `for-sale`, καθαρισμός buyer/deposit | `reserved` |
| 5 | **Απόσυρση** | `EyeOff` | Gray | → `unavailable` (αποσύρεται από αγορά) | `for-sale`, `for-sale-and-rent`, `for-rent` |
| 6 | **Επαναφορά στην αγορά** | `RotateCcw` | Blue | → `for-sale` (ξανά διαθέσιμη) | `unavailable` |
| 7 | **Αλλαγή σε ενοικίαση** | `Key` | Orange | → `for-rent` (αλλαγή εμπορικού μονοπατιού) | `for-sale`, `for-sale-and-rent` |

**Visibility rule:** Κάθε action εμφανίζεται **μόνο** στα κατάλληλα `commercialStatus` — δεν υπάρχει "Πώληση" σε ήδη πωλημένη μονάδα.

**Confirmation dialogs:** Actions 3 (Πώληση) και 5 (Απόσυρση) απαιτούν confirmation dialog πριν εκτελεστούν.

**Audit trail:** Κάθε action καταγράφεται στο Ιστορικό (tab 5) με: ποιος, πότε, τι άλλαξε.

#### Phase 2 — Μελλοντικά (3 actions)

| # | Action | Icon | Εξαρτάται από | Περιγραφή |
|---|--------|------|---------------|-----------|
| 8 | **Εκτύπωση φυλλαδίου** | `Printer` | PDF generation engine | PDF export: φωτογραφία + στοιχεία + τιμή |
| 9 | **Αποστολή σε πελάτη** | `Mail` | Email pipeline templates | Email με στοιχεία μονάδας σε επαφή |
| 10 | **Σημείωση** | `MessageSquare` | Notes system | Γρήγορη σημείωση στο ιστορικό (CRM mini) |

#### Implementation Pattern

```typescript
// SSoT: src/core/entity-headers/entity-action-presets.ts
// Νέα presets για sales actions:
createEntityAction('change-price', label, callback)     // → DollarSign + BLUE
createEntityAction('reserve', label, callback)           // → UserCheck + PURPLE
createEntityAction('sell', label, callback)              // → CheckCircle + GREEN
createEntityAction('cancel-reservation', label, callback)// → UserX + GRAY
createEntityAction('withdraw', label, callback)          // → EyeOff + GRAY
createEntityAction('relist', label, callback)            // → RotateCcw + BLUE
createEntityAction('switch-to-rent', label, callback)    // → Key + ORANGE
```

### 2.10 ΑΠΟΦΑΣΗ: TypeQuickFilters — Dual Row (Εγκρίθηκε 2026-03-10)

> **Enterprise Pattern**: Salesforce list segmentation, HubSpot deal views — πολλαπλά επίπεδα quick filters ταυτόχρονα.

**Δύο σειρές quick filters** (η μία πάνω από την άλλη):

#### Σειρά 1 — Εμπορική κατάσταση

| Button | Value | Icon | Φίλτρο |
|--------|-------|------|--------|
| Όλα | `all` | `LayoutGrid` | Κανένα φίλτρο |
| Προς πώληση | `for-sale` | `ShoppingBag` | `commercialStatus === 'for-sale'` |
| Κρατημένα | `reserved` | `UserCheck` | `commercialStatus === 'reserved'` |
| Πώληση & Ενοικίαση | `for-sale-and-rent` | `Key` | `commercialStatus === 'for-sale-and-rent'` |

#### Σειρά 2 — Τύπος μονάδας

| Button | Value | Icon | Φίλτρο |
|--------|-------|------|--------|
| Όλα | `all` | `LayoutGrid` | Κανένα φίλτρο |
| Studio | `studio` | `BedSingle` | `unit.type === 'studio'` |
| Διαμέρισμα | `apartment` | `Building2` | `unit.type === 'apartment'` |
| Μαιζονέτα | `maisonette` | `Building2` | `unit.type === 'maisonette'` |
| Κατάστημα | `shop` | `Store` | `unit.type === 'shop'` |
| Γραφείο | `office` | `Briefcase` | `unit.type === 'office'` |

**Συμπεριφορά:**
- Κάθε σειρά λειτουργεί **ανεξάρτητα** (single-select per row)
- Τα φίλτρα **συνδυάζονται** (AND logic): "Κρατημένα" + "Διαμέρισμα" = κρατημένα διαμερίσματα
- Κλικ "Όλα" σε μια σειρά → καθαρίζει μόνο εκείνο το φίλτρο
- Active style: `bg-primary text-primary-foreground shadow-sm`
- Inactive style: `bg-transparent hover:bg-muted/50`

**CSS Layout:**
```
flex flex-col gap-1
├── Row 1: flex flex-wrap gap-1 (commercialStatus buttons)
└── Row 2: flex flex-wrap gap-1 (unitType buttons)
```

**Reuse:** Extends `TypeQuickFilters` component — 2 instances με διαφορετικό config
**Button CSS:** `h-7 px-2 text-xs font-medium` (ίδιο με σελίδα Μονάδων)

### 2.11 ΑΠΟΦΑΣΗ: Header Actions — PageHeader Buttons (Εγκρίθηκε 2026-03-10)

> **Enterprise Pattern**: Salesforce list header actions — contextual actions ανά σελίδα.

**3 Buttons στο PageHeader (δεξιά πλευρά):**

| # | Button | Icon Active | Icon Inactive | Variant Active | Variant Inactive | Λειτουργία |
|---|--------|-------------|---------------|----------------|------------------|------------|
| 1 | **Dashboard toggle** | `Eye` | `EyeOff` | `default` | `outline` | Εμφάνιση/απόκρυψη stats cards |
| 2 | **View mode** | `List` / `LayoutGrid` | — | `default` | `outline` | Εναλλαγή list ↔ grid view |
| 3 | **Προσθήκη στην αγορά** | `Plus` | — | Green gradient | — | Επιλογή υπάρχουσας μονάδας → `for-sale` |

**Button 3 — "Προσθήκη στην αγορά" (διαφορά από Χώρους):**
- Στους Χώρους: `Plus` = δημιουργία νέας μονάδας (inline form)
- Στις Πωλήσεις: `Plus` = **επιλογή υπάρχουσας** μονάδας με `commercialStatus === 'unavailable'`
- Click → Modal/Dropdown με λίστα `unavailable` μονάδων → επιλογή → status → `for-sale`
- Gradient: `from-green-500 to-green-600 text-white` (ίδιο με "Νέα Μονάδα")

**Reuse:**
- Buttons 1 & 2: 100% reuse `HeaderActions` + `HeaderViewToggle` (ίδια components)
- Button 3: Νέο action στο `HeaderActions` config

**Responsive:**
- Desktop: Και τα 3 ορατά
- Mobile: Dashboard toggle + "+" button ορατά, view mode → `MobileHeaderViewToggle` (cycle button)

### 2.12 ΑΠΟΦΑΣΗ: Grid View Card — Sales Grid Layout (Εγκρίθηκε 2026-03-10)

> **Enterprise Pattern**: Zillow agent grid, Realtor.com listings — visual-first grid cards με thumbnail.

**Grid Card Layout (SalesUnitGridCard):**

```
┌─────────────────────────┐
│ [📷 Thumbnail/Placeholder]│  ← aspect-ratio: 16/10, object-fit: cover
│                         │
├─────────────────────────┤
│ Α-101    [Προς πώληση]  │  ← Κωδικός + Badge
│ Διαμέρισμα · 85 m²      │  ← Τύπος + Εμβαδόν
│                         │
│ 💰 €285.000             │  ← Τιμή (prominent, font-bold)
│ €3.353/m² · 45 ημέρες   │  ← €/m² + days on market
│                         │
│ [Λεπτομέρειες →]        │  ← CTA button
└─────────────────────────┘
```

**Thumbnail Section:**
- Container: `aspect-[16/10] overflow-hidden rounded-t-lg bg-muted`
- Image: `object-cover w-full h-full`
- Placeholder (δεν υπάρχει φωτό): Icon `ImageOff` centered, `text-muted-foreground`
- Badge overlay: Absolute positioned, top-right, `m-2`

**Content Section:**
- Padding: `p-3` (12px)
- Title: `text-sm font-semibold truncate` (14px, 600)
- Subtitle: `text-xs text-muted-foreground` (12px)
- Price: `text-lg font-bold text-green-600` (18px, 700)
- Secondary: `text-xs text-muted-foreground` (12px)
- CTA: `Button variant="ghost" size="sm"`, `w-full justify-center mt-2`

**Grid Layout:**
- CSS: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2`
- Full width (δεν υπάρχει details panel σε grid mode)

**Hover:**
- `INTERACTIVE_PATTERNS.CARD_ENHANCED` — `hover:shadow-xl transition-all duration-200 hover:scale-[1.02]`

**Click behavior:**
- Click card → navigates to details (switches to list mode with unit selected)
- Click "Λεπτομέρειες →" → ίδια συμπεριφορά

**Responsive columns:**
| Breakpoint | Columns |
|------------|---------|
| Mobile (<640px) | 1 |
| sm (≥640px) | 2 |
| lg (≥1024px) | 3 |
| xl (≥1280px) | 4 |

### 2.13 ΑΠΟΦΑΣΗ: Mobile-First Responsive — Σελίδα Διαθέσιμες Μονάδες (Εγκρίθηκε 2026-03-10)

> **ΚΡΙΣΙΜΟΣ ΚΑΝΟΝΑΣ**: Η σελίδα πρέπει να λειτουργεί **τέλεια** σε κινητά. Ο πωλητής είναι συχνά on-the-go.

#### Mobile Layout (<640px)

```
┌─────────────────────────────┐
│ PageHeader (compact)         │
│ [🏷] Διαθ. Μονάδες  [👁][+] │
├─────────────────────────────┤
│ Dashboard (2×2 grid)         │
│ ┌──────┐ ┌──────┐          │
│ │ 12   │ │€245K │          │
│ │Διαθ. │ │Μ.Τιμή│          │
│ ├──────┤ ├──────┤          │
│ │€2.9M │ │€3.2K │          │
│ │Αξία  │ │€/m²  │          │
│ └──────┘ └──────┘          │
├─────────────────────────────┤
│ [Φίλτρα ▼] (collapsible)    │
├─────────────────────────────┤
│ Quick Filters Row 1          │
│ [Όλα][Πώληση][Κράτηση]      │
│ Quick Filters Row 2          │
│ [Όλα][Studio][Διαμ.][Μαιζ.] │
├─────────────────────────────┤
│ ┌───────────────────────┐   │
│ │ Card: Α-101 [Πώληση]  │   │
│ │ Διαμέρισμα · 85m²     │   │
│ │ €285.000 · 45 ημ.     │   │
│ ├───────────────────────┤   │
│ │ Card: Α-102 [Κράτηση] │   │
│ │ Studio · 42m²         │   │
│ │ €145.000 · 12 ημ.     │   │
│ └───────────────────────┘   │
│        ↓ scroll              │
└─────────────────────────────┘
```

**Click σε card → MobileDetailsSlideIn (slide-in panel από δεξιά)**

#### Κρίσιμες Mobile Αποφάσεις

| Στοιχείο | Desktop | Mobile |
|----------|---------|--------|
| **PageHeader** | Full breadcrumb + 3 buttons | Χωρίς breadcrumb, 2 buttons (Eye + Plus) |
| **Dashboard** | 4 cols (`lg:grid-cols-4`) | 2 cols (`grid-cols-2`) |
| **Φίλτρα** | Πάντα ορατά (collapsible) | Κρυφά by default, toggle button στο header |
| **Quick Filters** | Μία γραμμή (χωράνε) | `flex-wrap` — αναδιπλώνονται σε 2 γραμμές |
| **List cards** | Side-by-side με details | Full-width, tap → slide-in |
| **Details panel** | Δεξιά στήλη (permanent) | `MobileDetailsSlideIn` (overlay) |
| **Grid view** | 3-4 columns | 1 column |
| **Action buttons** | Text + icon | Icon-only (χωρίς label) |
| **Tab labels** | Ορατά | `hidden sm:inline` — μόνο icons |
| **Filter grid** | 4 cols (`lg:grid-cols-4`) | 1 col (`grid-cols-1`) |
| **View toggle** | `HeaderViewToggle` (connected buttons) | `MobileHeaderViewToggle` (cycle button) |
| **Filter button** | Δεν εμφανίζεται (φίλτρα πάντα ορατά) | `md:hidden` — εμφανίζεται μόνο mobile |

#### Touch-Friendly Sizing

| Element | Min Size | Λόγος |
|---------|----------|-------|
| Quick filter buttons | `h-7` (28px) min | Αρκετά μεγάλα για tap |
| Action buttons | `h-10` (40px) | Apple HIG: 44px min touch target |
| List cards | `min-h-[60px]` | Εύκολο tap χωρίς accidental selection |
| Tab triggers | `h-9` (36px) | Comfortable tap size |

#### Swipe Gestures (μελλοντικό)

- Swipe left σε card → Quick actions (Κράτηση, Αλλαγή τιμής)
- Swipe right → Back (close slide-in)
- Pull-to-refresh → Reload data

---

## 3. ΠΡΟΤΑΣΗ ΥΛΟΠΟΙΗΣΗΣ

### 3.1 Στρατηγική: "Same Data, Sales Lens"

Οι σελίδες Πωλήσεων θα χρησιμοποιούν τα **ίδια δεδομένα** (units, storages, parking spots) αλλά με **εμπορική οπτική**:

- Φιλτράρισμα: μόνο status `available`, `reserved`, `sold`
- Εμφάνιση: τιμή, αγοραστής, ημερομηνία πώλησης — prominence
- Κρυφά: κατασκευαστικά/τεχνικά πεδία (orientation, energy class κτλ.)

### 3.2 Αρχιτεκτονικό Pattern

**Επαναχρησιμοποίηση components (DRY) αντί για νέα κατασκευή:**

```
Σελίδα Πωλήσεων
├── SalesHeader (νέο — βασισμένο σε StoragesHeader pattern)
│   ├── ViewMode toggle (list/grid)
│   ├── Dashboard toggle
│   ├── Search
│   ├── Filters button
│   └── Export button (μελλοντικό)
│
├── UnifiedDashboard (ΥΠΑΡΧΕΙ — reuse)
│   ├── Sales-specific stats (πραγματικά δεδομένα)
│   └── Revenue breakdown, conversion rates
│
├── AdvancedFiltersPanel (ΥΠΑΡΧΕΙ — νέο config)
│   ├── salesUnitFiltersConfig
│   ├── salesStorageFiltersConfig
│   └── salesParkingFiltersConfig
│
├── ListContainer (ΥΠΑΡΧΕΙ — reuse)
│   ├── SalesCardList (νέο) — κάρτες με εμπορική πληροφορία
│   └── SalesGridView (νέο) — grid με εμπορική πληροφορία
│
└── SalesDetailsPanel (νέο) — tabs εμπορικές
    ├── Tab: Πληροφορίες Πώλησης (τιμή, status, buyer)
    ├── Tab: Φυσικός Χώρος (link στο Physical Space)
    ├── Tab: Media (φωτογραφίες, DXF)
    ├── Tab: Συμβόλαιο (μελλοντικό)
    └── Tab: Ιστορικό (αλλαγές status, τιμής)
```

### 3.3 Τι Περιέχει Κάθε Κάρτα Πώλησης

#### Κάρτα "Διαθέσιμη Μονάδα" (Available Unit Card):

```
┌────────────────────────────────────┐
│ [Badge: AVAILABLE]     [Heart ♡]   │
│                                    │
│ 🏠 Διαμέρισμα Α-101              │
│ Κτίριο Α · 1ος Όροφος · 85 m²    │
│                                    │
│ ┌──────────┐                      │
│ │ Thumbnail │  3 υπν. · 2 μπ.     │
│ │ (photo)   │  Ανατολικός          │
│ │           │  Ενεργειακή: Β+      │
│ └──────────┘                      │
│                                    │
│ 💰 €285.000        📐 €3.353/m²   │
│ 📅 Στην αγορά: 45 ημέρες          │
│                                    │
│ [Λεπτομέρειες →]                   │
└────────────────────────────────────┘
```

#### Κάρτα "Διαθέσιμη Αποθήκη" (Available Storage Card):

```
┌────────────────────────────────────┐
│ [Badge: AVAILABLE]                 │
│                                    │
│ 📦 Αποθήκη Α-01                   │
│ Υπόγειο -1 · 15 m²                │
│                                    │
│ Τύπος: Μεγάλη · Πρόσβαση: Ράμπα   │
│                                    │
│ 💰 €18.000         📐 €1.200/m²   │
│ 📅 Στην αγορά: 30 ημέρες          │
│                                    │
│ [Λεπτομέρειες →]                   │
└────────────────────────────────────┘
```

#### Κάρτα "Διαθέσιμο Parking" (Available Parking Card):

```
┌────────────────────────────────────┐
│ [Badge: AVAILABLE]                 │
│                                    │
│ 🅿️ Θέση P-003                     │
│ Υπόγειο -1 · Κλειστή              │
│                                    │
│ Τύπος: Standard · 12.5 m²         │
│                                    │
│ 💰 €22.000                        │
│ 📅 Στην αγορά: 60 ημέρες          │
│                                    │
│ [Λεπτομέρειες →]                   │
└────────────────────────────────────┘
```

#### Κάρτα "Πωλημένο" (Sold Card):

```
┌────────────────────────────────────┐
│ [Badge: SOLD ✓]                    │
│                                    │
│ 🏠 Διαμέρισμα Β-205               │
│ Κτίριο Β · 2ος Όροφος · 110 m²   │
│                                    │
│ 👤 Ι. Παπαδόπουλος                │
│ 📅 Ημ. Πώλησης: 15/01/2026        │
│                                    │
│ 💰 €345.000 (αρχική: €360.000)    │
│ 📉 Έκπτωση: 4.2%                  │
│                                    │
│ [Λεπτομέρειες →]                   │
└────────────────────────────────────┘
```

### 3.4 Dashboard Stats (Πραγματικά Δεδομένα)

#### Available Apartments Dashboard:
| Stat | Πηγή |
|------|-------|
| Διαθέσιμες Μονάδες | `units.filter(u => u.operationalStatus === 'ready' && hasNoSoldStatus)` |
| Μ.Ο. Τιμής | `avg(units.price)` |
| Συνολική Αξία | `sum(units.price)` |
| Μ.Ο. €/m² | `sum(price) / sum(area)` |

#### Available Storage Dashboard:
| Stat | Πηγή |
|------|-------|
| Διαθέσιμες | `storages.filter(s => s.status === 'available')` |
| Μ.Ο. Τιμής | `avg(storages.price)` |
| Κατά Τύπο | `groupBy(type)` |
| Κατά Όροφο | `groupBy(floor)` |

#### Available Parking Dashboard:
| Stat | Πηγή |
|------|-------|
| Διαθέσιμες | `parkingSpots.filter(p => p.status === 'available')` |
| Μ.Ο. Τιμής | `avg(parkingSpots.price)` |
| Κατά Ζώνη | `groupBy(locationZone)` |
| Κατά Τύπο | `groupBy(type)` |

#### Sold Properties Dashboard:
| Stat | Πηγή |
|------|-------|
| Σύνολο Πωλημένων | `all.filter(status === 'sold').length` |
| Συνολικά Έσοδα | `sum(soldItems.price)` |
| Μ.Ο. Χρόνου Πώλησης | Απαιτεί `listedDate` field (μελλοντικό) |
| Κατά Κατηγορία | Apartments / Storage / Parking breakdown |

### 3.5 Filters Configuration

#### salesAvailableFiltersConfig (νέο):
```
- Τύπος ακινήτου: studio, 1-bed, 2-bed, 3-bed+, maisonette
- Εύρος τιμής: €0-100K, €100-250K, €250-400K, €400K+
- Εύρος εμβαδού: min/max m²
- Κτίριο: dropdown
- Όροφος: dropdown
- Ενεργειακή κλάση: A+, A, B+, B, Γ
- Προσανατολισμός: Βόρειος, Νότιος, Ανατολικός, Δυτικός
```

#### salesStorageFiltersConfig (νέο):
```
- Τύπος: Μεγάλη, Μικρή, Υπόγεια, Ισόγεια
- Εύρος τιμής: min/max €
- Εύρος εμβαδού: min/max m²
- Κτίριο: dropdown
```

#### salesParkingFiltersConfig (νέο):
```
- Τύπος: Standard, Handicapped, Electric, Motorcycle
- Ζώνη: Υπόγειο, Πιλοτή, Ανοιχτός χώρος
- Εύρος τιμής: min/max €
```

---

## 4. ΦΑΣΕΙΣ ΥΛΟΠΟΙΗΣΗΣ

### Phase 1: Foundation (Βασική υποδομή)

1. **Sales filter configs** — `salesUnitFiltersConfig.ts`, `salesStorageFiltersConfig.ts`, `salesParkingFiltersConfig.ts`
2. **Sales hooks** — `useSalesUnits()`, `useSalesStorages()`, `useSalesParking()` (φιλτράρουν τα existing data)
3. **Sales stats hooks** — `useSalesStats()` για κάθε κατηγορία

### Phase 2: Available Pages (3 σελίδες)

4. **SalesHeader component** — Βασισμένο σε StoragesHeader
5. **SalesCardList** — Shared list component με εμπορικές κάρτες
6. **SalesGridView** — Grid layout
7. **Αντικατάσταση mock pages** — `/sales/available-apartments`, `/sales/available-storage`, `/sales/available-parking`

### Phase 3: Sold Page

8. **SoldPropertiesPage** — Πλήρης σελίδα με Firestore data
9. **SoldDetailsPanel** — Details panel με πληροφορίες πώλησης + αγοραστή

### Phase 4: Sales Index + Enhancements

10. **Sales Index Page** — Real data dashboard αντί mock
11. **Export functionality** — CSV/PDF export
12. **Quick actions** — "Mark as Sold", "Reserve", "Change Price"

---

## 5. ΑΡΧΕΙΑ ΠΟΥ ΘΑ ΔΗΜΙΟΥΡΓΗΘΟΥΝ / ΤΡΟΠΟΠΟΙΗΘΟΥΝ

### Νέα Αρχεία:

```
src/hooks/useSalesUnits.ts
src/hooks/useSalesStorages.ts
src/hooks/useSalesParking.ts
src/hooks/useSalesStats.ts
src/components/core/AdvancedFilters/configs/salesUnitFiltersConfig.ts
src/components/core/AdvancedFilters/configs/salesStorageFiltersConfig.ts
src/components/core/AdvancedFilters/configs/salesParkingFiltersConfig.ts
src/components/sales/SalesHeader.tsx
src/components/sales/SalesCardList.tsx
src/components/sales/SalesGridView.tsx
src/components/sales/SalesDetailsPanel.tsx
src/components/sales/cards/AvailableUnitCard.tsx
src/components/sales/cards/AvailableStorageCard.tsx
src/components/sales/cards/AvailableParkingCard.tsx
src/components/sales/cards/SoldPropertyCard.tsx
```

### Αρχεία που θα τροποποιηθούν:

```
src/app/sales/available-apartments/page.tsx  (ΠΛΗΡΗΣ ΑΝΤΙΚΑΤΑΣΤΑΣΗ mock → real)
src/app/sales/available-storage/page.tsx     (ΠΛΗΡΗΣ ΑΝΤΙΚΑΤΑΣΤΑΣΗ mock → real)
src/app/sales/available-parking/page.tsx     (ΠΛΗΡΗΣ ΑΝΤΙΚΑΤΑΣΤΑΣΗ mock → real)
src/app/sales/sold/page.tsx                  (ΠΛΗΡΗΣ ΑΝΤΙΚΑΤΑΣΤΑΣΗ mock → real)
src/app/sales/page.tsx                       (ΑΝΑΒΑΘΜΙΣΗ σε real data)
src/i18n/locales/el/sales.json               (νέα μεταφράσεις)
src/i18n/locales/en/sales.json               (νέα μεταφράσεις)
```

---

## 6. ΤΕΧΝΙΚΕΣ ΣΗΜΕΙΩΣΕΙΣ

### 6.1 Δεν χρειάζεται νέο Firestore collection

Τα δεδομένα υπάρχουν ήδη στα collections `units`, `storages`, `parking_spots`. Οι σελίδες Πωλήσεων απλά φιλτράρουν με "sales lens".

### 6.2 Μελλοντική εξέλιξη → SellableAsset entity

Όταν χρειαστεί πλήρης domain separation (Physical Space vs Sellable Asset), θα δημιουργηθεί ξεχωριστό `sellable_assets` collection. Αυτό ΔΕΝ είναι αναγκαίο τώρα — η σημερινή λύση δουλεύει αποτελεσματικά.

### 6.3 Reuse Enterprise Patterns

- `PageContainer`, `ListContainer` — already exist
- `UnifiedDashboard` — already exists
- `AdvancedFiltersPanel` — already exists, needs new config
- `MobileDetailsSlideIn` — already exists
- `useFirestoreUnits`, `useFirestoreStorages`, `useFirestoreParkingSpots` — already exist

---

## 7. ΑΠΟΦΑΣΗ

**APPROVED**: Η υλοποίηση θα ακολουθεί το pattern "Same Data, Sales Lens" — επαναχρησιμοποίηση υπαρχόντων δεδομένων και components, με εμπορική οπτική στην παρουσίαση.

---

## 8. ΑΝΑΛΥΤΙΚΗ ΤΕΚΜΗΡΙΩΣΗ ΣΕΛΙΔΑΣ ΜΟΝΑΔΩΝ (Reference Pattern)

> **Σκοπός**: Πλήρης τεκμηρίωση της σελίδας `/units` ώστε οι σελίδες Πωλήσεων να αναπαραχθούν με ακριβώς τα ίδια patterns.

### 8.1 Πλήρες Wireframe (ASCII)

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: PageHeader (sticky-rounded, compact)               │
│ ┌────────┬──────────────────────┬──────────────────────────┐│
│ │ Icon+  │ Breadcrumb           │ [Dashboard] [Views] [+]  ││
│ │ Title  │ Company→Project→...  │ [Filter] (mobile only)   ││
│ └────────┴──────────────────────┴──────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│ LAYER 2: UnifiedDashboard (toggle-able, 4 cards)            │
│ ┌──────────┬──────────┬──────────┬──────────┐              │
│ │Σύνολο    │Έτοιμες   │Συνολικό  │Μοναδικά  │              │
│ │Μονάδων   │Μονάδες   │Εμβαδόν   │Κτίρια    │              │
│ └──────────┴──────────┴──────────┴──────────┘              │
├─────────────────────────────────────────────────────────────┤
│ LAYER 3: AdvancedFiltersPanel (desktop: hidden, mobile: drawer) │
├─────────────────────────────────────────────────────────────┤
│ LAYER 4: ListContainer                                      │
│ ┌─────────────────────────┬────────────────────────────────┐│
│ │ EntityListColumn        │ DetailsContainer               ││
│ │ ┌─────────────────────┐ │ ┌────────────────────────────┐ ││
│ │ │GenericListHeader    │ │ │UnitDetailsHeader           │ ││
│ │ │[Icon] Title (count) │ │ │ Name    [Edit][New][Del]   │ ││
│ │ ├─────────────────────┤ │ ├────────────────────────────┤ ││
│ │ │CompactToolbar       │ │ │UniversalTabsRenderer      │ ││
│ │ │[Search][+][✏][🗑]   │ │ │[Info][Floor][Docs][📷][🎥]│ ││
│ │ │[Filter][↕][↗][↧]   │ │ │                            │ ││
│ │ ├─────────────────────┤ │ │ Tab Content...             │ ││
│ │ │UnitTypeQuickFilters │ │ │                            │ ││
│ │ │[All][Studio][Apt]...│ │ │                            │ ││
│ │ ├─────────────────────┤ │ │                            │ ││
│ │ │ScrollArea           │ │ │                            │ ││
│ │ │ ┌─────────────────┐ │ │ │                            │ ││
│ │ │ │ UnitListCard #1 │ │ │ │                            │ ││
│ │ │ │ Name [Badge]    │ │ │ │                            │ ││
│ │ │ │ 🏠 Type │📐 m² │ │ │ │                            │ ││
│ │ │ ├─────────────────┤ │ │ │                            │ ││
│ │ │ │ UnitListCard #2 │ │ │ │                            │ ││
│ │ │ │ ...             │ │ │ │                            │ ││
│ │ │ └─────────────────┘ │ │ │                            │ ││
│ │ └─────────────────────┘ │ └────────────────────────────┘ ││
│ └─────────────────────────┴────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**View Modes:**
- `list`: EntityListColumn + DetailsContainer (side by side)
- `grid`: PropertyGridView (full width, no details panel)

---

### 8.2 Κεντρικοποιημένα Components — Exact Paths

| Component | Path | Ρόλος |
|-----------|------|-------|
| `PageContainer` | `src/core/containers/PageContainer.tsx` | Outer `<section>` wrapper — `h-full flex flex-col overflow-hidden` |
| `PageHeader` | `src/core/headers/enterprise-system/components/PageHeader.tsx` | Sticky compact toolbar (top) |
| `UnifiedDashboard` | `src/components/property-management/dashboard/UnifiedDashboard.tsx` | Toggle-able stat cards |
| `AdvancedFiltersPanel` | `src/components/core/AdvancedFilters/` | Sidebar filters (desktop) / drawer (mobile) |
| `ListContainer` | `src/core/containers/ListContainer.tsx` | Flex container for list + details |
| `EntityListColumn` | `src/core/containers/EntityListColumn.tsx` | Left column (list) — `hasBorder`, `heightVariant` |
| `GenericListHeader` | `src/components/shared/GenericListHeader.tsx` | List title + count + optional search |
| `CompactToolbar` | `src/components/core/CompactToolbar/CompactToolbar.tsx` | CRUD actions + search + sorting |
| `TypeQuickFilters` | `src/components/shared/TypeQuickFilters.tsx` | Segmented type filter buttons |
| `ListCard` | `src/design-system/components/ListCard/ListCard.tsx` | Centralized card molecule (design system) |
| `UnitListCard` | `src/domain/cards/unit/UnitListCard.tsx` | Domain card — extends ListCard |
| `DetailsContainer` | `src/core/containers/DetailsContainer.tsx` | Right column — header (fixed) + tabs (scrollable) |
| `MobileDetailsSlideIn` | `src/core/layouts/` | Mobile overlay for details/filters |
| `NavigationBreadcrumb` | `src/components/navigation/components/NavigationBreadcrumb.tsx` | Breadcrumb στο header |
| `CardStats` | `src/design-system/primitives/Card/CardStats.tsx` | Stats row primitive (icons + labels + values) |

---

### 8.3 UnitListCard — Ανατομία

```
┌────────────────────────────────────────────────────────┐
│ [Title: unit.code]                   [Badge: Έτοιμο ✓] │  ← inlineBadges=true
├────────────────────────────────────────────────────────┤
│ 🏠 Διαμέρισμα 2Δ │ 🛏 2 │ 📐 85 m² │ 🏢 1ος │ 🧭 Β  │  ← CardStats horizontal
└────────────────────────────────────────────────────────┘
```

**ListCard props used by UnitListCard:**
```typescript
<ListCard
  compact={true}
  hideStats={false}
  inlineBadges={true}
  hideIcon={true}
  hoverVariant="standard"  // scale + shadow
  role="option"
/>
```

#### Fields & Icons

| Field | Icon Source | Color | Data Path |
|-------|------------|-------|-----------|
| Type | `NAVIGATION_ENTITIES.unit.icon` (Home) | `text-teal-600` | `unit.type` |
| Bedrooms | `Bed` (lucide-react) | `text-violet-600` | `unit.layout.bedrooms` |
| Area | `NAVIGATION_ENTITIES.area.icon` | `text-pink-600` (NAVIGATION_ENTITIES.area.color) | `unit.areas.gross ?? unit.area` |
| Floor | `NAVIGATION_ENTITIES.floor.icon` | `text-orange-600` (NAVIGATION_ENTITIES.floor.color) | `unit.floor` |
| Orientation | `Compass` (lucide-react) | `text-amber-600` | `unit.orientations[0..1]` |

#### Badge Variants (operationalStatus → variant)

| Status | Badge Variant | Χρώμα |
|--------|---------------|-------|
| `ready` | `success` | Green |
| `under-construction` | `warning` | Yellow |
| `inspection` | `info` | Blue |
| `maintenance` | `secondary` | Gray |
| `draft` | `default` | Neutral |

#### Selection & Hover States

| State | CSS |
|-------|-----|
| **Selected** | `getStatusBorder('info') + bg-info + shadow-sm` |
| **Not selected** | `border-border + bg-card + INTERACTIVE_PATTERNS.BORDER_SUBTLE` |
| **Hover (standard)** | `INTERACTIVE_PATTERNS.CARD_STANDARD` (scale + shadow) |
| **Hover (subtle)** | `transition-colors duration-150 hover:bg-accent/50` |
| **Favorite star** | Opacity-0 → opacity-100 on `group-hover`, filled star when active |
| **Action toolbar** | Opacity-0 → opacity-100 on `group-hover`, absolute positioned |

---

### 8.4 CompactToolbar — Actions Config

| Action | Icon | Callback | Visibility |
|--------|------|----------|------------|
| Search | `Search` (built-in) | `onSearchChange` | Always |
| New (+) | `Plus` | `onNewItem` | Always |
| Edit | `Edit` | `onEditItem` | Always |
| Delete | `Trash2` | `onDeleteItems` | Always |
| Filter | `Filter` + badge count | `onFiltersChange` | Always |
| Sort | `ArrowUpDown` | Sort dropdown | Always |
| Refresh | `RefreshCw` | `onRefresh` | Always |
| Export | `Download` | `onExport` | Always |
| Import | `Upload` | `onImport` | Always |

**Button Style:** `ghost` variant, `Tooltip` wrapping each icon button.

---

### 8.5 PageHeader — Configuration

```typescript
<PageHeader
  variant="sticky-rounded"
  layout="compact"
  spacing="compact"
  title={{
    icon: NAVIGATION_ENTITIES.unit.icon,
    title: t('header.title'),
    subtitle: t('header.subtitle')
  }}
  breadcrumb={<NavigationBreadcrumb />}
  search={{
    value: searchTerm,
    onChange: setSearchTerm,
    placeholder: t('header.searchPlaceholder')
  }}
  actions={{
    showDashboard,
    onDashboardToggle: setShowDashboard,
    viewMode,
    onViewModeChange: setViewMode,
    viewModes: ['list', 'grid']
  }}
/>
```

**CSS Pattern:**
```
rounded-lg border bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-sm
mx-1 mt-1 sm:mx-4 sm:mt-4
px-3 py-2 sm:px-4 sm:py-3
```

---

### 8.6 Typography & Spacing Tokens

| Element | Token / CSS |
|---------|-------------|
| Page title (header) | `text-xl sm:text-2xl font-bold` |
| Page subtitle | `text-sm text-muted-foreground` |
| Card title | `typography.card.titleCompact` (via `useTypography`) |
| Card subtitle | `typography.card.subtitleCompact` (via `useTypography`) |
| Stat label | `typography.card.statLabel` → `text-xs` |
| Stat value (compact) | `typography.card.statLabel` → `text-xs` |
| Dashboard value | `text-lg sm:text-xl lg:text-2xl` |
| Quick filter button | `h-7 px-2 text-xs font-medium` (compact: `px-1.5`) |

**Spacing Tokens (ListContainer):**
```
layout.listPaddingResponsive  → px-1 py-2 sm:px-2 sm:py-2
layout.listGapResponsive      → gap-1 sm:gap-2
```

**Spacing Tokens (EntityListColumn):**
```
ENTITY_LIST_TOKENS.width.combined     → responsive widths
ENTITY_LIST_TOKENS.layout.combined    → flex layout
ENTITY_LIST_TOKENS.visual.background  → bg token
ENTITY_LIST_TOKENS.visual.shadow      → shadow token
ENTITY_LIST_TOKENS.visual.maxHeight   → max-h-full
ENTITY_LIST_TOKENS.visual.overflow    → overflow handling
```

---

### 8.7 AdvancedFilters — Configuration (Units)

Τα φίλτρα δεν εμφανίζονται μόνιμα στο desktop — εμφανίζονται ως drawer στο mobile μέσω `showFilters` toggle.

**Available filter categories:**
- Τύπος μονάδας (studio, apartment, maisonette, shop, office)
- Κατάσταση (operational status)
- Κτίριο (building reference)
- Όροφος (floor)
- Εμβαδόν (area range)

---

### 8.8 TypeQuickFilters — Options (Units)

```typescript
const UNIT_TYPE_OPTIONS: TypeFilterOption[] = [
  { value: 'all',        label: 'filters.unitTypes.all',        icon: LayoutGrid },
  { value: 'studio',     label: 'filters.unitTypes.studio',     icon: BedSingle },
  { value: 'apartment',  label: 'filters.unitTypes.apartment',  icon: Building2 },
  { value: 'maisonette', label: 'filters.unitTypes.maisonette', icon: NAVIGATION_ENTITIES.building.icon },
  { value: 'shop',       label: 'filters.unitTypes.shop',       icon: Store },
  { value: 'office',     label: 'filters.unitTypes.office',     icon: Briefcase }
];
```

**Behavior:**
- Single selection toggle: click same → deselect (show all), click different → select that type
- Click "All" → clear all filters
- **Active style:** `bg-primary text-primary-foreground shadow-sm`
- **Inactive style:** `bg-transparent hover:bg-muted/50`

---

### 8.9 DetailsContainer — Layout Pattern

```
┌─────────────────────────────────────────┐
│ [Header - shrink-0, FIXED]              │  ← UnitDetailsHeader (name + actions)
├─────────────────────────────────────────┤
│                                         │
│ [Scrollable Content - flex-1]           │  ← UniversalTabsRenderer
│  Tabs: Info | Floor | Docs | 📷 | 🎥    │
│                                         │
│  Tab content renders here...            │
│                                         │
└─────────────────────────────────────────┘
```

**CSS:**
```
Outer:  flex-1 flex flex-col min-h-0 overflow-hidden bg-card border rounded-lg shadow-sm
Header: shrink-0
Content: flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto overflow-x-hidden
```

**Empty State (no selection):**
- Icon: `Users`
- Title: `emptyState.selectItem.title`
- Description: `emptyState.selectItem.description`

---

### 8.10 Responsive Breakpoints

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| `< sm` (< 640px) | Mobile | Single column, slide-in details, filter drawer, compact header |
| `sm` (≥ 640px) | Small tablet | Wider padding (`sm:mx-4 sm:mt-4`), larger title (`sm:text-2xl`) |
| `md` (≥ 768px) | Tablet | Desktop filters visible (`hidden md:block`), toolbar toggle hidden (`md:hidden`) |
| `lg` (≥ 1024px) | Desktop | Full two-column layout (list + details), larger dashboard values (`lg:text-2xl`) |

**Mobile-specific patterns:**
- Filter panel: Hidden by default, shown via `showFilters` toggle button (`md:hidden`)
- Details: `MobileDetailsSlideIn` overlay instead of side panel
- Search: Collapsed, expanded on click
- Inline text: `hidden sm:inline` for secondary labels

---

### 8.11 State Management (useUnitsViewerState)

```
src/app/units/page.tsx
  └─ useUnitsViewerState()  ← Single hook for ALL page state
      ├─ viewMode: 'list' | 'grid'
      ├─ showDashboard: boolean
      ├─ showFilters: boolean
      ├─ searchTerm: string
      ├─ selectedUnit: Property | null
      ├─ selectedTypes: string[]
      ├─ sortConfig: { field, direction }
      ├─ units: Property[]  (from Firestore)
      ├─ filteredUnits: Property[]  (after search + type filter)
      └─ CRUD callbacks (onNewUnit, onEditUnit, onDeleteUnit)
```

**Dashboard Cards (4 stat cards):**

| Card | Label | Value Source |
|------|-------|--------------|
| Total Units | Σύνολο Μονάδων | `units.length` |
| Ready Units | Έτοιμες Μονάδες | `units.filter(u => u.operationalStatus === 'ready').length` |
| Total Area | Συνολικό Εμβαδόν | `sum(units.map(u => u.areas?.gross ?? u.area))` |
| Unique Buildings | Μοναδικά Κτίρια | `new Set(units.map(u => u.buildingId)).size` |

**Click-to-filter:** Dashboard cards support filtering by operational status on click.

---

### 8.12 Design System Hooks (Χρησιμοποιούνται στη σελίδα)

| Hook | Path | Χρήση |
|------|------|-------|
| `useIconSizes()` | `src/hooks/useIconSizes.ts` | Τυποποιημένα μεγέθη icons |
| `useSemanticColors()` | `src/ui-adapters/react/useSemanticColors.ts` | Semantic χρώματα (bg, text, border) |
| `useBorderTokens()` | `src/hooks/useBorderTokens.ts` | Border/card styles |
| `useLayoutClasses()` | `src/hooks/useLayoutClasses.ts` | Responsive spacing tokens |
| `useTypography()` | `src/hooks/useTypography.ts` | Font sizes, weights |
| `useSpacingTokens()` | `src/hooks/useSpacingTokens.ts` | Margin, padding, gap |
| `usePositioningTokens()` | `src/hooks/usePositioningTokens.ts` | Absolute positioning |
| `useTranslation()` | `src/i18n/hooks/useTranslation.ts` | i18n μεταφράσεις (namespace: 'units') |
| `useNavigation()` | `src/components/navigation/core/NavigationContext.tsx` | Breadcrumb sync |

---

### 8.13 Inline New Unit Creation (σημαντικό pattern)

Η δημιουργία νέας μονάδας γίνεται **inline** (μέσα στη λίστα), χωρίς modal:

```
1. Κλικ στο [+] → εμφανίζεται φόρμα inline στην κορυφή της λίστας
2. Ο χρήστης συμπληρώνει τα βασικά πεδία
3. Save → νέα μονάδα στο Firestore
4. Cancel → η φόρμα κρύβεται
```

Αυτό είναι ένα pattern που μπορεί να αναπαραχθεί και στις σελίδες Πωλήσεων (π.χ. inline "Mark as Available").

---

### 8.14 NAVIGATION_ENTITIES — Χρησιμοποιούμενα Icons & Colors

Κεντρικοποιημένο SSoT: `src/components/navigation/config/navigation-entities.ts`

| Entity | Icon | Color |
|--------|------|-------|
| `unit` | `Home` | `text-teal-600` |
| `area` | `Maximize2` (ή αντίστοιχο) | `text-pink-600` |
| `floor` | `Layers` (ή αντίστοιχο) | `text-orange-600` |
| `building` | `Building2` | varies |

**Standalone Icons (lucide-react):**
| Icon | Entity | Color |
|------|--------|-------|
| `Bed` | Bedrooms | `text-violet-600` |
| `Compass` | Orientation | `text-amber-600` |

---

### 8.15 Checklist — Σελίδες Πωλήσεων πρέπει να αναπαράγουν

- [ ] `PageContainer` ως outer wrapper (`<section>`)
- [ ] `PageHeader` με `variant="sticky-rounded"`, `layout="compact"`, `spacing="compact"`
- [ ] `NavigationBreadcrumb` στο header
- [ ] `UnifiedDashboard` toggle-able με domain-specific stats
- [ ] `ListContainer` με `EntityListColumn` + `DetailsContainer` (list mode)
- [ ] `GenericListHeader` με icon, title, count
- [ ] `CompactToolbar` με search, CRUD, sort, filter, export
- [ ] `TypeQuickFilters` με domain-specific options (π.χ. status: available, reserved, sold)
- [ ] `ListCard` (design system molecule) ως base, με domain-specific card wrapper
- [ ] `DetailsContainer` με header (fixed) + tabs (scrollable)
- [ ] Responsive breakpoints: mobile drawer, tablet sidebar, desktop two-column
- [ ] Selection state: `getStatusBorder('info') + bg-info + shadow-sm`
- [ ] Hover: `INTERACTIVE_PATTERNS.CARD_STANDARD`
- [ ] Empty state στο DetailsContainer
- [ ] i18n: namespace-based translations
- [ ] Semantic HTML: `<section>`, `<article>`, `<header>` (not div soup)
- [ ] Design tokens: `useSemanticColors`, `useBorderTokens`, `useTypography` etc.

---

### 8.16 ΠΕΡΙΟΧΗ 1 (Πράσινο) — PageHeader + Dashboard Stats

> **Pixel-level τεκμηρίωση** της πλήρους περιοχής header + dashboard, ώστε οι σελίδες Πωλήσεων να αναπαραχθούν ακριβώς.

#### PageHeader Container

- CSS: `rounded-lg border bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-sm`
- Margins: `mx-1 mt-1 sm:mx-2 sm:mt-2` (4px mobile → 8px desktop)
- Padding: `px-3 py-2 sm:px-4 sm:py-3`
- Layout: `flex flex-row items-center justify-between gap-2`
- Border-radius: `rounded-lg` (8px)

#### HeaderTitle (Αριστερά)

- Icon container: `flex items-center justify-center rounded-lg shadow-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white h-10 w-10`
- Icon μέσα: `h-5 w-5` (20px, md size)
- Title gap: `gap-3` (12px μεταξύ icon και text)
- Title CSS: `text-xl sm:text-2xl font-bold text-foreground`
- Subtitle CSS: `text-sm text-muted-foreground mt-1`

#### NavigationBreadcrumb (Μέση)

- CSS: `flex-1 min-w-0 hidden sm:block px-4`
- Mobile: κρυφό (`hidden sm:block`)

#### Dashboard Stats Grid

- Container background: `bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20`
- Padding: `px-1 py-1 sm:px-2 sm:py-1`
- Grid: `grid gap-1 sm:gap-2` — 4 columns: `sm:grid-cols-2 lg:grid-cols-4`
- Mobile override: `gridTemplateColumns: repeat(2, minmax(0, 1fr))`

#### StatsCard Ανατομία

- Card: `border border-border rounded-lg shadow-sm overflow-hidden min-w-0`
- CardContent: `p-2 pt-0` (8px padding, 0 top)
- Inner: `flex items-center justify-between min-w-0 max-w-full`
- Left height: `min-h-[3.75rem]` (60px)
- Title: `text-xs font-medium [colorClass] truncate leading-tight`
- Value: `text-lg sm:text-xl lg:text-2xl font-bold [valueColorClass] truncate`
- Description: `text-xs [muted-color] truncate leading-tight mt-0.5`
- Icon: `h-6 w-6 [iconColorClass] flex-shrink-0`
- Hover: `INTERACTIVE_PATTERNS.CARD_ENHANCED` — `hover:shadow-xl transition-all duration-200 hover:scale-[1.02]`

#### Color Mapping (StatsCard)

| Color prop | Title | Value | Icon |
|------------|-------|-------|------|
| `red` | `colors.text.danger` | `colors.text.danger` | `colors.text.danger` |
| `blue` | `colors.text.info` | `colors.text.info` | `colors.text.info` |
| `green` | `colors.text.success` | `colors.text.success` | `colors.text.success` |
| `purple` | `colors.text.purple` | `colors.text.purple` | `colors.text.purple` |
| `orange` | `colors.text.warning` | `colors.text.warning` | `colors.text.warning` |

#### Detail Cards Row (κάτω από stats)

- Layout: `mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-1 sm:gap-2`
- StatusCard: Operational status με color dots (`h-3 w-3 rounded-full [status-color]`)
- DetailsCard: Type/Floor breakdowns με CommonBadge
- CoverageCard: `lg:col-span-2`, 3 sub-cards (Photos/Floorplans/Documents) με percentages

#### Key Files

- `src/components/property-management/dashboard/UnifiedDashboard.tsx`
- `src/components/property-management/dashboard/StatsCard.tsx`
- `src/components/property-management/dashboard/StatusCard.tsx`
- `src/components/property-management/dashboard/DetailsCard.tsx`
- `src/components/property-management/dashboard/CoverageCard.tsx`

---

### 8.17 ΠΕΡΙΟΧΗ 2 (Κόκκινο) — Header Action Icons

> **Pixel-level τεκμηρίωση** των action icons στο δεξί μέρος του header.

#### Container (HeaderActions)

- CSS: `flex flex-wrap items-center gap-2 w-full sm:w-auto justify-center sm:justify-end`
- Gap: `gap-2` (8px)

#### Dashboard Toggle (Eye icon)

- Active icon: `Eye` (lucide-react) — dashboard ορατό
- Inactive icon: `EyeOff` (lucide-react) — dashboard κρυφό
- Active variant: `variant="default"` (primary button)
- Inactive variant: `variant="outline"`
- Size: `icon` (h-10 w-10, 40×40px)

#### View Mode Toggle (List/Grid)

- **Desktop** (`hidden md:block`): `HeaderViewToggle`
  - Container: `flex border rounded-md` (connected buttons)
  - Button size: `sm` (h-9, 36px)
  - Button padding: `px-2` (8px)
  - First: rounded-right removed, Last: rounded-left removed
  - Active: `variant="default"`, Inactive: `variant="outline"`
- **Mobile** (`md:hidden`): `MobileHeaderViewToggle`
  - Single cycle button: `h-8 px-2`
- Icons: `List` (list mode), `LayoutGrid` (grid mode)
- Icon size: `sm` (h-4 w-4, 16px)

#### Mobile Filter Button

- Μόνο mobile (`md:hidden`)
- Icon: `Filter` (lucide-react)
- Size: `sm`, padding: `p-2` (8px)
- Active: `bg-primary text-primary-foreground`

#### Key Files

- `src/core/headers/enterprise-system/components/HeaderActions.tsx`
- `src/core/headers/enterprise-system/components/HeaderViewToggle.tsx`
- `src/core/headers/enterprise-system/components/MobileHeaderViewToggle.tsx`

---

### 8.18 ΠΕΡΙΟΧΗ 3 (Μπλε) — Advanced Filters Panel

> **Pixel-level τεκμηρίωση** του collapsible filters panel "Φίλτρα Μονάδων".

#### Outer Container

- CSS: `layout.filterPaddingResponsive` = `px-1 pt-2 sm:px-2 sm:pt-2`
- `shrink-0 w-full overflow-hidden`

#### Collapsible Root

- CSS: `rounded-lg bg-card`
- Library: `@radix-ui/react-collapsible`

#### Header Trigger "Φίλτρα Μονάδων"

- Button: `variant="ghost"`, `w-full justify-start`
- Padding: `layout.filterButtonPadding` = `p-2` (8px)
- Text: `text-sm font-semibold` (14px, weight 600)
- Icon: `Filter` (lucide-react), `iconSizes.sm` (16px), `mr-2` (8px gap)
- i18n key: `filters.unitsTitle`
- Behavior: Click toggle (open/close panel)

#### Filter Grid Layout

- CSS: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
- Gap: `layout.filterGridGap` = `gap-1 sm:gap-2` (4px mobile → 8px desktop)
- Alignment: `items-end w-full min-w-0 overflow-hidden`

#### Row 1 Fields

| Field ID | Type | Label i18n | Component |
|----------|------|------------|-----------|
| `searchTerm` | `search` | `filters.search` | Input + Search icon (`pl-9 h-9`) |
| `areaRange` | `range` (dropdown) | `filters.areaRange` | Radix Select + custom inputs |
| `status` | `select` | `filters.status` | Radix Select |

#### Row 2 Fields

| Field ID | Type | Label i18n | Component |
|----------|------|------------|-----------|
| `project` | `select` | `filters.project` | Radix Select |
| `building` | `select` | `filters.building` | Radix Select |
| `floor` | `select` | `filters.floor` | Radix Select |
| `type` | `select` | `filters.type` | Radix Select |

#### Area Range Presets

- `all` (Όλα τα μεγέθη), `small` (0-50m²), `medium` (50-100m²), `large` (100-200m²), `veryLarge` (200+m²), `custom`

#### FilterField CSS

- Container: `flex items-center gap-2` (8px)
- Label: `text-xs font-medium shrink-0` (12px, weight 500)
- Select height: `h-9` (36px)

#### "Εμφάνιση προχωρημένων" Section

- Trigger: `Button variant="outline" size="sm"`, `text-sm font-medium`
- Content: `!mt-2 !p-2 ${quick.card} ${colors.bg.primary} animate-in fade-in-0 zoom-in-95`
- Grid: `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1 sm:gap-2`
- Items: Checkbox + Label, `flex items-center gap-2`
- Options: Parking, Storage, Fireplace, View, Pool

#### Clear Filters

- Button: `variant="ghost" size="sm"`, `flex justify-end`
- Icon: `RotateCcw` (lucide-react)
- Visible: μόνο όταν `hasActiveFilters === true`

#### State Management (useGenericFilters hook)

- `handleFilterChange(key, value)` — μεμονωμένο φίλτρο
- `handleRangeChange(rangeKey, subKey, value)` — min/max
- `handleFeatureChange(featureId, checked)` — checkbox
- `clearAllFilters()` — reset

#### Key Files

- `src/components/core/AdvancedFilters/AdvancedFiltersPanel.tsx`
- `src/components/core/AdvancedFilters/FilterField.tsx`
- `src/components/core/AdvancedFilters/configs.ts`
- `src/components/core/AdvancedFilters/types.ts`
- `src/components/core/AdvancedFilters/useGenericFilters.ts`

---

### 8.19 SPACING TOKENS MASTER TABLE (8px dominant)

| Token | CSS | Pixels | Χρήση |
|-------|-----|--------|-------|
| `spacing.gap.sm` | `gap-2` | **8px** | Actions, filter fields, checkboxes |
| `spacing.gap.xs` | `gap-1` | 4px | Mobile gaps |
| `spacing.margin.right.sm` | `mr-2` | 8px | Icon-to-text spacing |
| `spacing.padding.sm` | `p-2` | 8px | Card padding, filter button |
| `layout.filterGridGap` | `gap-1 sm:gap-2` | 4→8px | Filter grid |
| `layout.dashboardGridGap` | `gap-1 sm:gap-2` | 4→8px | Dashboard grid |
| `layout.dashboardPadding` | `px-1 py-1 sm:px-2 sm:py-1` | 4→8px | Dashboard container |
| Header gap | `gap-2` | 8px | Between action buttons |
| Title-icon gap | `gap-3` | 12px | Icon to title text |
| Detail cards margin | `mt-2` | 8px | Between stat row and detail row |

---

### 8.20 ΠΕΡΙΟΧΗ — ΚΟΚΚΙΝΟ (Εξωτερικό) — DetailsContainer (Ολόκληρο το Details Panel)

> **Pixel-level τεκμηρίωση** του εξωτερικού container που περιβάλλει header + tabs + content στο δεξί μέρος της σελίδας.

#### Outer Container CSS

- CSS: `flex-1 flex flex-col min-h-0 overflow-hidden bg-card border rounded-lg shadow-sm`
- `flex-1`: Καταλαμβάνει τον υπόλοιπο χώρο δίπλα στο EntityListColumn
- `min-h-0`: **Κρίσιμο** — επιτρέπει σωστό flex overflow στα παιδιά
- `overflow-hidden`: Το scrolling γίνεται **μόνο** στο εσωτερικό content area
- `bg-card`: Semantic background token (light: white, dark: slate-900)
- `border`: 1px solid `var(--border)` (light: slate-200, dark: slate-800)
- `rounded-lg`: 8px border-radius (ολόκληρο το panel)
- `shadow-sm`: `0 1px 2px 0 rgb(0 0 0 / 0.05)` — ελαφρύ elevation

#### Εσωτερική Δομή (3 layers)

```
DetailsContainer (flex-1 flex flex-col min-h-0 overflow-hidden bg-card border rounded-lg shadow-sm)
├── [Layer 1] Header — shrink-0 (ΠΟΤΕ δεν κάνει scroll)
│   └── UnitDetailsHeader → EntityDetailsHeader
├── [Layer 2] Scrollable Content — flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto overflow-x-hidden
│   └── UniversalTabsRenderer wrapper (flex-1 flex flex-col min-h-0 min-w-0)
│       ├── TabsList — flex-shrink-0 (tab triggers ΠΟΤΕ δεν κάνουν scroll)
│       └── TabsContent — flex-1 (scrollable tab content)
```

#### Spacing μεταξύ EntityListColumn και DetailsContainer

Ελέγχεται από `ListContainer`:
- CSS: `flex-1 flex overflow-hidden`
- Padding: `px-1 py-2 sm:px-2 sm:py-2` (4px mobile → 8px desktop)
- Gap: `gap-1 sm:gap-2` (4px mobile → **8px desktop** μεταξύ list και details)

#### Empty State (δεν έχει επιλεγεί μονάδα)

- Icon: `Users` (lucide-react)
- Title i18n: `emptyState.selectItem.title`
- Description i18n: `emptyState.selectItem.description`
- Centered: `flex flex-col items-center justify-center h-full`

#### Key Files

- `src/core/containers/DetailsContainer.tsx`
- `src/core/containers/ListContainer.tsx`
- `src/core/containers/EntityListColumn.tsx`

---

### 8.21 ΠΕΡΙΟΧΗ Α (Πράσινο) — UnitDetailsHeader (Επικεφαλίδα Λεπτομερειών)

> **Pixel-level τεκμηρίωση** της επικεφαλίδας "TEST1" με τα action buttons (Επεξεργασία, Νέα Μονάδα, Διαγραφή).

#### Header Container (EntityDetailsHeader)

- CSS: `bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-t-lg`
- Padding: `spacing.padding.sm` = `p-2` (8px)
- Layout: `flex items-center justify-between`
- Variant: `detailed` (χρησιμοποιείται στα units)
- `shrink-0`: Η επικεφαλίδα **ΠΟΤΕ** δεν κάνει scroll

#### Left Side (Icon + Title)

- Container: `flex items-center gap-3 flex-1 min-w-0`
- Gap: `gap-3` (12px μεταξύ icon και title)

**Icon Container:**
- CSS: `flex items-center justify-center flex-shrink-0 rounded-lg shadow-sm`
- Background: `bg-gradient-to-br from-blue-500 to-purple-600`
- Size (detailed variant): `h-6 w-6` (24px × 24px — `iconSizes.lg`)
- Icon μέσα: `iconSizes.sm` (16px), `text-white`

**Title:**
- CSS: `text-xl font-semibold text-foreground`
- Font size: 20px, Font weight: 600
- `line-clamp-1`: Truncation σε 1 γραμμή
- Εμφανίζει: `unit.code` (π.χ. "TEST1")

**Status Badge (πράσινο ✓ δίπλα στο icon):**
- Ελέγχεται από `operationalStatus` → badge variant mapping
- `ready` → `success` variant (green background)
- Rendered μέσω `EntityDetailsHeader` badges prop

#### Right Side (Action Buttons)

- Container: `flex gap-2 flex-shrink-0 ml-3`
- Gap: `gap-2` (8px μεταξύ buttons)
- `ml-3` (12px) margin-left από τον τίτλο
- `flex-shrink-0`: Τα buttons ΠΟΤΕ δεν συρρικνώνονται

#### Action Buttons — Presets (entity-action-presets.ts SSoT)

**Κοινά CSS (κάθε button):**
- Base: `inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium`
- Size: `h-8` (32px height) — override από `sm` (h-9)
- Padding: `px-3` (12px horizontal) + `spacing.padding.x.sm`
- Border radius: `rounded-md` (6px)
- Text: `text-sm` (14px), `font-medium` (500)
- Icon: `iconSizes.sm` (16px), `mr-2` (8px gap)

| Button | Label | Icon | Gradient | Hover |
|--------|-------|------|----------|-------|
| **Επεξεργασία** | `navigation.actions.edit.label` | `Pencil` | `from-blue-500 to-blue-600 text-white` | `from-blue-600 to-blue-700` |
| **Νέα Μονάδα** | `navigation.actions.newUnit.label` | `Plus` | `from-green-500 to-green-600 text-white` | `from-green-600 to-green-700` |
| **Διαγραφή** | `navigation.actions.delete.label` | `Trash2` | `from-red-500 to-red-600 text-white` | `from-red-600 to-red-700` |

**Edit Mode Buttons (εναλλακτικό set):**

| Button | Label | Icon | Gradient | Hover |
|--------|-------|------|----------|-------|
| **Αποθήκευση** | Save | `Save` | `from-green-500 to-green-600 text-white` | `from-green-600 to-green-700` |
| **Ακύρωση** | Cancel | `X` | `from-gray-500 to-gray-600 text-white` | `from-gray-600 to-gray-700` |

#### Gradient System (GRADIENT_HOVER_EFFECTS)

Ορισμός: `src/components/ui/effects/hover-effects.ts`

```
BLUE:  bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700
GREEN: bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700
RED:   bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700
GRAY:  bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700
```

#### Factory Pattern (createEntityAction)

```typescript
// SSoT: src/core/entity-headers/entity-action-presets.ts
createEntityAction('edit', label, callback)   // → Pencil + BLUE gradient
createEntityAction('new', label, callback)    // → Plus + GREEN gradient
createEntityAction('delete', label, callback) // → Trash2 + RED gradient
createEntityAction('save', label, callback)   // → Save + GREEN gradient
createEntityAction('cancel', label, callback) // → X + GRAY gradient
```

#### Key Files

- `src/features/units-sidebar/components/UnitDetailsHeader.tsx`
- `src/core/entity-headers/UnifiedEntityHeaderSystem.tsx` (EntityDetailsHeader)
- `src/core/entity-headers/entity-action-presets.ts` (createEntityAction SSoT)
- `src/components/ui/effects/hover-effects.ts` (GRADIENT_HOVER_EFFECTS)
- `src/components/ui/button.tsx` (base Button component)

---

### 8.22 ΠΕΡΙΟΧΗ Β (Μπλε) — Tab Triggers (Κεντρικοποιημένο Tab System)

> **Pixel-level τεκμηρίωση** των tab triggers (Πληροφορίες, Κάτοψη, Έγγραφα, Φωτογραφίες, Βίντεο, Ιστορικό).

#### Κεντρικοποιημένη Αρχιτεκτονική (3 layers)

```
1. unified-tabs-factory.ts     → Δημιουργεί tab config (icon, label, order, component)
2. UniversalTabsRenderer.tsx   → Enterprise rendering engine (lazy loading, i18n, themes)
3. TabsComponents.tsx          → UI components (TabsOnlyTriggers — styling & interaction)
```

#### TabsList Container

- CSS: `flex flex-wrap gap-1 w-full h-auto min-h-fit flex-shrink-0`
- `flex-wrap`: Tabs αναδιπλώνονται σε πολλές σειρές αν δεν χωράνε
- `gap-1` (4px): Απόσταση μεταξύ tab triggers
- `flex-shrink-0`: Τα tabs **ΠΟΤΕ** δεν κάνουν scroll — πάντα ορατά

#### Tab Trigger (κάθε ένα)

- Base CSS: `flex items-center gap-1 transition-colors text-xs font-medium`
- Padding: `px-3 py-1.5` (~12px × 6px)
- Border: `1px solid var(--border)`, `rounded-md` (6px)
- Text: `text-xs` (12px), `font-medium` (500)
- Color (inactive): `text-muted-foreground` (slate-400/500)
- Transition: `transition-colors` (150ms)

**Active State:**
- Background: `colors.bg.info` (blue-100 light / blue-900/20 dark)
- Text: `text-foreground` (slate-900 / white)
- Border: `border-primary` (blue-500)

**Hover State:**
- `INTERACTIVE_PATTERNS.PRIMARY_HOVER` — subtle background shift

**Icon μέσα σε tab:**
- Size: `iconSizes.sm` (16px, `h-4 w-4`)
- `flex-shrink-0`

**Label:**
- Desktop: Ορατό (`inline`)
- Mobile: Κρυφό (`hidden sm:inline`) — μόνο icon στο mobile

#### Units Tab Configuration (6 tabs)

| Tab ID | Icon (lucide) | Label i18n | Component | Order |
|--------|--------------|------------|-----------|-------|
| `info` | `Home` | `tabs.labels.basicInfo` → "Πληροφορίες" | `PropertyDetailsContent` | 1 |
| `floor-plan` | `Map` | `tabs.labels.floorplans` → "Κάτοψη" | `FloorPlanTab` | 2 |
| `documents` | `FileText` | `tabs.labels.unitDocuments` → "Έγγραφα" | `DocumentsTab` | 3 |
| `photos` | `Camera` | `tabs.labels.photos` → "Φωτογραφίες" | `PhotosTab` | 4 |
| `videos` | `Video` | `tabs.labels.videos` → "Βίντεο" | `VideosTab` | 5 |
| `history` | `Clock` | `tabs.labels.history` → "Ιστορικό" | `ActivityTab` | 6 |

#### Icon Resolution (Centralized)

- SSoT: `src/components/generic/utils/IconMapping.ts`
- Maps string icon names → Lucide React components
- 100+ mappings, fallback: `Info` icon

#### Theme System (ThemeComponents.tsx)

```
tabs.trigger:       flex items-center gap-1 transition-colors text-xs font-medium ${colors.text.muted}
tabs.activeDefault: data-[state=active]:${colors.bg.info} data-[state=active]:${colors.text.foreground}
tabs.hoverDefault:  ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}
```

Themes: `default` (info blue), `success` (green), `warning` (orange), `destructive` (red)

#### Lazy Tab Content Pattern

- Component: `LazyTabContent` (μέσα στο UniversalTabsRenderer)
- Renders tab content **ΜΟΝΟ** όταν ενεργοποιείται (prevents premature API calls)
- `hasBeenActive` flag: μόλις ενεργοποιηθεί, διατηρεί το state (δεν ξαναφορτώνει)
- `forceMount` + lazy rendering = memory-efficient

#### Tab Content Spacing

- `TABS_STYLES.content`: `mt-2` (8px πάνω από content)
- `TABS_STYLES.contentWrapper`: `flex flex-wrap gap-2` (8px μεταξύ items)

#### Key Files

- `src/config/unified-tabs-factory.ts` (centralized tab config factory)
- `src/config/units-tabs-config.ts` (backward-compatible wrapper)
- `src/components/generic/UniversalTabsRenderer.tsx` (rendering engine)
- `src/components/ui/navigation/TabsComponents.tsx` (TabsOnlyTriggers UI)
- `src/components/ui/theme/ThemeComponents.tsx` (theme system)
- `src/components/generic/utils/IconMapping.ts` (icon resolution)
- `src/components/generic/mappings/unitsMappings.ts` (component mapping)

---

### 8.23 ΠΕΡΙΟΧΗ Γ (Ροζ) — Tab Content Area (Scrollable Content)

> **Pixel-level τεκμηρίωση** της περιοχής περιεχομένου κάτω από τα tab triggers.

#### Scrollable Container

- CSS: `flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto overflow-x-hidden`
- `flex-1`: Καταλαμβάνει ΟΛΟ τον υπόλοιπο χώρο μετά τα tabs
- `min-h-0 min-w-0`: **Κρίσιμο** — επιτρέπει σωστό overflow σε flex context
- `overflow-y-auto`: Vertical scroll μόνο όταν χρειάζεται
- `overflow-x-hidden`: Κανένα horizontal scroll

#### Tab Content Wrapper

- CSS: `mt-2` (8px spacing πάνω από content, κάτω από tabs)
- Inner: `flex flex-wrap gap-2` (8px gap μεταξύ sections)

#### Info Tab (Πληροφορίες) — PropertyDetailsContent Layout

Αυτό εμφανίζεται στο screenshot. Η δομή:

```
PropertyDetailsContent
├── Ταυτότητα Μονάδας (Identity card)
│   ├── Όνομα Μονάδας: input
│   ├── Τύπος Μονάδας: select
│   └── Περιγραφή: textarea
├── Θέση (Location card)
│   ├── Διεύθυνση: text
│   ├── Προσανατολισμός: select
│   └── Ενεργειακή κλάση: select
├── Διάταξη (Layout card)
│   ├── Υπνοδωμάτια, Μπάνια, Σαλόνια: inputs
│   ├── Μπαλκόνια, Κουζίνα, WC: inputs
│   └── Αριθμός δεδομένα
├── Εμβαδά (Areas card)
│   ├── Μικτό/Καθαρό εμβαδόν: inputs
│   └── Βοηθητικοί χώροι
├── Κατάσταση (Status card)
│   ├── Κατάσταση: select
│   ├── Ημερομηνία: input
│   └── Σχόλια
├── Συστήματα (Systems card)
│   ├── Θέρμανση: select
│   └── Split units: select
├── Φινιρίσματα (Finishes card)
│   └── Δάπεδα, Πόρτες, Παράθυρα
└── Χαρακτηριστικά (Features card)
    └── Εσωτερικά/Εξωτερικά checkboxes
```

#### Content Cards CSS Pattern

Κάθε section card μέσα στο tab content:
- Card: `border border-border rounded-lg shadow-sm bg-card`
- CardHeader: `p-3` (12px) ή `p-2` (8px) σε compact mode
- CardTitle: `text-sm font-semibold` (14px, 600)
- CardContent: `p-3 pt-0` (12px padding, 0 top)
- Section icon: `iconSizes.sm` (16px), color based on section type

#### Form Fields CSS (Edit Mode)

- Input: `h-9` (36px height), `border border-input rounded-md`
- Label: `text-xs font-medium` (12px, 500)
- Gap μεταξύ fields: `gap-2` (8px)
- Grid: `grid grid-cols-1 md:grid-cols-2 gap-2` ή `lg:grid-cols-3`

#### Side-by-Side Cards (Identity + Location)

- Layout: `grid grid-cols-1 lg:grid-cols-2 gap-2`
- Κάθε card: `border rounded-lg shadow-sm`
- Ίδιο ύψος: flex alignment

#### Component Mapping (units)

```typescript
UNITS_COMPONENT_MAPPING = {
  'PropertyDetailsContent': PropertyDetailsContent,  // info tab
  'FloorPlanTab': FloorPlanTab,                     // floor-plan tab
  'DocumentsTab': DocumentsTab,                     // documents tab
  'PhotosTab': PhotosTab,                           // photos tab
  'VideosTab': VideosTab,                           // videos tab
  'ActivityTab': ActivityTab,                       // history tab
}
```

#### Wiring στο UnitsSidebar

```typescript
<DetailsContainer
  selectedItem={selectedUnit}
  header={<UnitDetailsHeader ... />}
  tabsRenderer={
    <UniversalTabsRenderer
      tabs={unitsTabs.map(convertToUniversalConfig)}
      data={selectedUnit}
      componentMapping={UNITS_COMPONENT_MAPPING}
      defaultTab="info"
      theme="default"
      translationNamespace="building"
      additionalData={{ safeFloors, currentFloor, units, isEditMode, ... }}
      globalProps={{ unitId: selectedUnit?.id }}
    />
  }
/>
```

#### Key Files

- `src/features/units-sidebar/UnitsSidebar.tsx` (wiring)
- `src/components/generic/mappings/unitsMappings.ts` (component mapping)
- `src/components/property-management/PropertyDetailsContent.tsx` (info tab content)
- `src/features/units-sidebar/components/UnitDetailsHeader.tsx` (header)

---

### 8.24 DESIGN TOKEN HOOKS — ΠΛΗΡΗΣ ΑΝΑΦΟΡΑ

> Centralized hooks που χρησιμοποιούνται σε **ΟΛΕΣ** τις περιοχές (Α, Β, Γ) και πρέπει να επαναχρησιμοποιηθούν στις σελίδες Πωλήσεων.

#### useIconSizes()

| Size | Pixels | Tailwind | Χρήση |
|------|--------|----------|-------|
| `xs` | 12px | `h-3 w-3` | Tiny indicators |
| `sm` | 16px | `h-4 w-4` | Tab icons, action button icons, filter icons |
| `md` | 20px | `h-5 w-5` | Header title icon |
| `lg` | 24px | `h-6 w-6` | Header icon container (detailed variant) |
| `xl` | 32px | `h-8 w-8` | Large indicators |

#### useSpacingTokens()

| Token | Pixels | Tailwind | Χρήση |
|-------|--------|----------|-------|
| `xs` | 4px | `p-1` | Mobile gaps |
| `sm` | 8px | `p-2` | Header padding, card padding, button gaps |
| `md` | 16px | `p-4` | Section padding |
| `lg` | 24px | `p-6` | Large sections |

#### useBorderTokens()

| Token | CSS | Χρήση |
|-------|-----|-------|
| `quick.card` | `border border-border rounded-lg` | Content cards |
| `quick.input` | `border border-input rounded-md` | Form inputs |
| `quick.button` | `border border-border` | Button borders |
| `quick.rounded` | `rounded-lg` | Generic rounding |

#### useSemanticColors()

| Category | Token | Light | Dark | Χρήση |
|----------|-------|-------|------|-------|
| `bg.card` | Card BG | white | slate-900 | DetailsContainer, cards |
| `bg.info` | Info BG | blue-100 | blue-900/20 | Active tab, selection |
| `text.foreground` | Primary text | slate-900 | white | Titles, active tabs |
| `text.muted` | Secondary text | slate-400 | slate-500 | Inactive tabs, labels |

#### useLayoutClasses()

| Class | CSS | Χρήση |
|-------|-----|-------|
| `flexCenterGap2` | `flex items-center gap-2` | Button groups, icon+text |
| `flexCenterBetween` | `flex items-center justify-between` | Header layout |
| `flexColGap2` | `flex flex-col gap-2` | Vertical stacking |

---

**References:**
- `REAL_ESTATE_HIERARCHY_DOCUMENTATION.md` — Domain architecture
- `src/app/units/page.tsx` — **PRIMARY Reference pattern** (Units page)
- `src/app/spaces/storage/page.tsx` — Reference pattern (Storage Spaces page)
- `src/app/spaces/parking/page.tsx` — Reference pattern (Parking Spaces page)
- `src/app/sales/available-apartments/page.tsx` — Current mock implementation

---

## Changelog

- **2026-04-16 (ADR-287 Batch 18)**: Display-eligibility gate εφαρμόζεται στη σελίδα `/sales/available-properties`. Το `useSalesPropertiesViewerState` πλέον pre-filter-άρει τα units μέσω του `isDisplayableInSalesDashboard()` SSoT helper (`src/constants/commercial-statuses.ts`): listed commercialStatus + askingPrice > 0 + grossArea > 0. Αποκλείονται incomplete listings + finalized (sold/rented) units — αποκλίνει από το αρχικό ADR-197 comment "Sold/rented units remain accessible for post-sale follow-up" γιατί η σελίδα είναι availability vetrina, όχι analytics. Sold/rented παραμένουν προσβάσιμα μέσω reports/analytics flows (`/reports/sales`, CRM closing views). Fix για UX contract mismatch: το `SalesDashboardRequirementsAlert` (Batch 16) υπόσχεται εξαίρεση, τώρα πράγματι εφαρμόζεται.
- **2026-04-17 (ADR-287 Batch 19)**: Google-style floor ↔ property-type plausibility sanity check στα entry surfaces (`PropertyFieldsEditForm`, `AddPropertyDialog`). Νέο leaf SSoT module `src/constants/floor-type-plausibility.ts` με `FLOOR_TYPE_MATRIX` (10 in-building types × 3 bands: basement/ground/upper) + ειδική μεταχείριση Family B standalone (villa, detached_house). Νέο pure-render component `FloorTypePlausibilityWarning` (amber, **non-blocking** — Google pattern: sanity check, όχι error). Data entry surfaces δείχνουν warning όταν ο συνδυασμός τύπου + ορόφου είναι ασυνήθιστος (`unusual`) ή ασύμβατος με ορισμό (`implausible`, π.χ. ρετιρέ σε υπόγειο, βίλα σε 3ο όροφο). V1 scope: 3 bands — μελλοντικό batch (20) μπορεί να αναβαθμίσει σε 4 bands (basement/ground/middle/top) μόλις υπάρξει cross-entity lookup του `buildingTopFloor`. i18n keys `alerts.floorTypePlausibility.*` σε `properties.json` (el pure + en).
- **2026-04-17 (ADR-287 Batch 21)**: Google-style area (gross / net / balcony / terrace / garden) plausibility sanity check στο `PropertyFieldsEditForm`. Νέο leaf SSoT module `src/constants/area-plausibility.ts` — `AREA_RULES: Record<PropertyTypeCanonical, AreaRule>` με per-type `grossHardMin` / `grossTypicalMax` + `outdoorExpected` / `outdoorRequired` / `gardenTypical` / `ratioApplies` flags. Ratio thresholds `AREA_RATIO_LOW` (0.60) / `AREA_RATIO_HIGH` (0.95) tuned στην ελληνική αγορά (typical 0.82–0.92). `assessAreaPlausibility()` επιστρέφει 4 verdicts (`ok`/`insufficientData`/`unusual`/`implausible`) + 10 reason codes με priority-ordered single-reason surfacing: `netExceedsGross` > `netZeroWithGross` > `grossBelowMin` > `luxuryNoOutdoor` > `grossAboveMax` > `netRatioTooLow` > `netRatioTooHigh` > `netEqualsGross` > `noOutdoorResidential` > `gardenOnNonGround`. Physical impossibility rule (Γιώργος direction): `net > gross` ή `gross > 0 && net === 0` → `implausible`. Luxury outdoor rule: penthouse/villa/detached_house χωρίς balcony+terrace+garden = 0 → `implausible` (luxury definition contradiction). Απλά residential (apartment/maisonette) χωρίς outdoor → `unusual`. Garden σε apartment/penthouse/loft → `unusual` (ground-floor-only expectation). Νέο pure-render component `AreaPlausibilityWarning` (amber, **non-blocking**). Wired στην Areas card multi-level aware (aggregated / per-level / single-level). i18n keys `alerts.areaPlausibility.*` σε `properties.json` (el pure με `τ.μ.` per CLAUDE.md N.11 + en με `m²`). Coexist με υπάρχον inline `netExceedsGross` per-input micro-feedback — complementary UX layers. Field naming aligned στο Firestore schema (`terrace` canonical, όχι `veranda`).
- **2026-04-20 (sold page parity)**: Η σελίδα `/sales/sold` αναδιαρθρώθηκε ώστε να χρησιμοποιεί τα ίδια κεντρικοποιημένα components με το `/sales/available-properties` (PageHeader, UnifiedDashboard, AdvancedFiltersPanel, SalesSidebar, SalesPropertyListCard, DetailsContainer + tabs). Το `useSalesPropertiesViewerState` δέχεται τώρα `viewScope: 'available' | 'sold'` (default `'available'`) — στο `'sold'` scope φιλτράρει μόνο `commercialStatus === 'sold'` με `finalPrice > 0` και `grossArea > 0`, ενώ το dashboard aggregations τρέχει πάνω στο `commercial.finalPrice` (τιμή συμβολαίου) αντί `askingPrice`. Το `SalesSidebar` δέχεται optional `labels?` (listTitle / listLabel / noResults / unitDetails) + `hideCommercialStatusFilter?` props — το δεύτερο κρύβει τη riga commercial-status του `SalesQuickFilters` όταν είναι degenerate (όλα τα items sold). Το `SalesAvailableHeader` ήδη υποστηρίζει title/subtitle/searchPlaceholder overrides. Το `sold` status αφαιρέθηκε από το filter της `/sales/available-properties` — οι πωληθείσες μονάδες εμφανίζονται πλέον αποκλειστικά στη δική τους σελίδα, όπου ο agent μπορεί να ολοκληρώσει το post-sale workflow (piano αποπληρωμής, legal docs). Νέες i18n keys `sales.sold.listTitle / listLabel / gridLabel / searchPlaceholder / noResults / unitDetails / loading` + `sales.sold.stats.{avgSalePrice, avgSalePriceDesc, avgPricePerSqm, avgPricePerSqmDesc}` (el καθαρά ελληνικά, en parity). Pattern: parametrization over duplication.
- **2026-04-20 (revert policy fix)**: Νέα `revertPropertySaleWithPolicy()` gateway σε `src/services/property/property-mutation-gateway.ts` που επιτρέπει το legitimate sale-revert flow (reserved/sold → for-sale) χωρίς να ανοίγει παραθυράκι στο `SOLD_LOCKED_FIELDS` contract του `updatePropertyWithPolicy`. Strict validation: current status `reserved|sold`, target `commercialStatus === 'for-sale'`, allowed payload keys αποκλειστικά `REVERT_ALLOWED_FIELDS = { commercialStatus, commercial }` — οτιδήποτε άλλο throw-s. Το `useGuardedPropertyMutation` εκθέτει αντίστοιχο `runRevertUpdate` wrapper (mirrors `runExistingPropertyUpdate` αλλά με revert gateway). Το `RevertDialog` χρησιμοποιεί πλέον `runRevertUpdate` αντί του generic update. Fix για `PropertyMutationPolicyError: Cannot modify locked fields on a sold property: commercialStatus` που πετούσε όταν ο agent έκανε revert από τη νέα `/sales/sold` σελίδα.
- **2026-04-20 (server-side revert bypass)**: Symmetric fix στο server PATCH `/api/properties/[id]` (ADR-249 field-locking). Νέος helper `isPropertyRevertTransition()` σε `src/lib/firestore/property-field-locking.ts` που εφαρμόζει τα ίδια strict rules (current `reserved|sold`, target `for-sale`, payload keys ⊆ `{ commercialStatus, commercial }`). Το `PATCH` route skip-άρει το `validatePropertyFieldLocking` μόνο όταν το body matches — αλλιώς διατηρεί το full lock. Fix για `ApiClientError: Cannot modify locked fields on a sold property: commercialStatus` που επέστρεφε 403 από το server όταν ο client είχε ήδη περάσει τη client-side gateway. Defense-in-depth: οι δύο guards παραμένουν, αλλά με ίδιο matching shape για να αποφεύγεται drift client/server.
