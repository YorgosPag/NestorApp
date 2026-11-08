/**
 * Άγκυρα του κριτή έκδοσης παραγωγής ανά σελίδα (ADR-923 §5.5.2 Β3.1): ποια σελίδα κρατά παράγωγα παλαιότερου παραγωγού.
 */

import type { ImportBatchPages } from '../../types/catalog-import';
import { IMPORT_PAGE_DERIVATION } from '../../vocabulary/catalog-import';
import { currentDerivation, isPageCurrent, pageDerivationOf, stalePages } from '../page-derivation';

const pages = (overrides: Partial<ImportBatchPages> = {}): ImportBatchPages => ({ from: 80, to: 90, done: [], failed: [], ...overrides });

describe('page-derivation (§5.5.2 Β3.1)', () => {
  it('🔴 σελίδα χωρίς σφραγίδα = έκδοση 1: παρτίδα προ-Β3 είναι μπαγιάτικη', () => {
    expect(IMPORT_PAGE_DERIVATION).toBeGreaterThan(1);
    expect(pageDerivationOf(pages({ done: [87] }), 87)).toEqual({ page: 87, version: 1, refusal: null });
    expect(stalePages(pages({ done: [87] }))).toEqual([87]);
  });

  it('σελίδα σφραγισμένη με την τρέχουσα έκδοση δεν ξαναχτίζεται', () => {
    const current = pages({ done: [87], derivations: [currentDerivation(87, null)] });
    expect(isPageCurrent(current, 87)).toBe(true);
    expect(stalePages(current)).toEqual([]);
  });

  it('🔴 άρνηση με την τρέχουσα έκδοση μετρά ως κριμένη: δεν ξαναδοκιμάζεται σε κάθε άνοιγμα', () => {
    const refused = pages({ done: [87], derivations: [currentDerivation(87, 'tablesDrifted')] });
    expect(stalePages(refused)).toEqual([]);
    expect(pageDerivationOf(refused, 87).refusal).toBe('tablesDrifted');
  });

  it('μόνο διαβασμένες σελίδες: αποτυχημένη ή αδιάβαστη δεν έχει παράγωγα να αναβαθμιστούν', () => {
    expect(stalePages(pages({ done: [88], failed: [87] }))).toEqual([88]);
  });

  it('παλαιότερη σφραγίδα ⇒ μπαγιάτικη· αύξουσα σειρά ανεξάρτητα από τη σειρά του `done`', () => {
    const mixed = pages({ done: [89, 81, 85], derivations: [{ page: 85, version: 1, refusal: null }, currentDerivation(89, null)] });
    expect(stalePages(mixed)).toEqual([81, 85]);
  });
});
