# ADR-248: Centralized Auto-Save System (Google-Level)

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED (Phase 1 + 2) |
| **Date** | 2026-03-19 |
| **Category** | UI / State Management / Data Persistence |
| **Canonical Files** | `src/hooks/useAutoSave.ts`, `src/types/auto-save.ts`, `src/config/auto-save-config.ts`, `src/components/shared/AutoSaveStatusIndicator.tsx` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Context

### Τι είχαμε πριν

Ο κώδικας αυτόματης αποθήκευσης ήταν **διάσπαρτος σε 8+ σημεία** με copy-paste boilerplate ~15-25 γραμμών σε κάθε component. Κάθε component ξαναέγραφε τα ίδια: `setTimeout` management, status tracking (`idle/saving/success/error`), `lastSaved` timestamp, cleanup on unmount, try-catch error handling.

### The Problem

- ❌ **8+ duplicate patterns**: `saveTimeoutRef`, `saveStatus useState`, `lastSaved useState` copy-pasted
- ❌ **BROKEN auto-save**: `useAutosave` στο Projects/GeneralProjectTab ΔΕΝ έκανε actual save — μόνο UI animation
- ❌ **Fake auto-save**: Buildings/GeneralTabContent είχε fake setTimeout που μόνο εμφάνιζε "Saved" χωρίς Firestore write
- ❌ **No retry logic**: Αν αποτύχει ένα save, χάνονταν δεδομένα
- ❌ **Race conditions**: Rapid edits μπορούσαν να προκαλέσουν stale data saves
- ❌ **No deep equality**: Κάποια components έκαναν save ακόμα κι αν τα data δεν είχαν αλλάξει

### Existing building blocks (ΚΡΑΤΗΘΗΚΑΝ)

| Τι υπάρχει | Πού | Status |
|------------|-----|--------|
| `useDebouncedCallback` | `src/hooks/useDebouncedCallback.ts` | ✅ Κρατήθηκε (generic utility) |
| `useDebounce` | `src/hooks/useDebounce.ts` | ✅ Κρατήθηκε (generic utility) |
| `timing-config.ts` | DXF viewer config | ✅ Κρατήθηκε (DXF-specific) |
| `useAutoSaveSceneManager` | DXF viewer hooks | ✅ Κρατήθηκε (domain-specific) |
| `useStorageSave` | DXF settings provider | ✅ Κρατήθηκε (DXF-specific) |

---

## 2. Decision

### Αρχιτεκτονική: Centralized Hook + Config + Types + Status Component

#### 2.1 `src/types/auto-save.ts` — Shared Types

```typescript
type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

interface AutoSaveConfig<T> {
  saveFn: (data: T) => Promise<void>;
  debounceMs?: number;        // Default: 2000
  equalityFn?: (prev: T, next: T) => boolean;
  enabled?: boolean;           // Default: true
  maxRetries?: number;         // Default: 2
  statusResetMs?: number;      // Default: 3000ms
  onStatusChange?: (status: SaveStatus) => void;
  onError?: (error: Error, retryCount: number) => void;
  onSuccess?: (data: T, timestamp: Date) => void;
}

interface AutoSaveReturn<T> {
  status: SaveStatus;
  lastSaved: Date | null;
  error: string | null;
  isDirty: boolean;
  saveNow: () => Promise<void>;
  retry: () => Promise<void>;
  markClean: () => void;
  reset: () => void;
}
```

#### 2.2 `src/config/auto-save-config.ts` — Timing Constants

```typescript
export const AUTO_SAVE_TIMING = {
  FORM_DEBOUNCE: 2000,    // Building/Project/Contact forms
  SETTINGS_DEBOUNCE: 500, // User preferences
  INSTANT: 0,             // Select/dropdown
  STATUS_RESET: 3000,     // "Saved" message visibility
  ERROR_RESET: 5000,      // Error message visibility
  RETRY_DELAY: 1000,      // Retry delay on failure
  MAX_RETRIES: 2,         // Max retry attempts
} as const;
```

#### 2.3 `src/hooks/useAutoSave.ts` — Core Hook

**Google Docs pattern**: Consumer provides `data`, hook watches for changes and saves.

Key features:
- **Deep equality** via `JSON.stringify` (configurable `equalityFn`)
- **Race condition protection** via version counter
- **Stale closure protection** via `useRef` for `saveFn`
- **Automatic retry** with configurable max attempts
- **Flush on unmount** (fire-and-forget) — never lose data on navigation
- **Status lifecycle**: `idle → saving → success|error → idle` (auto-reset)
- **First render skip** — don't save initial data load

#### 2.4 `src/components/shared/AutoSaveStatusIndicator.tsx` — Status UI

Three variants:
- `inline` — Icon + text (form headers)
- `badge` — Colored badge with dot (page headers)
- `compact` — Colored dot only (toolbars)

Uses semantic `<output>` tag with `aria-live="polite"`.

### Αρχιτεκτονικές Αποφάσεις

| Απόφαση | Επιλογή | Γιατί |
|---------|---------|-------|
| Hook vs Class | **Hook** | Auto-save tied σε React lifecycle |
| `data: T` input vs `onChange` | **`data: T`** | Google Docs pattern, eliminates race conditions |
| Configurable `equalityFn` | **Ναι** | Forms: JSON.stringify. DXF: stableHash. Consumer decides. |
| Reuse `useDebouncedCallback` | **Όχι** | Need full control: cancel, flush, retry |
| Flush on unmount | **Ναι** | Google Docs never loses data on navigation |
| DXF hooks migration | **Phase 3** | Too domain-specific, risk outweighs benefit |

---

## 3. Implementation

### Phase 1: Foundation (DONE)

| File | What |
|------|------|
| `src/types/auto-save.ts` | Shared types |
| `src/config/auto-save-config.ts` | Timing constants |
| `src/hooks/useAutoSave.ts` | Core hook |
| `src/components/shared/AutoSaveStatusIndicator.tsx` | Status component |
| `src/i18n/locales/{en,el}/common.json` | i18n keys (`autoSave.*`) |

### Phase 2: First Migration (DONE)

| File | Change |
|------|--------|
| `src/components/projects/general-tab/hooks/useAutosave.ts` | Rewritten as wrapper around `useAutoSave` with actual Firestore persistence |
| `src/components/projects/general-tab/GeneralProjectTab.tsx` | Real auto-save via `updateProject()`, `AutoSaveStatusIndicator` props |
| `src/components/projects/GeneralProjectHeader.tsx` | Added `AutoSaveStatusIndicator` support with backward compat |
| `src/components/building-management/tabs/GeneralTabContent.tsx` | Replaced fake setTimeout auto-save with real `useAutoSave` + `updateBuilding()` |

### Phase 3: Extended Migration (FUTURE, as-we-touch-files)

- `EntityLinkCard.tsx` — Replace `saveStatus` boilerplate
- `LinkedSpacesCard.tsx` — Replace `saveStatus` boilerplate
- `ContactDetails.tsx` — Unify optimistic state tracking
- DXF hooks evaluation (optional)

---

## 4. i18n Keys

Added to `common.json` under `autoSave` namespace:

| Key | EN | EL |
|-----|----|----|
| `autoSave.saving` | Saving... | Αποθήκευση... |
| `autoSave.saved` | Saved | Αποθηκεύτηκε |
| `autoSave.error` | Save failed | Αποτυχία αποθήκευσης |
| `autoSave.retry` | Retry | Επανάληψη |
| `autoSave.lastSaved` | Last saved | Τελευταία αποθήκευση |

---

## 5. Changelog

| Date | Change |
|------|--------|
| 2026-03-19 | Initial implementation: Phase 1 (foundation) + Phase 2 (first migration) |
