/**
 * ADR-672 — 2D plan-view door handle glyph (latch-side tick).
 *
 * `drawSwing` draws a short perpendicular tick near the leaf's latch (free)
 * end, at `HANDLE_LEAF_FRACTION` (0.86) along the hinge→tip line, half-length
 * `HANDLE_TICK_RATIO` (0.08) of the leaf length. Latch side is inherent in
 * the geometry (leaf tip = free end) — no handing re-derivation, consistent
 * with the 3D hardware builder's `latchSign` convention.
 *
 * ZERO REGRESSION: non-swing symbols (glazing/fixed) draw no handle glyph.
 */

import { drawOpeningPlanOverlay } from '../opening-overlay-drawing';
import type { OverlayDrawContext } from '../opening-overlay-drawing';
import { HINGE_ARC_SUBDIVISIONS } from '../../geometry/opening-geometry';
import type { OpeningEntity } from '../../types/opening-types';
import type { Point3D } from '../../types/bim-base';

interface RecordedSegment {
  a: { x: number; y: number };
  b: { x: number; y: number };
}

function createMockDc(): { dc: OverlayDrawContext; segments: RecordedSegment[] } {
  const segments: RecordedSegment[] = [];
  let pending: { x: number; y: number } | null = null;

  const ctx = {
    save: () => {},
    restore: () => {},
    setLineDash: () => {},
    beginPath: () => { pending = null; },
    moveTo: (x: number, y: number) => { pending = { x, y }; },
    lineTo: (x: number, y: number) => {
      if (pending) segments.push({ a: pending, b: { x, y } });
      pending = { x, y };
    },
    stroke: () => {},
  };

  const dc: OverlayDrawContext = {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    toScreen: (p: { x: number; y: number }) => p,
    lineWidth: 1,
  };
  return { dc, segments };
}

function zeroPt(): Point3D {
  return { x: 0, y: 0, z: 0 };
}

const OUTLINE_VERTICES: readonly Point3D[] = [
  { x: 0, y: -50, z: 0 },
  { x: 1000, y: -50, z: 0 },
  { x: 1000, y: 50, z: 0 },
  { x: 0, y: 50, z: 0 },
];

function makeSwingDoor(): OpeningEntity {
  const points: Point3D[] = [];
  for (let i = 0; i < HINGE_ARC_SUBDIVISIONS + 2; i++) {
    points.push(i === HINGE_ARC_SUBDIVISIONS ? { x: 1000, y: 0, z: 0 } : zeroPt());
  }
  return {
    id: 'op_door_test', type: 'opening', kind: 'door', layerId: '0',
    params: { sillHeight: 0, height: 2100, width: 900, hostWallId: 'w1' },
    geometry: {
      outline: { vertices: OUTLINE_VERTICES },
      hingeArc: { points },
      hingeAnchor: { x: 0, y: 0, z: 0 },
      hingeAnchor2: null,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as OpeningEntity;
}

function makeFixedGlazing(): OpeningEntity {
  return {
    id: 'op_fixed_test', type: 'opening', kind: 'fixed', layerId: '0',
    params: { sillHeight: 0, height: 2100, width: 900, hostWallId: 'w1' },
    geometry: {
      outline: { vertices: OUTLINE_VERTICES },
      hingeArc: null,
      hingeAnchor: null,
      hingeAnchor2: null,
    },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as OpeningEntity;
}

const EXPECTED_HANDLE_X = 1000 * 0.86; // HANDLE_LEAF_FRACTION
const EXPECTED_HANDLE_Y = 1000 * 0.08; // HANDLE_TICK_RATIO
const TOL = 1e-6;

function hasHandleTickSegment(segments: RecordedSegment[]): boolean {
  return segments.some((seg) => {
    const aMatches = Math.abs(seg.a.x - EXPECTED_HANDLE_X) < TOL && Math.abs(Math.abs(seg.a.y) - EXPECTED_HANDLE_Y) < TOL;
    const bMatches = Math.abs(seg.b.x - EXPECTED_HANDLE_X) < TOL && Math.abs(Math.abs(seg.b.y) - EXPECTED_HANDLE_Y) < TOL;
    // Tick is a single perpendicular segment: both endpoints at x≈860, y=∓80.
    return aMatches && bMatches && Math.abs(seg.a.y - seg.b.y) > TOL;
  });
}

describe('opening-overlay-drawing — ADR-672 plan-view handle glyph', () => {
  it('swing door: draws a handle tick perpendicular to the leaf, near the latch (free) end', () => {
    const { dc, segments } = createMockDc();
    drawOpeningPlanOverlay(makeSwingDoor(), dc);
    expect(hasHandleTickSegment(segments)).toBe(true);
  });

  it('swing door: handle tick is NOT at the hinge (x≈0) — it sits at the latch end', () => {
    const { dc, segments } = createMockDc();
    drawOpeningPlanOverlay(makeSwingDoor(), dc);
    const nearHinge = segments.some((seg) =>
      Math.abs(seg.a.x) < TOL && Math.abs(seg.a.y - EXPECTED_HANDLE_Y) < TOL,
    );
    expect(nearHinge).toBe(false);
  });

  it('fixed glazing (non-swing): draws NO handle tick', () => {
    const { dc, segments } = createMockDc();
    drawOpeningPlanOverlay(makeFixedGlazing(), dc);
    expect(hasHandleTickSegment(segments)).toBe(false);
  });
});
