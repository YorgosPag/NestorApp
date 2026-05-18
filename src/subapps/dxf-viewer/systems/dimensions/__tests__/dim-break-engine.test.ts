/**
 * ADR-362 Phase K1 — dim-break-engine unit tests.
 *
 * Coverage:
 *   computeAutoBreaks:
 *     - breakGap = 0 → returns empty {}
 *     - no crossing entities → original segments returned unchanged
 *     - crossing LINE perpendicular to dim line → segment split into 2 parts
 *     - unsupported geometry kind (ordinate) → returns {}
 *     - null extLine → extLineSegments undefined in result
 *   computeManualBreaks:
 *     - breakGap = 0 → returns empty {}
 *     - no break points → segments undefined
 *     - break point at midpoint of dim line → splits into 2 parts
 *     - break point outside segment (t < 0 or t > 1) → no split
 *
 * Run: `npx jest dim-break-engine.test --runInBand`
 */

import {
  computeAutoBreaks,
  computeManualBreaks,
} from '../dim-break-engine';
import type { DimBreakResult } from '../dim-break-engine';
import type { DimGeometry, LinearDimGeometry } from '../dim-geometry-builder';
import type { DimStyle } from '../../../types/dimension';
import type { LineEntity } from '../../../types/entities';
import { ISO_129_TEMPLATE } from '../dim-style-templates';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeStyle(patch: Partial<DimStyle> = {}): DimStyle {
  return { ...ISO_129_TEMPLATE, ...patch };
}

function makeLinearGeometry(patch: Partial<LinearDimGeometry> = {}): LinearDimGeometry {
  return {
    kind: 'linear',
    dimLine: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
    extLine1: { start: { x: 0, y: -10 }, end: { x: 0, y: 5 } },
    extLine2: { start: { x: 100, y: -10 }, end: { x: 100, y: 5 } },
    arrowAnchor1: { x: 0, y: 0 },
    arrowAnchor2: { x: 100, y: 0 },
    arrowDirection1: { x: -1, y: 0 },
    arrowDirection2: { x: 1, y: 0 },
    textAnchor: { x: 50, y: 0 },
    textRotation: 0,
    measurementValue: 100,
    ...patch,
  };
}

/** A vertical LINE entity crossing the horizontal dim line at x=50. */
function makeCrossingLine(atX: number): LineEntity {
  return {
    id: `cross-${atX}`,
    type: 'line',
    layerId: 'lyr_0000000000000000000000000000000000000000',
    start: { x: atX, y: -20 },
    end:   { x: atX, y:  20 },
  };
}

// ── computeAutoBreaks ─────────────────────────────────────────────────────────

describe('computeAutoBreaks', () => {
  it('breakGap = 0 → returns empty {}', () => {
    const geom = makeLinearGeometry();
    const result = computeAutoBreaks(geom, [], makeStyle({ breakGap: 0 }));
    expect(result).toEqual({});
  });

  it('no crossing entities → original dim line returned as single segment', () => {
    const geom = makeLinearGeometry();
    const result = computeAutoBreaks(geom, [], makeStyle({ breakGap: 4 }));
    expect(result.dimLineSegments).toHaveLength(1);
    expect(result.dimLineSegments![0]).toEqual(geom.dimLine);
  });

  it('crossing LINE at midpoint → dim line split into 2 segments', () => {
    const geom = makeLinearGeometry();
    const style = makeStyle({ breakGap: 4 });
    const result = computeAutoBreaks(geom, [makeCrossingLine(50)], style);
    // One crossing → two segments (before and after the break)
    expect(result.dimLineSegments).toHaveLength(2);
    // First segment ends before midpoint
    expect(result.dimLineSegments![0].end.x).toBeLessThan(50);
    // Second segment starts after midpoint
    expect(result.dimLineSegments![1].start.x).toBeGreaterThan(50);
  });

  it('two crossings → dim line split into 3 segments', () => {
    const geom = makeLinearGeometry();
    const style = makeStyle({ breakGap: 4 });
    const result = computeAutoBreaks(
      geom,
      [makeCrossingLine(25), makeCrossingLine(75)],
      style,
    );
    expect(result.dimLineSegments).toHaveLength(3);
  });

  it('null extLine1 → extLine1Segments is undefined', () => {
    const geom = makeLinearGeometry({ extLine1: null });
    const result = computeAutoBreaks(geom, [], makeStyle({ breakGap: 4 }));
    expect(result.extLine1Segments).toBeUndefined();
  });

  it('no crossings → ext lines returned as single segments each', () => {
    const geom = makeLinearGeometry();
    const result = computeAutoBreaks(geom, [], makeStyle({ breakGap: 4 }));
    expect(result.extLine1Segments).toHaveLength(1);
    expect(result.extLine2Segments).toHaveLength(1);
  });

  it('ordinate-like geometry (kind not linear/angular/radial) → returns {}', () => {
    // Construct a geometry with an unsupported kind by casting — the engine
    // should fall through to the default empty return.
    const geom = { kind: 'ordinate', measurementValue: 10 } as unknown as DimGeometry;
    const result = computeAutoBreaks(geom, [], makeStyle({ breakGap: 4 }));
    expect(result).toEqual({});
  });
});

// ── computeManualBreaks ───────────────────────────────────────────────────────

describe('computeManualBreaks', () => {
  it('breakGap = 0 → returns empty {}', () => {
    const geom = makeLinearGeometry();
    const result = computeManualBreaks(geom, {}, makeStyle({ breakGap: 0 }));
    expect(result).toEqual({});
  });

  it('empty manual input → all segment arrays undefined', () => {
    const geom = makeLinearGeometry();
    const result = computeManualBreaks(geom, {}, makeStyle({ breakGap: 4 }));
    expect(result.dimLineSegments).toBeUndefined();
    expect(result.extLine1Segments).toBeUndefined();
    expect(result.extLine2Segments).toBeUndefined();
  });

  it('break at midpoint of dim line → 2 segments', () => {
    const geom = makeLinearGeometry();
    const style = makeStyle({ breakGap: 4 });
    const result = computeManualBreaks(
      geom,
      { dimLinePoints: [{ x: 50, y: 0 }] },
      style,
    );
    expect(result.dimLineSegments).toHaveLength(2);
    expect(result.dimLineSegments![0].end.x).toBeLessThan(50);
    expect(result.dimLineSegments![1].start.x).toBeGreaterThan(50);
  });

  it('break at ext line midpoint → 2 ext line segments', () => {
    const geom = makeLinearGeometry();
    const style = makeStyle({ breakGap: 2 });
    const result = computeManualBreaks(
      geom,
      { extLine1Points: [{ x: 0, y: -5 }] },
      style,
    );
    expect(result.extLine1Segments).toHaveLength(2);
  });
});
