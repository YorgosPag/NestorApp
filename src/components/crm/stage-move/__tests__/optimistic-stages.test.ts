/**
 * ADR-930 — η αισιόδοξη εικόνα: ισχύει όσο η αλήθεια δεν την έχει προλάβει, και φεύγει μόλις την προλάβει.
 */

import type { OpportunityStage } from '@/config/crm/opportunity-stages';
import type { Opportunity } from '@/types/crm';
import { applyPending, reconcilePending } from '../useOptimisticStages';

function opp(id: string, stage: OpportunityStage): Opportunity {
  return { id, title: id, contactId: '', assignedTo: '', status: 'active', stage, createdAt: new Date(0), updatedAt: new Date(0) };
}

describe('reconcilePending', () => {
  it('κρατά τη μετακίνηση όσο τα δεδομένα λένε ακόμη το παλιό στάδιο', () => {
    const pending = new Map<string, OpportunityStage>([['a', 'proposal']]);
    expect(reconcilePending(pending, [opp('a', 'viewing')])).toBe(pending);
  });
  it('τη σβήνει όταν τα δεδομένα φτάσουν στο ίδιο στάδιο', () => {
    const pending = new Map<string, OpportunityStage>([['a', 'proposal'], ['b', 'contract']]);
    expect([...reconcilePending(pending, [opp('a', 'proposal'), opp('b', 'viewing')])]).toEqual([['b', 'contract']]);
  });
  it('τη σβήνει όταν η ευκαιρία εξαφανιστεί (διαγραφή από άλλον)', () => {
    expect(reconcilePending(new Map<string, OpportunityStage>([['gone', 'proposal']]), []).size).toBe(0);
  });
  it('κενό ⇒ ίδια αναφορά (κανένας βρόχος re-render)', () => {
    const empty = new Map<string, OpportunityStage>();
    expect(reconcilePending(empty, [opp('a', 'viewing')])).toBe(empty);
  });
});

describe('applyPending', () => {
  it('δείχνει το αισιόδοξο στάδιο χωρίς να αγγίζει τα υπόλοιπα', () => {
    const shown = applyPending([opp('a', 'viewing'), opp('b', 'viewing')], new Map<string, OpportunityStage>([['a', 'contract']]));
    expect(shown.map((o) => [o.id, o.stage])).toEqual([['a', 'contract'], ['b', 'viewing']]);
  });
});
