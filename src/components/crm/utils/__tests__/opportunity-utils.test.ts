/**
 * `pickChangedOpportunityFields` — η εγγραφή στέλνει μόνο όσα άλλαξε ο άνθρωπος.
 */

import type { Opportunity } from '@/types/crm';
import { pickChangedOpportunityFields } from '../opportunity-utils';

const original: Partial<Opportunity> = {
  id: 'opp_1',
  title: 'Ενδιαφέρον',
  stage: 'initial_contact',
  estimatedValue: 170000,
  interestedIn: { propertyIds: ['prop_1'] },
};

describe('pickChangedOpportunityFields', () => {
  it('δίνει μόνο το πεδίο που άλλαξε', () => {
    const draft: Partial<Opportunity> = { ...original, stage: 'viewing' };
    expect(pickChangedOpportunityFields(original, draft)).toEqual({ stage: 'viewing' });
  });

  it('δίνει κενό όταν δεν άλλαξε τίποτα', () => {
    expect(pickChangedOpportunityFields(original, { ...original })).toEqual({});
  });

  it('κρατά την αλλαγή σε μηδέν', () => {
    const draft: Partial<Opportunity> = { ...original, estimatedValue: 0 };
    expect(pickChangedOpportunityFields(original, draft)).toEqual({ estimatedValue: 0 });
  });

  it('αλλάζει όνομα και contactId μαζί όταν αλλάζει ο πελάτης', () => {
    const before: Partial<Opportunity> = { ...original, fullName: 'Α', contactId: 'cont_1' };
    const draft: Partial<Opportunity> = { ...before, fullName: 'Β', contactId: 'cont_2' };
    expect(pickChangedOpportunityFields(before, draft)).toEqual({ fullName: 'Β', contactId: 'cont_2' });
  });
});
