/**
 * Waist slab (μηρός) — the monolithic concrete body under the steps (Revit "Monolithic
 * Stair"). Because the treads/risers are thin FINISH shells (40/20 mm), a flat sloped
 * slab through the re-entrant corners would poke above the tread surfaces between corners
 * and cut the risers (Giorgio 2026-07-21). So the waist is a STEPPED prism: top = the
 * step profile, bottom = a sloped soffit `waist` perpendicular below the re-entrant line.
 *
 * Verifies: (a) monolithic/cantilever emit one extruded prism per flight; open/stringer
 * none; (b) a LANDING (z-gap) splits into two prisms; (c) the section top never rises
 * above the re-entrant line (tread tops) → zero intersection with the finishes; (d) the
 * soffit sits exactly `waist` PERPENDICULAR below; (e) pure `flightSectionPoints` shape.
 *
 * @see ../stair-waist-slabs.ts · ../StairToThreeConverter.ts
 */

import * as THREE from 'three';
import { buildWaistSlabMeshes, flightSectionPoints } from '../stair-waist-slabs';
import { stairToMeshes } from '../StairToThreeConverter';
import { inferSceneUnitsFromWidth, sceneUnitsToMeters } from '../../../utils/scene-units';
import type { StairEntity, StairStructureType, Point3D } from '../../../bim/types/stair-types';

const P = (x: number, y: number, z: number): Point3D => ({ x, y, z });
const WIDTH = 900;
const RISE = 175;
const TREAD = 270;
const NOSING = 30;
const WAIST_MM = 160;
const STEP_COUNT = 3;
const PITCH = RISE / TREAD; // tanθ of the re-entrant line

/** One tread quad: back edge `[0]→[3]` at `(along, 0..WIDTH, z)`, front `[1],[2]` a depth ahead. */
function mkTread(along: number, z: number): Point3D[] {
  const depth = TREAD + NOSING;
  return [P(along, 0, z), P(along + depth, 0, z), P(along + depth, WIDTH, z), P(along, WIDTH, z)];
}

/** Straight monolithic run ascending +X: 3 treads, re-entrant corners at z = 0/175/350. */
function makeStraightMonolithic(structureType: StairStructureType = 'monolithic'): StairEntity {
  const treads = [mkTread(0, 0), mkTread(TREAD, RISE), mkTread(2 * TREAD, 2 * RISE)];
  return {
    id: 'stair_waist', type: 'stair',
    params: {
      basePoint: P(0, 0, 0), direction: 0, rise: RISE, tread: TREAD, nosing: NOSING, width: WIDTH,
      stepCount: STEP_COUNT, riserType: 'closed', structureType, waistThickness: WAIST_MM,
      handrails: { inner: false, outer: false, height: 900 },
    },
    geometry: {
      treads, treadsBelowCut: treads, treadsAboveCut: [], risers: [],
      stringers: { inner: [], outer: [] }, walkline: [], handrails: {}, landings: [],
      arrowSymbol: { start: P(0, 450, 0), end: P(500, 450, 0), label: 'UP' },
      bbox: { min: P(0, 0, 0), max: P(810, WIDTH, 2 * RISE) },
    },
  } as unknown as StairEntity;
}

/** Two flights split by a landing: z-gap of 2·rise between the runs → two prisms. */
function makeWithLanding(): StairEntity {
  const s = makeStraightMonolithic();
  const treads = [mkTread(0, 0), mkTread(TREAD, RISE), mkTread(0, 3 * RISE), mkTread(TREAD, 4 * RISE)];
  return {
    ...s,
    params: { ...s.params, stepCount: 4 },
    geometry: { ...s.geometry, treads, treadsBelowCut: treads, treadsAboveCut: [] },
  } as unknown as StairEntity;
}

describe('stair-waist-slabs (μηρός)', () => {
  const sceneToM = sceneUnitsToMeters(inferSceneUnitsFromWidth(WIDTH));

  it('monolithic → one extruded prism for the flight', () => {
    const meshes = buildWaistSlabMeshes(makeStraightMonolithic(), 0, sceneToM);
    expect(meshes).toHaveLength(1);
    expect(meshes[0]!.geometry.type).toBe('ExtrudeGeometry');
  });

  it('cantilever also emits a solid body', () => {
    expect(buildWaistSlabMeshes(makeStraightMonolithic('cantilever'), 0, sceneToM)).toHaveLength(1);
  });

  it('open / stringer / glass / grating structures emit NO waist (open underneath)', () => {
    for (const t of ['stringer-1side', 'stringer-2side', 'central-stringer', 'suspended', 'glass-tread', 'steel-grating'] as const) {
      expect(buildWaistSlabMeshes(makeStraightMonolithic(t), 0, sceneToM)).toHaveLength(0);
    }
  });

  it('a LANDING (z-gap between runs) splits into two prisms', () => {
    expect(buildWaistSlabMeshes(makeWithLanding(), 0, sceneToM)).toHaveLength(2);
  });

  it('the solid NEVER rises above the re-entrant line (no intersection with the thin treads/risers)', () => {
    const mesh = buildWaistSlabMeshes(makeStraightMonolithic(), 0, sceneToM)[0]!;
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    // Section-x → world-x, section-y → world-y (uh = +X, origin at the floor corner), so
    // every vertex must sit on/below the re-entrant line y = pitch·x (the tread tops).
    for (let i = 0; i < pos.count; i++) {
      expect(pos.getY(i)).toBeLessThanOrEqual(PITCH * pos.getX(i) + 1e-6);
    }
  });

  it('soffit sits `waist` PERPENDICULAR below the NOSING line (min concrete = waist)', () => {
    const mesh = buildWaistSlabMeshes(makeStraightMonolithic(), 0, sceneToM)[0]!;
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!;
    const waistM = WAIST_MM * 0.001;
    const cosT = TREAD / Math.hypot(TREAD, RISE);
    // Deepest point = soffit under the base corner: one rise below it (nosing line) + waist/cosθ.
    expect(box.min.y).toBeCloseTo(-(RISE * sceneToM + waistM / cosT), 5);
    // Top reaches the landing-edge corner (one step past the last tread), no overhang.
    expect(box.max.y).toBeCloseTo(RISE * STEP_COUNT * sceneToM, 5);
  });

  it('flightSectionPoints: stepped top on re-entrant line, soffit BELOW the nosing line (valid solid)', () => {
    const cosT = TREAD / Math.hypot(TREAD, RISE);
    const vShift = WAIST_MM / cosT;          // perpendicular waist → vertical component
    const drop = RISE + vShift;              // soffit below the re-entrant corners
    const pts = flightSectionPoints(3, TREAD, RISE, drop);
    expect(pts).toHaveLength(2 + 7);         // 2 soffit + (2·M+1) staircase
    // Every vertex on/below the re-entrant line y = pitch·x (tread tops touch, never exceed).
    for (const p of pts) expect(p.y).toBeLessThanOrEqual(PITCH * p.x + 1e-9);
    // Soffit vertices sit strictly BELOW the nosing line y = pitch·x − rise → no self-intersection.
    const soffit = [pts[0]!, pts[1]!];
    for (const p of soffit) expect(p.y).toBeLessThan(PITCH * p.x - RISE + 1e-9);
    // Re-entrant corners present exactly.
    const has = (x: number, y: number) => pts.some((p) => Math.abs(p.x - x) < 1e-9 && Math.abs(p.y - y) < 1e-9);
    expect(has(0, 0) && has(TREAD, RISE) && has(3 * TREAD, 3 * RISE)).toBe(true);
  });

  it('integrates: stairToMeshes tags waist meshes with component "waist"', () => {
    const waist = stairToMeshes(makeStraightMonolithic()).filter(
      (m) => m.userData['stairComponent'] === 'waist',
    );
    expect(waist).toHaveLength(1);
    expect(waist[0]!.userData['bimId']).toBe('stair_waist');
  });
});
