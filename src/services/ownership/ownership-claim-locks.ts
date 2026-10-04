/**
 * @module services/ownership/ownership-claim-locks
 * @description **Οι κλειδαριές μοναδικότητας της κατοχής** (ADR-900 §3.8) — «ένας ΚΑΕΚ = ένας επαληθευμένος
 * λογαριασμός», «ένας ΑΦΜ = ένας λογαριασμός».
 *
 * 🔑 **Ντετερμινιστικά ids** (`okcl_*` από τον κανονικό ΚΑΕΚ · `txic_*` από το HMAC του ΑΦΜ): η μοναδικότητα
 * κρίνεται με `tx.get(doc)` μέσα στη συναλλαγή, **χωρίς ερώτημα** — ίδιο έγγραφο ⇒ η δεύτερη συναλλαγή
 * ξαναπαίζει και βλέπει τον πρώτο κάτοχο. Το σχήμα του κλειδώματος ιδεμποτίας (ADR-853).
 *
 * Τις χρησιμοποιούν **δύο** γραφείς — η υποβολή (αυτόματη κρίση) και η ουρά ελέγχου (απόφαση ανθρώπου) —
 * και γράφουν **το ίδιο** σχήμα από **εδώ**.
 *
 * 🏢 **Και η δημόσια μονάδα γεννιέται ΕΔΩ** (ADR-900 §8 #2, 2β.4 · απόφαση Ε1): η κλειδαριά του ΚΑΕΚ και η
 * μονάδα του ΚΑΕΚ είναι **η ίδια πράξη** — «αυτή η ιδιοκτησία αποδείχθηκε». Δεμένες στο ίδιο ζεύγος
 * ανάγνωσης/εγγραφής, και οι δύο δρόμοι προς `verified` τη γεννούν ατομικά, χωρίς να το θυμάται κανείς.
 */

import 'server-only';

import type { DocumentReference, Firestore as AdminFirestore, Query, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  generateDeterministicOwnershipKaekClaimId,
  generateDeterministicTaxIdentityClaimId,
} from '@/services/enterprise-id.service';
import {
  readPublicUnitSlot,
  retirePublicUnit,
  writePublicUnit,
  type PublicUnitSlot,
} from '@/services/places/public-unit-write';
import {
  REVOCATION_REASONS_VOIDING_EVIDENCE,
  type OwnershipRevocationReason,
  type OwnershipVerification,
  type OwnershipVerificationStatus,
} from '@/types/ownership-verification';

/** Οι καταστάσεις που **βεβαιώνουν ύπαρξη**: η τρέχουσα απόδειξη και όσες τη διαδέχθηκαν έγκυρα. */
const ATTESTING_STATUSES: ReadonlyArray<OwnershipVerificationStatus> = ['verified', 'superseded'];

export interface ClaimLocks {
  readonly kaekRef: DocumentReference | null;
  readonly taxRef: DocumentReference;
  readonly kaekHolderUid: string | null;
  /** Η επαλήθευση που κρατά σήμερα τον ΚΑΕΚ — για να γίνει `superseded` όταν αλλάξει χέρια. */
  readonly kaekVerificationId: string | null;
  readonly taxIdHolderUid: string | null;
  /** Η θέση της δημόσιας μονάδας του ΚΑΕΚ — διαβασμένη **μαζί** με τις κλειδαριές, πριν από κάθε εγγραφή. */
  readonly unitSlot: PublicUnitSlot;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Διαβάζει τις δύο κλειδαριές (και τη θέση της μονάδας) **μέσα** στη συναλλαγή. */
export async function readClaimLocks(
  db: AdminFirestore,
  tx: Transaction,
  kaek: string | null,
  taxIdHmac: string,
  ownerPropertyId: string,
): Promise<ClaimLocks> {
  const kaekRef =
    kaek === null
      ? null
      : db.collection(COLLECTIONS.OWNERSHIP_KAEK_CLAIMS).doc(generateDeterministicOwnershipKaekClaimId(kaek));
  const taxRef = db.collection(COLLECTIONS.TAX_IDENTITY_CLAIMS).doc(generateDeterministicTaxIdentityClaimId(taxIdHmac));
  const kaekSnap = kaekRef === null ? null : await tx.get(kaekRef);
  const taxSnap = await tx.get(taxRef);
  const unitSlot = await readPublicUnitSlot(db, tx, ownerPropertyId, kaek);
  return {
    unitSlot,
    kaekRef,
    taxRef,
    kaekHolderUid: stringOrNull(kaekSnap?.get('uid')),
    kaekVerificationId: stringOrNull(kaekSnap?.get('verificationId')),
    taxIdHolderUid: stringOrNull(taxSnap.get('uid')),
  };
}

/**
 * Γράφει τις κλειδαριές για μια `verified` επαλήθευση — και κάνει `superseded` την επαλήθευση που
 * κρατούσε ως τώρα τον ΚΑΕΚ (ξανα-επαλήθευση του ίδιου ή **αλλαγή χεριών** μετά από απόφαση ανθρώπου).
 * Έτσι υπάρχει **μία** ενεργή απόδειξη ανά ΚΑΕΚ, και ο αναγνώστης δεν βλέπει ποτέ δύο κατόχους.
 *
 * @returns η απόδειξη που έγινε `superseded` (ή `null`) — ώστε ο καλών να ειδοποιήσει τον προηγούμενο κάτοχο
 *   **μετά** τη συναλλαγή (σχήμα Google Business Profile, ADR-900 §8 #2 Β3).
 */
export function writeClaimLocks(
  db: AdminFirestore,
  tx: Transaction,
  locks: ClaimLocks,
  record: OwnershipVerification,
  taxIdLast3: string,
): { readonly supersededVerificationId: string | null } {
  const at = record.decidedAt ?? record.createdAt;
  const supersedes = locks.kaekVerificationId !== null && locks.kaekVerificationId !== record.id;
  if (supersedes && locks.kaekVerificationId !== null) {
    tx.update(db.collection(COLLECTIONS.OWNERSHIP_VERIFICATIONS).doc(locks.kaekVerificationId), {
      status: 'superseded',
      decidedAt: at,
      decidedBy: record.decidedBy,
    });
  }
  if (locks.kaekRef !== null && record.kaek !== null) {
    tx.set(locks.kaekRef, {
      kaek: record.kaek,
      uid: record.uid,
      ownerPropertyId: record.ownerPropertyId,
      verificationId: record.id,
      claimedAt: at,
    });
    // Ίδια συνθήκη με την κλειδαριά: καμία μονάδα χωρίς απόδειξη, καμία απόδειξη χωρίς μονάδα.
    writePublicUnit(tx, locks.unitSlot, at);
  }
  tx.set(locks.taxRef, { uid: record.uid, last3: taxIdLast3, claimedAt: at });
  return { supersededVerificationId: supersedes ? locks.kaekVerificationId : null };
}

// ─── Η ΑΝΑΚΛΗΣΗ (ADR-900 §8 #2, Β3) — το αντίστροφο ζεύγος, πάνω στις ΙΔΙΕΣ κλειδαριές ────────────────

export interface ReleaseLocks {
  /** Η κλειδαριά του ΚΑΕΚ — **μόνο** αν δείχνει σε αυτή την απόδειξη (έλεγχος ταύτισης). */
  readonly kaekRef: DocumentReference | null;
  /** Η κλειδαριά του ΑΦΜ — **μόνο** αν ο άνθρωπος δεν έχει άλλη ενεργή απόδειξη. */
  readonly taxRef: DocumentReference | null;
  /** Η μονάδα — `none` εκτός αν έπεσε η **τελευταία** έγκυρη βεβαίωση ύπαρξης του ΚΑΕΚ. */
  readonly unitSlot: PublicUnitSlot;
}

const NOTHING_TO_RETIRE: PublicUnitSlot = { kind: 'none' };

/** Μένει άλλη απόδειξη (εκτός της ανακαλούμενης) που ταιριάζει; — ερώτημα **μέσα** στη συναλλαγή. */
async function anotherProofExists(
  tx: Transaction,
  query: Query,
  excludedId: string,
): Promise<boolean> {
  const snap = await tx.get(query.limit(2));
  return snap.docs.some((doc) => doc.id !== excludedId);
}

/**
 * **Πιο αυστηρό από το UPRN**: η ύπαρξη στέκει όσο υπάρχει **έστω μία** έγκυρη βεβαίωση. Ο Α (έγκυρο ΠΚΑ,
 * σήμερα `superseded`) → ο Β (πλαστό) ανακαλείται ⇒ η μονάδα **μένει**· την είχε ήδη αποδείξει ο Α.
 */
async function readUnitToRetire(
  db: AdminFirestore,
  tx: Transaction,
  record: OwnershipVerification,
  reason: OwnershipRevocationReason,
): Promise<PublicUnitSlot> {
  if (record.kaek === null || !REVOCATION_REASONS_VOIDING_EVIDENCE.has(reason)) return NOTHING_TO_RETIRE;
  // tenant-scope-exempt: ο ΚΑΕΚ είναι γεγονός του ΚΟΣΜΟΥ (επίπεδο Α) — η ερώτηση «το βεβαίωσε άλλος;» είναι
  // εκ σχεδιασμού διασταυρωμένη· server μόνο, το αποτέλεσμα δεν φεύγει ποτέ προς πελάτη.
  const attestations = db
    .collection(COLLECTIONS.OWNERSHIP_VERIFICATIONS)
    .where('kaek', '==', record.kaek)
    .where('status', 'in', ATTESTING_STATUSES);
  if (await anotherProofExists(tx, attestations, record.id)) return NOTHING_TO_RETIRE;
  return readPublicUnitSlot(db, tx, record.ownerPropertyId, record.kaek);
}

/** Οι αναγνώσεις της ανάκλησης — **όλες** πριν από κάθε εγγραφή. */
export async function readReleaseLocks(
  db: AdminFirestore,
  tx: Transaction,
  record: OwnershipVerification,
  reason: OwnershipRevocationReason,
): Promise<ReleaseLocks> {
  const kaekCandidate =
    record.kaek === null
      ? null
      : db.collection(COLLECTIONS.OWNERSHIP_KAEK_CLAIMS).doc(generateDeterministicOwnershipKaekClaimId(record.kaek));
  const kaekSnap = kaekCandidate === null ? null : await tx.get(kaekCandidate);
  const holdsKaek = kaekSnap?.get('verificationId') === record.id;

  const taxCandidate = db
    .collection(COLLECTIONS.TAX_IDENTITY_CLAIMS)
    .doc(generateDeterministicTaxIdentityClaimId(record.claimant.taxId.hmac));
  const taxSnap = await tx.get(taxCandidate);
  const otherActive = db
    .collection(COLLECTIONS.OWNERSHIP_VERIFICATIONS)
    .where('uid', '==', record.uid)
    .where('status', '==', 'verified');
  const releasesTax = taxSnap.get('uid') === record.uid && !(await anotherProofExists(tx, otherActive, record.id));

  return {
    kaekRef: holdsKaek ? kaekCandidate : null,
    taxRef: releasesTax ? taxCandidate : null,
    unitSlot: await readUnitToRetire(db, tx, record, reason),
  };
}

/** Οι εγγραφές της ανάκλησης: κλειδαριές ελεύθερες, μονάδα `historical` όταν έπεσε η τελευταία βεβαίωση. */
export function releaseClaimLocks(tx: Transaction, locks: ReleaseLocks, at: string): { readonly unitRetired: boolean } {
  if (locks.kaekRef !== null) tx.delete(locks.kaekRef);
  if (locks.taxRef !== null) tx.delete(locks.taxRef);
  return { unitRetired: retirePublicUnit(tx, locks.unitSlot, at) };
}
