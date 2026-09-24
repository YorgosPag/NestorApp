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
import { resolveSenderHeader, resolveSenderIdentity } from '@/services/company/sender-identity';
import { wrapInBrandedTemplate, escapeHtml, BRAND } from '@/services/email-templates/base-email-template';
import type { ChannelDeliveryResult, MessageChannel, VendorInviteMessage } from './types';
import { vendorInviteEmailTexts } from './vendor-invite-email-texts';

const logger = createModuleLogger('VENDOR_PORTAL_EMAIL_CHANNEL');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
/*
 * 🔴 ΕΔΩ ΖΟΥΣΕ Η **ΤΡΙΤΗ** ΑΝΕΞΑΡΤΗΤΗ ΑΝΑΓΝΩΣΗ ΤΩΝ `FROM_EMAIL`/`FROM_NAME` —
 * ΚΑΙ ΤΟ ΧΡΕΟΣ ΗΤΑΝ ΗΔΗ ΓΡΑΜΜΕΝΟ ΕΔΩ, ΑΠΛΩΣ ΚΑΝΕΙΣ ΔΕΝ ΤΟ ΕΚΛΕΙΝΕ (ADR-857 §7 #11 → Φ9).
 *
 * Το σχόλιο που έσβησε έλεγε κατά λέξη *«ΤΡΙΤΗ ανεξάρτητη ανάγνωση … χρέος SSoT»*. Η
 * απογραφή όμως μέτρησε **έξι** οικογένειες, όχι τρεις: το χρέος ήταν **διπλάσιο απ' όσο
 * δήλωνε το ίδιο του το σχόλιο**.
 */
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
  // N.11 · ADR-876 §5 — τα λόγια ζουν σε πίνακα ανά γλώσσα, ποτέ σε `isEl ? '…' : '…'`.
  const texts = vendorInviteEmailTexts(message.locale);
  const projectLine = message.projectName ? ` — ${message.projectName}` : '';

  const subject = texts.subject(message.rfqTitle, projectLine);
  const greeting = texts.greeting(message.vendorName);
  const declineLine = message.declineUrl
    ? `<p style="font-size:13px;color:#666;">${escapeHtml(texts.declineQuestion)} <a href="${escapeHtml(message.declineUrl)}" style="color:#888;">${escapeHtml(texts.declineCta)}</a>.</p>`
    : '';

  const contentHtml = `
<p style="margin:0 0 16px;font-size:15px;font-weight:600;color:${BRAND.navyDark};">${escapeHtml(greeting)}</p>
<p style="margin:0 0 24px;font-size:15px;color:${BRAND.gray};line-height:1.6;">${texts.introHtml(`<strong>${escapeHtml(message.rfqTitle)}</strong>`)}</p>
<p style="margin:0 0 32px;text-align:center;">
  <a href="${escapeHtml(message.portalUrl)}" style="display:inline-block;padding:14px 32px;background:${BRAND.accent};color:${BRAND.white};text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;">${escapeHtml(texts.cta)}</a>
</p>
<p style="margin:0 0 8px;font-size:13px;color:${BRAND.grayLight};">
  ${escapeHtml(texts.expiresLabel)}: <strong style="color:${BRAND.navyDark};">${new Date(message.expiresAt).toLocaleString(message.locale)}</strong>
</p>
<p style="margin:0 0 8px;font-size:13px;color:${BRAND.grayLight};">${escapeHtml(texts.renewHint)}</p>
<p style="margin:24px 0 0;padding:12px 16px;background:#fff7e6;border-left:3px solid #fa8c16;font-size:13px;color:#8a4b00;">
  ${escapeHtml(texts.warning)}
</p>
${declineLine}`;

  // 🔑 ADR-857 Φ9 — **ο φάκελος και το υποσέλιδο λένε το ΙΔΙΟ πράγμα.** Το όνομα και η
  //    διεύθυνση που βλέπει ο προμηθευτής **μέσα** στο μήνυμα έρχονται από την ίδια ρίζα
  //    με τη γραμμή `From:`· ήταν ήδη το ίδιο ζεύγος, αλλά από **δεύτερη** ανάγνωση.
  const sender = resolveSenderIdentity();
  const html = wrapInBrandedTemplate({
    contentHtml,
    companyName: sender.name,
    companyEmail: sender.address,
  });

  const text = `${greeting}\n\n${texts.textRequest} ${message.rfqTitle}\n${texts.textLink} ${message.portalUrl}\n${texts.textExpires} ${message.expiresAt}\n\n${texts.renewHint}\n\n${texts.warning}\n`;

  return { subject, html, text };
}

class EmailVendorInviteChannel implements MessageChannel {
  readonly id = 'email' as const;

  isAvailable(): boolean {
    return !!(resend || mailgunAdapter);
  }

  async send(message: VendorInviteMessage): Promise<ChannelDeliveryResult> {
    const { subject, html, text } = compose(message);
    const fromHeader = resolveSenderHeader();

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
