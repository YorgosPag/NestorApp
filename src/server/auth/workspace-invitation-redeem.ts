import 'server-only';

/**
 * @fileoverview **Η ΠΡΟΣΚΛΗΣΗ, ΑΠΟ ΤΗΝ ΠΛΕΥΡΑ ΤΟΥ ΑΝΘΡΩΠΟΥ** — αποδοχή · άρνηση · «ανοίχτηκε».
 * @related ADR-853 §7.4 · §7.5 (δύο έλεγχοι) · Α2/Μ1/Μ2 · άγκυρες Τ1-Τ4
 * @module server/auth/workspace-invitation-redeem
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΔΥΟ ΕΛΕΓΧΟΙ ΤΑΥΤΟΤΗΤΑΣ, ΟΧΙ ΕΝΑΣ (§7.5)
 * ─────────────────────────────────────────────────────────────────────────────
 * Η αποδοχή απαιτεί **ΚΑΙ** έγκυρο υπογεγραμμένο token **ΚΑΙ** συνδεδεμένο χρήστη του
 * οποίου το **επαληθευμένο** email ταιριάζει με τον παραλήπτη.
 *
 * Το token μόνο του **δεν αρκεί**: ένα προωθημένο email θα έδινε σε τρίτον τη θέση που
 * προοριζόταν για άλλον. Εκεί ακριβώς σπάει το **Figma**, που δηλώνει ρητά ότι *δεν*
 * δεσμεύει τον σύνδεσμο σε λογαριασμό («πρόσεξε με ποιον λογαριασμό είσαι»).
 *
 * ⚠️ Και το **επαληθευμένο** κάνει τη μισή δουλειά: χωρίς αυτό, οποιοσδήποτε δηλώνει το
 * email του στόχου σε νέο λογαριασμό και το «ταίριασμα» περνά.
 *
 * 🔑 **ΑΠΟ 2026-09-21 (§15) Η ΙΔΙΑ Η ΠΡΟΣΚΛΗΣΗ ΕΙΝΑΙ Η ΕΠΑΛΗΘΕΥΣΗ** — ο σύνδεσμος φτάνει
 * μόνο στο γραμματοκιβώτιο, άρα ανεπιβεβαίωτος λογαριασμός **με το ίδιο email** που τον
 * κρατά επιβεβαιώνεται μέσω του SSoT `mailbox-proof-custody` (Auth0/Clerk). Η δέσμευση
 * στον παραλήπτη **μένει**: τρίτος με άλλο email παίρνει `wrong-recipient` όπως πριν.
 * Δες `workspace-invitation-redeem-guards.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ Ο ΕΛΕΓΧΟΣ ΜΕΛΟΥΣ ΤΡΕΧΕΙ **ΠΡΙΝ** ΤΗ ΣΥΝΑΛΛΑΓΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο `decideMembership` (ADR-787 §5.1) διαβάζει με **δικό του** χειριστή Firestore, όχι με
 * το `tx`. Κλήση του **μέσα** στο `runTransaction` θα ήταν ανάγνωση που **μοιάζει**
 * μέρος της συναλλαγής και δεν είναι — και θα έσπαγε τον κανόνα «όλες οι αναγνώσεις πριν
 * από κάθε γραφή». Τρέχει πρώτος, ως **συμβουλευτική** άρνηση· η ατομικότητα που έχει
 * σημασία *(μία αποδοχή ⇒ ένα μέλος)* τη δίνει το `pending →` μέσα στη συναλλαγή.
 */

import type { Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { decideMembership } from '@/lib/auth/workspace-membership';
import { nowISO as clockNowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { sha256HexOfText } from '@/lib/hash/sha256';
import { createModuleLogger } from '@/lib/telemetry';
import { decodeSignedToken, requireTokenSecret } from '@/lib/tokens/signed-token';
import { grantWorkspaceMembershipInTx } from '@/lib/workspace/grant-membership';
import { orgWorkspace } from '@/types/workspace-membership';
import {
  isInvitableRole,
  readStoredInvitationState,
  type WorkspaceInvitation,
  type WorkspaceInvitationDocument,
  type WorkspaceInvitationRefusal,
} from '@/types/workspace-invitation';

import type { ProvenMailboxAccount } from './mailbox-proof-custody';
import {
  proveMailboxByInvitation,
  refusalOfStoredInvitation,
  invitationRefusalOfToken,
  WORKSPACE_INVITE_SECRET_ENV as SECRET_ENV,
} from './workspace-invitation-redeem-guards';

const logger = createModuleLogger('workspace-invitation-redeem');

/**
 * Ο άνθρωπος που πατά τον σύνδεσμο — **ήδη συνδεδεμένος**, από το σύνορο HTTP.
 *
 * 🔑 **ΕΙΝΑΙ `ProvenMailboxAccount`** (uid · `emailVerified` · 2ος παράγοντας), γιατί σε αυτόν
 * εφαρμόζεται η απόδειξη γραμματοκιβωτίου (§15). ⚠️ Όλα **από το Firebase Auth**
 * (`getUser(uid)`, μέσω `provenMailboxAccountOf`), **ΟΧΙ** από το ID token ή custom claim:
 * ένα claim `emailVerified` θα ήταν **δεύτερη αυθεντία** (ADR-749), και το token ζει έως
 * μία ώρα.
 */
export interface RedeemingIdentity extends ProvenMailboxAccount {
  /**
   * 🔴 **Το email του λογαριασμού ΣΤΟ AUTH, όχι του ID token** (§15 σύνορο 2): αυτό κρίνεται
   * ως παραλήπτης **και** αυτό επιβεβαιώνεται. Αν ήταν του token, ένα email που άλλαξε μέσα
   * στην ώρα ζωής του θα επιβεβαιωνόταν σε λογαριασμό που δεν το κατέχει πια.
   */
  readonly email: string;
  /** Ο χώρος του **claim** του — για να κριθεί αν είναι ήδη μέλος (ποτέ από τον πελάτη). */
  readonly claimCompanyId: string;
  /**
   * ⚠️ **`null` είναι ο ΣΥΝΗΘΗΣ προσκεκλημένος, όχι η εξαίρεση** (ADR-853 §14): ο νέος
   * άνθρωπος δεν έχει ακόμη ρόλο — τον αποκτά **εδώ**. Αν ο τύπος απαιτούσε ρόλο, η
   * αποδοχή θα ήταν ανέφικτη για τον πληθυσμό για τον οποίο γράφτηκε (§7.1).
   */
  readonly globalRole: string | null;
}

export type RedeemOutcome =
  | { readonly kind: 'accepted'; readonly invitation: WorkspaceInvitation }
  | { readonly kind: 'declined'; readonly invitation: WorkspaceInvitation }
  | { readonly kind: 'refused'; readonly reason: WorkspaceInvitationRefusal }
  /**
   * 🔴 **ΟΥΤΕ ΑΠΟΔΟΧΗ ΟΥΤΕ ΑΡΝΗΣΗ — «ΔΕΝ ΜΠΟΡΕΣΑ ΝΑ ΡΩΤΗΣΩ».**
   *
   * Ξεχωριστό από κάθε `refused` **επίτηδες**: το `decideMembership` επιστρέφει `unknown`
   * όταν η αναζήτηση **απέτυχε**, και το ADR-787 Ε-5 §4 #3 το δηλώνει ρητά — «δεν είσαι
   * μέλος» εκεί θα ήταν **ψέμα στον χρήστη**, και «είσαι» θα ήταν διαρροή. Ο καλών
   * απαντά **500**, όχι ονομασμένη άρνηση.
   */
  | {
      readonly kind: 'unavailable';
      /** `mailbox-proof-unknown`: το Auth δεν απάντησε στην επιβεβαίωση του email (§15). */
      readonly reason: 'membership-unknown' | 'invitation-corrupt' | 'mailbox-proof-unknown';
    };

// =============================================================================
// 1. ΑΠΟΔΟΧΗ
// =============================================================================

/**
 * **Αποδοχή** — ατομική: `pending → accepted` **και** γραφή μέλους, αδιαίρετα (Τ3).
 *
 * 🔴 Δύο ταυτόχρονα κλικ δίνουν **ένα** μέλος και **μία** `accepted`: η δεύτερη συναλλαγή
 * ξαναδιαβάζει κατάσταση που δεν είναι πια `pending` και αρνείται με `already-used`.
 *
 * ⛔ **ΔΕΝ αγγίζει claims** (Μ1 · Α2). Το έγγραφο μέλους γράφεται πάντα· το αν ο άνθρωπος
 * παίρνει **και** `companyId` στο claim το αποφασίζει ο καλών, που είναι ο μόνος που ξέρει
 * αν είχε ήδη χώρο. Εδώ μια απόφαση claim θα **μετακινούσε** μέλος από γραφείο σε γραφείο
 * — η συμπεριφορά που το ADR-853 απέρριψε ονομαστικά.
 */
export async function acceptWorkspaceInvitation(input: {
  readonly token: string;
  readonly identity: RedeemingIdentity;
  readonly nowISOValue?: string;
}): Promise<RedeemOutcome> {
  return redeem(input.token, input.identity, 'accepted', input.nowISOValue ?? clockNowISO());
}

/**
 * **Άρνηση** — ίδια κλειδαριά, καμία γραφή μέλους.
 *
 * 🔑 Είναι **ρητή ανθρώπινη πράξη** και καταγράφεται: ο χώρος βλέπει «απορρίφθηκε» αντί
 * για πρόσκληση που σβήνει σιωπηλά στις 7 μέρες, και δεν ξαναστέλνει στα τυφλά.
 */
export async function declineWorkspaceInvitation(input: {
  readonly token: string;
  readonly identity: RedeemingIdentity;
  readonly nowISOValue?: string;
}): Promise<RedeemOutcome> {
  return redeem(input.token, input.identity, 'declined', input.nowISOValue ?? clockNowISO());
}

// =============================================================================
// 2. Η ΜΙΑ ΚΛΕΙΔΑΡΙΑ
// =============================================================================

async function redeem(
  tokenString: string,
  identity: RedeemingIdentity,
  target: 'accepted' | 'declined',
  nowValue: string,
): Promise<RedeemOutcome> {
  let secret: string;
  try {
    secret = requireTokenSecret(SECRET_ENV);
  } catch {
    // ⚠️ Λείπει ΔΙΚΟ ΜΑΣ μυστικό — δεν το λέμε στον άνθρωπο ως «πλαστός σύνδεσμος».
    logger.error('Λείπει το μυστικό των προσκλήσεων — κάθε σύνδεσμος φαίνεται άκυρος');
    return { kind: 'unavailable', reason: 'membership-unknown' };
  }

  // 🔑 Η υπογραφή ελέγχεται **πριν** από κάθε ανάγνωση: πλαστός σύνδεσμος απορρίπτεται
  //    χωρίς **κανένα** αίτημα στη βάση, οπότε κανείς δεν μας κοστίζει στέλνοντας σκουπίδια.
  const verdict = decodeSignedToken(secret, tokenString, 3);
  if (!verdict.ok) return refuse(invitationRefusalOfToken(verdict.reason));
  if (verdict.fields.length !== 3) return refuse('link-invalid');

  const [invitationId, nonce, expiresAtMs] = verdict.fields as [string, string, string];
  const expiryMs = Number(expiresAtMs);
  if (!Number.isFinite(expiryMs)) return refuse('link-invalid');

  // ⚠️ **ΠΡΩΤΟΣ** από τους δύο ελέγχους λήξης (Τ2). Ο δεύτερος ζει στο έγγραφο, παρακάτω:
  //    ο χρόνος ζει σε δύο μέρη και **και τα δύο** πρέπει να συμφωνούν.
  if (expiryMs <= Date.parse(nowValue)) return refuse('expired');

  // 🔴 **ΤΟ `email-unverified` ΚΑΤΑΡΓΗΘΗΚΕ ΕΔΩ (§15)** — ήταν ο πρώτος έλεγχος, **πριν** από
  //    nonce και έγγραφο: απέρριπτε τον άνθρωπο πριν μάθουμε αν ο σύνδεσμος είναι δικός του,
  //    και τον έστελνε «στη σύνδεση» ενώ ήταν **ήδη** συνδεδεμένος (αδιέξοδο, 21/09).
  const nonceHash = await sha256HexOfText(nonce);
  const checked = await readRedeemableInvitation(invitationId, identity, nowValue, nonceHash);
  if (checked.kind === 'refused') return checked;

  // ⚠️ Η άρνηση **δεν** δίνει τίποτα ⇒ ούτε κριτής μέλους ούτε απόδειξη (§15 σύνορο 3).
  if (target === 'declined') {
    return consume(invitationId, identity, target, { nowValue, nonceHash, mailboxProvenAt: null });
  }

  const ready = await prepareAcceptance(identity, checked.companyId, nowValue);
  if (ready.kind !== 'ready') return ready;
  return consume(invitationId, identity, target, { nowValue, nonceHash, mailboxProvenAt: ready.mailboxProvenAt });
}

/**
 * **Ό,τι χρειάζεται μόνο η αποδοχή** — ο κριτής μέλους, και μετά η απόδειξη.
 *
 * 🔑 **Η απόδειξη είναι ΤΕΛΕΥΤΑΙΑ πριν τη συναλλαγή** (§15 σύνορο 1): κάθε έλεγχος έχει
 * περάσει. Αν χάσει αγώνα με ταυτόχρονο κλικ, το email **μένει** επιβεβαιωμένο — αληθές:
 * ίδιος σύνδεσμος, ίδιος λογαριασμός, ίδια διεύθυνση. ⛔ Ποτέ **μετά** τη συναλλαγή: μέλος
 * με ανεπιβεβαίωτο email δεν θα ξαναδοκιμαζόταν (η πρόσκληση θα ήταν ήδη `accepted`).
 */
async function prepareAcceptance(
  identity: RedeemingIdentity,
  companyId: string,
  nowValue: string,
): Promise<{ readonly kind: 'ready'; readonly mailboxProvenAt: string | null } | RedeemOutcome> {
  const blocked = await refuseIfAlreadyMember(identity, companyId);
  if (blocked !== null) return blocked;

  const proof = await proveMailboxByInvitation(identity, identity.email);
  if (proof === 'unknown') return { kind: 'unavailable', reason: 'mailbox-proof-unknown' };
  return { kind: 'ready', mailboxProvenAt: proof === 'proven-now' ? nowValue : null };
}

/**
 * **Προέλεγχος εκτός συναλλαγής** — ο χώρος (για τον κριτή μέλους) **και** ο ΙΔΙΟΣ έλεγχος
 * με τη συναλλαγή, ώστε η απόδειξη γραμματοκιβωτίου να μην εφαρμοστεί ποτέ σε σύνδεσμο που
 * θα απορριφθεί. ⚠️ Συμβουλευτικός· η συναλλαγή **ξαναρωτά** τα πάντα.
 */
async function readRedeemableInvitation(
  invitationId: string,
  identity: RedeemingIdentity,
  nowValue: string,
  nonceHash: string,
): Promise<{ readonly kind: 'redeemable'; readonly companyId: string } | Extract<RedeemOutcome, { kind: 'refused' }>> {
  const snap = await getAdminFirestore()
    .collection(COLLECTIONS.WORKSPACE_INVITATIONS)
    .doc(invitationId)
    .get();
  if (!snap.exists) return { kind: 'refused', reason: 'invitation-unknown' };

  const stored = snap.data() as WorkspaceInvitationDocument;
  if (typeof stored.companyId !== 'string' || stored.companyId.length === 0) {
    return { kind: 'refused', reason: 'invitation-unknown' };
  }
  const refusal = refusalOfStoredInvitation(stored, { nowValue, nonceHash, recipientEmail: identity.email });
  return refusal === null
    ? { kind: 'redeemable', companyId: stored.companyId }
    : { kind: 'refused', reason: refusal };
}

/**
 * **Είναι ήδη μέλος;** — μέσω του **ΕΝΟΣ** κριτή (ADR-787 §5.1), ποτέ με δεύτερη ανάγνωση.
 *
 * ⚠️ **`'home' | 'member'`, ΚΑΙ ΟΧΙ `isAllowed(verdict)`** — μετρημένη διαφορά: ο
 * `super_admin` παίρνει `platform-bypass`, που **επιτρέπει** χωρίς να υπάρχει έγγραφο
 * μέλους. Με το πλατύ κατηγόρημα, μια **νόμιμη** αποδοχή υπερδιαχειριστή θα απορριπτόταν
 * ως «είσαι ήδη μέλος», και δεν θα γραφόταν ποτέ το έγγραφο που του λείπει.
 */
async function refuseIfAlreadyMember(
  identity: RedeemingIdentity,
  companyId: string,
): Promise<RedeemOutcome | null> {
  const decision = await decideMembership({
    uid: identity.uid,
    claimCompanyId: identity.claimCompanyId,
    globalRole: identity.globalRole,
    requested: orgWorkspace(companyId),
  });

  if (decision.verdict === 'unknown') return { kind: 'unavailable', reason: 'membership-unknown' };
  return decision.verdict === 'home' || decision.verdict === 'member'
    ? refuse('already-member')
    : null;
}

/**
 * **Η κατανάλωση — ατομική** (§7.4). Έλεγχος και σφράγισμα είναι **αδιαίρετα**.
 */
async function consume(
  invitationId: string,
  identity: RedeemingIdentity,
  target: 'accepted' | 'declined',
  seal: { readonly nowValue: string; readonly nonceHash: string; readonly mailboxProvenAt: string | null },
): Promise<RedeemOutcome> {
  const { nowValue, nonceHash } = seal;
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.WORKSPACE_INVITATIONS).doc(invitationId);

  return db.runTransaction<RedeemOutcome>(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return refuse('invitation-unknown');

    const stored = snap.data() as WorkspaceInvitationDocument;
    // 🔴 Κατάσταση · λήξη (Τ2) · nonce · παραλήπτης (§7.5) — **ξανά**, μέσα στη συναλλαγή:
    //    ο προέλεγχος ήταν συμβουλευτικός, η ατομικότητα ζει μόνο εδώ.
    const refusal = refusalOfStoredInvitation(stored, { nowValue, nonceHash, recipientEmail: identity.email });
    if (refusal !== null) return refuse(refusal);

    // 🔴 **Ο ΡΟΛΟΣ ΞΑΝΑΡΩΤΙΕΤΑΙ ΣΤΗΝ ΕΞΑΡΓΥΡΩΣΗ, ΟΧΙ ΜΟΝΟ ΣΤΗΝ ΕΚΔΟΣΗ.** Το Ρ1/Ρ2
    //    κρίθηκαν όταν στάλθηκε η πρόσκληση· εδώ η τιμή έρχεται **από τη βάση**, και ο
    //    τύπος του εγγράφου τη δηλώνει `string` ακριβώς γι' αυτό. Χωρίς αυτόν τον έλεγχο,
    //    ένα αλλοιωμένο `role` θα γινόταν αυτούσιο ο `globalRole` του ανθρώπου — ανύψωση
    //    προνομίων που **καμία** πύλη δεν βλέπει.
    //
    // ⚠️ **`unavailable`, ΟΧΙ ονομασμένη άρνηση**: δεν φταίει ο άνθρωπος και **καμία**
    //    ενέργειά του δεν το διορθώνει. Μια «άρνηση» θα του ζητούσε να κάνει κάτι που δεν
    //    υπάρχει.
    if (!isInvitableRole(stored.role)) {
      logger.error('Πρόσκληση με ρόλο εκτός λεξιλογίου — δεν εξαργυρώνεται', {
        invitationId,
        companyId: stored.companyId,
      });
      return { kind: 'unavailable', reason: 'invitation-corrupt' };
    }
    const role = stored.role;

    const resolved = {
      state: target,
      resolvedAt: nowValue,
      resolvedByUid: identity.uid,
      // 🔑 §15 — το ίχνος της απόδειξης ζει **στην πρόσκληση που την έκανε**: «γιατί
      //    επιβεβαιώθηκε αυτό το email;» απαντιέται από το ίδιο έγγραφο.
      mailboxProvenAt: seal.mailboxProvenAt,
    } as const;
    tx.update(ref, resolved);

    if (target === 'accepted') {
      // 🔑 **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ** (άγκυρα Μ2) — ο ίδιος που καλεί η έγκριση αιτήματος.
      grantWorkspaceMembershipInTx(tx, {
        uid: identity.uid,
        companyId: stored.companyId,
        globalRole: role,
        // 🔴 ADR-853 Ε4 (ADR-867 Β9(β)): ήταν `identity.uid` — το «ποιος τον έβαλε» έλεγε τον
        //    **ίδιο** τον προσκεκλημένο. Ο άνθρωπος που **αποφάσισε** την ένταξη είναι ο
        //    προσκαλών (Slack/GitHub «invited by»)· ο προσκεκλημένος απλώς **δέχτηκε**, και αυτό
        //    το λέει ήδη η πρόσκληση (`resolvedByUid`).
        grantedByUid: stored.invitedByUid,
        enrollment: 'invitation',
      });
    }

    const invitation: WorkspaceInvitation = { ...stored, role, ...resolved, state: target };
    return { kind: target === 'accepted' ? 'accepted' : 'declined', invitation };
  });
}

function refuse(reason: WorkspaceInvitationRefusal): RedeemOutcome {
  return { kind: 'refused', reason };
}

// =============================================================================
// 3. «ΑΝΟΙΧΤΗΚΕ» — ένδειξη, όχι απόδειξη
// =============================================================================

/**
 * Σημειώνει ότι ο σύνδεσμος **ανοίχτηκε** (κατάσταση παράδοσης, §5 #5).
 *
 * ⚠️ **ΕΝΔΕΙΞΗ, ΟΧΙ ΑΠΟΔΕΙΞΗ** (§6 #3): οι πελάτες email προ-φορτώνουν συνδέσμους, οπότε
 * αυτό μπορεί να γράφτηκε από **σαρωτή**. Η οθόνη το λέει με λέξεις.
 *
 * ⚠️ **Μη μπλοκάρον και ΠΟΤΕ δεν πετά**: είναι τηλεμετρία παράδοσης — μια αποτυχία εδώ δεν
 * επιτρέπεται να εμποδίσει τον άνθρωπο να δει την πρόσκλησή του.
 * ⚠️ Γράφει **μόνο την πρώτη φορά**, ώστε το «πότε ανοίχτηκε» να μη γίνεται «πότε
 * ξαναφορτώθηκε η σελίδα».
 */
export async function markWorkspaceInvitationOpened(
  invitationId: string,
  nowISOValue: string = clockNowISO(),
): Promise<void> {
  try {
    const db = getAdminFirestore();
    const ref = db.collection(COLLECTIONS.WORKSPACE_INVITATIONS).doc(invitationId);
    await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const stored = snap.data() as WorkspaceInvitationDocument;
      if (readStoredInvitationState(stored.state) !== 'pending' || stored.openedAt !== null) return;
      tx.update(ref, { openedAt: nowISOValue });
    });
  } catch (error: unknown) {
    logger.warn('Η σήμανση «ανοίχτηκε» απέτυχε (μη μπλοκάρον)', {
      invitationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

