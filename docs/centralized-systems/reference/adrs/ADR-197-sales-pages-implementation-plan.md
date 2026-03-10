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

**References:**
- `REAL_ESTATE_HIERARCHY_DOCUMENTATION.md` — Domain architecture
- `src/app/units/page.tsx` — **PRIMARY Reference pattern** (Units page)
- `src/app/spaces/storage/page.tsx` — Reference pattern (Storage Spaces page)
- `src/app/spaces/parking/page.tsx` — Reference pattern (Parking Spaces page)
- `src/app/sales/available-apartments/page.tsx` — Current mock implementation
