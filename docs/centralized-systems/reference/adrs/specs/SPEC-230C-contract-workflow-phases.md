# SPEC-230C: Contract Workflow Phases

| Field | Value |
|-------|-------|
| **ADR** | ADR-230 |
| **Phase** | C — Core Contract Lifecycle (FSM + Service + API) |
| **Priority** | HIGH |
| **Status** | PLANNING |
| **Estimated Effort** | 2 sessions |
| **Prerequisites** | SPEC-230A (ProfessionalSnapshot), SPEC-230B (CommissionRecord) |
| **Dependencies** | SPEC-230D depends on this |

---

## 1. Objective

Υλοποίηση του πυρήνα της νομικής διαδικασίας: `LegalContract` entity, finite state machine (FSM) για transitions, `LegalContractService` για CRUD + validation, API routes, και synchronization με `unit.commercial.legalPhase`.

Τρία στάδια: **Προσύμφωνο → Οριστικό → Εξοφλητήριο** (sequential, server-enforced).

---

## 2. Task A: Types — LegalContract

### Target File
`src/types/legal-contracts.ts` (extend — αρχείο δημιουργήθηκε στο SPEC-230A)

### Type Definitions

```typescript
import type { Timestamp } from 'firebase/firestore';
import type { ProfessionalSnapshot } from './legal-contracts'; // same file

// ============================================================================
// CONTRACT PHASE & STATUS
// ============================================================================

/** Τύπος συμβολαίου — sequential: preliminary → final → payoff */
export type ContractPhase = 'preliminary' | 'final' | 'payoff';

/**
 * Κατάσταση μεμονωμένου συμβολαίου.
 * FSM: draft → pending_signature → signed → completed
 * Shortcut: draft → cancelled (from any non-completed state)
 */
export type ContractStatus = 'draft' | 'pending_signature' | 'signed' | 'completed' | 'cancelled';

/**
 * Denormalized νομική φάση μονάδας.
 * Αποθηκεύεται στο unit.commercial.legalPhase.
 * Υπολογίζεται αυτόματα από τα contracts.
 */
export type LegalPhase =
  | 'none'
  | 'preliminary_pending'
  | 'preliminary_signed'
  | 'final_pending'
  | 'final_signed'
  | 'payoff_pending'
  | 'payoff_completed';

/**
 * Όροι αρραβώνα σε περίπτωση ακύρωσης (ΑΚ 402-403).
 * Προσυμφωνείται ΠΡΙΝ την υπογραφή.
 */
export type DepositTermsOnCancellation =
  | 'forfeited'         // Χάνεται (αγοραστής αποσύρεται)
  | 'returned'          // Επιστρέφεται (αμοιβαία λύση)
  | 'returned_double';  // Επιστρέφεται στο διπλάσιο (πωλητής αποσύρεται — ΑΚ 402)

// ============================================================================
// LEGAL CONTRACT ENTITY
// ============================================================================

/**
 * Νομικό Συμβόλαιο — κεντρικό entity νομικής διαδικασίας.
 * Κάθε πώληση μονάδας μπορεί να έχει 3 contracts (preliminary, final, payoff).
 *
 * Firestore collection: `legal_contracts`
 */
export interface LegalContract {
  id: string;

  // --- Entity References ---

  /** Unit ID */
  unitId: string;

  /** Unit name (denormalized) */
  unitName: string;

  /** Project ID */
  projectId: string;

  /** Building ID */
  buildingId: string;

  /** Buyer contact ID */
  buyerContactId: string;

  /** Buyer display name (denormalized) */
  buyerName: string;

  // --- Contract Identity ---

  /** Phase: preliminary / final / payoff */
  phase: ContractPhase;

  /** FSM status */
  status: ContractStatus;

  /** Αριθμός συμβολαίου (ελεύθερο κείμενο, προαιρετικό) */
  contractNumber: string | null;

  /**
   * Ποσό συμβολαίου (τίμημα που αναγράφεται στο συμβόλαιο).
   *
   * ΣΗΜΑΝΤΙΚΟ: Αυτό μπορεί να ΔΙΑΦΕΡΕΙ από την εμπορική τιμή πώλησης.
   * Στην Ελλάδα, συχνά αναγράφεται η αντικειμενική αξία αντί της
   * εμπορικής. Ο χρήστης εισάγει ΕΛΕΥΘΕΡΑ το ποσό — ΔΕΝ γίνεται
   * auto-fill από την τιμή πώλησης του unit.
   */
  amount: number | null;

  /** Σημειώσεις */
  notes: string | null;

  // --- Αρραβώνας / Προκαταβολή ---

  /**
   * Ποσό αρραβώνα/προκαταβολής.
   * Καταγράφεται στο contract (κυρίως στο preliminary).
   */
  depositAmount: number | null;

  /**
   * Τι γίνεται με τον αρραβώνα σε περίπτωση ακύρωσης.
   * Βάσει ΑΚ 402-403:
   * - forfeited: Ο αγοραστής χάνει τον αρραβώνα (αγοραστής αποσύρεται)
   * - returned: Επιστρέφεται στον αγοραστή (αμοιβαία λύση)
   * - returned_double: Επιστρέφεται στο διπλάσιο (πωλητής αποσύρεται)
   * - null: Δεν έχει οριστεί ακόμα
   *
   * Αυτό ΠΡΕΠΕΙ να προσυμφωνείται πριν την υπογραφή.
   */
  depositTerms: DepositTermsOnCancellation | null;

  // --- Professionals (Snapshots — IMMUTABLE) ---

  /**
   * Snapshot επαγγελματιών.
   *
   * ΚΡΙΣΙΜΟ: Μπορεί να είναι ΚΕΝΟ [].
   * Στην Ελλάδα, συμβόλαιο μπορεί να γίνει χωρίς δικηγόρους.
   * Οι επαγγελματίες καθορίζονται ΜΕΤΑ την προκαταβολή/καπάρο
   * και προστίθενται σταδιακά στο contract.
   *
   * Ροή:
   * 1. Δημιουργία contract → professionals: [] (κενό, OK)
   * 2. Ο χρήστης αναθέτει επαγγελματίες στο unit (ProfessionalsCard)
   * 3. Κατά τη μετάβαση σε signed → snapshot τρεχόντων professionals
   * 4. Override: αν αλλάξει επαγγελματίας → νέο snapshot μόνο γι' αυτόν
   *
   * IMMUTABLE μετά το signing — κρατάει τα στοιχεία ΤΗΣ ΕΠΟΧΗΣ.
   */
  professionals: ProfessionalSnapshot[];

  // --- Documents (ADR-191 FileRecord references) ---

  /** File IDs (from files collection, domain: 'legal') */
  fileIds: string[];

  // --- Key Dates ---

  /** Ημερομηνία δημιουργίας draft */
  draftDate: Timestamp | null;

  /** Ημερομηνία υπογραφής */
  signatureDate: Timestamp | null;

  /** Ημερομηνία ολοκλήρωσης */
  completionDate: Timestamp | null;

  /** Ραντεβού στο συμβολαιογραφείο */
  scheduledDate: Timestamp | null;

  /** Ημερομηνία ακύρωσης */
  cancelledDate: Timestamp | null;

  /** Λόγος ακύρωσης */
  cancellationReason: string | null;

  // --- Audit ---

  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================================================
// FSM TRANSITION TYPES
// ============================================================================

/** Valid transitions per status */
export const CONTRACT_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  draft: ['pending_signature', 'cancelled'],
  pending_signature: ['signed', 'cancelled'],
  signed: ['completed'],
  completed: [],        // terminal
  cancelled: [],        // terminal
};

/** Transition action names for UI/API */
export type ContractTransitionAction =
  | 'submit_for_signature'   // draft → pending_signature
  | 'mark_signed'            // pending_signature → signed
  | 'mark_completed'         // signed → completed
  | 'cancel';                // any → cancelled

/** Map action → target status */
export const TRANSITION_ACTION_MAP: Record<ContractTransitionAction, ContractStatus> = {
  submit_for_signature: 'pending_signature',
  mark_signed: 'signed',
  mark_completed: 'completed',
  cancel: 'cancelled',
};

// ============================================================================
// PHASE PREREQUISITES
// ============================================================================

/**
 * Prerequisites: ποιο phase πρέπει να έχει status 'signed'
 * πριν δημιουργηθεί το επόμενο.
 *
 * ΣΗΜΑΝΤΙΚΟ — ΚΑΝΟΝΕΣ ΦΑΣΕΩΝ (βάσει Ελληνικής Νομοθεσίας):
 *
 * 🔴 ΟΡΙΣΤΙΚΟ ΣΥΜΒΟΛΑΙΟ = ΥΠΟΧΡΕΩΤΙΚΟ (πάντα τουλάχιστον αυτό)
 *    Είναι η μόνη πράξη που μεταβιβάζει κυριότητα ακινήτου
 *    (συμβολαιογραφικός τύπος + μεταγραφή στο Κτηματολόγιο).
 *
 * 🟡 ΠΡΟΣΥΜΦΩΝΟ = ΠΡΟΑΙΡΕΤΙΚΟ
 *    Μπορεί να παραλειφθεί — ο χρήστης πάει κατευθείαν σε Οριστικό.
 *    Αν υπάρχει, πρέπει να είναι signed πριν δημιουργηθεί Οριστικό.
 *
 * 🟡 ΕΞΟΦΛΗΤΗΡΙΟ = ΠΡΟΑΙΡΕΤΙΚΟ
 *    Χρειάζεται ΜΟΝΟ αν υπάρχουν δόσεις (διαλυτική αίρεση στο Οριστικό).
 *    Αν ο αγοραστής πληρώσει εφάπαξ → ΔΕΝ χρειάζεται.
 *    ΑΠΑΙΤΕΙ signed Οριστικό — δεν μπορεί να υπάρξει χωρίς αυτό.
 *
 * Πιθανά σενάρια:
 * 1. Πλήρες:            Προσύμφωνο → Οριστικό → Εξοφλητήριο (δόσεις)
 * 2. Χωρίς Προσύμφωνο:  Οριστικό → Εξοφλητήριο (δόσεις)
 * 3. Εφάπαξ:            Προσύμφωνο → Οριστικό (εφάπαξ πληρωμή)
 * 4. Ελάχιστο:          Μόνο Οριστικό (εφάπαξ, χωρίς Προσύμφωνο)
 */
export const PHASE_PREREQUISITES: Record<ContractPhase, ContractPhase | null> = {
  preliminary: null,          // Μπορεί να δημιουργηθεί ελεύθερα
  final: null,                // Ελεύθερα — αλλά αν υπάρχει preliminary, πρέπει να είναι signed
  payoff: 'final',             // ΥΠΟΧΡΕΩΤΙΚΟ signed final — εξοφλητήριο δεν υπάρχει χωρίς οριστικό
};

// ============================================================================
// ACTIVE CONTRACT CONSTRAINT
// ============================================================================

/**
 * ΚΑΝΟΝΑΣ: Μόνο 1 active (non-cancelled) contract ανά φάση ανά μονάδα.
 *
 * Δεν μπορείς να πουλήσεις ένα ακίνητο σε δύο αγοραστές ταυτόχρονα.
 * Αν ακυρωθεί ένα contract, μπορεί να δημιουργηθεί νέο στην ίδια φάση.
 *
 * Τα cancelled contracts κρατούνται ως ιστορικό (audit trail).
 *
 * Παράδειγμα:
 *   Unit A1:
 *     ├── Προσύμφωνο #1 — ❌ cancelled (αγοραστής αποσύρθηκε)
 *     ├── Προσύμφωνο #2 — ✅ signed (νέος αγοραστής)
 *     └── Οριστικό #1   — 📝 draft
 */
```

---

## 3. Task B: Register Firestore Collection

### Target File
`src/config/firestore-collections.ts`

### Change
Στο `COLLECTIONS` object, μετά τα brokerage entries (SPEC-230B):

```typescript
// ⚖️ LEGAL CONTRACTS (ADR-230: Contract Workflow — Legal Process)
LEGAL_CONTRACTS: process.env.NEXT_PUBLIC_LEGAL_CONTRACTS_COLLECTION || 'legal_contracts',
```

### Naming Decision: `legal_contracts` (not `contracts`)
Αποφεύγουμε naming collision με μελλοντικά business contracts (π.χ. εργολαβικά, προμηθευτών). Το prefix `legal_` δηλώνει ξεκάθαρα ότι αφορά τη νομική διαδικασία πώλησης.

---

## 4. Task C: LegalContractService

### Target File
`src/services/legal-contract.service.ts` (νέο αρχείο)

### API Surface

```typescript
export class LegalContractService {
  // ==========================================================================
  // CRUD
  // ==========================================================================

  /**
   * Δημιουργία νέου contract.
   *
   * 1. Validates phase prerequisites:
   *    - preliminary: πάντα OK (προαιρετικό)
   *    - final: OK αν ΔΕΝ υπάρχει preliminary, ή αν υπάρχει ΚΑΙ είναι signed
   *    - payoff: ΑΠΑΙΤΕΙ signed final (εξοφλητήριο χωρίς οριστικό δεν υπάρχει νομικά)
   * 2. Validates unit is reserved or sold
   * 3. Snapshots professionals from unit associations (SPEC-230A)
   * 4. Creates contract document in Firestore
   * 5. Syncs unit.commercial.legalPhase
   * 6. Dispatches LEGAL_CONTRACT_CREATED event
   */
  static async createContract(input: CreateContractInput): Promise<LegalContract>

  /**
   * Ενημέρωση πεδίων contract (amount, notes, contractNumber, scheduledDate).
   * CANNOT change: phase, status, professionals (use dedicated methods).
   */
  static async updateContract(
    id: string,
    updates: UpdateContractInput,
    updatedBy: string
  ): Promise<void>

  /**
   * Ανάκτηση contract by ID
   */
  static async getContract(id: string): Promise<LegalContract | null>

  /**
   * Ανάκτηση contracts για μονάδα (ordered by phase)
   */
  static async getContractsForUnit(unitId: string): Promise<LegalContract[]>

  // ==========================================================================
  // FSM — STATUS TRANSITIONS
  // ==========================================================================

  /**
   * Transition contract to next status.
   *
   * Validation:
   * 1. Current status allows transition to target (CONTRACT_TRANSITIONS map)
   * 2. Phase-specific prerequisites met
   * 3. Required fields present (π.χ. signed requires signatureDate)
   *
   * Side effects:
   * 1. Updates contract status + relevant dates
   * 2. Syncs unit.commercial.legalPhase
   * 3. Dispatches LEGAL_CONTRACT_STATUS_CHANGED event
   * 4. If phase=payoff && status=completed → dispatch LEGAL_PROCESS_COMPLETED
   */
  static async transitionStatus(
    id: string,
    action: ContractTransitionAction,
    updatedBy: string,
    metadata?: TransitionMetadata
  ): Promise<void>

  // ==========================================================================
  // PROFESSIONAL OVERRIDE
  // ==========================================================================

  /**
   * Override ένα professional snapshot στον contract.
   *
   * Use case: Ο πελάτης αλλάζει δικηγόρο ΜΕΤΑ τη δημιουργία contract.
   * Κάνει νέο snapshot του νέου contact, αντικαθιστά μόνο αυτόν τον ρόλο.
   */
  static async overrideProfessional(
    contractId: string,
    role: LegalProfessionalRole,
    newContactId: string,
    updatedBy: string
  ): Promise<void>

  // ==========================================================================
  // LEGAL PHASE SYNC
  // ==========================================================================

  /**
   * Υπολογίζει και ενημερώνει unit.commercial.legalPhase
   * βάσει του πιο προχωρημένου contract.
   *
   * Καλείται αυτόματα μετά κάθε create/transition.
   */
  static async syncLegalPhase(unitId: string): Promise<LegalPhase>
}
```

### Legal Phase Computation Logic

```typescript
function computeLegalPhase(contracts: LegalContract[]): LegalPhase {
  // Find most advanced non-cancelled contract
  const active = contracts
    .filter(c => c.status !== 'cancelled')
    .sort((a, b) => PHASE_ORDER[b.phase] - PHASE_ORDER[a.phase]);

  if (active.length === 0) return 'none';

  const most = active[0];

  // Map phase + status → LegalPhase
  switch (most.phase) {
    case 'payoff':
      return most.status === 'completed' ? 'payoff_completed'
           : 'payoff_pending';
    case 'final':
      return most.status === 'signed' ? 'final_signed'
           : 'final_pending';
    case 'preliminary':
      return most.status === 'signed' ? 'preliminary_signed'
           : 'preliminary_pending';
  }
}

const PHASE_ORDER: Record<ContractPhase, number> = {
  preliminary: 0,
  final: 1,
  payoff: 2,
};
```

### TransitionMetadata Interface
```typescript
interface TransitionMetadata {
  /** Ημερομηνία υπογραφής (required for mark_signed) */
  signatureDate?: Timestamp;
  /** Ημερομηνία ολοκλήρωσης (required for mark_completed) */
  completionDate?: Timestamp;
  /** Λόγος ακύρωσης (required for cancel) */
  cancellationReason?: string;
}
```

---

## 5. Task D: API Routes

### Route 1: `POST /api/contracts`

**File:** `src/app/api/contracts/route.ts`

```typescript
// POST: Create new legal contract
// Body: { phase, unitId, projectId, buildingId, buyerContactId, buyerName, amount?, notes? }
// Middleware: withAuth + withStandardRateLimit
// Response: 201 Created → LegalContract
```

### Route 2: `GET /api/contracts?unitId=X`

**File:** `src/app/api/contracts/route.ts` (same file, GET handler)

```typescript
// GET: List contracts for a unit
// Query: ?unitId=abc123
// Middleware: withAuth
// Response: 200 OK → LegalContract[]
```

### Route 3: `PATCH /api/contracts/[id]`

**File:** `src/app/api/contracts/[id]/route.ts`

```typescript
// PATCH: Update contract fields (amount, notes, contractNumber, scheduledDate)
// Body: { amount?, notes?, contractNumber?, scheduledDate? }
// Middleware: withAuth + withStandardRateLimit
// Response: 200 OK
```

### Route 4: `POST /api/contracts/[id]/transition`

**File:** `src/app/api/contracts/[id]/transition/route.ts`

```typescript
// POST: Transition contract status
// Body: { action: ContractTransitionAction, metadata?: TransitionMetadata }
// Middleware: withAuth + withStandardRateLimit
// Response: 200 OK
// Errors:
//   400: Invalid transition (FSM violation)
//   400: Prerequisites not met (e.g., preliminary not signed)
//   404: Contract not found
```

### Route 5: `PATCH /api/contracts/[id]/professionals`

**File:** `src/app/api/contracts/[id]/professionals/route.ts`

```typescript
// PATCH: Override a professional on a contract
// Body: { role: LegalProfessionalRole, newContactId: string }
// Middleware: withAuth + withStandardRateLimit
// Response: 200 OK
```

---

## 6. Task E: RealtimeService Events

### Target File
`src/services/realtime/event-types.ts` (ή equivalent event registry)

### New Events

```typescript
// Legal Contract events
'LEGAL_CONTRACT_CREATED'          // payload: { contractId, unitId, phase }
'LEGAL_CONTRACT_UPDATED'          // payload: { contractId, unitId, updates }
'LEGAL_CONTRACT_STATUS_CHANGED'   // payload: { contractId, unitId, phase, oldStatus, newStatus }
'LEGAL_CONTRACT_PROFESSIONAL_CHANGED' // payload: { contractId, role, oldContactId, newContactId }
'LEGAL_PROCESS_COMPLETED'         // payload: { unitId, projectId } — all 3 phases done
```

---

## 7. Unit Extension — legalPhase Field

### Target File
`src/types/unit.ts` — `UnitCommercialData` interface

### Change
```typescript
// Add to UnitCommercialData:
legalPhase?: LegalPhase; // Denormalized from contracts — auto-synced
```

### Impact
- Unit cards can display legal phase badge without fetching contracts
- Filterable in sales list views
- Updated automatically by `LegalContractService.syncLegalPhase()`

---

## 8. Files Summary

| Action | File | What |
|--------|------|------|
| **EXTEND** | `src/types/legal-contracts.ts` | +LegalContract, ContractPhase, ContractStatus, LegalPhase, FSM maps |
| **MODIFY** | `src/config/firestore-collections.ts` | +LEGAL_CONTRACTS |
| **CREATE** | `src/services/legal-contract.service.ts` | LegalContractService (CRUD + FSM + sync) |
| **CREATE** | `src/app/api/contracts/route.ts` | POST (create) + GET (list) |
| **CREATE** | `src/app/api/contracts/[id]/route.ts` | PATCH (update fields) |
| **CREATE** | `src/app/api/contracts/[id]/transition/route.ts` | POST (FSM transition) |
| **CREATE** | `src/app/api/contracts/[id]/professionals/route.ts` | PATCH (override professional) |
| **MODIFY** | `src/services/realtime/event-types.ts` | +5 legal contract events |
| **MODIFY** | `src/types/unit.ts` | +legalPhase field in UnitCommercialData |

---

## 9. Error Handling

| Error | HTTP | Message |
|-------|------|---------|
| Phase prerequisite not met | 400 | "Cannot create {phase}: {prerequisite} must be signed first" |
| Invalid FSM transition | 400 | "Cannot transition from {current} to {target}" |
| Contract not found | 404 | "Contract {id} not found" |
| Unit not reserved/sold | 400 | "Unit must be reserved or sold to create a contract" |
| Active contract exists | 400 | "An active {phase} contract already exists for this unit" |
| Missing signatureDate | 400 | "signatureDate is required for mark_signed action" |
| Missing cancellationReason | 400 | "cancellationReason is required for cancel action" |

---

## 10. Verification Criteria

1. `npx tsc --noEmit` — zero errors σε αλλαγμένα αρχεία
2. FSM: `draft → pending_signature → signed → completed` works
3. FSM: `draft → cancelled`, `pending_signature → cancelled` works
4. FSM: `completed → X`, `cancelled → X` blocked
5. Phase prerequisites: CAN create `final` without preliminary (skip allowed)
6. Phase prerequisites: CANNOT create `final` if preliminary EXISTS but is NOT signed
7. Phase prerequisites: CAN skip `payoff` entirely (εφάπαξ πληρωμή)
8. Phase prerequisites: CANNOT create `payoff` without signed `final` (νομική απαίτηση)
7. `syncLegalPhase()` correctly computes phase from most advanced contract
8. Professional snapshot created at contract creation
9. Professional override replaces only the targeted role
10. RealtimeService events dispatched correctly
11. Unit.commercial.legalPhase updates after every status change

---

*SPEC Format: Google Engineering Design Docs standard*
