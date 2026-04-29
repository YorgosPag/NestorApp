/**
 * Email channel driver for vendor invites.
 *
 * Reuses the same Resend → Mailgun fallback pattern as the company-wide
 * `EmailService` (ADR-070), but builds a vendor-portal–specific HTML body so
 * branding + warning text stay aligned with ADR-327 §11 (anti-phishing).
 *
 * @module subapps/procurement/services/channels/email-channel
 * @enterprise ADR-327 §7.2 + §11
 */

import 'server-only';

import { Resend } from 'resend';
import { EmailAdapter } from '@/server/comms/email-adapter';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { wrapInBrandedTemplate, escapeHtml, BRAND } from '@/services/email-templates/base-email-template';
import type { ChannelDeliveryResult, MessageChannel, VendorInviteMessage } from './types';

const logger = createModuleLogger('VENDOR_PORTAL_EMAIL_CHANNEL');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'info@nestorconstruct.gr';
const FROM_NAME = process.env.FROM_NAME || 'Nestor Construct';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const mailgunAdapter = MAILGUN_API_KEY ? new EmailAdapter() : null;

const PROVIDER_TIMEOUT_MS = 20_000;

function withProviderTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} provider timeout after ${PROVIDER_TIMEOUT_MS}ms`)),
        PROVIDER_TIMEOUT_MS,
      ),
    ),
  ]);
}

interface ComposedEmail {
  subject: string;
  html: string;
  text: string;
}

function compose(message: VendorInviteMessage): ComposedEmail {
  const isEl = message.locale === 'el';
  const projectLine = message.projectName ? ` — ${message.projectName}` : '';

  const subject = isEl
    ? `Πρόσκληση Προσφοράς: ${message.rfqTitle}${projectLine}`
    : `Quote Request: ${message.rfqTitle}${projectLine}`;

  const greeting = isEl ? `Γεια σας ${message.vendorName},` : `Hello ${message.vendorName},`;
  const intro = isEl
    ? `Σας έχει σταλεί αίτημα προσφοράς για το έργο <strong>${escapeHtml(message.rfqTitle)}</strong>.`
    : `You have been invited to submit a quote for project <strong>${escapeHtml(message.rfqTitle)}</strong>.`;
  const cta = isEl ? 'Υποβολή Προσφοράς' : 'Submit Quote';
  const expiresLabel = isEl ? 'Ο σύνδεσμος λήγει στις' : 'Link expires on';
  const warning = isEl
    ? '⚠️ Αυτός ο σύνδεσμος είναι προσωπικός. Μην τον προωθήσετε σε τρίτους.'
    : '⚠️ This link is personal. Do not forward it to anyone else.';
  const declineQuestion = isEl ? 'Δεν μπορείτε να συμμετάσχετε;' : 'Cannot participate?';
  const declineCta = isEl ? 'Δηλώστε άρνηση εδώ' : 'Decline here';
  const declineLine = message.declineUrl
    ? `<p style="font-size:13px;color:#666;">${escapeHtml(declineQuestion)} <a href="${message.declineUrl}" style="color:#888;">${escapeHtml(declineCta)}</a>.</p>`
    : '';

  const contentHtml = `
<p style="margin:0 0 16px;font-size:15px;font-weight:600;color:${BRAND.navyDark};">${escapeHtml(greeting)}</p>
<p style="margin:0 0 24px;font-size:15px;color:${BRAND.gray};line-height:1.6;">${intro}</p>
<p style="margin:0 0 32px;text-align:center;">
  <a href="${escapeHtml(message.portalUrl)}" style="display:inline-block;padding:14px 32px;background:${BRAND.accent};color:${BRAND.white};text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;">${escapeHtml(cta)}</a>
</p>
<p style="margin:0 0 8px;font-size:13px;color:${BRAND.grayLight};">
  ${escapeHtml(expiresLabel)}: <strong style="color:${BRAND.navyDark};">${new Date(message.expiresAt).toLocaleString(message.locale)}</strong>
</p>
<p style="margin:24px 0 0;padding:12px 16px;background:#fff7e6;border-left:3px solid #fa8c16;font-size:13px;color:#8a4b00;">
  ${escapeHtml(warning)}
</p>
${declineLine}`;

  const html = wrapInBrandedTemplate({
    contentHtml,
    companyName: FROM_NAME,
    companyEmail: FROM_EMAIL,
  });

  const text = `${greeting}\n\n${
    isEl ? 'Αίτημα προσφοράς:' : 'Quote request:'
  } ${message.rfqTitle}\n${
    isEl ? 'Σύνδεσμος:' : 'Link:'
  } ${message.portalUrl}\n${
    isEl ? 'Λήγει:' : 'Expires:'
  } ${message.expiresAt}\n\n${warning}\n`;

  return { subject, html, text };
}

class EmailVendorInviteChannel implements MessageChannel {
  readonly id = 'email' as const;

  isAvailable(): boolean {
    return !!(resend || mailgunAdapter);
  }

  async send(message: VendorInviteMessage): Promise<ChannelDeliveryResult> {
    const { subject, html, text } = compose(message);
    const fromHeader = `${FROM_NAME} <${FROM_EMAIL}>`;

    if (resend) {
      try {
        const result = await withProviderTimeout(
          resend.emails.send({
            from: fromHeader,
            to: [message.recipient],
            subject,
            html,
            text,
            tags: [
              { name: 'campaign', value: 'vendor_quote_invite' },
              { name: 'invite_id', value: message.inviteId },
            ],
          }),
          'Resend',
        );
        return {
          success: true,
          providerMessageId: result.data?.id ?? null,
          errorReason: null,
          channel: 'email',
        };
      } catch (err) {
        const reason = getErrorMessage(err, 'Resend send failed');
        logger.error('Resend vendor invite send failed', { inviteId: message.inviteId, reason });
        if (!mailgunAdapter) {
          return { success: false, providerMessageId: null, errorReason: reason, channel: 'email' };
        }
      }
    }

    if (mailgunAdapter) {
      try {
        const result = await withProviderTimeout(
          mailgunAdapter.sendEmail({
            id: `vendor_invite_${message.inviteId}`,
            to: message.recipient,
            subject,
            content: text,
            html,
            from: fromHeader,
            metadata: { templateId: 'vendor_quote_invite', category: 'procurement' },
            attempts: 0,
            maxAttempts: 1,
          }),
          'Mailgun',
        );
        return {
          success: result.success,
          providerMessageId: result.messageId ?? null,
          errorReason: result.success ? null : 'Mailgun send rejected',
          channel: 'email',
        };
      } catch (err) {
        const reason = getErrorMessage(err, 'Mailgun send failed');
        logger.error('Mailgun vendor invite send failed', { inviteId: message.inviteId, reason });
        return { success: false, providerMessageId: null, errorReason: reason, channel: 'email' };
      }
    }

    return {
      success: false,
      providerMessageId: null,
      errorReason: 'No email provider configured (RESEND_API_KEY or MAILGUN_API_KEY)',
      channel: 'email',
    };
  }
}

export const emailVendorInviteChannel = new EmailVendorInviteChannel();
