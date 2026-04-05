/**
 * =============================================================================
 * Legal Contract Types — Contract Workflow & FSM
 * =============================================================================
 *
 * Types για τη νομική διαδικασία πώλησης ακινήτων (Ελληνικό δίκαιο).
 * Τρία στάδια: Προσύμφωνο → Οριστικό Συμβόλαιο → Εξοφλητήριο
 *
 * @module types/legal-contracts
 * @enterprise ADR-230 - Contract Workflow & Legal Process
 */

// ADR-287 — LegalPhase SSoT (canonical lives στο @/constants/legal-phases)
import type { LegalPhase } from '@/constants/legal-phases';
export type { LegalPhase };

// ============================================================================
// CONTRACT PHASE & STATUS
// ============================================================================

/**
 * Τύπος συμβολαίου (Ελληνική νομοθεσία)
 *
 * - preliminary: Προσύμφωνο (προαιρετικό — δεσμεύει τα μέρη)
 * - final: Οριστικό Συμβόλαιο (ΥΠΟΧΡΕΩΤΙΚΟ — μόνη πράξη που μεταβιβάζει κυριότητα)
 * - payoff: Εξοφλητήριο (προαιρετικό — μόνο αν υπάρχουν δόσεις)
 */
export type ContractPhase = 'preliminary' | 'final' | 'payoff';

/**
 * Κατάσταση συμβολαίου (forward-only FSM)
 *
 * draft → pending_signature → signed → completed
 */
export type ContractStatus = 'draft' | 'pending_signature' | 'signed' | 'completed';

// ============================================================================
// FSM TRANSITION MAPS
// ============================================================================

/**
 * Επιτρεπτές μεταβάσεις status εντός ενός contract.
 * Forward-only: draft → pending_signature → signed → completed
 */
export const CONTRACT_STATUS_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  draft: ['pending_signature'],
  pending_signature: ['signed'],
  signed: ['completed'],
  completed: [],
};

/**
 * Σειρά φάσεων. Κάθε φάση απαιτεί signed/completed στην προηγούμενη.
 */
export const CONTRACT_PHASE_ORDER: readonly ContractPhase[] = [
  'preliminary',
  'final',
  'payoff',
] as const;

/**
 * Prerequisite: ποια φάση πρέπει να είναι signed πριν δημιουργηθεί η επόμενη.
 * null = καμία prerequisite (preliminary μπορεί να δημιουργηθεί ελεύθερα).
 * ΣΗΜΑΝΤΙΚΟ: Preliminary είναι ΠΡΟΑΙΡΕΤΙΚΟ — final μπορεί να δημιουργηθεί
 * χωρίς preliminary, ΑΛΛΑ αν υπάρχει preliminary πρέπει να είναι signed.
 */
export const CONTRACT_PHASE_PREREQUISITES: Record<ContractPhase, ContractPhase | null> = {
  preliminary: null,
  final: null, // preliminary is optional — validated conditionally in service
  payoff: 'final',
};

// ============================================================================
// LEGAL PHASE COMPUTATION MAP
// ============================================================================

/**
 * Υπολογίζει τη LegalPhase από ContractPhase + ContractStatus.
 * Χρησιμοποιείται για denormalization στο property.commercial.legalPhase.
 */
export const LEGAL_PHASE_MAP: Record<ContractPhase, Partial<Record<ContractStatus, LegalPhase>>> = {
  preliminary: {
    draft: 'preliminary_pending',
    pending_signature: 'preliminary_pending',
    signed: 'preliminary_signed',
    completed: 'preliminary_signed',
  },
  final: {
    draft: 'final_pending',
    pending_signature: 'final_pending',
    signed: 'final_signed',
    completed: 'final_signed',
  },
  payoff: {
    draft: 'payoff_pending',
    pending_signature: 'payoff_pending',
    signed: 'payoff_completed',
    completed: 'payoff_completed',
  },
};

// ============================================================================
// PROFESSIONAL SNAPSHOT (Immutable at contract signing time)
// ============================================================================

/** Ρόλος νομικού επαγγελματία στο contract */
export type LegalProfessionalRole = 'seller_lawyer' | 'buyer_lawyer' | 'notary';

/** Snapshot δεδομένα δικηγόρου κατά την υπογραφή */
export interface LawyerSnapshotData {
  type: 'lawyer';
  barAssociationNumber: string | null;
  barAssociation: string | null;
}

/** Snapshot δεδομένα συμβολαιογράφου κατά την υπογραφή */
export interface NotarySnapshotData {
  type: 'notary';
  notaryRegistryNumber: string | null;
  notaryDistrict: string | null;
}

/**
 * Immutable snapshot επαγγελματία κατά τη δημιουργία/υπογραφή contract.
 * SAP Business Partner pattern: αν ο δικηγόρος αλλάξει στοιχεία αργότερα,
 * το παλιό contract κρατάει τα αρχικά δεδομένα.
 */
export interface ProfessionalSnapshot {
  contactId: string;
  displayName: string;
  role: LegalProfessionalRole;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  roleSpecificData: LawyerSnapshotData | NotarySnapshotData;
  snapshotAt: string; // ISO timestamp
}

// ============================================================================
// DEPOSIT TERMS (Αρραβώνας — ΑΚ 402-403)
// ============================================================================

/**
 * Όροι αρραβώνα σε περίπτωση ακύρωσης (Αστικός Κώδικας 402-403).
 * - forfeit: Χάνεται ο αρραβώνας (αγοραστής ακυρώνει)
 * - double_return: Επιστρέφεται διπλάσιος (πωλητής ακυρώνει)
 * - refund: Πλήρης επιστροφή (συμφωνία μερών)
 */
export type DepositTermsOnCancellation = 'forfeit' | 'double_return' | 'refund';

// ============================================================================
// LEGAL CONTRACT DOCUMENT
// ============================================================================

/**
 * Κύριο Firestore document για νομικό συμβόλαιο.
 * Collection: legal_contracts
 */
export interface LegalContract {
  id: string;

  // === Αναφορές ===
  propertyId: string;
  projectId: string;
  buildingId: string;
  /** Primary buyer contact ID (extracted from unit owners) */
  primaryBuyerContactId: string;

  // === Phase & Status (FSM) ===
  phase: ContractPhase;
  status: ContractStatus;

  // === Οικονομικά ===
  /** Ποσό συμβολαίου (ελεύθερο — μπορεί αντικειμενική αξία, μπορεί εμπορική) */
  contractAmount: number | null;
  /** Ποσό αρραβώνα/καπάρου (μόνο στο preliminary) */
  depositAmount: number | null;
  /** Όροι αρραβώνα σε ακύρωση */
  depositTerms: DepositTermsOnCancellation | null;

  // === Νομικοί Επαγγελματίες (snapshots) ===
  sellerLawyer: ProfessionalSnapshot | null;
  buyerLawyer: ProfessionalSnapshot | null;
  notary: ProfessionalSnapshot | null;

  // === Αρχεία ===
  /** References σε FileRecord IDs (ADR-191 Document Management) */
  fileIds: string[];

  // === Σημειώσεις ===
  notes: string | null;

  // === Audit ===
  createdBy: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  signedAt: string | null; // ISO timestamp — γεμίζει κατά τη μετάβαση σε signed
  completedAt: string | null; // ISO timestamp
}

/**
 * Input για δημιουργία νέου contract.
 */
export interface CreateContractInput {
  propertyId: string;
  projectId: string;
  buildingId: string;
  primaryBuyerContactId: string;
  phase: ContractPhase;
  contractAmount?: number | null;
  depositAmount?: number | null;
  depositTerms?: DepositTermsOnCancellation | null;
  notes?: string | null;
}

/**
 * Input για ενημέρωση πεδίων contract (PATCH).
 */
export interface UpdateContractInput {
  contractAmount?: number | null;
  depositAmount?: number | null;
  depositTerms?: DepositTermsOnCancellation | null;
  notes?: string | null;
  fileIds?: string[];
}

/**
 * Input για FSM transition.
 */
export interface ContractTransitionInput {
  targetStatus: ContractStatus;
}

// ============================================================================
// UTILITY: Validate FSM transition
// ============================================================================

/**
 * Ελέγχει αν μια μετάβαση status είναι έγκυρη.
 */
export function isValidTransition(
  currentStatus: ContractStatus,
  targetStatus: ContractStatus
): boolean {
  return CONTRACT_STATUS_TRANSITIONS[currentStatus].includes(targetStatus);
}

/**
 * Υπολογίζει τη LegalPhase από phase + status.
 */
export function computeLegalPhase(phase: ContractPhase, status: ContractStatus): LegalPhase {
  return LEGAL_PHASE_MAP[phase]?.[status] ?? 'none';
}
