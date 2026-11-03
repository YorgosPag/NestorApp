/**
 * Η ΜΙΑ μετατροπή εγγράφου → `Notification` (ADR-927 · ADR-892 §13).
 *
 * Το σφάλμα που φυλάει: η ζωντανή σύνδεση είχε δεύτερο, χειρόγραφο αντίγραφο της μετατροπής που ξεχνούσε το
 * `bodyKey` ⇒ κάθε ειδοποίηση που έφτανε ζωντανά έδειχνε το παγωμένο σώμα του παραγωγού.
 */

const mockSubscribe = jest.fn();
const mockGetAll = jest.fn();

jest.mock('@/lib/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'u' } } }));
jest.mock('@/services/firestore', () => ({
  firestoreQueryService: {
    subscribe: (...args: unknown[]) => mockSubscribe(...args),
    getAll: (...args: unknown[]) => mockGetAll(...args),
  },
}));
jest.mock('firebase/firestore', () => {
  const tag = (kind: string) => (...args: unknown[]) => ({ kind, args });
  return {
    collection: jest.fn(), query: jest.fn(), where: tag('where'), orderBy: tag('orderBy'), limit: tag('limit'),
    getDocs: jest.fn(), updateDoc: jest.fn(), doc: jest.fn(), deleteField: jest.fn(),
    documentId: () => '__name__', startAfter: tag('startAfter'),
    Timestamp: { fromMillis: (ms: number) => ({ ms }) },
  };
});

import { fetchNotificationsBefore, subscribeToNotifications } from '../notificationService';

const RAW = {
  id: 'n1', userId: 'u', tenantId: 't', createdAt: '2026-11-03T10:00:00.000Z', severity: 'info', title: 'Παγωμένο',
  body: 'Παγωμένο σώμα', titleKey: 'k.title', titleParams: {}, bodyKey: 'k.body', bodyParams: { who: 'Α' },
  delivery: { state: 'delivered', attempts: 1 }, source: { service: 's' }, meta: { eventType: 'crm.newLead' },
};

beforeEach(() => {
  mockSubscribe.mockReset();
  mockGetAll.mockReset();
});

describe('notificationService — μία μετατροπή', () => {
  it('η ζωντανή σύνδεση κρατά bodyKey/bodyParams και meta.eventType', () => {
    const onUpdate = jest.fn();
    mockSubscribe.mockImplementation((_c: string, listener: (r: { documents: unknown[] }) => void) => {
      listener({ documents: [RAW] });
      return () => undefined;
    });
    subscribeToNotifications('u', onUpdate);
    const [n] = onUpdate.mock.calls[0][0];
    expect(n).toMatchObject({ bodyKey: 'k.body', bodyParams: { who: 'Α' }, meta: { eventType: 'crm.newLead' } });
  });

  it('η παλαιότερη σελίδα ζητά (createdAt ↓, id ↓) μετά τον δρομέα-τιμή', async () => {
    mockGetAll.mockResolvedValue({ documents: [RAW] });
    const page = await fetchNotificationsBefore({ createdAt: '2026-11-03T10:00:00.000Z', id: 'n0' });
    const { constraints } = mockGetAll.mock.calls[0][1] as { constraints: { kind: string; args: unknown[] }[] };
    expect(constraints).toEqual([
      { kind: 'orderBy', args: ['createdAt', 'desc'] },
      { kind: 'orderBy', args: ['__name__', 'desc'] },
      { kind: 'startAfter', args: [{ ms: Date.parse('2026-11-03T10:00:00.000Z') }, 'n0'] },
    ]);
    expect(page[0].bodyKey).toBe('k.body');
  });

  it('άκυρη ημερομηνία στον δρομέα ⇒ καμία σελίδα, κανένα ερώτημα', async () => {
    await expect(fetchNotificationsBefore({ createdAt: 'not-a-date', id: 'n0' })).resolves.toEqual([]);
    expect(mockGetAll).not.toHaveBeenCalled();
  });
});
