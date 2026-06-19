/**
 * ADR-452 — computeMultiFloorCutRange (pure, «Όλοι οι όροφοι» occupied envelope).
 *
 * Datum-relative frame (mm): each floor entry carries the already-resolved
 * material envelope `[minMm, maxMm]` for that floor (storey band ∪ entity extents).
 */

import { computeMultiFloorCutRange, type FloorCutExtent } from '../multi-floor-cut-range';

function floor(minMm: number, maxMm: number, hasEntities = true): FloorCutExtent {
  return { hasEntities, minMm, maxMm };
}

describe('computeMultiFloorCutRange', () => {
  it('returns null when no floor is occupied', () => {
    expect(computeMultiFloorCutRange([])).toBeNull();
    expect(
      computeMultiFloorCutRange([floor(0, 3000, false), floor(3000, 6000, false)]),
    ).toBeNull();
  });

  it('spans a single occupied floor envelope', () => {
    expect(computeMultiFloorCutRange([floor(0, 3000)])).toEqual({ minMm: 0, maxMm: 3000, defaultMm: 3000 });
  });

  it('Giorgio scenario: 1st + 3rd occupied → continuous 1st..3rd (2nd inside)', () => {
    const r = computeMultiFloorCutRange([
      floor(0, 3000, false), // ground EMPTY
      floor(3000, 6000), // 1st
      floor(6000, 9000, false), // 2nd EMPTY (between → covered by continuous band)
      floor(9000, 12000), // 3rd
    ]);
    expect(r).toEqual({ minMm: 3000, maxMm: 12000, defaultMm: 12000 });
  });

  it('ignores empty floors outside the occupied span', () => {
    const r = computeMultiFloorCutRange([
      floor(0, 3000, false),
      floor(3000, 6000, false),
      floor(6000, 9000), // only this occupied
      floor(9000, 12000, false),
    ]);
    expect(r).toEqual({ minMm: 6000, maxMm: 9000, defaultMm: 9000 });
  });

  it('FOUNDATION: πέδιλα hang below FFL → range extends below 0 (the reported bug)', () => {
    // foundation floor FFL=0 but footings bottom at -1800; ground at 0..3000
    const r = computeMultiFloorCutRange([
      floor(-1800, 0), // foundation envelope (footings below datum)
      floor(0, 3000), // ground
    ]);
    expect(r).toEqual({ minMm: -1800, maxMm: 3000, defaultMm: 3000 });
  });

  it('returns null for a degenerate (zero-thickness) envelope', () => {
    expect(computeMultiFloorCutRange([floor(3000, 3000)])).toBeNull();
  });
});
