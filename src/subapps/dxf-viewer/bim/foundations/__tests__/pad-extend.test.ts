/**
 * ADR-459 Phase 3 — pad-extend (combined-footing geometry).
 */

import { buildExtendedPadParams } from '../pad-extend';
import type { FoundationEntity } from '../../types/foundation-types';

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

const pad = {
  id: 'F1',
  type: 'foundation',
  kind: 'pad',
  params: { kind: 'pad', topElevationMm: -1000, thicknessMm: 500, width: 1500, length: 1500, anchor: 'sw', rotation: 30, position: { x: 0, y: 0, z: 0 } },
  geometry: { footprint: square(0, 0, 750) },
} as unknown as FoundationEntity;

describe('buildExtendedPadParams', () => {
  it('grows an axis-aligned bbox covering pad + new column (+ margin), centered', () => {
    const columnVerts = square(2000, 0, 200).vertices;
    const next = buildExtendedPadParams(pad, columnVerts, 150, 'mm');
    expect(next).not.toBeNull();
    // x: pad −750..750, column 1800..2200 → −750..2200, ±150 margin → −900..2350.
    expect(next?.width).toBe(3250);
    expect(next?.position.x).toBe(725);
    // y: −750..750 ±150 → −900..900 → 1800.
    expect(next?.length).toBe(1800);
    expect(next?.position.y).toBe(0);
    // normalised to a center-anchored, axis-aligned pad.
    expect(next?.anchor).toBe('center');
    expect(next?.rotation).toBe(0);
    // preserves non-geometric params.
    expect(next?.topElevationMm).toBe(-1000);
    expect(next?.thicknessMm).toBe(500);
  });

  it('returns null for a non-pad foundation', () => {
    const strip = { ...pad, params: { ...pad.params, kind: 'strip' } } as unknown as FoundationEntity;
    expect(buildExtendedPadParams(strip, square(0, 0, 200).vertices, 150, 'mm')).toBeNull();
  });
});
