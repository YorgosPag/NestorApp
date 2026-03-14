# ADR-229: Centralized Page Loading & Error States

**Status**: IMPLEMENTED
**Date**: 2026-03-14
**Author**: Claude Opus 4.6 (research + implementation) + Γιώργος (decision)

---

## Context

Τα page-level loading states (spinners, error messages, retry buttons) ήταν **scattered** σε 15+ αρχεία με **6 διαφορετικά patterns**. Κάθε page "εφεύρισκε" τη δική του loading UI.

### Πρόβλημα

- Parking/Storage: spinning domain icon (`Car`/`Warehouse`) αντί canonical `Spinner`
- Error states: hardcoded `text-red-500` αντί semantic `text-destructive`
- Inline `<button>` αντί canonical `Button` component
- 9 Suspense fallbacks, 4 different patterns

---

## Απόφαση

3 centralized components στο `src/core/states/`:

### 1. `PageLoadingState.tsx` (client component)

```tsx
interface PageLoadingStateProps {
  icon?: LucideIcon;       // Domain icon (Car, Warehouse) — spins
  message: string;          // Translated text
  layout?: 'fullscreen' | 'contained';  // h-screen vs flex-1
}
```

- Αν `icon` δοθεί → domain icon spinning σε `xl` size
- Αν δεν δοθεί → canonical `Spinner` (Loader2)
- Semantic HTML: `<section role="status" aria-live="polite">`

### 2. `PageErrorState.tsx` (client component)

```tsx
interface PageErrorStateProps {
  title: string;
  message?: string;
  onRetry?: () => void;     // Shows retry Button when provided
  retryLabel?: string;
  layout?: 'fullscreen' | 'contained';
  icon?: LucideIcon;        // Default: AlertTriangle
}
```

- `AlertTriangle` icon σε `text-destructive`
- Canonical `Button` component (not inline `<button>`)
- Semantic HTML: `<section role="alert">`

### 3. `StaticPageLoading.tsx` (server component — NO hooks)

```tsx
interface StaticPageLoadingProps {
  icon?: LucideIcon;
  message?: string;  // default "Φόρτωση..."
}
```

- Για Suspense fallbacks + Next.js route-level loading
- Hardcoded Tailwind sizes (h-8 w-8) — δεν μπορεί να χρησιμοποιεί hooks

---

## Αρχεία που άλλαξαν

### Νέα αρχεία (4)

| Αρχείο | Περιγραφή |
|--------|-----------|
| `src/core/states/PageLoadingState.tsx` | Client loading component |
| `src/core/states/PageErrorState.tsx` | Client error component |
| `src/core/states/StaticPageLoading.tsx` | Server loading component |
| `src/core/states/index.ts` | Barrel exports |

### Migrated αρχεία (12)

| Αρχείο | Αλλαγές |
|--------|---------|
| `src/app/spaces/parking/page.tsx` | Loading → `PageLoadingState(Car)`, Error → `PageErrorState`, Suspense → `StaticPageLoading(Car)` |
| `src/app/spaces/storage/page.tsx` | Loading → `PageLoadingState(Warehouse)`, Error → `PageErrorState`, Suspense → `StaticPageLoading(Warehouse)` |
| `src/components/building-management/BuildingsPageContent.tsx` | Loading → `PageLoadingState(Building, contained)`, Error → `PageErrorState(contained)` |
| `src/app/units/page.tsx` | Suspense → `StaticPageLoading` |
| `src/app/properties/page.tsx` | Suspense → `StaticPageLoading` |
| `src/app/spaces/apartments/page.tsx` | Suspense → `StaticPageLoading` |
| `src/app/sales/available-apartments/page.tsx` | Suspense → `StaticPageLoading` |
| `src/app/sales/available-parking/page.tsx` | Suspense → `StaticPageLoading(Car)` |
| `src/app/sales/available-storage/page.tsx` | Suspense → `StaticPageLoading(Warehouse)` |
| `src/app/dxf/viewer/page.tsx` | Loading → `PageLoadingState(contained)`, Suspense → `StaticPageLoading` |
| `src/components/contacts/ContactsPageContent.tsx` | Error → `PageErrorState(contained)` |
| `src/app/loading.tsx` | Global loading → `StaticPageLoading` |

---

## Phase 2: Data-Level Loading Guards (2026-03-14)

Η Phase 1 κεντρικοποίησε τα components. Η Phase 2 πρόσθεσε **data-level loading guards** σε ΟΛΕΣ τις σελίδες που φορτώνουν δεδομένα, ώστε ο χρήστης να μη βλέπει empty states / "(0)" κατά το loading.

### Κανόνας

Κάθε content component που κάνει data fetching, ΠΡΕΠΕΙ στην αρχή του return να έχει:

```tsx
if (loading) {
  return (
    <PageContainer ariaLabel="...">
      <PageLoadingState icon={DomainIcon} message={t('page.loading')} layout="contained" />
    </PageContainer>
  );
}
```

### Αρχεία Phase 2 (16)

| Αρχείο | Icon | Pattern |
|--------|------|---------|
| `src/app/sales/available-apartments/page.tsx` | `ShoppingBag` | Early-exit guard |
| `src/app/sales/available-parking/page.tsx` | `Car` | Early-exit guard + `loading` destructure |
| `src/app/sales/available-storage/page.tsx` | `Warehouse` | Early-exit guard + `loading` destructure |
| `src/components/crm/dashboard/CRMDashboardPageContent.tsx` | `BarChart3` | Early-exit guard (authLoading \|\| loadingStats) |
| `src/components/file-manager/FileManagerPageContent.tsx` | `Files` | Spinner → PageLoadingState |
| `src/app/obligations/page.tsx` | `ClipboardList` | PageLoadingState + PageErrorState guards |
| `src/components/crm/dashboard/PipelineTab.tsx` | `GitBranch` | Inline Spinner+button → PageLoadingState+PageErrorState |
| `src/subapps/accounting/components/dashboard/AccountingDashboard.tsx` | `Receipt` | Spinner → PageLoadingState |
| `src/subapps/accounting/components/invoices/InvoicesPageContent.tsx` | `Receipt` | Spinner → PageLoadingState+PageErrorState |
| `src/subapps/accounting/components/journal/JournalPageContent.tsx` | `BookOpen` | Spinner → PageLoadingState+PageErrorState |
| `src/subapps/accounting/components/vat/VATPageContent.tsx` | `DollarSign` | Spinner → PageLoadingState+PageErrorState |
| `src/subapps/accounting/components/bank/BankPageContent.tsx` | `Landmark` | Spinner → PageLoadingState+PageErrorState |
| `src/subapps/accounting/components/efka/EFKAPageContent.tsx` | `PiggyBank` | Spinner → PageLoadingState+PageErrorState |
| `src/subapps/accounting/components/assets/AssetsPageContent.tsx` | `HardDrive` | Spinner → PageLoadingState+PageErrorState |
| `src/subapps/accounting/components/reports/ReportsPageContent.tsx` | `FileBarChart` | Early-exit guard (δεν είχε loading UI) |
| `src/subapps/accounting/components/documents/DocumentsPageContent.tsx` | `FileText` | Spinner → PageLoadingState+PageErrorState |

### Αρχεία Phase 2b — CRM & Admin (8)

| Αρχείο | Icon | Pattern |
|--------|------|---------|
| `src/app/crm/teams/page.tsx` | `Users2` | Custom Spinner+error → PageLoadingState+PageErrorState |
| `src/app/crm/leads/[id]/page.tsx` | `User` | AnimatedSpinner+error → PageLoadingState+PageErrorState (fullscreen) |
| `src/app/crm/notifications/page.tsx` | `Bell` | Inline Spinner → PageLoadingState (contained) |
| `src/app/crm/tasks/[taskId]/page.tsx` | `ClipboardList` | AnimatedSpinner → PageLoadingState (contained) |
| `src/app/crm/communications/page.tsx` | `Inbox` | 2x Spinner → PageLoadingState (contained) |
| `src/app/admin/ai-inbox/AIInboxClient.tsx` | `Inbox` | Data-loading Spinner → PageLoadingState (button Spinner kept) |
| `src/app/admin/operator-inbox/OperatorInboxClient.tsx` | `Inbox` | Data-loading Spinner → PageLoadingState (button Spinner kept) |
| `src/components/crm/dashboard/TasksTab.tsx` | `Clock` | AnimatedSpinner+error div → PageLoadingState+PageErrorState |

### Σελίδες CRM που ΔΕΝ χρειάστηκαν αλλαγή

- `src/app/crm/email-analytics/page.tsx` — Δεν έχει data loading spinner

---

## Τι ΔΕΝ αλλάζει

- `src/components/ui/spinner/Spinner.tsx` — χρησιμοποιείται εσωτερικά από `PageLoadingState`
- Button loading spinners — different scope
- `src/components/ui/skeletons/` — skeleton components, different pattern

---

## Ποσοτική Ανάλυση

| Μέτρηση | Πριν | Μετά |
|---------|------|------|
| Page loading patterns | 6 διαφορετικά | 1 (`PageLoadingState`) |
| Page error patterns | 4 διαφορετικά | 1 (`PageErrorState`) |
| Suspense fallback patterns | 4 διαφορετικά | 1 (`StaticPageLoading`) |
| Αρχεία Phase 1 | — | 12 migrated |
| Αρχεία Phase 2 | — | 16 migrated (data-level guards) |
| Αρχεία Phase 2b (CRM/Admin) | — | 8 migrated |
| Νέα αρχεία | — | 4 (`src/core/states/`) |
| Σελίδες με loading guard | 5 (Phase 1) | 29 (Phase 1 + Phase 2 + Phase 2b) |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-14 | ADR created — research complete, pending implementation decision |
| 2026-03-14 | Phase 1 IMPLEMENTED — 4 νέα components, 12 pages migrated |
| 2026-03-14 | Phase 2 IMPLEMENTED — Data-level loading guards σε 16 σελίδες, αφαίρεση inline Spinner patterns |
| 2026-03-14 | Phase 2b IMPLEMENTED — CRM & Admin migration: 8 σελίδες (teams, leads, notifications, tasks, communications, ai-inbox, operator-inbox, TasksTab) |
