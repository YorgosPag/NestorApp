# ADR-256: Concurrency Conflict Analysis & Remediation Roadmap

| Metadata | Value |
|----------|-------|
| **Status** | DOCUMENTED |
| **Date** | 2026-03-20 |
| **Category** | Data & State / Security |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Executive Summary

Πλήρης ανάλυση ταυτόχρονης επεξεργασίας (concurrency conflicts) σε ΟΛΗ την εφαρμογή.

### Ευρήματα

- **85% των edit forms (29/34)** δεν έχουν ΚΑΜΙΑ προστασία ταυτόχρονης επεξεργασίας
- **Last-write-wins**: η τελευταία αποθήκευση κερδίζει σιωπηλά — ο πρώτος χρήστης χάνει τις αλλαγές του χωρίς ειδοποίηση
- **Κανένα version field**, κανένας conflict dialog, κανένα real-time warning στα edit forms
- **`updatedAt`** υπάρχει σε κάθε document αλλά ΠΟΤΕ δεν ελέγχεται πριν το save
- **Firestore transactions** χρησιμοποιούνται ΜΟΝΟ σε pipeline queue + relationship engine — ΟΧΙ στα business entity updates

### Εκτίμηση Κινδύνου

| Μέτρηση | Τιμή |
|---------|------|
| Ευάλωτα forms | 29/34 (85%) |
| Ευάλωτες collections | 12+ |
| Κίνδυνος σε development (<5 users) | 🟡 Χαμηλός |
| Κίνδυνος σε production (10+ users) | 🔴 Υψηλός |
| Data loss probability (concurrent edit) | ~100% (last-write-wins) |

---

## 2. Τρέχουσα Αρχιτεκτονική — Τι ΥΠΑΡΧΕΙ

### 2.1 `updatedAt` timestamp

Κάθε business entity document περιέχει `updatedAt` (Firestore `serverTimestamp()`). Ωστόσο, **κανένα** PATCH endpoint δεν ελέγχει αν το `updatedAt` έχει αλλάξει μεταξύ read και write.

**Pattern στα API routes (representative — `buildings/route.ts` γρ.224-273):**
```
1. Parse request body
2. Read document (get ownership check)
3. Sanitize updates
4. adminDb.collection(...).doc(id).update({...updates, updatedAt: serverTimestamp()})
```

Δεν υπάρχει transaction, δεν ελέγχεται version ή timestamp.

### 2.2 `useAutoSave` (ADR-248)

**Path**: `src/hooks/useAutoSave.ts`

Παρέχει race condition protection μόνο **για τον ΙΔΙΟ χρήστη** (single-tab):
- `versionRef` (γρ.99): αυξάνει σε κάθε save, απορρίπτει stale saves
- Debounce + deep equality check → αποτρέπει duplicate saves
- Flush on unmount → αποτρέπει data loss σε navigation

**ΔΕΝ καλύπτει**: Δύο χρήστες στο ίδιο document ταυτόχρονα.

### 2.3 `OptimisticUpdateManager`

**Path**: `src/services/entity-linking/utils/optimistic.ts`

Σχεδιασμένο για entity linking operations (link/unlink), ΟΧΙ για γενικά edit forms. Υποστηρίζει optimistic UI updates + rollback on failure.

### 2.4 `RealtimeService` (ADR-055)

**Path**: `src/services/realtime/RealtimeService.ts`

- 55+ event types, full event dispatcher
- `subscribeToDocument()` (γρ.128-176): Firestore `onSnapshot` listener σε single document
- **Κανένα edit form** δεν κάνει subscribe σε document changes κατά τη διάρκεια editing
- Χρησιμοποιείται ΜΟΝΟ για list views (real-time updates σε λίστες)

### 2.5 `onSnapshot` Usage

- 50+ αρχεία χρησιμοποιούν `onSnapshot`
- ΟΛΕΣ οι χρήσεις αφορούν **collection queries** (λίστες), ΟΧΙ document-level watching σε edit forms

### 2.6 Firestore Transactions

Χρησιμοποιούνται ΜΟΝΟ σε:
- Pipeline queue (`claimNextQueueItems`) — deduplication
- Relationship engine (ADR-228) — cascade operations
- **ΟΧΙ** σε business entity PATCH endpoints

### 2.7 `CacheProvider`

**Path**: `src/contexts/CacheProvider.tsx`

SWR-like cache με TTL. Δεν κάνει conflict detection — αν δύο tabs κάνουν update, ο cache αντικαθίσταται σιωπηλά.

---

## 3. Πλήρης Κατάλογος Ευάλωτων Forms

### 3.1 🔴 CRITICAL — Κανένα protection (12 forms)

| # | Form Component | Collection | Τι κινδυνεύει |
|---|---------------|------------|---------------|
| 1 | `GeneralTabContent` (buildings) | `buildings` | Address, area, building details — full overwrite |
| 2 | `UnitsTabContent` | `units` | Unit data, pricing, status |
| 3 | `ParkingTabContent` | `parking_spots` | Parking assignments, prices |
| 4 | `FloorsTabContent` | `floors` | Floor details, plan assignments |
| 5 | `StorageForm` | `storage_units` | Storage unit data |
| 6 | `ContactDetails` | `contacts` | Contact info — name, phone, email |
| 7 | `UnitFieldsBlock` | `units` | Individual unit field edits |
| 8 | `EditContactDialog` | `contacts` | Contact edit dialog (modal) |
| 9 | `EditOpportunityModal` | `opportunities` | Opportunity status, values |
| 10 | `TaskEditDialog` | `tasks` | Task assignments, due dates |
| 11 | `EditInstallmentDialog` | `sales_installments` | Payment amounts, dates |
| 12 | `BankAccountForm` | `contact_bank_accounts` | Bank account details |

### 3.2 🟠 HIGH — Μερική προστασία (5 forms)

| # | Form Component | Τι έχει | Τι λείπει |
|---|---------------|---------|-----------|
| 1 | `TabbedAddNewContactDialog` | Safe create path | Edit path χωρίς versioning |
| 2 | `ContactBankingTab` | Validation | No concurrent edit protection |
| 3 | `RelationshipForm` | Entity linking transactions | Edit fields unprotected |
| 4 | `CreateTaskModal` | Safe create | Edit mode unprotected |
| 5 | `LineItemsEditor` | Local state management | Server sync unprotected |

### 3.3 🟢 LOW — Ελάχιστος κίνδυνος (14 forms)

| # | Form Component | Γιατί χαμηλός κίνδυνος |
|---|---------------|----------------------|
| 1 | `InvoiceForm` | Append-only (create new) |
| 2 | `JournalEntryForm` | Append-only |
| 3 | `AddAssetForm` | Create-only |
| 4 | `UploadDocumentDialog` | File upload — no edit |
| 5 | `CreateProjectDialog` | Create-only |
| 6 | `CreateBuildingForm` | Create-only |
| 7 | `AddUnitDialog` | Create-only |
| 8 | `AddFloorDialog` | Create-only |
| 9 | `AddParkingDialog` | Create-only |
| 10 | `AddStorageDialog` | Create-only |
| 11 | `ComposeEmailDialog` | Create-only (sends email) |
| 12 | `NewCommunicationForm` | Append-only (log entry) |
| 13 | `AddAppointmentDialog` | Create-only |
| 14 | `QrCodePanel` | Config — single admin use |

### 3.4 Ευάλωτες Firestore Collections

| Collection | Forms που γράφουν | Concurrent edit risk |
|-----------|-------------------|---------------------|
| `buildings` | GeneralTabContent, FloorsTabContent | 🔴 HIGH |
| `contacts` | ContactDetails, EditContactDialog, ContactBankingTab | 🔴 HIGH |
| `units` | UnitsTabContent, UnitFieldsBlock | 🔴 HIGH |
| `opportunities` | EditOpportunityModal | 🔴 HIGH |
| `tasks` | TaskEditDialog, CreateTaskModal | 🟠 MEDIUM |
| `parking_spots` | ParkingTabContent | 🟠 MEDIUM |
| `floors` | FloorsTabContent | 🟠 MEDIUM |
| `storage_units` | StorageForm | 🟠 MEDIUM |
| `sales_installments` | EditInstallmentDialog | 🔴 HIGH (financial) |
| `contact_bank_accounts` | BankAccountForm | 🔴 HIGH (financial) |
| `projects` | ProjectDetailsTab | 🟠 MEDIUM |
| `sales` | SalesForm | 🔴 HIGH (financial) |

---

## 4. Σενάρια Σύγκρουσης

### Σενάριο 1: Contact Name Edit Conflict

```
Χρόνος    User A (Tab 1)              User B (Tab 2)              Firestore
─────────────────────────────────────────────────────────────────────────────
T0        Ανοίγει contact "Anna S."   Ανοίγει contact "Anna S."   name: "Anna S."
T1        Αλλάζει → "Anna Smith"      —                           name: "Anna S."
T2        —                           Αλλάζει → "Anna Doe"        name: "Anna S."
T3        SAVE (auto-save)            —                           name: "Anna Smith" ✅
T4        —                           SAVE (auto-save)            name: "Anna Doe" ⚠️
─────────────────────────────────────────────────────────────────────────────
Αποτέλεσμα: Η αλλαγή του User A χάθηκε σιωπηλά. Κανείς δεν ενημερώθηκε.
```

### Σενάριο 2: Building Property Split-Edit

```
User A επεξεργάζεται address → SAVE (full object overwrite)
User B επεξεργάζεται area → SAVE (full object overwrite)

Αποτέλεσμα: Η αλλαγή address του User A χάθηκε, γιατί ο User B
έστειλε ολόκληρο το object με το ΠΑΛΙΟ address.
```

### Σενάριο 3: Entity Deletion During Edit

```
User A: Ανοίγει unit #42 για edit
User B: Διαγράφει unit #42
User A: Πατάει Save → 404 error ή ghost document recreation
```

### Σενάριο 4: Cascade Race Condition

```
User A: Αλλάζει contact name → triggers cascade (ADR-228)
User B: Αλλάζει contact email (ΔΕΝ trigger cascade)

Αν τρέξουν ταυτόχρονα: cascade μπορεί να γράψει πάνω στο email update
γιατί ο cascade denormalizer κάνει read-modify-write χωρίς version check.
```

---

## 5. Root Cause Analysis

### 5.1 API PATCH Pattern (ΟΛΑ τα endpoints)

```typescript
// CURRENT PATTERN — Vulnerable
const doc = await adminDb.collection(COL).doc(id).get();  // READ
// ... tenant check, sanitization ...
await adminDb.collection(COL).doc(id).update({             // WRITE
  ...cleanUpdates,
  updatedAt: FieldValue.serverTimestamp(),
});
```

**Πρόβλημα**: Μεταξύ READ και WRITE, άλλος χρήστης μπορεί να κάνει WRITE. Δεν υπάρχει transaction ή version check.

### 5.2 Απουσία `_v` (version) field

Κανένα business entity δεν έχει version field. Χωρίς αυτό, είναι αδύνατο να εντοπίσεις αν το document άλλαξε μετά το τελευταίο read.

### 5.3 Forms φορτώνουν data μία φορά

Τα edit forms κάνουν fetch κατά το mount και δεν ξαναελέγχουν. Αν το document αλλάξει ενώ ο χρήστης είναι στο form, δεν ειδοποιείται.

### 5.4 Full-object overwrite

Πολλά forms στέλνουν ΟΛΟ το object στο PATCH, ακόμα κι αν ο χρήστης άλλαξε μόνο 1 field. Αυτό σημαίνει ότι fields που ΔΕΝ άγγιξε ο χρήστης γράφονται πίσω με stale values.

### 5.5 Firestore rules δεν βοηθούν

Τα API routes χρησιμοποιούν Admin SDK, που παρακάμπτει τα Firestore Security Rules. Ο version check πρέπει να γίνει στον application layer.

---

## 6. Remediation Roadmap

### Phase 1: Optimistic Versioning (Εκτίμηση: 3-4 ημέρες)

**Στόχος**: Αποτροπή σιωπηλής απώλειας δεδομένων — ο χρήστης ενημερώνεται για conflict.

#### 1.1 Version Field (`_v: number`)

```typescript
// Lazy migration — πρώτο write σε document χωρίς _v γράφει _v: 1
interface VersionedDocument {
  _v: number;  // Increment on every write
  updatedAt: Timestamp;
  updatedBy?: string;
}
```

**Backward compatible**: Documents χωρίς `_v` αντιμετωπίζονται ως `_v: 0`.

#### 1.2 `withVersionCheck` — Server Middleware

```typescript
// Wraps PATCH update σε Firestore Transaction
async function withVersionCheck(
  db: FirebaseFirestore.Firestore,
  collection: string,
  docId: string,
  expectedVersion: number,
  updates: Record<string, unknown>
): Promise<{ newVersion: number }> {
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(db.collection(collection).doc(docId));
    const currentVersion = doc.data()?._v ?? 0;

    if (currentVersion !== expectedVersion) {
      throw new ApiError(409, 'Document modified by another user', {
        currentVersion,
        expectedVersion,
        updatedAt: doc.data()?.updatedAt,
        updatedBy: doc.data()?.updatedBy,
      });
    }

    const newVersion = currentVersion + 1;
    tx.update(doc.ref, {
      ...updates,
      _v: newVersion,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { newVersion };
  });
}
```

#### 1.3 `useVersionedSave` — Client Hook

```typescript
// Client-side: tracks _v, sends with save, handles 409
function useVersionedSave<T>(options: {
  saveFn: (data: T, version: number) => Promise<{ newVersion: number }>;
  initialVersion: number;
  onConflict: (serverVersion: number) => void;
}): VersionedSaveReturn<T>;
```

#### 1.4 `ConflictDialog` — UI Component

```
┌─────────────────────────────────────────────┐
│  ⚠️  Αυτή η εγγραφή τροποποιήθηκε         │
│                                             │
│  Ένας άλλος χρήστης τροποποίησε αυτή        │
│  την εγγραφή ενώ την επεξεργαζόσασταν.      │
│                                             │
│  Τελευταία αλλαγή: Γιώργος Π. (πριν 2')    │
│                                             │
│  [Ανανέωση δεδομένων]  [Αντικατάσταση]      │
└─────────────────────────────────────────────┘
```

#### 1.5 Rollout Strategy

Incremental — **migrate-on-touch** (ίδιο pattern με ADR-251):
1. Πρώτα τα 🔴 CRITICAL forms (12)
2. Μετά τα 🟠 HIGH forms (5)
3. Τα 🟢 LOW forms δεν χρειάζονται (append-only)

### Phase 2: Stale Data Detection (Εκτίμηση: 2-3 ημέρες)

**Στόχος**: Real-time ειδοποίηση ότι το document άλλαξε ενώ ο χρήστης κάνει edit.

#### 2.1 `useDocumentSync` Hook

```typescript
// Αξιοποιεί existing RealtimeService.subscribeToDocument()
function useDocumentSync(options: {
  collection: string;
  documentId: string;
  enabled: boolean;
  onExternalChange: (newData: Record<string, unknown>, changedBy?: string) => void;
}): { isStale: boolean; lastExternalUpdate: Date | null };
```

#### 2.2 `StaleDataBanner` Component

```
┌──────────────────────────────────────────────────────────────┐
│ ⚠️ Αυτή η εγγραφή τροποποιήθηκε από άλλο χρήστη. [Ανανέωση] │
└──────────────────────────────────────────────────────────────┘
```

Κίτρινη μπάρα πάνω από το form. Εμφανίζεται μόνο αν ο χρήστης ΔΕΝ έχει unsaved changes. Αν έχει unsaved changes → trigger ConflictDialog αντί banner.

#### 2.3 Integration με `useAutoSave`

```typescript
// Νέο callback στο AutoSaveConfig
interface AutoSaveConfig<T> {
  // ... existing fields ...
  onConflict?: (serverData: T, serverVersion: number) => void;
}
```

### Phase 3: Field-Level Merge — Advanced (Εκτίμηση: 4-5 ημέρες)

**Στόχος**: Αυτόματη επίλυση non-conflicting field changes, manual resolution μόνο για πραγματικά conflicts.

#### 3.1 Three-Way Merge Engine

```typescript
interface MergeResult<T> {
  merged: T;                              // Auto-merged result
  conflicts: Array<{
    field: string;
    base: unknown;    // Original value (when both users loaded)
    mine: unknown;    // Current user's change
    theirs: unknown;  // Other user's change
  }>;
  autoResolved: string[];  // Fields auto-merged (no conflict)
}

function threeWayMerge<T>(base: T, mine: T, theirs: T): MergeResult<T>;
```

#### 3.2 `ConflictResolutionDialog`

```
┌──────────────────────────────────────────────────────────────┐
│  🔀 Σύγκρουση αλλαγών — 2 πεδία χρειάζονται επίλυση         │
│                                                              │
│  ✅ Auto-resolved: address, phone (μόνο εσείς αλλάξατε)      │
│                                                              │
│  ⚠️ Conflict: name                                           │
│  ├─ Αρχική τιμή: "Anna S."                                  │
│  ├─ Δική σας: "Anna Smith"  ○                                │
│  └─ Άλλου χρήστη: "Anna Doe"  ○                              │
│                                                              │
│  ⚠️ Conflict: email                                          │
│  ├─ Αρχική τιμή: "anna@old.com"                              │
│  ├─ Δική σας: "anna@smith.com"  ○                            │
│  └─ Άλλου χρήστη: "anna@doe.com"  ○                          │
│                                                              │
│  [Αποθήκευση επιλογών]                                       │
└──────────────────────────────────────────────────────────────┘
```

#### 3.3 Πότε χρειάζεται Phase 3

Phase 3 είναι **luxury** — η πλειονότητα των εφαρμογών (ακόμα και Google Contacts) χρησιμοποιεί Phase 1+2 μόνο. Υλοποίηση μόνο αν υπάρξουν πραγματικά complaints από χρήστες.

---

## 7. Υπάρχοντα Συστήματα που Αξιοποιούνται (ΟΧΙ νέα)

| Σύστημα | Path | Πώς αξιοποιείται |
|---------|------|------------------|
| `RealtimeService` | `src/services/realtime/RealtimeService.ts` | `subscribeToDocument()` (γρ.128-176) — Phase 2 document watching |
| `useAutoSave` | `src/hooks/useAutoSave.ts` | Επεκτείνεται με `_v` tracking + `onConflict` callback |
| `OptimisticUpdateManager` | `src/services/entity-linking/utils/optimistic.ts` | Pattern reference (optimistic → rollback) |
| `ApiError` | `src/lib/api/ApiErrorHandler.ts` | 409 Conflict status code support |
| `CacheProvider` | `src/contexts/CacheProvider.tsx` | Cache invalidation on conflict detection |
| `enterprise-id.service` | `src/services/enterprise-id.service.ts` | Consistent ID generation (no change needed) |

---

## 8. Ασφαλή Patterns — Τι ΗΔΗ Λειτουργεί Σωστά

| Σύστημα | Γιατί είναι ασφαλές |
|---------|-------------------|
| Pipeline queue (`claimNextQueueItems`) | Firestore transactions + deduplication (ADR-171) |
| Relationship engine (ADR-228) | Transactions + cascade atomicity |
| Entity ID generation (ADR-017) | `enterprise-id.service` — unique, deterministic |
| Append-only collections | `audit_log`, `communications`, `attendance_events` — δεν υπάρχει edit, μόνο create |
| `useAutoSave` internal protection | `versionRef` prevents stale saves within SAME user session |
| Accounting invoices | Create-only, immutable μετά τη δημιουργία |

---

## 9. Προτεραιοποίηση Υλοποίησης

### Κριτήρια

| Κριτήριο | Βαρύτητα |
|----------|----------|
| Financial data risk | ×3 |
| Frequency of concurrent access | ×2 |
| Data loss severity | ×2 |
| User complaints (existing) | ×1 |

### Σειρά Υλοποίησης (Phase 1)

| Προτεραιότητα | Form | Λόγος |
|---------------|------|-------|
| P0 | `ContactDetails` + `EditContactDialog` | Πιο συχνά edited entity, πολλοί χρήστες |
| P0 | `EditInstallmentDialog` | Financial — data loss = χρηματικός κίνδυνος |
| P1 | `GeneralTabContent` (buildings) | Core business entity |
| P1 | `EditOpportunityModal` | Sales pipeline — business critical |
| P2 | `UnitsTabContent` + `UnitFieldsBlock` | High edit frequency |
| P2 | `TaskEditDialog` | Team collaboration hotspot |
| P3 | `ParkingTabContent`, `FloorsTabContent`, `StorageForm` | Lower concurrent edit probability |
| P3 | `BankAccountForm` | Rarely edited by multiple users |

---

## 10. Architectural Decisions

### D1: Optimistic Locking (ΟΧΙ Pessimistic)

**Απόφαση**: Optimistic locking (version check on save) αντί για pessimistic locking (lock on open).

**Γιατί**:
- Pessimistic locking δημιουργεί orphan locks (user κλείνει tab χωρίς unlock)
- Firestore δεν υποστηρίζει native document locking
- Τα edit sessions μπορεί να διαρκέσουν ώρες (user αφήνει tab ανοιχτό)
- Google Docs, Notion, Figma — ΟΛΑ χρησιμοποιούν optimistic patterns

### D2: Integer Version Counter (ΟΧΙ timestamp comparison)

**Απόφαση**: `_v: number` (monotonically increasing) αντί για `updatedAt` timestamp comparison.

**Γιατί**:
- Timestamps μπορεί να έχουν clock skew
- Integer comparison είναι atomic και αδιαμφισβήτητο
- Simpler conflict detection: `_v !== expectedVersion`
- Pattern used by: DynamoDB, CouchDB, etcd

### D3: Lazy Migration (ΟΧΙ batch migration)

**Απόφαση**: Δεν τρέχουμε migration script για να προσθέσουμε `_v` σε 10,000+ documents.

**Γιατί**:
- Documents χωρίς `_v` αντιμετωπίζονται ως `_v: 0`
- Πρώτο write σε document χωρίς `_v` γράφει `_v: 1`
- Zero downtime, zero migration cost
- Ίδιο pattern με ADR-251 migrate-on-touch

### D4: 409 HTTP Status Code

**Απόφαση**: Ο server επιστρέφει `409 Conflict` όταν version mismatch.

**Γιατί**:
- Standard HTTP semantics (RFC 7231 §6.5.8)
- Ξεχωρίζει από 400 (bad request) και 422 (validation error)
- Ο client μπορεί να κάνει specific handling (ConflictDialog)

---

## 11. Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-04-13 | **SPEC-256A Phase 2: Silent last-write-wins (Google pattern for solo-user app)**. The ConflictDialog-based flow introduced on 2026-03-21 produced more noise than signal in a solo-user operator context: self-409 races (lagging props, phantom server bumps from post-save hydration writes, audit-trail triggers), state leaks across entity swaps, and a modal that users could not meaningfully resolve without side-by-side diff UX. On user review the dialog was judged **not worth its interruption cost** — the reference Google patterns are all silent: Docs uses OT/CRDT merge, Gmail/Calendar/Contacts use last-write-wins with audit history. **Decision**: make `useVersionedSave` silently retry on 409 without `_v` (last-write-wins), drop all dialog-adjacent public API (`isConflicted`, `conflictData`, `forceSave`, `resetConflict`, `onConflict`), and delete `ConflictDialog.tsx` and its i18n keys outright. `_v` is still sent on the first attempt so the server can audit version trajectory, and `EntityAuditService` remains the source of truth for who-changed-what. Consumers that held manual `_v` state (`ParkingGeneralTab`, `StorageGeneralTab`) got an inline equivalent: catch 409, delete `_v`, retry once. The three auto-save consumers (`GeneralProjectTab`, `GeneralTabContent/buildings`) stopped short-circuiting on `isConflicted` since that state no longer exists. **Alternatives rejected**: (a) full CRDT/OT — dependency bloat and UX not warranted for a solo-user operator app; (b) banner instead of modal — still noise for races that are not genuine concurrent edits. **Consequences**: zero conflict dialogs in UI; no more self-409 interruption; audit trail remains the durable record for conflict post-mortems; a genuine multi-user concurrent edit (rare) now resolves as last-write-wins with both versions visible in the audit log. **Files**: rewrote `src/hooks/useVersionedSave.ts` (silent retry, trimmed public API); removed `ConflictDialog` integration from `GeneralProjectTab.tsx`, `GeneralTabContent.tsx`, `ParkingGeneralTab.tsx`, `StorageGeneralTab.tsx`; deleted `src/components/shared/ConflictDialog.tsx`; removed `versioning.*` keys from `el/en/pseudo/common.json`. | Claude Code |
| 2026-04-13 | **Read-path: hydrate-on-select detail view**. The write-path (SPEC-256A optimistic versioning) was landed on 2026-03-21, but a symmetric read-path gap remained: the project detail view was driven entirely by the lean `ProjectSummary` projected by `/api/projects/list` (~19 fields for tile perf), which silently dropped 22+ fields the `General` tab edits — `description`, `buildingBlock`, `protocolNumber`, `licenseNumber`, `issuingAuthority`, `issueDate`, `budget`, `client`, `location`, `type`, `priority`, `riskLevel`, `complexity`, `duration`, `projectCode`, `linkedCompanyName`, etc. Users could type, save, and see the change in the audit trail — but on navigation/reload the UI reverted to empty because the summary re-projection never carried the values. **Decision**: introduce `useProjectDetail(projectId)` — a client hook that fetches `GET /api/projects/[id]` (full Firestore document) and becomes the **sole source of truth** for the detail view. The list summary is relegated to placeholder-until-hydrated. Module-level `Map<string, Project>` cache gives instant paint on revisit; AbortController-equivalent request counter guards against rapid-switch races; `PROJECT_UPDATED` events shallow-merge into the hydrated doc in parallel with the list-side merge in `useProjectsState`; `pauseRefetch: isEditing` prevents mid-edit clobber; `refetch()` is called by `GeneralProjectTab.handleSave` after each successful save to adopt server-computed fields as canonical. **Alternatives rejected**: (a) fattening the list projection — would kill list perf and erase the `Project` vs `ProjectSummary` distinction; (b) full SWR/React-Query integration — dependency bloat for a single use-case. **Consequences**: +1 GET per project selection (cached thereafter), list perf unchanged, zero changes to the 17 tab components (only `data` prop source changed at `ProjectDetails` level), 404 mid-navigation now surfaces as the empty state instead of showing stale tile data. **Files**: new `src/hooks/useProjectDetail.ts`, modified `src/components/projects/project-details.tsx` (+ integration, `effectiveProject` memo, 404 empty-state fallback), modified `src/components/projects/general-tab/GeneralProjectTab.tsx` (+ `refetchProject` prop, post-save `void refetchProject?.()`). | Claude Code |
| 2026-03-20 | Initial analysis & documentation — 34 forms audited, 3-phase roadmap | Claude Code |

---

## Appendix A: Related ADRs

| ADR | Σχέση |
|-----|-------|
| ADR-248 | `useAutoSave` — extends with `_v` tracking + `onConflict` |
| ADR-055 | `RealtimeService` — `subscribeToDocument()` for Phase 2 |
| ADR-228 | Relationship Engine — already uses transactions (safe) |
| ADR-253 | Deep Security Audit — identified race conditions |
| ADR-017 | Enterprise ID Generation — no change needed |
| ADR-251 | Scattered Code Patterns — migrate-on-touch strategy |

## Appendix B: Testing Strategy

### Manual Testing Scenarios

1. **Two-tab test**: Άνοιξε ίδια επαφή σε 2 tabs, αλλάξτε name σε κάθε tab, αποθήκευσε
2. **Stale form test**: Άνοιξε form, περίμενε 5 λεπτά, κάνε save → verify data freshness
3. **Delete-during-edit**: Άνοιξε form σε tab A, διέγραψε entity σε tab B, save σε tab A
4. **Auto-save race**: Γρήγορη εναλλαγή μεταξύ tabs με auto-save enabled

### Automated Testing (Phase 1)

```typescript
// Unit test: withVersionCheck middleware
describe('withVersionCheck', () => {
  it('should succeed when version matches', async () => { /* ... */ });
  it('should throw 409 when version mismatch', async () => { /* ... */ });
  it('should handle missing _v as version 0', async () => { /* ... */ });
  it('should increment version on success', async () => { /* ... */ });
});
```
