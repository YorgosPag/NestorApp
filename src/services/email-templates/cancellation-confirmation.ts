/**
 * @fileoverview Cancellation Confirmation Email Template
 * @description HTML email ειδοποίησης ακύρωσης κράτησης/πώλησης προς τον αγοραστή.
 *              Χρησιμοποιεί το branded base template της Pagonis Energo.
 * @note Inline styles ΑΠΑΙΤΟΥΝΤΑΙ σε HTML emails — δεν ισχύει ο κανόνας N.3 του CLAUDE.md
 */

import 'server-only';

import {
  BRAND,
  escapeHtml,
  formatEuro,
  formatDateGreek,
  formatPaymentMethod,
  buildInfoRow,
  buildTotalRow,
  buildInfoCard,
  buildGreeting,
  buildClosing,
  assembleConfirmationEmail,
  splitVat,
  buildUnitPropertyCardBody,
  buildUnitPropertyTextLines,
  textSectionHeader,
  type ConfirmationEmailResult,
  type BuyerConfirmationFields,
} from './confirmation-email-shared';

// ============================================================================
// TYPES
// ============================================================================

export interface CancellationEmailData extends BuyerConfirmationFields {
  /** Credit/refund gross amount (incl. VAT) */
  creditAmount: number;
  /** Payment method for refund */
  paymentMethod: string;
  /** Cancellation reason (e.g. "Ακύρωση κράτησης") */
  reason: string;
  /** Credit note reference (e.g. "A-42") */
  creditNoteRef: string | null;
}

// ============================================================================
// TEMPLATE BUILDER
// ============================================================================

/**
 * Builds the full branded HTML email for cancellation confirmation.
 *
 * @returns { subject, html, text } — subject line, HTML body, plain-text fallback
 */
export function buildCancellationConfirmationEmail(data: CancellationEmailData): ConfirmationEmailResult {
  const { net: netAmount, vat: vatAmount } = splitVat(data.creditAmount);
  return assembleConfirmationEmail({
    subject: `${data.reason} — ${data.propertyName}`,
    contentHtml: buildContentSection(data, netAmount, vatAmount),
    text: buildPlainText(data, netAmount, vatAmount),
    data,
  });
}

// ============================================================================
// CONTENT BUILDER (inner HTML)
// ============================================================================

function buildContentSection(
  data: CancellationEmailData,
  netAmount: number,
  vatAmount: number
): string {
  const reasonBody = `
          <p style="margin:0;font-size:14px;color:${BRAND.navyDark};font-weight:500;">
            ${escapeHtml(data.reason)}
          </p>
          ${buildInfoRow('Ημερομηνία ακύρωσης', formatDateGreek(new Date()))}`;

  const refundBody = `
          ${data.creditNoteRef ? buildInfoRow('Πιστωτικό', escapeHtml(data.creditNoteRef)) : ''}
          ${buildInfoRow('Καθαρό ποσό', formatEuro(netAmount))}
          ${buildInfoRow('ΦΠΑ 24%', formatEuro(vatAmount))}
          ${buildTotalRow('Σύνολο επιστροφής', formatEuro(data.creditAmount))}
          ${buildInfoRow('Τρόπος επιστροφής', formatPaymentMethod(data.paymentMethod))}`;

  return `
    ${buildGreeting(data.buyerName, 'Σας ενημερώνουμε ότι η κράτησή σας ακυρώθηκε. Παρακάτω θα βρείτε τα στοιχεία της ακύρωσης.')}

    ${buildInfoCard({ title: 'ΑΙΤΙΟΛΟΓΙΑ ΑΚΥΡΩΣΗΣ', bodyHtml: reasonBody, headerColor: '#DC2626' })}

    ${buildInfoCard({ title: 'ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ', bodyHtml: buildUnitPropertyCardBody(data) })}

    ${data.creditAmount > 0 ? buildInfoCard({ title: 'ΣΤΟΙΧΕΙΑ ΕΠΙΣΤΡΟΦΗΣ', bodyHtml: refundBody }) : ''}

    ${buildClosing('Για οποιαδήποτε απορία ή διευκρίνιση, μη διστάσετε να επικοινωνήσετε μαζί μας.', data.companyName ?? 'Pagonis Energo')}
  `;
}

// ============================================================================
// PLAIN TEXT FALLBACK
// ============================================================================

function buildPlainText(
  data: CancellationEmailData,
  netAmount: number,
  vatAmount: number
): string {
  const lines: string[] = [
    `Αγαπητέ/ή ${data.buyerName},`,
    ``,
    `Σας ενημερώνουμε ότι η κράτησή σας ακυρώθηκε.`,
    ``,
    textSectionHeader('ΑΙΤΙΟΛΟΓΙΑ'),
    `${data.reason}`,
    `Ημερομηνία ακύρωσης: ${formatDateGreek(new Date())}`,
    ``,
    textSectionHeader('ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ'),
    ...buildUnitPropertyTextLines(data),
  ];

  if (data.creditAmount > 0) {
    lines.push(
      ``,
      textSectionHeader('ΣΤΟΙΧΕΙΑ ΕΠΙΣΤΡΟΦΗΣ'),
    );
    if (data.creditNoteRef) lines.push(`Πιστωτικό: ${data.creditNoteRef}`);
    lines.push(
      `Καθαρό ποσό: ${formatEuro(netAmount)}`,
      `ΦΠΑ 24%: ${formatEuro(vatAmount)}`,
      `Σύνολο επιστροφής: ${formatEuro(data.creditAmount)}`,
      `Τρόπος επιστροφής: ${formatPaymentMethod(data.paymentMethod)}`,
    );
  }

  lines.push(
    ``,
    `Για οποιαδήποτε απορία, επικοινωνήστε μαζί μας.`,
    ``,
    `Με εκτίμηση,`,
    data.companyName ?? 'Pagonis Energo',
  );

  return lines.join('\n');
}
