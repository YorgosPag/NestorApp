/**
 * @fileoverview Professional Assignment Email Template
 * @description HTML email ειδοποίησης νομικού επαγγελματία μετά από ανάθεση ρόλου σε ακίνητο.
 *              Χρησιμοποιεί το branded base template της Pagonis Energo.
 * @note Inline styles ΑΠΑΙΤΟΥΝΤΑΙ σε HTML emails — δεν ισχύει ο κανόνας N.3 του CLAUDE.md
 */

import 'server-only';

import {
  BRAND,
  escapeHtml,
  formatDateGreek,
} from './base-email-template';
import {
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

/** Property info-card body — shared by the assignment & removal templates. */
function buildPropertyCardBody(data: ProfessionalAssignmentEmailData, floorText: string | null): string {
  return `
          ${data.propertyCode ? buildInfoRow('Κωδικός', escapeHtml(data.propertyCode)) : ''}
          ${buildInfoRow('Ακίνητο', escapeHtml(data.propertyName))}
          ${floorText ? buildInfoRow('Όροφος', floorText) : ''}
          ${data.buildingName ? buildInfoRow('Κτίριο', escapeHtml(data.buildingName)) : ''}
          ${data.projectName ? buildInfoRow('Έργο', escapeHtml(data.projectName)) : ''}
          ${data.projectAddress ? buildInfoRow('Διεύθυνση', escapeHtml(data.projectAddress)) : ''}`;
}

/** Buyer info-card body — shared by the assignment & removal templates. */
function buildBuyerCardBody(data: ProfessionalAssignmentEmailData): string {
  return `
          ${buildInfoRow('Ονοματεπώνυμο', escapeHtml(data.buyerName ?? ''))}
          ${data.buyerPhone ? buildInfoRow('Τηλέφωνο', escapeHtml(data.buyerPhone)) : ''}
          ${data.buyerEmail ? buildInfoRow('Email', escapeHtml(data.buyerEmail)) : ''}`;
}

/** Property plain-text lines — shared by the assignment & removal fallbacks. */
function buildPropertyTextLines(data: ProfessionalAssignmentEmailData): string[] {
  const lines: string[] = [];
  if (data.propertyCode) lines.push(`Κωδικός: ${data.propertyCode}`);
  lines.push(`Ακίνητο: ${data.propertyName}`);
  if (data.propertyFloor !== null) lines.push(`Όροφος: ${formatFloor(data.propertyFloor)}`);
  if (data.buildingName) lines.push(`Κτίριο: ${data.buildingName}`);
  if (data.projectName) lines.push(`Έργο: ${data.projectName}`);
  if (data.projectAddress) lines.push(`Διεύθυνση: ${data.projectAddress}`);
  return lines;
}

/** Buyer plain-text lines (incl. section header) — shared by both fallbacks. */
function buildBuyerTextLines(data: ProfessionalAssignmentEmailData): string[] {
  if (!data.buyerName) return [];
  const lines: string[] = ['', textSectionHeader('ΣΤΟΙΧΕΙΑ ΑΓΟΡΑΣΤΗ'), `Ονοματεπώνυμο: ${data.buyerName}`];
  if (data.buyerPhone) lines.push(`Τηλέφωνο: ${data.buyerPhone}`);
  if (data.buyerEmail) lines.push(`Email: ${data.buyerEmail}`);
  return lines;
}

/** Company contact-info plain-text block — shared by both fallbacks. */
function buildContactTextLines(data: ProfessionalAssignmentEmailData): string[] {
  if (!data.companyPhone && !data.companyEmail && !data.companyAddress) return [];
  const lines: string[] = ['', `--- Στοιχεία Επικοινωνίας ---`];
  if (data.companyPhone) lines.push(`Τηλ: ${data.companyPhone}`);
  if (data.companyEmail) lines.push(`Email: ${data.companyEmail}`);
  if (data.companyAddress) lines.push(`Διεύθυνση: ${data.companyAddress}`);
  if (data.companyWebsite) lines.push(`Web: ${data.companyWebsite}`);
  return lines;
}

// ============================================================================
// TEMPLATE BUILDER
// ============================================================================

/**
 * Builds the full branded HTML email for professional assignment notification.
 *
 * @returns { subject, html, text } — subject line, HTML body, plain-text fallback
 */
export function buildProfessionalAssignmentEmail(data: ProfessionalAssignmentEmailData): ConfirmationEmailResult {
  const propertyLabel = data.propertyCode ?? data.propertyName;
  return assembleConfirmationEmail({
    subject: `Ανάθεση ρόλου: ${data.roleName} — ${propertyLabel}`,
    contentHtml: buildContentSection(data),
    text: buildPlainText(data),
    data,
  });
}

// ============================================================================
// CONTENT BUILDER (inner HTML)
// ============================================================================

function buildContentSection(data: ProfessionalAssignmentEmailData): string {
  const floorText = data.propertyFloor !== null && data.propertyFloor !== undefined
    ? formatFloor(data.propertyFloor)
    : null;

  const assignmentBody = `
          ${buildInfoRow('Ρόλος', escapeHtml(data.roleName))}
          ${buildInfoRow('Ημερομηνία ανάθεσης', formatDateGreek(new Date()))}
          ${data.companyName ? buildInfoRow('Κατασκευαστική', escapeHtml(data.companyName)) : ''}`;

  return `
    ${buildGreeting(
      data.professionalName,
      `Σας ενημερώνουμε ότι σας ανατέθηκε ο ρόλος
      <strong style="color:${BRAND.navyDark};">${escapeHtml(data.roleName)}</strong>
      για το παρακάτω ακίνητο. Παρακαλούμε λάβετε υπόψη τα στοιχεία που ακολουθούν
      και επικοινωνήστε μαζί μας το συντομότερο δυνατό.`,
    )}

    ${buildInfoCard({ title: 'ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ', bodyHtml: buildPropertyCardBody(data, floorText) })}

    ${data.buyerName ? buildInfoCard({ title: 'ΣΤΟΙΧΕΙΑ ΑΓΟΡΑΣΤΗ', bodyHtml: buildBuyerCardBody(data) }) : ''}

    ${buildInfoCard({ title: 'ΣΤΟΙΧΕΙΑ ΑΝΑΘΕΣΗΣ', bodyHtml: assignmentBody })}

    ${buildClosing(
      'Παρακαλούμε επικοινωνήστε μαζί μας ώστε να συζητήσουμε τη διαδικασία, τα απαραίτητα δικαιολογητικά και το χρονοδιάγραμμα ολοκλήρωσης.',
      data.companyName ?? 'Pagonis Energo',
    )}
  `;
}

// ============================================================================
// REMOVAL TEMPLATE
// ============================================================================

/**
 * Builds the branded HTML email for professional removal (ακύρωση ανάθεσης).
 * Same data interface as assignment — reuses the same hierarchy.
 */
export function buildProfessionalRemovalEmail(data: ProfessionalAssignmentEmailData): ConfirmationEmailResult {
  const propertyLabel = data.propertyCode ?? data.propertyName;
  return assembleConfirmationEmail({
    subject: `Ακύρωση ανάθεσης: ${data.roleName} — ${propertyLabel}`,
    contentHtml: buildRemovalContentSection(data),
    text: buildRemovalPlainText(data),
    data,
  });
}

function buildRemovalContentSection(data: ProfessionalAssignmentEmailData): string {
  const floorText = data.propertyFloor !== null && data.propertyFloor !== undefined
    ? formatFloor(data.propertyFloor)
    : null;

  const cancelledEmphasis = escapeHtml('ακυρώθηκε');

  return `
    ${buildGreeting(
      data.professionalName,
      `Σας ενημερώνουμε ότι η ανάθεση του ρόλου
      <strong style="color:${BRAND.navyDark};">${escapeHtml(data.roleName)}</strong>
      για το παρακάτω ακίνητο <strong>${cancelledEmphasis}</strong>.`,
    )}

    ${buildInfoCard({ title: 'ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ', bodyHtml: buildPropertyCardBody(data, floorText) })}

    ${data.buyerName ? buildInfoCard({ title: 'ΣΤΟΙΧΕΙΑ ΑΓΟΡΑΣΤΗ', bodyHtml: buildBuyerCardBody(data) }) : ''}

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
    textSectionHeader('ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ'),
    ...buildPropertyTextLines(data),
    ...buildBuyerTextLines(data),
    ``,
    `Εάν έχετε ήδη ξεκινήσει εργασίες, παρακαλούμε επικοινωνήστε μαζί μας`,
    `για τη διευθέτηση τυχόν εκκρεμοτήτων.`,
    ``,
    `Σας ευχαριστούμε για τη συνεργασία.`,
    ``,
    `Με εκτίμηση,`,
    data.companyName ?? 'Pagonis Energo',
    ...buildContactTextLines(data),
  ];

  return lines.join('\n');
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
    textSectionHeader('ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ'),
    ...buildPropertyTextLines(data),
    ...buildBuyerTextLines(data),
    ``,
    textSectionHeader('ΣΤΟΙΧΕΙΑ ΑΝΑΘΕΣΗΣ'),
    `Ρόλος: ${data.roleName}`,
    `Ημερομηνία: ${formatDateGreek(new Date())}`,
  ];
  if (data.companyName) lines.push(`Κατασκευαστική: ${data.companyName}`);

  lines.push(
    ``,
    `Παρακαλούμε επικοινωνήστε μαζί μας ώστε να συζητήσουμε τη διαδικασία,`,
    `τα απαραίτητα δικαιολογητικά και το χρονοδιάγραμμα ολοκλήρωσης.`,
    ``,
    `Με εκτίμηση,`,
    data.companyName ?? 'Pagonis Energo',
    ...buildContactTextLines(data),
  );

  return lines.join('\n');
}
