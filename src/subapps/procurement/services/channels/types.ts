/**
 * MessageChannel — abstraction for vendor invite delivery.
 * Phased rollout per ADR-327 §17 Q7: Day 1 = email + copy_link.
 * Future drivers (whatsapp, sms, telegram) plug into the same interface.
 *
 * @module subapps/procurement/services/channels/types
 * @enterprise ADR-327 §7.2 Delivery Channels
 */

import type { DeliveryChannel } from '../../types/vendor-invite';

export interface VendorInviteMessage {
  /** Stable identifier of the invite this message belongs to. */
  inviteId: string;
  /** Vendor display name (used in greeting). */
  vendorName: string;
  /** Vendor contact target (email address / phone). Channel decides what it accepts. */
  recipient: string;
  /** Project + RFQ context for subject/body composition. */
  rfqTitle: string;
  projectName: string | null;
  /** Absolute public URL to the vendor portal page (already includes the token). */
  portalUrl: string;
  /** ISO timestamp when the link expires. */
  expiresAt: string;
  /** Locale for body composition (`el` default). */
  locale: 'el' | 'en';
  /** Optional decline link. */
  declineUrl: string | null;
}

export interface ChannelDeliveryResult {
  /** True only when provider accepted the message (queued / sent). */
  success: boolean;
  /** Provider-specific message ID for audit, when available. */
  providerMessageId: string | null;
  /** Human-readable error reason when `success === false`. */
  errorReason: string | null;
  /** Channel that produced the result (for invite delivery audit). */
  channel: DeliveryChannel;
}

export interface MessageChannel {
  readonly id: DeliveryChannel;
  /** Whether the channel can be used at runtime (env vars / config present). */
  isAvailable(): boolean;
  /** Send a vendor invite. MUST swallow expected provider errors and surface them via the result. */
  send(message: VendorInviteMessage): Promise<ChannelDeliveryResult>;
}
