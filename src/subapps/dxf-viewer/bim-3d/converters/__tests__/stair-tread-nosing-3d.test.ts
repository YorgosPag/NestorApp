/**
 * ADR-358 Q19 Φ4b — swept nosing solid tests.
 *
 * A straight +X flight fixture (scene units = mm, sceneToM = 0.001): tread 0 has
 * a 340 mm footprint depth (going 280 + overhang 60) and a bullnose section; a
 * neighbour tread orients the winding-agnostic frame.
 *
 * @see ../stair-tread-nosing-3d.ts
 */

import * as THREE from 'three';
import { buildTreadNosingMesh } from '../stair-tread-nosing-3d';
import type { Point2D, Polygon3D } from '../../../bim/types/stair-types';

const SCENE_TO_M = 0.001;
const THICKNESS_M = 0.04;
const TOL = 1e-6;

function mat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial();
}

/** Two +X treads (mm): tread 0 depth 340 (going 280 + overhang 60), width 1000. */
function straightTreads(): Polygon3D[] {
  return [
    [
      { x: 0, y: -500, z: 0 },
      { x: 340, y: -500, z: 0 },
      { x: 340, y: 500, z: 0 },
      { x: 0, y: 500, z: 0 },
    ],
    [
      { x: 280, y: -500, z: 175 },
      { x: 585, y: -500, z: 175 },
      { x: 585, y: 500, z: 175 },
      { x: 280, y: 500, z: 175 },
    ],
  ];
}

/** Bullnose section: front-top (x=overhang) traced down to the underside. */
function bullnose(): Point2D[] {
  return [
    { x: 60, y: 0 },
    { x: 55, y: -20 },
    { x: 40, y: -35 },
    { x: 20, y: -40 },
    { x: 0, y: -40 },
  ];
}

describe('buildTreadNosingMesh', () => {
  it('builds a swept mesh whose bbox reflects the footprint depth + width', () => {
    const mesh = buildTreadNosingMesh(straightTreads(), 0, bullnose(), SCENE_TO_M, THICKNESS_M, mat(), 0);
    expect(mesh).not.toBeNull();
    mesh!.geometry.computeBoundingBox();
    const bb = mesh!.geometry.boundingBox!;
    // Depth 340mm → 0.34m along world X; thickness 0.04m below top face (z=0).
    expect(bb.min.x).toBeCloseTo(0, TOL);
    expect(bb.max.x).toBeCloseTo(0.34, TOL);
    expect(bb.max.y).toBeCloseTo(0, TOL);
    expect(bb.min.y).toBeCloseTo(-0.04, TOL);
    // Width 1000mm → 1.0m along world Z, centred on the tread (±0.5).
    expect(bb.min.z).toBeCloseTo(-0.5, TOL);
    expect(bb.max.z).toBeCloseTo(0.5, TOL);
  });

  it('seats the top face at the tread elevation via baseY', () => {
    const mesh = buildTreadNosingMesh(straightTreads(), 0, bullnose(), SCENE_TO_M, THICKNESS_M, mat(), 2);
    mesh!.geometry.computeBoundingBox();
    // baseY=2, z=0 → top at 2.0, underside at 2.0 − 0.04.
    expect(mesh!.geometry.boundingBox!.max.y).toBeCloseTo(2, TOL);
    expect(mesh!.geometry.boundingBox!.min.y).toBeCloseTo(1.96, TOL);
  });

  it('produces a non-empty solid (positions written)', () => {
    const mesh = buildTreadNosingMesh(straightTreads(), 0, bullnose(), SCENE_TO_M, THICKNESS_M, mat(), 0);
    expect(mesh!.geometry.getAttribute('position').count).toBeGreaterThan(0);
  });

  it('returns null for a section with fewer than 2 points (flat-slab fallback)', () => {
    expect(
      buildTreadNosingMesh(straightTreads(), 0, [{ x: 60, y: 0 }], SCENE_TO_M, THICKNESS_M, mat(), 0),
    ).toBeNull();
  });

  it('returns null for a lone tread (no neighbour to orient the frame)', () => {
    const lone: Polygon3D[] = [straightTreads()[0]!];
    expect(buildTreadNosingMesh(lone, 0, bullnose(), SCENE_TO_M, THICKNESS_M, mat(), 0)).toBeNull();
  });

  it('returns null for a profile with zero overhang', () => {
    const flat: Point2D[] = [
      { x: 0, y: 0 },
      { x: 0, y: -40 },
    ];
    expect(buildTreadNosingMesh(straightTreads(), 0, flat, SCENE_TO_M, THICKNESS_M, mat(), 0)).toBeNull();
  });

  it('is winding-agnostic — orients along +Y for a 90° flight', () => {
    // +Y flight treads (mm): depth 340 along +Y, width 1000 along X.
    const treads: Polygon3D[] = [
      [
        { x: 500, y: 0, z: 0 },
        { x: 500, y: 340, z: 0 },
        { x: -500, y: 340, z: 0 },
        { x: -500, y: 0, z: 0 },
      ],
      [
        { x: 500, y: 280, z: 175 },
        { x: 500, y: 585, z: 175 },
        { x: -500, y: 585, z: 175 },
        { x: -500, y: 280, z: 175 },
      ],
    ];
    const mesh = buildTreadNosingMesh(treads, 0, bullnose(), SCENE_TO_M, THICKNESS_M, mat(), 0);
    mesh!.geometry.computeBoundingBox();
    const bb = mesh!.geometry.boundingBox!;
    // Depth now along world −Z (plan +Y → world −Z): span 0.34m; width 1.0m along X.
    expect(bb.max.x - bb.min.x).toBeCloseTo(1.0, TOL);
    expect(bb.max.z - bb.min.z).toBeCloseTo(0.34, TOL);
  });
});
