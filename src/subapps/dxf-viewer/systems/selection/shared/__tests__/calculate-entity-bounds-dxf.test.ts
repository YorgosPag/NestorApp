/**
 * ADR-394 — `calculateEntityBounds` DXF coverage via hit-test SSoT delegation.
 *
 * Regression guard: the selection-side bounds calculator (used by Z fit-to-selection
 * AND window/crossing marquee) enumerated only line/circle/polyline/arc/rect/text/mtext
 * + BIM. DXF types ellipse/spline/point/dimension/xline/ray fell through to
 * `default → null`, so selecting them and pressing Z (or marquee-selecting them) did
 * nothing. The `default` branch now delegates to the full hit-test `BoundsCalculator`.
 */

import { calculateEntityBounds } from '../selection-duplicate-utils';
import type { AnySceneEntity } from '../../../../types/scene';

const as = (e: unknown) => e as unknown as AnySceneEntity;

describe('ADR-394 — calculateEntityBounds covers non-enumerated DXF types', () => {
  it('ellipse → center ± radii (was null before delegation)', () => {
    const ellipse = as({ id: 'e1', type: 'ellipse', center: { x: 100, y: 50 }, radiusX: 40, radiusY: 20 });
    expect(calculateEntityBounds(ellipse)).toEqual({
      min: { x: 60, y: 30 },
      max: { x: 140, y: 70 },
    });
  });

  it('point → ±1 minimum selection box', () => {
    const point = as({ id: 'p1', type: 'point', position: { x: 10, y: 20 } });
    expect(calculateEntityBounds(point)).toEqual({
      min: { x: 9, y: 19 },
      max: { x: 11, y: 21 },
    });
  });

  it('spline → control-point bounds', () => {
    const spline = as({
      id: 's1', type: 'spline',
      controlPoints: [{ x: 0, y: 0 }, { x: 100, y: 30 }, { x: 50, y: -10 }],
    });
    expect(calculateEntityBounds(spline)).toEqual({
      min: { x: 0, y: -10 },
      max: { x: 100, y: 30 },
    });
  });

  it('still handles an enumerated primitive (line) unchanged', () => {
    const line = as({ id: 'l1', type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } });
    expect(calculateEntityBounds(line)).toEqual({
      min: { x: 0, y: 0 },
      max: { x: 10, y: 10 },
    });
  });

  it('returns null for a genuinely unsupported type', () => {
    const weird = as({ id: 'x1', type: 'totally-unknown-shape' });
    expect(calculateEntityBounds(weird)).toBeNull();
  });
});

describe('window/crossing marquee selects dimensions (wrapped DxfDimension, 2026-07-03)', () => {
  // The marquee is fed scene.entities = DxfEntityUnion[], so a dimension arrives WRAPPED:
  // { type:'dimension', dimensionEntity: { defPoints, ... } }. Before the unwrap fix the flat
  // bounds calculator read `defPoints` at the top level (undefined) → null → never selectable.
  const wrappedDim = as({
    id: 'dim_1',
    type: 'dimension',
    dimensionEntity: {
      id: 'dim_1',
      type: 'dimension',
      dimensionType: 'linear',
      rotation: 0,
      defPoints: [
        { x: 17_119_418, y: 4_184_017 },
        { x: 17_157_268, y: 4_184_017 },
        { x: 17_119_418, y: 4_182_617 },
      ],
    },
  });

  it('a wrapped geo-referenced dimension returns real bounds (not null)', () => {
    const b = calculateEntityBounds(wrappedDim);
    expect(b).not.toBeNull();
    expect(b!.min.x).toBeCloseTo(17_119_418);
    expect(b!.max.x).toBeCloseTo(17_157_268);
    expect(b!.min.y).toBeCloseTo(4_182_617);
    expect(b!.max.y).toBeCloseTo(4_184_017);
  });

  it('an already-flat dimension (top-level defPoints) still works', () => {
    const flatDim = as({
      id: 'dim_2', type: 'dimension', dimensionType: 'linear', rotation: 0,
      defPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: -30 }],
    });
    const b = calculateEntityBounds(flatDim);
    expect(b).toEqual({ min: { x: 0, y: -30 }, max: { x: 100, y: 0 } });
  });

  it('a wrapped dimension with no defPoints → null (graceful, no crash)', () => {
    const empty = as({ id: 'dim_3', type: 'dimension', dimensionEntity: { dimensionType: 'linear', rotation: 0, defPoints: [] } });
    expect(calculateEntityBounds(empty)).toBeNull();
  });
});
