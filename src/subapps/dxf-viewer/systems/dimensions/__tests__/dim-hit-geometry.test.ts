/**
 * ADR-362 Phase I per-variant hit (2026-06-24) — tests for the radial / angular /
 * ordinate hit geometry SSoT in `dim-hit-geometry.ts`.
 *
 * `buildVariantHitGeometry` reuses the ONE geometry SSoT (`buildDimensionGeometry`
 * + ISO-129) and `hitTestDimGeometry` picks the point against the *rendered*
 * arc / leader / dim-line. We assert: scope gating (only radial/angular/ordinate),
 * precise hits on the rendered primitives, and correct misses (off-geometry +
 * the complementary side of an angular sweep). `isAngleOnSweptArc` is covered
 * directly since it carries the non-trivial signed-sweep semantics.
 */

import type {
  Angular3PDimensionEntity,
  ArcLengthDimensionEntity,
  DiameterDimensionEntity,
  DimensionEntity,
  JoggedRadiusDimensionEntity,
  OrdinateDimensionEntity,
  RadiusDimensionEntity,
} from '../../../types/dimension';
import type { Point2D } from '../../../rendering/types/Types';
import {
  buildVariantHitGeometry,
  hitTestDimGeometry,
} from '../dim-hit-geometry';
import { isAngleOnSweptArc } from '../builders/shared-geometry-helpers';

const TOL = 0.5;
const HALF_PI = Math.PI / 2;

function baseDim<T extends DimensionEntity>(
  dimensionType: T['dimensionType'],
  defPoints: readonly Point2D[],
  extra: Partial<T> = {},
): T {
  return {
    id: 'dim_test',
    type: 'dimension',
    dimensionType,
    styleId: 'dimstyle_iso_129',
    defPoints,
    layerId: 'layer_test',
    ...extra,
  } as T;
}

// ──────────────────────────────────────────────────────────────────────────────
// isAngleOnSweptArc — signed/unwrapped sweep containment
// ──────────────────────────────────────────────────────────────────────────────

describe('isAngleOnSweptArc', () => {
  it('accepts an angle inside a positive (CCW) short sweep', () => {
    expect(isAngleOnSweptArc(HALF_PI / 2, 0, HALF_PI)).toBe(true);
  });

  it('rejects the complementary side of a positive sweep', () => {
    // -3π/4 is outside [0 → π/2]
    expect(isAngleOnSweptArc(-3 * HALF_PI / 2, 0, HALF_PI)).toBe(false);
  });

  it('respects negative (CW) sweeps', () => {
    expect(isAngleOnSweptArc(-HALF_PI / 2, 0, -HALF_PI)).toBe(true);
    expect(isAngleOnSweptArc(HALF_PI / 2, 0, -HALF_PI)).toBe(false);
  });

  it('handles long arcs (|sweep| > π)', () => {
    const longEnd = 3 * HALF_PI; // 270° CCW
    expect(isAngleOnSweptArc(Math.PI, 0, longEnd)).toBe(true); // 180° on the long arc
    expect(isAngleOnSweptArc(-HALF_PI / 2, 0, longEnd)).toBe(false); // 315° — off the arc
  });

  it('rejects a degenerate zero sweep', () => {
    expect(isAngleOnSweptArc(0, 1, 1)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// buildVariantHitGeometry — scope gating
// ──────────────────────────────────────────────────────────────────────────────

describe('buildVariantHitGeometry — scope', () => {
  it('returns null for linear/aligned (handled by computeDimHitGeometry)', () => {
    const linear = baseDim('linear', [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }], {
      rotation: 0,
    } as Partial<DimensionEntity>);
    expect(buildVariantHitGeometry(linear)).toBeNull();
    const aligned = baseDim('aligned', [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }]);
    expect(buildVariantHitGeometry(aligned)).toBeNull();
  });

  it('returns null for baseline/continued (lookup-dependent)', () => {
    expect(buildVariantHitGeometry(baseDim('baseline', [{ x: 0, y: 0 }]))).toBeNull();
    expect(buildVariantHitGeometry(baseDim('continued', [{ x: 0, y: 0 }]))).toBeNull();
  });

  it('returns geometry for in-scope variants', () => {
    const radius = baseDim<RadiusDimensionEntity>('radius', [{ x: 0, y: 0 }, { x: 50, y: 0 }]);
    expect(buildVariantHitGeometry(radius)?.kind).toBe('radial');
  });

  it('returns null on degenerate geometry instead of throwing', () => {
    // radius with arcPoint == center → builder throws → null
    const degenerate = baseDim<RadiusDimensionEntity>('radius', [{ x: 0, y: 0 }, { x: 0, y: 0 }]);
    expect(buildVariantHitGeometry(degenerate)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// hitTestDimGeometry — radial family (leader polyline)
// ──────────────────────────────────────────────────────────────────────────────

describe('hitTestDimGeometry — radial', () => {
  it('radius: hits along the outward leader, misses off to the side', () => {
    const radius = baseDim<RadiusDimensionEntity>(
      'radius',
      [{ x: 0, y: 0 }, { x: 50, y: 0 }],
      { leaderLength: 20 } as Partial<RadiusDimensionEntity>,
    );
    const geom = buildVariantHitGeometry(radius)!;
    // leader runs arcPoint(50,0) → (70,0)
    expect(hitTestDimGeometry(geom, { x: 60, y: 0 }, TOL)).not.toBeNull();
    expect(hitTestDimGeometry(geom, { x: 60, y: 5 }, TOL)).toBeNull();
  });

  it('diameter: hits along the chord between the two sides', () => {
    const diameter = baseDim<DiameterDimensionEntity>(
      'diameter',
      [{ x: -30, y: 0 }, { x: 30, y: 0 }],
    );
    const geom = buildVariantHitGeometry(diameter)!;
    expect(hitTestDimGeometry(geom, { x: 0, y: 0 }, TOL)).not.toBeNull();
    expect(hitTestDimGeometry(geom, { x: 0, y: 10 }, TOL)).toBeNull();
  });

  it('arcLength: hits on the arc-following leader sample', () => {
    const arcLength = baseDim<ArcLengthDimensionEntity>(
      'arcLength',
      [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 0, y: 40 }],
    );
    const geom = buildVariantHitGeometry(arcLength)!;
    // midpoint of the quarter arc (radius 40) ≈ (28.28, 28.28)
    const onArc = { x: 40 * Math.cos(Math.PI / 4), y: 40 * Math.sin(Math.PI / 4) };
    expect(hitTestDimGeometry(geom, onArc, 1)).not.toBeNull();
    expect(hitTestDimGeometry(geom, { x: 0, y: 0 }, TOL)).toBeNull();
  });

  it('joggedRadius: hits along the zig-zag leader vertices', () => {
    const jogged = baseDim<JoggedRadiusDimensionEntity>(
      'joggedRadius',
      [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 70, y: 10 }, { x: 60, y: 5 }],
    );
    const geom = buildVariantHitGeometry(jogged)!;
    // leaderPath starts at arcPoint (50,0)
    expect(hitTestDimGeometry(geom, { x: 50, y: 0 }, TOL)).not.toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// hitTestDimGeometry — angular (arc band + swept range)
// ──────────────────────────────────────────────────────────────────────────────

describe('hitTestDimGeometry — angular', () => {
  function angular3P(): Angular3PDimensionEntity {
    // vertex origin, rays along +X and +Y, arcPoint on the bisector → quarter arc
    return baseDim<Angular3PDimensionEntity>('angular3P', [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
      { x: 14, y: 14 },
    ]);
  }

  it('hits a point on the arc within the swept range', () => {
    const geom = buildVariantHitGeometry(angular3P())!;
    expect(geom.kind).toBe('angular');
    const r = (geom as { arcRadius: number }).arcRadius;
    const onArc = { x: r * Math.cos(Math.PI / 4), y: r * Math.sin(Math.PI / 4) };
    expect(hitTestDimGeometry(geom, onArc, 1)).not.toBeNull();
  });

  it('misses the complementary side of the arc (correct sweep direction)', () => {
    const geom = buildVariantHitGeometry(angular3P())!;
    const r = (geom as { arcRadius: number }).arcRadius;
    // same radius, opposite quadrant (225°) — on the circle but off the swept arc
    const offArc = { x: r * Math.cos(5 * Math.PI / 4), y: r * Math.sin(5 * Math.PI / 4) };
    expect(hitTestDimGeometry(geom, offArc, 1)).toBeNull();
  });

  it('misses a point off the arc radius', () => {
    const geom = buildVariantHitGeometry(angular3P())!;
    expect(hitTestDimGeometry(geom, { x: 100, y: 100 }, TOL)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// hitTestDimGeometry — ordinate (feature → text leader) + text anchor
// ──────────────────────────────────────────────────────────────────────────────

describe('hitTestDimGeometry — ordinate & text', () => {
  it('ordinate: hits along the leader from feature to the text end', () => {
    const ordinate = baseDim<OrdinateDimensionEntity>(
      'ordinate',
      [{ x: 10, y: 0 }],
      {
        axis: 'x',
        datum: { x: 0, y: 0 },
        textMidpoint: { x: 10, y: 40 },
      } as Partial<OrdinateDimensionEntity>,
    );
    const geom = buildVariantHitGeometry(ordinate)!;
    expect(geom.kind).toBe('linear');
    // leader runs (10,0) → (10,40)
    expect(hitTestDimGeometry(geom, { x: 10, y: 20 }, TOL)).not.toBeNull();
    expect(hitTestDimGeometry(geom, { x: 20, y: 20 }, TOL)).toBeNull();
  });

  it('hits the text label anchor for any variant', () => {
    const radius = baseDim<RadiusDimensionEntity>(
      'radius',
      [{ x: 0, y: 0 }, { x: 50, y: 0 }],
      { textMidpoint: { x: 80, y: 80 } } as Partial<RadiusDimensionEntity>,
    );
    const geom = buildVariantHitGeometry(radius)!;
    expect(hitTestDimGeometry(geom, { x: 80, y: 80 }, TOL)).toEqual({ x: 80, y: 80 });
  });
});
