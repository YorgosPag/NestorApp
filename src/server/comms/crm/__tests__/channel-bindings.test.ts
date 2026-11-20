/**
 * =============================================================================
 * CRM CHANNEL BINDINGS TESTS
 * =============================================================================
 *
 * Locks the channel → provider → platform invariant. Before the registry each
 * adapter restated all three enums by hand, so an Instagram message could be
 * written with the Messenger provider and Firestore would persist it happily.
 * These tests fail if a future channel is wired up inconsistently.
 *
 * @enterprise No network required - pure function tests
 */

import {
  CRM_CHANNEL_BINDINGS,
  resolveChannelBinding,
  type CrmChannel,
} from '../channel-bindings';
import { COMMUNICATION_CHANNELS } from '@/types/communications';
import { IDENTITY_PROVIDER } from '@/types/conversations';
import { PLATFORMS } from '@/config/domain-constants';

describe('CRM channel bindings', () => {
  const channels = Object.keys(CRM_CHANNEL_BINDINGS) as CrmChannel[];

  it('covers exactly the channels routed through the shared store (3 Meta + the ADR-939 portal)', () => {
    expect(channels.sort()).toEqual(
      [
        COMMUNICATION_CHANNELS.WHATSAPP,
        COMMUNICATION_CHANNELS.MESSENGER,
        COMMUNICATION_CHANNELS.INSTAGRAM,
        COMMUNICATION_CHANNELS.PORTAL,
      ].sort()
    );
  });

  /**
   * The platform each channel is pinned to. The Meta channels share one string
   * across the three enums; the portal diverges intentionally (ADR-939): the
   * provider is the shared link, the platform is the web.
   */
  const EXPECTED_PLATFORM: Readonly<Record<CrmChannel, string>> = {
    [COMMUNICATION_CHANNELS.WHATSAPP]: PLATFORMS.WHATSAPP,
    [COMMUNICATION_CHANNELS.MESSENGER]: PLATFORMS.MESSENGER,
    [COMMUNICATION_CHANNELS.INSTAGRAM]: PLATFORMS.INSTAGRAM,
    [COMMUNICATION_CHANNELS.PORTAL]: PLATFORMS.WEB,
  };

  it.each(channels)('binds %s to a provider of the same name and its declared platform', (channel) => {
    const { provider, platform } = resolveChannelBinding(channel);

    expect(provider).toBe(channel);
    expect(platform).toBe(EXPECTED_PLATFORM[channel]);
  });

  it('resolves each channel to its canonical provider', () => {
    expect(resolveChannelBinding(COMMUNICATION_CHANNELS.WHATSAPP).provider)
      .toBe(IDENTITY_PROVIDER.WHATSAPP);
    expect(resolveChannelBinding(COMMUNICATION_CHANNELS.MESSENGER).provider)
      .toBe(IDENTITY_PROVIDER.MESSENGER);
    expect(resolveChannelBinding(COMMUNICATION_CHANNELS.INSTAGRAM).provider)
      .toBe(IDENTITY_PROVIDER.INSTAGRAM);
    expect(resolveChannelBinding(COMMUNICATION_CHANNELS.PORTAL).provider)
      .toBe(IDENTITY_PROVIDER.PORTAL);
  });

  it('resolves each channel to its canonical platform', () => {
    expect(resolveChannelBinding(COMMUNICATION_CHANNELS.WHATSAPP).platform)
      .toBe(PLATFORMS.WHATSAPP);
    expect(resolveChannelBinding(COMMUNICATION_CHANNELS.MESSENGER).platform)
      .toBe(PLATFORMS.MESSENGER);
    expect(resolveChannelBinding(COMMUNICATION_CHANNELS.INSTAGRAM).platform)
      .toBe(PLATFORMS.INSTAGRAM);
    expect(resolveChannelBinding(COMMUNICATION_CHANNELS.PORTAL).platform)
      .toBe(PLATFORMS.WEB);
  });

  it('never maps two channels onto the same provider', () => {
    const providers = channels.map((c) => resolveChannelBinding(c).provider);
    expect(new Set(providers).size).toBe(providers.length);
  });
});
