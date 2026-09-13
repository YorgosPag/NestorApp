/**
 * =============================================================================
 * ADR-787 Φ.Β / Κ1α — Η ΑΝΤΙΘΕΤΗ ΣΗΜΑΣΙΟΛΟΓΙΑ ΣΦΑΛΜΑΤΟΣ ΕΠΙΒΙΩΣΕ
 * =============================================================================
 *
 * Το ερώτημα **δεν** είναι «καλεί τον `apiClient`;» — αυτό είναι όνομα, και μια
 * άγκυρα που ζητά όνομα περνά με την **εισαγωγή**. Εδώ ρωτάμε αυτό που ο παλιός
 * `authorizedFetch` **προειδοποιούσε γραπτώς** ότι θα σπάσει:
 *
 * > «ΔΕΝ κρίνει το `res.ok` — και είναι ΑΠΟΦΑΣΗ, όχι παράλειψη. Οι δύο πρώτοι
 * >  καταναλωτές έχουν **αντίθετη** σημασιολογία σφάλματος […] Ένας βοηθός που
 * >  «απλοποιεί» επιβάλλοντας μία από τις δύο θα άλλαζε **ζωντανή συμπεριφορά».
 *
 * Ο `apiClient` **πετά σε κάθε μη-2xx** — δηλαδή κάνει ακριβώς αυτό που η
 * τεκμηρίωση φοβόταν. Η μετανάστευση περνά, αλλά για **διαφορετικό λόγο** σε
 * κάθε πλευρά, και μόνο μια άγκυρα το κρατά αληθινό:
 *
 * ┌─────┬──────────────────────────────────────────────────────────────────┐
 * │ Κ1  │ `InvoiceDetails` **ΣΙΩΠΑ**: η άρνηση φτάνει στον ίδιο **κενό**   │
 * │     │ `catch` ⇒ κενή κατάσταση, καμία εξαίρεση προς τα έξω.            │
 * │ Κ2  │ `EditInvoicePageContent` **ΜΙΛΑ**: δείχνει το μήνυμα του         │
 * │     │ διακομιστή — και **όχι** «HTTP 404». Η μόνη ορατή αλλαγή.        │
 * │ Κ3  │ Επιτυχία: το τιμολόγιο φτάνει **ξετυλιγμένο**. Ο `apiClient`     │
 * │     │ επιστρέφει το `data` του `ok(invoice)` — όχι τον φάκελο.         │
 * │     │ Φυλάει από παλινδρόμηση σε χειροκίνητο `json.data`.              │
 * └─────┴──────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ **Μεταλλάξεις που ΠΡΕΠΕΙ να κοκκινίζουν**: βάλε `catch { setInvoice(null) }`
 *    στο `InvoiceDetails` ⇒ Κ1· σβήσε το `setError` του Edit ⇒ Κ2.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import { ApiClientError } from '@/lib/api/api-client-types';
import type { Invoice } from '@/subapps/accounting/types';

// -----------------------------------------------------------------------------
// Ο μεταφορέας — ο ΜΟΝΟΣ διπλός που αφορά το ερώτημα
// -----------------------------------------------------------------------------

const mockGet = jest.fn();
jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args) },
}));

// -----------------------------------------------------------------------------
// Ό,τι ΔΕΝ αφορά το ερώτημα
// -----------------------------------------------------------------------------

jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('@/lib/workspace/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  Link: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));
jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => new Proxy({}, { get: () => new Proxy({}, { get: () => '' }) }),
}));
jest.mock('@/subapps/accounting/hooks/useCompanySetup', () => ({
  useCompanySetup: () => ({ profile: null, loading: false }),
}));
jest.mock('../forms/InvoiceForm', () => ({ InvoiceForm: () => <form data-testid="invoice-form" /> }));
jest.mock('../details/InvoiceSummaryCard', () => ({
  InvoiceSummaryCard: ({ invoice }: { invoice: Invoice }) => (
    <output data-testid="summary">{invoice.invoiceId}</output>
  ),
}));
jest.mock('../details/InvoiceActionsMenu', () => ({ InvoiceActionsMenu: () => null }));
jest.mock('../details/SendInvoiceEmailDialog', () => ({ SendInvoiceEmailDialog: () => null }));
jest.mock('../details/CancelInvoiceDialog', () => ({ CancelInvoiceDialog: () => null }));

// Τα δύο υπό εξέταση — εισάγονται ΜΕΤΑ τους διπλούς
import { InvoiceDetails } from '../details/InvoiceDetails';
import { EditInvoicePageContent } from '../EditInvoicePageContent';

/**
 * Ελάχιστο αλλά **αποδοτό** τιμολόγιο. Το `mydata` δεν είναι διακοσμητικό: το
 * `InvoiceDetails:121` διαβάζει `invoice.mydata.status` **χωρίς** προαιρετική
 * αλυσίδα, οπότε το component σκάει σε τιμολόγιο που δεν το φέρει.
 * *(Παρατηρημένο εδώ, όχι διορθωμένο — είναι ανθεκτικότητα του component, όχι
 * της μεταφοράς. Καταγράφεται στο ADR ως ανοιχτό.)*
 */
const invoice = {
  invoiceId: 'inv_1',
  series: 'A',
  type: 'sales_invoice',
  status: 'issued',
  mydata: { status: 'sent' },
  lineItems: [],
  totals: { netAmount: 0, vatAmount: 0, grossAmount: 0, withholdingAmount: 0 },
} as unknown as Invoice;

/** Ό,τι πετά πράγματι ο `apiClient` σε 404 — με το μήνυμα του `notFound()`. */
const notFound = () =>
  new ApiClientError('Invoice not found', 404, 'HTTP_404', undefined, 'req_1');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

// -----------------------------------------------------------------------------

describe('Κ1 — InvoiceDetails ΣΙΩΠΑ στην άρνηση', () => {
  it('η άρνηση δεν διαφεύγει: κενή κατάσταση, καμία εξαίρεση', async () => {
    mockGet.mockRejectedValue(notFound());

    render(<InvoiceDetails invoiceId="inv_1" onBack={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Invoice not found')).toBeInTheDocument());
    expect(screen.queryByTestId('summary')).not.toBeInTheDocument();
  });
});

describe('Κ2 — EditInvoicePageContent ΜΙΛΑ στην άρνηση', () => {
  it('δείχνει το μήνυμα του διακομιστή, όχι τον κωδικό «HTTP 404»', async () => {
    mockGet.mockRejectedValue(notFound());

    render(<EditInvoicePageContent invoiceId="inv_1" />);

    await waitFor(() => expect(screen.getByText('Invoice not found')).toBeInTheDocument());
    expect(screen.queryByText(/HTTP 404/)).not.toBeInTheDocument();
  });
});

describe('Κ3 — η επιτυχία φτάνει ΞΕΤΥΛΙΓΜΕΝΗ', () => {
  it('ο μεταφορέας δίνει το invoice, όχι τον φάκελο {success,data}', async () => {
    mockGet.mockResolvedValue(invoice);

    render(<InvoiceDetails invoiceId="inv_1" onBack={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('summary')).toHaveTextContent('inv_1'));
    expect(screen.queryByText('Invoice not found')).not.toBeInTheDocument();
  });
});
