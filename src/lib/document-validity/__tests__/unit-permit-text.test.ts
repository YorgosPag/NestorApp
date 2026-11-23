/**
 * Αναγνώστης πράξης e-Άδειες (ADR-949 Α-3) — πάνω σε **ανωνυμοποιημένα** πραγματικά δείγματα (`unit-permit-text.fixture.ts`):
 * ο τύπος της πράξης, η ημερομηνία της ΚΥΡΙΑΣ πράξης (ποτέ των «Προγενέστερων»), η αρχική άδεια μιας ενημέρωσης.
 */

import { E9_A_PAGES } from './e9-text.fixture';
import { PERMIT_INITIAL_PAGES, PERMIT_MINOR_WORKS_PAGES, PERMIT_UPDATE_PAGES } from './unit-permit-text.fixture';
import { readUnitPermitText } from '../unit-permit-text';

describe('ADR-949 Α-3 — readUnitPermitText', () => {
  it('οικοδομική άδεια ⇒ initial, με την ημερομηνία της (όχι της προγενέστερης βεβαίωσης όρων δόμησης 27/05/2020)', () => {
    expect(readUnitPermitText(PERMIT_INITIAL_PAGES)).toEqual({
      kind: 'read',
      act: { page: 1, kind: 'initial', issuedOn: '2020-06-09', originalPermit: null },
    });
  });

  it('ενημέρωση ⇒ update + η αρχική άδεια που ονομάζει· η ημερομηνία είναι της ενημέρωσης (σφραγίδα = σώμα)', () => {
    expect(readUnitPermitText(PERMIT_UPDATE_PAGES)).toEqual({
      kind: 'read',
      act: { page: 1, kind: 'update', issuedOn: '2026-11-10', originalPermit: { number: '417', year: 2008 } },
    });
  });

  it('έγκριση εργασιών μικρής κλίμακας (χωρίς «Τύπος Πράξης») ⇒ minor-works', () => {
    expect(readUnitPermitText(PERMIT_MINOR_WORKS_PAGES)).toEqual({
      kind: 'read',
      act: { page: 1, kind: 'minor-works', issuedOn: '2018-11-27', originalPermit: null },
    });
  });

  it('άλλο έγγραφο ⇒ not-recognized', () => {
    expect(readUnitPermitText(E9_A_PAGES)).toEqual({ kind: 'not-recognized' });
    expect(readUnitPermitText([])).toEqual({ kind: 'not-recognized' });
  });
});
