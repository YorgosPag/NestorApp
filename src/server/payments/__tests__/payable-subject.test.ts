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
const recordIssuanceAdvanceMovementMock = jest.fn();
jest.mock('@/services/document-registry/issuance-advance-payment.server', () => ({
  recordIssuanceAdvanceMovement: (...args: unknown[]) => recordIssuanceAdvanceMovementMock(...args),
}));

import {
  isPayableReturnPath,
  isReturnPathOfKind,
  payableSubjectOf,
  sameAttemptScope,
  storedPayableSubjectOf,
  type InvoicePayableSubject,
  type IssuanceAdvancePayableSubject,
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
    expect(payableSubjectOf(legacyDoc({ subjectKind: 'escrow-unknown' }))).toBeNull();
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
    expect(checkoutRecordOf('pchk_1', legacyDoc({ subjectKind: 'escrow-unknown' }))).toBeNull();
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
      pchk_unknown_kind: legacyDoc({ subjectKind: 'escrow-unknown' }),
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

// ─── ADR-943 §5.9 — η προκαταβολή ανάθεσης ως πληρωτέο αντικείμενο ───────────────────────────────────────────

const ADVANCE: IssuanceAdvancePayableSubject = {
  kind: 'issuance-advance', companyId: 'comp_1', assignmentId: 'dia_1', withdrawalWaiverAt: '2026-11-17T09:00:00.000Z',
};
const MARKETPLACE = { payeeReference: 'sel_1', transferReference: null, transferDue: false, lease: null, settlement: null };

function advanceDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    companyId: 'comp_1', subjectKind: 'issuance-advance', assignmentId: 'dia_1', withdrawalWaiverAt: '2026-11-17T09:00:00.000Z',
    provider: 'everypay', method: 'card', amountMinor: 4000, currency: 'EUR', status: 'pending', providerReference: null,
    paymentReference: null, lastFailure: null, marketplace: MARKETPLACE, createdAt: '2026-11-17T09:00:00.000Z',
    expiresAt: '2026-11-17T09:30:00.000Z', ...overrides,
  };
}

describe('issuance-advance — κωδικοποιητής και συνεδρία', () => {
  it('γραφή ⇒ ανάγνωση = το ίδιο αντικείμενο· το ρητό αίτημα έναρξης (Κ-6) ταξιδεύει μαζί του', () => {
    const stored = storedPayableSubjectOf(ADVANCE);
    expect(stored).toEqual({ subjectKind: 'issuance-advance', companyId: 'comp_1', assignmentId: 'dia_1', withdrawalWaiverAt: '2026-11-17T09:00:00.000Z' });
    expect(payableSubjectOf(stored)).toEqual(ADVANCE);
  });

  it('χωρίς ρητό αίτημα έναρξης ή ανάθεση ⇒ ανύπαρκτο (καμία πληρωμή χωρίς Κ-6)', () => {
    expect(payableSubjectOf(advanceDoc({ withdrawalWaiverAt: undefined }))).toBeNull();
    expect(payableSubjectOf(advanceDoc({ assignmentId: ' ' }))).toBeNull();
  });

  it('συνεδρία ⇄ έγγραφο: η κράτηση marketplace διαβάζεται και ξαναγράφεται αυτούσια', () => {
    const record = recordOf(advanceDoc());
    expect(record.subject).toEqual(ADVANCE);
    expect(record.marketplace).toEqual(MARKETPLACE);
    expect(checkoutRecordOf('pchk_1', storedCheckoutOf(record))).toEqual(record);
  });

  it('🔴 προκαταβολή ΧΩΡΙΣ κράτηση ⇒ ανύπαρκτη συνεδρία — ποτέ χρήματα τρίτου στον λογαριασμό εμπόρου', () => {
    expect(checkoutRecordOf('pchk_1', advanceDoc({ marketplace: undefined }))).toBeNull();
    expect(checkoutRecordOf('pchk_1', advanceDoc({ marketplace: { payeeReference: 'sel_1' } }))).toBeNull();
  });

  it('τιμολόγιο ΜΕ κράτηση ⇒ ανύπαρκτη συνεδρία (το είδος και η κράτηση πάνε μαζί)', () => {
    expect(checkoutRecordOf('pchk_1', legacyDoc({ marketplace: MARKETPLACE }))).toBeNull();
    expect(recordOf(legacyDoc()).marketplace).toBeNull();
  });
});

describe('issuance-advance — επιστροφή και εμβέλεια', () => {
  it('επιστροφή ΜΟΝΟ στη σελίδα έγκρισης, χωρίς διαπιστευτήριο', () => {
    expect(isReturnPathOfKind('issuance-advance', '/document-request')).toBe(true);
    expect(isReturnPathOfKind('issuance-advance', '/document-request#t=abc')).toBe(false);
    expect(isReturnPathOfKind('issuance-advance', '/shared/abc')).toBe(false);
    expect(isPayableReturnPath('/document-request')).toBe(true);
  });

  it('ίδια ανάθεση του ίδιου μισθωτή ⇒ ίδια εμβέλεια· άλλη ανάθεση / άλλος μισθωτής / τιμολόγιο ⇒ όχι', () => {
    expect(sameAttemptScope(ADVANCE, { ...ADVANCE, withdrawalWaiverAt: '2026-11-18T00:00:00.000Z' })).toBe(true);
    expect(sameAttemptScope(ADVANCE, { ...ADVANCE, assignmentId: 'dia_2' })).toBe(false);
    expect(sameAttemptScope(ADVANCE, { ...ADVANCE, companyId: 'comp_2' })).toBe(false);
    expect(sameAttemptScope(ADVANCE, INVOICE)).toBe(false);
  });

  it('ανοιχτές συνεδρίες: ΡΗΤΟ ερώτημα με μισθωτή ΚΑΙ ανάθεση (CHECK 3.10 · 3.35)', async () => {
    const queries: Array<[string, string, unknown]> = [];
    const docs: Record<string, Record<string, unknown>> = {
      pchk_open: advanceDoc(), pchk_paid: advanceDoc({ status: 'paid' }), pchk_invoice: legacyDoc(),
    };
    const query = (filters: Array<[string, unknown]>): unknown => ({
      where: (field: string, op: string, value: unknown) => { queries.push([field, op, value]); return query([...filters, [field, value]]); },
      get: async () => ({
        docs: Object.entries(docs)
          .filter(([, data]) => filters.every(([field, value]) => data[field] === value))
          .map(([id, data]) => ({ id, data: () => data })),
      }),
    });
    const db = { collection: () => query([]) } as unknown as Firestore;
    const pending = await listPendingCheckoutsOf(db, ADVANCE);
    expect(queries).toEqual([['companyId', '==', 'comp_1'], ['assignmentId', '==', 'dia_1']]);
    expect(pending.map((record) => record.checkoutId)).toEqual(['pchk_open']);
  });

  it('το μητρώο στέλνει την κίνηση στον ΕΝΑ γραφέα της προκαταβολής (όχι στο τιμολόγιο)', async () => {
    recordInvoicePaymentMock.mockReset();
    recordIssuanceAdvanceMovementMock.mockResolvedValue('recorded');
    const provider = { id: 'everypay' } as unknown as PaymentProvider;
    const movement: ProviderMovement = { kind: 'payment', reference: 'pmt_7', amountMinor: 4000, currency: 'EUR', occurredAt: '2026-11-17T09:05:00.000Z' };
    await expect(recordPayableMovement(recordOf(advanceDoc()), movement, provider)).resolves.toBe('recorded');
    expect(recordIssuanceAdvanceMovementMock).toHaveBeenCalledWith(expect.objectContaining({ subject: ADVANCE, movement }));
    expect(recordInvoicePaymentMock).not.toHaveBeenCalled();
  });
});
