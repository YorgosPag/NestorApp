/**
 * ADR-403 — world-to-scene-point SSoT unit tests.
 *
 * Verifies the metre→scene-unit conversion + the world-Z = -DXF-north sign flip
 * across the unit spectrum (the 1000× off-screen regression guard).
 */

import * as THREE from 'three';
import { worldToScenePoint } from '../world-to-scene-point';

describe('worldToScenePoint', () => {
  it('metre scene: world XZ maps 1:1 to plan (with north sign flip)', () => {
    // world (east=3m, up=0, north=-2m → z=+2) → DXF (x=3000mm, y=-2000mm) → m
    const p = worldToScenePoint(new THREE.Vector3(3, 0, 2), 'm');
    expect(p.x).toBeCloseTo(3, 6);
    expect(p.y).toBeCloseTo(-2, 6);
  });

  it('mm scene: world metres scale up by 1000', () => {
    const p = worldToScenePoint(new THREE.Vector3(3, 0, 2), 'mm');
    expect(p.x).toBeCloseTo(3000, 6);
    expect(p.y).toBeCloseTo(-2000, 6);
  });

  it('cm scene: world metres scale up by 100', () => {
    const p = worldToScenePoint(new THREE.Vector3(1, 0, -1), 'cm');
    expect(p.x).toBeCloseTo(100, 6);
    expect(p.y).toBeCloseTo(100, 6); // -z = -(-1) = +1m → 100cm
  });

  it('drops the world-Y (elevation) component — only the plane matters', () => {
    const flat = worldToScenePoint(new THREE.Vector3(2, 0, 1), 'm');
    const high = worldToScenePoint(new THREE.Vector3(2, 9.5, 1), 'm');
    expect(high).toEqual(flat);
  });

  it('sign flip: +north (world -z) → +DXF y', () => {
    const p = worldToScenePoint(new THREE.Vector3(0, 0, -5), 'm');
    expect(p.y).toBeCloseTo(5, 6);
  });
});
