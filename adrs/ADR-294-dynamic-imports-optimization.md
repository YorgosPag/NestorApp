# ADR-294: Dynamic Imports Optimization — Incremental Code Splitting

## Status
✅ **ACTIVE** — Batch 8 implemented (2026-04-08)

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

### Batch 2 — 8 Remaining Report Pages (2026-04-08)

| # | Page | Heavy Content | LoadingType |
|---|------|--------------|-------------|
| 1 | `/reports/spaces` | 5 chart sections (recharts) | dashboard |
| 2 | `/reports/contacts` | 5 chart/table sections (recharts) | dashboard |
| 3 | `/reports/crm` | 6 chart sections (recharts) | dashboard |
| 4 | `/reports/compliance` | 3 chart sections (recharts) | dashboard |
| 5 | `/reports/projects` | 8 chart sections (recharts) | dashboard |
| 6 | `/reports/export` | Export grid + status panel | dashboard |
| 7 | `/reports/builder` | ReportBuilder (dynamic) | dashboard |
| 8 | `/reports/cash-flow` | 7 sections + tabs + collapsible | dashboard |

### Files Created (Batch 2)
- `src/components/reports/pages/ReportsSpacesPageContent.tsx`
- `src/components/reports/pages/ReportsContactsPageContent.tsx`
- `src/components/reports/pages/ReportsCrmPageContent.tsx`
- `src/components/reports/pages/ReportsCompliancePageContent.tsx`
- `src/components/reports/pages/ReportsProjectsPageContent.tsx`
- `src/components/reports/pages/ReportsExportPageContent.tsx`
- `src/components/reports/pages/ReportsBuilderPageContent.tsx`
- `src/components/reports/pages/ReportsCashFlowPageContent.tsx`

### Files Modified (Batch 2)
- `src/utils/lazyRoutes.tsx` — +8 LazyRoute entries
- 8 × `page.tsx` — Converted to thin wrappers

### Batch 3 — Sales, Spaces, Procurement (2026-04-08)

| # | Page | Heavy Content | LoadingType |
|---|------|--------------|-------------|
| 1 | `/sales` | Hub dashboard + stats + nav cards | dashboard |
| 2 | `/sales/available-properties` | Properties list + filters + sidebar | list |
| 3 | `/sales/available-parking` | Parking list + filters + sidebar | list |
| 4 | `/sales/available-storage` | Storage list + filters + sidebar | list |
| 5 | `/sales/sold` | Sold dashboard + stats + breakdown | dashboard |
| 6 | `/spaces` | Hub dashboard + stats + nav cards | dashboard |
| 7 | `/spaces/common` | Common spaces dashboard + breakdown | dashboard |
| 8 | `/spaces/parking` | Full parking management (400 lines) | list |
| 9 | `/spaces/storage` | Full storage management (400 lines) | list |
| 10 | `/procurement` | PO list + KPIs + filters | list |
| 11 | `/procurement/[poId]` | PO detail + edit form | form |

### Files Created (Batch 3)
- `src/components/sales/pages/SalesHubPageContent.tsx`
- `src/components/sales/pages/SalesAvailablePropertiesPageContent.tsx`
- `src/components/sales/pages/SalesAvailableParkingPageContent.tsx`
- `src/components/sales/pages/SalesAvailableStoragePageContent.tsx`
- `src/components/sales/pages/SalesSoldPageContent.tsx`
- `src/components/spaces/pages/SpacesHubPageContent.tsx`
- `src/components/spaces/pages/SpacesCommonPageContent.tsx`
- `src/components/space-management/ParkingPage/ParkingPageContent.tsx`
- `src/components/space-management/StoragesPage/StoragePageContent.tsx`
- `src/components/procurement/pages/ProcurementPageContent.tsx`
- `src/components/procurement/pages/ProcurementDetailPageContent.tsx`

### Files Modified (Batch 3)
- `src/utils/lazyRoutes.tsx` — +11 LazyRoute entries
- 11 × `page.tsx` — Converted to thin wrappers

## Progress Tracker

| Batch | Pages | Status | Date |
|-------|-------|--------|------|
| 1 | 10 (reports + CRM) | ✅ Done | 2026-04-08 |
| 2 | 8 (remaining reports) | ✅ Done | 2026-04-08 |
| 3 | 11 (sales, spaces, procurement) | ✅ Done | 2026-04-08 |
| 4 | 9 (account, CRM remaining, obligations) | ✅ Done | 2026-04-08 |
| 5 | 8 (admin pages) | ✅ Done | 2026-04-08 |
| 6 | 2 (CRM dynamic routes: lead detail, task detail) | ✅ Done | 2026-04-08 |
| 7 | 7 (settings, navigation, storage, geo, public share pages) | ✅ Done | 2026-04-08 |
| 8 | 2 (obligations new + edit, replaced placeholders with real implementations) | ✅ Done | 2026-04-08 |

**Total lazy-loaded pages:** 78/96 (21 existing + 10 B1 + 8 B2 + 11 B3 + 9 B4 + 8 B5 + 2 B6 + 7 B7 + 2 B8)
**Note:** ai-inbox + operator-inbox are Server Components (SSR auth) — not lazy-loaded by design

## Expected Impact
- **-20% modules** per cold start (estimated)
- **Faster navigation**: Only load heavy components when needed
- **Better code splitting**: Separate chunks for recharts, calendar, etc.

## Changelog

### 2026-04-08 — Batch 8 (2 obligations pages + co-located file migration)
- Replaced 2 placeholder components (`ObligationForm.tsx`, `ObligationEditForm.tsx` — 21 lines each, dead code)
  with real implementations extracted from `app/obligations/new/page.tsx` (243 lines) and `app/obligations/[id]/edit/page.tsx` (440 lines)
- Created `EditObligationPageContent.tsx` (452 lines) + `NewObligationPageContent.tsx` (248 lines)
- Migrated co-located hook `useNewObligationPage.ts` from `app/obligations/new/` → `components/obligations/hooks/`
- Updated `preloadRoutes.ts` to point to new file locations
- Deleted dead placeholder files + old co-located hook
- Remaining co-located files in app/: role-management (13), ai-inbox (4), operator-inbox (2), attendance (2), etc.

### 2026-04-08 — Auth-ready guard centralization (infrastructure)
- Centralized auth-ready logic inside `firestoreQueryService.subscribe()` via `waitForAuthReady()`
- Added `waitForAuthReady()` to `auth-context.ts` — waits for Firebase Auth initialization before subscribing
- Updated all 3 subscribe methods: `subscribe()`, `subscribeDoc()`, `subscribeSubcollection()`
- Removed manual auth guards from `useRealtimeBuildings` and `useRealtimeTriageCommunications`
- 4 other hooks (`useRealtimeMessages`, `useRealtimeProperties`, `useRealtimeOpportunities`, `useRealtimeTasks`) now protected automatically
- Google pattern: Infrastructure handles auth, not consumers

### 2026-04-08 — Batch 7 (7 pages: settings, navigation, storage, geo, public share)
- Created 7 PageContent extraction files across 5 directories:
  - `src/components/settings/pages/` (1): ShortcutsPageContent
  - `src/components/navigation/pages/` (1): NavigationPageContent
  - `src/components/storage/pages/` (1): StorageDetailPageContent
  - `src/components/geo/pages/` (1): GeoCanvasPageContent (includes AdminGuard)
  - `src/components/shared/pages/` (3): PublicPOPageContent, SharedFilePageContent, PhotoSharePageContent
- Dynamic route pages (`storage/[id]`, `shared/[token]`, `shared/po/[token]`, `share/photo/[id]`) use `useParams()` internally
- Geo-Canvas page already had internal `dynamic()` import — now outer page also lazy-loaded
- Skipped: test/debug/demo pages, auth pages, static legal pages (data-deletion, privacy-policy, terms), redirect-only pages (account hub, settings hub, crm/customers)

### 2026-04-08 — Batch 6 (2 CRM dynamic routes)
- Converted `/crm/leads/[id]` and `/crm/tasks/[taskId]` to lazy-loaded pages
- **Lead Detail**: Moved 8 co-located files from `app/crm/leads/[id]/` to `src/components/crm/leads/lead-detail/`
  - 4 components: ContactCard, QuickActions, TasksSummary, UpcomingTasks
  - 2 hooks: useLead, useLeadTasks
  - 2 utils: dates, status
- Created `LeadDetailPageContent.tsx` (159 lines) + `TaskDetailPageContent.tsx` (414 lines)
- Updated all relative imports to use new paths
- Google pattern: app/ now contains only thin wrapper page.tsx + error.tsx

### 2026-04-08 — Batch 5 (8 admin pages)
- Created 8 PageContent extraction files + 1 data file in `src/components/admin/pages/`
- Pages: enterprise-migration, role-management, setup, property-status-demo, claims-repair, search-backfill, database-update, link-properties
- SRP split: database-update data definitions → `database-update-data.ts` (500→248 lines)
- Skipped: ai-inbox + operator-inbox (Server Components with SSR auth — already optimal)
- Co-located components in app/ referenced via absolute `@/app/admin/...` paths (TODO: migrate to components/)

### 2026-04-08 — Batch 4 (9 pages: account, CRM remaining, obligations)
- Created 9 PageContent extraction files across 3 directories:
  - `src/components/account/pages/` (5): Profile, Preferences, Privacy, Security, Notifications
  - `src/components/crm/pages/` (3): CrmHub, CrmTeams, CrmNotifications
  - `src/components/obligations/pages/` (1): ObligationsHub
- Updated lazyRoutes.tsx with 9 new entries
- Converted 9 page.tsx to thin wrappers (~7 lines each)
- Related: ADR-024 (Account Hub), ADR-025 (Notification Settings)

### 2026-04-08 — Security: Admin layout auth gate (TODO #6)
- Created `src/app/admin/layout.tsx` — Server Component with `requireAdminForPage()`
- Protects ALL 9 admin pages with server-side authentication (1 file, 0 page changes)
- Non-admin users see Unauthorized page without loading any admin client code
- ai-inbox/operator-inbox keep their own `requireAdminForPage()` for AdminContext

### 2026-04-08 — SSoT Cleanup: 7 duplicates centralized (post co-location discovery)
- **getIntentBadgeVariant()**: 3 copies (ai-inbox, operator-inbox, proposal-review-card) → 1 SSoT `admin/shared/intent-badge-utils.ts`
- **getConfidenceBadgeVariant() + getConfidenceColor()**: co-located in same SSoT module
- **format-relative-date.ts**: Custom 47-line English-only function → existing SSoT `intl-formatting.ts` (locale-aware `Intl.RelativeTimeFormat`)
- **NotificationCard**: CRM-specific variant renamed → `CrmNotificationCard` to resolve naming collision with generic `compositions/NotificationCard`
- **getChannelIcon()**: 4 copies (proposal-review-card, unified-inbox, SendMessageModal, CommunicationsIntegration) → 1 SSoT `lib/channel-icon-map.ts`
- Net: -155 lines, 2 new SSoT files, 0 behavior changes

### 2026-04-08 — Bugfix: SalesSoldPageContent broken className interpolations
- Fixed 10 instances of `className="... ${colors.text.X}"` (regular quotes)
- Changed to `className={`... ${colors.text.X}`}` (template literals + JSX expression)
- Pre-existing bug from original `sold/page.tsx` — colors were rendered as literal strings

### 2026-04-08 — Batch 3 (11 pages: sales, spaces, procurement)
- Created 11 PageContent extraction files across 5 directories
- Updated lazyRoutes.tsx with 11 new entries
- Converted 11 page.tsx to thin wrappers
- Extracted 400-line parking/storage components to dedicated files
- Related: ADR-197 (Sales), ADR-199 (Parking/Storage Sales), ADR-267 (Procurement)

### 2026-04-08 — Batch 2 (8 remaining report pages)
- Created 8 PageContent extraction files in `src/components/reports/pages/`
- Updated lazyRoutes.tsx with 8 new entries
- Converted 8 page.tsx to thin wrappers
- Pages: spaces, contacts, crm, compliance, projects, export, builder, cash-flow
- Related: ADR-265 (Reports), ADR-268 (Report Builder/Cash Flow)

### 2026-04-08 — Batch 1 (10 pages)
- Created 10 PageContent extraction files
- Updated lazyRoutes.tsx with 10 new entries
- Converted 10 page.tsx to thin wrappers
- Related: ADR-265 (Reports), ADR-229 (Calendar), ADR-227 (Tasks)

## TODO — Pending Refactoring (discovered during Batch 3)

### 1. ✅ ~~Duplicated Sales Grid View~~ (DONE — 2026-04-08)
- **Fix**: Extracted `SalesGridCard` + `SalesGridEmpty` to `src/components/sales/shared/SalesGridCard.tsx`
- 3 × ~40 identical card lines → 1 shared component with typed props
- Removed 3 × `eslint-disable design-system/enforce-semantic-colors`

### 2. ✅ ~~Hardcoded CSS Colors in Sales Grid~~ (DONE — 2026-04-08)
- **Fix**: Status badge colors now use CSS variables (`hsl(var(--bg-success))`) instead of hardcoded Tailwind
- Purple for `reserved` status kept as domain-specific (no semantic equivalent exists)
- Price text uses `colors.text.success` instead of `text-green-600`
