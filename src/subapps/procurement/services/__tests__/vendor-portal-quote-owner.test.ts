/**
 * @jest-environment node
 *
 * @fileoverview **Μία πρόσκληση = μία απάντηση** (ADR-876 §5 Σ19).
 *
 * 🔴 Επαληθευμένο στον browser (emulator, 2026-09-24): δύο προσκλήσεις με χειροκίνητο email στο ΙΔΙΟ
 * RFQ έχουν `vendorContactId: ''`. Το ερώτημα `(rfqId, vendorContactId)` βρήκε την προσφορά του Α όταν
 * υπέβαλε ο Β ⇒ ο Β **έγραψε πάνω** της (1178 € → 620 €) και ο Α θα έβλεπε τις τιμές του Β.
 *
 * Ο1 με `quoteId` ⇒ ανάγνωση με ταυτότητα, **κανένα** ερώτημα ·
 * Ο2 φράχτης: ξένη εταιρεία ή άλλο RFQ ⇒ καμία ·
 * Ο3 χωρίς `quoteId` και χωρίς επαφή (`''`) ⇒ καμία — **ποτέ** ερώτημα με κενό κλειδί ·
 * Ο4 προ-Σ19 με πραγματική επαφή ⇒ το παλιό ερώτημα (⏳ Φ7).
 */

jest.mock('server-only', () => ({}));

const mockDocGet = jest.fn();
const mockQueryGet = jest.fn();
const mockWhere = jest.fn();
const query = { where: (...a: unknown[]) => (mockWhere(...a), query), limit: () => query, get: mockQueryGet };
const mockDb = { collection: () => ({ doc: () => ({ get: mockDocGet }), where: query.where }) };

jest.mock('@/lib/firebaseAdmin', () => ({
  safeFirestoreOperation: (fn: (db: unknown) => unknown) => fn(mockDb),
}));
jest.mock('firebase-admin', () => ({ firestore: { FieldValue: {} } }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('../quote-counters', () => ({ getNextQuoteNumber: jest.fn() }));
jest.mock('@/services/vendor-portal/admin-client-timestamp', () => ({
  adminTimestampAsClient: jest.fn(),
  adminTimestampFromDateAsClient: jest.fn(),
}));

import { findExistingPortalQuote, type PortalQuoteOwner } from '../vendor-portal-submit-service';

const owner = (over: Partial<PortalQuoteOwner> = {}): PortalQuoteOwner => ({
  companyId: 'co_1',
  rfqId: 'rfq_1',
  vendorContactId: '',
  quoteId: 'qt_A',
  ...over,
});
const doc = (data: Record<string, unknown> | undefined) => ({ id: 'qt_A', data: () => data });

beforeEach(() => jest.clearAllMocks());

describe('findExistingPortalQuote', () => {
  it('Ο1 — με quoteId: ανάγνωση με ταυτότητα, κανένα ερώτημα', async () => {
    mockDocGet.mockResolvedValue(doc({ companyId: 'co_1', rfqId: 'rfq_1', notes: 'A' }));
    expect(await findExistingPortalQuote(owner())).toMatchObject({ id: 'qt_A', data: { notes: 'A' } });
    expect(mockWhere).not.toHaveBeenCalled();
  });

  it.each([
    ['ξένης εταιρείας', { companyId: 'co_OTHER', rfqId: 'rfq_1' }],
    ['άλλου RFQ', { companyId: 'co_1', rfqId: 'rfq_OTHER' }],
    ['χωρίς companyId', { rfqId: 'rfq_1' }],
    ['που δεν υπάρχει', undefined],
  ])('Ο2 — προσφορά %s ⇒ null', async (_label, data) => {
    mockDocGet.mockResolvedValue(doc(data));
    expect(await findExistingPortalQuote(owner())).toBeNull();
  });

  it("Ο3 — χωρίς quoteId και με vendorContactId '' ⇒ null, ΚΑΝΕΝΑ ερώτημα (δύο προμηθευτές ≠ μία προσφορά)", async () => {
    expect(await findExistingPortalQuote(owner({ quoteId: undefined }))).toBeNull();
    expect(mockWhere).not.toHaveBeenCalled();
    expect(mockQueryGet).not.toHaveBeenCalled();
  });

  it('Ο4 — προ-Σ19 με πραγματική επαφή ⇒ το ερώτημα της επαφής (⏳ Φ7)', async () => {
    mockQueryGet.mockResolvedValue({ empty: false, docs: [doc({ companyId: 'co_1', rfqId: 'rfq_1' })] });
    expect(await findExistingPortalQuote(owner({ quoteId: null, vendorContactId: 'cont_1' }))).toMatchObject({ id: 'qt_A' });
    expect(mockWhere).toHaveBeenCalledWith('vendorContactId', '==', 'cont_1');
  });
});
