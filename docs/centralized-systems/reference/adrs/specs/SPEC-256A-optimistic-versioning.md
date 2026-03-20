# SPEC-256A: Optimistic Versioning (Phase 1)

> **Parent**: [ADR-256](../ADR-256-concurrency-conflict-analysis.md)
> **Priority**: P0 (CRITICAL)
> **Effort**: ~5 days
> **Status**: 📋 PLANNED

---

## Problem

85% των edit forms (29/34) χρησιμοποιούν last-write-wins — η τελευταία αποθήκευση κερδίζει σιωπηλά, ο πρώτος χρήστης χάνει τις αλλαγές του χωρίς καμία ειδοποίηση. Κανένα PATCH endpoint δεν ελέγχει αν το document άλλαξε μεταξύ read και write.

---

## Goal

Αποτροπή σιωπηλής απώλειας δεδομένων. Ο χρήστης **ενημερώνεται** για conflict και επιλέγει: Reload / Force Save / Cancel.

---

## Existing Infrastructure

| Σύστημα | Path | Ρόλος |
|---------|------|-------|
| `useAutoSave` | `src/hooks/useAutoSave.ts` | `versionRef` (γρ.99) — single-user race protection, extend with `_v` |
| `ApiError` | `src/lib/api/ApiErrorHandler.ts` (γρ.92) | 409 pattern support (γρ.233) |
| `AutoSaveConfig` | `src/types/auto-save.ts` | Extend with `onConflict` callback |
| Buildings PATCH | `src/app/api/buildings/route.ts` (γρ.272) | Prototype route for first migration |

---

## New Files (6)

### 1. `src/types/versioning.ts` — Type Definitions

```typescript
/**
 * Mixin interface — κάθε versioned document εκτείνει αυτό.
 * Lazy migration: documents χωρίς _v αντιμετωπίζονται ως _v: 0.
 */
export interface Versioned {
  _v: number;
  updatedAt: FirebaseFirestore.Timestamp;
  updatedBy?: string;
}

/**
 * Payload που στέλνει ο client στο PATCH endpoint.
 * Ο client ΠΡΕΠΕΙ να στέλνει _v — αλλιώς force-write (backward compat).
 */
export interface VersionedPatchPayload<T = Record<string, unknown>> {
  id: string;
  _v?: number;         // undefined = legacy client → force-write
  updates: Partial<T>;
}

/**
 * Body που επιστρέφει ο server σε 409 Conflict.
 */
export interface ConflictResponseBody {
  code: 'VERSION_CONFLICT';
  message: string;
  currentVersion: number;
  expectedVersion: number;
  updatedAt: string;       // ISO 8601
  updatedBy?: string;
}

/**
 * Options για withVersionCheck transaction wrapper.
 */
export interface VersionCheckOptions {
  /** Firestore Admin instance */
  db: FirebaseFirestore.Firestore;
  /** Collection name (from firestore-collections.ts) */
  collection: string;
  /** Document ID */
  docId: string;
  /** Version ο client νομίζει ότι έχει — undefined = force-write */
  expectedVersion?: number;
  /** Fields to update */
  updates: Record<string, unknown>;
  /** User ID for updatedBy */
  userId?: string;
}

/**
 * Return value από withVersionCheck.
 */
export interface VersionCheckResult {
  newVersion: number;
  docId: string;
}
```

### 2. `src/config/versioning-config.ts` — Constants

```typescript
export const VERSIONING_CONFIG = {
  /** Field name για version counter στα Firestore documents */
  VERSION_FIELD: '_v' as const,

  /** Default version για documents χωρίς _v field (lazy migration) */
  DEFAULT_VERSION: 0,

  /** HTTP status code για version conflict */
  CONFLICT_STATUS: 409,

  /** Error code στο response body */
  CONFLICT_CODE: 'VERSION_CONFLICT' as const,

  /** Collections που εξαιρούνται (append-only, create-only) */
  EXCLUDED_COLLECTIONS: [
    'audit_log',
    'communications',
    'attendance_events',
    'email_ingestion_queue',
    'ai_chat_history',
  ] as const,

  /** Collections για Phase 1 rollout (P0 + P1) */
  PHASE_1_COLLECTIONS: [
    'contacts',
    'sales_installments',
    'buildings',
    'opportunities',
    'units',
    'projects',
  ] as const,
} as const;
```

### 3. `src/lib/firestore/version-check.ts` — Transaction Wrapper

```typescript
import { FieldValue } from 'firebase-admin/firestore';
import { VERSIONING_CONFIG } from '@/config/versioning-config';
import type { VersionCheckOptions, VersionCheckResult, ConflictResponseBody } from '@/types/versioning';

/**
 * Custom error class for version conflicts.
 * Extends Error with structured conflict info for the API response.
 */
export class ConflictError extends Error {
  public readonly statusCode = VERSIONING_CONFIG.CONFLICT_STATUS;
  public readonly body: ConflictResponseBody;

  constructor(
    currentVersion: number,
    expectedVersion: number,
    updatedAt?: FirebaseFirestore.Timestamp,
    updatedBy?: string
  ) {
    super(`Version conflict: expected ${expectedVersion}, found ${currentVersion}`);
    this.name = 'ConflictError';
    this.body = {
      code: VERSIONING_CONFIG.CONFLICT_CODE,
      message: `Η εγγραφή τροποποιήθηκε από άλλο χρήστη (version ${currentVersion} vs expected ${expectedVersion})`,
      currentVersion,
      expectedVersion,
      updatedAt: updatedAt?.toDate().toISOString() ?? new Date().toISOString(),
      updatedBy,
    };
  }
}

/**
 * Wraps a Firestore update in a transaction with version checking.
 *
 * - Reads current _v inside transaction
 * - Compares with expectedVersion
 * - If match → increments _v, applies updates
 * - If mismatch → throws ConflictError (409)
 * - If expectedVersion is undefined → force-write (backward compat for legacy clients)
 *
 * @throws {ConflictError} when version mismatch detected
 */
export async function withVersionCheck(
  options: VersionCheckOptions
): Promise<VersionCheckResult> {
  const { db, collection, docId, expectedVersion, updates, userId } = options;
  const docRef = db.collection(collection).doc(docId);

  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(docRef);

    if (!snapshot.exists) {
      throw new Error(`Document ${collection}/${docId} not found`);
    }

    const data = snapshot.data()!;
    const currentVersion = data[VERSIONING_CONFIG.VERSION_FIELD] ?? VERSIONING_CONFIG.DEFAULT_VERSION;

    // Backward compat: client χωρίς _v στο payload → force-write (no version check)
    if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
      throw new ConflictError(
        currentVersion,
        expectedVersion,
        data.updatedAt,
        data.updatedBy
      );
    }

    const newVersion = currentVersion + 1;
    tx.update(docRef, {
      ...updates,
      [VERSIONING_CONFIG.VERSION_FIELD]: newVersion,
      updatedAt: FieldValue.serverTimestamp(),
      ...(userId ? { updatedBy: userId } : {}),
    });

    return { newVersion, docId };
  });
}
```

### 4. `src/hooks/useVersionedSave.ts` — Client Hook

```typescript
/**
 * Hook που επεκτείνει το useAutoSave pattern με _v tracking.
 *
 * - Κρατάει local _v reference
 * - Στέλνει _v μαζί με κάθε save request
 * - Ενημερώνει _v μετά από successful save
 * - Καλεί onConflict callback σε 409 response
 * - Παρέχει isConflicted state για UI
 */

import { useRef, useState, useCallback } from 'react';
import type { ConflictResponseBody } from '@/types/versioning';

interface UseVersionedSaveOptions<T> {
  /** API save function — πρέπει να στέλνει _v στο request body */
  saveFn: (data: T, version: number) => Promise<{ newVersion: number }>;
  /** Initial _v from fetched document (default: 0 for legacy docs) */
  initialVersion: number;
  /** Callback on 409 conflict — receives server conflict info */
  onConflict: (conflict: ConflictResponseBody) => void;
}

interface UseVersionedSaveReturn<T> {
  /** Current tracked version */
  version: number;
  /** Whether a conflict has been detected */
  isConflicted: boolean;
  /** Save with version check — wraps saveFn with conflict handling */
  save: (data: T) => Promise<boolean>;
  /** Reset conflict state (after user resolves via dialog) */
  resetConflict: () => void;
  /** Force update version (after reload/force-save) */
  setVersion: (v: number) => void;
}

export function useVersionedSave<T>(options: UseVersionedSaveOptions<T>): UseVersionedSaveReturn<T> {
  // Implementation:
  // 1. useRef for versionRef (same pattern as useAutoSave γρ.99)
  // 2. useState for isConflicted flag
  // 3. save() wraps saveFn, catches 409, parses ConflictResponseBody
  // 4. On success: updates versionRef to newVersion
  // 5. On 409: sets isConflicted=true, calls onConflict callback
  // 6. resetConflict() clears the flag (called after dialog action)
  // 7. setVersion() for forced reload scenarios
}
```

### 5. `src/components/ui/conflict-dialog.tsx` — Conflict Resolution Modal

```typescript
/**
 * Modal dialog εμφανίζεται σε 409 Conflict response.
 *
 * UI mockup:
 * ┌─────────────────────────────────────────────┐
 * │  ⚠️  Αυτή η εγγραφή τροποποιήθηκε         │
 * │                                             │
 * │  Ένας άλλος χρήστης τροποποίησε αυτή        │
 * │  την εγγραφή ενώ την επεξεργαζόσασταν.      │
 * │                                             │
 * │  Τελευταία αλλαγή: {updatedBy} ({timeAgo})  │
 * │                                             │
 * │  [Ανανέωση δεδομένων]  [Αντικατάσταση]      │
 * └─────────────────────────────────────────────┘
 *
 * Actions:
 * - "Ανανέωση δεδομένων" (Reload): Fetch fresh data, discard local changes
 * - "Αντικατάσταση" (Force Save): Re-save with current server version
 * - "Ακύρωση" (Cancel): Close dialog, keep local changes, pause auto-save
 *
 * Props:
 * - conflict: ConflictResponseBody
 * - onReload: () => void — fetches fresh data
 * - onForceSave: () => void — re-sends save with server's _v
 * - onCancel: () => void — closes dialog
 *
 * Uses: shadcn/ui Dialog, AlertTriangle icon from lucide-react
 * i18n: el/en via existing i18n system
 */
```

### 6. Integration: Extend `src/types/auto-save.ts`

```typescript
// ADD to existing AutoSaveConfig interface:
interface AutoSaveConfig<T> {
  // ... existing fields ...

  /** Called on 409 version conflict — receives server data and version */
  onConflict?: (serverData: T, serverVersion: number) => void;
}
```

---

## Modified Files (12 API Routes)

### Migration Pattern

Κάθε PATCH endpoint μετατρέπεται από:

```typescript
// ❌ BEFORE — Vulnerable (no version check)
await adminDb.collection(COL).doc(id).update({
  ...cleanUpdates,
  updatedAt: FieldValue.serverTimestamp(),
});
return NextResponse.json({ success: true });
```

Σε:

```typescript
// ✅ AFTER — Version-checked transaction
import { withVersionCheck, ConflictError } from '@/lib/firestore/version-check';

try {
  const result = await withVersionCheck({
    db: adminDb,
    collection: COL,
    docId: id,
    expectedVersion: body._v,  // undefined = force-write (backward compat)
    updates: cleanUpdates,
    userId: session.uid,
  });
  return NextResponse.json({ success: true, _v: result.newVersion });
} catch (error) {
  if (error instanceof ConflictError) {
    return NextResponse.json(error.body, { status: error.statusCode });
  }
  throw error;
}
```

### Routes to Migrate (Rollout Order)

| Priority | API Route | Collection | Effort |
|----------|-----------|------------|--------|
| P0 | `src/app/api/contacts/route.ts` (PATCH) | `contacts` | 30 min |
| P0 | `src/app/api/contacts/[id]/route.ts` (PATCH) | `contacts` | 30 min |
| P0 | `src/app/api/installments/route.ts` (PATCH) | `sales_installments` | 30 min |
| P1 | `src/app/api/buildings/route.ts` (PATCH) | `buildings` | 30 min |
| P1 | `src/app/api/opportunities/route.ts` (PATCH) | `opportunities` | 30 min |
| P1 | `src/app/api/projects/[id]/route.ts` (PATCH) | `projects` | 30 min |
| P2 | `src/app/api/units/route.ts` (PATCH) | `units` | 30 min |
| P2 | `src/app/api/floors/route.ts` (PATCH) | `floors` | 30 min |
| P2 | `src/app/api/tasks/route.ts` (PATCH) | `tasks` | 30 min |
| P3 | `src/app/api/parking/route.ts` (PATCH) | `parking_spots` | 30 min |
| P3 | `src/app/api/storages/route.ts` (PATCH) | `storage_units` | 30 min |
| P3 | `src/app/api/bank-accounts/route.ts` (PATCH) | `contact_bank_accounts` | 30 min |

---

## Key Design Decisions

### D1: `_v: number` — Lazy Migration

- Documents χωρίς `_v` field → αντιμετωπίζονται ως `_v: 0`
- Πρώτο versioned write → sets `_v: 1`
- Zero downtime, zero migration script, zero batch operations
- Ίδιο pattern με ADR-251 migrate-on-touch

### D2: Backward Compatibility

- Client στέλνει `_v` στο PATCH body → version check ενεργοποιείται
- Client ΔΕΝ στέλνει `_v` (legacy) → force-write χωρίς check
- Αυτό επιτρέπει incremental rollout — δεν χρειάζεται big-bang migration

### D3: 409 HTTP Response

- Standard HTTP semantics (RFC 7231 §6.5.8)
- Structured `ConflictResponseBody` με `currentVersion`, `updatedBy`, `updatedAt`
- Client parses και εμφανίζει `ConflictDialog`

### D4: Transaction Scope

- `withVersionCheck` wraps **μόνο** το document update σε transaction
- ΔΕΝ αλλάζει upstream business logic (sanitization, validation, auth checks)
- Minimal blast radius — αν σπάσει, fallback σε direct update

---

## Rollback Strategy

Αν η Phase 1 δημιουργήσει προβλήματα:

1. **Client rollback**: Αφαίρεσε `_v` από PATCH bodies → force-write ξανά
2. **Server rollback**: Αλλαγή `withVersionCheck` σε passthrough (skip version comparison)
3. **Data cleanup**: `_v` fields στα documents δεν χρειάζεται να αφαιρεθούν (harmless)

---

## Testing Strategy

### Unit Tests

```typescript
describe('withVersionCheck', () => {
  it('succeeds when version matches');
  it('throws ConflictError on version mismatch');
  it('handles missing _v as version 0 (lazy migration)');
  it('increments _v on successful write');
  it('force-writes when expectedVersion is undefined (backward compat)');
  it('throws when document does not exist');
  it('includes updatedBy in conflict response');
});
```

### Manual Testing Scenarios

1. **Two-tab test**: Άνοιξε ίδια επαφή σε 2 tabs → αλλαγή name → save σε tab A → save σε tab B → ConflictDialog εμφανίζεται
2. **Reload action**: ConflictDialog → "Ανανέωση" → form γεμίζει με fresh data
3. **Force save action**: ConflictDialog → "Αντικατάσταση" → save επιτυχής με νέα version
4. **Legacy client**: Request χωρίς `_v` → force-write (no dialog)
5. **Lazy migration**: Document χωρίς `_v` → first save γράφει `_v: 1`

---

## Success Criteria

- [ ] `withVersionCheck` deployed σε 12 PATCH routes
- [ ] `ConflictDialog` εμφανίζεται σε 409
- [ ] Zero data loss σε concurrent edit scenarios
- [ ] Backward compatible — legacy clients λειτουργούν κανονικά
- [ ] `_v` field γράφεται σε κάθε versioned save

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-20 | Initial SPEC — Phase 1 specification | Claude Code |
