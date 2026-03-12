# ADR-215: Phase 10 — chunkArray/isRecord/formatBytes/formatDate/formatCurrency Deduplication

## Status
**IMPLEMENTED** — 2026-03-12

## Context
Μετά τα Phase 9 (ADR-212) και Validation Centralization (ADR-213), audit με explore agents εντόπισε **16 duplicate patterns** σε 6 κατηγορίες utility functions. Κεντρικοποίηση για Google-grade consistency.

## Decision

### 1. `chunkArray` → `src/lib/array-utils.ts` (ΝΕΟΣ)

**5 πανομοιότυπες υλοποιήσεις** array chunking (Firestore `in` query limit).

| # | Αρχείο | Πριν | Μετά |
|---|--------|------|------|
| 1 | `src/lib/firestore/utils.ts` | `export const chunk` (inline) | Re-export from `array-utils` |
| 2 | `src/services/projects/repositories/FirestoreProjectsRepository.ts` | Module-level `chunkArray` | Import from `array-utils` |
| 3 | `src/server/comms/workers/email-ingestion-worker.ts` | Private method `this.chunkArray` | Import from `array-utils` |
| 4 | `src/server/ai/workers/ai-pipeline-worker.ts` | Private method `this.chunkArray` | Import from `array-utils` |
| 5 | `src/lib/layer-sync.ts` | Private method `this.chunkArray` | Import from `array-utils` |
| 6 | `src/app/api/audit/bootstrap/route.ts` | Module function `chunkArray` | Import from `array-utils` |

### 2. `isRecord` → `src/lib/type-guards.ts` (ΝΕΟΣ)

**5 πανομοιότυπες υλοποιήσεις** type guard `isRecord(value): value is Record<string, unknown>`.

| # | Αρχείο | Πριν | Μετά |
|---|--------|------|------|
| 1 | `OpenAIAnalysisProvider.ts` | Module function | Import from `type-guards` |
| 2 | `ai-reply-generator.ts` | Module function | Import from `type-guards` |
| 3 | `email-inbound-service.ts` | Module function | Import from `type-guards` |
| 4 | `openai-document-analyzer.ts` | Module function | Import from `type-guards` |
| 5 | `universal-polygon-bridge.ts` | Module const | Import from `type-guards` |

### 3. `formatBytes` → Delegate to `formatFileSize`

2 local implementations replaced with centralized `formatFileSize` from `src/utils/file-validation.ts`.

| # | Αρχείο | Πριν | Μετά |
|---|--------|------|------|
| 1 | `FileUploadZone.tsx` | Local `formatBytes` | `const formatBytes = formatFileSize` |
| 2 | `version-utils.ts` | Exported `formatSize` | Re-export `formatFileSize as formatSize` |

### 4. `formatDate` inline → Delegate to `intl-utils`

2 components with hardcoded `'el-GR'` locale → delegate to locale-aware `formatDate` + `normalizeToDate`.

| # | Αρχείο | Πριν | Μετά |
|---|--------|------|------|
| 1 | `SaleInfoContent.tsx` | 15-line Firestore-aware `formatDate` | `normalizeToDate(ts)` + `formatDate(d)` |
| 2 | `TransactionChainCard.tsx` | Local ISO-to-date formatter | `formatDateIntl(new Date(isoDate))` |

### 5. `formatCurrency` inline → Delegate to `intl-utils`

| # | Αρχείο | Πριν | Μετά |
|---|--------|------|------|
| 1 | `ProjectMeasurementsTab.tsx` | Local `new Intl.NumberFormat('el-GR', ...)` | `formatCurrencyIntl(amount, 'EUR', opts)` |

### 6. `getRelativeTime` hardcoded Greek → Delegate to `formatRelativeTime`

| # | Αρχείο | Πριν | Μετά |
|---|--------|------|------|
| 1 | `obligations/utils.ts` | 22-line hardcoded Greek strings | 1-line `formatRelativeTime(date)` (Intl-based, locale-aware) |

## Excluded (by design)
- CRM `getRelativeTime` (UnifiedInbox, ThreadView, ConversationListCard) — use i18n `t()` keys, different semantics
- Server-only files (`accounting-notification.ts`, `template-resolver.ts`) — can't import `intl-utils` (i18n client dep)
- geo-canvas private class `formatBytes` methods (5) — migrate-on-touch
- Env var fallback inconsistency (31+ reads) — separate design project
- Inline debounce patterns (7 components) — needs `useDebouncedCallback` hook
- `!response.ok` raw fetch (65 files) — massive migration
- Window resize inline hooks (14 files) — different breakpoints/semantics

## Impact
- **3 νέα αρχεία**: `src/lib/array-utils.ts`, `src/lib/type-guards.ts`, ADR-215
- **~17 αρχεία** τροποποιημένα
- **16 duplicate patterns** αφαιρέθηκαν
- Zero runtime behavior change

## Changelog
| Date | Change |
|------|--------|
| 2026-03-12 | Initial implementation — Phase 10 complete |
