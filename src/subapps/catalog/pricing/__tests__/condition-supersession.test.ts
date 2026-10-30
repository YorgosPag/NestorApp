/**
 * Σ7 (ζωντανή επαλήθευση ADR-923 «3δ»): «Νέα περίοδος από 1/12» πάνω σε ανοιχτή συνθήκη ήταν ΠΑΝΤΑ ασάφεια.
 * Άγκυρα: οριοθέτηση ΜΟΝΟ χωρίς απώλεια (SAP VK11 «cuts off») — ό,τι θα ήθελε σβήσιμο ή σπάσιμο μένει ασάφεια.
 */

import type { DiscountConditionDefinition } from '../../types/price-list';
import { applyDelimitations, planConditionSupersession } from '../condition-supersession';

const NOV = '2026-11-01T00:00:00.000Z';
const DEC = '2026-12-01T00:00:00.000Z';
const JAN = '2027-01-01T00:00:00.000Z';

const definition = (validFrom: string | null, validUntil: string | null, over: Partial<DiscountConditionDefinition> = {}): DiscountConditionDefinition => ({
  discountGroupId: 'dgrp_tosh',
  audience: { kind: 'anonymous' },
  validFrom,
  validUntil,
  rule: { kind: 'chain', steps: [5000] },
  ...over,
});
const peer = (id: string, validFrom: string | null, validUntil: string | null) => ({ id, definition: definition(validFrom, validUntil) });
const ambiguityWith = (id: string) => ({ code: 'discountConditionAmbiguous', path: 'validFrom', params: { conditionId: id } });

describe('planConditionSupersession — η νέα περίοδος οριοθετεί, ποτέ δεν σβήνει, ποτέ δεν σπάει', () => {
  it('ανοιχτή «από πάντα» + νέα από 1/12 ⇒ η ανοιχτή λήγει 1/12 (ημιανοιχτό), καμία ασάφεια', () => {
    expect(planConditionSupersession(definition(DEC, null), [peer('open', null, null)])).toEqual({ delimitations: [{ id: 'open', validUntil: DEC }], issues: [] });
  });

  it('η προηγούμενη λήγει ΜΕΣΑ στη νέα (μερική επικάλυψη) ⇒ οριοθέτηση στην αρχή της νέας', () => {
    expect(planConditionSupersession(definition(DEC, null), [peer('nov', NOV, JAN)]).delimitations).toEqual([{ id: 'nov', validUntil: DEC }]);
  });

  it('⛔ προσφορά ΜΕΣΑ σε ανοιχτή (θα ήθελε σπάσιμο σε δύο) ⇒ ασάφεια', () => {
    expect(planConditionSupersession(definition(NOV, DEC), [peer('open', null, null)])).toEqual({ delimitations: [], issues: [ambiguityWith('open')] });
  });

  it('⛔ η άλλη χωράει ΟΛΗ μέσα στη νέα ή αρχίζει μαζί/μετά (το SAP τη σβήνει) ⇒ ασάφεια', () => {
    expect(planConditionSupersession(definition(NOV, null), [peer('dec', DEC, JAN)]).issues).toEqual([ambiguityWith('dec')]);
    expect(planConditionSupersession(definition(NOV, null), [peer('twin', NOV, null)]).issues).toEqual([ambiguityWith('twin')]);
  });

  it('⛔ νέα «από πάντα» δεν οριοθετεί κανέναν (δεν υπάρχει «προηγούμενη») ⇒ ο κανόνας της 3α όπως ήταν', () => {
    expect(planConditionSupersession(definition(null, null), [peer('open', null, null)])).toEqual({ delimitations: [], issues: [ambiguityWith('open')] });
  });

  it('άλλη υποδοχή ή διαδοχικές περίοδοι ⇒ τίποτα · μόνο οι συγκρουόμενες οριοθετούνται', () => {
    const other = { id: 'other', definition: definition(null, null, { audience: { kind: 'signedIn' } }) };
    expect(planConditionSupersession(definition(DEC, null), [other, peer('nov', NOV, DEC)])).toEqual({ delimitations: [], issues: [] });
  });
});

describe('applyDelimitations — οι συνθήκες μετά το σχέδιο', () => {
  it('μόνο οι οριοθετούμενες αλλάζουν «έως» · χωρίς σχέδιο ⇒ ίδιες τιμές', () => {
    const peers = [peer('open', null, null), peer('nov', NOV, DEC)];
    expect(applyDelimitations(peers, [{ id: 'open', validUntil: NOV }]).map((entry) => entry.definition.validUntil)).toEqual([NOV, DEC]);
    expect(applyDelimitations(peers, [])).toEqual(peers);
  });
});
