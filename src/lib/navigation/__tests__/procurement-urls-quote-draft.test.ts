/**
 * ADR-923 §5.13 Ε6ε / Τ6 — το πρόχειρο «Ζητήστε προσφορά» στο URL: ένας γραφέας, ένας αναλυτής, καμία μισή διεύθυνση.
 */

import { parseQuoteDraftParam, quoteDraftHref, quoteDraftQuery, RFQ_CATALOG_PARAM } from '../procurement-urls';

const ADDRESS = { supplierCompanyId: 'comp_aries', modelId: 'cpmod_1', variantId: 'cprod_7-b' };

describe('quoteDraftHref', () => {
  it('απρόθετη διαδρομή rfqs/new με catalog=<προμηθευτής>.<μοντέλο>.<παραλλαγή>', () => {
    expect(quoteDraftHref(ADDRESS)).toBe('/procurement/rfqs/new?catalog=comp_aries.cpmod_1.cprod_7-b');
  });

  it('το ερώτημα είναι το ίδιο για τη σελίδα και για το from-catalog', () => {
    expect(quoteDraftHref(ADDRESS).endsWith(`?${quoteDraftQuery(ADDRESS)}`)).toBe(true);
  });

  it('ο αναλυτής ξαναβρίσκει την ίδια διεύθυνση από τη διαδρομή που έγραψε ο builder', () => {
    const query = new URLSearchParams(quoteDraftHref(ADDRESS).split('?')[1]);
    expect(parseQuoteDraftParam(query.get(RFQ_CATALOG_PARAM))).toEqual(ADDRESS);
  });
});

describe('parseQuoteDraftParam', () => {
  it.each([
    ['απούσα', null],
    ['κενή', ''],
    ['δύο τμήματα', 'comp_a.cpmod_1'],
    ['τέσσερα τμήματα', 'comp_a.cpmod_1.v1.x'],
    ['κενό τμήμα', 'comp_a..v1'],
    ['κάθετος (διαδρομή εγγράφου)', 'comp_a.cpmod_1.v1/../x'],
    ['κενό διάστημα', 'comp_a.cpmod 1.v1'],
    ['υπερβολικό μήκος', `comp_a.${'m'.repeat(129)}.v1`],
  ])('%s ⇒ null', (_label, raw) => {
    expect(parseQuoteDraftParam(raw)).toBeNull();
  });
});
