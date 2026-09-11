/**
 * @fileoverview **«ΑΣΦΑΛΙΣΑΜΕ ΤΟΝ ΛΟΓΑΡΙΑΣΜΟ ΣΑΣ»** — το email μετά από διεκδίκηση (ADR-844 §13).
 * @description Στέλνεται **μόνο** όταν μια απόδειξη γραμματοκιβωτίου αφαίρεσε κωδικό
 *              πρόσβασης που είχε οριστεί **χωρίς** επιβεβαίωση του email
 *              (`server/auth/mailbox-proof-custody.ts`).
 * @note Inline styles ΑΠΑΙΤΟΥΝΤΑΙ σε HTML emails — δεν ισχύει ο κανόνας N.3.
 * @note Οι ελληνικές συμβολοσειρές εδώ ΔΕΝ είναι i18n violation: τα server-side email
 *       templates φέρουν το κείμενό τους inline **by design** (βλ.
 *       `pending-registration-admin.ts`).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΣΕ ΠΟΙΟΝ ΜΙΛΑ — ΔΥΟ ΑΝΘΡΩΠΟΥΣ ΜΕ ΤΟ ΙΔΙΟ ΚΕΙΜΕΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο διακομιστής **δεν** μπορεί να ξέρει ποιος από τους δύο είναι:
 * - **το θύμα** — δεν όρισε ποτέ κωδικό· κάποιος άλλος έγραψε το email του. Του
 *   λέμε ότι **αποκλείστηκε** ο άλλος.
 * - **ο νόμιμος χρήστης σε άλλη συσκευή** — όρισε ο ίδιος τον κωδικό και απλώς δεν
 *   επιβεβαίωσε το email. Του λέμε ότι **δεν έχασε τίποτα** και του δίνουμε **ένα**
 *   κουμπί.
 *
 * ⇒ Το κείμενο είναι γραμμένο ώστε να είναι **αληθές και για τους δύο** — χωρίς
 * κατηγορία, χωρίς πανικό.
 */

import 'server-only';

import {
  buildGreeting,
  buildClosing,
  buildInfoCard,
  assembleConfirmationEmail,
  escapeHtml,
  textSectionHeader,
  type ConfirmationEmailResult,
} from './confirmation-email-shared';
import { renderShareCta } from './showcase-email-shared';

export interface AccountSecuredEmailData {
  /** Πώς θέλει να τον λένε — όπως το έγραψε ο ίδιος στη φόρμα. */
  recipientName: string;
  /** Η διεύθυνση που **μόλις αποδείχθηκε**. */
  email: string;
  /** Σύνδεσμος ορισμού νέου κωδικού (Firebase `generatePasswordResetLink`). */
  setPasswordUrl: string;
}

/**
 * 🔑 **Η ΠΑΛΙΑ ΤΕΛΕΥΤΑΙΑ ΠΑΡΑΓΡΑΦΟΣ ΑΦΑΙΡΕΘΗΚΕ, ΚΑΙ ΕΙΝΑΙ ΚΑΛΟ ΝΕΟ** (ADR-844 §13.8): έλεγε
 * «αν λάβετε email ότι η διεύθυνση άλλαξε, πατήστε αναίρεση» — άμυνα σε **εκκρεμή** αλλαγή
 * email του επιτιθέμενου, που τότε θεωρούνταν αδύνατο να ακυρωθεί. Η διεκδίκηση πλέον
 * **ξαναχτίζει** τον λογαριασμό, και μετρήθηκε στην παραγωγή ότι αυτό **σκοτώνει** τον
 * εκκρεμή κωδικό. Μια προειδοποίηση για κίνδυνο που δεν υπάρχει θα ήταν θόρυβος — και ο
 * θόρυβος μαθαίνει στον άνθρωπο να αγνοεί τις προειδοποιήσεις.
 */
export function buildAccountSecuredEmail(data: AccountSecuredEmailData): ConfirmationEmailResult {
  const greeting = buildGreeting(
    data.recipientName,
    `Μόλις επιβεβαιώσατε ότι η διεύθυνση <strong>${escapeHtml(data.email)}</strong> είναι δική σας. `
      + 'Σε αυτή τη διεύθυνση υπήρχε ήδη λογαριασμός με <strong>τρόπο σύνδεσης που δεν είχε '
      + 'επιβεβαιωθεί ποτέ από το email</strong> (κωδικό πρόσβασης ή συνδεδεμένο λογαριασμό). Επειδή '
      + 'δεν μπορούμε να ξέρουμε ποιος τον όρισε, <strong>τον αφαιρέσαμε και αποσυνδέσαμε κάθε '
      + 'συσκευή</strong> — ώστε πρόσβαση να έχει μόνο όποιος ελέγχει αυτό το email: εσείς.',
  );

  const reassurance = buildInfoCard({
    title: 'ΑΝ ΤΟΝ ΚΩΔΙΚΟ ΤΟΝ ΕΙΧΑΤΕ ΟΡΙΣΕΙ ΕΣΕΙΣ',
    bodyHtml:
      '<p style="margin:0;font-size:14px;line-height:1.6;">Δεν χάσατε τίποτα: ο λογαριασμός, οι '
      + 'επαφές και τα στοιχεία σας είναι όπως ήταν. Ορίστε απλώς νέο κωδικό με το κουμπί.</p>',
  });

  const closing = buildClosing(
    'Αν αυτό δεν σας αφορά, δεν χρειάζεται να κάνετε τίποτα: ο λογαριασμός είναι ήδη ασφαλής.',
    'Pagonis Energo',
  );

  const contentHtml = `${greeting}${renderShareCta(data.setPasswordUrl, 'Ορίστε νέο κωδικό')}`
    + `${reassurance}${closing}`;

  const textLines = [
    `${data.recipientName}, μόλις επιβεβαιώσατε ότι το ${data.email} είναι δικό σας.`,
    '',
    'Σε αυτή τη διεύθυνση υπήρχε λογαριασμός με τρόπο σύνδεσης που δεν είχε επιβεβαιωθεί',
    'ποτέ από το email. Τον αφαιρέσαμε και αποσυνδέσαμε κάθε συσκευή, ώστε πρόσβαση να έχει',
    'μόνο όποιος ελέγχει το email: εσείς.',
    '',
    textSectionHeader('ΑΝ ΤΟΝ ΚΩΔΙΚΟ ΤΟΝ ΕΙΧΑΤΕ ΟΡΙΣΕΙ ΕΣΕΙΣ'),
    'Δεν χάσατε τίποτα. Ορίστε νέο κωδικό εδώ:',
    data.setPasswordUrl,
  ];

  return assembleConfirmationEmail({
    subject: 'Ασφαλίσαμε τον λογαριασμό σας',
    contentHtml,
    text: textLines.join('\n'),
    data: { companyName: 'Pagonis Energo' },
  });
}
