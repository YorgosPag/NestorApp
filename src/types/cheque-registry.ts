/**
 * =============================================================================
 * Cheque Registry Types — ADR-234 Phase 3 (SPEC-234A)
 * =============================================================================
 *
 * Enterprise cheque lifecycle management per Ν. 5960/1933:
 * registration, custody, deposit, clearing, bounced workflow,
 * endorsement chain, replacement.
 *
 * Scope: unit_sale context (incoming cheques from buyers).
 * Firestore: top-level `cheques/{chequeId}` collection.
 *
 * @module types/cheque-registry
 * @enterprise ADR-234 Phase 3 — SPEC-234A
 */

// =============================================================================
// ENUMS
// =============================================================================

/** Τύπος επιταγής */
export type ChequeType = 'bank_cheque' | 'personal_cheque';

/** Κατάσταση επιταγής — 10-state FSM */
export type ChequeStatus =
  | 'received'      // Παραλήφθηκε
  | 'in_custody'    // Σε φύλαξη
  | 'deposited'     // Κατατέθηκε
  | 'clearing'      // Σε εκκαθάριση
  | 'cleared'       // Εισπράχθηκε (terminal)
  | 'bounced'       // Σφραγίστηκε
  | 'endorsed'      // Οπισθογραφήθηκε (terminal)
  | 'cancelled'     // Ακυρώθηκε (terminal)
  | 'expired'       // Έληξε (terminal)
  | 'replaced';     // Αντικαταστάθηκε (terminal)

/** Λόγος σφράγισης (bounce) */
export type BouncedReason =
  | 'insufficient_funds'  // Ανεπαρκές υπόλοιπο
  | 'account_closed'      // Κλειστός λογαριασμός
  | 'signature_mismatch'  // Ασυμφωνία υπογραφής
  | 'stop_payment'        // Ανάκληση πληρωμής
  | 'post_dated_early'    // Πρόωρη κατάθεση μεταχρονολογημένης
  | 'technical_issue'     // Τεχνικό πρόβλημα
  | 'other';              // Άλλος λόγος

/** Context τύπος — σε τι αφορά η επιταγή */
export type ChequeContextType = 'unit_sale' | 'supplier' | 'contractor' | 'other';

/** Κατεύθυνση επιταγής */
export type ChequeDirection = 'incoming' | 'outgoing';

// =============================================================================
// CHEQUE CONTEXT
// =============================================================================

/** Σύνδεση επιταγής με business entity */
export interface ChequeContext {
  type: ChequeContextType;
  entityId: string | null;
  projectId: string;
  propertyId: string | null;
  paymentPlanId: string | null;
  contactId: string | null;
  direction: ChequeDirection;
}

// =============================================================================
// ENDORSEMENT ENTRY
// =============================================================================

/** Εγγραφή οπισθογράφησης */
export interface EndorsementEntry {
  order: number;
  endorserName: string;
  endorseeName: string;
  endorsementDate: string;
  notes: string | null;
}

// =============================================================================
// CHEQUE RECORD
// =============================================================================

/** Πλήρες αρχείο επιταγής */
export interface ChequeRecord {
  /** Document ID */
  chequeId: string;

  // --- Βασικά στοιχεία ---
  chequeType: ChequeType;
  chequeNumber: string;
  amount: number;
  currency: 'EUR';

  // --- Τράπεζα / Εκδότης ---
  bankName: string;
  bankBranch: string | null;
  drawerName: string;
  drawerTaxId: string | null;
  accountNumber: string | null;

  // --- Ημερομηνίες (ISO strings) ---
  issueDate: string;
  maturityDate: string;
  postDated: boolean;

  // --- Ασφάλεια ---
  crossedCheque: boolean;

  // --- Κατάσταση ---
  status: ChequeStatus;

  // --- Bounced workflow ---
  bouncedDate: string | null;
  bouncedReason: BouncedReason | null;
  bouncedNotes: string | null;
  teiresiasFiled: boolean;
  teiresiasFiledDate: string | null;
  policeCaseFiled: boolean;
  policeCaseFiledDate: string | null;
  policeCaseReference: string | null;

  // --- Deposit / Clearing ---
  depositDate: string | null;
  depositBankName: string | null;
  depositAccountNumber: string | null;
  clearingDate: string | null;

  // --- Endorsement chain ---
  endorsementChain: EndorsementEntry[];

  // --- Replacement ---
  replacedByChequeId: string | null;
  replacesChequeId: string | null;

  // --- Context ---
  context: ChequeContext;

  // --- Payment link ---
  paymentId: string | null;

  // --- Notes ---
  notes: string | null;

  // --- Audit ---
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

// =============================================================================
// FSM — VALID TRANSITIONS
// =============================================================================

const VALID_CHEQUE_TRANSITIONS: Record<ChequeStatus, ChequeStatus[]> = {
  received: ['in_custody', 'deposited', 'endorsed', 'cancelled'],
  in_custody: ['deposited', 'endorsed', 'cancelled', 'expired'],
  deposited: ['clearing', 'cancelled'],
  clearing: ['cleared', 'bounced'],
  cleared: [],
  bounced: ['replaced', 'cancelled'],
  endorsed: [],
  cancelled: [],
  expired: ['replaced'],
  replaced: [],
};

/** Ελέγχει αν η μετάβαση status είναι έγκυρη */
export function isValidChequeTransition(
  from: ChequeStatus,
  to: ChequeStatus
): boolean {
  return VALID_CHEQUE_TRANSITIONS[from].includes(to);
}

/** Επιστρέφει τα επόμενα valid statuses */
export function getValidNextChequeStatuses(status: ChequeStatus): ChequeStatus[] {
  return VALID_CHEQUE_TRANSITIONS[status];
}

/** Terminal statuses (δεν μπορούν να αλλάξουν) */
export function isTerminalChequeStatus(status: ChequeStatus): boolean {
  return VALID_CHEQUE_TRANSITIONS[status].length === 0;
}

/** Ordered statuses for timeline display (χωρίς terminals) */
export const CHEQUE_STATUS_ORDER: ChequeStatus[] = [
  'received',
  'in_custody',
  'deposited',
  'clearing',
  'cleared',
];

// =============================================================================
// INPUT TYPES
// =============================================================================

/** Input για δημιουργία νέας επιταγής */
export interface CreateChequeInput {
  chequeType: ChequeType;
  chequeNumber: string;
  amount: number;
  bankName: string;
  bankBranch?: string;
  drawerName: string;
  drawerTaxId?: string;
  accountNumber?: string;
  issueDate: string;
  maturityDate: string;
  crossedCheque?: boolean;
  notes?: string;
  // Context
  projectId: string;
  paymentPlanId?: string;
  contactId?: string;
}

/** Input για PATCH μεταβλητών πεδίων */
export interface UpdateChequeInput {
  bankBranch?: string;
  drawerTaxId?: string;
  accountNumber?: string;
  crossedCheque?: boolean;
  notes?: string;
  depositBankName?: string;
  depositAccountNumber?: string;
}

/** Input για transition status */
export interface ChequeTransitionInput {
  targetStatus: ChequeStatus;
  notes?: string;
  // deposit-specific
  depositDate?: string;
  depositBankName?: string;
  depositAccountNumber?: string;
  // clearing-specific
  clearingDate?: string;
}

/** Input για endorsement */
export interface EndorseInput {
  endorserName: string;
  endorseeName: string;
  endorsementDate: string;
  notes?: string;
}

/** Input για bounce */
export interface BounceInput {
  bouncedReason: BouncedReason;
  bouncedDate?: string;
  bouncedNotes?: string;
  teiresiasFiled?: boolean;
  teiresiasFiledDate?: string;
  policeCaseFiled?: boolean;
  policeCaseFiledDate?: string;
  policeCaseReference?: string;
}

// =============================================================================
// FACTORY
// =============================================================================

/** Δημιουργία default ChequeRecord */
export function createDefaultChequeRecord(
  chequeId: string,
  input: CreateChequeInput,
  propertyId: string,
  createdBy: string
): ChequeRecord {
  const now = new Date().toISOString();
  const postDated = input.maturityDate > input.issueDate;

  return {
    chequeId,
    chequeType: input.chequeType,
    chequeNumber: input.chequeNumber.trim(),
    amount: input.amount,
    currency: 'EUR',
    bankName: input.bankName.trim(),
    bankBranch: input.bankBranch?.trim() ?? null,
    drawerName: input.drawerName.trim(),
    drawerTaxId: input.drawerTaxId?.trim() ?? null,
    accountNumber: input.accountNumber?.trim() ?? null,
    issueDate: input.issueDate,
    maturityDate: input.maturityDate,
    postDated,
    crossedCheque: input.crossedCheque ?? false,
    status: 'received',
    bouncedDate: null,
    bouncedReason: null,
    bouncedNotes: null,
    teiresiasFiled: false,
    teiresiasFiledDate: null,
    policeCaseFiled: false,
    policeCaseFiledDate: null,
    policeCaseReference: null,
    depositDate: null,
    depositBankName: null,
    depositAccountNumber: null,
    clearingDate: null,
    endorsementChain: [],
    replacedByChequeId: null,
    replacesChequeId: null,
    context: {
      type: 'unit_sale',
      entityId: propertyId,
      projectId: input.projectId,
      propertyId,
      paymentPlanId: input.paymentPlanId ?? null,
      contactId: input.contactId ?? null,
      direction: 'incoming',
    },
    paymentId: null,
    notes: input.notes ?? null,
    createdAt: now,
    createdBy,
    updatedAt: now,
    updatedBy: createdBy,
  };
}
