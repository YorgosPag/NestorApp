/**
 * @fileoverview Δέσιμο απάντησης ↔ γραμμής RFQ (ADR-327 §8.5) — οι κανόνες που ο server επιβάλλει.
 *
 * Κ1 ξένο id (άλλου RFQ) ⇒ `unknown_rfq_line` — ποτέ εμπιστοσύνη στον client ·
 * Κ2 δύο απαντήσεις στην ίδια γραμμή (τιμή + «εξαιρείται») ⇒ `duplicate_answer` ·
 * Κ3 πύλη: κάθε γραμμή RFQ απαντάται ρητά — η σιωπή απορρίπτεται ·
 * Κ4 εναλλακτική χωρίς γραμμή ⇒ `unbound_alternate` ·
 * Κ5 η γραμμή RFQ είναι αυθεντία του ΤΙ ζητήθηκε (περιγραφή + κωδικός)· η εναλλακτική κρατά τη δική της περιγραφή ·
 * Κ6 συμπέρασμα δεσίματος μόνο όταν είναι ΜΟΝΑΔΙΚΟ ·
 * Κ8 (§8.5.4) `binding:<code>` του server → κλειδί i18n· άγνωστος κωδικός / άλλο σφάλμα ⇒ `null` (κανένα ωμό κείμενο ως κλειδί).
 * Κ9 (§8.5.4) φόρμα από το αίτημα: μία ΡΗΤΑ δεμένη γραμμή ανά ΑΝΑΠΑΝΤΗΤΗ γραμμή RFQ· δεύτερη κλήση ⇒ `[]`.
 * Κ7 πρόταση στον έλεγχο: τα ρητά κρατιούνται και δεσμεύουν· το συμπέρασμα προτείνει μόνο ΕΛΕΥΘΕΡΗ γραμμή, μία φορά.
 */

import type { QuoteLine } from '../../types/quote';
import type { PublicRfqLine } from '../../types/rfq-line';
import { applyRfqLineAuthority, checkRfqLineAnswers, inferRfqLineId, proposeRfqLineBindings, rfqBindingErrorKey, draftLinesForUnansweredRfqLines, type RfqLineAnswers } from '../rfq-line-binding';

const rfqLine = (id: string, description: string, categoryCode: string | null = null): PublicRfqLine => ({
  id, description, trade: 'demolition', categoryCode, quantity: 1, unit: 'pcs', notes: null, displayOrder: 0,
});

const line = (rfqLineId: string | null, description = 'x'): QuoteLine => ({
  id: `ql-${description}`, description, categoryCode: null, quantity: 1, unit: 'pcs', unitPrice: 1, vatRate: 24,
  lineTotal: 1, notes: null, rfqLineId,
});

const answers = (partial: Partial<RfqLineAnswers>): RfqLineAnswers => ({
  lines: [], alternates: [], scopeResponses: [], ...partial,
});

const RFQ = [rfqLine('L1', 'Καθαίρεση', 'ΟΙΚ-22'), rfqLine('L2', 'Μεταφορά μπάζων')];
const STRICT = { requireEveryLine: true };

describe('checkRfqLineAnswers', () => {
  it('Κ1 — id που δεν ανήκει στο RFQ', () => {
    expect(checkRfqLineAnswers(RFQ, answers({ lines: [line('FOREIGN')] }), { requireEveryLine: false }))
      .toEqual({ code: 'unknown_rfq_line', rfqLineId: 'FOREIGN' });
  });

  it('Κ2 — τιμή ΚΑΙ «εξαιρείται» στην ίδια γραμμή', () => {
    const result = checkRfqLineAnswers(RFQ, answers({
      lines: [line('L1')], scopeResponses: [{ rfqLineId: 'L1', description: '', response: 'excluded', note: null }],
    }), { requireEveryLine: false });
    expect(result).toEqual({ code: 'duplicate_answer', rfqLineId: 'L1' });
  });

  it('Κ3 — η πύλη απαιτεί ρητή απάντηση σε κάθε γραμμή', () => {
    expect(checkRfqLineAnswers(RFQ, answers({ lines: [line('L1'), line(null)] }), STRICT))
      .toEqual({ code: 'unanswered_rfq_line', rfqLineId: 'L2' });
    expect(checkRfqLineAnswers(RFQ, answers({
      lines: [line('L1')], scopeResponses: [{ rfqLineId: 'L2', description: '', response: 'included', note: null }],
    }), STRICT)).toBeNull();
  });

  it('Κ4 — εναλλακτική πρέπει να δένει σε γραμμή του RFQ', () => {
    const complete = { lines: [line('L1'), line('L2')] };
    expect(checkRfqLineAnswers(RFQ, answers({ ...complete, alternates: [line(null)] }), STRICT))
      .toEqual({ code: 'unbound_alternate', rfqLineId: null });
    expect(checkRfqLineAnswers(RFQ, answers({ ...complete, alternates: [line('NOPE')] }), STRICT))
      .toEqual({ code: 'unknown_rfq_line', rfqLineId: 'NOPE' });
  });
});

describe('applyRfqLineAuthority', () => {
  it('Κ5 — περιγραφή/κωδικός από τη γραμμή RFQ· πρόσθετη και εναλλακτική κρατούν τη δική τους περιγραφή', () => {
    const bound = applyRfqLineAuthority(RFQ, answers({
      lines: [line('L1', 'μετονομασμένο'), line(null, 'πρόσθετο')],
      alternates: [line('L1', 'Άλλη μέθοδος')],
      scopeResponses: [{ rfqLineId: 'L2', description: 'πλαστό', response: 'excluded', note: null }],
    }));
    expect(bound.scopeResponses[0].description).toBe('Μεταφορά μπάζων');
    expect(bound.lines.map((l) => [l.description, l.categoryCode])).toEqual([['Καθαίρεση', 'ΟΙΚ-22'], ['πρόσθετο', null]]);
    expect(bound.alternates[0]).toMatchObject({ description: 'Άλλη μέθοδος', categoryCode: 'ΟΙΚ-22' });
  });
});

describe('inferRfqLineId', () => {
  it('Κ6 — κωδικός, μετά περιγραφή χωρίς τόνους/κεφαλαία — μόνο μοναδικό ταίριασμα', () => {
    expect(inferRfqLineId({ description: 'οτιδήποτε', categoryCode: 'ΟΙΚ-22' }, RFQ)).toBe('L1');
    expect(inferRfqLineId({ description: '  ΜΕΤΑΦΟΡΑ   ΜΠΑΖΩΝ ', categoryCode: null }, RFQ)).toBe('L2');
    const twins = [rfqLine('A', 'Μεταφορά'), rfqLine('B', 'Μεταφορά')];
    expect(inferRfqLineId({ description: 'Μεταφορά', categoryCode: null }, twins)).toBeNull();
  });
});

describe('proposeRfqLineBindings', () => {
  it('Κ7 — ρητό κρατιέται, συμπέρασμα μόνο σε ελεύθερη γραμμή, μία φορά', () => {
    const q = (id: string, description: string, rfqLineId?: string | null) =>
      ({ id, description, categoryCode: null, ...(rfqLineId === undefined ? {} : { rfqLineId }) });
    const proposals = proposeRfqLineBindings([
      q('a', 'Καθαίρεση'),            // συμπέρασμα → L1
      q('b', 'Μεταφορά μπάζων', 'L2'), // ρητό
      q('c', 'καθαιρεση'),            // L1 ήδη προτάθηκε ⇒ πρόσθετη
      q('d', 'Μεταφορά μπάζων'),      // L2 δεσμευμένη από ρητό ⇒ πρόσθετη
      q('e', 'κάτι', null),           // ρητά πρόσθετη
    ], RFQ);
    expect(proposals.map((p) => [p.lineId, p.rfqLineId, p.origin])).toEqual([
      ['a', 'L1', 'suggested'], ['b', 'L2', 'explicit'], ['c', null, 'none'], ['d', null, 'none'], ['e', null, 'explicit'],
    ]);
  });
});

describe('Κ8 rfqBindingErrorKey', () => {
  it('κάθε γνωστός κωδικός → κλειδί · άγνωστος / άλλο σφάλμα / μη-Error ⇒ null', () => {
    expect(rfqBindingErrorKey(new Error('binding:duplicate_answer'))).toBe('quotes.binding.errors.duplicate_answer');
    expect(rfqBindingErrorKey(new Error('binding:unknown_rfq_line'))).toBe('quotes.binding.errors.unknown_rfq_line');
    expect(rfqBindingErrorKey(new Error('binding:made_up'))).toBeNull();
    expect(rfqBindingErrorKey(new Error('Invalid transition'))).toBeNull();
    expect(rfqBindingErrorKey('binding:duplicate_answer')).toBeNull();
  });
});

describe('Κ9 draftLinesForUnansweredRfqLines', () => {
  it('μόνο οι αναπάντητες, ρητά δεμένες, με περιγραφή/κωδικό της γραμμής RFQ · ιδεμπότητο', () => {
    const drafts = draftLinesForUnansweredRfqLines(RFQ, [line('L1')]);
    expect(drafts).toEqual([{ rfqLineId: 'L2', description: 'Μεταφορά μπάζων', categoryCode: null, quantity: 1, unit: 'pcs' }]);
    expect(draftLinesForUnansweredRfqLines(RFQ, [line('L1'), ...drafts])).toEqual([]);
  });

  it('γραμμή RFQ χωρίς επιμέτρηση ⇒ 1 + προεπιλεγμένη μονάδα (η νέα προσφορά απαιτεί ποσότητα > 0)', () => {
    const bare = { ...rfqLine('L3', 'Κατ’ αποκοπή'), quantity: null, unit: null };
    expect(draftLinesForUnansweredRfqLines([bare], [])).toMatchObject([{ quantity: 1, unit: 'pcs' }]);
  });
});
