/**
 * ADR-929 Φ5.3γ — ο έλεγχος της εγγραφής βαθμονόμησης που κάνει ο διακομιστής. Κλειδώνει: παλιές εγγραφές μένουν
 * έγκυρες · N αναφορές έως το ΕΝΑ όριο · προέλευση μόνο από το κλειστό σύνολο · `sourceTextId` φραγμένο.
 */

import { isCalibrationData, MAX_SOURCE_TEXT_ID_LENGTH } from '../calibration-record-guard';
import { CALIBRATION_LIMITS } from '../calibration-solve';
import type { CalibrationData, CalibrationReferenceRecord } from '../../providers/types';

const REF: CalibrationReferenceRecord = { pointA: { x: 1, y: 2 }, pointB: { x: 300, y: 2 }, realDistance: 3500, unit: 'mm' };

/** Μια εγγραφή του διαλόγου όπως πριν τη Φ5.2 (χωρίς προαιρετικά πεδία). */
const LEGACY: CalibrationData = {
  method: 'two-point', pointA: REF.pointA, pointB: REF.pointB, realDistance: 3.5, unit: 'm',
  rotationDerived: false, calibratedAt: 1, calibratedBy: '',
};

const refs = (n: number, extra: Partial<CalibrationReferenceRecord> = {}): CalibrationReferenceRecord[] =>
  Array.from({ length: n }, (_, i) => ({ ...REF, ...extra, pointB: { x: 300 + i, y: 2 } }));

describe('isCalibrationData — συμβατότητα', () => {
  it('εγγραφή χωρίς προαιρετικά πεδία (πριν τη Φ5.2) ⇒ έγκυρη', () => {
    expect(isCalibrationData(LEGACY)).toBe(true);
  });

  it('εγγραφή του διαλόγου της Φ5.2 (1–2 αναφορές, χωρίς origin) ⇒ έγκυρη', () => {
    expect(isCalibrationData({ ...LEGACY, sceneUnits: 'm', scaleMode: 'per-axis', references: refs(2) })).toBe(true);
  });

  it('άλλη μέθοδος ή χαλασμένη πρώτη αναφορά ⇒ άκυρη', () => {
    expect(isCalibrationData({ ...LEGACY, method: 'three-point' })).toBe(false);
    expect(isCalibrationData({ ...LEGACY, realDistance: 0 })).toBe(false);
    expect(isCalibrationData(null)).toBe(false);
  });
});

describe('isCalibrationData — Φ5.3γ (κάρτα κλίμακας)', () => {
  it('N αναφορές έως το όριο, με πηγή κειμένου και προέλευση ⇒ έγκυρη', () => {
    const data = { ...LEGACY, origin: 'plan-dimensions', references: refs(CALIBRATION_LIMITS.maxReferences, { sourceTextId: 'txt-12' }) };
    expect(isCalibrationData(data)).toBe(true);
  });

  it('μία πάνω από το όριο ⇒ άκυρη (ΕΝΑ όριο πελάτη/διακομιστή)', () => {
    expect(isCalibrationData({ ...LEGACY, references: refs(CALIBRATION_LIMITS.maxReferences + 1) })).toBe(false);
  });

  it('κενή λίστα αναφορών ⇒ άκυρη', () => {
    expect(isCalibrationData({ ...LEGACY, references: [] })).toBe(false);
  });

  it.each([['manual', true], ['plan-dimensions', true], ['ai', false], ['', false]])('origin %p ⇒ %p', (origin, ok) => {
    expect(isCalibrationData({ ...LEGACY, origin })).toBe(ok);
  });

  it('sourceTextId: κενό ή πάνω από το όριο ή όχι string ⇒ άκυρη', () => {
    expect(isCalibrationData({ ...LEGACY, references: refs(1, { sourceTextId: '' }) })).toBe(false);
    expect(isCalibrationData({ ...LEGACY, references: refs(1, { sourceTextId: 'x'.repeat(MAX_SOURCE_TEXT_ID_LENGTH + 1) }) })).toBe(false);
    expect(isCalibrationData({ ...LEGACY, references: [{ ...REF, sourceTextId: 7 }] })).toBe(false);
  });
});
