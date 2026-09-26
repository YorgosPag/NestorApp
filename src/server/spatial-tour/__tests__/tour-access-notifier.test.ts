/**
 * ADR-884 §9.1 Α2 — το μήνυμα του αιτούντος ταξιδεύει ως **σώμα** της ειδοποίησης «νέο αίτημα θέασης»
 * (πρότυπο Google Drive «Request access»)· χωρίς μήνυμα ⇒ κανένα σώμα (όχι επανάληψη του τίτλου).
 *
 * Μετάλλαξη (2026-09-26): αφαίρεση του `body` από την αποστολή ⇒ το Ν1 κοκκινίζει.
 * Η διαφυγή HTML του σώματος είναι ευθύνη του αποδότη (`notification-email-render.test.ts`).
 */

import type { Firestore } from 'firebase-admin/firestore';

jest.mock('server-only', () => ({}));

const dispatchNotification = jest.fn(async () => undefined);
jest.mock('@/server/notifications/notification-orchestrator', () => ({
  dispatchNotification: (...args: unknown[]) => dispatchNotification(...(args as [])),
}));
jest.mock('@/lib/listings/listing-notice-title', () => ({
  listingNoticeTitle: async () => 'Διαμέρισμα Κυψέλη',
}));

import { announceTourAccessRequested, announceTourLinkOpened } from '../tour-access-notifier';

const companyProperty = { createdBy: 'boris', companyId: 'comp_1', name: 'Διαμέρισμα Κυψέλη' };
const db = {
  collection: () => ({ doc: () => ({ get: async () => ({ data: () => companyProperty }) }) }),
} as unknown as Firestore;

const base = {
  subject: { kind: 'property', id: 'prop_1' },
  requestId: 'tacr_1',
  requestCount: 1,
  requesterName: 'Μαρία Παπαδοπούλου',
} as const;

function sent(): Record<string, unknown> {
  expect(dispatchNotification).toHaveBeenCalledTimes(1);
  return (dispatchNotification.mock.calls[0] as unknown as [Record<string, unknown>])[0];
}

describe('announceTourAccessRequested — το μήνυμα του αιτούντος στο email', () => {
  beforeEach(() => dispatchNotification.mockClear());

  it('Ν1 — με μήνυμα ⇒ σώμα = το μήνυμα, αυτούσιο (η διαφυγή γίνεται στην απόδοση)', async () => {
    const message = 'Με ενδιαφέρει για αγορά <b>το Σάββατο</b>';
    await announceTourAccessRequested(db, { ...base, subject: { ...base.subject }, message });
    expect(sent()).toMatchObject({ recipientId: 'boris', body: message, titleParams: { who: 'Μαρία Παπαδοπούλου' } });
  });

  it('Ν2 — χωρίς μήνυμα ⇒ κανένα σώμα', async () => {
    await announceTourAccessRequested(db, { ...base, subject: { ...base.subject }, message: null });
    expect(sent()).not.toHaveProperty('body');
  });
});

/**
 * ADR-884 §9.1 Α3′ — «ο Χ άνοιξε την περιήγηση». Παραλήπτης = ο **αποστολέας** του συνδέσμου (όχι ο υπεύθυνος της
 * ρίζας)· χώρος + πόρτα = της θεματοφυλακής (ίδια με το «νέο αίτημα»)· ταυτότητα = σύνδεσμος + αύξων συσκευής.
 */
describe('announceTourLinkOpened — ειδοποίηση ανοίγματος προσωπικού συνδέσμου', () => {
  beforeEach(() => dispatchNotification.mockClear());

  const opened = { subject: { kind: 'property', id: 'prop_1' }, shareId: 'share_9', senderUid: 'eleni', who: 'Γιάννης Π.' } as const;

  it('Ο1 🔴 — πρώτο άνοιγμα ⇒ προς τον ΑΠΟΣΤΟΛΕΑ, κλειδί «firstTitle», ταυτότητα σύνδεσμος:1', async () => {
    await announceTourLinkOpened(db, { ...opened, subject: { ...opened.subject }, deviceOrdinal: 1 });
    expect(sent()).toMatchObject({
      eventType: 'properties.tourLinkOpened',
      recipientId: 'eleni',
      tenantId: 'comp_1',
      titleKey: 'tourLinkOpened.firstTitle',
      titleParams: { who: 'Γιάννης Π.', title: 'Διαμέρισμα Κυψέλη' },
      eventId: 'tour-link-open:share_9:1',
    });
  });

  it('Ο2 — νέα συσκευή ⇒ κλειδί «newDeviceTitle», ταυτότητα σύνδεσμος:2', async () => {
    await announceTourLinkOpened(db, { ...opened, subject: { ...opened.subject }, deviceOrdinal: 2 });
    expect(sent()).toMatchObject({ titleKey: 'tourLinkOpened.newDeviceTitle', eventId: 'tour-link-open:share_9:2' });
  });
});
