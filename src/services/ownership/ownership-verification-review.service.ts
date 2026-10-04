/**
 * @module services/ownership/ownership-verification-review.service
 * @description **Η ΟΥΡΑ ΕΛΕΓΧΟΥ της επαλήθευσης κατοχής** (ADR-900 §3.8) — ό,τι η μηχανή δεν απέδειξε, το κρίνει άνθρωπος.
 *
 * Σχήμα Zillow «Don't see your name? → manual review»: ο διαχειριστής βλέπει **τους λόγους** (κλειστό σύνολο),
 * τον υπογράφοντα της σφραγίδας, το όνομα του λογαριασμού και τα 3 τελευταία ψηφία του ΑΦΜ — ανοίγει το ΠΚΑ
 * από τον φάκελο και αποφασίζει.
 *
 * 🔑 **Η έγκριση περνά από τις ΙΔΙΕΣ κλειδαριές** (`ownership-claim-locks.ts`), μέσα σε συναλλαγή:
 * - ΚΑΕΚ σε άλλον ⇒ η έγκριση **είναι** αλλαγή χεριών — η παλιά απόδειξη γίνεται `superseded`·
 * - ΑΦΜ σε άλλον λογαριασμό ⇒ **άρνηση**: ένας άνθρωπος δεν έχει δύο λογαριασμούς κατοχής· πρώτα λύνεται
 *   ο άλλος (ανάκληση), μετά εγκρίνεται αυτός.
 *
 * Μόνο από διαδρομή διαχειριστή (`withAuth`, εσωτερικός χρήστης). Ίχνος σε κάθε απόφαση.
 */

import 'server-only';

import type { DocumentReference, Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { readClaimLocks, writeClaimLocks } from './ownership-claim-locks';
import { announceOwnershipDecision, announceSupersededOwnership } from './ownership-decision-notifier.service';
import { recordVerificationAudit } from './ownership-verification-record';
import type {
  OwnershipReviewReason,
  OwnershipVerification,
  OwnershipVerificationStatus,
} from '@/types/ownership-verification';

/** Πόσες εκκρεμείς φέρνει μία σελίδα της ουράς. */
const REVIEW_PAGE_SIZE = 50;

/** Ό,τι βλέπει ο άνθρωπος της ουράς — ποτέ το HMAC, ποτέ ονόματα δικαιούχων τρίτων. */
export interface OwnershipReviewItem {
  readonly id: string;
  readonly ownerPropertyId: string;
  readonly kaek: string | null;
  readonly reasons: ReadonlyArray<OwnershipReviewReason>;
  readonly sealSigner: string | null;
  readonly sealSignedAt: string | null;
  readonly sealValid: boolean;
  readonly claimantName: string;
  readonly claimantTaxIdLast3: string;
  readonly evidenceFileId: string;
  readonly createdAt: string;
}

function reviewItemOf(record: OwnershipVerification): OwnershipReviewItem {
  return {
    id: record.id,
    ownerPropertyId: record.ownerPropertyId,
    kaek: record.kaek,
    reasons: record.reasons,
    sealSigner: record.seal.signer,
    sealSignedAt: record.seal.signedAt,
    sealValid: record.seal.kind === 'valid',
    claimantName: record.claimant.legalName,
    claimantTaxIdLast3: record.claimant.taxId.last3,
    evidenceFileId: record.evidence.fileId,
    createdAt: record.createdAt,
  };
}

/** Οι εκκρεμείς, παλαιότερη πρώτη (FIFO — όποιος περιμένει περισσότερο κρίνεται πρώτος). */
export async function listPendingOwnershipReviews(db: AdminFirestore): Promise<OwnershipReviewItem[]> {
  // tenant-scope-exempt: ουρά ΔΙΑΧΕΙΡΙΣΤΗ της πλατφόρμας — βλέπει τις εκκρεμείς ΟΛΩΝ εκ σχεδιασμού·
  // η διαδρομή επιτρέπεται μόνο σε εσωτερικό χρήστη.
  const snap = await db
    .collection(COLLECTIONS.OWNERSHIP_VERIFICATIONS)
    .where('status', '==', 'pending-review')
    .orderBy('createdAt', 'asc')
    .limit(REVIEW_PAGE_SIZE)
    .get();
  return snap.docs.map((doc) => reviewItemOf(doc.data() as OwnershipVerification));
}

/** Μια απόδειξη που **μπορεί** να ανακληθεί — η κάρτα της ουράς + η κατάσταση και η ώρα της απόφασης. */
export interface RevocableOwnershipItem extends OwnershipReviewItem {
  readonly status: Extract<OwnershipVerificationStatus, 'verified' | 'superseded'>;
  readonly decidedAt: string | null;
}

/** Ανάκληση από `verified` **ή** `superseded` (ADR-900 §8 #2 Β3) — ό,τι βεβαιώνει ή βεβαίωσε ύπαρξη. */
const REVOCABLE_STATUSES: ReadonlyArray<RevocableOwnershipItem['status']> = ['verified', 'superseded'];

/** Πόσες αποδείξεις φέρνει μία αναζήτηση — ένας ΚΑΕΚ/μία αγγελία έχουν ελάχιστες στην πράξη. */
const SEARCH_LIMIT = 20;

/** Αναζήτηση της ουράς: **ακριβής** ΚΑΕΚ (κανονική μορφή) ή id αγγελίας — ποτέ ελεύθερο κείμενο. */
export type RevocableSearch = { readonly kaek: string } | { readonly ownerPropertyId: string };

/** Οι αποδείξεις που μπορεί να ανακαλέσει ο διαχειριστής, νεότερη απόφαση πρώτη. */
export async function listRevocableOwnerships(
  db: AdminFirestore,
  search: RevocableSearch,
): Promise<RevocableOwnershipItem[]> {
  const verifications = db.collection(COLLECTIONS.OWNERSHIP_VERIFICATIONS);
  // Ουρά ΔΙΑΧΕΙΡΙΣΤΗ της πλατφόρμας (μόνο `super_admin`) — αναζήτηση σε όλους εκ σχεδιασμού.
  // ⚠️ Κυριολεκτικά ονόματα πεδίων (όχι μεταβλητή): οι πύλες δεικτών 3.15/3.91 τα διαβάζουν από τον κώδικα.
  const byKey =
    'kaek' in search
      ? verifications.where('kaek', '==', search.kaek)
      : verifications.where('ownerPropertyId', '==', search.ownerPropertyId);
  const snap = await byKey.where('status', 'in', REVOCABLE_STATUSES).limit(SEARCH_LIMIT).get();
  return snap.docs
    .map((doc) => doc.data() as OwnershipVerification)
    .map((record) => ({
      ...reviewItemOf(record),
      status: record.status as RevocableOwnershipItem['status'],
      decidedAt: record.decidedAt,
    }))
    .sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''));
}

export type ReviewDecision = 'approve' | 'reject';

export type ReviewOutcome =
  | { readonly kind: 'decided'; readonly status: 'verified' | 'rejected' }
  | { readonly kind: 'refused'; readonly reason: 'not-found' | 'not-pending' | 'kaek-missing' | 'tax-id-claimed-elsewhere' };

export interface ReviewInput {
  readonly verificationId: string;
  readonly reviewerUid: string;
  readonly decision: ReviewDecision;
  readonly note: string | null;
  readonly nowIso: string;
}

type DecisionResult = {
  readonly outcome: ReviewOutcome;
  readonly record: OwnershipVerification | null;
  /** Η απόδειξη που έχασε τον ΚΑΕΚ με αυτή την έγκριση — ο κάτοχός της ειδοποιείται (ADR-900 §8 #2 Β3). */
  readonly supersededVerificationId: string | null;
};

const refused = (reason: Extract<ReviewOutcome, { kind: 'refused' }>['reason']): DecisionResult => ({
  outcome: { kind: 'refused', reason },
  record: null,
  supersededVerificationId: null,
});

/** Το σώμα της συναλλαγής: κρίνει την κατάσταση, ελέγχει τις κλειδαριές, γράφει. */
async function applyDecision(
  db: AdminFirestore,
  tx: Transaction,
  ref: DocumentReference,
  input: ReviewInput,
): Promise<DecisionResult> {
  const snap = await tx.get(ref);
  if (!snap.exists) return refused('not-found');
  const current = snap.data() as OwnershipVerification;
  if (current.status !== 'pending-review') return refused('not-pending');

  const decided: OwnershipVerification = {
    ...current,
    status: input.decision === 'approve' ? 'verified' : 'rejected',
    decidedAt: input.nowIso,
    decidedBy: input.reviewerUid,
    reviewNote: input.note,
  };
  let supersededVerificationId: string | null = null;
  if (input.decision === 'approve') {
    if (current.kaek === null) return refused('kaek-missing');
    const locks = await readClaimLocks(db, tx, current.kaek, current.claimant.taxId.hmac, current.ownerPropertyId);
    if (locks.taxIdHolderUid !== null && locks.taxIdHolderUid !== current.uid) return refused('tax-id-claimed-elsewhere');
    ({ supersededVerificationId } = writeClaimLocks(db, tx, locks, decided, current.claimant.taxId.last3));
  }
  tx.set(ref, decided);
  return {
    outcome: { kind: 'decided', status: input.decision === 'approve' ? 'verified' : 'rejected' },
    record: decided,
    supersededVerificationId,
  };
}

/** Η απόφαση του ανθρώπου — ΜΙΑ συναλλαγή, πάνω στις ίδιες κλειδαριές με την αυτόματη κρίση. */
export async function decideOwnershipReview(db: AdminFirestore, input: ReviewInput): Promise<ReviewOutcome> {
  const ref = db.collection(COLLECTIONS.OWNERSHIP_VERIFICATIONS).doc(input.verificationId);
  const result = await db.runTransaction((tx) => applyDecision(db, tx, ref, input));
  if (result.record !== null) {
    await recordVerificationAudit(result.record, 'pending-review');
    await announceOwnershipDecision(db, result.record);
    await announceSupersededOwnership(db, result.supersededVerificationId);
  }
  return result.outcome;
}
