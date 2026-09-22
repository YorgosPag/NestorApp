/**
 * ADR-867 §4.5 (Β10) — ο πίνακας αληθείας του **ενός** ορισμού «μετρά στο badge».
 *
 *   Λ-1  ζωντανή ∧ όχι σίγαση ∧ ζωντανό αδιάβαστο ⇒ μετρά — κάθε άλλος συνδυασμός ⇒ όχι
 *   Λ-2  η ετυμηγορία κουβαλά την ώρα του ΖΩΝΤΑΝΟΥ μηνύματος (όχι του τελευταίου που κινήθηκε)
 *   Λ-3  νήμα προ-Ε10 (χωρίς `lastLiveMessageAt`) ⇒ `lastMessageAt`
 */

import { inboxVerdictsOf, seatCountsAsUnread } from '@/lib/network-messaging/thread-liveness';

const LIVE = '2026-09-22T10:00:00.000Z';
const EARLIER = '2026-09-22T09:00:00.000Z';
const LATER = '2026-09-22T11:00:00.000Z';
const THREAD = { lastMessageAt: LATER, lastLiveMessageAt: LIVE };

describe('Λ — ποια θέση μετρά ως αδιάβαστη', () => {
  it.each([
    // until,     muted, lastReadAt, μετρά
    [null,        false, null,       true],
    [null,        false, EARLIER,    true],
    [null,        false, LIVE,       false],
    [null,        false, LATER,      false],
    [null,        true,  null,       false],
    [EARLIER,     false, null,       false],
    [EARLIER,     true,  EARLIER,    false],
  ] as const)('Λ-1 until=%s muted=%s lastReadAt=%s ⇒ %s', (until, muted, lastReadAt, expected) => {
    expect(seatCountsAsUnread({ until, muted, lastReadAt }, THREAD)).toBe(expected);
  });

  it('Λ-1β νήμα χωρίς ζωντανό μήνυμα ⇒ κανείς δεν μετρά', () => {
    expect(seatCountsAsUnread({ until: null, muted: false, lastReadAt: null }, { lastMessageAt: LATER, lastLiveMessageAt: null }))
      .toBe(false);
  });

  it('Λ-2 η ετυμηγορία κουβαλά την ώρα του ΖΩΝΤΑΝΟΥ μηνύματος', () => {
    expect(inboxVerdictsOf(
      [
        { uid: 'a', until: null, muted: false, lastReadAt: null },
        { uid: 'b', until: null, muted: true, lastReadAt: null },
      ],
      THREAD,
    )).toStrictEqual([{ uid: 'a', liveMessageAt: LIVE }, { uid: 'b', liveMessageAt: null }]);
  });

  it('Λ-3 νήμα προ-Ε10 (χωρίς `lastLiveMessageAt`) ⇒ το `lastMessageAt`', () => {
    expect(inboxVerdictsOf([{ uid: 'a', until: null, muted: false, lastReadAt: null }], { lastMessageAt: LIVE }))
      .toStrictEqual([{ uid: 'a', liveMessageAt: LIVE }]);
  });
});
