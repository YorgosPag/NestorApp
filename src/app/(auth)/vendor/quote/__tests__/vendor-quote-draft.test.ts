/**
 * @fileoverview Η προσφορά υπό σύνταξη στην πύλη (ADR-327 §8.5).
 *
 * Κ1 νέα προσφορά: μία απάντηση «Τιμολογώ» ανά γραμμή RFQ, με ποσότητα και μονάδα (του ΕΝΟΣ μητρώου) από το RFQ ·
 * Κ2 επεξεργασία: τιμή / «εξαιρείται» / εναλλακτική / πρόσθετη ξαναβρίσκουν τη θέση τους ·
 * Κ3 παλιά προσφορά χωρίς δέσιμο: οι γραμμές της δένονται με συμπέρασμα, ΔΕΝ χάνονται ·
 * Κ4 το σύνολο είναι η ΒΑΣΙΚΗ προσφορά — οι εναλλακτικές δεν μετρούν ·
 * Κ5 έλεγχος: τιμολογημένη χωρίς τιμή · μισή εναλλακτική · καμία τιμή πουθενά ·
 * Κ6 φορτίο: η περιγραφή της απάντησης είναι της γραμμής RFQ· κενή πρόσθετη δεν φεύγει ·
 * Κ7 §8.5 Β: με κλείδωμα η φόρμα ξεκινά ΗΔΗ με τις τιμές της γραμμής RFQ (ίδιος κανόνας με τον server).
 */

import type { QuoteLine } from '@/subapps/procurement/types/quote';
import type { PublicRfqLine } from '@/subapps/procurement/types/rfq-line';
import type { QuoteSnapshot } from '../types';
import { draftTotals, initialVendorDraft, toSubmissionPayload, validateDraft } from '../vendor-quote-draft';

const rfqLine = (id: string, description: string, quantity: number | null, unit: string | null): PublicRfqLine => ({
  id, description, trade: 'demolition', categoryCode: null, quantity, unit, notes: null, displayOrder: 0,
});

const qLine = (rfqLineId: string | null | undefined, unitPrice: number, description = 'γραμμή'): QuoteLine => ({
  id: `ql-${unitPrice}`, description, categoryCode: null, quantity: 2, unit: 'pcs', unitPrice, vatRate: 24,
  lineTotal: 2 * unitPrice, notes: null, ...(rfqLineId === undefined ? {} : { rfqLineId }),
});

const snapshot = (partial: Partial<QuoteSnapshot>): QuoteSnapshot => ({
  id: 'qt', lines: [], alternates: [], scopeResponses: [], paymentTerms: null, deliveryTerms: null, warranty: null,
  notes: null, validUntil: null, attachments: [], status: 'submitted',
  totals: { subtotal: 0, vatAmount: 0, total: 0, vatRate: 24 }, ...partial,
});

const RFQ = [rfqLine('L1', 'Καθαίρεση', 12, 'τ.μ.'), rfqLine('L2', 'Μεταφορά', null, null)];

describe('initialVendorDraft', () => {
  it('Κ1 — μία απάντηση ανά γραμμή, ποσότητα + κανονική μονάδα από το RFQ', () => {
    const draft = initialVendorDraft(RFQ, null);
    expect(draft.answers.map((a) => [a.rfqLineId, a.answer, a.quantity, a.unit]))
      .toEqual([['L1', 'priced', '12', 'm2'], ['L2', 'priced', '', 'pcs']]);
    expect(draft.additional).toEqual([]);
    expect(initialVendorDraft([], null).additional).toHaveLength(1); // RFQ χωρίς γραμμές: μία κενή γραμμή
  });

  it('Κ7 (§8.5 Β) — κλείδωμα: η επεξεργασία παλιάς προσφοράς ξεκινά με την ποσότητα/μονάδα της γραμμής RFQ', () => {
    const quote = snapshot({ lines: [qLine('L1', 9)] }); // παλιά τιμή: 2 pcs
    const locked = initialVendorDraft(RFQ, quote, { quantity: true, unit: true });
    expect(locked.answers.map((a) => [a.rfqLineId, a.quantity, a.unit, a.unitPrice]))
      .toEqual([['L1', '12', 'm2', '9'], ['L2', '', 'pcs', '']]); // L2 δεν ορίζει τίποτα ⇒ τίποτα δεν κλειδώνει
    expect(initialVendorDraft(RFQ, quote).answers[0]).toMatchObject({ quantity: '2', unit: 'pcs' });
  });

  it('Κ2 — η υπάρχουσα προσφορά ξαναβρίσκει τη θέση κάθε απάντησης', () => {
    const quote = snapshot({
      lines: [qLine('L1', 9), qLine(null, 4, 'Πρόσθετο')],
      scopeResponses: [{ rfqLineId: 'L2', description: 'Μεταφορά', response: 'excluded', note: 'εκτός' }],
      alternates: [qLine('L1', 7, 'Άλλη μέθοδος')],
    });
    const draft = initialVendorDraft(RFQ, quote);
    expect(draft.answers.map((a) => [a.answer, a.unitPrice, a.notes])).toEqual([['priced', '9', ''], ['excluded', '', 'εκτός']]);
    expect(draft.additional.map((l) => l.description)).toEqual(['Πρόσθετο']);
    expect(draft.alternates.map((a) => [a.rfqLineId, a.description])).toEqual([['L1', 'Άλλη μέθοδος']]);
  });

  it('Κ3 — παλιά προσφορά χωρίς δέσιμο: συμπέρασμα με την περιγραφή', () => {
    const legacy = snapshot({ lines: [qLine(undefined, 9, 'ΚΑΘΑΙΡΕΣΗ'), qLine(undefined, 3, 'Κάτι άλλο')] });
    const draft = initialVendorDraft(RFQ, legacy);
    expect(draft.answers[0]).toMatchObject({ answer: 'priced', unitPrice: '9' });
    expect(draft.additional.map((l) => l.description)).toEqual(['Κάτι άλλο']);
  });
});

describe('draftTotals / validateDraft / toSubmissionPayload', () => {
  const filled = () => {
    const draft = initialVendorDraft(RFQ, snapshot({
      lines: [qLine('L1', 10)], scopeResponses: [{ rfqLineId: 'L2', description: 'Μεταφορά', response: 'included', note: null }],
      alternates: [qLine('L1', 5, 'Φθηνότερη μέθοδος')],
    }));
    return draft;
  };

  it('Κ4 — το σύνολο είναι η βασική προσφορά· οι εναλλακτικές δεν μετρούν', () => {
    expect(draftTotals(filled())).toEqual({ subtotal: 20, vatAmount: 4.8, total: 24.8 });
  });

  it('Κ5 — ονομασμένα σφάλματα ελέγχου', () => {
    const draft = filled();
    expect(validateDraft(draft)).toBeNull();
    expect(validateDraft({ ...draft, answers: [{ ...draft.answers[0], unitPrice: '' }, draft.answers[1]] }))
      .toBe('validationAnswers');
    expect(validateDraft({ ...draft, alternates: [{ ...draft.alternates[0], description: ' ' }] }))
      .toBe('validationAlternate');
    expect(validateDraft({ ...draft, answers: draft.answers.map((a) => ({ ...a, answer: 'excluded' as const })) }))
      .toBe('validationLines');
  });

  it('Κ6 — φορτίο: περιγραφή από τη γραμμή RFQ, δέσιμο σε κάθε γραμμή, κενή πρόσθετη δεν φεύγει', () => {
    const draft = filled();
    const payload = toSubmissionPayload({ ...draft, additional: [{ ...draft.answers[0], key: 'k', description: '', quantity: '', unitPrice: '' }] }, RFQ);
    expect(payload.lines).toEqual([expect.objectContaining({ rfqLineId: 'L1', description: 'Καθαίρεση', unitPrice: 10 })]);
    expect(payload.alternates).toEqual([expect.objectContaining({ rfqLineId: 'L1', description: 'Φθηνότερη μέθοδος' })]);
    expect(payload.scopeResponses).toEqual([{ rfqLineId: 'L2', description: 'Μεταφορά', response: 'included', note: null }]);
  });
});
