/**
 * @jest-environment node
 *
 * Άγκυρα — **ΤΑ ΓΕΓΟΝΟΤΑ ΤΟΥ ΦΑΚΕΛΟΥ ΣΤΗΝ ΟΥΡΑ** (ADR-848 · ADR-849)
 *
 * Το σκέλος email γράφει στην ουρά **γεγονότα** (`recipientId` · `eventType` ·
 * `notificationId`), ποτέ URL — και **κανένα `undefined`**: η Firestore απορρίπτει
 * ολόκληρη την εγγραφή για ένα.
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

import { NOTIFICATION_EVENT_TYPES, type NotificationEventType } from '@/config/notification-events';
import { queueNotificationEmail } from '@/server/notifications/notification-email-leg';
import {
  getDefaultNotificationSettings,
  type UserNotificationSettings,
} from '@/services/user-notification-settings/user-notification-settings.types';

const LISTING_MATCH = NOTIFICATION_EVENT_TYPES.PROPERTIES_DEMAND_LISTING_MATCH;
const MANDATE_DECIDED = NOTIFICATION_EVENT_TYPES.PROPERTIES_MANDATE_DECIDED;

function settings(): UserNotificationSettings {
  return { ...getDefaultNotificationSettings('u1'), emailEnabled: true, emailFrequency: 'realtime' };
}

/** «Όχι email για ταιριάσματα αγγελιών» — ο κύριος διακόπτης μένει ανοιχτός. */
function listingMatchEmailsOff(): UserNotificationSettings {
  const base = settings();
  return { ...base, emailCategories: { ...base.emailCategories, properties: { demandListingMatch: 'off' } } };
}

function request(
  extra: { notificationId?: string; eventType?: NotificationEventType; settings?: UserNotificationSettings } = {},
) {
  return {
    recipientId: 'u1',
    eventType: LISTING_MATCH,
    settings: settings(),
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
  it('Α1 🔑 — με προορισμό: recipientId + eventType + notificationId', async () => {
    await queueNotificationEmail(request({ notificationId: 'listing_match:u1:l1' }));
    expect(queuedEmailFacts()).toEqual({
      recipientId: 'u1',
      eventType: LISTING_MATCH,
      notificationId: 'listing_match:u1:l1',
    });
  });

  it('Α2 🔴 — χωρίς προορισμό: ΚΑΝΕΝΑ κλειδί notificationId (ούτε undefined)', async () => {
    await queueNotificationEmail(request());
    const facts = queuedEmailFacts();
    expect(facts).toEqual({ recipientId: 'u1', eventType: LISTING_MATCH });
    expect('notificationId' in facts).toBe(false);
  });

  it('Α3 — κανένα URL δεν σφραγίζεται στην ουρά (χτίζεται τη στιγμή της αποστολής)', async () => {
    await queueNotificationEmail(request({ notificationId: 'listing_match:u1:l1' }));
    expect(JSON.stringify(mockEnqueue.mock.calls.at(-1)?.[0])).not.toContain('https://');
  });
});

describe('📧 Τ — ADR-849: «όχι email για ταιριάσματα, ναι για εντολές»', () => {
  it('Τ1 🔴 — σιγασμένος τύπος ⇒ ΚΑΜΙΑ εγγραφή στην ουρά, με τον λόγο', async () => {
    const outcome = await queueNotificationEmail(request({ settings: listingMatchEmailsOff() }));
    expect(outcome).toEqual({ kind: 'suppressed', reason: 'type-email-disabled' });
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('Τ2 🔑 — ο ΑΛΛΟΣ τύπος του ίδιου ανθρώπου φεύγει κανονικά', async () => {
    const outcome = await queueNotificationEmail(
      request({ settings: listingMatchEmailsOff(), eventType: MANDATE_DECIDED }),
    );
    expect(outcome.kind).toBe('queued');
    expect(queuedEmailFacts().eventType).toBe(MANDATE_DECIDED);
  });
});
