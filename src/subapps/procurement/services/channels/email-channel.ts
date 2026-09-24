/**
 * Email channel driver for vendor invites — builds the vendor-portal HTML body (ADR-327 §11,
 * anti-phishing) and hands it to the **ONE** provider chain (`defaultEmailChain`).
 *
 * 🔴 **ΕΔΩ ΖΟΥΣΕ ΧΕΙΡΟΓΡΑΦΟ ΔΙΔΥΜΟ ΤΗΣ ΑΛΥΣΙΔΑΣ** (ADR-876 §5.8 Σ22): δικό του Resend SDK, δικός
 * του `EmailAdapter`, δικό του `PROVIDER_TIMEOUT_MS`. Και ένα **σφάλμα**: το `resend.emails.send`
 * **δεν πετά** σε απόρριψη (`{ data:null, error }`), και εδώ διαβαζόταν μόνο το `data` ⇒ πρόσκληση
 * που απέρριψε ο Resend γραφόταν «στάλθηκε», **χωρίς** μετάπτωση στον Mailgun. Πλέον: η αλυσίδα
 * (έλεγχος `error`, μετάπτωση, όριο χρόνου) και η πόρτα εξόδου (σε emulator ⇒ outbox).
 *
 * @module subapps/procurement/services/channels/email-channel
 * @enterprise ADR-327 §7.2 + §11
 */

import 'server-only';

import { resolveHumanLanguage } from '@/i18n/languages';
import { formatOperatorDateTime } from '@/lib/operator-time-format';
import { createModuleLogger } from '@/lib/telemetry';
import { chainFailureReasons, sendThroughChain } from '@/server/comms/email-provider-chain';
import { defaultEmailChain } from '@/server/comms/email-providers';
import { resolveSenderHeader, resolveSenderIdentity } from '@/services/company/sender-identity';
import { wrapInBrandedTemplate, escapeHtml, BRAND } from '@/services/email-templates/base-email-template';
import type { ChannelDeliveryResult, MessageChannel, VendorInviteMessage } from './types';
import { vendorInviteEmailTexts } from './vendor-invite-email-texts';

const logger = createModuleLogger('VENDOR_PORTAL_EMAIL_CHANNEL');

interface ComposedEmail {
  subject: string;
  html: string;
  text: string;
}

function compose(message: VendorInviteMessage): ComposedEmail {
  // N.11 · ADR-876 §5 — τα λόγια ζουν σε πίνακα ανά γλώσσα, ποτέ σε `isEl ? '…' : '…'`.
  const texts = vendorInviteEmailTexts(message.locale);
  const projectLine = message.projectName ? ` — ${message.projectName}` : '';
  // ADR-877 §6 — ώρα του ΦΟΡΕΑ (ο διακομιστής τρέχει σε UTC)· ΙΔΙΑ γραφή σε HTML και κείμενο.
  const expiresAt = formatOperatorDateTime(message.expiresAt, message.locale);
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
  ${escapeHtml(texts.expiresLabel)}: <strong style="color:${BRAND.navyDark};">${escapeHtml(expiresAt)}</strong>
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
    lang: resolveHumanLanguage(message.locale), // WCAG 3.1.1 · ADR-851: η αγγλική πρόσκληση δεν δηλώνεται `el`
  });

  const text = `${greeting}\n\n${texts.textRequest} ${message.rfqTitle}\n${texts.textLink} ${message.portalUrl}\n${texts.textExpires} ${expiresAt}\n\n${texts.renewHint}\n\n${texts.warning}\n`;

  return { subject, html, text };
}

class EmailVendorInviteChannel implements MessageChannel {
  readonly id = 'email' as const;

  isAvailable(): boolean {
    return defaultEmailChain().some((provider) => provider.configured);
  }

  async send(message: VendorInviteMessage): Promise<ChannelDeliveryResult> {
    const { subject, html, text } = compose(message);
    const outcome = await sendThroughChain(defaultEmailChain(), {
      to: message.recipient,
      subject,
      text,
      html,
      from: resolveSenderHeader(),
    });
    if (outcome.kind === 'delivered') {
      return { success: true, providerMessageId: outcome.messageId ?? null, errorReason: null, channel: 'email' };
    }
    const reason = chainFailureReasons(outcome).join(' | ');
    logger.error('Vendor invite email not delivered', { inviteId: message.inviteId, reason });
    return { success: false, providerMessageId: null, errorReason: reason, channel: 'email' };
  }
}

export const emailVendorInviteChannel = new EmailVendorInviteChannel();
