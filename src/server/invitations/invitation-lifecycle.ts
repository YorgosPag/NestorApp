import 'server-only';

/**
 * @fileoverview **Ο ΚΥΚΛΟΣ ΖΩΗΣ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ, ΑΠΟ ΤΗΝ ΠΛΕΥΡΑ ΤΟΥ ΕΚΔΟΤΗ** — έκδοση με supersede,
 * ανάκληση, παρουσιαζόμενη κατάσταση, «ανοίχτηκε». Για **κάθε** είδος.
 * @related ADR-853 §7.1-§7.4 · §20 · ADR-884 Φ0.5
 * @module server/invitations/invitation-lifecycle
 *
 * Ο πυρήνας **δεν ξέρει** πού ζει η συλλογή ούτε ποιος «κατέχει» μια πρόσκληση: το είδος του δίνει τη
 * συλλογή, το ερώτημα «ποιες είναι ζωντανές για τον ίδιο παραλήπτη;» και το κατηγόρημα ιδιοκτησίας.
 */

import type {
  CollectionReference,
  DocumentReference,
  Firestore,
  Query,
  Transaction,
} from 'firebase-admin/firestore';

import { createModuleLogger } from '@/lib/telemetry';
import {
  readStoredInvitationState,
  type InvitationDocumentCore,
  type InvitationRecordCore,
  type InvitationState,
} from '@/types/invitation-core';

const logger = createModuleLogger('invitation-lifecycle');

/** Πόσες ζωντανές προσκλήσεις διαβάζονται για supersede — ένας παραλήπτης δεν έχει ποτέ 20. */
const LIVE_INVITATION_SCAN_LIMIT = 20;

// =============================================================================
// 1. ΕΚΔΟΣΗ — γράψε τη νέα, ανακάλεσε τις παλιές, ΑΤΟΜΙΚΑ
// =============================================================================

/**
 * **Γράψε τη νέα και σβήσε τις παλιές — ΜΕΣΑ σε μία συναλλαγή** (ADR-853 §7.3).
 *
 * 🔴 Το ερώτημα τρέχει **μέσα** στη συναλλαγή (`tx.get(query)`): δύο ταυτόχρονες αποστολές δεν μπορούν να
 * δουν και οι δύο «καμία προηγούμενη» και να αφήσουν **δύο ζωντανά token** — το ελάττωμα του ADR-844.
 * 🔴 Η σειρά είναι υποχρεωτική: το Firestore απαιτεί **όλες** τις αναγνώσεις πριν από κάθε γραφή.
 *
 * @param liveQuery «Οι `pending` προς τον ίδιο παραλήπτη, στον ίδιο εκδότη» — το ορίζει το είδος.
 * @returns πόσες προηγούμενες ζωντανές ανακλήθηκαν.
 */
export async function writeInvitationWithSupersede(
  db: Firestore,
  input: {
    readonly collection: CollectionReference;
    readonly invitation: InvitationRecordCore;
    readonly liveQuery: Query;
    readonly actorUid: string;
    readonly nowValue: string;
  },
): Promise<number> {
  return db.runTransaction(async (tx: Transaction) => {
    const live = await tx.get(input.liveQuery.limit(LIVE_INVITATION_SCAN_LIMIT));

    // ⚠️ Η κατάσταση ξαναδιαβάζεται **fail-closed** και δεν εμπιστευόμαστε το `where`:
    //    ένα έγγραφο με χαλασμένο `state` δεν πρέπει να μετρηθεί ως ζωντανό.
    const stale = live.docs.filter(
      (doc) => readStoredInvitationState((doc.data() as InvitationDocumentCore).state) === 'pending',
    );

    for (const doc of stale) {
      tx.update(input.collection.doc(doc.id), {
        state: 'revoked',
        resolvedAt: input.nowValue,
        resolvedByUid: input.actorUid,
      });
    }

    tx.set(input.collection.doc(input.invitation.id), input.invitation);
    return stale.length;
  });
}

// =============================================================================
// 2. ΑΝΑΚΛΗΣΗ
// =============================================================================

export type RevokeInvitationOutcome =
  | { readonly kind: 'revoked' }
  /** Δεν υπάρχει τέτοια πρόσκληση **σε αυτόν τον εκδότη** — ποτέ «υπάρχει αλλού». */
  | { readonly kind: 'absent' }
  /** Ήδη κλειστή — **καμία** γραφή (ιδεμποτησία· ποτέ σιωπηλή ανατροπή). */
  | { readonly kind: 'already'; readonly state: string };

/**
 * **Ανάκληση** — μόνο πάνω σε `pending`, μέσα σε συναλλαγή.
 *
 * ⚠️ **Ξένο = αδιάκριτο από ανύπαρκτο** (`absent`), ποτέ «υπάρχει αλλά δεν επιτρέπεσαι» — αλλιώς η διαδρομή
 * γίνεται όργανο απαρίθμησης (ADR-787 Ε-5 §4 #1).
 * @param isOwned «ανήκει αυτό το έγγραφο στον εκδότη που ανακαλεί;» — από το είδος (π.χ. ADR-742).
 */
export async function revokeInvitationAt(
  db: Firestore,
  ref: DocumentReference,
  input: {
    readonly isOwned: (stored: InvitationDocumentCore) => boolean;
    readonly revokedByUid: string;
    readonly nowValue: string;
  },
): Promise<RevokeInvitationOutcome> {
  return db.runTransaction(async (tx: Transaction): Promise<RevokeInvitationOutcome> => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { kind: 'absent' };

    const stored = snap.data() as InvitationDocumentCore;
    if (!input.isOwned(stored)) return { kind: 'absent' };

    const state = readStoredInvitationState(stored.state);
    if (state !== 'pending') return { kind: 'already', state };

    tx.update(ref, { state: 'revoked', resolvedAt: input.nowValue, resolvedByUid: input.revokedByUid });
    return { kind: 'revoked' };
  });
}

// =============================================================================
// 3. Η ΚΑΤΑΣΤΑΣΗ ΟΠΩΣ ΤΗ ΒΛΕΠΕΙ Ο ΕΚΔΟΤΗΣ — παράγεται, δεν αντιγράφεται
// =============================================================================

/**
 * 🔴 Μια `pending` με **περασμένη** ώρα παρουσιάζεται ως `expired` — κανείς δεν σκουπίζει τις ληγμένες σε
 * πραγματικό χρόνο, και μια λίστα που λέει «σε αναμονή» για σύνδεσμο **που δεν δουλεύει** κάνει τον εκδότη
 * να περιμένει άνθρωπο που δεν μπορεί να απαντήσει. ⚠️ **Δεν γράφει τίποτα**: μια ανάγνωση δεν αλλάζει τον κόσμο.
 */
export function presentedInvitationState(stored: InvitationDocumentCore, nowValue: string): InvitationState {
  const stateOnDisk = readStoredInvitationState(stored.state);
  const expired = stateOnDisk === 'pending' && Date.parse(stored.expiresAt) <= Date.parse(nowValue);
  return expired ? 'expired' : stateOnDisk;
}

// =============================================================================
// 4. «ΑΝΟΙΧΤΗΚΕ» — ένδειξη, όχι απόδειξη
// =============================================================================

/**
 * Σημειώνει ότι ο σύνδεσμος **ανοίχτηκε** (κατάσταση παράδοσης, ADR-853 §5 #5).
 *
 * ⚠️ **ΕΝΔΕΙΞΗ, ΟΧΙ ΑΠΟΔΕΙΞΗ** (§6 #3): οι πελάτες email προ-φορτώνουν συνδέσμους.
 * ⚠️ **Μη μπλοκάρον και ΠΟΤΕ δεν πετά** — τηλεμετρία παράδοσης.
 * ⚠️ Γράφει **μόνο την πρώτη φορά**, ώστε το «πότε ανοίχτηκε» να μη γίνεται «πότε ξαναφορτώθηκε η σελίδα».
 */
export async function markInvitationOpenedAt(
  db: Firestore,
  ref: DocumentReference,
  nowValue: string,
): Promise<void> {
  try {
    await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const stored = snap.data() as InvitationDocumentCore;
      if (readStoredInvitationState(stored.state) !== 'pending' || stored.openedAt !== null) return;
      tx.update(ref, { openedAt: nowValue });
    });
  } catch (error: unknown) {
    logger.warn('Η σήμανση «ανοίχτηκε» απέτυχε (μη μπλοκάρον)', {
      invitationId: ref.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
