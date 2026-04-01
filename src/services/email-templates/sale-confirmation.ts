/**
 * @fileoverview Sale Confirmation Email Template
 * @description HTML email επιβεβαίωσης πώλησης ακινήτου προς τον αγοραστή.
 *              Χρησιμοποιεί το branded base template της Pagonis Energo.
 * @note Inline styles ΑΠΑΙΤΟΥΝΤΑΙ σε HTML emails — δεν ισχύει ο κανόνας N.3 του CLAUDE.md
 */

import 'server-only';

import {
  wrapInBrandedTemplate,
  BRAND,
  escapeHtml,
  formatEuro,
  formatDateGreek,
  formatPaymentMethod,
} from './base-email-template';

// ============================================================================
// TYPES
// ============================================================================

export interface SaleEmailData {
  /** Buyer display name */
  buyerName: string;
  /** Unit name (e.g. "Α-101") */
  propertyName: string;
  /** Floor number */
  unitFloor: number | null;
  /** Building name */
  buildingName: string | null;
  /** Project name */
  projectName: string | null;
  /** Project address */
  projectAddress: string | null;
  /** Company name (κατασκευαστική) */
  companyName: string | null;
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
export function buildSaleConfirmationEmail(data: SaleEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Επιβεβαίωση πώλησης — ${data.propertyName}`;

  const VAT_DIVISOR = 1.24;
  const remaining = data.finalPrice - data.depositAlreadyInvoiced;
  const netRemaining = remaining / VAT_DIVISOR;
  const vatRemaining = remaining - netRemaining;

  const contentHtml = buildContentSection(data, remaining, netRemaining, vatRemaining);

  const html = wrapInBrandedTemplate({
    contentHtml,
    companyName: data.companyName ?? 'Pagonis Energo',
  });

  const text = buildPlainText(data, remaining, netRemaining, vatRemaining);

  return { subject, html, text };
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
  const floorText = data.unitFloor !== null && data.unitFloor !== undefined
    ? ` — ${data.unitFloor}ος όροφος`
    : '';

  return `
    <!-- Greeting -->
    <p style="margin:0 0 16px;font-size:16px;color:${BRAND.navyDark};">
      Αγαπητέ/ή <strong>${escapeHtml(data.buyerName)}</strong>,
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:${BRAND.gray};line-height:1.6;">
      Σας ευχαριστούμε για την εμπιστοσύνη σας. Η πώληση ολοκληρώθηκε επιτυχώς.
      Παρακάτω θα βρείτε τα στοιχεία της συναλλαγής.
    </p>

    <!-- Info card: Property -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid ${BRAND.border};border-radius:6px;overflow:hidden;">
      <tr>
        <td style="background-color:${BRAND.navy};padding:10px 16px;">
          <p style="margin:0;font-size:13px;font-weight:600;color:${BRAND.white};letter-spacing:0.5px;">
            ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px;">
          ${buildInfoRow('Μονάδα', `${escapeHtml(data.propertyName)}${floorText}`)}
          ${data.buildingName ? buildInfoRow('Κτίριο', escapeHtml(data.buildingName)) : ''}
          ${data.projectName ? buildInfoRow('Έργο', escapeHtml(data.projectName)) : ''}
          ${data.projectAddress ? buildInfoRow('Διεύθυνση', escapeHtml(data.projectAddress)) : ''}
          ${data.companyName ? buildInfoRow('Κατασκευαστική', escapeHtml(data.companyName)) : ''}
        </td>
      </tr>
    </table>

    <!-- Info card: Financial -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid ${BRAND.border};border-radius:6px;overflow:hidden;">
      <tr>
        <td style="background-color:${BRAND.navy};padding:10px 16px;">
          <p style="margin:0;font-size:13px;font-weight:600;color:${BRAND.white};letter-spacing:0.5px;">
            ΟΙΚΟΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ ΠΩΛΗΣΗΣ
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px;">
          ${data.invoiceRef ? buildInfoRow('Παραστατικό', escapeHtml(data.invoiceRef)) : ''}
          ${buildInfoRow('Ημερομηνία', formatDateGreek(new Date()))}
          ${buildTotalRow('Τελική τιμή πώλησης', formatEuro(data.finalPrice))}
          ${data.depositAlreadyInvoiced > 0 ? buildInfoRow('Προκαταβολή (ήδη τιμολογημένη)', formatEuro(data.depositAlreadyInvoiced)) : ''}
          ${buildInfoRow('Υπόλοιπο (καθαρό)', formatEuro(netRemaining))}
          ${buildInfoRow('ΦΠΑ 24%', formatEuro(vatRemaining))}
          ${buildTotalRow('Υπόλοιπο (με ΦΠΑ)', formatEuro(remaining))}
          ${buildInfoRow('Τρόπος πληρωμής', formatPaymentMethod(data.paymentMethod))}
        </td>
      </tr>
    </table>

    <!-- Closing -->
    <p style="margin:0 0 8px;font-size:14px;color:${BRAND.gray};line-height:1.6;">
      Σας ευχόμαστε καλή απόλαυση του νέου σας ακινήτου!
      Για οποιαδήποτε απορία ή διευκρίνιση, μη διστάσετε να επικοινωνήσετε μαζί μας.
    </p>
    <p style="margin:16px 0 0;font-size:14px;color:${BRAND.navyDark};font-weight:600;">
      Με εκτίμηση,<br/>
      ${escapeHtml(data.companyName ?? 'Pagonis Energo')}
    </p>
  `;
}

// ============================================================================
// ROW HELPERS
// ============================================================================

function buildInfoRow(label: string, value: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        <td width="45%" style="font-size:13px;color:${BRAND.grayLight};vertical-align:top;">${label}</td>
        <td style="font-size:13px;color:${BRAND.navyDark};font-weight:500;">${value}</td>
      </tr>
    </table>`;
}

function buildTotalRow(label: string, value: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0;background-color:${BRAND.bgLight};border-radius:4px;">
      <tr>
        <td width="45%" style="padding:8px 12px;font-size:14px;color:${BRAND.navyDark};font-weight:600;">${label}</td>
        <td style="padding:8px 12px;font-size:14px;color:${BRAND.navy};font-weight:700;">${value}</td>
      </tr>
    </table>`;
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
    `═══ ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ ═══`,
    `Μονάδα: ${data.propertyName}${data.unitFloor !== null ? ` — ${data.unitFloor}ος όροφος` : ''}`,
  ];

  if (data.buildingName) lines.push(`Κτίριο: ${data.buildingName}`);
  if (data.projectName) lines.push(`Έργο: ${data.projectName}`);
  if (data.projectAddress) lines.push(`Διεύθυνση: ${data.projectAddress}`);
  if (data.companyName) lines.push(`Κατασκευαστική: ${data.companyName}`);

  lines.push(
    ``,
    `═══ ΟΙΚΟΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ ΠΩΛΗΣΗΣ ═══`,
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
