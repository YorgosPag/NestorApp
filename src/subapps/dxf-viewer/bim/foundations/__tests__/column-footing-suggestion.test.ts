/**
 * ADR-459 Phase 2/3 — column-footing-suggestion (covered / extend / create).
 */

import {
  suggestColumnFooting,
  type FootingCandidate,
} from '../column-footing-suggestion';
import type { Entity } from '../../../types/entities';

function square(cx: number, cy: number, half: number) {
  return {
    vertices: [
      { x: cx - half, y: cy - half, z: 0 },
      { x: cx + half, y: cy - half, z: 0 },
      { x: cx + half, y: cy + half, z: 0 },
      { x: cx - half, y: cy + half, z: 0 },
    ],
  };
}

const columnAt = (cx: number, footingId?: string): Entity =>
  ({
    id: 'C1',
    type: 'column',
    params: { baseBinding: 'storey-floor', baseOffset: 0, height: 3000, width: 400, depth: 400, ...(footingId ? { footingId } : {}) },
    geometry: { footprint: square(cx, 0, 200) },
  } as unknown as Entity);

const padAt = (id: string, cx: number, half: number, topElevationMm = 0): FootingCandidate => ({
  entity: {
    id,
    type: 'foundation',
    params: { kind: 'pad', topElevationMm, thicknessMm: 500 },
    geometry: { footprint: square(cx, 0, half) },
  } as unknown as Entity,
  floorElevationMm: 0,
});

describe('suggestColumnFooting', () => {
  it('returns covered when a footing covers the column base', () => {
    const s = suggestColumnFooting(columnAt(0), 0, [padAt('F1', 0, 750)]);
    expect(s).toEqual({ kind: 'covered', footingId: 'F1' });
  });

  it('returns the existing FK as covered (no-op) when the column already has a footingId', () => {
    const s = suggestColumnFooting(columnAt(9999, 'F-EXISTING'), 0, []);
    expect(s).toEqual({ kind: 'covered', footingId: 'F-EXISTING' });
  });

  it('returns extend for a nearby footing that does not cover the column', () => {
    // footing at x=0 (±750), column at x=2000 → not covered, gap 2000 ≤ 3000.
    const s = suggestColumnFooting(columnAt(2000), 0, [padAt('F1', 0, 750)]);
    expect(s).toEqual({ kind: 'extend', footingId: 'F1' });
  });

  it('returns create when the nearest footing is too far', () => {
    const s = suggestColumnFooting(columnAt(9000), 0, [padAt('F1', 0, 750)]);
    expect(s).toEqual({ kind: 'create' });
  });

  it('returns create when there are no footings', () => {
    expect(suggestColumnFooting(columnAt(0), 0, [])).toEqual({ kind: 'create' });
  });

  it('resolves coverage cross-level using absolute Z', () => {
    // column on active floor (FFL 3000) base 3000; footing on foundation (FFL −1000)
    // topElevationMm 4000 → abs top = 3000 → covers (gate 3000 ≤ 3000+1).
    const footing: FootingCandidate = {
      entity: {
        id: 'F1',
        type: 'foundation',
        params: { kind: 'pad', topElevationMm: 4000, thicknessMm: 500 },
        geometry: { footprint: square(0, 0, 750) },
      } as unknown as Entity,
      floorElevationMm: -1000,
    };
    expect(suggestColumnFooting(columnAt(0), 3000, [footing])).toEqual({ kind: 'covered', footingId: 'F1' });
  });
});
