/**
 * Αποσβέσεις → Βιβλίο Ε-Ε: η ΑΠΟΦΑΣΗ σύγκλισης (ADR-ACC-010 §2.1.1 Φάση 5) — καθαρές συναρτήσεις, νούμερα με το χέρι.
 *
 *   Δ1  πρώτη καταχώριση: όλο το ποσό, εγγραφή Ε-Ε έξοδο 31/12 με κωδικούς από το SSoT κατηγοριών
 *   Δ2  ιδεμπότητα: καταχωρημένο = σωστό ⇒ τίποτα
 *   Δ3  SAP repeat run: διορθωμένα στοιχεία ⇒ ΜΟΝΟ η διαφορά (θετική ή αρνητική)
 *   Δ4  Xero rollback: αντιλογισμός ΜΟΝΟ της νεότερης χρήσης· η προβολή γυρίζει στην προηγούμενη
 *   Δ5  προβολή: η νεότερη χρήση κρατά την εικόνα · `fully_depreciated` πάει κι έρχεται · `disposed` μένει
 *   Δ6  κανόνας περιόδου: ΕΝΑΣ για μηχανή και γραφέα
 */

import { getCategoryByCode } from '../../../config/account-categories';
import type { DepreciationDecision, DepreciationRecord, FixedAsset } from '../../../types/assets';
import type { FiscalPeriod } from '../../../types/fiscal-period';
import { postingPeriodDenialOf } from '../../fiscal-period-transitions';
import {
  assetProjectionAt,
  decideDepreciation,
} from '../depreciation-booking';

/** 10.000 € μηχάνημα 10%, έναρξη 10/12/2024 ⇒ 1.000 € ανά πλήρη χρήση από το 2025. */
function asset(overrides: Partial<FixedAsset> = {}): FixedAsset {
  return {
    assetId: 'ast_1', description: 'CNC', category: 'machinery', status: 'active', companyId: 'comp_a',
    acquisitionCost: 10000, accumulatedDepreciation: 0, netBookValue: 10000, residualValue: 0,
    acquisitionDate: '2024-12-10', depreciationStartDate: '2024-12-10', fullyDepreciatedDate: null, disposalDate: null,
    depreciationRate: 10, depreciationMethod: 'straight_line', usefulLifeYears: 10, lastDepreciatedFiscalYear: null,
    purchaseInvoiceNumber: null, supplierName: null, supplierVatNumber: null, notes: null, acquisitionFiscalYear: 2024,
    createdAt: '2024-12-10T00:00:00.000Z', updatedAt: '2024-12-10T00:00:00.000Z',
    ...overrides,
  };
}

function booked(amount: number, fiscalYear = 2025): DepreciationRecord {
  return {
    recordId: 'depr_1', assetId: 'ast_1', fiscalYear, acquisitionCost: 10000, openingAccumulatedDepreciation: 0,
    annualDepreciation: amount, closingAccumulatedDepreciation: amount, closingNetBookValue: 10000 - amount,
    appliedRate: 10, monthsApplied: 12, journalEntryId: 'je_1', journalEntryIds: ['je_1'], revision: 1,
    calculatedAt: '2026-01-15T00:00:00.000Z',
  };
}

function posted(decision: DepreciationDecision): Extract<DepreciationDecision, { kind: 'post' }> {
  if (decision.kind !== 'post') throw new Error(`expected a posting, got ${decision.kind}`);
  return decision;
}

describe('Δ1 — πρώτη καταχώριση', () => {
  it('όλο το ποσό· εγγραφή Ε-Ε: έξοδο `depreciation` 31/12, ΦΠΑ 0, χωρίς πληρωμή, κωδικοί από το SSoT', () => {
    const decision = posted(decideDepreciation('book', 2025, { asset: asset(), current: null }));
    const category = getCategoryByCode('depreciation');

    expect(decision.record.annualDepreciation).toBe(1000);
    expect(decision.journal).toMatchObject({
      date: '2025-12-31', type: 'expense', category: 'depreciation', description: 'CNC',
      netAmount: 1000, grossAmount: 1000, vatRate: 0, vatAmount: 0, vatDeductible: false, paymentMethod: 'non_cash',
      mydataCode: category?.mydataCode, e3Code: category?.e3Code, fiscalYear: 2025, quarter: 4,
    });
    expect(decision.assetProjection).toMatchObject({
      accumulatedDepreciation: 1000, netBookValue: 9000, status: 'active', lastDepreciatedFiscalYear: 2025,
      depreciatedFiscalYears: [2025],
    });
  });

  it('εκτός εκμετάλλευσης / χωρίς απόσβεση και τίποτα καταχωρημένο ⇒ τίποτα', () => {
    expect(decideDepreciation('book', 2025, { asset: asset({ status: 'inactive' }), current: null })).toEqual({ kind: 'unchanged' });
    expect(decideDepreciation('book', 2025, { asset: asset({ depreciationStartDate: '2010-12-01' }), current: null }))
      .toEqual({ kind: 'unchanged' });
  });
});

describe('Δ2 — ιδεμπότητα', () => {
  it('καταχωρημένο = σωστό ⇒ καμία εγγραφή, καμία προβολή', () => {
    const current = asset({ depreciatedFiscalYears: [2025], lastDepreciatedFiscalYear: 2025 });
    expect(decideDepreciation('book', 2025, { asset: current, current: booked(1000) })).toEqual({ kind: 'unchanged' });
  });
});

describe('Δ3 — SAP repeat run: μόνο η διαφορά', () => {
  it('το κόστος διορθώθηκε 10.000 → 12.000 ⇒ +200, η εγγραφή απόσβεσης γράφει 1.200', () => {
    const fixed = asset({ acquisitionCost: 12000, depreciatedFiscalYears: [2025], lastDepreciatedFiscalYear: 2025 });
    const decision = posted(decideDepreciation('book', 2025, { asset: fixed, current: booked(1000) }));

    expect(decision.journal.netAmount).toBe(200);
    expect(decision.record.annualDepreciation).toBe(1200);
  });

  it('έγινε `inactive` αφού καταχωρήθηκε ⇒ −1.000 (σύγκλιση στο 0) και η χρήση φεύγει από την προβολή', () => {
    const idle = asset({ status: 'inactive', depreciatedFiscalYears: [2025], lastDepreciatedFiscalYear: 2025 });
    const decision = posted(decideDepreciation('book', 2025, { asset: idle, current: booked(1000) }));

    expect(decision.journal.netAmount).toBe(-1000);
    expect(decision.assetProjection).toMatchObject({ depreciatedFiscalYears: [], lastDepreciatedFiscalYear: null });
  });
});

describe('Δ4 — Xero rollback', () => {
  it('νεότερη χρήση ⇒ αντιλογισμός ΟΛΟΥ του καταχωρημένου, κλείσιμο = άνοιγμα, πάγιο ως καινούργιο', () => {
    const latest = asset({ depreciatedFiscalYears: [2025], lastDepreciatedFiscalYear: 2025, accumulatedDepreciation: 1000 });
    const decision = posted(decideDepreciation('reverse', 2025, { asset: latest, current: booked(1000) }));

    expect(decision.journal.netAmount).toBe(-1000);
    expect(decision.record).toMatchObject({ annualDepreciation: 0, closingAccumulatedDepreciation: 0, closingNetBookValue: 10000, monthsApplied: 0 });
    expect(decision.assetProjection).toMatchObject({ accumulatedDepreciation: 0, netBookValue: 10000, lastDepreciatedFiscalYear: null });
  });

  it('καταχωρημένη νεότερη χρήση ⇒ άρνηση (θα άφηνε κενό στη σειρά)', () => {
    const later = asset({ depreciatedFiscalYears: [2025, 2026], lastDepreciatedFiscalYear: 2026 });
    expect(decideDepreciation('reverse', 2025, { asset: later, current: booked(1000) }))
      .toEqual({ kind: 'refused', reason: 'LATER_YEAR_POSTED' });
  });

  it('αναίρεση του 2026 με καταχωρημένο το 2025 ⇒ η προβολή γυρίζει στο κλείσιμο του 2025', () => {
    const two = asset({ depreciatedFiscalYears: [2025, 2026], lastDepreciatedFiscalYear: 2026 });
    const decision = posted(decideDepreciation('reverse', 2026, { asset: two, current: booked(1000, 2026) }));

    expect(decision.assetProjection).toMatchObject({
      accumulatedDepreciation: 1000, netBookValue: 9000, lastDepreciatedFiscalYear: 2025, depreciatedFiscalYears: [2025],
    });
  });

  it('τίποτα καταχωρημένο ⇒ τίποτα (δεύτερη αναίρεση = no-op)', () => {
    expect(decideDepreciation('reverse', 2025, { asset: asset(), current: booked(0) })).toEqual({ kind: 'unchanged' });
    expect(decideDepreciation('reverse', 2025, { asset: asset(), current: null })).toEqual({ kind: 'unchanged' });
  });

  it('πάγιο πριν από τη Φάση 5 (μόνο `lastDepreciatedFiscalYear`) ⇒ γνωστή η νεότερη χρήση', () => {
    const legacy = asset({ lastDepreciatedFiscalYear: 2026 });
    expect(decideDepreciation('reverse', 2025, { asset: legacy, current: booked(1000) }).kind).toBe('refused');
  });
});

describe('Δ5 — προβολή του παγίου', () => {
  it('παλαιότερη χρήση μετά από νεότερη ⇒ η εικόνα μένει στη νεότερη', () => {
    const decision = posted(decideDepreciation('book', 2025, {
      asset: asset({ depreciatedFiscalYears: [2026], lastDepreciatedFiscalYear: 2026 }), current: null,
    }));
    expect(decision.assetProjection).toMatchObject({ accumulatedDepreciation: 2000, lastDepreciatedFiscalYear: 2026, depreciatedFiscalYears: [2025, 2026] });
  });

  it('`active` ⇒ `fully_depreciated` στην πλήρη απόσβεση, και πίσω σε `active` στην αναίρεση', () => {
    const old = asset({ acquisitionCost: 25000, depreciationRate: 16, depreciationStartDate: '2018-12-01' });
    expect(assetProjectionAt(old, [2025])).toMatchObject({ status: 'fully_depreciated', fullyDepreciatedDate: '2025-12-31', netBookValue: 0 });
    expect(assetProjectionAt({ ...old, status: 'fully_depreciated' }, [2024])).toMatchObject({ status: 'active', fullyDepreciatedDate: null });
  });

  it('εκποιημένο μένει `disposed`· αποσβένεται ως τον μήνα εκποίησης', () => {
    const sold = asset({ status: 'disposed', disposalDate: '2025-06-30', acquisitionCost: 12000 });
    const decision = posted(decideDepreciation('book', 2025, { asset: sold, current: null }));
    expect([decision.record.annualDepreciation, decision.assetProjection?.status]).toEqual([600, 'disposed']);
  });
});

describe('Δ6 — κανόνας περιόδου', () => {
  const period = (overrides: Partial<FiscalPeriod> = {}) => ({ periodId: '2025-12', status: 'OPEN', ...overrides }) as FiscalPeriod;

  // Φ6: η περίοδος φτάνει ΗΔΗ ως περίοδος του μισθωτή (διεύθυνση ανά μισθωτή + `ownedOrNull`) — ξένη = `null`.
  it.each([
    [null, 'PERIOD_NOT_FOUND'],
    [period(), null],
    [period({ status: 'CLOSED' }), 'PERIOD_CLOSED'],
    [period({ status: 'LOCKED' }), 'PERIOD_LOCKED'],
  ] as const)('%o ⇒ %s', (input, expected) => {
    expect(postingPeriodDenialOf(input as FiscalPeriod | null)).toBe(expected);
  });
});
