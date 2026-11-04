/**
 * ADR-929 Δ11 — η ταυτότητα της ανάγνωσης κάτοψης ΕΙΝΑΙ η κρυφή μνήμη της.
 *
 * - **ιδεμποτία**: ίδιο (εταιρεία, κλειδί) ⇒ ίδιο id — μετάλλαξη: `generateId` αντί `mintDeterministicV4Id`
 * - **διάκριση**: άλλη εταιρεία / άλλο κλειδί ⇒ άλλο id — μετάλλαξη: σπόρος χωρίς την εταιρεία
 * - **εγκυρότητα**: ο επικυρωτής του ίδιου έργου τη δέχεται (v4, ADR-841 Α9.6)
 */

import { EnterpriseIdService } from '../enterprise-id.service';
import { isValidEnterpriseId } from '../enterprise-id-parse';

describe('ADR-929 plan reading id', () => {
  const service = new EnterpriseIdService({ enableLogging: false, enableCache: false, cacheSize: 0 });
  const KEY = 'file_1|1|align_abc|gpt-x|1';

  it('is deterministic per (company, reading key), prefixed and valid', () => {
    const id = service.generateDeterministicPlanReadingId('comp_1', KEY);
    expect(id).toBe(service.generateDeterministicPlanReadingId('comp_1', KEY));
    expect(id).toMatch(/^plrd_/);
    expect(isValidEnterpriseId(id)).toBe(true);
  });

  it('never crosses companies, and a different key is a different reading', () => {
    const id = service.generateDeterministicPlanReadingId('comp_1', KEY);
    expect(service.generateDeterministicPlanReadingId('comp_2', KEY)).not.toBe(id);
    expect(service.generateDeterministicPlanReadingId('comp_1', `${KEY}x`)).not.toBe(id);
  });
});
