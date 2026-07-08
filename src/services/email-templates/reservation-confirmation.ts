/**
 * @fileoverview Reservation Confirmation Email Template
 * @description HTML email αποστολή επιβεβαίωσης κράτησης προς τον αγοραστή.
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

export interface ReservationEmailData extends BuyerConfirmationFields {
  /** Deposit gross amount (incl. VAT) */
  depositAmount: number;
  /** Payment method */
  paymentMethod: string;
  /** Invoice reference (e.g. "A-42") */
  invoiceRef: string | null;
  /** Company contact info for footer */
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
  companyWebsite?: string;
}

// ============================================================================
// TEMPLATE BUILDER
// ============================================================================

/**
 * Builds the full branded HTML email for reservation confirmation.
 *
 * @returns { subject, html, text } — subject line, HTML body, plain-text fallback
 */
export function buildReservationConfirmationEmail(data: ReservationEmailData): ConfirmationEmailResult {
  const { net: netAmount, vat: vatAmount } = splitVat(data.depositAmount);
  return assembleConfirmationEmail({
    subject: `Επιβεβαίωση κράτησης — ${data.propertyName}`,
    contentHtml: buildContentSection(data, netAmount, vatAmount),
    text: buildPlainText(data, netAmount, vatAmount),
    data,
  });
}

// ============================================================================
// CONTENT BUILDER (inner HTML)
// ============================================================================

function buildContentSection(
  data: ReservationEmailData,
  netAmount: number,
  vatAmount: number
): string {
  const financialBody = `
          ${data.invoiceRef ? buildInfoRow('Παραστατικό', escapeHtml(data.invoiceRef)) : ''}
          ${buildInfoRow('Ημερομηνία', formatDateGreek(new Date()))}
          ${buildInfoRow('Καθαρό ποσό', formatEuro(netAmount))}
          ${buildInfoRow('ΦΠΑ 24%', formatEuro(vatAmount))}
          ${buildTotalRow('Σύνολο προκαταβολής', formatEuro(data.depositAmount))}
          ${buildInfoRow('Τρόπος πληρωμής', formatPaymentMethod(data.paymentMethod))}`;

  return `
    ${buildGreeting(data.buyerName, 'Σας ευχαριστούμε για την εμπιστοσύνη σας. Η κράτησή σας καταχωρήθηκε επιτυχώς. Παρακάτω θα βρείτε τα στοιχεία της συναλλαγής.')}

    ${buildInfoCard({ title: 'ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ', bodyHtml: buildUnitPropertyCardBody(data) })}

    ${data.depositAmount > 0 ? buildInfoCard({ title: 'ΟΙΚΟΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ ΚΡΑΤΗΣΗΣ', bodyHtml: financialBody }) : `
    <!-- No deposit — reservation without financial details -->
    <p style="margin:0 0 20px;font-size:14px;color:${BRAND.gray};line-height:1.6;padding:12px 16px;background-color:${BRAND.bgLight};border-radius:6px;border:1px solid ${BRAND.border};">
      Η κράτηση δεν συνοδεύεται από προκαταβολή. Τα οικονομικά στοιχεία θα καθοριστούν σε επόμενο στάδιο.
    </p>
    `}

    ${buildClosing('Για οποιαδήποτε απορία ή διευκρίνιση, μη διστάσετε να επικοινωνήσετε μαζί μας.', data.companyName ?? 'Pagonis Energo')}
  `;
}

// ============================================================================
// PLAIN TEXT FALLBACK
// ============================================================================

function buildPlainText(
  data: ReservationEmailData,
  netAmount: number,
  vatAmount: number
): string {
  const lines: string[] = [
    `Αγαπητέ/ή ${data.buyerName},`,
    ``,
    `Σας ευχαριστούμε για την εμπιστοσύνη σας.`,
    `Η κράτησή σας καταχωρήθηκε επιτυχώς.`,
    ``,
    textSectionHeader('ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ'),
    ...buildUnitPropertyTextLines(data),
  ];

  if (data.depositAmount > 0) {
    lines.push(
      ``,
      textSectionHeader('ΟΙΚΟΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ'),
      `Ημερομηνία: ${formatDateGreek(new Date())}`,
    );
    if (data.invoiceRef) lines.push(`Παραστατικό: ${data.invoiceRef}`);
    lines.push(
      `Καθαρό ποσό: ${formatEuro(netAmount)}`,
      `ΦΠΑ 24%: ${formatEuro(vatAmount)}`,
      `Σύνολο: ${formatEuro(data.depositAmount)}`,
      `Τρόπος πληρωμής: ${formatPaymentMethod(data.paymentMethod)}`,
    );
  } else {
    lines.push(
      ``,
      `Η κράτηση δεν συνοδεύεται από προκαταβολή.`,
      `Τα οικονομικά στοιχεία θα καθοριστούν σε επόμενο στάδιο.`,
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
