/**
 * ADR-408 Φ-D — bim3d-endpoint-move: gizmo endpoint handle → per-endpoint segment patch.
 *
 * Pure, no mocks. Verifies that dragging ONE end relocates only that end (plan + z),
 * leaves the other fixed, re-derives the centreline cache, normalises a LEGACY
 * horizontal run's z (never drops the fixed end to 0), and no-ops a zero drag.
 */

import { computeMepSegmentEndpointMove } from '../bim3d-endpoint-move';
import {
  resolveSegmentEndpointElevationsMm,
  type MepSegmentParams,
} from '../../../bim/types/mep-segment-types';

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
