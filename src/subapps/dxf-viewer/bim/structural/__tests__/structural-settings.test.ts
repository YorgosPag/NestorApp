/**
 * ADR-464 Slice 0 — `resolveStructuralSettings` + soil bearing capacity.
 *
 * Επιβεβαιώνει ότι το νέο `soilBearingCapacityKpa` (a) περνά αυτούσιο όταν είναι
 * έγκυρο, (b) παραμένει **απόν** (ΟΧΙ explicit undefined) όταν absent/μη-έγκυρο —
 * ώστε το building persist να μη σπάει το Firestore (ADR-390 Φ4) — και (c) ΔΕΝ
 * επηρεάζει το υπάρχον codeId/grade resolution.
 */

import {
  DEFAULT_STRUCTURAL_SETTINGS,
  resolveStructuralSettings,
} from '../structural-settings';
import { DEFAULT_STRUCTURAL_CODE } from '../codes';
import { DEFAULT_CONCRETE_GRADE } from '../concrete-grades';

describe('resolveStructuralSettings — soilBearingCapacityKpa (ADR-464)', () => {
  it('επιστρέφει defaults χωρίς soil key όταν raw είναι null', () => {
    const r = resolveStructuralSettings(null);
    expect(r).toEqual(DEFAULT_STRUCTURAL_SETTINGS);
    expect('soilBearingCapacityKpa' in r).toBe(false);
  });

  it('περνά έγκυρη θετική σ_allow αυτούσια', () => {
    const r = resolveStructuralSettings({ soilBearingCapacityKpa: 200 });
    expect(r.soilBearingCapacityKpa).toBe(200);
    expect(r.codeId).toBe(DEFAULT_STRUCTURAL_CODE);
    expect(r.defaultConcreteGrade).toBe(DEFAULT_CONCRETE_GRADE);
  });

  it.each([0, -50, Number.NaN, Number.POSITIVE_INFINITY, undefined])(
    'παραλείπει τη μη-έγκυρη τιμή %p (κανένα explicit undefined key)',
    (bad) => {
      const r = resolveStructuralSettings({
        soilBearingCapacityKpa: bad as number | undefined,
      });
      expect('soilBearingCapacityKpa' in r).toBe(false);
    },
  );

  it('διατηρεί codeId/grade ανεξάρτητα από το soil', () => {
    const r = resolveStructuralSettings({
      codeId: 'greek-legacy',
      defaultConcreteGrade: 'C30/37',
      soilBearingCapacityKpa: 150,
    });
    expect(r.codeId).toBe('greek-legacy');
    expect(r.defaultConcreteGrade).toBe('C30/37');
    expect(r.soilBearingCapacityKpa).toBe(150);
  });
});
