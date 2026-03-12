# ADR-161: Σταδιακή Κεντρικοποίηση Διάσπαρτου Κώδικα

| Field | Value |
|-------|-------|
| **Status** | ✅ IMPLEMENTED |
| **Date** | 2026-03-12 |
| **Category** | Data & State / UI Components |
| **Impact** | 14 source files (date formatting), 6 hooks (entity stats), 7 components (empty state) |

## Context

Πολλά centralized systems ΗΔΗ ΥΠΑΡΧΟΥΝ αλλά ΔΕΝ χρησιμοποιούνται παντού.
3 παράλληλοι agents ανέλυσαν ολόκληρο το codebase και εντόπισαν τρεις κατηγορίες.

## Decisions

### 1. Date Formatting Cleanup

**Πρόβλημα**: 14 αρχεία κώδικα χρησιμοποιούσαν `.toLocaleDateString('el-GR')` ενώ `formatDateShort()` υπάρχει ήδη στο `@/lib/intl-utils.ts` (115+ αρχεία ΗΔΗ το χρησιμοποιούν).

**Λύση**: Search-replace σε 14 αρχεία → `formatDateShort()` από `@/lib/intl-utils`.

**Αρχεία**:
- `FilePreviewPanel.tsx`, `enterprise-contact-dropdown.tsx`, `EnterpriseSessionService.ts`
- `OrganizationTree.tsx`, `ProfessionalDrawingInterface.tsx`, `TwoFactorEnrollment.tsx`
- `EmployeeSelector.tsx`, `GanttView.tsx` (4 χρήσεις)
- `gantt-excel-exporter.ts`, `gantt-export-utils.ts`, `gantt-pdf-exporter.ts`
- `milestone-excel-exporter.ts`, `milestone-pdf-exporter.ts`
- `WorkerCard.tsx`

### 2. Entity Stats Generic Hook (`useEntityStats<T>`)

**Πρόβλημα**: 5 stats hooks (Projects 92γρ, Units 133γρ, Parking 142γρ, Storage 87γρ, Building 19γρ) ≈ 473 γραμμές με ΤΑΥΤΟΣΗΜΗ δομή.

**Λύση**: Generic `useEntityStats<T>` hook με utility functions (`groupBy`, `sumBy`, `countBy`, `rate`, `avg`, `avgRounded`) + thin wrappers.

**Αρχεία**:
- `src/hooks/useEntityStats.ts` — **ΝΕΟ** (~130 γραμμές) - generic hook + utilities
- `src/hooks/useProjectsStats.ts` — thin wrapper
- `src/hooks/useUnitsStats.ts` — thin wrapper (keeps CoverageStats)
- `src/hooks/useParkingStats.ts` — thin wrapper (keeps rates + distributions)
- `src/hooks/useStorageStats.ts` — thin wrapper
- `src/hooks/useBuildingStats.ts` — thin wrapper

**API**: 100% backward compatible — same exports, same interfaces.

### 3. Centralized EmptyState Component

**Πρόβλημα**: 7+ separate EmptyState components with identical patterns.

**Λύση**: Generic `EmptyState` component στο `src/components/shared/EmptyState.tsx`.

**Props**: `icon`, `iconColor`, `title`, `description`, `action`, `size` (sm/md/lg), `variant` (plain/card).

**Migrated**: 6 components → thin wrappers using SharedEmptyState.
**Not migrated**: `CommunicationEmptyState.tsx` (too specialized — config-driven, ARIA, custom styles).

## Migrate-on-Touch Rules

| Κατηγορία | Centralized System | Κανόνας |
|-----------|-------------------|---------|
| Date formatting | `formatDateShort()` from `@/lib/intl-utils` | Νέο `.toLocaleDateString('el-GR')` ΑΠΑΓΟΡΕΥΕΤΑΙ |
| Empty states | `EmptyState` from `@/components/shared/EmptyState` | Νέο ad-hoc EmptyState → χρήση SharedEmptyState |
| Entity stats | `useEntityStats` utilities from `@/hooks/useEntityStats` | Νέο stats hook → extend useEntityStats |

## Changelog

| Date | Change |
|------|--------|
| 2026-03-12 | Initial implementation — all 3 tasks completed |
