/**
 * @fileoverview **ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ ΥΠΟΛΟΓΙΣΜΟΥ ΤΗΣ ΒΕΒΑΙΩΣΗΣ ΠΑΡΑΚΡΑΤΗΣΗΣ** — ADR-ACC-020 · ADR-ACC-010 §2.1.1
 * @related services/apy/apy-certificate-draft.ts
 *
 * 🔑 Ο παρονομαστής σε κάθε άγκυρα αποκλεισμού: ένα επιλέξιμο τιμολόγιο ΔΙΠΛΑ στο αποκλεισμένο — αλλιώς ένα
 *    «τίποτα δεν περνά ποτέ» (το ακριβές σύμπτωμα του παλιού διαλόγου) θα ήταν πράσινο.
 */

import type { Invoice } from '../../../types/invoice';
import { apyProviderOf, buildAPYCertificateDraft, computeAPYCertificateDraft } from '../apy-certificate-draft';
import type { CompanyProfile } from '../../../types';

let seq = 0;

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  seq += 1;
  return {
    invoiceId: `inv_${seq}`,
    series: 'Α',
    number: seq,
    type: 'service_invoice',
    issueDate: `2026-0${(seq % 9) + 1}-10`,
    fiscalYear: 2026,
    totalNetAmount: 1000,
    withholdingRate: 20,
    withholdingAmount: 200,
    mydata: { status: 'sent', mark: null, uid: null, authCode: null },
    customer: {
      contactId: 'cust_1', name: 'Πελάτης ΑΕ', vatNumber: '123456789',
      taxOffice: 'Α Αθηνών', address: 'Οδός 1', city: 'Αθήνα',
    },
    ...overrides,
  } as unknown as Invoice;
}

beforeEach(() => {
  seq = 0;
});

describe('buildAPYCertificateDraft — ποια παραστατικά', () => {
  it('Π — ο παρονομαστής: ένα έγκυρο τιμολόγιο γίνεται μία γραμμή με τα δικά του ποσά', () => {
    const draft = buildAPYCertificateDraft([invoice()], 'cust_1', 2026);

    expect(draft.lineItems).toEqual([
      { invoiceId: 'inv_1', invoiceNumber: 'Α-1', issueDate: '2026-02-10', netAmount: 1000, withholdingRate: 20, withholdingAmount: 200 },
    ]);
    expect({ net: draft.totalNetAmount, withheld: draft.totalWithholdingAmount }).toEqual({ net: 1000, withheld: 200 });
  });

  /**
   * 🔴 Ο παλιός φίλτρος απέκλειε ΜΟΝΟ το πιστωτικό. Ακυρωμένο (`void`) και πιστωμένο θα έμπαιναν ⇒ βεβαίωση για
   * φόρο που δεν παρακρατήθηκε ποτέ. ΜΕΤΑΛΛΑΞΗ: σβήσε οποιονδήποτε από τους τρεις όρους ⇒ κόκκινο.
   */
  it('🔴 Α1 — πιστωτικό · ακυρωμένο · πιστωμένο ΔΕΝ μπαίνουν', () => {
    const draft = buildAPYCertificateDraft(
      [
        invoice(),
        invoice({ type: 'credit_invoice' }),
        invoice({ mydata: { status: 'cancelled', mark: null, uid: null, authCode: null } as Invoice['mydata'] }),
        invoice({ creditNoteInvoiceId: 'inv_credit' }),
      ],
      'cust_1',
      2026,
    );

    expect(draft.lineItems.map((line) => line.invoiceId)).toEqual(['inv_1']);
  });

  it('Α2 — άλλη χρήση · μηδενική/απούσα παρακράτηση ΔΕΝ μπαίνουν', () => {
    const draft = buildAPYCertificateDraft(
      [invoice(), invoice({ fiscalYear: 2025 }), invoice({ withholdingAmount: 0 }), invoice({ withholdingAmount: null })],
      'cust_1',
      2026,
    );

    expect(draft.lineItems.map((line) => line.invoiceId)).toEqual(['inv_1']);
  });

  it('Α3 — καμία επιλέξιμη γραμμή ⇒ `customer: null` (δεν υπάρχει βεβαίωση να εκδοθεί)', () => {
    const draft = buildAPYCertificateDraft([invoice({ fiscalYear: 2025 })], 'cust_1', 2026);

    expect({ customer: draft.customer, lines: draft.lineItems.length, total: draft.totalWithholdingAmount })
      .toEqual({ customer: null, lines: 0, total: 0 });
  });
});

describe('buildAPYCertificateDraft — ποσά και στιγμιότυπα', () => {
  /** ΜΕΤΑΛΛΑΞΗ: ξαναβάλε `?? 20` ⇒ κόκκινο (3% κατασκευαστικών θα γραφόταν ως 20%). */
  it('🔴 Ρ1 — συντελεστής που λείπει ΠΑΡΑΓΕΤΑΙ από τα ποσά, ποτέ σταθερό 20', () => {
    const draft = buildAPYCertificateDraft([invoice({ withholdingRate: null, withholdingAmount: 30 })], 'cust_1', 2026);

    expect(draft.lineItems[0].withholdingRate).toBe(3);
  });

  it('Ρ2 — τα σύνολα στρογγυλεύονται στο λεπτό στο ΤΕΛΟΣ (0.1 + 0.2 ≠ 0.30000000000000004)', () => {
    const draft = buildAPYCertificateDraft(
      [invoice({ totalNetAmount: 0.1, withholdingAmount: 0.1 }), invoice({ totalNetAmount: 0.2, withholdingAmount: 0.2 })],
      'cust_1',
      2026,
    );

    expect({ net: draft.totalNetAmount, withheld: draft.totalWithholdingAmount }).toEqual({ net: 0.3, withheld: 0.3 });
  });

  it('Ρ3 — τα στοιχεία πελάτη από το ΠΙΟ ΠΡΟΣΦΑΤΟ επιλέξιμο παραστατικό (ισχύουν στο τέλος χρήσης)', () => {
    const moved = { contactId: 'cust_1', name: 'Πελάτης ΑΕ', vatNumber: '123456789', taxOffice: 'Β Αθηνών', address: 'Νέα 2', city: 'Πειραιάς' };
    const draft = buildAPYCertificateDraft([invoice(), invoice({ customer: moved as Invoice['customer'] })], 'cust_1', 2026);

    expect(draft.customer).toEqual({ name: 'Πελάτης ΑΕ', vatNumber: '123456789', taxOffice: 'Β Αθηνών', address: 'Νέα 2', city: 'Πειραιάς' });
  });
});

describe('computeAPYCertificateDraft — από το καθολικό', () => {
  it('Κ1 — σαρώνει ΟΛΑ τα παραστατικά του πελάτη ως το τέλος της χρήσης (όχι σελίδα)', async () => {
    const collectInvoices = jest.fn().mockResolvedValue([invoice()]);

    const draft = await computeAPYCertificateDraft({ collectInvoices }, 'cust_1', 2026);

    expect(collectInvoices).toHaveBeenCalledWith({ scope: { kind: 'customer', customerId: 'cust_1', asOf: '2026-12-31' } });
    expect(draft.lineItems).toHaveLength(1);
  });

  it('Κ2 — σφάλμα σάρωσης ΠΕΤΑ: ποτέ «κενή βεβαίωση» από αποτυχία', async () => {
    const collectInvoices = jest.fn().mockRejectedValue(new Error('scan failed'));

    await expect(computeAPYCertificateDraft({ collectInvoices }, 'cust_1', 2026)).rejects.toThrow('scan failed');
  });
});

describe('apyProviderOf', () => {
  it('Σ1 — στιγμιότυπο παρόχου από το προφίλ εταιρείας', () => {
    const profile = {
      businessName: 'Νέστωρ', vatNumber: '999999999', taxOffice: 'Γ Αθηνών', address: 'Οδός 3', city: 'Αθήνα',
      postalCode: '10431', profession: 'Μηχανικός', phone: null, email: 'n@example.com',
    } as unknown as CompanyProfile;

    expect(apyProviderOf(profile)).toEqual({
      name: 'Νέστωρ', vatNumber: '999999999', taxOffice: 'Γ Αθηνών', address: 'Οδός 3', city: 'Αθήνα',
      postalCode: '10431', profession: 'Μηχανικός', phone: null, email: 'n@example.com',
    });
  });
});
