/**
 * @fileoverview Base HTML Email Template — Pagonis Energo Branding
 * @description Κεντρικοποιημένο email template με εταιρική ταυτότητα.
 *              Χρησιμοποιεί inline styles (email clients δεν υποστηρίζουν CSS classes).
 * @note Inline styles ΑΠΑΙΤΟΥΝΤΑΙ σε HTML emails — δεν ισχύει ο κανόνας N.3 του CLAUDE.md
 * @pattern Reusable wrapper: header (logo + company identity + contacts) + content slot + footer (Nestor App branding)
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
  /** Navy text lighter (readable on navy surface) */
  navySoft: 'rgba(255,255,255,0.85)',
} as const;

// ============================================================================
// BASE TEMPLATE
// ============================================================================

export type EmailSocialPlatform =
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'twitter'
  | 'youtube'
  | 'github'
  | 'other';

export interface EmailSocialLink {
  platform: EmailSocialPlatform;
  url: string;
  username?: string;
  label?: string;
}

export interface EmailContactPhone { value: string; label?: string }
export interface EmailContactEmail { value: string; label?: string }
export interface EmailContactWebsite { url: string; label?: string }

export interface EmailHeaderContactLabels {
  addressLabel: string;
  phoneLabel: string;
  emailLabel: string;
  websiteLabel: string;
  socialLabel: string;
}

interface BaseEmailParams {
  /** Main content HTML — injected into the body area */
  contentHtml: string;
  /** Company name shown in header */
  companyName?: string;
  /** Legacy primary phone — used when `companyPhones` is empty */
  companyPhone?: string;
  /** Legacy primary email — used when `companyEmails` is empty */
  companyEmail?: string;
  /** Legacy primary address — used when `companyAddresses` is empty */
  companyAddress?: string;
  /** Legacy primary website — used when `companyWebsites` is empty */
  companyWebsite?: string;
  /**
   * Absolute URL of the company logo shown in the header (ADR-312 Phase 8).
   * Falls back to the bundled `/images/pagonis-energo-logo.png` when undefined.
   */
  companyLogoUrl?: string;
  /** Optional subtitle displayed under the company name in the header. */
  headerSubtitle?: string;
  /** Full list of phones rendered as contact rows in the header (ADR-312 Phase 9). */
  companyPhones?: EmailContactPhone[];
  /** Full list of emails rendered as contact rows in the header (ADR-312 Phase 9). */
  companyEmails?: EmailContactEmail[];
  /** Pre-formatted address lines rendered in the header (ADR-312 Phase 9). */
  companyAddresses?: string[];
  /** Websites rendered in the header (ADR-312 Phase 9). */
  companyWebsites?: EmailContactWebsite[];
  /** Social links rendered as an icon row in the header (ADR-312 Phase 9). */
  companySocials?: EmailSocialLink[];
  /** Localised labels used as a11y titles for the contact rows. */
  contactLabels?: EmailHeaderContactLabels;
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
    headerSubtitle,
    companyPhones,
    companyEmails,
    companyAddresses,
    companyWebsites,
    companySocials,
    contactLabels,
  } = params;

  const baseUrl = getAppBaseUrl();
  const companyLogoUrl = companyLogoUrlOverride && companyLogoUrlOverride.trim().length > 0
    ? companyLogoUrlOverride
    : `${baseUrl}/images/pagonis-energo-logo.png`;
  const appLogoUrl = `${baseUrl}/images/nestor-app-logo.jpg`;
  const appName = 'Nestor App';

  const phones: EmailContactPhone[] =
    companyPhones && companyPhones.length > 0
      ? companyPhones
      : companyPhone
        ? [{ value: companyPhone }]
        : [];
  const emails: EmailContactEmail[] =
    companyEmails && companyEmails.length > 0
      ? companyEmails
      : companyEmail
        ? [{ value: companyEmail }]
        : [];
  const addresses: string[] =
    companyAddresses && companyAddresses.length > 0
      ? companyAddresses
      : companyAddress
        ? [companyAddress]
        : [];
  const websites: EmailContactWebsite[] =
    companyWebsites && companyWebsites.length > 0
      ? companyWebsites
      : companyWebsite
        ? [{ url: companyWebsite }]
        : [];
  const socials: EmailSocialLink[] = companySocials ?? [];

  const labels: EmailHeaderContactLabels = contactLabels ?? {
    addressLabel: 'Address',
    phoneLabel: 'Phone',
    emailLabel: 'Email',
    websiteLabel: 'Website',
    socialLabel: 'Social',
  };

  const headerContacts = renderHeaderContacts({
    addresses, phones, emails, websites, socials, labels,
  });

  return `<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(companyName ?? appName)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bgLight};font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bgLight};">
    <tr>
      <td align="center" style="padding:24px 16px;">

        <!-- Email container (max 600px) -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${BRAND.white};border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- HEADER — Company identity (logo + name + contacts) -->
          <tr>
            <td style="background-color:${BRAND.navy};padding:28px 32px 24px;text-align:center;">
              <img src="${escapeHtml(companyLogoUrl)}" alt="${escapeHtml(companyName ?? appName)}" width="120" height="120" style="display:block;margin:0 auto 12px;max-width:120px;height:auto;border-radius:12px;" />
              ${companyName ? `<p style="margin:0;font-size:20px;font-weight:700;color:${BRAND.white};line-height:1.3;">${escapeHtml(companyName)}</p>` : ''}
              ${headerSubtitle ? `<p style="margin:4px 0 0;font-size:12px;color:${BRAND.navySoft};letter-spacing:0.04em;">${escapeHtml(headerSubtitle)}</p>` : ''}
              ${headerContacts}
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

          <!-- APP BRANDING — Nestor App logo + copyright -->
          <tr>
            <td style="padding:16px 32px 20px;text-align:center;">
              <!--[if !mso]><!-- Fallback: show logo only when hosted on production -->
              <img src="${escapeHtml(appLogoUrl)}" alt="" width="28" height="28" style="display:inline-block;vertical-align:middle;max-width:28px;height:auto;border-radius:5px;margin-right:8px;border:0;" />
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
// HEADER CONTACT BLOCK
// ============================================================================

interface RenderHeaderContactsParams {
  addresses: string[];
  phones: EmailContactPhone[];
  emails: EmailContactEmail[];
  websites: EmailContactWebsite[];
  socials: EmailSocialLink[];
  labels: EmailHeaderContactLabels;
}

function renderHeaderContacts(params: RenderHeaderContactsParams): string {
  const { addresses, phones, emails, websites, socials, labels } = params;
  if (
    addresses.length === 0
    && phones.length === 0
    && emails.length === 0
    && websites.length === 0
    && socials.length === 0
  ) {
    return '';
  }

  const linkStyle = `color:${BRAND.white};text-decoration:none;`;
  const rowStyle = `margin:4px 0 0;font-size:12px;color:${BRAND.navySoft};line-height:1.5;`;

  const rows: string[] = [];
  if (addresses.length > 0) {
    const html = addresses.map((a) => escapeHtml(a)).join(' · ');
    rows.push(`<p style="${rowStyle}" title="${escapeHtml(labels.addressLabel)}">📍 ${html}</p>`);
  }
  if (phones.length > 0) {
    const html = phones
      .map((p) => `<a href="${escapeHtml(buildPhoneHref(p.value))}" style="${linkStyle}">${escapeHtml(p.value)}</a>`)
      .join(' · ');
    rows.push(`<p style="${rowStyle}" title="${escapeHtml(labels.phoneLabel)}">📞 ${html}</p>`);
  }
  if (emails.length > 0) {
    const html = emails
      .map((e) => `<a href="mailto:${escapeHtml(e.value)}" style="${linkStyle}">${escapeHtml(e.value)}</a>`)
      .join(' · ');
    rows.push(`<p style="${rowStyle}" title="${escapeHtml(labels.emailLabel)}">✉️ ${html}</p>`);
  }
  if (websites.length > 0) {
    const html = websites
      .map((w) => `<a href="${escapeHtml(w.url)}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${escapeHtml(w.label ?? w.url.replace(/^https?:\/\//, ''))}</a>`)
      .join(' · ');
    rows.push(`<p style="${rowStyle}" title="${escapeHtml(labels.websiteLabel)}">🌐 ${html}</p>`);
  }
  if (socials.length > 0) {
    const html = socials
      .map((s) => {
        const name = SOCIAL_DISPLAY[s.platform] ?? s.platform;
        const handle = s.username ? `@${s.username}` : s.label ?? name;
        return `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" style="${linkStyle}">${escapeHtml(name)} ${escapeHtml(handle)}</a>`;
      })
      .join(' · ');
    rows.push(`<p style="${rowStyle}" title="${escapeHtml(labels.socialLabel)}">🔗 ${html}</p>`);
  }

  return `<div style="margin:14px auto 0;max-width:480px;text-align:center;">${rows.join('')}</div>`;
}

const SOCIAL_DISPLAY: Record<EmailSocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  twitter: 'Twitter',
  youtube: 'YouTube',
  github: 'GitHub',
  other: 'Link',
};

function buildPhoneHref(value: string): string {
  const digits = value.replace(/[^\d+]/g, '');
  return digits.length > 0 ? `tel:${digits}` : '#';
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
