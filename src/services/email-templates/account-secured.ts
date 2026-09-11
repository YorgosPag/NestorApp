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
 * 🔴 **Η ΤΕΛΕΥΤΑΙΑ ΠΑΡΑΓΡΑΦΟΣ ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΣΗ — ΕΙΝΑΙ ΑΜΥΝΑ.** Η Firebase **δεν**
 * προσφέρει ακύρωση εκκρεμούς αλλαγής email (ADR-844 §13, δηλωμένο υπόλοιπο). Αν ο
 * επιτιθέμενος είχε ζητήσει αλλαγή πριν τη διεκδίκηση, ο άνθρωπος θα λάβει ειδοποίηση
 * «το email σας άλλαξε» με σύνδεσμο αναίρεσης — και πρέπει να ξέρει **από πριν** ότι
 * πρέπει να τον πατήσει.
 */
export function buildAccountSecuredEmail(data: AccountSecuredEmailData): ConfirmationEmailResult {
  const greeting = buildGreeting(
    data.recipientName,
    `Μόλις επιβεβαιώσατε ότι η διεύθυνση <strong>${escapeHtml(data.email)}</strong> είναι δική σας. `
      + 'Σε αυτή τη διεύθυνση υπήρχε ήδη λογαριασμός με <strong>κωδικό πρόσβασης που δεν είχε '
      + 'επιβεβαιωθεί ποτέ από το email</strong>. Επειδή δεν μπορούμε να ξέρουμε ποιος τον όρισε, '
      + '<strong>τον αφαιρέσαμε και αποσυνδέσαμε κάθε άλλη συσκευή</strong> — ώστε πρόσβαση να '
      + 'έχει μόνο όποιος ελέγχει αυτό το email: εσείς.',
  );

  const reassurance = buildInfoCard({
    title: 'ΑΝ ΤΟΝ ΚΩΔΙΚΟ ΤΟΝ ΕΙΧΑΤΕ ΟΡΙΣΕΙ ΕΣΕΙΣ',
    bodyHtml:
      '<p style="margin:0;font-size:14px;line-height:1.6;">Δεν χάσατε τίποτα: ο λογαριασμός, οι '
      + 'επαφές και τα στοιχεία σας είναι όπως ήταν. Ορίστε απλώς νέο κωδικό με το κουμπί.</p>',
  });

  const warning = buildClosing(
    '<strong>Ένα ακόμη, για την ασφάλειά σας:</strong> αν τις επόμενες ημέρες λάβετε email ότι η '
      + 'διεύθυνση του λογαριασμού σας άλλαξε χωρίς να το ζητήσετε, πατήστε <strong>αμέσως</strong> '
      + 'τον σύνδεσμο αναίρεσης σε εκείνο το μήνυμα.',
    'Pagonis Energo',
  );

  const contentHtml = `${greeting}${renderShareCta(data.setPasswordUrl, 'Ορίστε νέο κωδικό')}`
    + `${reassurance}${warning}`;

  const textLines = [
    `${data.recipientName}, μόλις επιβεβαιώσατε ότι το ${data.email} είναι δικό σας.`,
    '',
    'Σε αυτή τη διεύθυνση υπήρχε λογαριασμός με κωδικό που δεν είχε επιβεβαιωθεί ποτέ από',
    'το email. Τον αφαιρέσαμε και αποσυνδέσαμε κάθε άλλη συσκευή, ώστε πρόσβαση να έχει',
    'μόνο όποιος ελέγχει το email: εσείς.',
    '',
    textSectionHeader('ΑΝ ΤΟΝ ΚΩΔΙΚΟ ΤΟΝ ΕΙΧΑΤΕ ΟΡΙΣΕΙ ΕΣΕΙΣ'),
    'Δεν χάσατε τίποτα. Ορίστε νέο κωδικό εδώ:',
    data.setPasswordUrl,
    '',
    'Αν λάβετε email ότι η διεύθυνση του λογαριασμού σας άλλαξε χωρίς να το ζητήσετε,',
    'πατήστε αμέσως τον σύνδεσμο αναίρεσης σε εκείνο το μήνυμα.',
  ];

  return assembleConfirmationEmail({
    subject: 'Ασφαλίσαμε τον λογαριασμό σας',
    contentHtml,
    text: textLines.join('\n'),
    data: { companyName: 'Pagonis Energo' },
  });
}
