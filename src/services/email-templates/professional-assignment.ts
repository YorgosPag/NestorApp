/**
 * @fileoverview Professional Assignment Email Template
 * @description HTML email ειδοποίησης νομικού επαγγελματία μετά από ανάθεση ρόλου σε ακίνητο.
 *              Χρησιμοποιεί το branded base template της Pagonis Energo.
 * @note Inline styles ΑΠΑΙΤΟΥΝΤΑΙ σε HTML emails — δεν ισχύει ο κανόνας N.3 του CLAUDE.md
 */

import 'server-only';

import {
  wrapInBrandedTemplate,
  BRAND,
  escapeHtml,
  formatDateGreek,
} from './base-email-template';

// ============================================================================
// TYPES
// ============================================================================

export interface ProfessionalAssignmentEmailData {
  /** Professional display name (e.g. "Κος Παπαδόπουλος") */
  professionalName: string;
  /** Role label in Greek (e.g. "Δικηγόρος Πωλητή") */
  roleName: string;
  /** Unit name (e.g. "Διαμέρισμα Α1") */
  unitName: string;
  /** Unit code (e.g. "Α-101") — distinct identifier */
  unitCode: string | null;
  /** Floor number (0 = Ισόγειο) */
  unitFloor: number | null;
  /** Building name */
  buildingName: string | null;
  /** Project name */
  projectName: string | null;
  /** Project address */
  projectAddress: string | null;
  /** Company name (κατασκευαστική) */
  companyName: string | null;
  /** Company contact info for footer */
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
  companyWebsite?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Format floor number: 0 → "Ισόγειο", -1 → "Υπόγειο", 1 → "1ος όροφος" */
function formatFloor(floor: number): string {
  if (floor === 0) return 'Ισόγειο';
  if (floor < 0) return `${Math.abs(floor)}ο Υπόγειο`;
  return `${floor}ος όροφος`;
}

// ============================================================================
// TEMPLATE BUILDER
// ============================================================================

/**
 * Builds the full branded HTML email for professional assignment notification.
 *
 * @returns { subject, html, text } — subject line, HTML body, plain-text fallback
 */
export function buildProfessionalAssignmentEmail(data: ProfessionalAssignmentEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const unitLabel = data.unitCode ?? data.unitName;
  const subject = `Ανάθεση ρόλου: ${data.roleName} — ${unitLabel}`;

  const contentHtml = buildContentSection(data);

  const html = wrapInBrandedTemplate({
    contentHtml,
    companyName: data.companyName ?? 'Pagonis Energo',
    companyPhone: data.companyPhone,
    companyEmail: data.companyEmail,
    companyAddress: data.companyAddress,
    companyWebsite: data.companyWebsite,
  });

  const text = buildPlainText(data);

  return { subject, html, text };
}

// ============================================================================
// CONTENT BUILDER (inner HTML)
// ============================================================================

function buildContentSection(data: ProfessionalAssignmentEmailData): string {
  const floorText = data.unitFloor !== null && data.unitFloor !== undefined
    ? formatFloor(data.unitFloor)
    : null;

  return `
    <!-- Greeting -->
    <p style="margin:0 0 16px;font-size:16px;color:${BRAND.navyDark};">
      Αγαπητέ/ή <strong>${escapeHtml(data.professionalName)}</strong>,
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:${BRAND.gray};line-height:1.6;">
      Σας ενημερώνουμε ότι σας ανατέθηκε ο ρόλος
      <strong style="color:${BRAND.navyDark};">${escapeHtml(data.roleName)}</strong>
      για το παρακάτω ακίνητο. Παρακαλούμε λάβετε υπόψη τα στοιχεία που ακολουθούν
      και επικοινωνήστε μαζί μας το συντομότερο δυνατό.
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
          ${data.unitCode ? buildInfoRow('Κωδικός', escapeHtml(data.unitCode)) : ''}
          ${buildInfoRow('Ακίνητο', escapeHtml(data.unitName))}
          ${floorText ? buildInfoRow('Όροφος', floorText) : ''}
          ${data.buildingName ? buildInfoRow('Κτίριο', escapeHtml(data.buildingName)) : ''}
          ${data.projectName ? buildInfoRow('Έργο', escapeHtml(data.projectName)) : ''}
          ${data.projectAddress ? buildInfoRow('Διεύθυνση', escapeHtml(data.projectAddress)) : ''}
        </td>
      </tr>
    </table>

    <!-- Info card: Assignment details -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid ${BRAND.border};border-radius:6px;overflow:hidden;">
      <tr>
        <td style="background-color:${BRAND.navy};padding:10px 16px;">
          <p style="margin:0;font-size:13px;font-weight:600;color:${BRAND.white};letter-spacing:0.5px;">
            ΣΤΟΙΧΕΙΑ ΑΝΑΘΕΣΗΣ
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px;">
          ${buildInfoRow('Ρόλος', escapeHtml(data.roleName))}
          ${buildInfoRow('Ημερομηνία ανάθεσης', formatDateGreek(new Date()))}
          ${data.companyName ? buildInfoRow('Κατασκευαστική', escapeHtml(data.companyName)) : ''}
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <p style="margin:0 0 8px;font-size:14px;color:${BRAND.gray};line-height:1.6;">
      Παρακαλούμε επικοινωνήστε μαζί μας ώστε να συζητήσουμε τη διαδικασία,
      τα απαραίτητα δικαιολογητικά και το χρονοδιάγραμμα ολοκλήρωσης.
    </p>
    <p style="margin:16px 0 0;font-size:14px;color:${BRAND.navyDark};font-weight:600;">
      Με εκτίμηση,<br/>
      ${escapeHtml(data.companyName ?? 'Pagonis Energo')}
    </p>
  `;
}

// ============================================================================
// ROW HELPER
// ============================================================================

/** Single info row: label + value */
function buildInfoRow(label: string, value: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        <td width="45%" style="font-size:13px;color:${BRAND.grayLight};vertical-align:top;">
          ${label}
        </td>
        <td style="font-size:13px;color:${BRAND.navyDark};font-weight:500;">
          ${value}
        </td>
      </tr>
    </table>`;
}

// ============================================================================
// PLAIN TEXT FALLBACK
// ============================================================================

function buildPlainText(data: ProfessionalAssignmentEmailData): string {
  const lines: string[] = [
    `Αγαπητέ/ή ${data.professionalName},`,
    ``,
    `Σας ενημερώνουμε ότι σας ανατέθηκε ο ρόλος "${data.roleName}" για το παρακάτω ακίνητο.`,
    `Παρακαλούμε λάβετε υπόψη τα στοιχεία και επικοινωνήστε μαζί μας.`,
    ``,
    `═══ ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ ═══`,
  ];

  if (data.unitCode) lines.push(`Κωδικός: ${data.unitCode}`);
  lines.push(`Ακίνητο: ${data.unitName}`);
  if (data.unitFloor !== null) lines.push(`Όροφος: ${formatFloor(data.unitFloor)}`);
  if (data.buildingName) lines.push(`Κτίριο: ${data.buildingName}`);
  if (data.projectName) lines.push(`Έργο: ${data.projectName}`);
  if (data.projectAddress) lines.push(`Διεύθυνση: ${data.projectAddress}`);

  lines.push(
    ``,
    `═══ ΣΤΟΙΧΕΙΑ ΑΝΑΘΕΣΗΣ ═══`,
    `Ρόλος: ${data.roleName}`,
    `Ημερομηνία: ${formatDateGreek(new Date())}`,
  );
  if (data.companyName) lines.push(`Κατασκευαστική: ${data.companyName}`);

  lines.push(
    ``,
    `Παρακαλούμε επικοινωνήστε μαζί μας ώστε να συζητήσουμε τη διαδικασία,`,
    `τα απαραίτητα δικαιολογητικά και το χρονοδιάγραμμα ολοκλήρωσης.`,
    ``,
    `Με εκτίμηση,`,
    data.companyName ?? 'Pagonis Energo',
  );

  if (data.companyPhone || data.companyEmail || data.companyAddress) {
    lines.push(``, `--- Στοιχεία Επικοινωνίας ---`);
    if (data.companyPhone) lines.push(`Τηλ: ${data.companyPhone}`);
    if (data.companyEmail) lines.push(`Email: ${data.companyEmail}`);
    if (data.companyAddress) lines.push(`Διεύθυνση: ${data.companyAddress}`);
    if (data.companyWebsite) lines.push(`Web: ${data.companyWebsite}`);
  }

  return lines.join('\n');
}
