/**
 * @jest-environment node
 *
 * `readAccountingListPage` — η σελίδα οθόνης της λογιστικής (ADR-ACC-010 §2.1.1 Φάση 3β).
 *
 * Τρεις υποσχέσεις: (α) συνδυασμός φίλτρων εκτός συνόλου και (β) χαλασμένος / ξένος δρομέας κρίνονται ΠΡΙΝ από τη
 * βάση — είναι αρνήσεις του πελάτη, όχι βλάβη της· (γ) σφάλμα της βάσης ΑΝΕΒΑΙΝΕΙ, ποτέ «κενή λίστα».
 */

import { InvalidPageTokenError, encodeKeysetCursor } from '@/lib/admin-keyset-page';
import { safeFirestoreOperation } from '@/lib/firebaseAdmin';

import { INVOICE_LIST, JOURNAL_LIST } from '../accounting-list-specs';
import { UnsupportedListFilterError, readAccountingListPage } from '../accounting-repo-list';

jest.mock('@/lib/firebaseAdmin', () => ({ safeFirestoreOperation: jest.fn() }));
jest.mock('firebase-admin/firestore', () => ({ FieldPath: { documentId: () => '__name__' } }));

const mockedOperation = safeFirestoreOperation as jest.MockedFunction<typeof safeFirestoreOperation>;
const TENANT = { companyId: 'comp_a', userId: 'u_1' };
const identity = (data: unknown) => data;

beforeEach(() => mockedOperation.mockReset());

describe('readAccountingListPage', () => {
  it('Σ-1 συνδυασμός φίλτρων εκτός συνόλου ⇒ UnsupportedListFilterError, χωρίς ανάγνωση', async () => {
    await expect(readAccountingListPage(TENANT, INVOICE_LIST, { type: 'sales_invoice' }, { pageSize: 50, cursor: null }, identity))
      .rejects.toBeInstanceOf(UnsupportedListFilterError);
    expect(mockedOperation).not.toHaveBeenCalled();
  });

  it('Σ-2 δρομέας άλλων φίλτρων ⇒ InvalidPageTokenError, χωρίς ανάγνωση', async () => {
    const foreign = encodeKeysetCursor({ value: '2026-01-01', id: 'e1' }, JOURNAL_LIST.order, { fiscalYear: 2025 });
    await expect(readAccountingListPage(TENANT, JOURNAL_LIST, { fiscalYear: 2026 }, { pageSize: 50, cursor: foreign }, identity))
      .rejects.toBeInstanceOf(InvalidPageTokenError);
    expect(mockedOperation).not.toHaveBeenCalled();
  });

  it('Σ-3 σφάλμα της βάσης (π.χ. δείκτης που λείπει) ανεβαίνει — ποτέ «κενή λίστα»', async () => {
    mockedOperation.mockRejectedValue(new Error('FAILED_PRECONDITION: The query requires an index'));
    await expect(readAccountingListPage(TENANT, JOURNAL_LIST, { fiscalYear: 2026 }, { pageSize: 50, cursor: null }, identity))
      .rejects.toThrow(/FAILED_PRECONDITION/);
    // Χωρίς fallback: το δεύτερο όρισμα (fallback) δεν δίνεται ποτέ.
    expect(mockedOperation).toHaveBeenCalledWith(expect.any(Function));
    expect(mockedOperation.mock.calls[0]).toHaveLength(1);
  });

  it('Σ-4 κενή συμβολοσειρά φίλτρου = απόν φίλτρο (η σελίδα «όλα» δεν γίνεται «where = ``»)', async () => {
    mockedOperation.mockResolvedValue({ items: [], hasNext: false, nextCursor: null, pageSize: 50 });
    await expect(readAccountingListPage(TENANT, JOURNAL_LIST, { contactId: '' }, { pageSize: 50, cursor: null }, identity))
      .resolves.toEqual({ items: [], hasNext: false, nextCursor: null, pageSize: 50 });
  });
});
