/**
 * Άγκυρα του κριτή έκδοσης παραγωγής ανά σελίδα (ADR-923 §5.5.2 Β3.1): ποια σελίδα κρατά παράγωγα παλαιότερου παραγωγού
 * **ή παλαιότερου σχήματος οικογένειας** (Γ12).
 */

import type { ImportBatchPages, ImportLineDecision, ImportLineOverride } from '../../types/catalog-import';
import { IMPORT_PAGE_DERIVATION } from '../../vocabulary/catalog-import';
import { currentDerivation, derivationAfterTable, isPageCurrent, pageDerivationOf, stalePages } from '../page-derivation';
import { pageDecisionsDigest } from '../page-line-overrides';

const pages = (overrides: Partial<ImportBatchPages> = {}): ImportBatchPages => ({ from: 80, to: 90, done: [], failed: [], ...overrides });
/** Η τρέχουσα αναθεώρηση της οικογένειας στα σενάρια. */
const R = 7;
/** Το αποτύπωμα σελίδας χωρίς αποφάσεις που αλλάζουν παράγωγα. */
const NONE = pageDecisionsDigest(undefined, 87);

const override = (line: number, decision: ImportLineDecision, extra: Partial<ImportLineOverride> = {}): ImportLineOverride =>
  ({ page: 87, table: 't0', line, decision, by: 'usr_a', at: '2026-11-13T20:43:28Z', ...extra });
const PHASES: ImportLineDecision = { kind: 'attribute', attributeId: 'cattr_phases' };

describe('page-derivation (§5.5.2 Β3.1)', () => {
  it('🔴 σελίδα χωρίς σφραγίδα = έκδοση 1: παρτίδα προ-Β3 είναι μπαγιάτικη', () => {
    expect(IMPORT_PAGE_DERIVATION).toBeGreaterThan(1);
    expect(pageDerivationOf(pages({ done: [87] }), 87)).toEqual({ page: 87, version: 1, refusal: null });
    expect(stalePages(pages({ done: [87] }), R)).toEqual([87]);
  });

  it('σελίδα σφραγισμένη με την τρέχουσα έκδοση δεν ξαναχτίζεται', () => {
    const current = pages({ done: [87], derivations: [currentDerivation(87, null, R, NONE)] });
    expect(isPageCurrent(current, 87, R)).toBe(true);
    expect(stalePages(current, R)).toEqual([]);
  });

  it('🔴 άρνηση με την τρέχουσα έκδοση μετρά ως κριμένη: δεν ξαναδοκιμάζεται σε κάθε άνοιγμα', () => {
    const refused = pages({ done: [87], derivations: [currentDerivation(87, 'tablesDrifted', R, NONE)] });
    expect(stalePages(refused, R)).toEqual([]);
    expect(pageDerivationOf(refused, 87).refusal).toBe('tablesDrifted');
  });

  it('μόνο διαβασμένες σελίδες: αποτυχημένη ή αδιάβαστη δεν έχει παράγωγα να αναβαθμιστούν', () => {
    expect(stalePages(pages({ done: [88], failed: [87] }), R)).toEqual([88]);
  });

  it('παλαιότερη σφραγίδα ⇒ μπαγιάτικη· αύξουσα σειρά ανεξάρτητα από τη σειρά του `done`', () => {
    const mixed = pages({ done: [89, 81, 85], derivations: [{ page: 85, version: 1, refusal: null }, currentDerivation(89, null, R, NONE)] });
    expect(stalePages(mixed, R)).toEqual([81, 85]);
  });

  it('🔴 Γ12: σφραγίδα παλαιότερου σχήματος ⇒ μπαγιάτικη, ακόμη και με την τρέχουσα έκδοση παραγωγής', () => {
    const before = pages({ done: [87], derivations: [currentDerivation(87, null, R - 1, NONE)] });
    expect(isPageCurrent(before, 87, R)).toBe(false);
    expect(stalePages(before, R)).toEqual([87]);
  });

  it('🔴 Γ12: άρνηση απέναντι σε παλιό σχήμα ξαναδοκιμάζεται — το νέο σχήμα μπορεί να τη λύνει', () => {
    expect(stalePages(pages({ done: [87], derivations: [currentDerivation(87, 'lineUnknown', R - 1, NONE)] }), R)).toEqual([87]);
  });

  it('Γ12: σφραγίδα προ-Γ12 (χωρίς αναθεώρηση σχήματος) ξαναχτίζεται μία φορά', () => {
    const legacy = pages({ done: [87], derivations: [{ page: 87, version: IMPORT_PAGE_DERIVATION, refusal: null }] });
    expect(stalePages(legacy, R)).toEqual([87]);
  });

  it('Γ12: παρτίδα χωρίς οικογένεια (`null`) ⇒ κρίνει μόνο η έκδοση παραγωγής, όπως πριν', () => {
    const legacy = pages({ done: [87], derivations: [{ page: 87, version: IMPORT_PAGE_DERIVATION, refusal: null, decisionsDigest: NONE }] });
    expect(isPageCurrent(legacy, 87, null)).toBe(true);
  });
});

describe('🔴 page-derivation §5.5.2 Β3.2: τα παράγωγα βγήκαν από τις ΤΡΕΧΟΥΣΕΣ αποφάσεις;', () => {
  const stampedOn = (lineOverrides: readonly ImportLineOverride[]) =>
    currentDerivation(87, null, R, pageDecisionsDigest(lineOverrides, 87));

  it('🔴 live 2026-11-13: απόφαση γραμμένη χωρίς την πρότασή της ⇒ η σελίδα είναι μπαγιάτικη και ξαναχτίζεται', () => {
    const half = pages({ done: [87], derivations: [stampedOn([])], lineOverrides: [override(4, PHASES)] });
    expect(isPageCurrent(half, 87, R)).toBe(false);
    expect(stalePages(half, R)).toEqual([87]);
  });

  it('ίδιες αποφάσεις ⇒ τρέχουσα· ποιος/πότε/προέλευση δεν αλλάζουν τα παράγωγα', () => {
    const stamped = [override(4, PHASES)];
    const later = [override(4, PHASES, { by: 'usr_b', at: '2026-11-14T08:00:00Z', origin: { kind: 'memory', memoryId: 'cilm_1', count: 2, sourceBatchId: 'cibat_1' } })];
    expect(isPageCurrent(pages({ done: [87], derivations: [stampedOn(stamped)], lineOverrides: later }), 87, R)).toBe(true);
  });

  it('η «Αγνόηση» δεν ξαναχτίζει πίνακα, άρα δεν κάνει τη σελίδα μπαγιάτικη', () => {
    const ignored = pages({ done: [87], derivations: [stampedOn([])], lineOverrides: [override(9, { kind: 'ignore' })] });
    expect(isPageCurrent(ignored, 87, R)).toBe(true);
  });

  it('απόφαση σε άλλη σελίδα δεν αγγίζει αυτήν· η σειρά των αποφάσεων δεν μετρά', () => {
    const a = override(4, PHASES);
    const b = override(7, { kind: 'price', unitCode: 'pcs' });
    const elsewhere = { ...override(1, PHASES), page: 85 };
    const shuffled = pages({ done: [87], derivations: [stampedOn([a, b])], lineOverrides: [elsewhere, b, a] });
    expect(isPageCurrent(shuffled, 87, R)).toBe(true);
  });

  it('σφραγίδα προ-Β3.2 (χωρίς αποτύπωμα) ξαναχτίζεται μία φορά, ακόμη και με τρέχουσα έκδοση και σχήμα', () => {
    const legacy = pages({ done: [87], derivations: [{ page: 87, version: IMPORT_PAGE_DERIVATION, refusal: null, schemaRevision: R }] });
    expect(stalePages(legacy, R)).toEqual([87]);
  });

  it('ξαναχτίσιμο ενός πίνακα σε συνεπή σελίδα ⇒ νέο αποτύπωμα, ίδια έκδοση και σχήμα', () => {
    const before = pages({ done: [87], derivations: [stampedOn([])] });
    const after = pageDecisionsDigest([override(4, PHASES)], 87);
    expect(derivationAfterTable(before, 87, after)).toEqual({ ...stampedOn([]), decisionsDigest: after });
  });

  it('🔴 ξαναχτίσιμο ενός πίνακα σε ΜΠΑΓΙΑΤΙΚΗ σελίδα ⇒ η σφραγίδα μένει: οι άλλοι πίνακες δεν ξαναχτίστηκαν', () => {
    const stale = pages({ done: [87], derivations: [stampedOn([])], lineOverrides: [override(2, PHASES)] });
    expect(derivationAfterTable(stale, 87, pageDecisionsDigest([override(2, PHASES), override(4, PHASES)], 87))).toBeNull();
  });
});
