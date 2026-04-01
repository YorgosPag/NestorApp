/**
 * @fileoverview Cancellation Confirmation Email Template
 * @description HTML email ειδοποίησης ακύρωσης κράτησης/πώλησης προς τον αγοραστή.
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

export interface CancellationEmailData {
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
export function buildCancellationConfirmationEmail(data: CancellationEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `${data.reason} — ${data.propertyName}`;

  const VAT_DIVISOR = 1.24;
  const netAmount = data.creditAmount / VAT_DIVISOR;
  const vatAmount = data.creditAmount - netAmount;

  const contentHtml = buildContentSection(data, netAmount, vatAmount);

  const html = wrapInBrandedTemplate({
    contentHtml,
    companyName: data.companyName ?? 'Pagonis Energo',
  });

  const text = buildPlainText(data, netAmount, vatAmount);

  return { subject, html, text };
}

// ============================================================================
// CONTENT BUILDER (inner HTML)
// ============================================================================

function buildContentSection(
  data: CancellationEmailData,
  netAmount: number,
  vatAmount: number
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
      Σας ενημερώνουμε ότι η κράτησή σας ακυρώθηκε.
      Παρακάτω θα βρείτε τα στοιχεία της ακύρωσης.
    </p>

    <!-- Info card: Reason -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid ${BRAND.border};border-radius:6px;overflow:hidden;">
      <tr>
        <td style="background-color:#DC2626;padding:10px 16px;">
          <p style="margin:0;font-size:13px;font-weight:600;color:${BRAND.white};letter-spacing:0.5px;">
            ΑΙΤΙΟΛΟΓΙΑ ΑΚΥΡΩΣΗΣ
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px;">
          <p style="margin:0;font-size:14px;color:${BRAND.navyDark};font-weight:500;">
            ${escapeHtml(data.reason)}
          </p>
          ${buildInfoRow('Ημερομηνία ακύρωσης', formatDateGreek(new Date()))}
        </td>
      </tr>
    </table>

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

    ${data.creditAmount > 0 ? `
    <!-- Info card: Refund -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid ${BRAND.border};border-radius:6px;overflow:hidden;">
      <tr>
        <td style="background-color:${BRAND.navy};padding:10px 16px;">
          <p style="margin:0;font-size:13px;font-weight:600;color:${BRAND.white};letter-spacing:0.5px;">
            ΣΤΟΙΧΕΙΑ ΕΠΙΣΤΡΟΦΗΣ
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px;">
          ${data.creditNoteRef ? buildInfoRow('Πιστωτικό', escapeHtml(data.creditNoteRef)) : ''}
          ${buildInfoRow('Καθαρό ποσό', formatEuro(netAmount))}
          ${buildInfoRow('ΦΠΑ 24%', formatEuro(vatAmount))}
          ${buildTotalRow('Σύνολο επιστροφής', formatEuro(data.creditAmount))}
          ${buildInfoRow('Τρόπος επιστροφής', formatPaymentMethod(data.paymentMethod))}
        </td>
      </tr>
    </table>
    ` : ''}

    <!-- Closing -->
    <p style="margin:0 0 8px;font-size:14px;color:${BRAND.gray};line-height:1.6;">
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
  data: CancellationEmailData,
  netAmount: number,
  vatAmount: number
): string {
  const lines: string[] = [
    `Αγαπητέ/ή ${data.buyerName},`,
    ``,
    `Σας ενημερώνουμε ότι η κράτησή σας ακυρώθηκε.`,
    ``,
    `═══ ΑΙΤΙΟΛΟΓΙΑ ═══`,
    `${data.reason}`,
    `Ημερομηνία ακύρωσης: ${formatDateGreek(new Date())}`,
    ``,
    `═══ ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ ═══`,
    `Μονάδα: ${data.propertyName}${data.unitFloor !== null ? ` — ${data.unitFloor}ος όροφος` : ''}`,
  ];

  if (data.buildingName) lines.push(`Κτίριο: ${data.buildingName}`);
  if (data.projectName) lines.push(`Έργο: ${data.projectName}`);
  if (data.projectAddress) lines.push(`Διεύθυνση: ${data.projectAddress}`);
  if (data.companyName) lines.push(`Κατασκευαστική: ${data.companyName}`);

  if (data.creditAmount > 0) {
    lines.push(
      ``,
      `═══ ΣΤΟΙΧΕΙΑ ΕΠΙΣΤΡΟΦΗΣ ═══`,
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
