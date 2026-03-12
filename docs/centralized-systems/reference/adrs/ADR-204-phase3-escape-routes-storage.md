# ADR-204: Scattered Code Centralization — Phase 3

## Status: ✅ IMPLEMENTED

## Date: 2026-03-12

## Context

Phase 3 of scattered code centralization (successor to ADR-200 Phase 2 and ADR-161 Phase 1). Analysis by 6 agents identified additional patterns duplicated across the codebase. Three high-ROI tasks were selected:

1. **Escape key handlers**: 26 files with `e.key === 'Escape'` patterns — 4 in main app with identical document-level listener pattern
2. **Hardcoded route template literals**: 15 files with `router.push(`/crm/leads/${id}`)` — typo risk and multi-file changes on route changes
3. **Raw localStorage calls**: 14 main-app files without SSR safety, error handling, or key registry

## Decision

### Task 1: `useEscapeKey` Hook

**Location**: `src/hooks/useEscapeKey.ts`

```typescript
function useEscapeKey(handler: () => void, enabled?: boolean): void;
```

- Document-level `keydown` listener for Escape key
- Optional `enabled` flag for conditional activation
- Follows same pattern as `useClickOutside` (ADR-200)

**Migrated files (4 document-level listeners)**:
- `AttachmentRenderer.tsx` — Escape → `onClose()`
- `BaseModal.tsx` — Escape → `onClose()` (conditional: `isOpen && closeOnEscape`)
- `NotificationDrawer.enterprise.tsx` — Escape extracted, Tab focus trap kept separate
- `CustomRelationshipSelect.tsx` — Escape → `setIsOpen(false)` (conditional: `isOpen`)

**Not migrated (multi-key inline handlers — out of scope)**:
- `HeaderSearch.tsx`, `CommentsPanel.tsx`, `ConstructionPhaseDialog.tsx`, `AdminLayerManager.tsx`

### Task 2: Entity Route Builder

**Location**: `src/lib/routes/entityRoutes.ts`

```typescript
export const ENTITY_ROUTES = {
  crm: { leads, lead(id), tasks, task(id) },
  contacts: { list, withFilter(term), withId(id) },
  units: { list, withId(id) },
  spaces: { parking(id), storage(id) },
  obligations: { list, edit(id) },
} as const;
```

- Type-safe route builders with `encodeURIComponent` built in for filter routes
- Barrel exported from `src/lib/routes/index.ts`
- Zero breaking changes — same runtime strings

**Migrated files (11 files, 18 usages)**:
- `useLeadsList.ts`, `OpportunityCard.tsx`, `AIInboxClient.tsx`
- `contact-navigation.ts` (3 usages)
- `SaleInfoContent.tsx`, `CustomerPropertiesTable.tsx`
- `UnitsTabContent.tsx` (2), `ParkingTabContent.tsx` (2), `StorageTab.tsx` (2)
- `obligations/new/page.tsx`, `obligations/[id]/edit/page.tsx` (2)

### Task 3: Safe localStorage Utility

**Location**: `src/lib/storage/safe-storage.ts` + `src/lib/storage/index.ts`

```typescript
export const STORAGE_KEYS = { ... } as const;  // 12 keys + prefixes
export function safeGetItem<T>(key: string, fallback: T): T;
export function safeSetItem(key: string, value: unknown): boolean;
export function safeRemoveItem(key: string): boolean;
```

- SSR-safe (checks `typeof window`)
- Auto JSON parse/serialize for non-string values
- Error-swallowing (quota exceeded, privacy mode)
- Centralized key registry prevents magic string typos

**Migrated files (10)**:
- `WorkspaceContext.tsx` (3 calls)
- `AuthContext.tsx` (14 calls — with prefix-based dynamic keys)
- `UserTypeContext.tsx` (2 calls)
- `i18n/config.ts`, `useTranslation.ts`, `language-switcher.tsx` (3 calls)
- `ProductTour.context.tsx` (3 calls)
- `ErrorBoundary.tsx` (2 calls)
- `error-reporting.ts` (2 calls)
- `ErrorTracker.ts` (5 calls)

## Migrate-on-Touch Rules (Not centralized now)

| Pattern | Files | Reason |
|---------|-------|--------|
| Toast hardcoded strings | 59 | Huge blast radius |
| Firestore `.toDate()` | 75 | `asDate()` exists — awareness problem |
| Media query hooks | 30 | Needs consolidation design first |
| localStorage (subapps) | 10 | DXF/geo already have own utilities |

## Changelog

- **2026-03-12**: Initial implementation — 3 tasks, 25 files migrated
