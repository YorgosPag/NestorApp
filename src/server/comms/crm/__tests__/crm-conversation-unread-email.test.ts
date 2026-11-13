/**
 * @jest-environment node
 *
 * Άγκυρα — **«ΙΣΧΥΕΙ ΑΚΟΜΗ;»** για το email «ο πελάτης σού έγραψε» (ADR-939 §6.1 βήμα 6Β · ADR-849 §6ε).
 * Ο κριτής φεύγει **μόνο** αν το μήνυμα είναι ακόμη το τελευταίο της συνομιλίας **και** η ειδοποίηση δεν διαβάστηκε —
 * και το «διαβάστηκε» έχει **δύο** σχήματα που γράφονται σήμερα (`seen: true` · `delivery.state`).
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: jest.fn() }));

const mockReadMessagesPage = jest.fn();
jest.mock('@/app/api/conversations/[conversationId]/messages/conversation-messages-page', () => ({
  readMessagesPage: (spec: unknown) => mockReadMessagesPage(spec),
}));

import type { Firestore } from 'firebase-admin/firestore';

import {
  crmConversationUnreadStillPending,
  isCrmUnreadStillPending,
} from '@/server/comms/crm/crm-conversation-unread-email';
import { notificationWasSeen } from '@/server/notifications/notification-read';

describe('Κ — ο καθαρός κριτής', () => {
  it('Κ1 — τελευταίο και αδιάβαστο ⇒ ισχύει', () => {
    expect(isCrmUnreadStillPending({ latestMessageId: 'm1', notificationSeen: false }, 'm1')).toBe(true);
  });

  it('Κ2 🔴 — απάντηση ή νεότερο μήνυμα (άλλο τελευταίο) ⇒ δεν ισχύει', () => {
    expect(isCrmUnreadStillPending({ latestMessageId: 'm2', notificationSeen: false }, 'm1')).toBe(false);
  });

  it('Κ3 🔴 — ο παραλήπτης είδε την ειδοποίηση ⇒ δεν ισχύει', () => {
    expect(isCrmUnreadStillPending({ latestMessageId: 'm1', notificationSeen: true }, 'm1')).toBe(false);
  });

  it('Κ4 — άδεια συνομιλία (σβήστηκε) ⇒ δεν ισχύει', () => {
    expect(isCrmUnreadStillPending({ latestMessageId: null, notificationSeen: false }, 'm1')).toBe(false);
  });
});

describe('Δ — «διαβάστηκε»: δύο σχήματα, ένας αναγνώστης', () => {
  it.each([
    [{ seen: true }, true],
    [{ delivery: { state: 'seen' } }, true],
    [{ delivery: { state: 'acted' } }, true],
    [{ delivery: { state: 'dismissed' } }, true],
    [{ delivery: { state: 'withdrawn' } }, true],
    [{ delivery: { state: 'delivered' } }, false],
    [{ seen: 'true' }, false],
    [{}, false],
    [undefined, false],
  ])('Δ — %j ⇒ %s', (raw, expected) => {
    expect(notificationWasSeen(raw)).toBe(expected);
  });
});

describe('Φ — ο φορτωτής: σταθερές αναγνώσεις, κλειδιά για την πύλη', () => {
  const docs: Record<string, unknown> = { ntf_seen: { delivery: { state: 'seen' } }, ntf_new: { delivery: { state: 'delivered' } } };
  const getAll = jest.fn(async (...refs: Array<{ id: string }>) =>
    refs.map(({ id }) => ({ id, data: () => docs[id] })));
  const db = {
    collection: () => ({ doc: (id: string) => ({ id }) }),
    getAll,
  } as unknown as Firestore;

  beforeEach(() => {
    getAll.mockClear();
    mockReadMessagesPage.mockReset();
    mockReadMessagesPage.mockImplementation(async ({ conversationId }: { conversationId: string }) => ({
      messages: [{ id: conversationId === 'conv_a' ? 'm_last' : 'm_other' }],
    }));
  });

  it('Φ1 🔑 — μόνο το τελευταίο ΚΑΙ αδιάβαστο περνά', async () => {
    const pending = await crmConversationUnreadStillPending(db, [
      { conversationId: 'conv_a', messageId: 'm_last', notificationId: 'ntf_new' },
      { conversationId: 'conv_a', messageId: 'm_old', notificationId: 'ntf_new' },
      { conversationId: 'conv_a', messageId: 'm_last', notificationId: 'ntf_seen' },
      { conversationId: 'conv_b', messageId: 'm_last' },
    ]);
    expect([...pending]).toEqual(['conv_a:m_last:ntf_new']);
  });

  it('Φ2 — μία ανάγνωση ανά ΔΙΑΦΟΡΕΤΙΚΗ συνομιλία, πάντα το πιο πρόσφατο', async () => {
    await crmConversationUnreadStillPending(db, [
      { conversationId: 'conv_a', messageId: 'm1' },
      { conversationId: 'conv_a', messageId: 'm2' },
    ]);
    expect(mockReadMessagesPage).toHaveBeenCalledTimes(1);
    expect(mockReadMessagesPage).toHaveBeenCalledWith({ conversationId: 'conv_a', page: 1, pageSize: 1, order: 'desc' });
    expect(getAll).not.toHaveBeenCalled();
  });

  it('Φ3 — κενή είσοδος ⇒ καμία ανάγνωση', async () => {
    expect((await crmConversationUnreadStillPending(db, [])).size).toBe(0);
    expect(mockReadMessagesPage).not.toHaveBeenCalled();
  });

  it('Φ4 🔴 — αποτυχία ανάγνωσης ⇒ ΡΙΧΝΕΙ', async () => {
    mockReadMessagesPage.mockRejectedValue(new Error('firestore down'));
    await expect(crmConversationUnreadStillPending(db, [{ conversationId: 'conv_a', messageId: 'm1' }]))
      .rejects.toThrow('firestore down');
  });
});
