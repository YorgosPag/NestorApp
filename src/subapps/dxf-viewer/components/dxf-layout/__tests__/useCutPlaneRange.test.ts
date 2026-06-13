/**
 * ADR-452 — computeCutPlaneRange (pure slider range + ticks from floor list).
 */

import { computeCutPlaneRange } from '../cut-plane-range';
import type { FloorOption } from '@/components/properties/shared/useFloorsByBuilding';

function floor(number: number, elevation: number, height: number, name = `F${number}`): FloorOption {
  return { id: `f${number}`, number, name, buildingId: 'b1', elevation, height };
}

describe('computeCutPlaneRange', () => {
  it('returns null when there are no floors', () => {
    expect(computeCutPlaneRange([], null)).toBeNull();
  });

  it('builds datum-relative ticks (ground = 0) and min/max in mm', () => {
    // ground @0m (h3), 1st @3m (h3), roof @6m (h1)
    const floors = [floor(0, 0, 3), floor(1, 3, 3), floor(2, 6, 1)];
    const r = computeCutPlaneRange(floors, null);
    expect(r).not.toBeNull();
    expect(r!.ticks.map((t) => t.mm)).toEqual([0, 3000, 6000]);
    expect(r!.minMm).toBe(0);
    // top = max FFL + storey height = 6000 + 1000
    expect(r!.maxMm).toBe(7000);
  });

  it('keeps the basement (negative datum-relative) in range', () => {
    // basement @-3m, ground @0m datum
    const floors = [floor(-1, -3, 3, 'B1'), floor(0, 0, 3)];
    const r = computeCutPlaneRange(floors, null);
    expect(r!.minMm).toBe(-3000);
    expect(r!.maxMm).toBe(3000); // ground top
  });

  it('uses the active storey ceiling as defaultMm when in range', () => {
    const floors = [floor(0, 0, 3), floor(1, 3, 3)];
    const r = computeCutPlaneRange(floors, 3000);
    expect(r!.defaultMm).toBe(3000);
  });

  it('falls back to maxMm when the active ceiling is out of range', () => {
    const floors = [floor(0, 0, 3)];
    const r = computeCutPlaneRange(floors, 99999);
    expect(r!.defaultMm).toBe(r!.maxMm);
  });

  it('falls back to a default storey height when height is absent', () => {
    const floors: FloorOption[] = [{ id: 'f0', number: 0, name: 'G', buildingId: 'b1', elevation: 0 }];
    const r = computeCutPlaneRange(floors, null);
    expect(r!.maxMm).toBe(3000); // FALLBACK_FLOOR_HEIGHT_MM
  });
});
