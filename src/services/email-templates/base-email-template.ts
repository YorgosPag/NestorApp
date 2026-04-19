/**
 * @fileoverview Base HTML Email Template — Pagonis Energo Branding
 * @description Κεντρικοποιημένο email template με εταιρική ταυτότητα.
 *              Χρησιμοποιεί inline styles (email clients δεν υποστηρίζουν CSS classes).
 * @note Inline styles ΑΠΑΙΤΟΥΝΤΑΙ σε HTML emails — δεν ισχύει ο κανόνας N.3 του CLAUDE.md
 * @pattern Reusable wrapper: header (logo) + content slot + footer (contact info)
 */

import 'server-only';

// ============================================================================
// BRAND CONSTANTS
// ============================================================================

/** Pagonis Energo brand colors — extracted from logo */
const BRAND = {
  /** Navy blue — primary (icon, "energo" text) */
  navy: '#1E3A5F',
  /** Dark navy — headings */
  navyDark: '#152D4A',
  /** Gray — secondary text ("PAGONIS" text) */
  gray: '#4A4A4A',
  /** Light gray — subtle text */
  grayLight: '#6B7280',
  /** Background — light warm gray */
  bgLight: '#F7F8FA',
  /** White */
  white: '#FFFFFF',
  /** Border — subtle separator */
  border: '#E5E7EB',
  /** Accent — for highlights */
  accent: '#2563EB',
} as const;

// ============================================================================
// BASE TEMPLATE
// ============================================================================

interface BaseEmailParams {
  /** Main content HTML — injected into the body area */
  contentHtml: string;
  /** Company name shown in header */
  companyName?: string;
  /** Company phone */
  companyPhone?: string;
  /** Company email */
  companyEmail?: string;
  /** Company address */
  companyAddress?: string;
  /** Company website URL */
  companyWebsite?: string;
  /**
   * Absolute URL of the company logo shown in the header (ADR-312 Phase 8).
   * Falls back to the bundled `/images/pagonis-energo-logo.png` when undefined.
   */
  companyLogoUrl?: string;
}

/**
 * Wraps content in the branded Pagonis Energo email template.
 *
 * Uses table-based layout for maximum email client compatibility
 * (Outlook, Gmail, Apple Mail, Yahoo, mobile).
 *
 * @returns Complete HTML string ready to send via Mailgun
 */
export function wrapInBrandedTemplate(params: BaseEmailParams): string {
  const {
    contentHtml,
    companyName,
    companyPhone,
    companyEmail,
    companyAddress,
    companyWebsite,
    companyLogoUrl: companyLogoUrlOverride,
  } = params;

  const baseUrl = getAppBaseUrl();
  const companyLogoUrl = companyLogoUrlOverride && companyLogoUrlOverride.trim().length > 0
    ? companyLogoUrlOverride
    : `${baseUrl}/images/pagonis-energo-logo.png`;
  const appLogoUrl = `${baseUrl}/images/nestor-app-logo.jpg`;
  const appName = 'Nestor App';

  // Footer contact lines — from real company data in Firestore
  const contactLines: string[] = [];
  if (companyPhone) contactLines.push(`Tel: ${companyPhone}`);
  if (companyEmail) contactLines.push(companyEmail);
  if (companyAddress) contactLines.push(companyAddress);
  if (companyWebsite) contactLines.push(companyWebsite);

  return `<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${companyName ?? appName}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bgLight};font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bgLight};">
    <tr>
      <td align="center" style="padding:24px 16px;">

        <!-- Email container (max 600px) -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${BRAND.white};border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- HEADER — Company logo -->
          <tr>
            <td style="background-color:${BRAND.navy};padding:24px 32px;text-align:center;">
              <img src="${companyLogoUrl}" alt="${companyName ?? appName}" width="160" height="160" style="display:block;margin:0 auto;max-width:160px;height:auto;border-radius:12px;" />
            </td>
          </tr>

          <!-- CONTENT AREA -->
          <tr>
            <td style="padding:32px 32px 24px;">
              ${contentHtml}
            </td>
          </tr>

          <!-- DIVIDER -->
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none;border-top:1px solid ${BRAND.border};margin:0;" />
            </td>
          </tr>

          <!-- FOOTER — Company contact details (no company name title — already in body) -->
          ${contactLines.length > 0 ? `
          <tr>
            <td style="padding:20px 32px 16px;text-align:center;">
              ${contactLines.map(line =>
                `<p style="margin:0;font-size:12px;color:${BRAND.gray};line-height:1.8;">${escapeHtml(line)}</p>`
              ).join('\n              ')}
            </td>
          </tr>` : ''}

          <!-- APP BRANDING — Nestor App logo + copyright -->
          <tr>
            <td style="padding:12px 32px 20px;text-align:center;border-top:1px solid ${BRAND.border};">
              <!--[if !mso]><!-- Fallback: show logo only when hosted on production -->
              <img src="${appLogoUrl}" alt="" width="28" height="28" style="display:inline-block;vertical-align:middle;max-width:28px;height:auto;border-radius:5px;margin-right:8px;border:0;" />
              <!--<![endif]-->
              <span style="font-size:11px;color:${BRAND.grayLight};vertical-align:middle;font-weight:600;">
                ${appName}
              </span>
              <br/>
              <span style="font-size:10px;color:${BRAND.border};">
                &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.
              </span>
            </td>
          </tr>

        </table>
        <!-- /Email container -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ============================================================================
// SHARED HELPERS (exported for use by specific templates)
// ============================================================================

/** Brand colors — exported for specific templates to reference */
export { BRAND };

/** App base URL */
function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://nestor-app.vercel.app';
}

/** Escape HTML special chars to prevent XSS in dynamic content */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Server-safe Euro formatter — 2 decimal places, Greek locale.
 * Kept here to avoid importing react-i18next in server-only context.
 */
export function formatEuro(amount: number): string {
  return new Intl.NumberFormat('el', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Server-safe date formatter — Greek locale */
export function formatEmailDateGreek(date: Date): string {
  return new Intl.DateTimeFormat('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

// Back-compat alias — consumer migration deferred (email templates have pre-existing Greek UI strings, out of scope Boy Scout C.5.13)
export { formatEmailDateGreek as formatDateGreek };

/** Payment method labels */
const PAYMENT_LABELS: Record<string, string> = {
  bank_transfer: 'Τραπεζική κατάθεση',
  cash: 'Μετρητά',
  check: 'Επιταγή',
  credit_card: 'Πιστωτική κάρτα',
  debit_card: 'Χρεωστική κάρτα',
};

export function formatPaymentMethod(method: string): string {
  return PAYMENT_LABELS[method] ?? method;
}
