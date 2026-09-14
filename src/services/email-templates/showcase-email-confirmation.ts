/**
 * @fileoverview **«ΛΑΜΒΑΝΕΙ ΑΥΤΟ ΤΟ ΓΡΑΜΜΑΤΟΚΙΒΩΤΙΟ;»** — το email επιβεβαίωσης διεύθυνσης της κάρτας (ADR-841 §7 Α21.18).
 * @description Στέλνεται στη διεύθυνση που ο επαγγελματίας δημοσιεύει στην κάρτα του, όταν πατήσει
 *              «Αποστολή επιβεβαίωσης». Μέχρι να πατηθεί «Επιβεβαίωση» στη σελίδα, **τίποτα** δεν αλλάζει.
 * @note Inline styles ΑΠΑΙΤΟΥΝΤΑΙ σε HTML emails — δεν ισχύει ο κανόνας N.3.
 * @note Οι ελληνικές συμβολοσειρές εδώ ΔΕΝ είναι i18n violation: τα server-side email templates φέρουν
 *       το κείμενό τους inline **by design** (βλ. `first-contact-verification.ts`).
 */

import 'server-only';

import { PRODUCT_NAME } from '@/constants/product-identity';

import {
  assembleConfirmationEmail,
  buildClosing,
  buildGreeting,
  escapeHtml,
  textSectionHeader,
  type ConfirmationEmailResult,
} from './confirmation-email-shared';

export interface ShowcaseEmailConfirmationEmailData {
  /** Η **δημόσια** επωνυμία της βιτρίνας — αυτή που βλέπει ο επισκέπτης δίπλα στο σήμα. */
  readonly agencyName: string;
  /** Η διεύθυνση που επιβεβαιώνεται — ο παραλήπτης βλέπει **ποια** από τις διευθύνσεις του. */
  readonly email: string;
  /** Η σελίδα που **δείχνει** το αίτημα — το πάτημα του κουμπιού εκεί γράφει, όχι ο σύνδεσμος. */
  readonly confirmUrl: string;
  /** Ίδια σελίδα με την άρνηση προεπιλεγμένη. */
  readonly disownUrl: string;
  readonly lifetimeHours: number;
}

/**
 * ⚠️ **Η ΔΙΑΤΥΠΩΣΗ ΚΡΑΤΑ ΛΕΞΕΙΣ, Ο RENDERER ΚΡΑΤΑ ΣΗΜΑΝΣΗ** — ίδιο ιδίωμα με το `workspace-invitation-email`:
 * ωμό `<strong>Ελληνικά</strong>` μέσα σε `.ts` το μπλοκάρει η πύλη N.11 (δεν ξεχωρίζει JSX από HTML email),
 * και η θεραπεία δεν είναι εξαίρεση — είναι να μη γράφεται η σήμανση δίπλα στη λέξη.
 */
const strong = (text: string): string => `<strong>${escapeHtml(text)}</strong>`;

const LINK_STYLE = 'color:#1a56db;text-decoration:underline;';
const link = (href: string, text: string): string =>
  `<a href="${escapeHtml(href)}" style="${LINK_STYLE}">${escapeHtml(text)}</a>`;

/**
 * 🔑 **Δύο σύνδεσμοι, ίση θέση για το «όχι»**: ένα email που ζητά επιβεβαίωση χωρίς να προσφέρει άρνηση
 * αφήνει τον παραλήπτη που **δεν** το ζήτησε μόνο με το «αγνοήστε το» — και ένα τρίτο αίτημα αύριο.
 *
 * ⚠️ **Ο σύνδεσμος ΔΕΝ επιβεβαιώνει μόνος του** (σαρωτές αλληλογραφίας), και το κείμενο το λέει: «ανοίξτε
 * τη σελίδα και πατήστε». Αλλιώς ο άνθρωπος θα νόμιζε ότι τελείωσε με το κλικ στο email.
 */
export function buildShowcaseEmailConfirmationEmail(data: ShowcaseEmailConfirmationEmailData): ConfirmationEmailResult {
  const greeting = buildGreeting(
    data.agencyName,
    `Η επιχείρησή σας δημοσιεύει τη διεύθυνση ${strong(data.email)} στην επαγγελματική `
      + `της κάρτα και ζήτησε να επιβεβαιωθεί ότι ${strong('λαμβάνει μηνύματα')}. Ανοίξτε τη σελίδα και `
      + 'πατήστε «Επιβεβαίωση».',
  );

  const button =
    `<div style="text-align:center;margin:28px 0;">`
    + `<a href="${escapeHtml(data.confirmUrl)}" `
    + `style="display:inline-block;background:#1a56db;color:#ffffff;text-decoration:none;`
    + `padding:14px 32px;border-radius:8px;font-weight:700;font-size:16px;">`
    + `Άνοιγμα σελίδας επιβεβαίωσης</a></div>`;

  const closing = buildClosing(
    `Οι επισκέπτες της κάρτας θα βλέπουν μόνο ότι η διεύθυνση ${strong('επιβεβαιώθηκε')} και πότε — `
      + 'όχι ότι η επιχείρηση πιστοποιήθηκε. Ο σύνδεσμος ισχύει για '
      + `${strong(`${data.lifetimeHours} ώρες`)} και χρησιμοποιείται ${strong('μία φορά')}.<br><br>`
      + '<span style="color:#6b7280;font-size:13px;">Δεν το ζητήσατε εσείς; '
      + `${link(data.disownUrl, 'Δηλώστε ότι δεν το ζητήσατε')} — δεν θα επιβεβαιωθεί τίποτα.</span>`,
    PRODUCT_NAME,
  );

  const text = [
    `${data.agencyName},`,
    '',
    `Η επιχείρησή σας δημοσιεύει τη διεύθυνση ${data.email} στην επαγγελματική της κάρτα`,
    'και ζήτησε να επιβεβαιωθεί ότι λαμβάνει μηνύματα.',
    '',
    textSectionHeader('ΓΙΑ ΝΑ ΕΠΙΒΕΒΑΙΩΣΕΤΕ'),
    `Ανοίξτε: ${data.confirmUrl}`,
    'και πατήστε «Επιβεβαίωση».',
    '',
    `Ισχύει για ${data.lifetimeHours} ώρες, μία φορά.`,
    'Οι επισκέπτες βλέπουν μόνο ότι η διεύθυνση επιβεβαιώθηκε και πότε.',
    '',
    `Δεν το ζητήσατε εσείς; ${data.disownUrl}`,
  ].join('\n');

  return assembleConfirmationEmail({
    subject: 'Επιβεβαιώστε τη διεύθυνση email της επαγγελματικής σας κάρτας',
    contentHtml: `${greeting}${button}${closing}`,
    text,
    data: { companyName: PRODUCT_NAME },
  });
}
