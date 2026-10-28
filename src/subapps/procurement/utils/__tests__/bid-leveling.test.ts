/**
 * @fileoverview Bid leveling (ADR-327 §8.5) — ο πίνακας «γραμμή RFQ × προσφορά» και η ανάθεση ανά γραμμή.
 *
 * Κ1 η ένωση γίνεται με `rfqLineId`, και η αξία με την ποσότητα ΤΟΥ RFQ (απόκλιση ποσότητας σημαδεύεται) ·
 * Κ2 κενό («εξαιρείται») καλύπτεται με την εκτίμηση του PM — ορατά (`plug.source`) ·
 * Κ3 χωρίς εκτίμηση: η ΥΨΗΛΟΤΕΡΗ συγκρίσιμη τιμή άλλου (το κενό δεν «κερδίζει» ποτέ) ·
 * Κ4 άλλη μονάδα (m ≠ m²) ⇒ `unitMismatch`, εκτός «φθηνότερου» ·
 * Κ5 παλιά προσφορά χωρίς δέσιμο ⇒ συμπέρασμα ΣΗΜΑΔΕΜΕΝΟ (`inferred`), διφορούμενο ⇒ πρόσθετη ·
 * Κ6 εναλλακτικές δίπλα στη γραμμή, ΠΟΤΕ στο σύνολο · πρόσθετες στο σύνολο, χωριστά ·
 * Κ7 lump sum ⇒ «περιλαμβάνονται όλα» (πρότυπο Procore), εξισορροπημένο = υποβληθέν ·
 * Κ8 γραμμή που ΚΑΝΕΙΣ δεν καλύπτει ⇒ `coverage: 'none'`, κενό χωρίς ποσό μετριέται ·
 * Κ9 cherry pick από τον ίδιο πίνακα — με αξίες γραμμής, όχι με τιμές μονάδας ασύμβατων μονάδων ·
 * Κ10 κάλυψη του PM (`manual`) υπερισχύει της αυτόματης, την κρατά δίπλα, μετρά στο σύνολο · σε γραμμή με τιμή αγνοείται.
 * Κ11 τιμή σε ΑΛΛΗ μονάδα ⇒ στο ΣΥΝΟΛΟ λογίζεται ως κενό (ίδια ορατή κάλυψη) — ποτέ «φθηνότερος με 0 €».
 */

import type { Quote, QuoteLine, RfqScopeResponse } from '../../types/quote';
import type { InternalRfqLine } from '../../types/rfq-line';
import { buildBidLeveling } from '../bid-leveling';
import { cherryPickFromLeveling } from '../cherry-pick';

const rfqLine = (id: string, quantity: number | null, unit: string | null, estimate: number | null = null,
  extra: Partial<InternalRfqLine> = {}): InternalRfqLine => ({
  id, description: `Εργασία ${id}`, trade: 'demolition', categoryCode: null, quantity, unit, notes: null,
  displayOrder: 0, estimateUnitPrice: estimate, ...extra,
});

const qLine = (rfqLineId: string | null | undefined, quantity: number, unit: string, unitPrice: number,
  extra: Partial<QuoteLine> = {}): QuoteLine => ({
  id: `ql-${rfqLineId ?? 'x'}-${unitPrice}`, description: extra.description ?? `Γραμμή ${rfqLineId}`,
  categoryCode: null, quantity, unit, unitPrice, vatRate: 24, lineTotal: quantity * unitPrice, notes: null,
  ...(rfqLineId === undefined ? {} : { rfqLineId }), ...extra,
});

type LevelQuote = Parameters<typeof buildBidLeveling>[1][number];

function quote(id: string, lines: QuoteLine[], extra: Partial<Pick<Quote, 'alternates' | 'scopeResponses' | 'quotedTotal' | 'levelingPlugs'>> = {}): LevelQuote {
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  return {
    id, lines, quotedTotal: null, scopeResponses: [], ...extra,
    totals: { subtotal, vatAmount: subtotal * 0.24, total: subtotal * 1.24, vatRate: 24 },
  };
}

const excluded = (rfqLineId: string): RfqScopeResponse => ({ rfqLineId, description: '', response: 'excluded', note: null });

const L1 = rfqLine('L1', 10, 'm2');
const L2 = rfqLine('L2', 5, 'pcs', 20);

describe('buildBidLeveling', () => {
  it('Κ10 — κάλυψη του PM: υπερισχύει, κρατά την αυτόματη, μετρά στο σύνολο · σε γραμμή με τιμή αγνοείται', () => {
    const plug = (rfqLineId: string, amount: number) => ({ rfqLineId, amount, note: 'τιμή αγοράς', setBy: 'u1', setAt: null as never });
    const a = quote('A', [qLine('L1', 10, 'm2', 10)], {
      scopeResponses: [excluded('L2')], levelingPlugs: [plug('L2', 75), plug('L1', 999), plug('FOREIGN', 5)],
    });
    const { rows, columns } = buildBidLeveling([L1, L2], [a]);
    expect(rows[1].cells[0].plug).toEqual({
      amount: 75, source: 'manual', note: 'τιμή αγοράς', automatic: { amount: 100, source: 'estimate', note: null },
    });
    expect(rows[0].cells[0]).toMatchObject({ state: 'priced', plug: null });
    expect(columns[0]).toMatchObject({ plugs: { count: 1, amount: 75 }, leveledNet: 175 });
  });

  it('Κ1 — ενώνει με rfqLineId και ισοσταθμίζει στην ποσότητα του RFQ', () => {
    const a = quote('A', [qLine('L1', 10, 'm2', 10), qLine('L2', 5, 'τεμ', 15)]);
    const b = quote('B', [qLine('L1', 8, 'τ.μ.', 12), qLine('L2', 5, 'pcs', 16)]);
    const { rows } = buildBidLeveling([L1, L2], [a, b]);
    const cellB = rows[0].cells.find((c) => c.quoteId === 'B');
    expect(cellB).toMatchObject({ state: 'priced', binding: 'explicit', leveledAmount: 120, quantityDeviation: -2 });
    expect(rows[0].lowestQuoteId).toBe('A');
    expect(rows[1].cells.every((c) => !c.unitMismatch)).toBe(true); // 'τεμ' ≡ 'pcs' — ΕΝΑ μητρώο μονάδων
  });

  it('Κ2 — «εξαιρείται» καλύπτεται με την εκτίμηση του PM, με ορατή πηγή', () => {
    const a = quote('A', [qLine('L1', 10, 'm2', 10)], { scopeResponses: [excluded('L2')] });
    const { rows, columns } = buildBidLeveling([L1, L2], [a]);
    expect(rows[1].cells[0]).toMatchObject({ state: 'excluded', plug: { amount: 100, source: 'estimate' } });
    expect(columns[0]).toMatchObject({ submittedNet: 100, plugs: { count: 1, amount: 100 }, leveledNet: 200 });
  });

  it('Κ3 — χωρίς εκτίμηση, το κενό παίρνει την ΥΨΗΛΟΤΕΡΗ συγκρίσιμη τιμή', () => {
    const a = quote('A', [qLine('L1', 10, 'm2', 10)]);
    const b = quote('B', [qLine('L1', 10, 'm2', 12)]);
    const c = quote('C', [qLine(null, 1, 'pcs', 50)]);
    const { rows, columns } = buildBidLeveling([L1], [a, b, c]);
    expect(rows[0].cells[2]).toMatchObject({ state: 'unanswered', plug: { amount: 120, source: 'highest_bid' } });
    expect(columns[2]).toMatchObject({ additionalItems: { count: 1, amount: 50 }, leveledNet: 170 });
  });

  it('Κ4 — άλλη μονάδα: σημαδεύεται, δεν «κερδίζει» ως φθηνότερη', () => {
    const a = quote('A', [qLine('L1', 10, 'm', 1)]);
    const b = quote('B', [qLine('L1', 10, 'm2', 9)]);
    const { rows } = buildBidLeveling([L1], [a, b]);
    expect(rows[0].cells[0]).toMatchObject({ unitMismatch: true, leveledAmount: 10, quantityDeviation: null });
    expect(rows[0].lowestQuoteId).toBe('B');
  });

  it('Κ5 — παλιά προσφορά: δέσιμο με συμπέρασμα (κωδικός · περιγραφή χωρίς τόνους), διφορούμενο ⇒ πρόσθετη', () => {
    const coded = rfqLine('C1', 2, 'pcs', null, { categoryCode: 'ΟΙΚ-22', description: 'Καθαίρεση τοίχου' });
    const twinA = rfqLine('T1', 1, 'pcs', null, { description: 'Μεταφορά' });
    const twinB = rfqLine('T2', 1, 'pcs', null, { description: 'Μεταφορά' });
    const legacy: LevelQuote = { ...quote('A', [
      qLine(undefined, 2, 'pcs', 40, { categoryCode: 'ΟΙΚ-22', description: 'κάτι άλλο' }),
      qLine(undefined, 1, 'pcs', 5, { description: 'ΜΕΤΑΦΟΡΑ' }),
    ]), scopeResponses: undefined };
    const { rows, columns } = buildBidLeveling([coded, twinA, twinB], [legacy]);
    expect(rows[0].cells[0]).toMatchObject({ state: 'priced', binding: 'inferred' });
    expect(rows[1].cells[0].state).toBe('unanswered');
    expect(columns[0]).toMatchObject({ inferredBindings: 1, additionalItems: { count: 1, amount: 5 } });
  });

  it('Κ6 — εναλλακτικές δίπλα στη γραμμή, ποτέ στο εξισορροπημένο σύνολο', () => {
    const a = quote('A', [qLine('L1', 10, 'm2', 10)], { alternates: [qLine('L1', 10, 'm2', 7, { description: 'Άλλη μάρκα' })] });
    const { rows, columns } = buildBidLeveling([L1], [a]);
    expect(rows[0].cells[0].alternates).toEqual([expect.objectContaining({ description: 'Άλλη μάρκα', unitPrice: 7 })]);
    expect(columns[0].leveledNet).toBe(100);
  });

  it('Κ7 — lump sum: όλα «περιλαμβάνονται», εξισορροπημένο = υποβληθέν', () => {
    const lump: LevelQuote = { ...quote('A', [qLine(undefined, 1, 'pcs', 0)], { quotedTotal: 900 }),
      scopeResponses: undefined, totals: { subtotal: 900, vatAmount: 0, total: 900, vatRate: 24 } };
    const { rows, columns } = buildBidLeveling([L1, L2], [lump]);
    expect(rows.map((r) => r.cells[0].state)).toEqual(['included', 'included']);
    expect(columns[0]).toMatchObject({ lumpSum: true, leveledNet: 900, plugs: { count: 0, amount: 0 } });
  });

  it('Κ8 — γραμμή που κανείς δεν καλύπτει: coverage none, κενό χωρίς ποσό μετριέται', () => {
    const a = quote('A', [qLine('L2', 5, 'pcs', 10)], { scopeResponses: [excluded('L1')] });
    const { rows, columns } = buildBidLeveling([L1, L2], [a]);
    expect(rows[0]).toMatchObject({ coverage: 'none', lowestQuoteId: null });
    expect(rows[0].cells[0].plug).toBeNull();
    expect(columns[0].unpluggedGaps).toBe(1);
  });

  it('χωρίς γραμμές RFQ ⇒ κενός πίνακας (η σύγκριση μένει στα σύνολα)', () => {
    expect(buildBidLeveling([], [quote('A', [qLine(null, 1, 'pcs', 5)])])).toEqual({ rows: [], columns: [] });
  });
});

describe('cherryPickFromLeveling', () => {
  it('Κ9 — νικητής ανά γραμμή με συγκρίσιμες αξίες· «ολόκληρο» = φθηνότερο εξισορροπημένο', () => {
    const a = quote('A', [qLine('L1', 10, 'm2', 10), qLine('L2', 5, 'pcs', 30)]);
    const b = quote('B', [qLine('L1', 10, 'm2', 12), qLine('L2', 5, 'pcs', 16)]);
    const leveling = buildBidLeveling([L1, L2], [a, b]);
    const result = cherryPickFromLeveling(leveling, new Map([['A', 'Άλφα'], ['B', 'Βήτα']]));
    expect(result.lineWinners.map((w) => [w.rfqLineId, w.winnerVendorName, w.winnerAmount, w.savings]))
      .toEqual([['L1', 'Άλφα', 100, 20], ['L2', 'Βήτα', 80, 70]]);
    // Άγνωστος ⇒ `null` (η οθόνη βάζει την ετικέτα) — ποτέ το ωμό quoteId.
    expect(cherryPickFromLeveling(leveling, new Map()).lineWinners.map((w) => w.winnerVendorName)).toEqual([null, null]);
    expect(result).toMatchObject({ totalIfCherryPick: 180, totalIfWholePackage: 200, savingsFromSplit: 20, uncoveredLines: 0 });
  });

  /**
   * Κ11 — ADR-327 §8.5.4, μετρημένο ζωντανά 2026-10-28: σαρωμένος τιμοκατάλογος (MACON ATEE) χωρίς ποσότητες, δεμένος
   * ρητά σε γραμμή «2 m³»: 0 τ.μ. × 3,37 € ⇒ το ωμό 0 € έμπαινε στο εξισορροπημένο σύνολο ⇒ «Φθηνότερος» νικητής.
   */
  it('🔴 Κ11 — άλλη μονάδα: το κελί κρατά την τιμή του και τη σημαία· το ΣΥΝΟΛΟ παίρνει κάλυψη, όχι 0 €', () => {
    const M3 = rfqLine('M3', 2, 'm3');
    const fair = quote('F', [qLine('M3', 2, 'm3', 60)]);
    const scan = quote('S', [qLine('M3', 0, 'm2', 3.37)]);
    const { rows, columns } = buildBidLeveling([M3], [fair, scan]);
    expect(rows[0].cells[1]).toMatchObject({
      state: 'priced', unitMismatch: true, leveledAmount: 0, plug: { amount: 120, source: 'highest_bid' },
    });
    expect(rows[0].cells[0].plug).toBeNull();
    expect(rows[0].lowestQuoteId).toBe('F');
    expect(columns[1]).toMatchObject({ pricedAmount: 0, plugs: { count: 1, amount: 120 }, leveledNet: 120 });
    expect(columns[0]).toMatchObject({ pricedAmount: 120, plugs: { count: 0, amount: 0 }, leveledNet: 120 });
  });

  it('Κ11β — η κάλυψη του PM μετρά και σε κελί άλλης μονάδας (ο PM κάνει την αναγωγή)', () => {
    const M3 = rfqLine('M3', 2, 'm3');
    const plug = { rfqLineId: 'M3', amount: 50, note: 'αναγωγή', setBy: 'u1', setAt: null as never };
    const scan = quote('S', [qLine('M3', 0, 'm2', 3.37)], { levelingPlugs: [plug] });
    const { columns } = buildBidLeveling([M3], [scan]);
    expect(columns[0]).toMatchObject({ plugs: { count: 1, amount: 50 }, leveledNet: 50 });
  });
});
