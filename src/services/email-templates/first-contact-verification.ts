/**
 * @fileoverview **ΤΟ ΕΝΑ ΚΛΕΙΔΙ, ΟΙ ΔΥΟ ΠΟΡΤΕΣ** — το email που κρατά την επαφή.
 * @description Στέλνεται στον επισκέπτη **χωρίς λογαριασμό** που πλησίασε αγγελία.
 *              Μέχρι να πατηθεί ο σύνδεσμος ή να γραφτεί ο κωδικός, **ο ιδιοκτήτης
 *              δεν έμαθε τίποτα** (ADR-844).
 * @note Inline styles ΑΠΑΙΤΟΥΝΤΑΙ σε HTML emails — δεν ισχύει ο κανόνας N.3.
 * @note Οι ελληνικές συμβολοσειρές εδώ ΔΕΝ είναι i18n violation: τα server-side email
 *       templates φέρουν το κείμενό τους inline **by design** (βλ.
 *       `pending-registration-admin.ts`).
 */

import 'server-only';

import {
  escapeHtml,
  buildGreeting,
  buildClosing,
  buildInfoCard,
  assembleConfirmationEmail,
  textSectionHeader,
  type ConfirmationEmailResult,
} from './confirmation-email-shared';

// ============================================================================
// TYPES
// ============================================================================

export interface FirstContactVerificationEmailData {
  /** Πώς θέλει να τον λένε — όπως το έγραψε ο ίδιος. */
  seekerName: string;
  /** Τι πλησίασε, σε ανθρώπινη γλώσσα («το ακίνητο στην Καλαμαριά»). */
  targetLabel: string;
  /** Πλήρες URL της σελίδας επιβεβαίωσης, με το token μέσα. */
  confirmUrl: string;
  /** Ο εξαψήφιος κωδικός — **ωμός εδώ και μόνο εδώ**. */
  code: string;
  /** Πόσες μέρες ζει ο σύνδεσμος. */
  lifetimeDays: number;
}

// ============================================================================
// BUILDER
// ============================================================================

/**
 * 🔑 **Ο κωδικός τυπώνεται ΜΕΓΑΛΟΣ και με κενά ανά τρία ψηφία.**
 *
 * Ο άνθρωπος τον διαβάζει από **μία** οθόνη και τον γράφει σε **άλλη** — συχνά
 * εναλλάσσοντας εφαρμογές στο κινητό, με τον κωδικό στη μνήμη του. Τα κενά ανά τρία
 * μειώνουν μετρημένα το λάθος αντιγραφής, και είναι ο λόγος που κάθε τράπεζα τυπώνει
 * έτσι τους κωδικούς μιας χρήσης.
 *
 * ⚠️ Τα κενά είναι **μόνο εμφάνιση**: η επαλήθευση κάνει `trim()` και συγκρίνει τα έξι
 * ψηφία. Αν κάποιος αντιγράψει και τα κενά, **πρέπει** να δουλέψει.
 */
function spacedCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

/**
 * Χτίζει το email επιβεβαίωσης πρώτης επαφής.
 *
 * ⚠️ **Το κουμπί ΠΡΩΤΑ, ο κωδικός ΑΠΟ ΚΑΤΩ** — και η σειρά δεν είναι αισθητική: στον
 * υπολογιστή ο σύνδεσμος είναι φυσικός *(ο φυλλομετρητής είναι δίπλα)*, στο κινητό ο
 * κωδικός σώζει τη συνεδρία από τον μίνι-browser της εφαρμογής email. Ο άνθρωπος
 * διαλέγει· εμείς δεν μαντεύουμε σε τι συσκευή είναι.
 */
export function buildFirstContactVerificationEmail(
  data: FirstContactVerificationEmailData,
): ConfirmationEmailResult {
  const greeting = buildGreeting(
    escapeHtml(data.seekerName),
    `Λάβαμε το μήνυμά σας για <strong>${escapeHtml(data.targetLabel)}</strong>. `
      + 'Μένει <strong>ένα βήμα</strong>: να επιβεβαιώσετε ότι αυτή η διεύθυνση email '
      + 'είναι δική σας. <strong>Μέχρι τότε ο ιδιοκτήτης δεν έχει ειδοποιηθεί.</strong>',
  );

  const button =
    `<div style="text-align:center;margin:28px 0;">`
    + `<a href="${escapeHtml(data.confirmUrl)}" `
    + `style="display:inline-block;background:#1a56db;color:#ffffff;text-decoration:none;`
    + `padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px;">`
    + `Στείλτε το μήνυμά σας</a></div>`;

  const codeCard = buildInfoCard({
    title: 'Ή ΓΡΑΨΤΕ ΑΥΤΟΝ ΤΟΝ ΚΩΔΙΚΟ ΣΤΗ ΣΕΛΙΔΑ',
    bodyHtml:
      `<div style="text-align:center;font-size:30px;font-weight:700;letter-spacing:6px;`
      + `font-family:'Courier New',monospace;color:#111827;padding:8px 0;">`
      + `${escapeHtml(spacedCode(data.code))}</div>`
      + `<div style="text-align:center;font-size:13px;color:#6b7280;">`
      + `Χρήσιμο αν έχετε ακόμη ανοιχτή τη σελίδα της αγγελίας.</div>`,
  });

  // ⚖️ **Η ΕΝΗΜΕΡΩΣΗ ΤΟΥ EDPB, ΔΕΥΤΕΡΗ ΦΟΡΑ.** Ειπώθηκε ήδη στη φόρμα πριν πατηθεί
  //    το κουμπί· επαναλαμβάνεται εδώ γιατί αυτό είναι το **σημείο της πράξης**, και
  //    η σύσταση 2/2025 ζητά ο άνθρωπος να ξέρει **γιατί** αποκτά λογαριασμό — όχι να
  //    το έχει διαβάσει κάποτε.
  const closing = buildClosing(
    `Ο σύνδεσμος και ο κωδικός ισχύουν για <strong>${data.lifetimeDays} ημέρες</strong> και `
      + 'χρησιμοποιούνται <strong>μία φορά</strong>. Με την επιβεβαίωση δημιουργείται ο '
      + 'λογαριασμός σας, ώστε να μπορείτε να δείτε αν ο ιδιοκτήτης είδε το μήνυμα και να '
      + 'το αποσύρετε όποτε θέλετε.<br><br>'
      + '<span style="color:#6b7280;font-size:13px;">Αν δεν στείλατε εσείς αυτό το μήνυμα, '
      + '<strong>αγνοήστε το</strong>: χωρίς την επιβεβαίωσή σας δεν φεύγει τίποτα και δεν '
      + 'δημιουργείται κανένας λογαριασμός.</span>',
    'Pagonis Energo',
  );

  const contentHtml = `${greeting}${button}${codeCard}${closing}`;

  const textLines = [
    `${data.seekerName}, μένει ένα βήμα.`,
    '',
    `Λάβαμε το μήνυμά σας για ${data.targetLabel}.`,
    'Ο ιδιοκτήτης ΔΕΝ έχει ειδοποιηθεί ακόμη.',
    '',
    textSectionHeader('ΓΙΑ ΝΑ ΣΤΑΛΕΙ'),
    `Ανοίξτε: ${data.confirmUrl}`,
    `Ή γράψτε τον κωδικό στη σελίδα: ${spacedCode(data.code)}`,
    '',
    `Ισχύουν για ${data.lifetimeDays} ημέρες, μία φορά.`,
    'Με την επιβεβαίωση δημιουργείται ο λογαριασμός σας, ώστε να βλέπετε αν το είδε ο',
    'ιδιοκτήτης και να μπορείτε να το αποσύρετε.',
    '',
    'Αν δεν στείλατε εσείς αυτό το μήνυμα, αγνοήστε το: χωρίς επιβεβαίωση δεν φεύγει',
    'τίποτα και δεν δημιουργείται λογαριασμός.',
  ];

  return assembleConfirmationEmail({
    // ⚠️ **Ο κωδικός ΔΕΝ μπαίνει στο θέμα.** Τα θέματα διαβάζονται σε ειδοποιήσεις
    //    κλειδωμένης οθόνης, φαίνονται σε κοινόχρηστους υπολογιστές, και καταγράφονται
    //    από διακομιστές αλληλογραφίας. Ό,τι ανοίγει πόρτα μένει **μέσα** στο μήνυμα.
    subject: 'Επιβεβαιώστε το email σας για να σταλεί το μήνυμά σας',
    contentHtml,
    text: textLines.join('\n'),
    data: { companyName: 'Pagonis Energo' },
  });
}
