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

import type { DocumentReference, Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  generateDeterministicOwnershipKaekClaimId,
  generateDeterministicTaxIdentityClaimId,
} from '@/services/enterprise-id.service';
import { readPublicUnitSlot, writePublicUnit, type PublicUnitSlot } from '@/services/places/public-unit-write';
import type { OwnershipVerification } from '@/types/ownership-verification';

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
 */
export function writeClaimLocks(
  db: AdminFirestore,
  tx: Transaction,
  locks: ClaimLocks,
  record: OwnershipVerification,
  taxIdLast3: string,
): void {
  const at = record.decidedAt ?? record.createdAt;
  if (locks.kaekVerificationId !== null && locks.kaekVerificationId !== record.id) {
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
}
