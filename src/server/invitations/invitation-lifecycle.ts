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

import { normaliseChannelEmail } from '@/lib/contact/channel-email';
import { createModuleLogger } from '@/lib/telemetry';
import {
  readStoredInvitationState,
  type InvitationDocumentCore,
  type InvitationRecordCore,
  type InvitationState,
} from '@/types/invitation-core';

import { mintInvitationToken } from './invitation-token';

const logger = createModuleLogger('invitation-lifecycle');

/**
 * Άγκιστρο **μέσα** στη συναλλαγή, μετά τις γραφές — για όποιο είδος πρόσκλησης έχει όψεις που πρέπει να μάθουν την
 * αλλαγή (ADR-901 §14.8: σήμα όψης του οικοδεσπότη, transactional outbox). Καλείται **μόνο** όταν γράφτηκε κάτι.
 */
export type InvitationTxObserver = (tx: Transaction) => void;

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
  input: InvitationSupersedeInput & { readonly observe?: InvitationTxObserver },
): Promise<number> {
  return db.runTransaction(async (tx: Transaction) => {
    const staged = await stageInvitationWithSupersede(tx, input);
    staged.commit();
    input.observe?.(tx);
    return staged.supersededCount;
  });
}

export interface InvitationSupersedeInput {
  readonly collection: CollectionReference;
  readonly invitation: InvitationRecordCore;
  readonly liveQuery: Query;
  readonly actorUid: string;
  readonly nowValue: string;
}

/**
 * **Η ίδια έκδοση-με-supersede, ΜΕΣΑ σε συναλλαγή του καλούντα** (ADR-915 §28 Η-Β4): για είδος που πρέπει να γράψει
 * **και** τη δική του κατάσταση ατομικά με την πρόσκληση (π.χ. «η ανάθεση θυμάται ποιο `invitationId` είναι το
 * τρέχον»). Οι αναγνώσεις γίνονται **εδώ**· το `commit()` γράφει, και ο καλών το καλεί **μετά** από κάθε δική του
 * ανάγνωση (το Firestore απαιτεί όλες τις αναγνώσεις πριν από κάθε γραφή).
 */
export async function stageInvitationWithSupersede(
  tx: Transaction,
  input: InvitationSupersedeInput,
): Promise<{ readonly supersededCount: number; commit(): void }> {
  const revocation = await stageLiveInvitationRevocation(tx, input);
  return {
    supersededCount: revocation.revokedCount,
    commit: () => {
      revocation.commit();
      tx.set(input.collection.doc(input.invitation.id), input.invitation);
    },
  };
}

/**
 * **Ανάκληση κάθε ζωντανής, ΜΕΣΑ σε συναλλαγή του καλούντα — χωρίς νέα πρόσκληση** (ADR-916 Φ-Β): η πράξη που
 * σκοτώνει τον σύνδεσμο στα εισερχόμενα όταν η αφορμή του **έπαψε** (η πώληση ακυρώθηκε · η επαφή έχασε το email της).
 * Το ίδιο σκέλος που κάνει το supersede — ένας κώδικας για «ποιες είναι ζωντανές» και «πώς ανακαλούνται».
 */
export async function stageLiveInvitationRevocation(
  tx: Transaction,
  input: Omit<InvitationSupersedeInput, 'invitation'>,
): Promise<{ readonly revokedCount: number; commit(): void }> {
  const live = await tx.get(input.liveQuery.limit(LIVE_INVITATION_SCAN_LIMIT));

  // ⚠️ Η κατάσταση ξαναδιαβάζεται **fail-closed** και δεν εμπιστευόμαστε το `where`:
  //    ένα έγγραφο με χαλασμένο `state` δεν πρέπει να μετρηθεί ως ζωντανό.
  const stale = live.docs.filter(
    (doc) => readStoredInvitationState((doc.data() as InvitationDocumentCore).state) === 'pending',
  );

  return {
    revokedCount: stale.length,
    commit: () => {
      for (const doc of stale) {
        tx.update(input.collection.doc(doc.id), {
          state: 'revoked',
          resolvedAt: input.nowValue,
          resolvedByUid: input.actorUid,
        });
      }
    },
  };
}

/**
 * **Τα κοινά πεδία μιας νέας πρόσκλησης** — `pending`, κανένα άνοιγμα, καμία επίλυση, κανένας επανεκδομένος σύνδεσμος.
 * Εξήχθη 2026-10-19 (ADR-916 Φ-Β · CHECK 3.28): ζούσε δίδυμο στα είδη έκδοσης και παράδοσης. Το είδος **απλώνει** αυτό
 * και προσθέτει τα δικά του πεδία· το email κανονικοποιείται **εδώ**, μία φορά (κλειδί ιδεμποτησίας και δέσμευσης).
 */
export function newPendingInvitationCore(input: {
  readonly id: string;
  readonly email: string;
  readonly actorUid: string;
  readonly nonceHash: string;
  readonly createdAt: string;
  readonly expiresAtMs: number;
}): InvitationRecordCore & { reissuedNonceHashes: string[] } {
  return {
    id: input.id,
    inviteeEmail: normaliseChannelEmail(input.email),
    invitedByUid: input.actorUid,
    nonceHash: input.nonceHash,
    reissuedNonceHashes: [],
    state: 'pending',
    createdAt: input.createdAt,
    expiresAt: new Date(input.expiresAtMs).toISOString(),
    openedAt: null,
    resolvedAt: null,
    resolvedByUid: null,
    mailboxProvenAt: null,
  };
}

// =============================================================================
// 1β. ΝΕΟΣ ΣΥΝΔΕΣΜΟΣ ΓΙΑ ΤΗΝ ΙΔΙΑ ΠΡΟΣΚΛΗΣΗ (υπενθύμιση · επανάληψη αποστολής)
// =============================================================================

/** Γιατί **δεν** επανεκδίδεται σύνδεσμος — η πρόσκληση δεν ζει πια, ή εξαντλήθηκε το όριο. */
export type InvitationLinkReissueRefusal = 'not-pending' | 'expired' | 'cap-reached';

export type InvitationLinkReissue =
  | { readonly ok: true; readonly token: string; readonly reissuedNonceHashes: readonly string[] }
  | { readonly ok: false; readonly refusal: InvitationLinkReissueRefusal };

/**
 * **Νέος σύνδεσμος για την ΙΔΙΑ πρόσκληση** (ADR-915 §31 — εξήχθη 2026-10-19 με τον δεύτερο καταναλωτή, ADR-916 Φ-Β):
 * ίδιο `invitationId`, **ίδια** λήξη, νέο nonce. Ο ωμός σύνδεσμος δεν αποθηκεύεται ποτέ, άρα κάθε email μετά το πρώτο
 * φέρει νέο· ο σύνδεσμος του πρώτου email **συνεχίζει** να δουλεύει (DocuSign). Μίας χρήσης **αθροιστικά**.
 *
 * ⚠️ **Δεν γράφει**: ο καλών έχει ήδη διαβάσει το έγγραφο **μέσα** στη συναλλαγή του και γράφει το
 * `reissuedNonceHashes` **πριν** φύγει το email — αλλιώς ο σύνδεσμος της υπενθύμισης δεν θα δούλευε.
 * Πετά μόνο αν λείπει το μυστικό (ο καλών δεν στέλνει τίποτα).
 */
export async function mintInvitationLinkReissue(
  stored: Pick<InvitationDocumentCore, 'id' | 'state' | 'expiresAt' | 'reissuedNonceHashes'>,
  input: { readonly secretEnv: string; readonly locator: readonly string[]; readonly cap: number; readonly nowValue: string },
): Promise<InvitationLinkReissue> {
  if (readStoredInvitationState(stored.state) !== 'pending') return { ok: false, refusal: 'not-pending' };
  if (Date.parse(stored.expiresAt) <= Date.parse(input.nowValue)) return { ok: false, refusal: 'expired' };
  const reissued = stored.reissuedNonceHashes ?? [];
  if (reissued.length >= input.cap) return { ok: false, refusal: 'cap-reached' };
  const { token, nonceHash } = await mintInvitationToken(input.secretEnv, {
    id: stored.id, expiresAtMs: Date.parse(stored.expiresAt), locator: input.locator,
  });
  return { ok: true, token, reissuedNonceHashes: [...reissued, nonceHash] };
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
    readonly observe?: InvitationTxObserver;
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
    input.observe?.(tx);
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
  observe?: InvitationTxObserver,
): Promise<void> {
  try {
    await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const stored = snap.data() as InvitationDocumentCore;
      if (readStoredInvitationState(stored.state) !== 'pending' || stored.openedAt !== null) return;
      tx.update(ref, { openedAt: nowValue });
      observe?.(tx);
    });
  } catch (error: unknown) {
    logger.warn('Η σήμανση «ανοίχτηκε» απέτυχε (μη μπλοκάρον)', {
      invitationId: ref.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
