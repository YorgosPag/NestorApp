import 'server-only';

/**
 * @fileoverview **ΟΙ ΕΛΕΓΧΟΙ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ, ΜΙΑ ΦΟΡΑ — ΚΑΙ Η ΠΡΟΣΚΛΗΣΗ ΩΣ ΑΠΟΔΕΙΞΗ
 * ΓΡΑΜΜΑΤΟΚΙΒΩΤΙΟΥ** (ADR-853 §15 · ADR-844 §13).
 * @related server/auth/workspace-invitation-redeem.ts (ο καλών) ·
 *          server/auth/mailbox-proof-custody.ts (το SSoT της απόδειξης)
 * @module server/auth/workspace-invitation-redeem-guards
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ Ο ΣΥΝΔΕΣΜΟΣ ΑΠΟΔΕΙΚΝΥΕΙ ΤΟ ΓΡΑΜΜΑΤΟΚΙΒΩΤΙΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο σύνδεσμος φέρει υπογραφή του διακομιστή **και** nonce 128 bit που υπάρχει **μόνο** στο
 * email που στάλθηκε — στη βάση ζει μόνο το `sha256` του. Άρα όποιος τον κρατά **διάβασε**
 * εκείνο το γραμματοκιβώτιο. Αυτό λέει και η αγορά:
 * - Auth0 Organizations: *«When a user accepts an invitation, their email address will be
 *   marked as verified»*.
 * - Clerk: *«the user's email address will be automatically verified because of the
 *   invitation token»*.
 * - Better Auth, GHSA-fmh4-wcc4-5jm3 (v1.6.14): η απαίτηση επιβεβαιωμένου email έμεινε
 *   **μόνο** για προβλέψιμα αναγνωριστικά· για **αδιαφανή** η κατοχή του συνδέσμου αρκεί.
 * Το GitHub αντίθετα απαιτεί επιβεβαιωμένο email πριν την αποδοχή — και το τίμημα είναι
 * ακριβώς το αδιέξοδο που βρήκε το ζωντανό περπάτημα (ADR-853 §13, 21/09).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΑ ΤΡΙΑ ΣΥΝΟΡΑ ΠΟΥ ΤΗΝ ΚΑΝΟΥΝ ΑΣΦΑΛΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. **Αφού περάσουν ΟΛΟΙ οι έλεγχοι** — υπογραφή, λήξη, `pending`, nonce, παραλήπτης,
 *    μέλος. Σύνδεσμος που θα απορριφθεί δεν αποδεικνύει τίποτα.
 * 2. **Ο παραλήπτης είναι το email του λογαριασμού στο Auth**, όχι του ID token: το token
 *    ζει έως μία ώρα, και ένα email που άλλαξε στο μεταξύ θα επιβεβαιωνόταν σε λογαριασμό
 *    που δεν το κατέχει πια (ο καλών το εγγυάται — δες το `route.ts`).
 * 3. **Μόνο στην αποδοχή.** Η άρνηση δεν δίνει τίποτα, άρα δεν αλλάζει και τον λογαριασμό.
 *
 * ⚠️ **ΤΟ `claimed` ΕΙΝΑΙ ΔΟΜΙΚΑ ΑΝΕΦΙΚΤΟ ΕΔΩ**: ο λογαριασμός είναι **ο ίδιος** ο
 * συνδεδεμένος (όχι αποτέλεσμα `getUserByEmail`), άρα ο κάτοχος της συνεδρίας είναι πάντα ο
 * λογαριασμός ⇒ `verified-by-holder`. Και **δεν δίνουμε συνεδρία** — ο άνθρωπος μπήκε ήδη
 * από τη δική του πόρτα, με τον 2ο παράγοντά του αν έχει ⇒ το `mailboxProofMaySignIn` δεν
 * έχει τι να κρίνει.
 */

import { sameChannelEmail } from '@/lib/contact/channel-email';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { equalsInConstantTime } from '@/lib/tokens/signed-token';
import {
  readStoredInvitationState,
  type WorkspaceInvitationDocument,
  type WorkspaceInvitationRefusal,
  type WorkspaceInvitationState,
} from '@/types/workspace-invitation';

import { settleProvenMailbox, type ProvenMailboxAccount } from './mailbox-proof-custody';

const logger = createModuleLogger('workspace-invitation-redeem-guards');

/**
 * Το μυστικό των συνδέσμων — **ένα** όνομα για εξαργύρωση **και** όψη.
 * ⚠️ Ίδιο με του εκδότη — και **ποτέ** κοινό με άλλη πύλη (δες `workspace-invitation.ts`).
 */
export const WORKSPACE_INVITE_SECRET_ENV = 'WORKSPACE_INVITE_SECRET';

/** Η αποθηκευμένη κατάσταση → ο λόγος που βλέπει ο άνθρωπος. */
const REFUSAL_BY_STATE: Readonly<Record<Exclude<WorkspaceInvitationState, 'pending'>, WorkspaceInvitationRefusal>> = {
  accepted: 'already-used',
  declined: 'already-used',
  revoked: 'revoked',
  expired: 'expired',
};

// =============================================================================
// 1. ΟΙ ΕΛΕΓΧΟΙ ΤΟΥ ΕΓΓΡΑΦΟΥ — μία συνάρτηση, τρεις αναγνώστες
// =============================================================================

export interface StoredInvitationCheck {
  readonly nowValue: string;
  readonly nonceHash: string;
  /**
   * Το email του ανθρώπου που απαντά — ή `null` στην **όψη**, όπου δεν υπάρχει ακόμη
   * ταυτότητα (ADR-853 §5 #4). ⚠️ Το `null` **δεν** χαλαρώνει τίποτα: η όψη δεν γράφει.
   */
  readonly recipientEmail: string | null;
}

/**
 * **Γιατί αυτό το έγγραφο ΔΕΝ εξαργυρώνεται;** — ή `null` αν εξαργυρώνεται.
 *
 * 🔑 **Ένας ορισμός για την όψη, τον προέλεγχο και τη συναλλαγή.** Ήταν δύο αντίγραφα
 * (όψη + συναλλαγή), και η απόδειξη γραμματοκιβωτίου θα πρόσθετε τρίτο: αν ένα από τα τρία
 * ξεχνούσε έναν έλεγχο, ο λογαριασμός θα επιβεβαιωνόταν από σύνδεσμο που η συναλλαγή
 * **απορρίπτει**.
 *
 * ⚠️ **Η σειρά είναι συμβόλαιο**: κατάσταση → λήξη → nonce → παραλήπτης. Ίδια με ό,τι
 * έλεγαν πάντα τα δύο αντίγραφα, άρα καμία άρνηση δεν αλλάζει όνομα.
 */
export function refusalOfStoredInvitation(
  stored: WorkspaceInvitationDocument,
  check: StoredInvitationCheck,
): WorkspaceInvitationRefusal | null {
  const state = readStoredInvitationState(stored.state);
  if (state !== 'pending') return REFUSAL_BY_STATE[state];

  // ⚠️ **ΔΕΥΤΕΡΟΣ** έλεγχος λήξης (Τ2): το έγγραφο μπορεί να λέει `pending` ενώ η ώρα του
  //    πέρασε — κανείς δεν «σκουπίζει» τις ληγμένες σε πραγματικό χρόνο.
  if (Date.parse(stored.expiresAt) <= Date.parse(check.nowValue)) return 'expired';

  // 🔴 Η υπογραφή αποδεικνύει ότι **εμείς** φτιάξαμε το κείμενο, **όχι** ότι δείχνει σε
  //    αυτό το έγγραφο. Το nonce είναι εκείνο που το δένει.
  if (!equalsInConstantTime(check.nonceHash, stored.nonceHash)) return 'link-invalid';

  // 🔴 Η ΔΕΣΜΕΥΣΗ ΣΤΟΝ ΠΑΡΑΛΗΠΤΗ (§7.5) — εδώ σπάει το προωθημένο email.
  if (check.recipientEmail !== null && !sameChannelEmail(check.recipientEmail, stored.inviteeEmail)) {
    return 'wrong-recipient';
  }
  return null;
}

// =============================================================================
// 2. Η ΑΠΟΔΕΙΞΗ ΓΡΑΜΜΑΤΟΚΙΒΩΤΙΟΥ
// =============================================================================

/**
 * - `proven-now` — ο λογαριασμός **μόλις** επιβεβαιώθηκε από αυτή την πρόσκληση (γράφεται
 *   στο έγγραφό της ως `mailboxProvenAt`).
 * - `already-proven` — ήταν ήδη επιβεβαιωμένος· καμία γραφή.
 * - `unknown` — το Auth δεν απάντησε. ⚠️ **Όχι** άρνηση: ο καλών απαντά «δεν μπόρεσα»,
 *   και η αποδοχή **δεν** γράφεται — μέλος με ανεπιβεβαίωτο email θα ήταν ακριβώς η
 *   κατάσταση που ο §7.5 απαγορεύει.
 */
export type InvitationMailboxProof = 'proven-now' | 'already-proven' | 'unknown';

/**
 * **Η πρόσκληση ως απόδειξη γραμματοκιβωτίου** — μέσω του **ΕΝΟΣ** SSoT (ADR-844 §13).
 *
 * @param account Ο **συνδεδεμένος** λογαριασμός — ποτέ αποτέλεσμα αναζήτησης με email.
 * @param email Η διεύθυνση που αποδείχθηκε (= του λογαριασμού στο Auth, ίδια με τον
 *   παραλήπτη — το έχει ήδη κρίνει το {@link refusalOfStoredInvitation}).
 *
 * ⚠️ **Ιδεμποτησία**: δεύτερη κλήση βρίσκει `emailVerified` ⇒ `already-proven`, μηδέν γραφές.
 */
export async function proveMailboxByInvitation(
  account: ProvenMailboxAccount,
  email: string,
): Promise<InvitationMailboxProof> {
  if (account.emailVerified) return 'already-proven';
  try {
    // 🔑 Ο κάτοχος της συνεδρίας **είναι** ο λογαριασμός — δες την κεφαλίδα.
    const receipt = await settleProvenMailbox(
      account,
      { email, recipientName: email },
      async () => account.uid,
    );
    if (receipt.verdict === 'claimed') {
      // ⛔ Αδύνατο με ίδιο uid — αν φτάσουμε εδώ, κάποιος άλλαξε τη σημασία του SSoT.
      logger.error('Απόδειξη πρόσκλησης κατέληξε σε διεκδίκηση — παραβιάστηκε συμβόλαιο', {
        uid: account.uid,
      });
      return 'unknown';
    }
    if (receipt.verdict === 'already-verified') return 'already-proven';
    logger.info('Η πρόσκληση επιβεβαίωσε το email του λογαριασμού', { uid: account.uid });
    return 'proven-now';
  } catch (error: unknown) {
    logger.error('Η απόδειξη γραμματοκιβωτίου από πρόσκληση απέτυχε', {
      uid: account.uid, error: getErrorMessage(error),
    });
    return 'unknown';
  }
}
