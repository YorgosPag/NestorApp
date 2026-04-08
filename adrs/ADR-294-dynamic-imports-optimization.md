# ADR-294: Dynamic Imports Optimization — Incremental Code Splitting

## Status
✅ **ACTIVE** — Batch 1 implemented (2026-04-08)

## Context

Το project φορτώνει **18,403 modules** ανά σελίδα στο cold start (κανονικό: 3,000-5,000).
Αυτό οφείλεται σε eager imports: κάθε page.tsx importάρει ΟΛΑ τα dependencies statically, 
ακόμα και αν ο χρήστης δεν θα τα χρησιμοποιήσει ποτέ.

### Πρόβλημα
- `/contacts` cold start: **188.5 δευτερόλεπτα** (Webpack) → ~40s (Turbopack)
- 18,403 modules compiled ανά σελίδα (αντί 3,000-5,000)
- Heavy components (recharts, calendar, real-time systems) φορτώνονται eagerly

### Λύση
**Dynamic imports** μέσω `next/dynamic` — κάθε σελίδα φορτώνει ΜΟΝΟ ό,τι χρειάζεται.

## Decision

### Architecture: Extract + Lazy Load Pattern

**Κάθε heavy page μετατρέπεται σε 2 αρχεία:**

1. **`page.tsx`** — Thin wrapper (~10 γραμμές):
```tsx
'use client';
import { LazyRoutes } from '@/utils/lazyRoutes';
const PageContent = LazyRoutes.ReportsExecutive;
export default function Page() { return <PageContent />; }
```

2. **`*PageContent.tsx`** — Full component (extracted logic):
```tsx
'use client';
// All heavy imports here — loaded ONLY when user navigates to this page
export function ReportsExecutivePageContent() { ... }
```

### Existing Infrastructure (reused)
- `src/utils/lazyRoutes.tsx` — `createLazyRoute()` + `LazyRoutes` registry
- `src/components/common/LazyComponents.tsx` — Skeleton components

### Rollout Strategy: Google Canary Pattern
- **Batch 1** (10 pages): Heaviest pages (recharts + complex CRM)
- **Batch 2** (TBD): Remaining reports
- **Batch 3** (TBD): Sales, Spaces, Procurement
- **Batch 4** (TBD): Account, remaining CRM, admin
- Κάθε batch σε ξεχωριστή συνεδρία, με testing ενδιάμεσα

## Implementation

### Batch 1 — 10 Heaviest Pages (2026-04-08)

| # | Page | Heavy Content | LoadingType |
|---|------|--------------|-------------|
| 1 | `/reports` | 5 executive chart sections (recharts) | dashboard |
| 2 | `/reports/financial` | 5 financial charts (recharts) | dashboard |
| 3 | `/reports/sales` | 6 sales charts (recharts) | dashboard |
| 4 | `/reports/construction` | 4 construction charts (recharts) | dashboard |
| 5 | `/sales/financial-intelligence` | PortfolioDashboard (recharts) | dashboard |
| 6 | `/crm/calendar` | Calendar + sidebar + date-fns + filters | dashboard |
| 7 | `/crm/tasks` | Real-time tasks + dashboard + filters | dashboard |
| 8 | `/crm/leads` | PipelineTab + dashboard + filters | dashboard |
| 9 | `/crm/pipeline` | PipelineTab | dashboard |
| 10 | `/crm/communications` | Dual-pane inbox + controller | list |

### Files Created (Batch 1)
- `src/components/reports/pages/ReportsExecutivePageContent.tsx`
- `src/components/reports/pages/ReportsFinancialPageContent.tsx`
- `src/components/reports/pages/ReportsSalesPageContent.tsx`
- `src/components/reports/pages/ReportsConstructionPageContent.tsx`
- `src/components/sales/financial-intelligence/FinancialIntelligencePageContent.tsx`
- `src/components/crm/calendar/CalendarPageContent.tsx`
- `src/components/crm/tasks/TasksPageContent.tsx`
- `src/components/crm/leads/LeadsPageContent.tsx`
- `src/components/crm/pipeline/PipelinePageContent.tsx`
- `src/components/crm/communications/CommunicationsPageContent.tsx`

### Files Modified (Batch 1)
- `src/utils/lazyRoutes.tsx` — +10 LazyRoute entries
- 10 × `page.tsx` — Converted to thin wrappers

## Progress Tracker

| Batch | Pages | Status | Date |
|-------|-------|--------|------|
| 1 | 10 (reports + CRM) | ✅ Done | 2026-04-08 |
| 2 | ~8 (remaining reports) | ⏳ Pending | — |
| 3 | ~8 (sales, spaces, procurement) | ⏳ Pending | — |
| 4 | ~10 (account, admin, remaining) | ⏳ Pending | — |

**Total lazy-loaded pages:** 31/96 (21 existing + 10 Batch 1)

## Expected Impact
- **-20% modules** per cold start (estimated)
- **Faster navigation**: Only load heavy components when needed
- **Better code splitting**: Separate chunks for recharts, calendar, etc.

## Changelog

### 2026-04-08 — Batch 1 (10 pages)
- Created 10 PageContent extraction files
- Updated lazyRoutes.tsx with 10 new entries
- Converted 10 page.tsx to thin wrappers
- Related: ADR-265 (Reports), ADR-229 (Calendar), ADR-227 (Tasks)
