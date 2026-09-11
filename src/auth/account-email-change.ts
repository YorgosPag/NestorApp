/**
 * @fileoverview **ΑΛΛΑΓΗ EMAIL ΛΟΓΑΡΙΑΣΜΟΥ** — επαν-πιστοποίηση, μετά σύνδεσμος στη ΝΕΑ διεύθυνση (ADR-850).
 * @related components/account/email-change/* (η οθόνη) · auth/components/useAuthActionCode.ts (ο σύνδεσμος)
 * @module auth/account-email-change
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 `verifyBeforeUpdateEmail`, ΠΟΤΕ `updateEmail` — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ ΑΣΦΑΛΕΙΑΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το email του λογαριασμού **δεν αλλάζει** μέχρι ο άνθρωπος να πατήσει σύνδεσμο στη
 * **νέα** διεύθυνση. Αλλιώς κάποιος θα έγραφε μια διεύθυνση που **δεν ελέγχει** — η
 * κλάση *Unexpired Email Change* (Sudhodanan & Paverd 2022). Με ενεργή την προστασία
 * απαρίθμησης, η Firebase **ούτε επιτρέπει** το `updateEmail`.
 *
 * ⛔ **ΑΠΟΡΡΙΦΘΗΚΕ** το `generateVerifyAndChangeEmailLink` (Admin SDK) + δικό μας email:
 * ως κλήση διακομιστή **παρακάμπτει** τον φρουρό `requires-recent-login` **και** την
 * αυτόματη ειδοποίηση της **παλιάς** διεύθυνσης. Θα ξαναχτίζαμε δύο ελέγχους ασφαλείας
 * που η Firebase ήδη κάνει σωστά. Ίδιος SSoT με τα υπάρχοντα `sendEmailVerification` /
 * `sendPasswordResetEmail` (`useAuthActions.ts`): τα email τα στέλνει η Firebase, ο
 * χειριστής είναι το `/auth/action`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔐 ΕΠΑΝ-ΠΙΣΤΟΠΟΙΗΣΗ ΠΑΝΤΑ — ΠΡΟΤΥΠΟ «SUDO» (GitHub · Google Account)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κωδικός ζητείται **κάθε** φορά, όχι μόνο όταν η Firebase απαντήσει
 * `requires-recent-login`: ένας ξεκλείδωτος υπολογιστής δεν είναι άδεια να αλλάξει
 * κάποιος το email — δηλαδή **τον δρόμο ανάκτησης** — του λογαριασμού. Με MFA,
 * ακολουθεί ο 2ος παράγοντας: το `getMultiFactorResolver` δέχεται ρητά σφάλμα
 * *«sign-in, or reauthentication operation»* (Firebase JS SDK reference).
 *
 * 🔑 **Χωρίς απαρίθμηση λογαριασμών** (OWASP Authentication Cheat Sheet): διεύθυνση που
 * ανήκει ήδη σε άλλον λογαριασμό δίνει **την ίδια** απάντηση με την ελεύθερη — ό,τι κάνει
 * και η ίδια η Firebase με ενεργή την προστασία απαρίθμησης.
 *
 * **Layering**: πελατική υπηρεσία — Firebase client SDK. Κανένα React, κανένα κείμενο.
 */

import { FirebaseError } from 'firebase/app';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  verifyBeforeUpdateEmail,
  type MultiFactorResolver,
  type User,
} from 'firebase/auth';

import { normaliseChannelEmail, sameChannelEmail } from '@/lib/contact/channel-email';
import { createModuleLogger } from '@/lib/telemetry';
import { isValidEmail } from '@/lib/validation/email-validation';
import { twoFactorService } from '@/services/two-factor/EnterpriseTwoFactorService';

const logger = createModuleLogger('ACCOUNT_EMAIL_CHANGE');

/** Γιατί **δεν** έφυγε σύνδεσμος — κλειστό σύνολο, κάθε κωδικός γίνεται κλειδί i18n. */
export const EMAIL_CHANGE_ISSUES = [
  'invalid-email',
  'same-email',
  'wrong-password',
  'wrong-code',
  'too-many-attempts',
  'failed',
] as const;

export type EmailChangeIssue = (typeof EMAIL_CHANGE_ISSUES)[number];

/**
 * **Τι απέγινε το αίτημα.**
 *
 * ⚠️ Το `sent` **δεν** σημαίνει «άλλαξε»: σημαίνει *«αν η διεύθυνση είναι διαθέσιμη, της
 * στείλαμε σύνδεσμο»*. Το email αλλάζει **μόνο** όταν πατηθεί ο σύνδεσμος.
 */
export type EmailChangeOutcome =
  | { readonly kind: 'sent'; readonly newEmail: string }
  | { readonly kind: 'second-factor'; readonly resolver: MultiFactorResolver }
  | { readonly kind: 'issue'; readonly issue: EmailChangeIssue };

/**
 * Οι κωδικοί της Firebase για **λάθος κωδικό πρόσβασης** — τρεις, γιατί άλλαξαν με τα
 * χρόνια και η προστασία απαρίθμησης τους ενώνει στο `invalid-credential`.
 */
const WRONG_PASSWORD_CODES: ReadonlySet<string> = new Set([
  'auth/wrong-password',
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
]);

function codeOf(error: unknown): string | null {
  return error instanceof FirebaseError ? error.code : null;
}

function issue(value: EmailChangeIssue): EmailChangeOutcome {
  return { kind: 'issue', issue: value };
}

/**
 * **Έλεγχος πριν ενοχληθεί η Firebase** — καθαρή συνάρτηση.
 *
 * ⚠️ Η σύγκριση περνά από το `sameChannelEmail`, τον **ίδιο** κανονικοποιητή με την
 * πρώτη επαφή (ADR-844 §6.α): ` Maria@Example.COM ` είναι το ίδιο email.
 */
export function precheckNewEmail(currentEmail: string | null, rawNewEmail: string): EmailChangeIssue | null {
  if (!isValidEmail(rawNewEmail)) return 'invalid-email';
  if (sameChannelEmail(currentEmail, rawNewEmail)) return 'same-email';
  return null;
}

/**
 * **Βήμα 1** — έλεγχος, επαν-πιστοποίηση με κωδικό, σύνδεσμος στη νέα διεύθυνση.
 *
 * @returns `second-factor` όταν ο λογαριασμός έχει MFA — ο καλών συνεχίζει με
 *   {@link completeEmailChangeWithSecondFactor}.
 */
export async function requestAccountEmailChange(
  user: User,
  rawNewEmail: string,
  password: string,
): Promise<EmailChangeOutcome> {
  const refused = precheckNewEmail(user.email, rawNewEmail);
  if (refused !== null) return issue(refused);
  if (user.email === null) return issue('failed');

  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } catch (error: unknown) {
    const resolver = twoFactorService.getMfaResolver(error);
    if (resolver !== null) return { kind: 'second-factor', resolver };
    return issue(reauthIssueOf(error));
  }

  return sendVerificationLink(user, normaliseChannelEmail(rawNewEmail));
}

/** **Βήμα 2 (μόνο με MFA)** — ο 6ψήφιος κωδικός, μετά ο σύνδεσμος. */
export async function completeEmailChangeWithSecondFactor(
  user: User,
  resolver: MultiFactorResolver,
  code: string,
  rawNewEmail: string,
): Promise<EmailChangeOutcome> {
  const verified = await twoFactorService.verifyTotpForSignIn(resolver, code, 0);
  if (verified.result === 'invalid_code' || verified.result === 'expired') return issue('wrong-code');
  if (verified.result === 'rate_limited') return issue('too-many-attempts');
  if (verified.result !== 'success') return issue('failed');

  return sendVerificationLink(user, normaliseChannelEmail(rawNewEmail));
}

function reauthIssueOf(error: unknown): EmailChangeIssue {
  const code = codeOf(error);
  if (code !== null && WRONG_PASSWORD_CODES.has(code)) return 'wrong-password';
  if (code === 'auth/too-many-requests') return 'too-many-attempts';
  logger.error('Η επαν-πιστοποίηση για αλλαγή email δεν ολοκληρώθηκε', { code });
  return 'failed';
}

/**
 * **Ο σύνδεσμος στη νέα διεύθυνση.**
 *
 * 🔴 **`email-already-in-use` ⇒ `sent`, ΚΑΙ ΕΙΝΑΙ ΣΚΟΠΙΜΟ**: διαφορετική απάντηση θα
 * έλεγε σε όποιον κρατά ξεκλείδωτη συνεδρία **ποιες διευθύνσεις έχουν λογαριασμό**.
 */
async function sendVerificationLink(user: User, newEmail: string): Promise<EmailChangeOutcome> {
  try {
    await verifyBeforeUpdateEmail(user, newEmail);
    return { kind: 'sent', newEmail };
  } catch (error: unknown) {
    const code = codeOf(error);
    if (code === 'auth/email-already-in-use') return { kind: 'sent', newEmail };
    if (code === 'auth/invalid-email') return issue('invalid-email');
    if (code === 'auth/too-many-requests') return issue('too-many-attempts');
    logger.error('Ο σύνδεσμος αλλαγής email δεν στάλθηκε', { code });
    return issue('failed');
  }
}
