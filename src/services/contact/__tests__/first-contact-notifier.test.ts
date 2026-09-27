/**
 * ADR-843 §10.20 — **«κάποιος σε πλησίασε»**: ο προσφέρων μαθαίνει τη στιγμή της πράξης.
 *
 * Δύο σουίτες:
 * - **Ο αγωγός** (`announceFirstContactReceived`): ποιοι μαθαίνουν (ιδιώτης · διαχειριστές γραφείου, ποτέ ο ζητών),
 *   τι λέει (για ποιο — **ποτέ ποιος**), πού οδηγεί, ταυτότητα, και ότι **δεν πετά**.
 * - **Ο γραφέας** (`openFirstContact`): ειδοποιεί **μόνο** για πράξη που γεννήθηκε — το δεύτερο πάτημα (`unchanged`)
 *   και η άρνηση **σιωπούν**.
 *
 * Μεταλλάξεις (2026-09-27, όλες κόκκινες): (α) `disclosure.displayName` στα `titleParams` ⇒ Ε2 · (β) αφαίρεση του
 * φίλτρου `uid !== seekerUserId` ⇒ Ε4 · (γ) ειδοποίηση και σε `unchanged` ⇒ Γ2 · (δ) `throw` στο `catch` του
 * `notifyOne` ⇒ Ε5.
 */

import type { Firestore } from 'firebase-admin/firestore';

jest.mock('server-only', () => ({}));

const dispatchNotification = jest.fn(async (_input: Record<string, unknown>) => ({ success: true }));
jest.mock('@/server/notifications/notification-orchestrator', () => ({
  dispatchNotification: (input: Record<string, unknown>) => dispatchNotification(input),
}));
jest.mock('@/lib/listings/listing-notice-title', () => ({
  listingNoticeTitle: async () => 'Μονοκατοικία ισόγεια Σίβηρη',
}));
jest.mock('@/lib/workspace/workspace-catalog', () => ({
  readWorkspaceName: async () => 'Γραφείο Άλφα',
}));
const activeWorkspaceAdministrators = jest.fn(async (_db: unknown, _companyId: string) => ['admin-1', 'admin-2']);
jest.mock('@/lib/workspace/workspace-administrators', () => ({
  activeWorkspaceAdministrators: (db: unknown, companyId: string) => activeWorkspaceAdministrators(db, companyId),
}));

import { announceFirstContactReceived } from '../first-contact-notifier.service';
import type { FirstContact } from '@/types/first-contact';

const db = {} as Firestore;

const DISCLOSURE = {
  displayName: 'Γιώργος Παγώνης',
  email: 'giorgos@example.gr',
  phone: '6900000000',
  acceptsPlatformMessages: false,
} as const;

function contact(overrides: Partial<FirstContact> = {}): FirstContact {
  return {
    id: 'fcon_1',
    seekerUserId: 'seeker-1',
    target: { kind: 'listing', listingId: 'ownp_1' },
    offerer: { kind: 'personal', userId: 'owner-stavroula' },
    demandId: null,
    disclosure: DISCLOSURE,
    matchReason: null,
    lifecycle: 'open',
    createdAt: '2026-09-27T16:36:00.000Z',
    withdrawnAt: null,
    seenAt: null,
    ...overrides,
  };
}

const COMPANY_OFFICE: Partial<FirstContact> = {
  target: { kind: 'professional', agencyCompanyId: 'comp_alfa' },
  offerer: { kind: 'company', companyId: 'comp_alfa' },
};

function calls(): Record<string, unknown>[] {
  return dispatchNotification.mock.calls.map(([input]) => input);
}

describe('announceFirstContactReceived — ο προσφέρων μαθαίνει', () => {
  beforeEach(() => {
    dispatchNotification.mockClear();
    dispatchNotification.mockImplementation(async () => ({ success: true }));
    activeWorkspaceAdministrators.mockClear();
  });

  it('Ε1 — ιδιώτης: ο ίδιος, στον ιδιωτικό του χώρο, με σύνδεσμο στα εισερχόμενα και ταυτότητα = η πράξη', async () => {
    await expect(announceFirstContactReceived(db, contact())).resolves.toBe(1);
    expect(calls()).toHaveLength(1);
    expect(calls()[0]).toMatchObject({
      eventType: 'properties.firstContactReceived',
      recipientId: 'owner-stavroula',
      tenantId: 'owner-stavroula',
      titleKey: 'firstContactReceived.listingTitle',
      titleParams: { title: 'Μονοκατοικία ισόγεια Σίβηρη' },
      title: 'Νέο ενδιαφέρον για «Μονοκατοικία ισόγεια Σίβηρη»',
      bodyKey: 'firstContactReceived.body',
      eventId: 'first-contact:fcon_1:open',
      entityId: 'fcon_1',
      workspace: { kind: 'personal', userId: 'owner-stavroula' },
      actions: [expect.objectContaining({ url: '/first-contacts/inbox' })],
    });
    expect(activeWorkspaceAdministrators).not.toHaveBeenCalled();
  });

  it('Ε2 🔴 — ΚΑΝΕΝΑ στοιχείο του ζητούντος στο μήνυμα (αλλιώς το «Δεν το έχει δει ακόμα» γίνεται ψέμα)', async () => {
    await announceFirstContactReceived(db, contact());
    const payload = JSON.stringify(calls()[0]);
    for (const secret of [DISCLOSURE.displayName, DISCLOSURE.email, DISCLOSURE.phone, 'Γιώργος', 'seeker-1']) {
      expect(payload).not.toContain(secret);
    }
  });

  it('Ε3 — γραφείο: κάθε ενεργός διαχειριστής, μισθωτής = η εταιρεία, τίτλος με το όνομα του γραφείου', async () => {
    await expect(announceFirstContactReceived(db, contact(COMPANY_OFFICE))).resolves.toBe(2);
    expect(activeWorkspaceAdministrators).toHaveBeenCalledWith(db, 'comp_alfa');
    expect(calls().map((c) => c.recipientId)).toEqual(['admin-1', 'admin-2']);
    for (const call of calls()) {
      expect(call).toMatchObject({
        tenantId: 'comp_alfa',
        titleKey: 'firstContactReceived.officeTitle',
        titleParams: { office: 'Γραφείο Άλφα' },
        eventId: 'first-contact:fcon_1:open',
        workspace: { kind: 'personal', userId: call.recipientId },
      });
    }
  });

  it('Ε4 — ο ζητών δεν ειδοποιείται ποτέ για τη δική του πράξη, ακόμη κι αν είναι διαχειριστής', async () => {
    activeWorkspaceAdministrators.mockResolvedValueOnce(['seeker-1', 'admin-2']);
    await expect(announceFirstContactReceived(db, contact(COMPANY_OFFICE))).resolves.toBe(1);
    expect(calls().map((c) => c.recipientId)).toEqual(['admin-2']);
  });

  it('Ε5 — αποτυχία ενός παραλήπτη δεν σταματά τους άλλους και δεν πετά', async () => {
    dispatchNotification
      .mockImplementationOnce(async () => { throw new Error('smtp'); })
      .mockImplementationOnce(async () => ({ success: true }));
    await expect(announceFirstContactReceived(db, contact(COMPANY_OFFICE))).resolves.toBe(1);
    expect(calls()).toHaveLength(2);
  });

  it('Ε6 — βλάβη στην ανάγνωση παραληπτών ⇒ 0, χωρίς πέταγμα και χωρίς αποστολή', async () => {
    activeWorkspaceAdministrators.mockRejectedValueOnce(new Error('firestore down'));
    await expect(announceFirstContactReceived(db, contact(COMPANY_OFFICE))).resolves.toBe(0);
    expect(calls()).toHaveLength(0);
  });
});
