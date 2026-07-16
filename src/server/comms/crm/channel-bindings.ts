/**
 * =============================================================================
 * CRM CHANNEL BINDINGS — SSoT FOR channel → provider → platform
 * =============================================================================
 *
 * `channel`, `provider` and `platform` are three parallel enums that must
 * always agree (Instagram messages carry the Instagram provider and the
 * Instagram platform). Before this registry each adapter restated all three
 * by hand, so nothing prevented an Instagram message from being written with
 * the Messenger provider — a defect Firestore would happily persist.
 *
 * Callers now pass only `channel`; provider and platform are derived. Adding a
 * channel to `CRM_CHANNEL_BINDINGS` is the single edit needed to onboard it.
 *
 * @module server/comms/crm/channel-bindings
 * @enterprise ADR-174 - Meta Omnichannel Integration (conversation model SSoT)
 */

import { PLATFORMS, type Platform } from '@/config/domain-constants';
import { COMMUNICATION_CHANNELS } from '@/types/communications';
import { IDENTITY_PROVIDER, type IdentityProvider } from '@/types/conversations';

/**
 * Channels persisted through `storeChannelMessage`.
 *
 * Telegram is deliberately absent: it still writes through
 * `webhooks/telegram/crm/store.ts`, which uses the lazy Firestore-helpers
 * access layer rather than firebase-admin directly. Migrating it is tracked
 * separately — see `.claude-rules/pending-ratchet-work.md`.
 */
export type CrmChannel =
  | typeof COMMUNICATION_CHANNELS.WHATSAPP
  | typeof COMMUNICATION_CHANNELS.MESSENGER
  | typeof COMMUNICATION_CHANNELS.INSTAGRAM;

export interface ChannelBinding {
  provider: IdentityProvider;
  platform: Platform;
}

/** channel → its provider + platform. The only place these are paired. */
export const CRM_CHANNEL_BINDINGS: Readonly<Record<CrmChannel, ChannelBinding>> = {
  [COMMUNICATION_CHANNELS.WHATSAPP]: {
    provider: IDENTITY_PROVIDER.WHATSAPP,
    platform: PLATFORMS.WHATSAPP,
  },
  [COMMUNICATION_CHANNELS.MESSENGER]: {
    provider: IDENTITY_PROVIDER.MESSENGER,
    platform: PLATFORMS.MESSENGER,
  },
  [COMMUNICATION_CHANNELS.INSTAGRAM]: {
    provider: IDENTITY_PROVIDER.INSTAGRAM,
    platform: PLATFORMS.INSTAGRAM,
  },
} as const;

/** Resolve the provider + platform that belong to a channel. */
export function resolveChannelBinding(channel: CrmChannel): ChannelBinding {
  return CRM_CHANNEL_BINDINGS[channel];
}
