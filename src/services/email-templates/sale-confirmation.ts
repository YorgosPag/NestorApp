/**
 * @fileoverview Sale Confirmation Email Template
 * @description HTML email επιβεβαίωσης πώλησης ακινήτου προς τον αγοραστή.
 *              Χρησιμοποιεί το branded base template της Pagonis Energo.
 * @note Inline styles ΑΠΑΙΤΟΥΝΤΑΙ σε HTML emails — δεν ισχύει ο κανόνας N.3 του CLAUDE.md
 */

import 'server-only';

import {
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

export interface SaleEmailData extends BuyerConfirmationFields {
  /** Final sale price — gross (incl. VAT) */
  finalPrice: number;
  /** Deposit already invoiced — gross */
  depositAlreadyInvoiced: number;
  /** Payment method */
  paymentMethod: string;
  /** Invoice reference (e.g. "A-42") */
  invoiceRef: string | null;
}

// ============================================================================
// TEMPLATE BUILDER
// ============================================================================

/**
 * Builds the full branded HTML email for sale confirmation.
 *
 * @returns { subject, html, text } — subject line, HTML body, plain-text fallback
 */
export function buildSaleConfirmationEmail(data: SaleEmailData): ConfirmationEmailResult {
  const remaining = data.finalPrice - data.depositAlreadyInvoiced;
  const { net: netRemaining, vat: vatRemaining } = splitVat(remaining);
  return assembleConfirmationEmail({
    subject: `Επιβεβαίωση πώλησης — ${data.propertyName}`,
    contentHtml: buildContentSection(data, remaining, netRemaining, vatRemaining),
    text: buildPlainText(data, remaining, netRemaining, vatRemaining),
    data,
  });
}

// ============================================================================
// CONTENT BUILDER (inner HTML)
// ============================================================================

function buildContentSection(
  data: SaleEmailData,
  remaining: number,
  netRemaining: number,
  vatRemaining: number
): string {
  const financialBody = `
          ${data.invoiceRef ? buildInfoRow('Παραστατικό', escapeHtml(data.invoiceRef)) : ''}
          ${buildInfoRow('Ημερομηνία', formatDateGreek(new Date()))}
          ${buildTotalRow('Τελική τιμή πώλησης', formatEuro(data.finalPrice))}
          ${data.depositAlreadyInvoiced > 0 ? buildInfoRow('Προκαταβολή (ήδη τιμολογημένη)', formatEuro(data.depositAlreadyInvoiced)) : ''}
          ${buildInfoRow('Υπόλοιπο (καθαρό)', formatEuro(netRemaining))}
          ${buildInfoRow('ΦΠΑ 24%', formatEuro(vatRemaining))}
          ${buildTotalRow('Υπόλοιπο (με ΦΠΑ)', formatEuro(remaining))}
          ${buildInfoRow('Τρόπος πληρωμής', formatPaymentMethod(data.paymentMethod))}`;

  return `
    ${buildGreeting(data.buyerName, 'Σας ευχαριστούμε για την εμπιστοσύνη σας. Η πώληση ολοκληρώθηκε επιτυχώς. Παρακάτω θα βρείτε τα στοιχεία της συναλλαγής.')}

    ${buildInfoCard({ title: 'ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ', bodyHtml: buildUnitPropertyCardBody(data) })}

    ${buildInfoCard({ title: 'ΟΙΚΟΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ ΠΩΛΗΣΗΣ', bodyHtml: financialBody })}

    ${buildClosing('Σας ευχόμαστε καλή απόλαυση του νέου σας ακινήτου! Για οποιαδήποτε απορία ή διευκρίνιση, μη διστάσετε να επικοινωνήσετε μαζί μας.', data.companyName ?? 'Pagonis Energo')}
  `;
}

// ============================================================================
// PLAIN TEXT FALLBACK
// ============================================================================

function buildPlainText(
  data: SaleEmailData,
  remaining: number,
  netRemaining: number,
  vatRemaining: number
): string {
  const lines: string[] = [
    `Αγαπητέ/ή ${data.buyerName},`,
    ``,
    `Σας ευχαριστούμε για την εμπιστοσύνη σας.`,
    `Η πώληση ολοκληρώθηκε επιτυχώς.`,
    ``,
    textSectionHeader('ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ'),
    ...buildUnitPropertyTextLines(data),
  ];

  lines.push(
    ``,
    textSectionHeader('ΟΙΚΟΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ ΠΩΛΗΣΗΣ'),
    `Ημερομηνία: ${formatDateGreek(new Date())}`,
  );
  if (data.invoiceRef) lines.push(`Παραστατικό: ${data.invoiceRef}`);
  lines.push(
    `Τελική τιμή πώλησης: ${formatEuro(data.finalPrice)}`,
  );
  if (data.depositAlreadyInvoiced > 0) {
    lines.push(`Προκαταβολή (ήδη τιμολογημένη): ${formatEuro(data.depositAlreadyInvoiced)}`);
  }
  lines.push(
    `Υπόλοιπο (καθαρό): ${formatEuro(netRemaining)}`,
    `ΦΠΑ 24%: ${formatEuro(vatRemaining)}`,
    `Υπόλοιπο (με ΦΠΑ): ${formatEuro(remaining)}`,
    `Τρόπος πληρωμής: ${formatPaymentMethod(data.paymentMethod)}`,
    ``,
    `Σας ευχόμαστε καλή απόλαυση του νέου σας ακινήτου!`,
    `Για οποιαδήποτε απορία, επικοινωνήστε μαζί μας.`,
    ``,
    `Με εκτίμηση,`,
    data.companyName ?? 'Pagonis Energo',
  );

  return lines.join('\n');
}
