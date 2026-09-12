import 'server-only';

/**
 * @fileoverview **ΣΤΕΙΛΕ ΤΗΝ ΠΡΟΣΚΛΗΣΗ ΣΤΟΝ ΑΝΘΡΩΠΟ** (ADR-853 Φ5).
 * @module server/auth/workspace-invitation-notice
 * @related server/auth/workspace-invitation.ts (η έκδοση) · services/email-templates/workspace-invitation-email.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΩΜΟ TOKEN ΠΕΡΝΑ ΑΠΟ ΕΔΩ, ΚΑΙ ΑΠΟ ΠΟΥΘΕΝΑ ΑΛΛΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 * Η `issueWorkspaceInvitation` επιστρέφει `{ invitation, token }`· στη βάση ζει **μόνο**
 * το `sha256(nonce)` (§7.4) και η διαδρομή **ποτέ** δεν το γράφει στην απόκριση. Άρα η
 * αλυσίδα του ωμού token είναι **ακριβώς δύο κρίκοι**: η υπηρεσία έκδοσης → **αυτό το
 * αρχείο** → το γραμματοκιβώτιο του παραλήπτη.
 *
 * ⛔ **ΜΗΝ το καταγράψεις.** Κανένα `logger.*` εδώ δεν δέχεται το token — ούτε κομμένο:
 * τα αρχεία καταγραφής ταξιδεύουν σε τρίτους (Sentry) και ζουν περισσότερο από την
 * πρόσκληση.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΔΕΝ ΠΕΤΑ ΠΟΤΕ — Η ΠΡΟΣΚΛΗΣΗ **ΥΠΑΡΧΕΙ** ΗΔΗ
 * ────────────────────────────────────────────────────────────────────────────
 * Όταν φτάνει εδώ η ροή, το έγγραφο έχει **γραφτεί** και η προηγούμενη ζωντανή έχει
 * **ανακληθεί** μέσα στην ίδια συναλλαγή (§7.3). Μια εξαίρεση που ανέβαινε θα έκανε τη
 * διαδρομή να απαντήσει «απέτυχε» για πράξη που **πέτυχε** — και ο διαχειριστής θα
 * ξαναπατούσε, ακυρώνοντας σιωπηλά το token που μόλις έφυγε. Ίδιο δόγμα με το
 * `notifyAccessDecision`: *«το email είναι ενημέρωση, όχι μέρος της πράξης»*.
 */

import { getErrorMessage } from '@/lib/error-utils';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import { loadDeclaredEmailLanguage } from '@/server/notifications/user-notification-settings-store';
import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import { buildWorkspaceInvitationEmail } from '@/services/email-templates/workspace-invitation-email';
import type { WorkspaceInvitation } from '@/types/workspace-invitation';

import type { HumanLanguage } from '@/i18n/languages';

const logger = createModuleLogger('WORKSPACE_INVITATION_NOTICE');

/**
 * Τι απέγινε το μήνυμα — **ονομασμένο, ποτέ boolean**, και **ποτέ δεν φτάνει σε οθόνη
 * ως έχει**: ο διαχειριστής χρειάζεται λέξεις, ο διακομιστής χρειάζεται αιτίες.
 */
export type InvitationNoticeOutcome =
  /** Ο πάροχος **το δέχτηκε** προς αποστολή. ⚠️ Δεν σημαίνει «παραδόθηκε» — δες παρακάτω. */
  | 'accepted'
  /** Δεν ξέρουμε τη δημόσια διεύθυνσή μας ⇒ **κανένα** email με σύνδεσμο που δεν οδηγεί πουθενά. */
  | 'unaddressable'
  /** Ο πάροχος αρνήθηκε ή έλειπε ρύθμιση. Η πρόσκληση **υπάρχει**· απλώς δεν ταξίδεψε. */
  | 'failed';

/**
 * 🔶 **ΓΙΑΤΙ `accepted` ΚΑΙ ΟΧΙ `sent` — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΛΕΠΤΟΛΟΓΙΑ.**
 *
 * Το `200` του Mailgun σημαίνει *«το δέχτηκα και μπήκε σε ουρά»* — το ίδιο το λεξιλόγιο
 * γεγονότων του παρόχου ξεχωρίζει **ρητά** το `accepted` από το `delivered`, και ανάμεσά
 * τους ζουν τα `temporary_fail` / `permanent_fail`. Ένα πεδίο που έλεγε «στάλθηκε» θα
 * ήταν **ψέμα με παράλειψη**: ο διαχειριστής θα περίμενε άνθρωπο που **δεν έλαβε ποτέ**
 * τίποτα. Είναι το **ίδιο** δόγμα που το έργο ήδη επιβάλλει στο `openedAt`
 * *(«ένδειξη, όχι απόδειξη»)* και στο `identityAssurance` *(«τρεις καταστάσεις, ποτέ
 * boolean»)*.
 *
 * 🏆 Η **αληθινή** παράδοση (`delivered` / `permanent_fail` με **λόγο**) έρχεται από τα
 * γεγονότα του παρόχου — το μοντέλο που η **Atlassian** έχει ως *«admin email audit»* και
 * που **Slack/GitHub/Figma δεν έχουν**. Είναι **δηλωμένο επόμενο βήμα** (ADR-853 Φ5-Β),
 * όχι ξεχασμένο: εδώ δεν λέμε ποτέ περισσότερα από όσα ξέρουμε.
 */

/**
 * **Σε ποια γλώσσα μιλάμε σε αυτόν τον άνθρωπο;** — κλίμακα τριών, με **γραμμένο** λόγο.
 *
 * | # | Πηγή | Γιατί |
 * |---|---|---|
 * | 1 | η **δηλωμένη** του **παραλήπτη**, αν έχει ήδη λογαριασμό | είναι η δική **του** επιλογή |
 * | 2 | η **δηλωμένη** του **προσκαλούντος** | ο χώρος ξεκινά τη σχέση (Α1) — μιλά στη γλώσσα του |
 * | 3 | η προεπιλογή | κανείς δεν έχει πει τίποτα |
 *
 * 🏆 **ΕΔΩ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ, ΚΑΙ ΕΙΝΑΙ ΕΡΕΥΝΗΜΕΝΟ**: το **Slack** στέλνει τις
 * προσκλήσεις στη γλώσσα **του χώρου** — μία γλώσσα για όλους. Η **Microsoft (Entra B2B)**
 * έχει κλίμακα, αλλά ρωτά πρώτα ρητή παράμετρο και μετά τον παραλήπτη. Εμείς ρωτάμε τον
 * **άνθρωπο** πρώτα, επειδή η πρόσκληση πάει σε **email** και ο παραλήπτης **μπορεί ήδη
 * να είναι χρήστης μας** — οπότε έχουμε **πραγματική** προτίμηση, δηλωμένη από τον ίδιο.
 *
 * 🔒 **ΔΕΝ είναι όργανο απαρίθμησης**, και ο λόγος είναι δομικός: ο έλεγχος τρέχει
 * **μόνο** στον διακομιστή, η απόκριση της διαδρομής είναι **ταυτόσημη** είτε βρεθεί
 * λογαριασμός είτε όχι, και ο χρόνος δεν μετριέται από τον καλούντα *(η διεύθυνση την
 * έγραψε ο **ίδιος** ο διαχειριστής)*. Καμία πληροφορία δεν φεύγει προς τα έξω.
 *
 * ⚠️ **Καμία αποτυχία ανάγνωσης δεν ρίχνει το email** — πέφτουμε στον επόμενο κρίκο.
 */
async function recipientLanguage(
  inviteeEmail: string,
  inviterUid: string,
): Promise<HumanLanguage | null> {
  const declaredByInvitee = await declaredLanguageOfAddress(inviteeEmail);
  if (declaredByInvitee !== null) return declaredByInvitee;

  return loadDeclaredEmailLanguage(inviterUid).catch((error: unknown) => {
    logger.warn('Η γλώσσα του προσκαλούντος δεν διαβάστηκε — προεπιλογή', {
      error: getErrorMessage(error),
    });
    return null;
  });
}

/** Η δηλωμένη γλώσσα του κατόχου **αυτής** της διεύθυνσης, ή `null` αν δεν έχει λογαριασμό. */
async function declaredLanguageOfAddress(address: string): Promise<HumanLanguage | null> {
  try {
    const account = await getAdminAuth().getUserByEmail(address);
    return await loadDeclaredEmailLanguage(account.uid);
  } catch {
    // ⚠️ **Σιωπηλά, και επίτηδες**: «δεν υπάρχει λογαριασμός» είναι η **συνηθισμένη**
    //    περίπτωση μιας πρόσκλησης (§6 #2), όχι σφάλμα. Θόρυβος εδώ θα έκρυβε τα αληθινά.
    return null;
  }
}

/**
 * **Στείλε την πρόσκληση.** Καλείται **αφού** γραφτεί το έγγραφο, με το ωμό token.
 *
 * ⚠️ Το όνομα του χώρου διαβάζεται **τη στιγμή της αποστολής**, από τον **ΕΝΑ** αναγνώστη
 * (§7: *«από τη μία διαδρομή»*) — ποτέ στιγμιότυπο μέσα στην πρόσκληση, που θα παλίωνε
 * σιωπηλά όταν το γραφείο μετονομαστεί.
 */
export async function notifyWorkspaceInvitation(input: {
  readonly invitation: WorkspaceInvitation;
  /** Το ωμό token — **μόνο** από την επιστροφή της `issueWorkspaceInvitation`. */
  readonly token: string;
  readonly nowISOValue: string;
}): Promise<InvitationNoticeOutcome> {
  const { invitation } = input;

  try {
    const [workspaceName, language] = await Promise.all([
      readWorkspaceName(invitation.companyId).catch((error: unknown) => {
        // Το όνομα που λείπει **δεν ακυρώνει** την πρόσκληση: το πρότυπο έχει δική του
        // ετικέτα γι' αυτό («ένα γραφείο»). Σιωπή εδώ θα ήταν χειρότερη από ατελές email.
        logger.warn('Το όνομα του χώρου δεν διαβάστηκε — το email φεύγει χωρίς αυτό', {
          companyId: invitation.companyId,
          error: getErrorMessage(error),
        });
        return '';
      }),
      recipientLanguage(invitation.inviteeEmail, invitation.invitedByUid),
    ]);

    const email = buildWorkspaceInvitationEmail({
      language,
      workspaceName,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      token: input.token,
      nowISOValue: input.nowISOValue,
    });

    if (email === null) {
      logger.error('Πρόσκληση χωρίς δημόσια διεύθυνση — ΔΕΝ στάλθηκε email', {
        invitationId: invitation.id,
      });
      return 'unaddressable';
    }

    const sent = await sendReplyViaMailgun({
      to: invitation.inviteeEmail,
      subject: email.subject,
      textBody: email.text,
      htmlBody: email.html,
    });

    if (!sent.success) {
      logger.error('Το email πρόσκλησης δεν έγινε δεκτό από τον πάροχο', {
        invitationId: invitation.id,
        error: sent.error,
      });
      return 'failed';
    }

    logger.info('Το email πρόσκλησης έγινε δεκτό προς αποστολή', {
      invitationId: invitation.id,
      companyId: invitation.companyId,
    });
    return 'accepted';
  } catch (error: unknown) {
    // Ο τελευταίος φρουρός: **τίποτα** δεν ανεβαίνει στη διαδρομή (δες την κεφαλίδα).
    logger.error('Το email πρόσκλησης απέτυχε', {
      invitationId: invitation.id,
      error: getErrorMessage(error),
    });
    return 'failed';
  }
}
