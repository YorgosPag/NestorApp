/**
 * @fileoverview Photo Share Email Template — Pagonis Energo Branding
 * @description Branded email for sharing photos via the photo preview modal.
 *              Photo is embedded inline as <img>, using the base branded wrapper.
 * @note Inline styles REQUIRED in HTML emails — CLAUDE.md N.3 does not apply here
 */

import 'server-only';
import { wrapInBrandedTemplate, BRAND, escapeHtml } from './base-email-template';

export interface PhotoShareEmailData {
  /** Photo direct URL (Firebase Storage) — primary/fallback */
  photoUrl: string;
  /** Multiple selected photo URLs */
  photoUrls?: string[];
  /** Photo/contact title */
  title: string;
  /** Personal message from sender */
  personalMessage?: string;
  /** Sender name */
  senderName?: string;
  /** Recipient email (for footer) */
  recipientEmail: string;
}

/**
 * Builds a branded photo share email with the photo embedded inline.
 * Uses the Pagonis Energo branded wrapper (same as reservation/assignment emails).
 */
export function buildPhotoShareEmail(data: PhotoShareEmailData): string {
  const { photoUrl, title, personalMessage, senderName, recipientEmail } = data;

  const contentHtml = `
    <!-- Title -->
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;color:${BRAND.navyDark};">
      ${escapeHtml(title)}
    </h2>

    ${senderName ? `
    <p style="margin:0 0 20px;font-size:14px;color:${BRAND.grayLight};">
      ${escapeHtml(senderName)}
    </p>` : ''}

    ${personalMessage ? `
    <!-- Personal message -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="background-color:${BRAND.bgLight};border-left:3px solid ${BRAND.accent};padding:16px 20px;border-radius:0 6px 6px 0;">
          <p style="margin:0;font-size:14px;color:${BRAND.gray};font-style:italic;line-height:1.6;">
            &ldquo;${escapeHtml(personalMessage)}&rdquo;
          </p>
        </td>
      </tr>
    </table>` : ''}

    <!-- Photos -->
    ${(data.photoUrls && data.photoUrls.length > 0 ? data.photoUrls : [photoUrl]).map((url, i) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
      <tr>
        <td align="center">
          <img
            src="${url}"
            alt="${escapeHtml(title)} (${i + 1})"
            width="536"
            style="display:block;max-width:100%;height:auto;border-radius:8px;border:1px solid ${BRAND.border};"
          />
        </td>
      </tr>
    </table>`).join('')}

    <!-- Footer note -->
    <p style="margin:0;font-size:12px;color:${BRAND.grayLight};text-align:center;">
      ${escapeHtml(recipientEmail)}
    </p>
  `;

  return wrapInBrandedTemplate({ contentHtml });
}
