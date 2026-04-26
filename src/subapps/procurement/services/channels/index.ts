/**
 * Channel registry — resolves a `DeliveryChannel` to its concrete driver.
 * Day-1 supports `email` + `copy_link` (Q7). Future drivers register here.
 *
 * @module subapps/procurement/services/channels
 * @enterprise ADR-327 §7.2
 */

import 'server-only';

import type { DeliveryChannel } from '../../types/vendor-invite';
import type { MessageChannel } from './types';
import { emailVendorInviteChannel } from './email-channel';
import { copyLinkVendorInviteChannel } from './copy-link-channel';

const REGISTRY: Partial<Record<DeliveryChannel, MessageChannel>> = {
  email: emailVendorInviteChannel,
  copy_link: copyLinkVendorInviteChannel,
};

export function resolveChannel(id: DeliveryChannel): MessageChannel | null {
  return REGISTRY[id] ?? null;
}

export function isChannelSupported(id: DeliveryChannel): boolean {
  const ch = REGISTRY[id];
  return !!ch && ch.isAvailable();
}

export type { MessageChannel, VendorInviteMessage, ChannelDeliveryResult } from './types';
