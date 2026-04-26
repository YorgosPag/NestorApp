/**
 * Copy-link "channel" — fallback that simply returns success without sending,
 * letting the PM copy/paste the link manually (Q7 day-1 baseline).
 *
 * @module subapps/procurement/services/channels/copy-link-channel
 * @enterprise ADR-327 §7.2 — Day 1 baseline
 */

import 'server-only';

import type { ChannelDeliveryResult, MessageChannel, VendorInviteMessage } from './types';

class CopyLinkVendorInviteChannel implements MessageChannel {
  readonly id = 'copy_link' as const;

  isAvailable(): boolean {
    return true;
  }

  async send(_message: VendorInviteMessage): Promise<ChannelDeliveryResult> {
    return {
      success: true,
      providerMessageId: null,
      errorReason: null,
      channel: 'copy_link',
    };
  }
}

export const copyLinkVendorInviteChannel = new CopyLinkVendorInviteChannel();
