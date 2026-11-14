/**
 * ADR-915 §40.7 Φ3 — ο κριτής καταλληλότητας επιθεωρητή: όρια ΑΠΟ τα δεδομένα (`gradeScheme`), άγνοια ≠ «ακατάλληλος».
 */

import { PROFESSIONAL_LICENCE_SPECS } from '@/config/professional-licences';
import {
  inspectorFitOf,
  issuanceGradeRequirementOf,
  NO_AREA_EVIDENCE,
  type PropertyAreaEvidence,
} from '@/lib/document-validity/inspector-coverage';
import type { LicenceStanding } from '@/types/professional-registry-check';

const NOW = Date.parse('2026-11-15');
const PEA = issuanceGradeRequirementOf('energy-certificate');
const CAP = (() => {
  const entitlement = PROFESSIONAL_LICENCE_SPECS['energy-inspector'].gradeScheme?.entitlements.buildings?.A;
  if (entitlement?.kind !== 'area-cap') throw new Error('Η τάξη Α΄ Κτιρίων έπαψε να έχει όριο εμβαδού');
  return entitlement.maxAreaSqm;
})();

function gross(value: number): PropertyAreaEvidence {
  return { gross: { value, kind: 'gross' }, netSqm: null };
}

function declared(grade: 'A' | 'B'): LicenceStanding {
  return { grades: { buildings: grade }, source: 'declared', checkedAt: null };
}

function fit(standing: LicenceStanding | null, area: PropertyAreaEvidence) {
  if (PEA === null) throw new Error('Το ΠΕΑ έπαψε να κρίνεται από τάξη');
  return inspectorFitOf(PEA, standing, area, NOW);
}

describe('issuanceGradeRequirementOf — από τα δεδομένα του εκδότη', () => {
  it('ΠΕΑ ⇒ άδεια ενεργειακού επιθεωρητή, κατηγορία «Κτίρια»', () => {
    expect(PEA).toEqual({ licence: 'energy-inspector', scope: 'buildings' });
  });

  it('έγγραφο χωρίς όριο τάξης ⇒ null (η κάρτα σωπαίνει)', () => {
    expect(issuanceGradeRequirementOf('building-identity')).toBeNull();
    expect(issuanceGradeRequirementOf('electrical-installation')).toBeNull();
    expect(issuanceGradeRequirementOf('tax-clearance')).toBeNull();
  });
});

describe('Α΄ τάξη — όριο «έως και» το όριο του gradeScheme', () => {
  it('ακριβώς στο όριο ⇒ καλύπτει', () => {
    expect(fit(declared('A'), gross(CAP)).coverage).toEqual({ kind: 'covers', grade: 'A' });
  });

  it('ένα εκατοστό πάνω ⇒ ξεπερνά, με βάση το μικτό', () => {
    expect(fit(declared('A'), gross(CAP + 0.01)).coverage).toEqual({
      kind: 'exceeds', grade: 'A', maxAreaSqm: CAP, areaSqm: CAP + 0.01, basis: 'gross',
    });
  });

  it('καθαρό πάνω από το όριο ⇒ ξεπερνά με ΚΑΘΕ ανάγνωση, ακόμη και χωρίς μικτό', () => {
    expect(fit(declared('A'), { gross: null, netSqm: CAP + 10 }).coverage).toMatchObject({ kind: 'exceeds', basis: 'net' });
  });

  it('καθαρό μέσα στο όριο αλλά άγνωστο μικτό ⇒ δεν κρίνεται (ποτέ το καθαρό ως βάση)', () => {
    expect(fit(declared('A'), { gross: null, netSqm: CAP - 10 }).coverage).toEqual({ kind: 'area-unknown', grade: 'A', maxAreaSqm: CAP });
  });

  it('παλιό εμβαδόν άγνωστης βάσης πάνω από το όριο ⇒ ξεπερνά, λέγοντας τη βάση', () => {
    expect(fit(declared('A'), { gross: { value: CAP + 50, kind: 'unspecified' }, netSqm: null }).coverage)
      .toMatchObject({ kind: 'exceeds', basis: 'unspecified' });
  });

  it('άγνωστο εμβαδόν ⇒ area-unknown, ποτέ «ακατάλληλος»', () => {
    expect(fit(declared('A'), NO_AREA_EVIDENCE).coverage.kind).toBe('area-unknown');
  });
});

describe('Β΄ τάξη και άγνοια', () => {
  it('Β΄ καλύπτει χωρίς όριο — και με άγνωστο εμβαδόν', () => {
    expect(fit(declared('B'), gross(5000)).coverage).toEqual({ kind: 'covers', grade: 'B' });
    expect(fit(declared('B'), NO_AREA_EVIDENCE).coverage).toEqual({ kind: 'covers', grade: 'B' });
  });

  it('δηλωμένη άδεια χωρίς τάξη Κτιρίων ⇒ grade-unknown', () => {
    expect(fit({ grades: {}, source: 'declared', checkedAt: null }, gross(100)).coverage).toEqual({ kind: 'grade-unknown' });
  });

  it('επαφή χωρίς την άδεια ⇒ grade-unknown, χωρίς πηγή', () => {
    const result = fit(null, gross(100));
    expect(result).toEqual({ coverage: { kind: 'grade-unknown' }, source: null, checkedAt: null, recheckSuggested: false });
  });

  it('το μητρώο λέει ρητό «Όχι» ⇒ not-graded', () => {
    const standing: LicenceStanding = { grades: { buildings: 'none' }, source: 'registry', checkedAt: '2026-11-01T10:00:00.000Z' };
    expect(fit(standing, gross(100)).coverage).toEqual({ kind: 'not-graded' });
  });
});

describe('ηλικία του ελέγχου στο μητρώο', () => {
  const registry = (checkedAt: string): LicenceStanding => ({ grades: { buildings: 'B' }, source: 'registry', checkedAt });

  it('πρόσφατος έλεγχος ⇒ κανένας επανέλεγχος', () => {
    expect(fit(registry('2026-10-01T10:00:00.000Z'), gross(100)).recheckSuggested).toBe(false);
  });

  it('έλεγχος παλαιότερος του ορίου ⇒ προτείνεται επανέλεγχος', () => {
    expect(fit(registry('2025-11-01T10:00:00.000Z'), gross(100)).recheckSuggested).toBe(true);
  });

  it('η δήλωση δεν «παλιώνει» — δεν είναι έλεγχος', () => {
    expect(fit(declared('B'), gross(100)).recheckSuggested).toBe(false);
  });
});
