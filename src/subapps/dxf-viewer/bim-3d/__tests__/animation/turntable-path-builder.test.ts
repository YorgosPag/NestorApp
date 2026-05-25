/**
 * ADR-366 Phase 9 / C.1.a — TurntablePathBuilder tests.
 */

import { buildTurntablePath } from '../../animation/core/TurntablePathBuilder';
import type { SceneBbox } from '../../animation/core/TurntablePathBuilder';

const UNIT_BBOX: SceneBbox = {
  min: { x: -1, y: -1, z: -1 },
  max: { x: 1, y: 1, z: 1 },
};

describe('buildTurntablePath', () => {
  it('produces 240 samples για default 8s @ 30fps', () => {
    const path = buildTurntablePath(UNIT_BBOX);
    expect(path.length).toBe(240);
  });

  it('produces durationSec * fps samples για arbitrary config', () => {
    const path = buildTurntablePath(UNIT_BBOX, { durationSec: 4, fps: 24 });
    expect(path.length).toBe(96);
  });

  it('all waypoints target the scene-bbox-center', () => {
    const path = buildTurntablePath(UNIT_BBOX);
    expect(path.length).toBeGreaterThan(0);
    for (const wp of path) {
      expect(wp.target.x).toBeCloseTo(0, 6);
      expect(wp.target.y).toBeCloseTo(0, 6);
      expect(wp.target.z).toBeCloseTo(0, 6);
    }
  });

  it('all waypoints share identical FOV (default 50)', () => {
    const path = buildTurntablePath(UNIT_BBOX);
    for (const wp of path) {
      expect(wp.fov).toBe(50);
    }
  });

  it('respects custom FOV override', () => {
    const path = buildTurntablePath(UNIT_BBOX, { fov: 75 });
    for (const wp of path) {
      expect(wp.fov).toBe(75);
    }
  });

  it('Y-axis orbit produces position.y constant at center.y', () => {
    const path = buildTurntablePath(UNIT_BBOX, { axis: 'y' });
    for (const wp of path) {
      expect(wp.position.y).toBeCloseTo(0, 6);
    }
  });

  it('X-axis orbit produces position.x constant at center.x', () => {
    const path = buildTurntablePath(UNIT_BBOX, { axis: 'x' });
    for (const wp of path) {
      expect(wp.position.x).toBeCloseTo(0, 6);
    }
  });

  it('Z-axis orbit produces position.z constant at center.z', () => {
    const path = buildTurntablePath(UNIT_BBOX, { axis: 'z' });
    for (const wp of path) {
      expect(wp.position.z).toBeCloseTo(0, 6);
    }
  });

  it('CCW reversed produces mirrored angular direction vs CW', () => {
    const ccw = buildTurntablePath(UNIT_BBOX, { direction: 'ccw' });
    const cw = buildTurntablePath(UNIT_BBOX, { direction: 'cw' });
    // Second sample (index 1) should be mirror of CCW vs CW around starting axis.
    expect(ccw[1]!.position.z).toBeCloseTo(-cw[1]!.position.z, 6);
  });

  it('uses distance multiplier (orbit grows με larger bbox)', () => {
    const small = buildTurntablePath(UNIT_BBOX);
    const bigBbox: SceneBbox = {
      min: { x: -10, y: -10, z: -10 },
      max: { x: 10, y: 10, z: 10 },
    };
    const big = buildTurntablePath(bigBbox);
    const smallRadius = Math.hypot(small[0]!.position.x, small[0]!.position.z);
    const bigRadius = Math.hypot(big[0]!.position.x, big[0]!.position.z);
    expect(bigRadius).toBeGreaterThan(smallRadius);
  });

  it('handles degenerate (zero-size) bbox gracefully', () => {
    const point: SceneBbox = {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
    };
    const path = buildTurntablePath(point);
    expect(path.length).toBe(240);
    // All waypoints sit on a non-degenerate radius (radius clamped > 0).
    for (const wp of path) {
      expect(Number.isFinite(wp.position.x)).toBe(true);
      expect(Number.isFinite(wp.position.y)).toBe(true);
      expect(Number.isFinite(wp.position.z)).toBe(true);
    }
  });

  it('is deterministic (identical inputs → identical output)', () => {
    const a = buildTurntablePath(UNIT_BBOX);
    const b = buildTurntablePath(UNIT_BBOX);
    expect(a).toEqual(b);
  });
});
