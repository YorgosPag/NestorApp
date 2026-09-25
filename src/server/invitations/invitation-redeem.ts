import 'server-only';

/**
 * @fileoverview **Η ΜΙΑ ΚΛΕΙΔΑΡΙΑ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ** — αποδοχή · άρνηση · όψη, για **κάθε** είδος.
 * @related ADR-853 §7.4 · §7.5 · §15 · §20 · ADR-884 Φ0.5 · άγκυρες Τ1-Τ4 / Ψ1-Ψ8 (χώρου)
 * @module server/invitations/invitation-redeem
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΕΙΝΑΙ ΚΟΙΝΟ ΚΑΙ ΤΙ ΔΙΝΕΙ ΤΟ ΕΙΔΟΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Κοινό: υπογραφή → λήξη (token) → έγγραφο → κατάσταση · λήξη · nonce · παραλήπτης → απόδειξη
 * γραμματοκιβωτίου **τελευταία** πριν τη συναλλαγή → συναλλαγή που **ξαναρωτά τα πάντα**.
 * Το είδος ({@link InvitationKind}) δίνει μόνο: **πού** ζει το έγγραφο, τι ελέγχεται **πριν** τη συναλλαγή
 * (π.χ. «ήδη μέλος;»), πώς διαβάζεται το δικό του σχήμα, και **τι γράφει η αποδοχή** — στην **ίδια**
 * συναλλαγή με το `pending → accepted` (ένα κλικ ⇒ ένα αποτέλεσμα, δύο κλικ ⇒ ένα αποτέλεσμα).
 *
 * 🔴 **ΔΥΟ ΕΛΕΓΧΟΙ ΤΑΥΤΟΤΗΤΑΣ, ΟΧΙ ΕΝΑΣ** (§7.5): υπογεγραμμένο token **ΚΑΙ** συνδεδεμένος λογαριασμός με
 * email **στο Auth** ίδιο με τον παραλήπτη. Το token μόνο του δεν αρκεί — εκεί σπάει το Figma.
 */

import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';

import { createModuleLogger } from '@/lib/telemetry';
import type { ProvenMailboxAccount } from '@/server/auth/mailbox-proof-custody';
import type {
  InvitationCoreRefusal,
  InvitationDocumentCore,
  InvitationRecordCore,
} from '@/types/invitation-core';

import { proveMailboxByInvitation, refusalOfStoredInvitation } from './invitation-guards';
import { readInvitationToken } from './invitation-token';

const logger = createModuleLogger('invitation-redeem');

// =============================================================================
// 1. ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΟΥ ΕΙΔΟΥΣ
// =============================================================================

/**
 * Ο άνθρωπος που πατά τον σύνδεσμο — **ήδη συνδεδεμένος**, από το σύνορο HTTP. ⚠️ Όλα **από το Firebase
 * Auth** (`provenMailboxAccountOf`), ποτέ από το ID token ή custom claim.
 */
export interface InvitationRedeemer extends ProvenMailboxAccount {
  /** 🔴 Το email του λογαριασμού **στο Auth** — αυτό κρίνεται ως παραλήπτης **και** αυτό επιβεβαιώνεται. */
  readonly email: string;
}

/** Η επίλυση που γράφεται στο έγγραφο της πρόσκλησης. */
export interface InvitationResolution {
  readonly state: 'accepted' | 'declined';
  readonly resolvedAt: string;
  readonly resolvedByUid: string;
  readonly mailboxProvenAt: string | null;
}

export type InvitationRedeemOutcome<TRecord, TRefusal extends string, TUnavailable extends string> =
  | { readonly kind: 'accepted'; readonly invitation: TRecord }
  | { readonly kind: 'declined'; readonly invitation: TRecord }
  | { readonly kind: 'refused'; readonly reason: InvitationCoreRefusal | TRefusal }
  /**
   * 🔴 **«ΔΕΝ ΜΠΟΡΕΣΑ ΝΑ ΡΩΤΗΣΩ»** — ούτε αποδοχή ούτε άρνηση. `invitation-corrupt`: το έγγραφο δεν
   * διαβάζεται στο σχήμα του είδους· `mailbox-proof-unknown`: το Auth δεν απάντησε (§15). Ο καλών απαντά 5xx.
   */
  | { readonly kind: 'unavailable'; readonly reason: TUnavailable | 'invitation-corrupt' | 'mailbox-proof-unknown' };

/** Άρνηση ή «δεν μπόρεσα» του **είδους**, πριν τη συναλλαγή (π.χ. «είσαι ήδη μέλος»). */
export type InvitationPrecheck<TRefusal extends string, TUnavailable extends string> =
  | { readonly kind: 'refused'; readonly reason: TRefusal }
  | { readonly kind: 'unavailable'; readonly reason: TUnavailable };

/**
 * **Πού ζει** μια πρόσκληση — και το κριτήριο «ανήκει όντως εκεί;».
 *
 * 🔴 Το `belongs` είναι **μέρος του εντοπισμού**, όχι προαιρετικός έλεγχος: η υπογραφή λέει ότι **εμείς**
 * φτιάξαμε τον σύνδεσμο, όχι ότι ο κόσμος είναι ακόμη όπως τότε. Πρόσκληση που δεν ανήκει πια εκεί (χώρος
 * χωρίς εκδότη · περιήγηση που άλλαξε κάτοχο) είναι **αδιάκριτη από ανύπαρκτη** ⇒ `invitation-unknown`. Κρίνεται
 * στην όψη, στον προέλεγχο **και** μέσα στη συναλλαγή.
 */
export interface InvitationLocation<TDoc extends InvitationDocumentCore = InvitationDocumentCore> {
  readonly ref: DocumentReference;
  belongs(stored: TDoc): boolean;
}

/** **Πού ζει** μια πρόσκληση αυτού του είδους — αρκεί για την όψη. */
export interface InvitationLocator<TDoc extends InvitationDocumentCore = InvitationDocumentCore> {
  /** Το όνομα του env με το μυστικό — **δικό του** ανά είδος (δες `invitation-token.ts`). */
  readonly secretEnv: string;
  /** Πόσα πεδία locator ακολουθούν το τριπλό `[id, nonce, expMs]` στο token. */
  readonly locatorCount: number;
  /** Το έγγραφο — `null` ⇒ `invitation-unknown`. Καμία διαδρομή από τον πελάτη: μόνο το υπογεγραμμένο token. */
  locate(db: Firestore, invitationId: string, locator: readonly string[]): Promise<InvitationLocation<TDoc> | null>;
}

export interface InvitationKind<
  TDoc extends InvitationDocumentCore,
  TRecord extends InvitationRecordCore,
  TIdentity extends InvitationRedeemer,
  TRefusal extends string,
  TUnavailable extends string,
> extends InvitationLocator<TDoc> {
  /** Τι απαντά η εξαργύρωση όταν λείπει το μυστικό — ποτέ «πλαστός σύνδεσμος». */
  readonly secretMissing: TUnavailable;
  /** Ό,τι κρίνει **μόνο η αποδοχή**, πριν τη συναλλαγή — `null` ⇒ προχώρα. Συμβουλευτικό: η συναλλαγή ξαναρωτά. */
  prepareAcceptance?(identity: TIdentity, stored: TDoc): Promise<InvitationPrecheck<TRefusal, TUnavailable> | null>;
  /** Το έγγραφο **στο σχήμα του είδους**, με την επίλυση — `null` ⇒ `invitation-corrupt` (καμία γραφή). */
  recordOf(stored: TDoc, resolution: InvitationResolution): TRecord | null;
  /** 🔑 **Το άγκιστρο «αποδοχή → γράψε»** — μέσα στην **ίδια** συναλλαγή με το `pending → accepted`. */
  onAccept(tx: Transaction, accepted: { readonly ref: DocumentReference; readonly record: TRecord; readonly identity: TIdentity }): void;
}

// =============================================================================
// 2. ΑΠΟ ΤΟ TOKEN ΣΤΟ ΕΓΓΡΑΦΟ — κοινό για όψη και εξαργύρωση
// =============================================================================

type InvitationByToken<TDoc extends InvitationDocumentCore> =
  | {
      readonly kind: 'found';
      readonly invitationId: string;
      readonly location: InvitationLocation<TDoc>;
      readonly stored: TDoc;
      readonly nonceHash: string;
    }
  | { readonly kind: 'refused'; readonly reason: InvitationCoreRefusal }
  | { readonly kind: 'secret-missing' };

/**
 * **Token → έγγραφο → οι κοινοί έλεγχοι.** Η υπογραφή κρίνεται **πριν** από κάθε ανάγνωση βάσης.
 * @param recipientEmail ο συνδεδεμένος — `null` στην **όψη** (δεν υπάρχει ακόμη ταυτότητα· η όψη δεν γράφει).
 */
export async function readInvitationByToken<TDoc extends InvitationDocumentCore>(
  db: Firestore,
  kind: InvitationLocator<TDoc>,
  input: { readonly token: string; readonly nowValue: string; readonly recipientEmail: string | null },
): Promise<InvitationByToken<TDoc>> {
  const reading = await readInvitationToken(kind.secretEnv, input.token, kind.locatorCount, input.nowValue);
  if (reading.kind !== 'read') return reading;

  const location = await kind.locate(db, reading.invitationId, reading.locator);
  const snap = location === null ? null : await location.ref.get();
  if (location === null || snap === null || !snap.exists) return { kind: 'refused', reason: 'invitation-unknown' };

  const stored = snap.data() as TDoc;
  if (!location.belongs(stored)) return { kind: 'refused', reason: 'invitation-unknown' };
  const refusal = refusalOfStoredInvitation(stored, {
    nowValue: input.nowValue,
    nonceHash: reading.nonceHash,
    recipientEmail: input.recipientEmail,
  });
  if (refusal !== null) return { kind: 'refused', reason: refusal };
  return { kind: 'found', invitationId: reading.invitationId, location, stored, nonceHash: reading.nonceHash };
}

// =============================================================================
// 3. Η ΕΞΑΡΓΥΡΩΣΗ
// =============================================================================

interface RedeemInvitationInput<TIdentity extends InvitationRedeemer> {
  readonly token: string;
  readonly identity: TIdentity;
  readonly target: 'accepted' | 'declined';
  readonly nowValue: string;
}

/**
 * **Αποδοχή ή άρνηση** — ατομική: `pending → accepted|declined` **και** ό,τι γράφει το είδος, αδιαίρετα.
 * 🔴 Δύο ταυτόχρονα κλικ δίνουν **ένα** αποτέλεσμα: η δεύτερη συναλλαγή βρίσκει κατάσταση που δεν είναι πια
 * `pending` και αρνείται με `already-used`.
 */
export async function redeemInvitation<
  TDoc extends InvitationDocumentCore,
  TRecord extends InvitationRecordCore,
  TIdentity extends InvitationRedeemer,
  TRefusal extends string,
  TUnavailable extends string,
>(
  db: Firestore,
  kind: InvitationKind<TDoc, TRecord, TIdentity, TRefusal, TUnavailable>,
  input: RedeemInvitationInput<TIdentity>,
): Promise<InvitationRedeemOutcome<TRecord, TRefusal, TUnavailable>> {
  const found = await readInvitationByToken(db, kind, {
    token: input.token,
    nowValue: input.nowValue,
    recipientEmail: input.identity.email,
  });
  if (found.kind === 'secret-missing') {
    // ⚠️ Λείπει ΔΙΚΟ ΜΑΣ μυστικό — δεν το λέμε στον άνθρωπο ως «πλαστός σύνδεσμος».
    logger.error('Λείπει το μυστικό των προσκλήσεων — κάθε σύνδεσμος φαίνεται άκυρος', { env: kind.secretEnv });
    return { kind: 'unavailable', reason: kind.secretMissing };
  }
  if (found.kind === 'refused') return found;

  // ⚠️ Η άρνηση **δεν** δίνει τίποτα ⇒ ούτε έλεγχοι του είδους ούτε απόδειξη (§15 σύνορο 3).
  if (input.target === 'declined') return consume(db, kind, found, input, null);

  const ready = await readyForAcceptance(kind, found.stored, input);
  if (ready.kind !== 'ready') return ready;
  return consume(db, kind, found, input, ready.mailboxProvenAt);
}

/**
 * **Ό,τι χρειάζεται μόνο η αποδοχή** — οι έλεγχοι του είδους, η αναγνωσιμότητα, και **μετά** η απόδειξη.
 *
 * 🔑 **Η απόδειξη είναι ΤΕΛΕΥΤΑΙΑ πριν τη συναλλαγή** (§15 σύνορο 1): σύνδεσμος που θα απορριφθεί — ή έγγραφο
 * που δεν διαβάζεται — δεν αποδεικνύει τίποτα. Αν χάσει αγώνα με ταυτόχρονο κλικ, το email **μένει**
 * επιβεβαιωμένο — αληθές: ίδιος σύνδεσμος, ίδιος λογαριασμός, ίδια διεύθυνση.
 */
async function readyForAcceptance<
  TDoc extends InvitationDocumentCore,
  TRecord extends InvitationRecordCore,
  TIdentity extends InvitationRedeemer,
  TRefusal extends string,
  TUnavailable extends string,
>(
  kind: InvitationKind<TDoc, TRecord, TIdentity, TRefusal, TUnavailable>,
  stored: TDoc,
  input: RedeemInvitationInput<TIdentity>,
): Promise<{ readonly kind: 'ready'; readonly mailboxProvenAt: string | null } | InvitationRedeemOutcome<TRecord, TRefusal, TUnavailable>> {
  const blocked = kind.prepareAcceptance ? await kind.prepareAcceptance(input.identity, stored) : null;
  if (blocked !== null) return blocked;

  const probe = kind.recordOf(stored, resolutionOf(input, null));
  if (probe === null) return { kind: 'unavailable', reason: 'invitation-corrupt' };

  const proof = await proveMailboxByInvitation(input.identity, input.identity.email);
  if (proof === 'unknown') return { kind: 'unavailable', reason: 'mailbox-proof-unknown' };
  return { kind: 'ready', mailboxProvenAt: proof === 'proven-now' ? input.nowValue : null };
}

function resolutionOf(
  input: RedeemInvitationInput<InvitationRedeemer>,
  mailboxProvenAt: string | null,
): InvitationResolution {
  // 🔑 §15 — το ίχνος της απόδειξης ζει **στην πρόσκληση που την έκανε**.
  return { state: input.target, resolvedAt: input.nowValue, resolvedByUid: input.identity.uid, mailboxProvenAt };
}

/** **Η κατανάλωση — ατομική** (§7.4). Έλεγχος και σφράγισμα είναι **αδιαίρετα**. */
async function consume<
  TDoc extends InvitationDocumentCore,
  TRecord extends InvitationRecordCore,
  TIdentity extends InvitationRedeemer,
  TRefusal extends string,
  TUnavailable extends string,
>(
  db: Firestore,
  kind: InvitationKind<TDoc, TRecord, TIdentity, TRefusal, TUnavailable>,
  found: { readonly location: InvitationLocation<TDoc>; readonly nonceHash: string },
  input: RedeemInvitationInput<TIdentity>,
  mailboxProvenAt: string | null,
): Promise<InvitationRedeemOutcome<TRecord, TRefusal, TUnavailable>> {
  const { ref } = found.location;
  return db.runTransaction<InvitationRedeemOutcome<TRecord, TRefusal, TUnavailable>>(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { kind: 'refused', reason: 'invitation-unknown' };

    const stored = snap.data() as TDoc;
    if (!found.location.belongs(stored)) return { kind: 'refused', reason: 'invitation-unknown' };
    // 🔴 Κατάσταση · λήξη (Τ2) · nonce · παραλήπτης (§7.5) — **ξανά**: ο προέλεγχος ήταν συμβουλευτικός.
    const refusal = refusalOfStoredInvitation(stored, {
      nowValue: input.nowValue,
      nonceHash: found.nonceHash,
      recipientEmail: input.identity.email,
    });
    if (refusal !== null) return { kind: 'refused', reason: refusal };

    // 🔴 Το σχήμα του είδους ξαναρωτιέται **από τη βάση**, πριν από κάθε γραφή: αλλοιωμένο έγγραφο ⇒
    //    `unavailable`, ποτέ αυτούσια τιμή στον γραφέα (ανύψωση προνομίων που καμία πύλη δεν βλέπει).
    const resolution = resolutionOf(input, mailboxProvenAt);
    const record = kind.recordOf(stored, resolution);
    if (record === null) return { kind: 'unavailable', reason: 'invitation-corrupt' };

    tx.update(ref, { ...resolution });
    if (input.target === 'accepted') kind.onAccept(tx, { ref, record, identity: input.identity });
    return { kind: input.target, invitation: record };
  });
}
