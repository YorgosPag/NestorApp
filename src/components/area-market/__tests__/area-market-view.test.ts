/**
 * ADR-890 Φ1 — η όψη της σελίδας περιοχής: ποιες προσφορές δείχνονται, πότε ο αριθμός του Δήμου συνοδεύει
 * το πλήθος μιας Δ.Ε. (αναγωγή όπως το ONS), και η σειρά των κάδων.
 */

import { breakdownViews, exclusionEntries, offerViews } from '@/components/area-market/area-market-view';
import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import { summarizeArea } from '@/lib/market/area-market-summary';

const apartments = (count: number, idPrefix: string) =>
  Array.from({ length: count }, (_, index) => listing({ id: `${idPrefix}_${index}`, areaSqm: 60 + index * 30 }));

describe('offerViews', () => {
  it('δείχνει μόνο προσφορές με αγγελίες', () => {
    const snapshot = summarizeArea('municipal_unit:070101', '2026-09-26', apartments(2, 'a'));
    expect(offerViews(snapshot, null).map((view) => view.offer)).toEqual(['sale']);
  });

  it('Δ.Ε. κάτω από το κατώφλι + Δήμος πάνω ⇒ ο αριθμός του Δήμου συνοδεύει το πλήθος', () => {
    const unit = summarizeArea('municipal_unit:070101', '2026-09-26', apartments(2, 'a'));
    const municipality = summarizeArea('municipality:0701', '2026-09-26', apartments(6, 'b'));
    const [sale] = offerViews(unit, municipality);
    expect(sale.segments[0].parentUnitPrice).toEqual(expect.objectContaining({ n: 6 }));
  });

  it('Δ.Ε. ΠΑΝΩ από το κατώφλι ⇒ καμία αναγωγή (ο τοπικός αριθμός αρκεί)', () => {
    const unit = summarizeArea('municipal_unit:070101', '2026-09-26', apartments(5, 'a'));
    const municipality = summarizeArea('municipality:0701', '2026-09-26', apartments(9, 'b'));
    expect(offerViews(unit, municipality)[0].segments[0].parentUnitPrice).toBeNull();
  });
});

describe('breakdownViews / exclusionEntries', () => {
  it('οι κάδοι στη σειρά του πίνακα, μόνο οι μη κενοί', () => {
    const snapshot = summarizeArea('municipality:0701', '2026-09-26', apartments(5, 'a'));
    const summary = snapshot.offers.sale.segments.apartment;
    if (summary === undefined) throw new Error('λείπει το τμήμα');
    const size = breakdownViews('apartment', summary).find((view) => view.axis === 'size');
    // εμβαδά 60 · 90 · 120 · 150 · 180 ⇒ κανένα στο «έως 49» ή στο «200+»
    expect(size?.rows.map((row) => row.key)).toEqual(['50-79', '80-119', '120-199']);
  });

  it('ADR-890 §12.1 — άξονας ΑΠΩΝ (παλιό στιγμιότυπο) ⇒ κανένας πίνακας· ΠΑΡΩΝ χωρίς δηλώσεις ⇒ πίνακας με «δεν δήλωσαν»', () => {
    const summary = summarizeArea('municipality:0701', '2026-09-26', apartments(5, 'a')).offers.sale.segments.apartment;
    if (summary === undefined) throw new Error('λείπει το τμήμα');
    const measured = breakdownViews('apartment', summary).find((view) => view.axis === 'yearBuilt');
    expect(measured).toEqual({ axis: 'yearBuilt', rows: [], undeclared: 5 });
    const { yearBuilt: _new, ...legacy } = summary.breakdowns;
    expect(breakdownViews('apartment', { ...summary, breakdowns: legacy }).map((view) => view.axis)).not.toContain('yearBuilt');
  });

  it('οι λόγοι αποκλεισμού με μηδέν δεν εμφανίζονται', () => {
    const snapshot = summarizeArea('municipality:0701', '2026-09-26', [listing({ areaSqm: null })]);
    expect(exclusionEntries(snapshot.offers.sale)).toEqual([['noSize', 1]]);
  });
});
