/**
 * @jest-environment node
 *
 * ADR-943 §5.6 — το «πληρωτέο αντικείμενο» της συνεδρίας πληρωμής: ο ΕΝΑΣ κωδικοποιητής (παλιά έγγραφα διαβάζονται ως
 * τιμολόγιο χωρίς μετάπτωση), οι διαδρομές επιστροφής ανά είδος, η εμβέλεια απόπειρας και το μητρώο γραφέων.
 */

import type { Firestore } from 'firebase-admin/firestore';

const recordInvoicePaymentMock = jest.fn();
jest.mock('@/subapps/accounting/services/repository/accounting-repo-invoice-payments', () => ({
  recordInvoicePayment: (...args: unknown[]) => recordInvoicePaymentMock(...args),
}));

import {
  isPayableReturnPath,
  isReturnPathOfKind,
  payableSubjectOf,
  sameAttemptScope,
  storedPayableSubjectOf,
  type InvoicePayableSubject,
} from '../payable-subject';
import { recordPayableMovement } from '../payable-subject-registry';
import {
  checkoutRecordOf,
  listPendingCheckoutsOf,
  storedCheckoutOf,
  type PaymentCheckoutRecord,
} from '../payment-checkout-store';
import type { PaymentProvider, ProviderMovement } from '../payment-provider';

const INVOICE: InvoicePayableSubject = { kind: 'invoice', invoiceId: 'inv_1', shareId: 'share_1' };

/** Έγγραφο όπως το έγραφε ο κώδικας ΠΡΙΝ από το ADR-943 — χωρίς `subjectKind`. */
function legacyDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    companyId: 'comp_1', invoiceId: 'inv_1', shareId: 'share_1', provider: 'everypay', method: 'card',
    amountMinor: 1240, currency: 'EUR', status: 'pending', providerReference: null, paymentReference: null,
    lastFailure: null, createdAt: '2026-11-16T10:00:00.000Z', expiresAt: '2026-11-16T10:30:00.000Z', ...overrides,
  };
}

function recordOf(data: Record<string, unknown>, id = 'pchk_1'): PaymentCheckoutRecord {
  const record = checkoutRecordOf(id, data);
  if (record === null) throw new Error('fixture must parse');
  return record;
}

describe('payableSubjectOf — ο κωδικοποιητής', () => {
  it('έγγραφο χωρίς subjectKind (πριν από ADR-943) ⇒ τιμολόγιο — καμία μετάπτωση', () => {
    expect(payableSubjectOf(legacyDoc())).toEqual(INVOICE);
  });

  it('ρητό subjectKind invoice ⇒ τιμολόγιο', () => {
    expect(payableSubjectOf(legacyDoc({ subjectKind: 'invoice' }))).toEqual(INVOICE);
  });

  it('άγνωστο είδος ⇒ ανύπαρκτο, ΠΟΤΕ τιμολόγιο (κώδικας παλαιότερος από τα δεδομένα)', () => {
    expect(payableSubjectOf(legacyDoc({ subjectKind: 'issuance-advance' }))).toBeNull();
    expect(payableSubjectOf(legacyDoc({ subjectKind: 42 }))).toBeNull();
  });

  it('λείπει ή είναι κενό υποχρεωτικό πεδίο ⇒ ανύπαρκτο', () => {
    expect(payableSubjectOf(legacyDoc({ invoiceId: undefined }))).toBeNull();
    expect(payableSubjectOf(legacyDoc({ shareId: '   ' }))).toBeNull();
    expect(payableSubjectOf(null)).toBeNull();
  });

  it('γραφή ⇒ ανάγνωση = το ίδιο αντικείμενο, με το είδος ΡΗΤΟ στο έγγραφο', () => {
    const stored = storedPayableSubjectOf(INVOICE);
    expect(stored).toEqual({ subjectKind: 'invoice', invoiceId: 'inv_1', shareId: 'share_1' });
    expect(payableSubjectOf(stored)).toEqual(INVOICE);
  });
});

describe('συνεδρία ⇄ έγγραφο', () => {
  it('παλιό έγγραφο ⇒ συνεδρία με subject· η εγγραφή της κρατά τη ΜΟΡΦΗ της βάσης (πεδία στο πάνω επίπεδο)', () => {
    const record = recordOf(legacyDoc());
    expect(record.subject).toEqual(INVOICE);
    const stored = storedCheckoutOf(record);
    expect(stored).not.toHaveProperty('subject');
    expect(stored).toMatchObject({ subjectKind: 'invoice', invoiceId: 'inv_1', shareId: 'share_1', companyId: 'comp_1' });
    expect(checkoutRecordOf('pchk_1', stored)).toEqual(record);
  });

  it('έγγραφο με άγνωστο είδος ⇒ καμία συνεδρία', () => {
    expect(checkoutRecordOf('pchk_1', legacyDoc({ subjectKind: 'issuance-advance' }))).toBeNull();
  });
});

describe('διαδρομές επιστροφής', () => {
  it('τιμολόγιο: μόνο η σελίδα του συνδέσμου', () => {
    expect(isReturnPathOfKind('invoice', '/shared/abc_DEF-1%2B')).toBe(true);
    expect(isReturnPathOfKind('invoice', '/shared/abc/extra')).toBe(false);
    expect(isReturnPathOfKind('invoice', '/document-request')).toBe(false);
  });

  it('ποτέ εξωτερική διεύθυνση ή διαδρομή πρωτοκόλλου (καμία ανοιχτή ανακατεύθυνση)', () => {
    for (const path of ['https://evil.example/shared/x', '//evil.example/shared/x', '/shared/x?next=//evil', '', '/']) {
      expect(isPayableReturnPath(path)).toBe(false);
    }
  });
});

describe('sameAttemptScope', () => {
  it('τιμολόγιο: ίδιος σύνδεσμος ⇒ ίδια εμβέλεια, ανεξάρτητα από το τιμολόγιο', () => {
    expect(sameAttemptScope(INVOICE, { ...INVOICE, invoiceId: 'inv_2' })).toBe(true);
    expect(sameAttemptScope(INVOICE, { ...INVOICE, shareId: 'share_2' })).toBe(false);
  });
});

describe('listPendingCheckoutsOf', () => {
  function fakeDb(docs: Record<string, Record<string, unknown>>) {
    const queries: Array<[string, string, unknown]> = [];
    const db = {
      collection: () => ({
        where: (field: string, op: string, value: unknown) => {
          queries.push([field, op, value]);
          return {
            get: async () => ({
              docs: Object.entries(docs)
                .filter(([, data]) => data[field] === value)
                .map(([id, data]) => ({ id, data: () => data })),
            }),
          };
        },
      }),
    };
    return { db: db as unknown as Firestore, queries };
  }

  it('ρωτά με το ΡΗΤΟ πεδίο του είδους και κρατά μόνο τις ανοιχτές, αναγνώσιμες συνεδρίες της εμβέλειας', async () => {
    const { db, queries } = fakeDb({
      pchk_open: legacyDoc(),
      pchk_paid: legacyDoc({ status: 'paid' }),
      pchk_other_share: legacyDoc({ shareId: 'share_2' }),
      pchk_unknown_kind: legacyDoc({ subjectKind: 'issuance-advance' }),
    });
    const pending = await listPendingCheckoutsOf(db, INVOICE);
    expect(queries).toEqual([['shareId', '==', 'share_1']]);
    expect(pending.map((record) => record.checkoutId)).toEqual(['pchk_open']);
  });
});

describe('recordPayableMovement — το μητρώο', () => {
  const provider = { id: 'everypay' } as unknown as PaymentProvider;
  const movement: ProviderMovement = {
    kind: 'payment', reference: 'pmt_1', amountMinor: 1240, currency: 'EUR', occurredAt: '2026-11-16T10:05:00.000Z',
  };

  beforeEach(() => recordInvoicePaymentMock.mockReset());

  it('τιμολόγιο ⇒ ο ΕΝΑΣ γραφέας τιμολογίου, με ντετερμινιστική ταυτότητα και δράστη τον πάροχο', async () => {
    recordInvoicePaymentMock.mockResolvedValue({ kind: 'recorded', state: {} });
    await expect(recordPayableMovement(recordOf(legacyDoc()), movement, provider)).resolves.toBe('recorded');
    const [tenant, invoiceId, entry] = recordInvoicePaymentMock.mock.calls[0];
    expect(tenant).toEqual({ companyId: 'comp_1' });
    expect(invoiceId).toBe('inv_1');
    expect(entry).toMatchObject({
      actor: 'provider:everypay',
      payment: { amount: 12.4, kind: 'payment', method: 'card', provider: 'everypay', providerReference: 'pmt_1', checkoutId: 'pchk_1' },
    });
  });

  it('ίδια κίνηση ξανά ⇒ ίδια ταυτότητα κίνησης (ιδεμποτία στον γραφέα)', async () => {
    recordInvoicePaymentMock.mockResolvedValue({ kind: 'duplicate' });
    await recordPayableMovement(recordOf(legacyDoc()), movement, provider);
    await expect(recordPayableMovement(recordOf(legacyDoc()), movement, provider)).resolves.toBe('duplicate');
    const [first, second] = recordInvoicePaymentMock.mock.calls.map((call) => call[2].payment.paymentId);
    expect(first).toBe(second);
  });

  it('τιμολόγιο που λείπει ⇒ subject-absent (θέλει άνθρωπο)', async () => {
    recordInvoicePaymentMock.mockResolvedValue({ kind: 'invoice-absent' });
    await expect(recordPayableMovement(recordOf(legacyDoc()), movement, provider)).resolves.toBe('subject-absent');
  });
});
