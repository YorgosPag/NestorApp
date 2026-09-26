import 'server-only';

/**
 * @fileoverview **ΣΤΕΙΛΕ ΜΙΑ ΠΡΟΣΚΛΗΣΗ ΣΤΟΝ ΑΝΘΡΩΠΟ** — για **κάθε** είδος (χώρου · φωτογράφου).
 * @related ADR-853 Φ5 · §20 (κοινός πυρήνας) · ADR-884 §4.5 (Κ3α — το δεύτερο είδος)
 * @module server/invitations/invitation-notice
 *
 * Εξήχθη από το `server/auth/workspace-invitation-notice.ts` (2026-09-26) τη στιγμή που ήρθε **δεύτερο** είδος
 * πρόσκλησης: η κλίμακα γλώσσας, η ονομασμένη έκβαση και ο φρουρός «ποτέ εξαίρεση» είναι **ίδια** για κάθε
 * πρόσκληση — δεύτερο αντίγραφο θα απέκλινε στην πρώτη διόρθωση. Το είδος δίνει **μόνο** το email.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΩΜΟ TOKEN ΠΕΡΝΑ ΑΠΟ ΤΟ `compose` ΤΟΥ ΕΙΔΟΥΣ, ΚΑΙ ΑΠΟ ΠΟΥΘΕΝΑ ΑΛΛΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ **ΜΗΝ το καταγράψεις.** Κανένα `logger.*` εδώ δεν δέχεται το token ή το μήνυμα — τα ίχνη ταξιδεύουν σε
 * τρίτους (Sentry) και ζουν περισσότερο από την πρόσκληση.
 *
 * ⚠️ **ΔΕΝ ΠΕΤΑ ΠΟΤΕ — Η ΠΡΟΣΚΛΗΣΗ ΥΠΑΡΧΕΙ ΗΔΗ.** Μια εξαίρεση προς τα πάνω θα έκανε τη διαδρομή να πει «απέτυχε»
 * για πράξη που **πέτυχε** — και ο υπεύθυνος θα ξαναπατούσε, ακυρώνοντας σιωπηλά το token που μόλις έφυγε.
 */

import { getErrorMessage } from '@/lib/error-utils';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { loadDeclaredEmailLanguage } from '@/server/notifications/user-notification-settings-store';
import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import type { ConfirmationEmailResult } from '@/services/email-templates/confirmation-email-shared';

import type { HumanLanguage } from '@/i18n/languages';

const logger = createModuleLogger('INVITATION_NOTICE');

/**
 * Τι απέγινε το μήνυμα — **ονομασμένο, ποτέ boolean**.
 *
 * 🔶 **`accepted` και ΟΧΙ `sent`**: το `200` του Mailgun σημαίνει «μπήκε σε ουρά» — το λεξιλόγιο του παρόχου
 * ξεχωρίζει ρητά το `accepted` από το `delivered`. Η **αληθινή** παράδοση έρχεται από τα γεγονότα του παρόχου
 * (ADR-853 Φ5-Β)· εδώ δεν λέμε ποτέ περισσότερα από όσα ξέρουμε.
 */
export type InvitationNoticeOutcome =
  /** Ο πάροχος **το δέχτηκε** προς αποστολή. ⚠️ Δεν σημαίνει «παραδόθηκε». */
  | 'accepted'
  /** Δεν ξέρουμε τη δημόσια διεύθυνσή μας ⇒ **κανένα** email με σύνδεσμο που δεν οδηγεί πουθενά. */
  | 'unaddressable'
  /** Ο πάροχος αρνήθηκε ή έλειπε ρύθμιση. Η πρόσκληση **υπάρχει**· απλώς δεν ταξίδεψε. */
  | 'failed';

/**
 * **Σε ποια γλώσσα μιλάμε σε αυτόν τον άνθρωπο;** — κλίμακα τριών (ADR-853 Φ5):
 * 1. η **δηλωμένη** του **παραλήπτη**, αν έχει ήδη λογαριασμό (η δική **του** επιλογή) ·
 * 2. η **δηλωμένη** του **προσκαλούντος** (εκείνος ξεκινά τη σχέση) · 3. η προεπιλογή.
 *
 * 🔒 **ΔΕΝ είναι όργανο απαρίθμησης**: τρέχει μόνο στον διακομιστή και η απόκριση της διαδρομής είναι ταυτόσημη
 * είτε βρεθεί λογαριασμός είτε όχι. ⚠️ **Καμία αποτυχία ανάγνωσης δεν ρίχνει το email** — επόμενος κρίκος.
 */
export async function invitationRecipientLanguage(inviteeEmail: string, inviterUid: string): Promise<HumanLanguage | null> {
  const declaredByInvitee = await declaredLanguageOfAddress(inviteeEmail);
  if (declaredByInvitee !== null) return declaredByInvitee;
  return loadDeclaredEmailLanguage(inviterUid).catch((error: unknown) => {
    logger.warn('Η γλώσσα του προσκαλούντος δεν διαβάστηκε — προεπιλογή', { error: getErrorMessage(error) });
    return null;
  });
}

/** Η δηλωμένη γλώσσα του κατόχου **αυτής** της διεύθυνσης, ή `null` αν δεν έχει λογαριασμό. */
async function declaredLanguageOfAddress(address: string): Promise<HumanLanguage | null> {
  try {
    const account = await getAdminAuth().getUserByEmail(address);
    return await loadDeclaredEmailLanguage(account.uid);
  } catch {
    // ⚠️ **Σιωπηλά, και επίτηδες**: «δεν υπάρχει λογαριασμός» είναι η **συνηθισμένη** περίπτωση μιας πρόσκλησης.
    return null;
  }
}

export interface InvitationDelivery {
  /** Για τα ίχνη — **ποτέ** το token. */
  readonly invitationId: string;
  /** Το είδος, για τα ίχνη (`workspace` · `tour-capture`). */
  readonly kind: string;
  readonly inviteeEmail: string;
  readonly inviterUid: string;
  /** **Το email του είδους**, στη γλώσσα του παραλήπτη — `null` ⇒ χωρίς δημόσια διεύθυνση (`unaddressable`). */
  compose(language: HumanLanguage | null): Promise<ConfirmationEmailResult | null>;
}

/** **Στείλε την πρόσκληση.** Καλείται **αφού** γραφτεί το έγγραφο. Ποτέ δεν πετά. */
export async function deliverInvitationEmail(delivery: InvitationDelivery): Promise<InvitationNoticeOutcome> {
  const trace = { invitationId: delivery.invitationId, kind: delivery.kind };
  try {
    const language = await invitationRecipientLanguage(delivery.inviteeEmail, delivery.inviterUid);
    const email = await delivery.compose(language);
    if (email === null) {
      logger.error('Πρόσκληση χωρίς δημόσια διεύθυνση — ΔΕΝ στάλθηκε email', trace);
      return 'unaddressable';
    }
    const sent = await sendReplyViaMailgun({
      to: delivery.inviteeEmail, subject: email.subject, textBody: email.text, htmlBody: email.html,
    });
    if (!sent.success) {
      logger.error('Το email πρόσκλησης δεν έγινε δεκτό από τον πάροχο', { ...trace, error: sent.error });
      return 'failed';
    }
    logger.info('Το email πρόσκλησης έγινε δεκτό προς αποστολή', trace);
    return 'accepted';
  } catch (error: unknown) {
    // Ο τελευταίος φρουρός: **τίποτα** δεν ανεβαίνει στη διαδρομή.
    logger.error('Το email πρόσκλησης απέτυχε', { ...trace, error: getErrorMessage(error) });
    return 'failed';
  }
}
