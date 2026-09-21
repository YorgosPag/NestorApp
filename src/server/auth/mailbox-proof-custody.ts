import 'server-only';

/**
 * @fileoverview **ΤΙ ΚΑΝΕΙ ΜΙΑ ΑΠΟΔΕΙΞΗ ΓΡΑΜΜΑΤΟΚΙΒΩΤΙΟΥ ΣΕ ΛΟΓΑΡΙΑΣΜΟ ΠΟΥ ΥΠΑΡΧΕΙ ΗΔΗ** (ADR-844 §13).
 * @related server/auth/citizen-identity.ts (ο καλών) · lib/auth/token-credentials.ts (`sessionHolderUid`) ·
 *          server/auth/account-reprovision.ts (η διεκδίκηση)
 * @module server/auth/mailbox-proof-custody
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ — ΠΡΟ-ΚΑΤΑΛΗΨΗ ΛΟΓΑΡΙΑΣΜΟΥ (pre-account-takeover)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η αυτο-εγγραφή email/κωδικού **δεν** απαιτεί επιβεβαίωση. Ο επιτιθέμενος γράφεται με
 * το email του θύματος και **δεν** πατά ποτέ το email επιβεβαίωσης. Όταν το θύμα
 * αποδείξει αργότερα το γραμματοκιβώτιό του μέσω πρώτης επαφής, το `getUserByEmail`
 * βρίσκει **τον λογαριασμό του επιτιθέμενου** — και χωρίς αυτό το αρχείο, η επαφή του
 * θύματος γραφόταν εκεί και το θύμα **συνδεόταν** εκεί. Ο επιτιθέμενος ξέρει τον κωδικό.
 *
 * Κλάσεις *Classic-Federated Merge* · *Unexpired Email Change* · *Trojan Identifier*
 * (Sudhodanan & Paverd, USENIX Security 2022).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 Ο ΚΑΝΟΝΑΣ ΕΙΝΑΙ ΤΗΣ FIREBASE — Η ΔΙΑΚΡΙΣΗ ΚΑΙ Η ΠΛΗΡΟΤΗΤΑ ΕΙΝΑΙ ΔΙΚΕΣ ΜΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Firebase, email-link sign-in, κατά λέξη: *«any previous unverified mechanism of
 * sign-in will be removed from the user and any existing sessions will be
 * invalidated»*. Εκείνη όμως το κάνει **τυφλά** — και τιμωρεί τον **νόμιμο** χρήστη που
 * γράφτηκε ο ίδιος και απλώς δεν πάτησε το email επιβεβαίωσης.
 *
 * ⇒ Εδώ ρωτάμε **ποιος** αποδεικνύει:
 *
 * | Λογαριασμός | Αποδεικνύων | Ετυμηγορία | Τι γίνεται |
 * |---|---|---|---|
 * | επιβεβαιωμένος | οποιοσδήποτε | `already-verified` | **τίποτα** — δύο αποδείξεις, ένας κάτοχος |
 * | ανεπιβεβαίωτος | συνεδρία του **ίδιου** uid | `verified-by-holder` | **μόνο** `emailVerified: true` |
 * | ανεπιβεβαίωτος | ανώνυμος / άλλος uid | `claimed` | **ο λογαριασμός ξαναχτίζεται από το μηδέν, ΙΔΙΟ uid** |
 *
 * 🔴 **ΓΙΑΤΙ «ΞΑΝΑΧΤΙΖΕΤΑΙ» ΚΑΙ ΟΧΙ «ΑΦΑΙΡΕΙΤΑΙ Ο ΚΩΔΙΚΟΣ» (2026-09-11, μετρημένο στην
 * παραγωγή)**: η αφαίρεση κωδικού + ανάκληση άφηνε **δύο** πόρτες ανοιχτές — τον εκκρεμή
 * κωδικό αλλαγής email του επιτιθέμενου **και** πάροχο Google που είχε δέσει ο ίδιος.
 * Μόνο η διαγραφή/επαναδημιουργία τα κλείνει και τα δύο — δες τον πίνακα του
 * `account-reprovision.ts`, και ⛔ **ΠΟΤΕ** ξανά στον emulator: απάντησε **ανάποδα**.
 *
 * 🔑 **Ο κάτοχος της συνεδρίας ΕΙΝΑΙ ο κάτοχος του κωδικού**: κωδικός και γραμματοκιβώτιο
 * στο **ίδιο** χέρι. Ο επιτιθέμενος κρατά τον κωδικό αλλά **δεν** φτάνει τον σύνδεσμο.
 *
 * ⚠️ **Ο νόμιμος χρήστης σε ΑΛΛΗ συσκευή** πέφτει στο `claimed` — ο διακομιστής **δεν**
 * μπορεί να τον ξεχωρίσει από το θύμα. Γι' αυτό το `claimed` κρατά το **uid** (άρα επαφές,
 * αγγελίες, στοιχεία) και του στέλνει **έναν** σύνδεσμο ορισμού νέου κωδικού. Κόστος για
 * εκείνον: ένα κλικ. Κόστος για τον επιτιθέμενο: όλα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔐 Ο ΔΕΥΤΕΡΟΣ ΠΑΡΑΓΟΝΤΑΣ — {@link mailboxProofMaySignIn}
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το custom token **δεν περνά ποτέ από MFA**: το REST `signInWithCustomToken` δεν έχει
 * ούτε ένα πεδίο δεύτερου παράγοντα. Άρα απόδειξη email σε λογαριασμό με 2FA θα έδινε
 * **πλήρη** συνεδρία με **έναν** παράγοντα. Google Identity Platform, για το ανάλογο:
 * *«Password reset will not allow a user to bypass multi-factor authentication»*.
 *
 * **Layering**: server — Admin SDK. Καμία κρίση ρόλου (CHECK 3.68)· εδώ ζει μόνο το
 * *«τι σημαίνει αυτή η απόδειξη για τα διαπιστευτήρια του λογαριασμού»*.
 */

import type { UserRecord } from 'firebase-admin/auth';

import { getAdminAuth } from '@/lib/firebaseAdmin';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger, sentryCaptureMessage } from '@/lib/telemetry';
import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import { buildAccountSecuredEmail } from '@/services/email-templates/account-secured';

import { reprovisionAuthAccount } from './account-reprovision';
import { ownedActionLink } from './auth-action-link';

const logger = createModuleLogger('MAILBOX_PROOF_CUSTODY');

// =============================================================================
// 1. ΤΟ ΛΕΞΙΛΟΓΙΟ
// =============================================================================

/** Ό,τι χρειάζεται η κρίση από τον λογαριασμό — τρία πεδία, όχι ολόκληρο το `UserRecord`. */
export interface ProvenMailboxAccount {
  readonly uid: string;
  readonly emailVerified: boolean;
  /** Έχει εγγεγραμμένο **δεύτερο παράγοντα**; */
  readonly secondFactorEnrolled: boolean;
}

/**
 * **`UserRecord` → ό,τι χρειάζεται η κρίση** — ο ΕΝΑΣ ορισμός του «έχει 2ο παράγοντα».
 *
 * 🔑 Ήταν γραμμένο μέσα στο `citizen-identity.ts`· η πρόσκληση χώρου (ADR-853 §15) έγινε
 * δεύτερος καταναλωτής, και δεύτερο αντίγραφο της έκφρασης MFA θα μπορούσε να αποκλίνει.
 */
export function provenMailboxAccountOf(
  record: Pick<UserRecord, 'uid' | 'emailVerified' | 'multiFactor'>,
): ProvenMailboxAccount {
  return {
    uid: record.uid,
    emailVerified: record.emailVerified,
    secondFactorEnrolled: (record.multiFactor?.enrolledFactors.length ?? 0) > 0,
  };
}

/**
 * **Ρωτά ποιος κρατά συνεδρία σε αυτόν τον φυλλομετρητή** — και ρωτιέται **ΜΟΝΟ** όταν
 * χρειάζεται.
 *
 * 🔑 **Συνάρτηση, όχι τιμή, και είναι απόφαση κόστους**: η ερώτηση κοστίζει ένα `getUser`
 * (`checkRevoked`). Ο ανεπιβεβαίωτος λογαριασμός είναι η **σπάνια** περίπτωση· ένα
 * λάθος κωδικός ή ένας επιβεβαιωμένος λογαριασμός **δεν** πληρώνουν τίποτα.
 */
export type SessionHolderProbe = () => Promise<string | null>;

/** Οι τρεις ετυμηγορίες — δες τον πίνακα της κεφαλίδας. */
export type MailboxProofVerdict = 'already-verified' | 'verified-by-holder' | 'claimed';

/** Τι έγινε — ώστε ο καλών και οι άγκυρες να το **μετρούν**, όχι να το υποθέτουν. */
export interface MailboxCustodyReceipt {
  readonly verdict: MailboxProofVerdict;
  /** Κάθε τρόπος σύνδεσης που **δεν** επέζησε της διεκδίκησης. Κενό εκτός `claimed`. */
  readonly removedProviders: readonly string[];
}

/** Η διεύθυνση που **αποδείχθηκε**, και πώς θέλει να τον λένε ο άνθρωπος. */
export interface ProvenMailbox {
  readonly email: string;
  readonly recipientName: string;
}

// =============================================================================
// 2. Η ΚΡΙΣΗ — καθαρή, χωρίς I/O
// =============================================================================

/**
 * **Ποια ετυμηγορία;** — καθαρή συνάρτηση, για να τη ρωτούν οι άγκυρες χωρίς Firebase.
 *
 * ⛔ **ΜΗΝ προσθέσεις «ή αν ο κάτοχος έχει ίδιο email»**: το email **δεν** αποδεικνύει
 * κατοχή — ακριβώς αυτό το ψέμα είναι η επίθεση. Μόνο το **uid** της συνεδρίας.
 */
export function mailboxProofVerdict(
  account: Pick<ProvenMailboxAccount, 'uid' | 'emailVerified'>,
  sessionHolderUid: string | null,
): MailboxProofVerdict {
  if (account.emailVerified) return 'already-verified';
  return sessionHolderUid === account.uid ? 'verified-by-holder' : 'claimed';
}

/**
 * **Επιτρέπεται να δώσει ΣΥΝΕΔΡΙΑ αυτή η απόδειξη;**
 *
 * 🔴 Όχι σε λογαριασμό με δεύτερο παράγοντα — δες την κεφαλίδα. Η **πράξη** γράφεται
 * κανονικά· ο άνθρωπος απλώς συνδέεται **από την πόρτα που ζητά τον 2ο παράγοντα**.
 */
export function mailboxProofMaySignIn(account: Pick<ProvenMailboxAccount, 'secondFactorEnrolled'>): boolean {
  return !account.secondFactorEnrolled;
}

// =============================================================================
// 3. Η ΠΡΑΞΗ
// =============================================================================

/**
 * **Φέρε τον λογαριασμό σε συμφωνία με την απόδειξη που μόλις έγινε.**
 *
 * @param account Ο λογαριασμός που βρέθηκε με `getUserByEmail`.
 * @param mailbox Η διεύθυνση που **αποδείχθηκε**.
 * @param sessionHolder Ρωτιέται **μόνο** για ανεπιβεβαίωτο λογαριασμό.
 * @throws Αν η Firebase δεν απαντήσει ή η επαναδημιουργία αρνηθεί. ⚠️ **Σκόπιμα**: ο
 *   καλών μεταφράζει σε «δεν μάθαμε» και **δεν** γράφει την πράξη — καλύτερα καμία επαφή
 *   παρά επαφή σε λογαριασμό που **δεν** καταφέραμε να εξουδετερώσουμε.
 *
 * ⚠️ **Ιδεμποτησία**: μετά από οποιαδήποτε ετυμηγορία ο λογαριασμός είναι
 * `emailVerified` ⇒ δεύτερη κλήση = `already-verified`, **μηδέν** γραφές.
 */
export async function settleProvenMailbox(
  account: ProvenMailboxAccount,
  mailbox: ProvenMailbox,
  sessionHolder: SessionHolderProbe,
): Promise<MailboxCustodyReceipt> {
  if (account.emailVerified) return { verdict: 'already-verified', removedProviders: [] };

  const verdict = mailboxProofVerdict(account, await sessionHolder());
  if (verdict === 'verified-by-holder') {
    // 🔑 **ΚΛΕΙΝΕΙ ΤΟ ADR-844 §12.6 #2**: ο ίδιος άνθρωπος, με κωδικό **και**
    //    γραμματοκιβώτιο. Καμία αφαίρεση, καμία αποσύνδεση — μόνο η αλήθεια.
    await getAdminAuth().updateUser(account.uid, { emailVerified: true });
    return { verdict, removedProviders: [] };
  }

  return claimAccount(account, mailbox);
}

/**
 * **Η διεκδίκηση** — ο λογαριασμός ξαναχτίζεται, **πριν** τα claims (το εγγυάται ο καλών):
 * κανένα παλιό refresh token δεν επιζεί για να κόψει ID token που **κουβαλά** νέο ρόλο,
 * γιατί ο λογαριασμός που το εξέδωσε **δεν υπάρχει πια**.
 */
async function claimAccount(
  account: ProvenMailboxAccount,
  mailbox: ProvenMailbox,
): Promise<MailboxCustodyReceipt> {
  const { removedProviders } = await reprovisionAuthAccount(account.uid, mailbox.email);

  // 🔑 **Γεγονός ασφαλείας, όχι απλή γραμμή ημερολογίου** — ίδιο κανάλι με το
  //    `access_denied` του audit-core. ⚠️ Μόνο uid: το email είναι προσωπικό δεδομένο.
  sentryCaptureMessage('Mailbox proof claimed an unverified account', 'warning', {
    tags: { component: 'mailbox-proof-custody' },
    extra: { uid: account.uid, removedProviders },
  });

  if (removedProviders.length > 0) await notifyAccountSecured(mailbox);
  return { verdict: 'claimed', removedProviders };
}

/**
 * **Πες στον άνθρωπο τι αφαιρέθηκε, και δώσ' του τον δρόμο πίσω.**
 *
 * ⚠️ **Δεν πετά ΠΟΤΕ**: η ασφάλεια έχει **ήδη** επιτευχθεί· το email είναι η
 * **ευγένεια** προς τον νόμιμο χρήστη που ίσως πάτησε από άλλη συσκευή. Η αποτυχία του
 * δεν δικαιολογεί να χαθεί η πράξη — γράφεται ως σφάλμα και προχωράμε.
 *
 * 🔑 Ο σύνδεσμος είναι **reset** της Firebase, ξαναχτισμένος στη **δική μας** διεύθυνση
 * (`ownedActionLink`): το `confirmPasswordReset` ξαναδένει τον πάροχο κωδικού σε
 * λογαριασμό που δεν έχει — και απαιτεί το ίδιο γραμματοκιβώτιο.
 */
async function notifyAccountSecured(mailbox: ProvenMailbox): Promise<void> {
  try {
    const setPasswordUrl = ownedActionLink(await getAdminAuth().generatePasswordResetLink(mailbox.email));
    if (setPasswordUrl === null) {
      logger.error('Το email «ασφαλίσαμε τον λογαριασμό» δεν στάλθηκε: δεν υπάρχει δημόσια διεύθυνση');
      return;
    }
    const { subject, html, text } = buildAccountSecuredEmail({
      recipientName: mailbox.recipientName,
      email: mailbox.email,
      setPasswordUrl,
    });
    const sent = await sendReplyViaMailgun({
      to: mailbox.email, subject, textBody: text, htmlBody: html,
    });
    if (!sent.success) {
      logger.error('Το email «ασφαλίσαμε τον λογαριασμό» δεν στάλθηκε', { error: sent.error });
    }
  } catch (error: unknown) {
    logger.error('Το email «ασφαλίσαμε τον λογαριασμό» δεν χτίστηκε', {
      error: getErrorMessage(error),
    });
  }
}
