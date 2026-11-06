/**
 * Email channel driver for vendor invites — the body comes from the ONE composer
 * (`vendor-invite-email-compose.ts`, ADR-327 §7.5 · §11 anti-phishing), shared with the form preview,
 * and goes out through the **ONE** provider chain (`defaultEmailChain`).
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

import { createModuleLogger } from '@/lib/telemetry';
import { chainFailureReasons, chainOutcomeUncertain, sendThroughChain } from '@/server/comms/email-provider-chain';
import { defaultEmailChain } from '@/server/comms/email-providers';
import { resolveSenderHeader } from '@/services/company/sender-identity';
import type { ChannelDeliveryResult, MessageChannel, VendorInviteMessage } from './types';
import { composeVendorInviteEmail } from './vendor-invite-email-compose';

const logger = createModuleLogger('VENDOR_PORTAL_EMAIL_CHANNEL');

class EmailVendorInviteChannel implements MessageChannel {
  readonly id = 'email' as const;

  isAvailable(): boolean {
    return defaultEmailChain().some((provider) => provider.configured);
  }

  async send(message: VendorInviteMessage): Promise<ChannelDeliveryResult> {
    // ADR-327 §7.5 — ΙΔΙΑ σύνθεση με την προεπισκόπηση της φόρμας (`composeVendorInviteEmail`).
    const { subject, html, text } = composeVendorInviteEmail(message);
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
    return { success: false, providerMessageId: null, errorReason: reason, channel: 'email', uncertain: chainOutcomeUncertain(outcome) };
  }
}

export const emailVendorInviteChannel = new EmailVendorInviteChannel();
