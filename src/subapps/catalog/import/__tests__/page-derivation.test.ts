/**
 * Άγκυρα του κριτή έκδοσης παραγωγής ανά σελίδα (ADR-923 §5.5.2 Β3.1): ποια σελίδα κρατά παράγωγα παλαιότερου παραγωγού
 * **ή παλαιότερου σχήματος οικογένειας** (Γ12).
 */

import type { ImportBatchPages } from '../../types/catalog-import';
import { IMPORT_PAGE_DERIVATION } from '../../vocabulary/catalog-import';
import { currentDerivation, isPageCurrent, pageDerivationOf, stalePages } from '../page-derivation';

const pages = (overrides: Partial<ImportBatchPages> = {}): ImportBatchPages => ({ from: 80, to: 90, done: [], failed: [], ...overrides });
/** Η τρέχουσα αναθεώρηση της οικογένειας στα σενάρια. */
const R = 7;

describe('page-derivation (§5.5.2 Β3.1)', () => {
  it('🔴 σελίδα χωρίς σφραγίδα = έκδοση 1: παρτίδα προ-Β3 είναι μπαγιάτικη', () => {
    expect(IMPORT_PAGE_DERIVATION).toBeGreaterThan(1);
    expect(pageDerivationOf(pages({ done: [87] }), 87)).toEqual({ page: 87, version: 1, refusal: null });
    expect(stalePages(pages({ done: [87] }), R)).toEqual([87]);
  });

  it('σελίδα σφραγισμένη με την τρέχουσα έκδοση δεν ξαναχτίζεται', () => {
    const current = pages({ done: [87], derivations: [currentDerivation(87, null, R)] });
    expect(isPageCurrent(current, 87, R)).toBe(true);
    expect(stalePages(current, R)).toEqual([]);
  });

  it('🔴 άρνηση με την τρέχουσα έκδοση μετρά ως κριμένη: δεν ξαναδοκιμάζεται σε κάθε άνοιγμα', () => {
    const refused = pages({ done: [87], derivations: [currentDerivation(87, 'tablesDrifted', R)] });
    expect(stalePages(refused, R)).toEqual([]);
    expect(pageDerivationOf(refused, 87).refusal).toBe('tablesDrifted');
  });

  it('μόνο διαβασμένες σελίδες: αποτυχημένη ή αδιάβαστη δεν έχει παράγωγα να αναβαθμιστούν', () => {
    expect(stalePages(pages({ done: [88], failed: [87] }), R)).toEqual([88]);
  });

  it('παλαιότερη σφραγίδα ⇒ μπαγιάτικη· αύξουσα σειρά ανεξάρτητα από τη σειρά του `done`', () => {
    const mixed = pages({ done: [89, 81, 85], derivations: [{ page: 85, version: 1, refusal: null }, currentDerivation(89, null, R)] });
    expect(stalePages(mixed, R)).toEqual([81, 85]);
  });

  it('🔴 Γ12: σφραγίδα παλαιότερου σχήματος ⇒ μπαγιάτικη, ακόμη και με την τρέχουσα έκδοση παραγωγής', () => {
    const before = pages({ done: [87], derivations: [currentDerivation(87, null, R - 1)] });
    expect(isPageCurrent(before, 87, R)).toBe(false);
    expect(stalePages(before, R)).toEqual([87]);
  });

  it('🔴 Γ12: άρνηση απέναντι σε παλιό σχήμα ξαναδοκιμάζεται — το νέο σχήμα μπορεί να τη λύνει', () => {
    expect(stalePages(pages({ done: [87], derivations: [currentDerivation(87, 'lineUnknown', R - 1)] }), R)).toEqual([87]);
  });

  it('Γ12: σφραγίδα προ-Γ12 (χωρίς αναθεώρηση σχήματος) ξαναχτίζεται μία φορά', () => {
    const legacy = pages({ done: [87], derivations: [{ page: 87, version: IMPORT_PAGE_DERIVATION, refusal: null }] });
    expect(stalePages(legacy, R)).toEqual([87]);
  });

  it('Γ12: παρτίδα χωρίς οικογένεια (`null`) ⇒ κρίνει μόνο η έκδοση παραγωγής, όπως πριν', () => {
    const legacy = pages({ done: [87], derivations: [{ page: 87, version: IMPORT_PAGE_DERIVATION, refusal: null }] });
    expect(isPageCurrent(legacy, 87, null)).toBe(true);
  });
});
