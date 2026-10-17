import 'server-only';

/**
 * @fileoverview **Η ΚΛΕΙΔΑΡΙΑ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ ΧΩΡΙΣ ΛΟΓΑΡΙΑΣΜΟ** — απάντηση με τον σύνδεσμο και μόνο, για **κάθε** είδος.
 * @related ADR-915 §28 Η-Β5 · invitation-redeem.ts (η κλειδαριά **με** λογαριασμό — ίδιοι έλεγχοι, ίδια σειρά) ·
 *          invitation-guards.ts (`refusalOfStoredInvitation`)
 * @module server/invitations/invitation-link-redeem
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΧΩΡΙΣΤΗ ΚΛΕΙΔΑΡΙΑ, ΚΑΙ ΤΙ ΜΟΙΡΑΖΕΤΑΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `redeemInvitation` δίνει **ιδιότητα** σε λογαριασμό (μέλος χώρου · συμμετοχή υπόθεσης), άρα απαιτεί σωστά δεύτερο
 * έλεγχο ταυτότητας: συνδεδεμένος λογαριασμός με το email του παραλήπτη (ADR-853 §7.5). Εδώ η απάντηση **δεν** δίνει
 * τίποτα σε κανέναν λογαριασμό· καταγράφει **μία απάντηση σε ένα αίτημα** — το πρότυπο TrustLayer/myCOI, DocuSign χωρίς
 * access code. Ο κάτοχος του συνδέσμου **διάβασε** το γραμματοκιβώτιο (nonce 128 bit, μόνο το `sha256` στη βάση).
 *
 * Κοινά με την κλειδαριά με λογαριασμό: token → υπογραφή → λήξη (token **και** έγγραφο) → nonce, **ξανά** μέσα στη
 * συναλλαγή (`readInvitationByToken` · `refusalOfStoredInvitation`). Δύο ταυτόχρονα κλικ ⇒ **ένα** αποτέλεσμα: η δεύτερη
 * συναλλαγή βρίσκει κατάσταση που δεν είναι πια `pending` ⇒ `already-used`.
 *
 * ⚠️ **Τι ΔΕΝ προστατεύει** (δηλωμένο, ADR-915 §28 Η-Β6): το **προωθημένο** email. Όποιος κρατά τον σύνδεσμο απαντά.
 * Οι αντισταθμίσεις ζουν στο είδος (δέσμευση στο τρέχον αίτημα · ειδοποίηση του εκδότη · ιστορικό).
 * ⚠️ **Καμία πράξη σε GET**: τα Safe Links ανοίγουν τον σύνδεσμο πριν τον άνθρωπο. Η όψη (`readInvitationByToken` με
 * `recipientEmail: null`) δεν γράφει· μόνο αυτή η συνάρτηση γράφει, και την καλεί **μόνο** POST.
 */

import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';

import { createModuleLogger } from '@/lib/telemetry';
import type { InvitationCoreRefusal, InvitationDocumentCore } from '@/types/invitation-core';

import { refusalOfStoredInvitation } from './invitation-guards';
import { readInvitationByToken, type InvitationAcceptance, type InvitationLocator } from './invitation-redeem';

const logger = createModuleLogger('invitation-link-redeem');

export interface InvitationLinkKind<TDoc extends InvitationDocumentCore, TRecord, TRefusal extends string, TUnavailable extends string, TEffect>
  extends InvitationLocator<TDoc> {
  /** Τι απαντά η εξαργύρωση όταν λείπει **δικό μας** μυστικό — ποτέ «πλαστός σύνδεσμος». */
  readonly secretMissing: TUnavailable;
  /** Το έγγραφο στο σχήμα του είδους — `null` ⇒ `invitation-corrupt`, καμία γραφή. */
  recordOf(stored: TDoc): TRecord | null;
  /**
   * 🔑 **Η κρίση του είδους, ΜΕΣΑ στη συναλλαγή, ΠΡΙΝ από κάθε γραφή** (οι αναγνώσεις του γίνονται εδώ). Άρνηση ⇒ η
   * πρόσκληση μένει `pending`, **καμία** γραφή· `commit` ⇒ ο πυρήνας σφραγίζει την πρόσκληση και καλεί το `write()`.
   */
  onResolve(
    tx: Transaction,
    resolved: { readonly ref: DocumentReference; readonly record: TRecord; readonly target: 'accepted' | 'declined' },
  ): Promise<InvitationAcceptance<TRefusal, TUnavailable, TEffect>>;
}

export type InvitationLinkOutcome<TRecord, TRefusal extends string, TUnavailable extends string, TEffect> =
  | { readonly kind: 'resolved'; readonly target: 'accepted' | 'declined'; readonly invitation: TRecord; readonly effect: TEffect }
  | { readonly kind: 'refused'; readonly reason: InvitationCoreRefusal | TRefusal }
  | { readonly kind: 'unavailable'; readonly reason: TUnavailable | 'invitation-corrupt' };

/** Η σφραγίδα της απάντησης — **κανένας** λογαριασμός: ούτε `resolvedByUid`, ούτε απόδειξη γραμματοκιβωτίου λογαριασμού. */
function resolutionOf(target: 'accepted' | 'declined', nowValue: string) {
  return { state: target, resolvedAt: nowValue, resolvedByUid: null, mailboxProvenAt: null };
}

/**
 * **Απάντηση με τον σύνδεσμο** — ατομική: `pending → accepted|declined` **και** ό,τι γράφει το είδος, αδιαίρετα.
 * Ο προέλεγχος (εκτός συναλλαγής) κόβει φθηνά τα σκουπίδια· η συναλλαγή **ξαναρωτά τα πάντα**.
 */
export async function redeemInvitationByLink<TDoc extends InvitationDocumentCore, TRecord, TRefusal extends string, TUnavailable extends string, TEffect>(
  db: Firestore,
  kind: InvitationLinkKind<TDoc, TRecord, TRefusal, TUnavailable, TEffect>,
  input: { readonly token: string; readonly target: 'accepted' | 'declined'; readonly nowValue: string },
): Promise<InvitationLinkOutcome<TRecord, TRefusal, TUnavailable, TEffect>> {
  const found = await readInvitationByToken(db, kind, { token: input.token, nowValue: input.nowValue, recipientEmail: null });
  if (found.kind === 'secret-missing') {
    logger.error('Λείπει το μυστικό των συνδέσμων — κάθε σύνδεσμος φαίνεται άκυρος', { env: kind.secretEnv });
    return { kind: 'unavailable', reason: kind.secretMissing };
  }
  if (found.kind === 'refused') return found;

  const { ref } = found.location;
  return db.runTransaction<InvitationLinkOutcome<TRecord, TRefusal, TUnavailable, TEffect>>(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { kind: 'refused', reason: 'invitation-unknown' };
    const stored = snap.data() as TDoc;
    if (!found.location.belongs(stored)) return { kind: 'refused', reason: 'invitation-unknown' };
    // 🔴 Κατάσταση · λήξη · nonce — **ξανά**: ο προέλεγχος ήταν συμβουλευτικός. Κανένας παραλήπτης να συγκριθεί (null).
    const refusal = refusalOfStoredInvitation(stored, { nowValue: input.nowValue, nonceHash: found.nonceHash, recipientEmail: null });
    if (refusal !== null) return { kind: 'refused', reason: refusal };

    const record = kind.recordOf(stored);
    if (record === null) return { kind: 'unavailable', reason: 'invitation-corrupt' };
    const decision = await kind.onResolve(tx, { ref, record, target: input.target });
    if (decision.kind !== 'commit') return decision;
    tx.update(ref, { ...resolutionOf(input.target, input.nowValue) });
    return { kind: 'resolved', target: input.target, invitation: record, effect: decision.write() };
  });
}
