// src/types/__tests__/communications.test.ts

import {
  COMMUNICATION_CHANNELS,
  getImplementedChannels,
  getUnimplementedChannels,
  isChannelImplemented,
} from '@/types/communications';

describe('communications channel hardening', () => {
  it('getImplementedChannels() returns canonical implemented channels (SSoT)', () => {
    expect(getImplementedChannels()).toEqual([
      COMMUNICATION_CHANNELS.EMAIL,
      COMMUNICATION_CHANNELS.TELEGRAM,
      COMMUNICATION_CHANNELS.WHATSAPP,
      COMMUNICATION_CHANNELS.MESSENGER,
      COMMUNICATION_CHANNELS.INSTAGRAM,
    ]);
  });

  it('isChannelImplemented() is true only for implemented channels', () => {
    expect(isChannelImplemented(COMMUNICATION_CHANNELS.EMAIL)).toBe(true);
    expect(isChannelImplemented(COMMUNICATION_CHANNELS.TELEGRAM)).toBe(true);
    expect(isChannelImplemented(COMMUNICATION_CHANNELS.WHATSAPP)).toBe(true);
    expect(isChannelImplemented(COMMUNICATION_CHANNELS.MESSENGER)).toBe(true);
    expect(isChannelImplemented(COMMUNICATION_CHANNELS.INSTAGRAM)).toBe(true);

    expect(isChannelImplemented(COMMUNICATION_CHANNELS.SMS)).toBe(false);
  });

  it('getUnimplementedChannels() includes all declared-but-not-implemented channels', () => {
    const unimplemented = getUnimplementedChannels();

    expect(unimplemented).toEqual(
      expect.arrayContaining([
        COMMUNICATION_CHANNELS.SMS,
      ])
    );

    expect(unimplemented).toEqual(
      expect.not.arrayContaining([
        COMMUNICATION_CHANNELS.EMAIL,
        COMMUNICATION_CHANNELS.TELEGRAM,
        COMMUNICATION_CHANNELS.WHATSAPP,
        COMMUNICATION_CHANNELS.MESSENGER,
        COMMUNICATION_CHANNELS.INSTAGRAM,
      ])
    );
  });
});
