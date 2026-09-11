import 'server-only';

/**
 * @fileoverview **ΤΑ EMAIL ΛΟΓΑΡΙΑΣΜΟΥ ΦΕΥΓΟΥΝ ΑΠΟ ΕΜΑΣ** — επαναφορά κωδικού, επιβεβαίωση (ADR-851 Φ2).
 * @module server/auth/auth-action-mail
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΓΙΑΤΙ ΟΧΙ `sendPasswordResetEmail` / `sendEmailVerification` ΤΗΣ FIREBASE
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μετρημένο 2026-09-11 στην παραγωγή: η Firebase δέχεται **ένα** προσαρμοσμένο πρότυπο ανά
 * τύπο, **χωρίς** εκδοχή ανά γλώσσα, και **αρνείται** να το ενημερώσει μέσω API
 * (`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`) — ακόμη και τη διεύθυνση του συνδέσμου. Άρα με εκείνη
 * ο άνθρωπος παίρνει μήνυμα **σε γλώσσα που δεν διάλεξε**, με σύνδεσμο που ζει σε **ρύθμιση
 * κονσόλας** — που έδειχνε επί μήνες σε νεκρό Vercel.
 *
 * Google Account · GitHub · Figma στέλνουν τα email ασφαλείας από **δικό τους** σύστημα, στη
 * γλώσσα του **λογαριασμού**. Εδώ:
 * - **γλώσσα** = η **δηλωμένη** προτίμηση (ADR-849), αλλιώς της οθόνης που ζήτησε·
 * - **σύνδεσμος** = μόνο ο κωδικός της Firebase, στη **δική μας** διεύθυνση (`ownedActionLink`)·
 * - **ταυτότητα** = η ίδια οικογένεια με κάθε άλλο email μας (`auth-action-email.ts`).
 *
 * 🔒 **ΚΑΜΙΑ ΑΠΑΡΙΘΜΗΣΗ**: για άγνωστο email η υπηρεσία **δεν στέλνει τίποτα** και ο καλών
 * **δεν το μαθαίνει** — η διαδρομή απαντά `202` **πριν** καν ρωτήσει (`after()`), ώστε ούτε ο
 * **χρόνος** απόκρισης να προδίδει ποιος έχει λογαριασμό (OWASP Authentication Cheat Sheet ·
 * συνεπές με την ενεργή *email enumeration protection* της Firebase).
 */

import { createHash } from 'crypto';

import { resolveHumanLanguage, type HumanLanguage } from '@/i18n/languages';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { AUTH_MAIL_RECIPIENT_QUOTA } from '@/lib/middleware/rate-limit-config';
import { checkQuota } from '@/lib/middleware/rate-limiter';
import { createModuleLogger } from '@/lib/telemetry';
import { loadDeclaredEmailLanguage } from '@/server/notifications/user-notification-settings-store';
import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import { buildAuthActionEmail } from '@/services/email-templates/auth-action-email';
import type { AuthActionEmailKind } from '@/services/email-templates/auth-action-email-texts';

import { ownedActionLink } from './auth-action-link';

const logger = createModuleLogger('AUTH_ACTION_MAIL');

/** Τι έγινε — **μόνο** για τον διακομιστή και τις άγκυρες· ο ανώνυμος καλών δεν το βλέπει ποτέ. */
export type AuthActionMailOutcome =
  | 'sent'
  /** Τίποτα να σταλεί: άγνωστος/απενεργοποιημένος λογαριασμός, ή ήδη επιβεβαιωμένος. */
  | 'skipped'
  /** Ο παραλήπτης έλαβε ήδη όσα επιτρέπει το όριο (`AUTH_MAIL_RECIPIENT_QUOTA`). */
  | 'throttled'
  /** Δεν μπορέσαμε — χωρίς δημόσια διεύθυνση ή ο αποστολέας αρνήθηκε. */
  | 'failed';

/**
 * **Χωράει ακόμη ένα μήνυμα σε αυτόν τον παραλήπτη;** Κλειδί **κατακερματισμένο** — κανένα
 * email σε store ορίων. ⚠️ Αποτυχία του store ⇒ **επιτρέπει** (ίδια πολιτική με το
 * `withRateLimit`): η διαθεσιμότητα της επαναφοράς κωδικού δεν εξαρτάται από το Redis.
 */
async function withinRecipientQuota(kind: AuthActionEmailKind, recipient: string): Promise<boolean> {
  const key = `auth-mail:${kind}:${createHash('sha256').update(recipient.trim().toLowerCase()).digest('hex')}`;
  try {
    return (await checkQuota(key, AUTH_MAIL_RECIPIENT_QUOTA.limit, AUTH_MAIL_RECIPIENT_QUOTA.windowMs)).allowed;
  } catch (error: unknown) {
    logger.warn('Ο έλεγχος ορίου παραλήπτη απέτυχε — επιτρέπεται', { error: getErrorMessage(error) });
    return true;
  }
}

function isUserNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'auth/user-not-found';
}

/**
 * **Σε ποια γλώσσα μιλάμε σε αυτόν τον άνθρωπο;** Η **δική του** δήλωση κερδίζει την οθόνη:
 * ένας άνθρωπος με αγγλικά email που άνοιξε την ελληνική σελίδα δεν άλλαξε γνώμη.
 * ⚠️ Αποτυχία ανάγνωσης **δεν** ρίχνει το email — πέφτουμε στη γλώσσα της οθόνης.
 */
async function recipientLanguage(uid: string, requested: unknown): Promise<HumanLanguage> {
  try {
    return (await loadDeclaredEmailLanguage(uid)) ?? resolveHumanLanguage(requested);
  } catch (error: unknown) {
    logger.warn('Η δηλωμένη γλώσσα δεν διαβάστηκε — γλώσσα της οθόνης', { error: getErrorMessage(error) });
    return resolveHumanLanguage(requested);
  }
}

async function deliver(
  kind: AuthActionEmailKind,
  address: string,
  firebaseLink: string,
  language: HumanLanguage,
): Promise<AuthActionMailOutcome> {
  const link = ownedActionLink(firebaseLink);
  if (link === null) {
    logger.error('Email λογαριασμού χωρίς δημόσια διεύθυνση — δεν στάλθηκε', { kind });
    return 'failed';
  }
  const { subject, html, text } = buildAuthActionEmail({ kind, language, address, link });
  const sent = await sendReplyViaMailgun({ to: address, subject, textBody: text, htmlBody: html });
  if (!sent.success) {
    logger.error('Email λογαριασμού δεν στάλθηκε', { kind, error: sent.error });
    return 'failed';
  }
  return 'sent';
}

/**
 * **Επαναφορά κωδικού** — και, σε λογαριασμό **χωρίς** κωδικό, **ορισμός** κωδικού (ADR-850:
 * το `confirmPasswordReset` προσθέτει τον πάροχο).
 *
 * @throws Μόνο σε σφάλμα της Firebase **εκτός** «δεν υπάρχει» — ο καλών το καταγράφει· ο
 *   ανώνυμος άνθρωπος έχει ήδη πάρει την ίδια απάντηση με όλους.
 */
export async function sendPasswordResetMail(input: {
  readonly email: string;
  readonly requestedLanguage: unknown;
}): Promise<AuthActionMailOutcome> {
  let account;
  try {
    account = await getAdminAuth().getUserByEmail(input.email);
  } catch (error: unknown) {
    if (isUserNotFound(error)) return 'skipped';
    throw error;
  }
  if (account.disabled || !account.email) return 'skipped';
  if (!(await withinRecipientQuota('resetPassword', account.email))) return 'throttled';

  const firebaseLink = await getAdminAuth().generatePasswordResetLink(account.email);
  return deliver('resetPassword', account.email, firebaseLink, await recipientLanguage(account.uid, input.requestedLanguage));
}

/** **Επιβεβαίωση email** του **ίδιου** του καλούντα — ήδη επιβεβαιωμένος ⇒ τίποτα. */
export async function sendEmailVerificationMail(input: {
  readonly uid: string;
  readonly requestedLanguage: unknown;
}): Promise<AuthActionMailOutcome> {
  const record = await getAdminAuth().getUser(input.uid);
  if (!record.email || record.emailVerified || record.disabled) return 'skipped';
  if (!(await withinRecipientQuota('verifyEmail', record.uid))) return 'throttled';

  const firebaseLink = await getAdminAuth().generateEmailVerificationLink(record.email);
  return deliver('verifyEmail', record.email, firebaseLink, await recipientLanguage(record.uid, input.requestedLanguage));
}
