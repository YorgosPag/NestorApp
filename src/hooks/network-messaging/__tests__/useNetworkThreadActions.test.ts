/**
 * @fileoverview Άγκυρα της αισιόδοξης αποστολής (ADR-867 Β7 · ADR-872 ζωντανή επαλήθευση) — Α-1.
 *
 * 🔴 **Το περιστατικό (2026-09-22, ζωντανά)**: χαμένη πρώτη απάντηση ⇒ επανάληψη με το ίδιο
 * `Idempotency-Key` ⇒ **ένα** μήνυμα στη βάση, **δύο** φούσκες στην οθόνη. Το snapshot έφερε το μήνυμα
 * **πριν** την απάντηση με το `messageId`· ο έλεγχος «έφτασε;» ζούσε σε effect που ξυπνούσε **μόνο** με το
 * snapshot, άρα δεν ξανάτρεξε ποτέ. Η σειρά αυτή δεν χρειάζεται επανάληψη — αρκεί listener ταχύτερος
 * από το δίκτυο.
 */

import { act, renderHook } from '@testing-library/react';

import type { NetworkMessage } from '@/types/network-thread';

import { useNetworkThreadActions } from '../useNetworkThreadActions';

let resolveSend: (value: { ok: true; value: { messageId: string } }) => void = () => undefined;

jest.mock('@/services/network-messaging/network-thread.client', () => ({
  networkThreadClient: {
    send: jest.fn(() => new Promise((resolve) => { resolveSend = resolve; })),
    markRead: jest.fn(() => Promise.resolve({ ok: true, value: null })),
    retract: jest.fn(),
    edit: jest.fn(),
  },
}));

const THREAD = 'nthr_test';
const ME = 'uid_me';

function arrived(id: string): NetworkMessage {
  return {
    id,
    senderUid: ME,
    text: 'γεια',
    createdAt: '2026-09-22T07:33:00.000Z',
    editedAt: null,
    retractedAt: null,
    readBeforeRetraction: null,
    readBeforeEdit: null,
  };
}

describe('useNetworkThreadActions — εκκρεμής φούσκα απέναντι στο snapshot', () => {
  it('🔴 Α-1 το snapshot φτάνει ΠΡΙΝ την απάντηση ⇒ η φούσκα σβήνει μόλις έρθει το id (μετάλλαξη: ορατότητα μόνο από effect του snapshot)', async () => {
    const { result, rerender } = renderHook(
      ({ messages }: { messages: readonly NetworkMessage[] }) => useNetworkThreadActions(THREAD, ME, messages, null),
      { initialProps: { messages: [] as readonly NetworkMessage[] } },
    );

    act(() => result.current.send('γεια'));
    expect(result.current.pending).toHaveLength(1);

    rerender({ messages: [arrived('nmsg_1')] });
    expect(result.current.pending).toHaveLength(1);

    await act(async () => {
      resolveSend({ ok: true, value: { messageId: 'nmsg_1' } });
    });
    expect(result.current.pending).toHaveLength(0);
  });
});
