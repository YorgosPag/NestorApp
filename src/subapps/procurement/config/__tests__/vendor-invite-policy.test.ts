/**
 * ADR-327 §7.5 (Ε1β) — η λήξη της πρόσκλησης είναι πάντα ημερομηνία, ως το τέλος της ημέρας στην ώρα του φορέα.
 */

import { endOfCalendarDay } from '@/constants/platform-operator';
import {
  VENDOR_INVITE_NOTE_MAX_LENGTH,
  initialInviteExpiryDay,
  inviteExpiryBounds,
  judgeInviteExpiryDay,
  presetExpiryDay,
} from '../vendor-invite-policy';
import { MAX_PERSONAL_MESSAGE_LENGTH } from '@/config/personal-message-policy';

// 2026-11-06 12:00 ώρα Αθήνας.
const NOW = new Date('2026-11-06T10:00:00.000Z');

describe('judgeInviteExpiryDay', () => {
  it('a day 1…90 ahead ⇒ the END of that day in the operator zone', () => {
    expect(judgeInviteExpiryDay('2026-11-07', NOW)).toEqual({ kind: 'ok', expiresAtMs: endOfCalendarDay('2026-11-07').getTime() });
    expect(judgeInviteExpiryDay('2027-02-04', NOW).kind).toBe('ok');
  });

  it('today or the past is too soon; beyond 90 days too far', () => {
    expect(judgeInviteExpiryDay('2026-11-06', NOW).kind).toBe('too_soon');
    expect(judgeInviteExpiryDay('2026-10-01', NOW).kind).toBe('too_soon');
    expect(judgeInviteExpiryDay('2027-02-05', NOW).kind).toBe('too_far');
  });

  it('anything that is not a real calendar day is invalid', () => {
    for (const bad of ['2026-02-30', '06/11/2026', '', null, 7]) expect(judgeInviteExpiryDay(bad, NOW).kind).toBe('invalid');
  });
});

describe('presets and bounds', () => {
  it('a preset is a day counted from today', () => {
    expect(presetExpiryDay(5, NOW)).toBe('2026-11-11');
    expect(inviteExpiryBounds(NOW)).toEqual({ today: '2026-11-06', first: '2026-11-07', last: '2027-02-04' });
  });

  it('today follows the operator zone, not UTC (23:30 UTC on the 6th is already the 7th in Athens)', () => {
    expect(inviteExpiryBounds(new Date('2026-11-06T23:30:00.000Z')).today).toBe('2026-11-07');
  });
});

describe('initialInviteExpiryDay', () => {
  it('the RFQ deadline wins when it is within bounds', () => {
    expect(initialInviteExpiryDay(Date.parse('2026-11-20T10:00:00.000Z'), NOW)).toBe('2026-11-20');
  });

  it('no deadline, or one outside bounds ⇒ the default preset', () => {
    expect(initialInviteExpiryDay(null, NOW)).toBe('2026-11-11');
    expect(initialInviteExpiryDay(Date.parse('2026-11-01T10:00:00.000Z'), NOW)).toBe('2026-11-11');
    expect(initialInviteExpiryDay(Date.parse('2027-06-01T10:00:00.000Z'), NOW)).toBe('2026-11-11');
  });
});

it('the note limit is the ONE personal-message limit', () => {
  expect(VENDOR_INVITE_NOTE_MAX_LENGTH).toBe(MAX_PERSONAL_MESSAGE_LENGTH);
});
