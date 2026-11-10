/**
 * Η υποβολή τιμολογίου (ADR-ACC-003 §22.10) — το id που φτάνει στη μετάβαση είναι το id του διακομιστή.
 *
 * 🔴 Ως 2026-11-10 η φόρμα διάβαζε `result.data?.id ?? result.id` ενώ ο route στέλνει `{ invoiceId }` ⇒ κάθε επιτυχής
 * δημιουργία κατέληγε στο `?view=undefined`.
 * ⚠️ Μεταλλάξεις που ΠΡΕΠΕΙ να κοκκινίζουν: επέστρεψε `(result as { id?: string }).id` ⇒ Κ1· πέτα `cause` αυτούσιο
 *    αντί για το μεταφρασμένο μήνυμα ⇒ Κ3.
 */

import { ApiClientError } from '@/lib/api/api-client-types';

const mockPost = jest.fn();
const mockPatch = jest.fn();
jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: {
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
}));

import { submitInvoice } from '../invoice-submit';

const t = { policy: (key: string) => key, accounting: (key: string) => key };

beforeEach(() => jest.clearAllMocks());

describe('submitInvoice', () => {
  it('Κ1 — δημιουργία: επιστρέφει το `invoiceId` της απάντησης, ποτέ undefined', async () => {
    mockPost.mockResolvedValue({ invoiceId: 'inv_9', number: 3, journalEntryId: null, creditWarning: null });
    await expect(submitInvoice({}, null, t)).resolves.toBe('inv_9');
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('Κ2 — ενημέρωση: PATCH στο υπάρχον και επιστρέφει το ίδιο id', async () => {
    mockPatch.mockResolvedValue(undefined);
    await expect(submitInvoice({}, 'inv_1', t)).resolves.toBe('inv_1');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('Κ3 — άρνηση διακομιστή: το μήνυμα του φακέλου, όχι το «HTTP 400»', async () => {
    mockPost.mockRejectedValue(
      new ApiClientError('Bad Request', 400, 'HTTP_400', undefined, 'req_1', undefined, { error: 'Άκυρη γραμμή' }),
    );
    await expect(submitInvoice({}, null, t)).rejects.toThrow('Άκυρη γραμμή');
  });

  it('Κ4 — σφάλμα που ΔΕΝ είναι άρνηση διακομιστή περνά αυτούσιο', async () => {
    const network = new TypeError('Failed to fetch');
    mockPost.mockRejectedValue(network);
    await expect(submitInvoice({}, null, t)).rejects.toBe(network);
  });
});
