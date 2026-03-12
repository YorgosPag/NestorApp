# ADR-208: Phase 7 — Date Formatting Deduplication

| Field | Value |
|-------|-------|
| **ID** | ADR-208 |
| **Status** | ✅ Implemented |
| **Created** | 2026-03-12 |
| **Category** | Centralization / Deduplication |
| **Phase** | Phase 7 of Centralization Roadmap |

## Context

Η εφαρμογή διαθέτει ήδη κεντρικοποιημένα date utilities (`intl-utils.ts`, `date-local.ts`), αλλά **12+ components** όριζαν δικές τους `formatDate` / `parseFirestoreTimestamp` / `resolveFirestoreTimestamp` functions αντί να χρησιμοποιούν τις κεντρικοποιημένες. Αυτό δημιουργούσε:

- **Ασυνέπεια formatting** — κάθε component formatάρει αλλιώς
- **Maintenance burden** — αλλαγή σε 1 σημείο δεν μεταδίδεται
- **~150 γραμμές** scattered duplicate code

## Decision

### Bridge Functions (intl-utils.ts)

Προστέθηκαν 2 bridge functions που γεφυρώνουν `FlexibleDateInput` → `Intl` formatting:

| Function | Input | Output | Use Case |
|----------|-------|--------|----------|
| `formatFlexibleDateTime(value, options?)` | `unknown` (Firestore Timestamps, Date, string, null) | Localized date+time string ή `'-'` | General date display |
| `formatFlexibleTimeOnly(value)` | `unknown` | `HH:mm` ή `''` | Real-time feeds (Telegram) |

Pipeline: `normalizeToDate()` (date-local.ts) → `formatDateTime()` / `Intl.DateTimeFormat`

### Files Changed

#### API Routes — `parseFirestoreTimestamp` → `normalizeToDate`
- `src/app/api/companies/route.ts` — Removed 27-line duplicate, import `normalizeToDate`
- `src/app/api/storages/route.ts` — Removed 27-line duplicate, import `normalizeToDate`

#### Shared Components — local formatDate → centralized
- `src/components/shared/files/FileInspector.tsx` — 16-line `formatDate(timestamp: unknown)` → `formatFlexibleDateTime()`
- `src/components/shared/files/TrashView.tsx` — Simplified `formatTrashDate` wrapper

#### Composition Components — Firestore-aware formatters → centralized
- `src/components/compositions/ContactCard/ContactCard.tsx` — `formatContactDate()` → `formatFlexibleDateTime()`
- `src/components/compositions/TaskCard/TaskCard.tsx` — `formatLocalizedTaskDate()` → `formatFlexibleDateTime()`
- `src/components/compositions/UserCard/UserCard.tsx` — `formatLastActive()` → `formatRelativeTime()`
- `src/components/contacts/relationships/summary/RecentRelationshipsSection.tsx` — 28-line `formatCreatedDate()` → `formatFlexibleDateTime()`

#### CRM/Admin Components
- `src/app/admin/operator-inbox/OperatorInboxClient.tsx` — Trivial wrapper → direct `formatDateTime`
- `src/components/crm/dashboard/TelegramNotifications.tsx` — `formatTime()` → `formatFlexibleTimeOnly()`
- `src/app/admin/ai-inbox/AIInboxClient.tsx` — `resolveFirestoreTimestamp()` → `normalizeToDate()`

### Files NOT Changed (Exclusions)

- **`TasksTab.tsx`** — Uses `createFormatDueDate` with local i18n keys, requires deeper analysis
- **`communications/utils/formatters.ts`** — Returns i18n KEYS not text
- **`crm/leads/[id]/utils/dates.ts`** — Already centralized CRM-specific utility
- **`ProgressiveLoader.tsx` / `PerformanceComponents.tsx`** — Duration formatting (ms→s), different concern

## Impact

- **~12 duplicate functions** removed
- **~150 lines** of scattered code eliminated
- **2 bridge functions** (~35 lines) added to centralized utility
- **0 new dependencies**

## Changelog

| Date | Change |
|------|--------|
| 2026-03-12 | Initial implementation — Phase 7 complete |
