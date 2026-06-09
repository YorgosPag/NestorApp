/**
 * ADR-408 Φ-D — bim3d-endpoint-move: gizmo endpoint handle → per-endpoint segment patch.
 *
 * Pure, no mocks. Verifies that dragging ONE end relocates only that end (plan + z),
 * leaves the other fixed, re-derives the centreline cache, normalises a LEGACY
 * horizontal run's z (never drops the fixed end to 0), and no-ops a zero drag.
 */

import {
  computeMepSegmentEndpointMove,
  computeWallEndpointMove,
  computeBeamEndpointMove,
} from '../bim3d-endpoint-move';
import {
  resolveSegmentEndpointElevationsMm,
  type MepSegmentParams,
} from '../../../bim/types/mep-segment-types';
import type { WallParams } from '../../../bim/types/wall-types';
import type { BeamParams } from '../../../bim/types/beam-types';

// 'mm' scene ⇒ 1 canvas unit = 1 mm. A=(0,0)→B=(1000,0).
function pipe(startZ = 2800, endZ = 2800): MepSegmentParams {
  return {
    domain: 'pipe',
    sectionKind: 'round',
    startPoint: { x: 0, y: 0, z: startZ },
    endPoint: { x: 1000, y: 0, z: endZ },
    centerlineElevationMm: (startZ + endZ) / 2,
    diameter: 110,
    sceneUnits: 'mm',
  };
}

/** A LEGACY horizontal run: both z = 0 but the real elevation is the centreline. */
function legacyPipe(centerline = 2800): MepSegmentParams {
  return {
    domain: 'pipe',
    sectionKind: 'round',
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: 1000, y: 0, z: 0 },
    centerlineElevationMm: centerline,
    diameter: 110,
    sceneUnits: 'mm',
  };
}

describe('computeMepSegmentEndpointMove — start end', () => {
  it('moves only the start (plan + z); the end stays fixed', () => {
    const p = pipe(2800, 2800);
    const next = computeMepSegmentEndpointMove(p, 'start', { x: 200, y: -50 }, 300)!;
    expect(next).not.toBeNull();
    expect(next.startPoint.x).toBe(200);
    expect(next.startPoint.y).toBe(-50);
    expect(next.startPoint.z).toBe(3100);
    // End untouched.
    expect(next.endPoint.x).toBe(1000);
    expect(next.endPoint.y).toBe(0);
    expect(next.endPoint.z).toBe(2800);
    // Centreline re-derived from both ends.
    expect(next.centerlineElevationMm).toBe((3100 + 2800) / 2);
  });
});

describe('computeMepSegmentEndpointMove — end endpoint', () => {
  it('moves only the end (plan + z); the start stays fixed', () => {
    const p = pipe(2800, 2800);
    const next = computeMepSegmentEndpointMove(p, 'end', { x: 100, y: 0 }, -200)!;
    expect(next.endPoint.x).toBe(1100);
    expect(next.endPoint.z).toBe(2600);
    expect(next.startPoint.x).toBe(0);
    expect(next.startPoint.z).toBe(2800);
    expect(next.centerlineElevationMm).toBe((2800 + 2600) / 2);
  });
});

describe('computeMepSegmentEndpointMove — pure vertical (plan delta 0)', () => {
  it('lifts only the dragged end z, plan unchanged', () => {
    const next = computeMepSegmentEndpointMove(pipe(2800, 2800), 'start', { x: 0, y: 0 }, 500)!;
    expect(next.startPoint.x).toBe(0);
    expect(next.startPoint.z).toBe(3300);
    expect(next.endPoint.z).toBe(2800);
  });
});

describe('computeMepSegmentEndpointMove — legacy z normalisation', () => {
  it('lifts the dragged end from the resolved centreline (NOT from raw z=0) and keeps the fixed end at the centreline', () => {
    const p = legacyPipe(2800);
    // sanity: the resolver reads both ends as the centreline for a legacy run.
    expect(resolveSegmentEndpointElevationsMm(p)).toEqual({ startMm: 2800, endMm: 2800 });
    const next = computeMepSegmentEndpointMove(p, 'start', { x: 0, y: 0 }, 200)!;
    // dragged end = 2800 + 200 (NOT 0 + 200) — no "drop to floor" bug.
    expect(next.startPoint.z).toBe(3000);
    // fixed end normalised to the real elevation, NOT left at 0.
    expect(next.endPoint.z).toBe(2800);
    expect(next.centerlineElevationMm).toBe((3000 + 2800) / 2);
  });
});

describe('computeMepSegmentEndpointMove — no-op', () => {
  it('zero plan + zero vertical → null (no empty undo step)', () => {
    expect(computeMepSegmentEndpointMove(pipe(), 'start', { x: 0, y: 0 }, 0)).toBeNull();
  });
});

// ─── ADR-408 Φ1 — wall/beam LENGTH shape handles (horizontal, plan-only) ──────

function wall(): WallParams {
  return {
    category: 'interior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 4000, y: 0, z: 0 },
    height: 3000,
    thickness: 200,
    flip: false,
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
    sceneUnits: 'mm',
  };
}

describe('computeWallEndpointMove — Revit length shape-handle', () => {
  it('moves only the dragged end in plan; the other end + thickness/height stay fixed', () => {
    const next = computeWallEndpointMove(wall(), 'end', { x: 500, y: -300 })!;
    expect(next).not.toBeNull();
    expect(next.end.x).toBe(4500);
    expect(next.end.y).toBe(-300);
    // Start untouched; section/height untouched (those are Type, not a drag).
    expect(next.start.x).toBe(0);
    expect(next.start.y).toBe(0);
    expect(next.thickness).toBe(200);
    expect(next.height).toBe(3000);
  });

  it('drags the start end and clears its miter (recomputed at commit)', () => {
    const next = computeWallEndpointMove(wall(), 'start', { x: -200, y: 100 })!;
    expect(next.start.x).toBe(-200);
    expect(next.start.y).toBe(100);
    expect(next.startMiter).toBeUndefined();
    expect(next.end.x).toBe(4000); // far end fixed
  });

  it('zero plan delta → null (no empty undo step)', () => {
    expect(computeWallEndpointMove(wall(), 'start', { x: 0, y: 0 })).toBeNull();
  });
});

function beam(): BeamParams {
  return {
    kind: 'straight',
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: 5000, y: 0, z: 0 },
    width: 250,
    depth: 500,
    topElevation: 3000,
    sceneUnits: 'mm',
  };
}

describe('computeBeamEndpointMove — Revit length shape-handle', () => {
  it('moves only the dragged end in plan; the other end + width/depth stay fixed', () => {
    const next = computeBeamEndpointMove(beam(), 'end', { x: 1000, y: 200 })!;
    expect(next).not.toBeNull();
    expect(next.endPoint.x).toBe(6000);
    expect(next.endPoint.y).toBe(200);
    expect(next.startPoint.x).toBe(0);
    expect(next.width).toBe(250);
    expect(next.depth).toBe(500);
  });

  it('zero plan delta → null (no empty undo step)', () => {
    expect(computeBeamEndpointMove(beam(), 'end', { x: 0, y: 0 })).toBeNull();
  });
});
