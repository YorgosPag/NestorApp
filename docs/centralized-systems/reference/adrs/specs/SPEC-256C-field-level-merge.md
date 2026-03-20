# SPEC-256C: Field-Level Merge (Phase 3 — OPTIONAL)

> **Parent**: [ADR-256](../ADR-256-concurrency-conflict-analysis.md)
> **Priority**: P2 (OPTIONAL — luxury feature)
> **Effort**: ~4 days
> **Prerequisites**: SPEC-256A (Optimistic Versioning) + SPEC-256B (Stale Data Detection)
> **Status**: 📋 PLANNED

---

## Problem

Με Phase 1+2, ο χρήστης ξέρει ότι υπάρχει conflict αλλά η επιλογή είναι binary: **Reload ΟΛΑ ή Force Save ΟΛΑ**. Αν User A άλλαξε `address` και User B άλλαξε `phone`, δεν υπάρχει conflict — αλλά το Phase 1 τους αντιμετωπίζει σαν conflict γιατί βλέπει μόνο `_v` mismatch.

---

## Goal

Αυτόματη επίλυση non-conflicting field changes + manual resolution **μόνο** για πραγματικά per-field conflicts. Pattern: Git three-way merge σε document level.

---

## When to Implement

Phase 3 είναι **luxury** — **ΟΧΙ** απαραίτητο για production safety. Υλοποίηση μόνο αν:
- Phase 1+2 δουλεύουν σταθερά σε production
- Υπάρχουν πραγματικά user complaints για unnecessary conflicts
- Η εφαρμογή έχει 10+ concurrent users στα ίδια documents

Η πλειονότητα των εφαρμογών (ακόμα και Google Contacts, Salesforce) χρησιμοποιεί Phase 1+2 μόνο.

---

## Existing Infrastructure

| Σύστημα | Path | Ρόλος |
|---------|------|-------|
| `withVersionCheck` | `src/lib/firestore/version-check.ts` (SPEC-256A) | Transaction wrapper — extend to return conflict data |
| `ConflictDialog` | `src/components/ui/conflict-dialog.tsx` (SPEC-256A) | Replace with `ConflictResolutionDialog` for field-level |
| `useVersionedSave` | `src/hooks/useVersionedSave.ts` (SPEC-256A) | Extend with `baseSnapshotRef` for three-way comparison |
| `useDocumentSync` | `src/hooks/useDocumentSync.ts` (SPEC-256B) | Provides real-time server data |

---

## New Files (4)

### 1. `src/lib/merge/merge-types.ts` — Type Definitions

```typescript
/**
 * Field-level merge status for a single field in a three-way merge.
 */
export type FieldMergeStatus =
  | 'unchanged'     // Base === Mine === Theirs — no change
  | 'mine-only'     // Only I changed this field — auto-resolve to mine
  | 'theirs-only'   // Only they changed this field — auto-resolve to theirs
  | 'both-same'     // Both changed to the same value — auto-resolve
  | 'conflict';     // Both changed to different values — manual resolution required

/**
 * Detail for a single field in the merge.
 */
export interface FieldMergeDetail {
  field: string;
  status: FieldMergeStatus;
  base: unknown;       // Value when both users loaded the document
  mine: unknown;       // Current user's value
  theirs: unknown;     // Other user's value (from server)
  resolved?: unknown;  // Final resolved value (set by auto-resolve or user choice)
}

/**
 * Complete result of a three-way merge operation.
 */
export interface MergeResult<T> {
  /** Auto-merged document (conflicts use base values as placeholders) */
  merged: Partial<T>;
  /** Fields that were auto-resolved (no user intervention needed) */
  autoResolved: FieldMergeDetail[];
  /** Fields that require manual resolution */
  conflicts: FieldMergeDetail[];
  /** Whether there are any unresolved conflicts */
  hasConflicts: boolean;
  /** Total fields compared */
  totalFields: number;
}
```

### 2. `src/lib/merge/three-way-merge.ts` — Merge Engine

```typescript
import type { MergeResult, FieldMergeDetail, FieldMergeStatus } from './merge-types';

/**
 * Three-way merge engine for Firestore documents.
 *
 * Compares three versions of a document:
 * - base: The version both users loaded (snapshot at read time)
 * - mine: The current user's modified version (local state)
 * - theirs: The server's current version (from 409 response or onSnapshot)
 *
 * Algorithm (per top-level field):
 *
 * 1. base[f] === mine[f] === theirs[f]  → UNCHANGED (skip)
 * 2. base[f] !== mine[f] && base[f] === theirs[f] → MINE-ONLY (auto-resolve to mine)
 * 3. base[f] === mine[f] && base[f] !== theirs[f] → THEIRS-ONLY (auto-resolve to theirs)
 * 4. mine[f] === theirs[f]                        → BOTH-SAME (auto-resolve)
 * 5. mine[f] !== theirs[f]                        → CONFLICT (manual resolution)
 *
 * Comparison uses deep equality (JSON.stringify for objects/arrays).
 * System fields (_v, updatedAt, updatedBy, createdAt) are excluded.
 *
 * @param base - Snapshot when the user loaded the document
 * @param mine - Current user's local state
 * @param theirs - Server's current state
 * @returns MergeResult with auto-resolved fields and conflicts
 */
export function threeWayMerge<T extends Record<string, unknown>>(
  base: T,
  mine: T,
  theirs: T
): MergeResult<T> {
  // Implementation outline:
  //
  // 1. Collect all unique top-level keys from base, mine, theirs
  // 2. Filter out system fields: _v, updatedAt, updatedBy, createdAt, createdBy
  // 3. For each field, determine FieldMergeStatus using algorithm above
  // 4. Auto-resolved fields → apply to merged document
  // 5. Conflicts → keep base value in merged, add to conflicts array
  // 6. Return MergeResult
  //
  // Deep equality helper:
  //   function deepEqual(a: unknown, b: unknown): boolean {
  //     return JSON.stringify(a) === JSON.stringify(b);
  //   }
  //
  // Performance: O(n) where n = number of top-level fields (typically <50)
}

/** System fields excluded from merge comparison */
const SYSTEM_FIELDS = new Set([
  '_v', 'updatedAt', 'updatedBy', 'createdAt', 'createdBy', 'companyId',
]);
```

### 3. `src/components/ui/conflict-resolution-dialog.tsx` — Per-Field Resolution UI

```typescript
/**
 * Advanced conflict resolution dialog with per-field radio buttons.
 * Replaces simple ConflictDialog when Phase 3 is enabled.
 *
 * UI mockup:
 * ┌──────────────────────────────────────────────────────────────┐
 * │  🔀 Σύγκρουση αλλαγών — 2 πεδία χρειάζονται επίλυση         │
 * │                                                              │
 * │  ✅ Auto-resolved (3 πεδία):                                 │
 * │     address (μόνο εσείς), phone (μόνο εσείς), area (μόνο    │
 * │     άλλος χρήστης)                                           │
 * │                                                              │
 * │  ⚠️ Conflict: name                                           │
 * │  ├─ Αρχική τιμή: "Anna S."                                  │
 * │  ├─ ○ Δική σας: "Anna Smith"                                 │
 * │  └─ ○ Άλλου χρήστη: "Anna Doe"                               │
 * │                                                              │
 * │  ⚠️ Conflict: email                                          │
 * │  ├─ Αρχική τιμή: "anna@old.com"                              │
 * │  ├─ ○ Δική σας: "anna@smith.com"                             │
 * │  └─ ○ Άλλου χρήστη: "anna@doe.com"                           │
 * │                                                              │
 * │  [Αποθήκευση επιλογών]  [Ακύρωση]                            │
 * └──────────────────────────────────────────────────────────────┘
 *
 * Props:
 * - mergeResult: MergeResult<T> — from threeWayMerge()
 * - fieldLabels: Record<string, string> — human-readable field names (i18n)
 * - onResolve: (resolvedData: Partial<T>) => void — applies merged + user choices
 * - onCancel: () => void
 *
 * Behavior:
 * - Auto-resolved fields shown as collapsed list (informational)
 * - Each conflict field shows base/mine/theirs with radio buttons
 * - "Αποθήκευση" enabled only when ALL conflicts have a selection
 * - onResolve builds final merged document from auto-resolved + user choices
 *
 * Uses: shadcn/ui Dialog, RadioGroup, Badge, Separator
 * i18n: el/en keys (conflict resolution messages)
 */
```

### 4. `src/hooks/useConflictResolution.ts` — State Management

```typescript
/**
 * Hook managing the three-way merge state for a form.
 *
 * Responsibilities:
 * - Stores baseSnapshot (captured at initial data load)
 * - On 409 conflict: runs threeWayMerge(base, mine, theirs)
 * - If no real conflicts (all auto-resolved): applies merge silently, retries save
 * - If conflicts exist: opens ConflictResolutionDialog
 * - After user resolves: applies merged data, updates version, retries save
 *
 * Integration with useVersionedSave:
 * - Extends useVersionedSave with baseSnapshotRef
 * - Overrides onConflict to trigger three-way merge instead of simple dialog
 */

import { useRef, useState, useCallback } from 'react';
import { threeWayMerge } from '@/lib/merge/three-way-merge';
import type { MergeResult } from '@/lib/merge/merge-types';

interface UseConflictResolutionOptions<T> {
  /** Initial data loaded from server (becomes base snapshot) */
  initialData: T;
  /** Current local state (mine) */
  currentData: T;
  /** Save function (from useVersionedSave) */
  save: (data: T, version: number) => Promise<{ newVersion: number }>;
}

interface UseConflictResolutionReturn<T> {
  /** Capture base snapshot — call when data is loaded */
  captureBase: (data: T) => void;
  /** Handle 409 conflict — runs three-way merge */
  handleConflict: (serverData: T, serverVersion: number) => void;
  /** Current merge result (null when no conflict) */
  mergeResult: MergeResult<T> | null;
  /** Whether resolution dialog should be shown */
  showResolutionDialog: boolean;
  /** Apply user's resolution choices */
  applyResolution: (resolvedData: Partial<T>) => void;
  /** Cancel resolution */
  cancelResolution: () => void;
}

export function useConflictResolution<T extends Record<string, unknown>>(
  options: UseConflictResolutionOptions<T>
): UseConflictResolutionReturn<T> {
  // Implementation outline:
  //
  // 1. baseSnapshotRef = useRef<T>(initialData) — captured at load time
  // 2. handleConflict(serverData, serverVersion):
  //    a. Run threeWayMerge(baseSnapshot, currentData, serverData)
  //    b. If !hasConflicts → auto-apply merged result → retry save with serverVersion
  //    c. If hasConflicts → set mergeResult state → show dialog
  // 3. applyResolution(resolvedData):
  //    a. Build final data from mergeResult.merged + user choices
  //    b. Retry save with server version
  //    c. Update baseSnapshot to new data
  //    d. Clear mergeResult
  // 4. captureBase(data): Updates baseSnapshotRef (on data reload)
}
```

---

## Integration with Existing Phase 1+2

### Feature Flag Pattern

Phase 3 can be enabled/disabled without code changes via `versioning-config.ts`:

```typescript
// In src/config/versioning-config.ts (SPEC-256A) — ADD:
export const VERSIONING_CONFIG = {
  // ... existing Phase 1 config ...

  /** Enable field-level merge (Phase 3). Set to false to use simple Reload/Force dialog. */
  FIELD_LEVEL_MERGE_ENABLED: false,  // Default OFF until stable
} as const;
```

### Conditional Behavior in useVersionedSave

```typescript
// In useVersionedSave onConflict handler:
if (VERSIONING_CONFIG.FIELD_LEVEL_MERGE_ENABLED) {
  // Phase 3: Three-way merge → ConflictResolutionDialog (per-field)
  handleConflict(serverData, serverVersion);
} else {
  // Phase 1: Simple ConflictDialog (Reload / Force Save)
  openConflictDialog(conflict);
}
```

### `baseSnapshotRef` in useVersionedSave

Phase 3 requires knowing the **base state** (what the document looked like when the user loaded it). This is stored as a ref:

```typescript
// In useVersionedSave — ADD for Phase 3:
const baseSnapshotRef = useRef<T | null>(null);

// Capture on initial load:
useEffect(() => {
  if (initialData) {
    baseSnapshotRef.current = structuredClone(initialData);
  }
}, [initialData]);
```

---

## Algorithm Deep Dive

### Three-Way Merge — Field Status Table

| base[f] | mine[f] | theirs[f] | Status | Action |
|---------|---------|-----------|--------|--------|
| A | A | A | `unchanged` | Skip (no change) |
| A | B | A | `mine-only` | Auto-resolve → B (mine) |
| A | A | C | `theirs-only` | Auto-resolve → C (theirs) |
| A | B | B | `both-same` | Auto-resolve → B (identical change) |
| A | B | C | `conflict` | Manual resolution required |

### Example Scenario

```
Base (loaded at T0):     { name: "Anna S.", phone: "123", email: "a@old.com" }
Mine (local changes):    { name: "Anna Smith", phone: "123", email: "a@new.com" }
Theirs (server at T5):   { name: "Anna Doe", phone: "456", email: "a@old.com" }

Three-way merge result:
  phone: THEIRS-ONLY → auto-resolve to "456" (only they changed it)
  email: MINE-ONLY → auto-resolve to "a@new.com" (only I changed it)
  name: CONFLICT → manual resolution: "Anna Smith" vs "Anna Doe"

Auto-merged (before manual): { name: "Anna S.", phone: "456", email: "a@new.com" }
After user picks "Anna Smith": { name: "Anna Smith", phone: "456", email: "a@new.com" }
```

---

## Edge Cases

### E1: Nested Objects

Top-level comparison only. Αν `address` είναι object (`{ street, city, zip }`), ολόκληρο το object θεωρείται ένα field. Deep merge μέσα σε nested objects **δεν γίνεται** — πολύ σύνθετο για V1.

### E2: Array Fields

Arrays θεωρούνται atomic values (same as nested objects). Αν `tags: ["a", "b"]` αλλάξει σε `["a", "c"]` από τον ένα και `["a", "d"]` από τον άλλο → conflict.

### E3: Field Deletion

Αν mine αφαιρεί ένα field (undefined) ενώ theirs το αλλάζει → conflict. Αν μόνο ένας αφαιρεί → auto-resolve.

### E4: New Fields

Αν mine προσθέτει νέο field που δεν υπήρχε στο base → `mine-only` (auto-resolve). Αν theirs προσθέτει νέο field → `theirs-only`.

---

## Testing Strategy

### Unit Tests for `threeWayMerge`

```typescript
describe('threeWayMerge', () => {
  it('returns empty conflicts when no changes');
  it('auto-resolves mine-only changes');
  it('auto-resolves theirs-only changes');
  it('auto-resolves both-same changes');
  it('detects true conflicts (both changed differently)');
  it('handles mixed auto-resolve and conflicts');
  it('excludes system fields (_v, updatedAt, updatedBy)');
  it('handles nested objects as atomic fields');
  it('handles array fields as atomic');
  it('handles field addition (not in base)');
  it('handles field deletion (undefined in mine/theirs)');
});
```

### Manual Testing

1. **Auto-resolve test**: User A changes address, User B changes phone → merge silently, no dialog
2. **Conflict test**: Both change name → ConflictResolutionDialog with radio buttons
3. **Mixed test**: 3 auto-resolved + 1 conflict → dialog shows both sections
4. **Feature flag off**: `FIELD_LEVEL_MERGE_ENABLED = false` → falls back to simple ConflictDialog

---

## Success Criteria

- [ ] `threeWayMerge` correctly classifies all 5 field statuses
- [ ] Auto-resolved fields applied silently (no user intervention)
- [ ] `ConflictResolutionDialog` shows only real per-field conflicts
- [ ] Feature flag works: `false` = Phase 1 behavior, `true` = Phase 3
- [ ] `baseSnapshotRef` correctly captures initial load state
- [ ] System fields excluded from comparison

---

## Why This Is OPTIONAL

| Consideration | Analysis |
|---------------|----------|
| Phase 1+2 coverage | Prevents ALL data loss (user always gets notified) |
| Real conflict frequency | In practice, concurrent edits of SAME field are rare (<5% of conflicts) |
| Implementation complexity | Three-way merge + per-field UI adds significant complexity |
| Industry standard | Google Contacts, Salesforce, HubSpot use Phase 1+2 only |
| Recommendation | Implement only if users report friction with Phase 1+2 binary choice |

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-20 | Initial SPEC — Phase 3 specification (OPTIONAL) | Claude Code |
