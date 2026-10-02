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
import { recordVerificationAudit } from './ownership-verification-record';
import type { OwnershipReviewReason, OwnershipVerification } from '@/types/ownership-verification';

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

type DecisionResult = { readonly outcome: ReviewOutcome; readonly record: OwnershipVerification | null };

const refused = (reason: Extract<ReviewOutcome, { kind: 'refused' }>['reason']): DecisionResult => ({
  outcome: { kind: 'refused', reason },
  record: null,
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
  if (input.decision === 'approve') {
    if (current.kaek === null) return refused('kaek-missing');
    const locks = await readClaimLocks(db, tx, current.kaek, current.claimant.taxId.hmac);
    if (locks.taxIdHolderUid !== null && locks.taxIdHolderUid !== current.uid) return refused('tax-id-claimed-elsewhere');
    writeClaimLocks(db, tx, locks, decided, current.claimant.taxId.last3);
  }
  tx.set(ref, decided);
  return { outcome: { kind: 'decided', status: input.decision === 'approve' ? 'verified' : 'rejected' }, record: decided };
}

/** Η απόφαση του ανθρώπου — ΜΙΑ συναλλαγή, πάνω στις ίδιες κλειδαριές με την αυτόματη κρίση. */
export async function decideOwnershipReview(db: AdminFirestore, input: ReviewInput): Promise<ReviewOutcome> {
  const ref = db.collection(COLLECTIONS.OWNERSHIP_VERIFICATIONS).doc(input.verificationId);
  const result = await db.runTransaction((tx) => applyDecision(db, tx, ref, input));
  if (result.record !== null) await recordVerificationAudit(result.record, 'pending-review');
  return result.outcome;
}
