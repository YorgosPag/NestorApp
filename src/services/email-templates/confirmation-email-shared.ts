/**
 * @fileoverview Confirmation / notification email — shared structural
 * renderers (SSoT, ADR-590).
 * @description Pure string-templating primitives shared across every
 *              transactional confirmation email (reservation, cancellation,
 *              sale, professional assignment/removal). One renderer per generic
 *              block (info row, total row, titled info card) so per-template
 *              files hold only their Greek copy + data wiring and stay aligned
 *              on the Pagonis visual identity.
 * @note Inline styles are REQUIRED by email clients (Outlook, Gmail, Apple
 *       Mail). The CLAUDE.md N.3 ban does not apply here.
 * @note Deliberately free of user-facing (Greek) copy — every label/title is a
 *       caller-supplied parameter so this file carries only layout, never text.
 */

import 'server-only';

import { BRAND, escapeHtml, wrapInBrandedTemplate } from './base-email-template';

export { BRAND, escapeHtml } from './base-email-template';
export { formatEuro, formatDateGreek, formatPaymentMethod } from './base-email-template';

/** Company identity + optional footer contact fields shared by every builder. */
export interface BrandedCompanyContact {
  companyName?: string | null;
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
  companyWebsite?: string;
}

/**
 * Wrap pre-rendered content in the branded template, applying the shared
 * `companyName` fallback and forwarding the optional footer contact fields.
 * SSoT for the identical `wrapInBrandedTemplate({...})` call every confirmation
 * builder used to inline (ADR-590).
 */
export function wrapConfirmationEmail(contentHtml: string, data: BrandedCompanyContact): string {
  return wrapInBrandedTemplate({
    contentHtml,
    companyName: data.companyName ?? 'Pagonis Energo',
    companyPhone: data.companyPhone,
    companyEmail: data.companyEmail,
    companyAddress: data.companyAddress,
    companyWebsite: data.companyWebsite,
  });
}

/** Uniform `{ subject, html, text }` shape returned by every confirmation builder. */
export interface ConfirmationEmailResult {
  subject: string;
  html: string;
  text: string;
}

/** Split a gross (VAT-inclusive) amount into `{ net, vat }` (default 24% VAT). */
export function splitVat(gross: number, divisor = 1.24): { net: number; vat: number } {
  const net = gross / divisor;
  return { net, vat: gross - net };
}

/**
 * Assemble the final `{ subject, html, text }` — wraps the content in the
 * branded template and threads the plain-text fallback through unchanged. SSoT
 * for the orchestration tail every confirmation builder used to inline.
 */
export function assembleConfirmationEmail(params: {
  subject: string;
  contentHtml: string;
  text: string;
  data: BrandedCompanyContact;
}): ConfirmationEmailResult {
  return {
    subject: params.subject,
    html: wrapConfirmationEmail(params.contentHtml, params.data),
    text: params.text,
  };
}

/**
 * Single label/value info row (compact two-column table). `value` is treated as
 * pre-formatted HTML — callers escape entity data before passing it in.
 */
export function buildInfoRow(label: string, value: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        <td width="45%" style="font-size:13px;color:${BRAND.grayLight};vertical-align:top;">${label}</td>
        <td style="font-size:13px;color:${BRAND.navyDark};font-weight:500;">${value}</td>
      </tr>
    </table>`;
}

/** Emphasised total row — highlighted with the light brand background. */
export function buildTotalRow(label: string, value: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0;background-color:${BRAND.bgLight};border-radius:4px;">
      <tr>
        <td width="45%" style="padding:8px 12px;font-size:14px;color:${BRAND.navyDark};font-weight:600;">${label}</td>
        <td style="padding:8px 12px;font-size:14px;color:${BRAND.navy};font-weight:700;">${value}</td>
      </tr>
    </table>`;
}

export interface InfoCardParams {
  /** Uppercase section heading (caller-supplied literal). */
  title: string;
  /** Pre-rendered inner HTML (typically a stack of `buildInfoRow` calls). */
  bodyHtml: string;
  /** Header band colour — defaults to the brand navy. */
  headerColor?: string;
}

/**
 * Titled info card — coloured header band + bordered body. The single SSoT for
 * the repeated `<!-- Info card -->` block across every confirmation template.
 */
export function buildInfoCard(params: InfoCardParams): string {
  const { title, bodyHtml, headerColor } = params;
  const bg = headerColor ?? BRAND.navy;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid ${BRAND.border};border-radius:6px;overflow:hidden;">
      <tr>
        <td style="background-color:${bg};padding:10px 16px;">
          <p style="margin:0;font-size:13px;font-weight:600;color:${BRAND.white};letter-spacing:0.5px;">${title}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px;">${bodyHtml}</td>
      </tr>
    </table>`;
}

/**
 * Standard buyer/recipient greeting — salutation line + intro paragraph.
 * `introHtml` is pre-composed HTML owned by the caller (may include inline
 * `<strong>`); `name` is escaped here.
 */
export function buildGreeting(name: string, introHtml: string): string {
  return `
    <p style="margin:0 0 16px;font-size:16px;color:${BRAND.navyDark};">
      Αγαπητέ/ή <strong>${escapeHtml(name)}</strong>,
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:${BRAND.gray};line-height:1.6;">
      ${introHtml}
    </p>`;
}

/**
 * Standard closing block — a caller-supplied closing paragraph followed by the
 * "Με εκτίμηση" signature. `closingHtml` is the per-template farewell copy;
 * `companyName` is escaped here.
 */
export function buildClosing(closingHtml: string, companyName: string): string {
  return `
    <p style="margin:0 0 8px;font-size:14px;color:${BRAND.gray};line-height:1.6;">
      ${closingHtml}
    </p>
    <p style="margin:16px 0 0;font-size:14px;color:${BRAND.navyDark};font-weight:600;">
      Με εκτίμηση,<br/>
      ${escapeHtml(companyName)}
    </p>`;
}

/** Shared unit/property fields common to the buyer-facing confirmation emails. */
export interface UnitPropertyFields {
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
}

/** Buyer-facing confirmation data — unit/property fields plus the buyer name. */
export interface BuyerConfirmationFields extends UnitPropertyFields {
  /** Buyer display name */
  buyerName: string;
}

/** Floor suffix for the unit line — ` — 2ος όροφος` or `''`. */
export function floorSuffix(unitFloor: number | null): string {
  return unitFloor !== null && unitFloor !== undefined ? ` — ${unitFloor}ος όροφος` : '';
}

/**
 * "ΣΤΟΙΧΕΙΑ ΑΚΙΝΗΤΟΥ" card body for the buyer-facing confirmations
 * (reservation / cancellation / sale) — identical unit/building/project rows.
 */
export function buildUnitPropertyCardBody(data: UnitPropertyFields): string {
  return `
          ${buildInfoRow('Μονάδα', `${escapeHtml(data.propertyName)}${floorSuffix(data.unitFloor)}`)}
          ${data.buildingName ? buildInfoRow('Κτίριο', escapeHtml(data.buildingName)) : ''}
          ${data.projectName ? buildInfoRow('Έργο', escapeHtml(data.projectName)) : ''}
          ${data.projectAddress ? buildInfoRow('Διεύθυνση', escapeHtml(data.projectAddress)) : ''}
          ${data.companyName ? buildInfoRow('Κατασκευαστική', escapeHtml(data.companyName)) : ''}`;
}

/** Plain-text property lines — mirror of {@link buildUnitPropertyCardBody}. */
export function buildUnitPropertyTextLines(data: UnitPropertyFields): string[] {
  const lines: string[] = [`Μονάδα: ${data.propertyName}${floorSuffix(data.unitFloor)}`];
  if (data.buildingName) lines.push(`Κτίριο: ${data.buildingName}`);
  if (data.projectName) lines.push(`Έργο: ${data.projectName}`);
  if (data.projectAddress) lines.push(`Διεύθυνση: ${data.projectAddress}`);
  if (data.companyName) lines.push(`Κατασκευαστική: ${data.companyName}`);
  return lines;
}

/** Plain-text section header — `═══ TITLE ═══` (fallback text emails). */
export function textSectionHeader(title: string): string {
  return `═══ ${title} ═══`;
}
