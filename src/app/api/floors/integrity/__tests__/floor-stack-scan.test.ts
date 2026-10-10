/**
 * ⚓ Η αναφορά ακεραιότητας των στοιβών ορόφων — βρίσκει ό,τι γράφτηκε έξω από το σύνορο.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-10): δύο «Ισόγειο» γράφτηκαν απευθείας στη βάση. Καμία διαδρομή της εφαρμογής δεν θα το
 * είχε αποτρέψει — άρα πρέπει να μπορεί να βρεθεί, ανά κτίριο ΚΑΙ ανά ενοικιαστή.
 */

import { judgeFloorStacks, scanFloor } from '../floor-stack-scan';

const floor = (id: string, buildingId: string, companyId: string, number: number, name: string, extra: Record<string, unknown> = {}) =>
  scanFloor(id, { buildingId, companyId, number, name, kind: 'standard', ...extra });

describe('judgeFloorStacks', () => {
  it('🔴 το περιστατικό: το κτίριο με τα δύο «Ισόγειο» αναφέρεται (αριθμός ΚΑΙ όνομα)· το καθαρό όχι', () => {
    const report = judgeFloorStacks([
      floor('flr_5c28', 'bldg_A', 'co_1', 0, 'Ισόγειο', { elevation: 0 }),
      floor('flr_690f', 'bldg_A', 'co_1', 0, 'Ισόγειο', { elevation: 0 }),
      floor('flr_ok0', 'bldg_B', 'co_1', 0, 'Ισόγειο'),
      floor('flr_ok1', 'bldg_B', 'co_1', 1, '1ος Όροφος'),
    ]);

    expect(report.floorsScanned).toBe(4);
    expect(report.buildingsScanned).toBe(2);
    expect(report.conflicts.map((c) => [c.buildingId, c.clash, c.floors.map((f) => f.id)])).toEqual([
      ['bldg_A', 'number', ['flr_5c28', 'flr_690f']],
      ['bldg_A', 'name', ['flr_5c28', 'flr_690f']],
    ]);
    expect(report.sameElevation.map((s) => s.buildingId)).toEqual(['bldg_A']);
  });

  it('ίδιος αριθμός σε ΑΛΛΟ κτίριο ή σε άλλον ενοικιαστή δεν είναι σύγκρουση', () => {
    const report = judgeFloorStacks([
      floor('a', 'bldg_A', 'co_1', 0, 'Ισόγειο'),
      floor('b', 'bldg_B', 'co_1', 0, 'Ισόγειο'),
      floor('c', 'bldg_A', 'co_2', 0, 'Ισόγειο'),
    ]);

    expect(report.conflicts).toEqual([]);
    expect(report.buildingsScanned).toBe(3);
  });

  it('όροφος χωρίς κτίριο ή ενοικιαστή μετριέται χωριστά και δεν κρίνεται', () => {
    const report = judgeFloorStacks([
      scanFloor('x', { number: 0, name: 'Ισόγειο' }),
      scanFloor('y', { number: 0, name: 'Ισόγειο', buildingId: 'bldg_A' }),
    ]);

    expect(report.ownerlessFloors).toBe(2);
    expect(report.conflicts).toEqual([]);
  });
});
