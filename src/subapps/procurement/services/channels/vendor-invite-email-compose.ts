/**
 * @fileoverview **Η ΣΥΝΘΕΣΗ ΤΟΥ EMAIL ΠΡΟΣΚΛΗΣΗΣ ΠΡΟΜΗΘΕΥΤΗ — ΜΙΑ** (ADR-327 §7.2 · §7.5 · §11).
 * @module subapps/procurement/services/channels/vendor-invite-email-compose
 *
 * Την καλούν **δύο**: ο δίαυλος αποστολής (`email-channel.ts`) και η προεπισκόπηση της φόρμας
 * (`POST /api/rfqs/[id]/invites/preview`). Άρα αυτό που βλέπει ο αγοραστής πριν πατήσει «Αποστολή»
 * είναι **byte προς byte** αυτό που λαμβάνει ο προμηθευτής — όχι αντίγραφο του προτύπου στον browser.
 *
 * 🔒 Anti-phishing (§11): ο σύνδεσμος, η λήξη, η άρνηση και η προειδοποίηση είναι λόγια του **συστήματος**·
 *    ο αγοραστής προσθέτει μόνο **σημείωμα απλού κειμένου**, escaped, σε δικό του πλαίσιο με επικεφαλίδα.
 */

import 'server-only';

import { resolveHumanLanguage } from '@/i18n/languages';
import { formatOperatorDateTime } from '@/lib/operator-time-format';
import { resolveSenderIdentity } from '@/services/company/sender-identity';
import { wrapInBrandedTemplate, escapeHtml, BRAND } from '@/services/email-templates/base-email-template';
import { personalNoteBlockHtml, personalNoteBlockText } from '@/services/email-templates/personal-note-block';
import type { VendorInviteMessage } from './types';
import { vendorInviteEmailTexts, type VendorInviteEmailTexts } from './vendor-invite-email-texts';

export interface ComposedVendorInviteEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

/** Οι ημερομηνίες του μηνύματος — ώρα του ΦΟΡΕΑ (ADR-877 §6), ίδια γραφή σε HTML και κείμενο. */
interface InviteDates {
  readonly expiresAt: string;
  readonly dueAt: string | null;
}

function datesOf(message: VendorInviteMessage): InviteDates {
  return {
    expiresAt: formatOperatorDateTime(message.expiresAt, message.locale),
    dueAt: message.responseDueAt ? formatOperatorDateTime(message.responseDueAt, message.locale) : null,
  };
}

const metaLine = (label: string, value: string): string =>
  `<p style="margin:0 0 8px;font-size:13px;color:${BRAND.grayLight};">${escapeHtml(label)}: <strong style="color:${BRAND.navyDark};">${escapeHtml(value)}</strong></p>`;

function declineHtml(message: VendorInviteMessage, texts: VendorInviteEmailTexts): string {
  if (!message.declineUrl) return '';
  return `<p style="font-size:13px;color:#666;">${escapeHtml(texts.declineQuestion)} <a href="${escapeHtml(message.declineUrl)}" style="color:#888;">${escapeHtml(texts.declineCta)}</a>.</p>`;
}

function contentHtml(message: VendorInviteMessage, texts: VendorInviteEmailTexts, dates: InviteDates): string {
  const projectMarkup = message.projectName ? `<strong>${escapeHtml(message.projectName)}</strong>` : null;
  const intro = texts.introHtml(`<strong>${escapeHtml(message.rfqTitle)}</strong>`, projectMarkup);
  return `
<p style="margin:0 0 16px;font-size:15px;font-weight:600;color:${BRAND.navyDark};">${escapeHtml(texts.greeting(message.vendorName))}</p>
<p style="margin:0 0 24px;font-size:15px;color:${BRAND.gray};line-height:1.6;">${intro}</p>
${personalNoteBlockHtml(texts.noteHeading, message.buyerNote)}
<p style="margin:0 0 32px;text-align:center;">
  <a href="${escapeHtml(message.portalUrl)}" style="display:inline-block;padding:14px 32px;background:${BRAND.accent};color:${BRAND.white};text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;">${escapeHtml(texts.cta)}</a>
</p>
${dates.dueAt ? metaLine(texts.dueLabel, dates.dueAt) : ''}
${metaLine(texts.expiresLabel, dates.expiresAt)}
<p style="margin:0 0 8px;font-size:13px;color:${BRAND.grayLight};">${escapeHtml(texts.renewHint)}</p>
<p style="margin:24px 0 0;padding:12px 16px;background:#fff7e6;border-left:3px solid #fa8c16;font-size:13px;color:#8a4b00;">
  ${escapeHtml(texts.warning)}
</p>
${declineHtml(message, texts)}`;
}

function plainText(message: VendorInviteMessage, texts: VendorInviteEmailTexts, dates: InviteDates): string {
  const lines = [
    `${texts.greeting(message.vendorName)}\n`,
    `${texts.introText(message.rfqTitle, message.projectName)}\n`,
    personalNoteBlockText(texts.noteHeading, message.buyerNote),
    `${texts.textLink}: ${message.portalUrl}`,
    dates.dueAt ? `${texts.dueLabel}: ${dates.dueAt}` : null,
    `${texts.expiresLabel}: ${dates.expiresAt}\n`,
    `${texts.renewHint}\n`,
    texts.warning,
  ];
  return `${lines.filter((line): line is string => line !== null && line !== '').join('\n')}\n`;
}

/** Θέμα + HTML + κείμενο του email πρόσκλησης — καθαρή συνάρτηση του μηνύματος. */
export function composeVendorInviteEmail(message: VendorInviteMessage): ComposedVendorInviteEmail {
  // N.11 · ADR-876 §5 — τα λόγια ζουν σε πίνακα ανά γλώσσα, ποτέ σε `isEl ? '…' : '…'`.
  const texts = vendorInviteEmailTexts(message.locale);
  const dates = datesOf(message);
  // 🔑 ADR-857 Φ9 — ο φάκελος και το υποσέλιδο λένε το ΙΔΙΟ πράγμα: όνομα + διεύθυνση από την ίδια ρίζα με το `From:`.
  const sender = resolveSenderIdentity();
  const html = wrapInBrandedTemplate({
    contentHtml: contentHtml(message, texts, dates),
    companyName: sender.name,
    companyEmail: sender.address,
    lang: resolveHumanLanguage(message.locale), // WCAG 3.1.1 · ADR-851: η αγγλική πρόσκληση δεν δηλώνεται `el`
  });
  return { subject: texts.subject(message.rfqTitle, message.projectName), html, text: plainText(message, texts, dates) };
}
