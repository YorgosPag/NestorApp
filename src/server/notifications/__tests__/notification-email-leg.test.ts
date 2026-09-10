/**
 * @jest-environment node
 *
 * Άγκυρα — **ΤΑ ΓΕΓΟΝΟΤΑ ΤΟΥ ΦΑΚΕΛΟΥ ΣΤΗΝ ΟΥΡΑ** (ADR-848)
 *
 * Το σκέλος email γράφει στην ουρά **γεγονότα** (`recipientId` · `notificationId`), ποτέ
 * URL — και **κανένα `undefined`**: η Firestore απορρίπτει ολόκληρη την εγγραφή για ένα.
 */

jest.mock('server-only', () => ({}));

const mockEnqueue = jest.fn();
jest.mock('@/server/comms/orchestrator', () => ({
  COMMUNICATION_CHANNELS: { EMAIL: 'email' },
  MESSAGE_CATEGORIES: { NOTIFICATION: 'notification' },
  enqueueMessage: (...args: unknown[]) => mockEnqueue(...args),
}));

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: () => ({
      doc: () => ({ get: async () => ({ exists: true, data: () => ({ email: 'owner@example.com' }) }) }),
    }),
  }),
}));

import { queueNotificationEmail } from '@/server/notifications/notification-email-leg';
import { getDefaultNotificationSettings } from '@/services/user-notification-settings/user-notification-settings.types';

function request(extra: { notificationId?: string } = {}) {
  return {
    recipientId: 'u1',
    settings: { ...getDefaultNotificationSettings('u1'), emailEnabled: true, emailFrequency: 'realtime' as const },
    isMandatory: false,
    subject: 'Νέα αγγελία ταιριάζει στη ζήτησή σας',
    content: '',
    dedupeKey: 'listing_match:u1:l1',
    now: new Date('2026-09-10T10:00:00Z'),
    ...extra,
  };
}

/** Το `metadata.email` της τελευταίας εγγραφής στην ουρά. */
function queuedEmailFacts(): Record<string, unknown> {
  const params: unknown = mockEnqueue.mock.calls.at(-1)?.[0];
  const email: unknown =
    typeof params === 'object' && params !== null ? Reflect.get(Reflect.get(params, 'metadata') ?? {}, 'email') : null;
  if (typeof email !== 'object' || email === null) {
    throw new Error('Δεν γράφτηκε metadata.email — η άγκυρα δεν κοίταξε τίποτα.');
  }
  return { ...email };
}

beforeEach(() => {
  mockEnqueue.mockReset().mockResolvedValue({ success: true, messageIds: ['m1'] });
});

describe('queueNotificationEmail — γεγονότα, όχι URL', () => {
  it('Α1 🔑 — με προορισμό: recipientId + notificationId', async () => {
    await queueNotificationEmail(request({ notificationId: 'listing_match:u1:l1' }));
    expect(queuedEmailFacts()).toEqual({ recipientId: 'u1', notificationId: 'listing_match:u1:l1' });
  });

  it('Α2 🔴 — χωρίς προορισμό: ΚΑΝΕΝΑ κλειδί notificationId (ούτε undefined)', async () => {
    await queueNotificationEmail(request());
    const facts = queuedEmailFacts();
    expect(facts).toEqual({ recipientId: 'u1' });
    expect('notificationId' in facts).toBe(false);
  });

  it('Α3 — κανένα URL δεν σφραγίζεται στην ουρά (χτίζεται τη στιγμή της αποστολής)', async () => {
    await queueNotificationEmail(request({ notificationId: 'listing_match:u1:l1' }));
    expect(JSON.stringify(mockEnqueue.mock.calls.at(-1)?.[0])).not.toContain('https://');
  });
});
