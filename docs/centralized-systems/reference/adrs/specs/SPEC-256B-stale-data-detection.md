# SPEC-256B: Stale Data Detection (Phase 2)

> **Parent**: [ADR-256](../ADR-256-concurrency-conflict-analysis.md)
> **Priority**: P1 (HIGH)
> **Effort**: ~3 days
> **Prerequisite**: SPEC-256A (Optimistic Versioning)
> **Status**: 📋 PLANNED

---

## Problem

Ακόμα και με version checking (Phase 1), ο χρήστης μαθαίνει για conflict **μόνο κατά το save**. Αν κάποιος τροποποιήσει το document ενώ ο χρήστης κάνει edit, δεν υπάρχει **κανένα real-time warning**. Ο χρήστης μπορεί να δουλεύει πάνω σε stale data για ώρα πριν πατήσει save.

---

## Goal

Real-time ειδοποίηση ότι το document άλλαξε ενώ ο χρήστης κάνει edit. **Two-layer defense**:
- **Layer 1** (Phase 2): Pre-save warning — banner εμφανίζεται ΠΡΙΝ ο χρήστης πατήσει save
- **Layer 2** (Phase 1): Save-time protection — ConflictDialog αν save γίνεται σε stale document

---

## Existing Infrastructure

| Σύστημα | Path | Ρόλος |
|---------|------|-------|
| `RealtimeService` | `src/services/realtime/RealtimeService.ts` | `subscribeToDocument()` (γρ.128-176) — Firestore `onSnapshot` listener |
| `RealtimeCollection` | `src/services/realtime/types.ts` (γρ.19-27) | Collection type enum — needs extension |
| `useAutoSave` | `src/hooks/useAutoSave.ts` | Auto-save hook — needs stale-pause integration |
| `VERSIONING_CONFIG` | `src/config/versioning-config.ts` (SPEC-256A) | `VERSION_FIELD`, `DEFAULT_VERSION` |

---

## New Files (2)

### 1. `src/hooks/useDocumentSync.ts` — Real-time Document Watch

```typescript
/**
 * Wraps RealtimeService.subscribeToDocument() to detect external changes
 * to a document while the current user is editing it.
 *
 * Key behaviors:
 * - Subscribes to Firestore onSnapshot for the document
 * - Compares _v + updatedBy to detect EXTERNAL changes (ignores self-changes)
 * - Sets isStale=true when external change detected
 * - Calls onExternalChange callback with new data
 * - Auto-unsubscribes on unmount
 * - Respects enabled flag (no subscription when form is not in edit mode)
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import type { RealtimeCollection } from '@/services/realtime/types';

interface UseDocumentSyncOptions {
  /** Collection to watch (must be in RealtimeCollection enum) */
  collection: RealtimeCollection;
  /** Document ID to watch */
  documentId: string | undefined;
  /** Enable/disable subscription (false when form not mounted or read-only) */
  enabled: boolean;
  /** Current user ID — to filter out self-changes */
  currentUserId: string;
  /** Callback when external change detected */
  onExternalChange?: (newData: Record<string, unknown>, changedBy?: string) => void;
}

interface UseDocumentSyncReturn {
  /** Whether the local data is stale (external change detected) */
  isStale: boolean;
  /** Timestamp of last external update */
  lastExternalUpdate: Date | null;
  /** Who made the external change */
  lastChangedBy: string | null;
  /** Reset stale state (after user acknowledges or reloads) */
  resetStale: () => void;
}

export function useDocumentSync(options: UseDocumentSyncOptions): UseDocumentSyncReturn {
  // Implementation outline:
  //
  // 1. useEffect subscribes via RealtimeService.subscribeToDocument()
  // 2. On each snapshot:
  //    a. Compare newData._v with tracked version (from useVersionedSave)
  //    b. If _v increased AND updatedBy !== currentUserId → external change
  //    c. Set isStale = true
  //    d. Call onExternalChange callback
  // 3. Ignore first snapshot (initial load, not a change)
  // 4. Track lastExternalUpdate and lastChangedBy for display
  // 5. Cleanup: unsubscribe on unmount or when enabled=false
  // 6. resetStale(): called after user clicks "Ανανέωση" in banner
}
```

### 2. `src/components/ui/stale-data-banner.tsx` — Warning Banner

```typescript
/**
 * Yellow warning banner displayed above edit forms when external changes detected.
 *
 * UI mockup:
 * ┌──────────────────────────────────────────────────────────────┐
 * │ ⚠️ Αυτή η εγγραφή τροποποιήθηκε από {changedBy}. [Ανανέωση] │
 * └──────────────────────────────────────────────────────────────┘
 *
 * Behavior:
 * - Appears when useDocumentSync.isStale === true
 * - Shows who made the change and how long ago
 * - "Ανανέωση" button: calls onReload → fetches fresh data → resets stale
 * - If user has UNSAVED changes: shows additional warning text
 *   "Έχετε μη αποθηκευμένες αλλαγές. Αν ανανεώσετε, θα χαθούν."
 * - Subtle animation: slide-down entry
 *
 * Props:
 * - isStale: boolean
 * - changedBy: string | null
 * - lastUpdate: Date | null
 * - hasUnsavedChanges: boolean
 * - onReload: () => void
 *
 * Uses: shadcn/ui Alert component, AlertTriangle icon
 * i18n: el/en keys in common.json
 */
```

---

## Modified Files

### 1. `src/services/realtime/types.ts` — Extend RealtimeCollection

Add 8 missing collections to the `RealtimeCollection` enum (γρ.19-27):

```typescript
// CURRENT (γρ.19-27):
export enum RealtimeCollection {
  BUILDINGS = 'buildings',
  CONTACTS = 'contacts',
  PROJECTS = 'projects',
  // ... existing entries ...
}

// ADD:
export enum RealtimeCollection {
  // ... existing ...
  OPPORTUNITIES = 'opportunities',
  TASKS = 'tasks',
  PARKING_SPOTS = 'parking_spots',
  FLOORS = 'floors',
  STORAGE_UNITS = 'storage_units',
  SALES_INSTALLMENTS = 'sales_installments',
  CONTACT_BANK_ACCOUNTS = 'contact_bank_accounts',
  SALES = 'sales',
}
```

### 2. 12 Form Components — Add `useDocumentSync` + `StaleDataBanner`

Integration pattern (same for all 12 forms):

```typescript
// Inside form component:
import { useDocumentSync } from '@/hooks/useDocumentSync';
import { StaleDataBanner } from '@/components/ui/stale-data-banner';

function EditFormComponent({ documentId, collection }: Props) {
  const { user } = useAuth();
  const { isStale, lastChangedBy, lastExternalUpdate, resetStale } = useDocumentSync({
    collection,
    documentId,
    enabled: !!documentId,
    currentUserId: user?.uid ?? '',
    onExternalChange: (newData) => {
      // Optional: pause auto-save when stale
    },
  });

  const handleReload = useCallback(() => {
    // Re-fetch data from API
    refetch();
    resetStale();
  }, [refetch, resetStale]);

  return (
    <>
      <StaleDataBanner
        isStale={isStale}
        changedBy={lastChangedBy}
        lastUpdate={lastExternalUpdate}
        hasUnsavedChanges={isDirty}
        onReload={handleReload}
      />
      {/* ... existing form content ... */}
    </>
  );
}
```

### Forms to Integrate (same rollout order as SPEC-256A):

| Priority | Form Component | Collection |
|----------|---------------|------------|
| P0 | `ContactDetails` | `contacts` |
| P0 | `EditContactDialog` | `contacts` |
| P0 | `EditInstallmentDialog` | `sales_installments` |
| P1 | `GeneralTabContent` (buildings) | `buildings` |
| P1 | `EditOpportunityModal` | `opportunities` |
| P1 | `ProjectDetailsTab` | `projects` |
| P2 | `UnitsTabContent` | `units` |
| P2 | `UnitFieldsBlock` | `units` |
| P2 | `TaskEditDialog` | `tasks` |
| P3 | `ParkingTabContent` | `parking_spots` |
| P3 | `FloorsTabContent` | `floors` |
| P3 | `StorageForm` | `storage_units` |

---

## Key Design Decisions

### D1: Self-Change Filtering

`useDocumentSync` compares `updatedBy` against `currentUserId`. Αν ο ίδιος χρήστης έκανε την αλλαγή (π.χ. σε άλλο tab), η banner **δεν εμφανίζεται** — τα δικά μας saves δεν είναι "external changes".

### D2: Stale → Pause Auto-Save

Όταν `isStale === true`, η auto-save **παύεται** (δεν στέλνει νέα requests). Αυτό αποτρέπει:
- Αποστολή save πάνω σε stale data → 409 conflict
- Race condition μεταξύ auto-save timer και user action στο banner

Η auto-save ξαναρχίζει μετά από: Reload (fresh data) ή Force Save (conflict resolved).

### D3: Two-Layer Defense

```
External change detected
         │
         ├──> isStale=true → StaleDataBanner (Phase 2)
         │    └──> User clicks "Ανανέωση" → reload fresh data
         │    └──> User ignores → continues editing
         │
         └──> User saves (with stale data)
              └──> 409 Conflict → ConflictDialog (Phase 1)
                   └──> Reload / Force Save / Cancel
```

Phase 1 (ConflictDialog) είναι η **ασφαλής δικλείδα**. Phase 2 (StaleDataBanner) είναι η **UX βελτίωση** — ο χρήστης μαθαίνει νωρίτερα.

### D4: Firestore Cost Consideration

Κάθε `onSnapshot` listener = 1 document read αρχικά + 1 read per change. Για 10-20 concurrent edit sessions, αυτό είναι αμελητέο (~50-100 reads/ημέρα). Δεν αυξάνει σημαντικά το Firestore κόστος.

---

## Testing Strategy

### Manual Testing Scenarios

1. **External change test**: Άνοιξε contact σε 2 tabs → αλλαγή σε tab B → banner εμφανίζεται σε tab A
2. **Self-change filter**: Αλλαγή στο ίδιο tab → banner ΔΕΝ εμφανίζεται
3. **Reload action**: Banner → "Ανανέωση" → form γεμίζει με fresh data → banner εξαφανίζεται
4. **Stale + unsaved**: Αλλαγή σε tab A (unsaved) → external change → banner δείχνει warning
5. **Auto-save pause**: External change → verify auto-save δεν τρέχει μέχρι resolution

---

## Success Criteria

- [ ] `useDocumentSync` detects external changes via onSnapshot
- [ ] `StaleDataBanner` appears within 2 seconds of external change
- [ ] Self-changes are correctly filtered (no false positives)
- [ ] Auto-save pauses when stale
- [ ] "Ανανέωση" reloads fresh data and clears stale state
- [ ] 8 missing collections added to `RealtimeCollection`
- [ ] 12 form components integrated

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-20 | Initial SPEC — Phase 2 specification | Claude Code |
