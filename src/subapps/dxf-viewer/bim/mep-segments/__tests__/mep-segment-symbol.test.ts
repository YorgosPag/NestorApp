/**
 * ADR-408 Φ8 — MEP segment 2D symbol SSoT tests.
 *
 * Focus: the pipe midpoint tick is **screen-space** (zoom- and scene-unit
 * independent). Guards the regression where the old world-unit clamp `[4, 20]`
 * rendered as 4–20 *metres* in a metre-scene → a giant slash bisecting the pipe.
 */

import {
  buildSegmentSymbol,
  buildPipeTickScreen,
  PIPE_TICK_HALF_PX,
} from '../mep-segment-symbol';
import { computeMepSegmentGeometry } from '../../geometry/mep-segment-geometry';
import type { MepSegmentParams } from '../../types/mep-segment-types';
import type { Point2D } from '../../../rendering/types/Types';

/** A vertical pipe of physical length 1 m, expressed in the given scene units. */
function verticalPipe(sceneUnits: 'mm' | 'm'): MepSegmentParams {
  const span = sceneUnits === 'mm' ? 1000 : 1; // 1 m run in the scene's units
  return {
    domain: 'pipe',
    sectionKind: 'round',
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: 0, y: span, z: 0 },
    diameter: 50,
    centerlineElevationMm: 1500,
    sceneUnits,
  };
}

/** Distance between two screen points. */
function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

describe('buildSegmentSymbol — centerline', () => {
  it('emits the start→end centerline stroke', () => {
    const geo = computeMepSegmentGeometry(verticalPipe('mm'));
    const sym = buildSegmentSymbol(geo);
    expect(sym.strokes).toHaveLength(1);
    expect(sym.strokes[0]).toHaveLength(2);
    expect(sym.strokes[0][0]).toMatchObject({ x: 0, y: 0 });
    expect(sym.strokes[0][1]).toMatchObject({ x: 0, y: 1000 });
  });

  it('degenerate axis (<2 points) → no strokes', () => {
    const geo = computeMepSegmentGeometry(verticalPipe('mm'));
    const degenerate = { ...geo, axisPolyline: { points: [geo.axisPolyline.points[0]], closed: false } };
    expect(buildSegmentSymbol(degenerate).strokes).toHaveLength(0);
  });
});

describe('buildPipeTickScreen — screen-constant', () => {
  it('tick length is exactly 2 × PIPE_TICK_HALF_PX regardless of input span', () => {
    const small = buildPipeTickScreen({ x: 0, y: 0 }, { x: 0, y: 20 });
    const large = buildPipeTickScreen({ x: 0, y: 0 }, { x: 0, y: 5000 });
    expect(small).not.toBeNull();
    expect(large).not.toBeNull();
    expect(dist(small!.a, small!.b)).toBeCloseTo(2 * PIPE_TICK_HALF_PX, 6);
    expect(dist(large!.a, large!.b)).toBeCloseTo(2 * PIPE_TICK_HALF_PX, 6);
  });

  it('is perpendicular to the centerline and centred on its midpoint', () => {
    // Vertical centerline → horizontal tick at the midpoint.
    const tick = buildPipeTickScreen({ x: 10, y: 0 }, { x: 10, y: 200 })!;
    expect(tick.a.y).toBeCloseTo(100, 6);
    expect(tick.b.y).toBeCloseTo(100, 6);
    // Symmetric about x=10, one endpoint each side, total span 2×half.
    expect(tick.a.x).toBeCloseTo(10 + PIPE_TICK_HALF_PX, 6);
    expect(tick.b.x).toBeCloseTo(10 - PIPE_TICK_HALF_PX, 6);
  });

  it('degenerate (zero-length) leg → null', () => {
    expect(buildPipeTickScreen({ x: 5, y: 5 }, { x: 5, y: 5 })).toBeNull();
  });
});

describe('unit parity — same physical pipe, mm vs metre scene', () => {
  // Simulate each scene's worldToScreen: uniform scale chosen so the SAME 1 m
  // physical pipe maps to the SAME 200 px screen segment in both scenes.
  const SCREEN_LEN_PX = 200;
  const project = (p: { x: number; y: number }, scale: number): Point2D => ({
    x: p.x * scale,
    y: p.y * scale,
  });

  it('produces an identical, screen-constant tick in both scenes', () => {
    const mmGeo = computeMepSegmentGeometry(verticalPipe('mm')); // axis 0..1000 units
    const mGeo = computeMepSegmentGeometry(verticalPipe('m')); // axis 0..1 unit

    const mmScale = SCREEN_LEN_PX / 1000; // 1000 mm-units → 200 px
    const mScale = SCREEN_LEN_PX / 1; // 1 m-unit → 200 px

    const tickMm = buildPipeTickScreen(
      project(mmGeo.axisPolyline.points[0], mmScale),
      project(mmGeo.axisPolyline.points[1], mmScale),
    )!;
    const tickM = buildPipeTickScreen(
      project(mGeo.axisPolyline.points[0], mScale),
      project(mGeo.axisPolyline.points[1], mScale),
    )!;

    // Both ticks are the SAME fixed pixel size — the metre scene no longer
    // explodes the tick to multi-metre length.
    expect(dist(tickMm.a, tickMm.b)).toBeCloseTo(2 * PIPE_TICK_HALF_PX, 6);
    expect(dist(tickM.a, tickM.b)).toBeCloseTo(2 * PIPE_TICK_HALF_PX, 6);
    expect(tickMm.a).toMatchObject({ x: tickM.a.x, y: tickM.a.y });
    expect(tickMm.b).toMatchObject({ x: tickM.b.x, y: tickM.b.y });
  });
});
