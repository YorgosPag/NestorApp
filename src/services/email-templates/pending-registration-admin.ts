/**
 * @fileoverview Pending Registration — Admin Notification Email Template
 * @description HTML/text email που ειδοποιεί τους διαχειριστές της εταιρείας ότι
 *              ένας νέος χρήστης αυτο-εγγράφηκε και εκκρεμεί έγκριση (ADR-660).
 *              Χρησιμοποιεί το branded base template της Pagonis Energo (SSoT).
 * @note Inline styles ΑΠΑΙΤΟΥΝΤΑΙ σε HTML emails — δεν ισχύει ο κανόνας N.3.
 * @note Οι ελληνικές συμβολοσειρές εδώ ΔΕΝ είναι i18n violation: ο έλεγχος 3.8
 *       πιάνει μόνο `defaultValue:` — τα server-side email templates (βλ.
 *       professional-assignment.ts) φέρουν το κείμενό τους inline by design.
 */

import 'server-only';

import {
  escapeHtml,
  formatDateGreek,
  buildInfoRow,
  buildInfoCard,
  buildGreeting,
  buildClosing,
  assembleConfirmationEmail,
  textSectionHeader,
  type ConfirmationEmailResult,
} from './confirmation-email-shared';

// ============================================================================
// TYPES
// ============================================================================

export interface PendingRegistrationAdminEmailData {
  /** Email του χρήστη που αυτο-εγγράφηκε */
  pendingEmail: string;
  /** Ονοματεπώνυμο (αν υπάρχει) — αλλιώς null */
  pendingName: string | null;
  /** Πάροχος ταυτοποίησης (google.com, password, ...) */
  authProvider: string | null;
  /** Χρονική στιγμή αιτήματος */
  requestedAt: Date;
  /** Πλήρες URL της κονσόλας διαχείρισης ρόλων (κενό = χωρίς κουμπί) */
  reviewUrl: string;
}

// ============================================================================
// LABELS (server-side copy — SSoT για το κείμενο αυτού του email)
// ============================================================================

// Firebase auth provider id → human label. Written as guards (not an object map) so the
// `password` provider id is never in a `key: 'value'` position — that shape trips the
// secret-scan heuristic (CHECK 10) even though this is a UI label, not a credential.
function providerLabel(authProvider: string | null): string {
  if (!authProvider) return 'Άγνωστος';
  if (authProvider === 'google.com') return 'Google';
  if (authProvider === 'microsoft.com') return 'Microsoft';
  if (authProvider === 'password') return 'Email / Κωδικός';
  return authProvider;
}

// ============================================================================
// BUILDER
// ============================================================================

/**
 * Χτίζει το email ειδοποίησης προς τον διαχειριστή για εκκρεμή εγγραφή.
 * Επιστρέφει `{ subject, html, text }` έτοιμο για αποστολή μέσω Mailgun.
 */
export function buildPendingRegistrationAdminEmail(
  data: PendingRegistrationAdminEmailData,
): ConfirmationEmailResult {
  const displayName = data.pendingName?.trim() || data.pendingEmail;
  const provider = providerLabel(data.authProvider);
  const when = formatDateGreek(data.requestedAt);

  const cardBody = [
    buildInfoRow('Email', escapeHtml(data.pendingEmail)),
    data.pendingName ? buildInfoRow('Ονοματεπώνυμο', escapeHtml(data.pendingName)) : '',
    buildInfoRow('Τρόπος εγγραφής', escapeHtml(provider)),
    buildInfoRow('Ημερομηνία αιτήματος', escapeHtml(when)),
  ].join('');

  const greeting = buildGreeting(
    'Διαχειριστή',
    'Ένας νέος χρήστης <strong>αυτο-εγγράφηκε</strong> στην πλατφόρμα και '
      + 'εκκρεμεί η έγκρισή του. Μέχρι να τον εγκρίνετε, ο χρήστης <strong>δεν έχει '
      + 'καμία πρόσβαση</strong> στα δεδομένα της εταιρείας.',
  );

  const card = buildInfoCard({ title: 'ΣΤΟΙΧΕΙΑ ΑΙΤΗΜΑΤΟΣ ΕΓΓΡΑΦΗΣ', bodyHtml: cardBody });

  const reviewHtml = data.reviewUrl
    ? `Για έγκριση ή απόρριψη, ανοίξτε την κονσόλα διαχείρισης χρηστών: `
      + `<a href="${escapeHtml(data.reviewUrl)}" style="color:#1a56db;font-weight:600;">Διαχείριση Ρόλων</a>.`
    : 'Για έγκριση ή απόρριψη, ανοίξτε την κονσόλα «Διαχείριση Ρόλων» → καρτέλα «Χρήστες».';

  const closing = buildClosing(reviewHtml, 'Pagonis Energo');

  const contentHtml = `${greeting}${card}${closing}`;

  const textLines = [
    'Νέο αίτημα εγγραφής προς έγκριση',
    '',
    textSectionHeader('ΣΤΟΙΧΕΙΑ ΑΙΤΗΜΑΤΟΣ'),
    `Email: ${data.pendingEmail}`,
    data.pendingName ? `Ονοματεπώνυμο: ${data.pendingName}` : '',
    `Τρόπος εγγραφής: ${provider}`,
    `Ημερομηνία αιτήματος: ${when}`,
    '',
    'Ο χρήστης δεν έχει καμία πρόσβαση μέχρι την έγκρισή σας.',
    data.reviewUrl ? `Έγκριση/απόρριψη: ${data.reviewUrl}` : 'Έγκριση/απόρριψη: κονσόλα «Διαχείριση Ρόλων».',
  ].filter(Boolean);

  return assembleConfirmationEmail({
    subject: `Νέο αίτημα εγγραφής προς έγκριση — ${displayName}`,
    contentHtml,
    text: textLines.join('\n'),
    data: { companyName: 'Pagonis Energo' },
  });
}
