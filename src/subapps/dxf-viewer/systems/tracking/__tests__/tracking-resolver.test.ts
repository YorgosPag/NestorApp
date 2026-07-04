/**
 * ADR-357 ambient-alignment extension — `tracking-resolver` characterization.
 *
 * First tests for the OST resolver (previously uncovered). Locks the behavior
 * before/after the `activePaths` addition:
 *   - projection  → kind 'projection', activePaths.length === 1
 *   - intersection→ kind 'intersection', activePaths.length === 2, distinct origins
 *   - source-agnostic merge: acquired + ambient-typed points resolve identically
 *   - out-of-tolerance → null
 */

import { resolveTrackingSnap } from '../tracking-resolver';
import type { TrackingPolarConfig } from '../tracking-resolver';
import type { AcquiredTrackingPoint } from '../TrackingPointStore';

const HV_ONLY: TrackingPolarConfig = {
  incrementAngle: 0,
  additionalAngles: [],
  polarEnabled: false,
};

// POLAR on + 15° increment (the DXF default) → 24 paths/anchor, which alone
// exceeds MAX_INTERSECTION_PATHS(16) → the anchor×anchor scan is skipped. Used to
// prove the segment-base clean corner survives the flood cap. (2026-07-04)
const POLAR_15: TrackingPolarConfig = {
  incrementAngle: 15,
  additionalAngles: [],
  polarEnabled: true,
};

function pt(x: number, y: number, sourceSnapType = 'endpoint'): AcquiredTrackingPoint {
  return { x, y, acquiredAt: 0, sourceSnapType };
}

describe('tracking-resolver (ADR-357 ambient extension)', () => {
  it('returns null when no points are acquired', () => {
    expect(resolveTrackingSnap({ x: 5, y: 5 }, [], HV_ONLY, 5)).toBeNull();
  });

  // ─── Projection ───────────────────────────────────────────────────────────
  it('projects the cursor onto a single horizontal alignment path', () => {
    const acquired = [pt(0, 0)];
    const result = resolveTrackingSnap({ x: 100, y: 0.4 }, acquired, HV_ONLY, 5);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('projection');
    expect(result!.activePaths).toHaveLength(1);
    expect(result!.activePaths[0].angleDeg).toBe(0);
    // Snaps onto the y=0 ray.
    expect(result!.point.x).toBeCloseTo(100);
    expect(result!.point.y).toBeCloseTo(0);
  });

  it('projects onto a vertical path when aligned in X', () => {
    const result = resolveTrackingSnap({ x: 0.3, y: 250 }, [pt(0, 0)], HV_ONLY, 5);
    expect(result!.kind).toBe('projection');
    expect(result!.activePaths).toHaveLength(1);
    expect(result!.point.x).toBeCloseTo(0);
  });

  // ─── Intersection ─────────────────────────────────────────────────────────
  it('resolves an intersection of two paths with two active paths', () => {
    // P1 vertical (x=0), P2 horizontal (y=100) → cross at (0,100).
    const acquired = [pt(0, 0), pt(100, 100)];
    const result = resolveTrackingSnap({ x: 0.5, y: 99.6 }, acquired, HV_ONLY, 5);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('intersection');
    expect(result!.activePaths).toHaveLength(2);
    // The two active paths emanate from distinct origins.
    const [a, b] = result!.activePaths;
    expect(a.origin).not.toEqual(b.origin);
    expect(result!.point.x).toBeCloseTo(0);
    expect(result!.point.y).toBeCloseTo(100);
  });

  // ─── Source-agnostic merge ────────────────────────────────────────────────
  it('resolves identically whether a point is acquired or ambient-sourced', () => {
    const cursor = { x: 100, y: 0.2 };
    const fromAcquired = resolveTrackingSnap(cursor, [pt(0, 0, 'endpoint')], HV_ONLY, 5);
    const fromAmbient = resolveTrackingSnap(cursor, [pt(0, 0, 'ambient-member')], HV_ONLY, 5);
    expect(fromAmbient!.point).toEqual(fromAcquired!.point);
    expect(fromAmbient!.kind).toBe(fromAcquired!.kind);
    expect(fromAmbient!.activePaths).toHaveLength(fromAcquired!.activePaths.length);
  });

  // ─── Tolerance gate ───────────────────────────────────────────────────────
  it('returns null when the cursor is outside the world tolerance', () => {
    const result = resolveTrackingSnap({ x: 100, y: 50 }, [pt(0, 0)], HV_ONLY, 5);
    expect(result).toBeNull();
  });

  // ─── Segment-base clean corner (OTRACK, 2026-07-04) ───────────────────────
  it('locks the clean corner via the segment base even when POLAR floods the path cap', () => {
    // Anchor A=(0,100) [top-left]; segment base C=(445,0) [bottom-right]. POLAR 15°
    // → 24 paths from A alone (> cap) so the anchor×anchor scan is skipped. The base
    // ray (horizontal from C) × A's vertical trace still yields the corner (0,0).
    const result = resolveTrackingSnap({ x: 2, y: 3 }, [pt(0, 100)], POLAR_15, 5, { x: 445, y: 0 });
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('intersection');
    expect(result!.point.x).toBeCloseTo(0);
    expect(result!.point.y).toBeCloseTo(0); // = C.y, NOT the cursor's y=3 → no tilt
  });

  it('without a segment base the same cursor projects to a TILTED point (the bug)', () => {
    // Identical setup, no segmentBase → anchor×anchor skipped (24>16), no base scan
    // → falls back to projecting onto A's vertical trace: x=0 but y=cursor.y (=3),
    // i.e. the tilted endpoint (inflated length) Giorgio reported.
    const result = resolveTrackingSnap({ x: 2, y: 3 }, [pt(0, 100)], POLAR_15, 5);
    expect(result!.kind).toBe('projection');
    expect(result!.point.x).toBeCloseTo(0);
    expect(result!.point.y).toBeCloseTo(3); // keeps cursor y → tilt
  });

  it('a null segment base leaves the anchor-intersection behavior unchanged', () => {
    // Two anchors already crossing at (0,100); segmentBase=null must not regress the
    // existing anchor×anchor intersection.
    const result = resolveTrackingSnap({ x: 0.5, y: 99.6 }, [pt(0, 0), pt(100, 100)], HV_ONLY, 5, null);
    expect(result!.kind).toBe('intersection');
    expect(result!.point.x).toBeCloseTo(0);
    expect(result!.point.y).toBeCloseTo(100);
  });
});
