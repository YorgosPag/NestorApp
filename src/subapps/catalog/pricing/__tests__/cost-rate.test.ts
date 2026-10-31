/**
 * Επιλογή τιμής κόστους και απόκλιση — ADR-923 §5.11 «3ε».
 */

import type { CostRate, CostRateBook } from '../../types/cost-rate';
import { judgeCostDrift, matchCostRate, type CostSnapshot } from '../cost-rate';

const rate = (overrides: Partial<CostRate> = {}): CostRate => ({
  priceListId: 'cprl_master',
  priceListCode: 'master',
  priceListLabels: { el: 'Master' },
  projectId: null,
  versionId: 'cplv_2',
  versionNumber: 2,
  validFrom: '2026-01-01T00:00:00.000Z',
  lineId: 'line_a',
  subjectKey: 'costItem:OIK-4.01:*',
  atoeCode: 'OIK-4.01',
  region: null,
  unitCode: 'm2',
  priceQuantity: 1,
  netPrice: 1000,
  breakdown: { description: 'Επίχρισμα', material: 600, labor: 300, equipment: 100, defaultWasteBp: 500, materialVariantId: null },
  fenceBp: 2000,
  ...overrides,
});

const QUERY = { atoeCode: 'OIK-4.01', unitCode: 'm2', region: null, projectId: 'proj_1' };

const snapshot = (overrides: Partial<CostSnapshot> = {}): CostSnapshot => ({
  priceListId: 'cprl_master',
  priceListVersionId: 'cplv_1',
  subjectKey: 'costItem:OIK-4.01:*',
  unit: 'm2',
  priceQuantity: 1,
  breakdown: { material: 600, labor: 300, equipment: 100 },
  ...overrides,
});

const book = (current: readonly CostRate[], upcoming: readonly CostRate[] = []): CostRateBook => ({
  freshness: { revision: 1, freshUntil: null },
  asOf: '2026-06-01T00:00:00.000Z',
  priceListIds: ['cprl_master'],
  current,
  upcoming,
});

describe('matchCostRate — ο ειδικότερος νικά, η ισοπαλία δεν λύνεται σιωπηλά', () => {
  it('η γραμμή έργου νικά τον master', () => {
    const project = rate({ lineId: 'line_project', projectId: 'proj_1' });
    const selection = matchCostRate([rate(), project], QUERY);
    expect(selection.kind === 'selected' && selection.winnerId).toBe('line_project');
  });

  it('γραμμή ξένου έργου δεν ισχύει', () => {
    const selection = matchCostRate([rate(), rate({ lineId: 'line_other', projectId: 'proj_2' })], QUERY);
    expect(selection.kind === 'selected' && selection.winnerId).toBe('line_a');
  });

  it('η περιοχή νικά τη γενική, και γραμμή άλλης περιοχής δεν ισχύει', () => {
    const crete = rate({ lineId: 'line_crete', region: 'Κρήτη' });
    const inCrete = matchCostRate([rate(), crete], { ...QUERY, region: 'Κρήτη' });
    expect(inCrete.kind === 'selected' && inCrete.winnerId).toBe('line_crete');
    const elsewhere = matchCostRate([rate(), crete], QUERY);
    expect(elsewhere.kind === 'selected' && elsewhere.winnerId).toBe('line_a');
  });

  it('άλλη μονάδα δεν ταιριάζει ποτέ: καμία σιωπηλή μετατροπή', () => {
    expect(matchCostRate([rate({ unitCode: 'm3' })], QUERY).kind).toBe('none');
  });

  it('δύο master με την ίδια εργασία ⇒ ambiguous, ποτέ «ο πρώτος»', () => {
    const selection = matchCostRate([rate(), rate({ lineId: 'line_b', priceListId: 'cprl_other' })], QUERY);
    expect(selection.kind).toBe('ambiguous');
  });
});

describe('judgeCostDrift', () => {
  it('ίδια ποσά σε νεότερη έκδοση ⇒ τρέχουσα', () => {
    expect(judgeCostDrift(snapshot(), book([rate()])).kind).toBe('current');
  });

  it('+8% ⇒ changed, κάτω από τον φράχτη', () => {
    const next = rate({ netPrice: 1080, breakdown: { ...rate().breakdown, material: 680 } });
    expect(judgeCostDrift(snapshot(), book([next]))).toMatchObject({ kind: 'changed', changeBp: 800, exceedsFence: false });
  });

  it('χαμένο μηδενικό ⇒ πάνω από τον φράχτη', () => {
    const next = rate({ netPrice: 10000, breakdown: { ...rate().breakdown, material: 9600 } });
    expect(judgeCostDrift(snapshot(), book([next]))).toMatchObject({ kind: 'changed', exceedsFence: true });
  });

  it('η σύγκριση γίνεται ανά μονάδα: 1.000 ανά 10 = 100 ανά 1', () => {
    const per10 = rate({ priceQuantity: 10, netPrice: 1000, breakdown: { ...rate().breakdown, material: 600, labor: 300, equipment: 100 } });
    const old = snapshot({ breakdown: { material: 60, labor: 30, equipment: 10 } });
    expect(judgeCostDrift(old, book([per10])).kind).toBe('current');
  });

  it('ίδιο σύνολο με άλλη ανάλυση είναι αλλαγή: η γραμμή BOQ κρατά τα τρία χωριστά', () => {
    const next = rate({ breakdown: { ...rate().breakdown, material: 500, labor: 400 } });
    expect(judgeCostDrift(snapshot(), book([next])).kind).toBe('changed');
  });

  it('διαγραμμένη λίστα ≠ χαμένη γραμμή ≠ άλλη μονάδα', () => {
    expect(judgeCostDrift(snapshot({ priceListId: 'cprl_gone' }), book([rate()])).kind).toBe('listGone');
    expect(judgeCostDrift(snapshot(), book([])).kind).toBe('lineGone');
    expect(judgeCostDrift(snapshot(), book([rate({ unitCode: 'm3' })])).kind).toBe('unitChanged');
  });

  it('μελλοντική έκδοση αναφέρεται πριν ισχύσει, ίδια τιμή όχι', () => {
    const later = rate({ versionId: 'cplv_3', versionNumber: 3, netPrice: 1200, breakdown: { ...rate().breakdown, material: 800 } });
    expect(judgeCostDrift(snapshot(), book([rate()], [later]))).toMatchObject({ kind: 'upcoming', changeBp: 2000 });
    expect(judgeCostDrift(snapshot(), book([rate()], [rate({ versionId: 'cplv_3' })])).kind).toBe('current');
  });
});
