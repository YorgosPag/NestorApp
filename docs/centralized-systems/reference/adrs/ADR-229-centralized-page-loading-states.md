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

## Τι ΔΕΝ αλλάζει

- `src/components/ui/spinner/Spinner.tsx` — χρησιμοποιείται εσωτερικά από `PageLoadingState`
- Tab-level loading states (Building tabs) — different scope, Phase 2 αν χρειαστεί
- Button loading spinners — different scope
- `src/components/ui/skeletons/` — skeleton components, different pattern

---

## Ποσοτική Ανάλυση

| Μέτρηση | Πριν | Μετά |
|---------|------|------|
| Page loading patterns | 6 διαφορετικά | 1 (`PageLoadingState`) |
| Page error patterns | 4 διαφορετικά | 1 (`PageErrorState`) |
| Suspense fallback patterns | 4 διαφορετικά | 1 (`StaticPageLoading`) |
| Αρχεία που άλλαξαν | — | 12 migrated |
| Νέα αρχεία | — | 4 (`src/core/states/`) |
| Lines removed (estimated) | ~180 scattered | → ~80 centralized |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-14 | ADR created — research complete, pending implementation decision |
| 2026-03-14 | IMPLEMENTED — 4 νέα components, 12 pages migrated |
