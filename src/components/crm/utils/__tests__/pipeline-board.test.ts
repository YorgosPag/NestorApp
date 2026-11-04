/**
 * ADR-930 — οι κανόνες του πίνακα ροής: ταξινόμηση, σύνολα στήλης, «μέρες στο στάδιο».
 */

import type { Opportunity } from '@/types/crm';
import { columnTotals, sortOpportunities, stageAgeOf } from '../pipeline-board';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-04T12:00:00Z');

function opp(partial: Partial<Opportunity> & { id: string }): Opportunity {
  return { title: partial.id, contactId: '', assignedTo: '', status: 'active', stage: 'proposal', createdAt: new Date(NOW - DAY), updatedAt: new Date(NOW - DAY), ...partial };
}

describe('columnTotals', () => {
  it('σύνολο + σταθμισμένο: δηλωμένη πιθανότητα, αλλιώς η προεπιλογή του σταδίου', () => {
    const totals = columnTotals([
      opp({ id: 'a', estimatedValue: 100_000, probability: 80 }),
      opp({ id: 'b', estimatedValue: 200_000, stage: 'proposal' }), // προεπιλογή 50%
      opp({ id: 'c' }), // χωρίς αξία
    ]);
    expect(totals).toEqual({ count: 3, total: 300_000, weighted: 80_000 + 100_000 });
  });
  it('κενή στήλη ⇒ μηδενικά', () => expect(columnTotals([])).toEqual({ count: 0, total: 0, weighted: 0 }));
});

describe('sortOpportunities', () => {
  const list = [
    opp({ id: 'low', estimatedValue: 10, lastActivity: new Date(NOW - 3 * DAY), expectedCloseDate: new Date(NOW + 30 * DAY) }),
    opp({ id: 'none', lastActivity: new Date(NOW - DAY) }),
    opp({ id: 'high', estimatedValue: 99, lastActivity: new Date(NOW - 2 * DAY), expectedCloseDate: new Date(NOW + 5 * DAY) }),
  ];
  it('αξία: μεγαλύτερη πρώτα, άγνωστη στο τέλος', () => expect(sortOpportunities(list, 'value').map((o) => o.id)).toEqual(['high', 'low', 'none']));
  it('δραστηριότητα: πιο πρόσφατη πρώτα', () => expect(sortOpportunities(list, 'activity').map((o) => o.id)).toEqual(['none', 'high', 'low']));
  it('αναμενόμενο κλείσιμο: πιο κοντινό πρώτα, άγνωστο στο τέλος', () => expect(sortOpportunities(list, 'closeDate').map((o) => o.id)).toEqual(['high', 'low', 'none']));
  it('δεν πειράζει τον πίνακα εισόδου', () => {
    const before = list.map((o) => o.id);
    sortOpportunities(list, 'value');
    expect(list.map((o) => o.id)).toEqual(before);
  });
  it('ισοπαλία ⇒ σταθερή σειρά κατά αναγνωριστικό', () => {
    const tied = [opp({ id: 'b' }), opp({ id: 'a' })];
    expect(sortOpportunities(tied, 'value').map((o) => o.id)).toEqual(['a', 'b']);
  });
});

describe('stageAgeOf', () => {
  it('μετρά από το stageChangedAt και κρίνει «παγωμένη» με το όριο του σταδίου', () => {
    expect(stageAgeOf(opp({ id: 'x', stage: 'initial_contact', stageChangedAt: new Date(NOW - 8 * DAY) }), NOW)).toEqual({ days: 8, stale: true });
    expect(stageAgeOf(opp({ id: 'y', stage: 'initial_contact', stageChangedAt: new Date(NOW - 3 * DAY) }), NOW)).toEqual({ days: 3, stale: false });
  });
  it('παλιά εγγραφή χωρίς stageChangedAt ⇒ από τη δημιουργία', () => {
    expect(stageAgeOf(opp({ id: 'z', createdAt: new Date(NOW - 2 * DAY) }), NOW)?.days).toBe(2);
  });
  it('κλειστό στάδιο δεν παγώνει ποτέ', () => {
    expect(stageAgeOf(opp({ id: 'w', stage: 'closed_won', stageChangedAt: new Date(NOW - 400 * DAY) }), NOW)?.stale).toBe(false);
  });
});
