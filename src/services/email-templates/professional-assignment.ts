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
  /** Property name (e.g. "Διαμέρισμα Α1") */
  propertyName: string;
  /** Property code (e.g. "Α-101") — distinct identifier */
  propertyCode: string | null;
  /** Floor number (0 = Ισόγειο) */
  propertyFloor: number | null;
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
  /** Buyer info */
  buyerName?: string;
  buyerPhone?: string;
  buyerEmail?: string;
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
  const propertyLabel = data.propertyCode ?? data.propertyName;
  const subject = `Ανάθεση ρόλου: ${data.roleName} — ${propertyLabel}`;

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
  const floorText = data.propertyFloor !== null && data.propertyFloor !== undefined
    ? formatFloor(data.propertyFloor)
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
          ${data.propertyCode ? buildInfoRow('Κωδικός', escapeHtml(data.propertyCode)) : ''}
          ${buildInfoRow('Ακίνητο', escapeHtml(data.propertyName))}
          ${floorText ? buildInfoRow('Όροφος', floorText) : ''}
          ${data.buildingName ? buildInfoRow('Κτίριο', escapeHtml(data.buildingName)) : ''}
          ${data.projectName ? buildInfoRow('Έργο', escapeHtml(data.projectName)) : ''}
          ${data.projectAddress ? buildInfoRow('Διεύθυνση', escapeHtml(data.projectAddress)) : ''}
        </td>
      </tr>
    </table>

    ${data.buyerName ? `
    <!-- Info card: Buyer -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid ${BRAND.border};border-radius:6px;overflow:hidden;">
      <tr>
        <td style="background-color:${BRAND.navy};padding:10px 16px;">
          <p style="margin:0;font-size:13px;font-weight:600;color:${BRAND.white};letter-spacing:0.5px;">
            ΣΤΟΙΧΕΙΑ ΑΓΟΡΑΣΤΗ
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px;">
          ${buildInfoRow('Ονοματεπώνυμο', escapeHtml(data.buyerName))}
          ${data.buyerPhone ? buildInfoRow('Τηλέφωνο', escapeHtml(data.buyerPhone)) : ''}
          ${data.buyerEmail ? buildInfoRow('Email', escapeHtml(data.buyerEmail)) : ''}
        </td>
      </tr>
    </table>
    ` : ''}

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
// REMOVAL TEMPLATE
// ============================================================================

/**
 * Builds the branded HTML email for professional removal (ακύρωση ανάθεσης).
 * Same data interface as assignment — reuses the same hierarchy.
 */
export function buildProfessionalRemovalEmail(data: ProfessionalAssignmentEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const propertyLabel = data.propertyCode ?? data.propertyName;
  const subject = `Ακύρωση ανάθεσης: ${data.roleName} — ${propertyLabel}`;

  const contentHtml = buildRemovalContentSection(data);

  const html = wrapInBrandedTemplate({
    contentHtml,
    companyName: data.companyName ?? 'Pagonis Energo',
    companyPhone: data.companyPhone,
    companyEmail: data.companyEmail,
    companyAddress: data.companyAddress,
    companyWebsite: data.companyWebsite,
  });

  const text = buildRemovalPlainText(data);

  return { subject, html, text };
}

function buildRemovalContentSection(data: ProfessionalAssignmentEmailData): string {
  const floorText = data.propertyFloor !== null && data.propertyFloor !== undefined
    ? formatFloor(data.propertyFloor)
    : null;

  return `
    <!-- Greeting -->
    <p style="margin:0 0 16px;font-size:16px;color:${BRAND.navyDark};">
      Αγαπητέ/ή <strong>${escapeHtml(data.professionalName)}</strong>,
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:${BRAND.gray};line-height:1.6;">
      Σας ενημερώνουμε ότι η ανάθεση του ρόλου
      <strong style="color:${BRAND.navyDark};">${escapeHtml(data.roleName)}</strong>
      για το παρακάτω ακίνητο <strong>ακυρώθηκε</strong>.
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
          ${data.propertyCode ? buildInfoRow('Κωδικός', escapeHtml(data.propertyCode)) : ''}
          ${buildInfoRow('Ακίνητο', escapeHtml(data.propertyName))}
          ${floorText ? buildInfoRow('Όροφος', floorText) : ''}
          ${data.buildingName ? buildInfoRow('Κτίριο', escapeHtml(data.buildingName)) : ''}
          ${data.projectName ? buildInfoRow('Έργο', escapeHtml(data.projectName)) : ''}
          ${data.projectAddress ? buildInfoRow('Διεύθυνση', escapeHtml(data.projectAddress)) : ''}
        </td>
      </tr>
    </table>

    ${data.buyerName ? `
    <!-- Info card: Buyer -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid ${BRAND.border};border-radius:6px;overflow:hidden;">
      <tr>
        <td style="background-color:${BRAND.navy};padding:10px 16px;">
          <p style="margin:0;font-size:13px;font-weight:600;color:${BRAND.white};letter-spacing:0.5px;">
            ΣΤΟΙΧΕΙΑ ΑΓΟΡΑΣΤΗ
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px;">
          ${buildInfoRow('Ονοματεπώνυμο', escapeHtml(data.buyerName))}
          ${data.buyerPhone ? buildInfoRow('Τηλέφωνο', escapeHtml(data.buyerPhone)) : ''}
          ${data.buyerEmail ? buildInfoRow('Email', escapeHtml(data.buyerEmail)) : ''}
        </td>
      </tr>
    </table>
    ` : ''}

    <!-- Notice -->
    <p style="margin:0 0 8px;font-size:14px;color:${BRAND.gray};line-height:1.6;">
      Εάν έχετε ήδη ξεκινήσει εργασίες σχετικά με την υπόθεση,
      παρακαλούμε επικοινωνήστε μαζί μας για τη διευθέτηση τυχόν εκκρεμοτήτων.
    </p>
    <p style="margin:0 0 8px;font-size:14px;color:${BRAND.gray};line-height:1.6;">
      Σας ευχαριστούμε για τη συνεργασία.
    </p>
    <p style="margin:16px 0 0;font-size:14px;color:${BRAND.navyDark};font-weight:600;">
      Με εκτίμηση,<br/>
      ${escapeHtml(data.companyName ?? 'Pagonis Energo')}
    </p>
  `;
}

function buildRemovalPlainText(data: ProfessionalAssignmentEmailData): string {
  const lines: string[] = [
    `Αγαπητέ/ή ${data.professionalName},`,
    ``,
    `Σας ενημερώνουμε ότι η ανάθεση του ρόλου "${data.roleName}" για το παρακάτω ακίνητο ΑΚΥΡΩΘΗΚΕ.`,
    ``,
    `═══ ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ ═══`,
  ];

  if (data.propertyCode) lines.push(`Κωδικός: ${data.propertyCode}`);
  lines.push(`Ακίνητο: ${data.propertyName}`);
  if (data.propertyFloor !== null) lines.push(`Όροφος: ${formatFloor(data.propertyFloor)}`);
  if (data.buildingName) lines.push(`Κτίριο: ${data.buildingName}`);
  if (data.projectName) lines.push(`Έργο: ${data.projectName}`);
  if (data.projectAddress) lines.push(`Διεύθυνση: ${data.projectAddress}`);

  if (data.buyerName) {
    lines.push(``, `═══ ΣΤΟΙΧΕΙΑ ΑΓΟΡΑΣΤΗ ═══`);
    lines.push(`Ονοματεπώνυμο: ${data.buyerName}`);
    if (data.buyerPhone) lines.push(`Τηλέφωνο: ${data.buyerPhone}`);
    if (data.buyerEmail) lines.push(`Email: ${data.buyerEmail}`);
  }

  lines.push(
    ``,
    `Εάν έχετε ήδη ξεκινήσει εργασίες, παρακαλούμε επικοινωνήστε μαζί μας`,
    `για τη διευθέτηση τυχόν εκκρεμοτήτων.`,
    ``,
    `Σας ευχαριστούμε για τη συνεργασία.`,
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

  if (data.propertyCode) lines.push(`Κωδικός: ${data.propertyCode}`);
  lines.push(`Ακίνητο: ${data.propertyName}`);
  if (data.propertyFloor !== null) lines.push(`Όροφος: ${formatFloor(data.propertyFloor)}`);
  if (data.buildingName) lines.push(`Κτίριο: ${data.buildingName}`);
  if (data.projectName) lines.push(`Έργο: ${data.projectName}`);
  if (data.projectAddress) lines.push(`Διεύθυνση: ${data.projectAddress}`);

  if (data.buyerName) {
    lines.push(``, `═══ ΣΤΟΙΧΕΙΑ ΑΓΟΡΑΣΤΗ ═══`);
    lines.push(`Ονοματεπώνυμο: ${data.buyerName}`);
    if (data.buyerPhone) lines.push(`Τηλέφωνο: ${data.buyerPhone}`);
    if (data.buyerEmail) lines.push(`Email: ${data.buyerEmail}`);
  }

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
