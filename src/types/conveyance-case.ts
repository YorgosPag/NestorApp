/**
 * =============================================================================
 * Conveyance Case — υπόθεση μεταβίβασης (ADR-901 §5.1)
 * =============================================================================
 *
 * Η πώληση στο ακίνητο είναι **κατάσταση** (`commercial.legalPhase`)· η υπόθεση είναι
 * η **πράξη** με αρχή και τέλος (ένα ακίνητο μπορεί να πουληθεί ξανά).
 *
 * 🔑 Αποθηκεύονται ΜΟΝΟ οι αποκλίσεις από τον κατάλογο (απαντήσεις σε γεγονότα,
 *    «δεν εφαρμόζεται», έλεγχοι). Η κατάσταση κάθε γραμμής **παράγεται** κάθε φορά
 *    από τον κατάλογο + τα αρχεία (`src/lib/conveyance/derive-checklist.ts`).
 *
 * Συλλογή: `conveyance_cases` — **μόνο server** (Admin SDK, κανόνες deny-all στη Φ1).
 *
 * @module types/conveyance-case
 * @see ADR-901
 */

import type {
  ChecklistItem,
  ChecklistProvider,
  ChecklistSection,
  ConveyanceFactId,
  ConveyanceProfile,
  EvidenceLevel,
} from '@/config/conveyance-checklist/types';

// ============================================================================
// ΚΑΤΑΣΤΑΣΗ ΥΠΟΘΕΣΗΣ (AIP-216 — output-only)
// ============================================================================

/**
 * Κατάσταση που **αποθηκεύεται** — μόνο από ρητές πράξεις (ADR-901 §2 Ε-Ε).
 * Το `signed` ΔΕΝ αποθηκεύεται: παράγεται από το `legalPhase` του ADR-230.
 */
export const STORED_CASE_STATES = ['open', 'registered', 'closed', 'cancelled'] as const;
export type StoredCaseState = (typeof STORED_CASE_STATES)[number];

/** Η κατάσταση που βλέπει ο χρήστης (`effectiveCaseState`). */
const CONVEYANCE_CASE_STATES = ['open', 'signed', 'registered', 'closed', 'cancelled'] as const;
export type ConveyanceCaseState = (typeof CONVEYANCE_CASE_STATES)[number];

// ============================================================================
// ΑΠΟΚΛΙΣΕΙΣ (ό,τι αποθηκεύεται πάνω στον κατάλογο)
// ============================================================================

export interface ConveyanceFactAnswer {
  readonly value: boolean;
  readonly answeredBy: string;
  readonly answeredAt: string;
}

export const REVIEW_VERDICTS = ['accepted', 'rejected'] as const;
type ReviewVerdict = (typeof REVIEW_VERDICTS)[number];

/**
 * Έλεγχος γραμμής — **δεμένος στην έκδοση** του αρχείου (`fileFingerprint`).
 * Νέο ανέβασμα / νέα αναθεώρηση ⇒ ο έλεγχος γίνεται αυτόματα `stale`.
 * `fileId: null` = επιβεβαίωση παραλαβής εκτός πλατφόρμας (γραμμές `offline`/`notary_issued`).
 */
export interface ChecklistItemReview {
  readonly verdict: ReviewVerdict;
  readonly fileId: string | null;
  readonly fileFingerprint: string | null;
  /** Ημερομηνία έκδοσης του εγγράφου (YYYY-MM-DD) — βάση της ισχύος (ADR-901 §2 Ε-Δ). */
  readonly issuedOn: string | null;
  /** Λόγος επιστροφής (υποχρεωτικός όταν `rejected`). */
  readonly reason: string | null;
  readonly reviewedBy: string;
  readonly reviewedAt: string;
}

interface ChecklistItemNotApplicable {
  readonly reason: string;
  readonly markedBy: string;
  readonly markedAt: string;
}

export interface ChecklistItemOverride {
  readonly notApplicable?: ChecklistItemNotApplicable;
  readonly review?: ChecklistItemReview;
}

// ============================================================================
// ΤΟ ΕΓΓΡΑΦΟ
// ============================================================================

export interface ConveyanceAppurtenanceRef {
  readonly entityType: 'parking_spot' | 'storage';
  readonly entityId: string;
}

export interface ConveyanceCaseSubject {
  readonly kind: 'property';
  readonly propertyId: string;
  readonly buildingId: string | null;
  readonly projectId: string | null;
  readonly appurtenances: readonly ConveyanceAppurtenanceRef[];
}

export interface ConveyanceCaseParties {
  /** Εταιρεία-πωλητής: η επαφή της νομικής οντότητας του έργου (`project.linkedCompanyId`). */
  readonly seller: { readonly contactId: string | null; readonly kind: 'person' | 'legal_entity' };
  readonly buyers: readonly { readonly contactId: string }[];
}

export interface ConveyanceCase {
  readonly id: string;
  readonly companyId: string;
  readonly subject: ConveyanceCaseSubject;
  readonly profile: ConveyanceProfile;
  readonly parties: ConveyanceCaseParties;
  readonly facts: Readonly<Partial<Record<ConveyanceFactId, ConveyanceFactAnswer>>>;
  readonly overrides: Readonly<Record<string, ChecklistItemOverride>>;
  readonly storedState: StoredCaseState;
  /** Προγραμματισμένη ημέρα υπογραφής (YYYY-MM-DD) — «θα ισχύει τότε;» (Σ-5). */
  readonly targetSigningDate: string | null;
  readonly catalogVersion: string;
  /** Μετρητής CAS — κάθε εντολή δηλώνει την έκδοση που είδε (409 σε σύγκρουση). */
  readonly version: number;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly cancellation: { readonly reason: string; readonly by: string; readonly at: string } | null;
}

// ============================================================================
// ΠΑΡΑΓΟΜΕΝΑ (δεν αποθηκεύονται)
// ============================================================================

/** Αρχείο-τεκμήριο που βρέθηκε για μια γραμμή. */
export interface EvidenceFile {
  readonly fileId: string;
  readonly displayName: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly purpose: string;
  readonly level: EvidenceLevel;
  /** `fileId:revision:updatedAt` — αλλάζει σε κάθε νέα έκδοση/αναθεώρηση. */
  readonly fingerprint: string;
  readonly createdAt: string;
}

const CHECKLIST_ROW_STATUSES = [
  'needs_answer',
  'missing',
  'uploaded',
  'stale',
  'rejected',
  'accepted',
  'expiring',
  'expired',
  'notary_side',
  'not_applicable',
] as const;
export type ChecklistRowStatus = (typeof CHECKLIST_ROW_STATUSES)[number];

export interface ChecklistRow {
  readonly itemId: string;
  readonly item: ChecklistItem;
  readonly section: ChecklistSection;
  readonly provider: ChecklistProvider;
  readonly status: ChecklistRowStatus;
  /** Αρχεία-τεκμήρια, νεότερο πρώτο. */
  readonly files: readonly EvidenceFile[];
  readonly review: ChecklistItemReview | null;
  readonly notApplicable: ChecklistItemNotApplicable | null;
  /** Γιατί δεν εφαρμόζεται: απάντηση σε γεγονός ή ρητή σήμανση. */
  readonly notApplicableBy: 'fact' | 'manual' | null;
  /** Το γεγονός που περιμένει απάντηση (μόνο σε `needs_answer`). */
  readonly pendingFact: ConveyanceFactId | null;
  /** Λήξη ισχύος (YYYY-MM-DD) — μόνο όταν είναι υπολογίσιμη. */
  readonly expiresOn: string | null;
  /** Θα ισχύει την ημέρα υπογραφής; `null` = άγνωστο (χωρίς ημερομηνία ή χωρίς λήξη). */
  readonly validOnSigning: boolean | null;
}

export interface ChecklistSummary {
  /** Γραμμές που εφαρμόζονται (χωρίς `not_applicable` και `needs_answer`). */
  readonly applicable: number;
  /** Ολοκληρωμένες: `accepted` + `notary_side`. */
  readonly complete: number;
  /** Αναμένουν έλεγχο: `uploaded` + `stale`. */
  readonly awaitingReview: number;
  readonly missing: number;
  readonly rejected: number;
  readonly expiring: number;
  readonly expired: number;
  /** Γεγονότα που ΔΕΝ παράγονται από τα δεδομένα και δεν έχουν απαντηθεί. */
  readonly openQuestions: readonly ConveyanceFactId[];
}

export interface DerivedChecklist {
  readonly rows: readonly ChecklistRow[];
  readonly summary: ChecklistSummary;
}

/** Ό,τι επιστρέφει ο server στην καρτέλα: η πράξη + ο παραγόμενος κατάλογος. */
export interface ConveyanceCaseView {
  readonly conveyanceCase: ConveyanceCase;
  readonly state: ConveyanceCaseState;
  /** Γεγονότα που παράχθηκαν από τα δεδομένα (το UI τα δείχνει ως «από τα στοιχεία»). */
  readonly derivedFacts: Readonly<Partial<Record<ConveyanceFactId, boolean>>>;
  /** Όλα τα αρχεία-τεκμήρια — ο client ξανατρέχει τον ίδιο πυρήνα για optimistic updates. */
  readonly evidence: readonly EvidenceFile[];
  readonly checklist: DerivedChecklist;
}
