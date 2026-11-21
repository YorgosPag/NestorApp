/**
 * ADR-920 §14.5 — πού μπορεί να σταθεί η κάμερα: ποτέ κάτω από το έδαφος, πάντα όλο το οικόπεδο στην πλαισίωση.
 */

import * as THREE from 'three';

import { buildTerrain3dGeometry } from '@/lib/terrain/publication/terrain-3d-geometry';
import { REAL_PLANE } from '@/lib/terrain/publication/__tests__/fixtures/terrain-3d-fixtures';

import {
  clampAboveHorizon,
  orbitAround,
  TERRAIN_3D_FOV_DEG,
  TERRAIN_3D_MAX_POLAR_RAD,
  TERRAIN_3D_MIN_POLAR_RAD,
  terrainBox,
  terrainOrbitLimits,
  terrainPoseFor,
} from '../terrain-3d-camera';

const built = buildTerrain3dGeometry(REAL_PLANE(), { verticalExaggeration: 1 });
if (!built.ok) throw new Error('fixture geometry did not build');
const BOUNDS = built.geometry.bounds;
const UP = new THREE.Vector3(0, 1, 0);
const polarOf = (v: THREE.Vector3): number => v.angleTo(UP);

describe('clampAboveHorizon', () => {
  it('όψη ΚΑΤΩ ⇒ κλαδεύεται στον ορίζοντα (85°), ποτέ από κάτω', () => {
    const dir = clampAboveHorizon(new THREE.Vector3(0, -1, 0));
    expect(dir).not.toBeNull();
    expect(polarOf(dir!)).toBeCloseTo(TERRAIN_3D_MAX_POLAR_RAD, 6);
    expect(dir!.y).toBeGreaterThan(0);
  });

  it('διάνυσμα κάτω από τον ορίζοντα κρατά το αζιμούθιό του', () => {
    const dir = clampAboveHorizon(new THREE.Vector3(1, -0.5, 0))!;
    expect(polarOf(dir)).toBeCloseTo(TERRAIN_3D_MAX_POLAR_RAD, 6);
    expect(dir.z).toBeCloseTo(0, 9);
    expect(dir.x).toBeGreaterThan(0);
  });

  it('όψη ΠΑΝΩ ⇒ ελάχιστη κλίση ΑΠΟ ΤΟΝ ΝΟΤΟ (ο βορράς πάνω στην οθόνη, όπως η κάτοψη)', () => {
    const dir = clampAboveHorizon(new THREE.Vector3(0, 1, 0))!;
    expect(polarOf(dir)).toBeCloseTo(TERRAIN_3D_MIN_POLAR_RAD, 6);
    expect(dir.z).toBeGreaterThan(0);
    expect(dir.x).toBeCloseTo(0, 9);
  });

  it('επιτρεπτό διάνυσμα μένει ίδιο (μοναδιαίο)', () => {
    const input = new THREE.Vector3(1, 1, 1);
    expect(clampAboveHorizon(input)!.toArray()).toEqual(input.clone().normalize().toArray().map((n) => expect.closeTo(n, 9)));
  });

  it.each([[new THREE.Vector3(0, 0, 0)], [new THREE.Vector3(Number.NaN, 1, 0)]])('μηδενικό / μη πεπερασμένο ⇒ null', (v) => {
    expect(clampAboveHorizon(v)).toBeNull();
  });
});

describe('terrainPoseFor — πλαισίωση', () => {
  it('από κάθε κατεύθυνση, ΟΛΕΣ οι γωνίες του όγκου μέσα στο οπτικό πεδίο', () => {
    const corners = cornersOf(terrainBox(BOUNDS));
    for (const toCamera of [new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0.2, 0)]) {
      const pose = terrainPoseFor(toCamera, BOUNDS, 16 / 9)!;
      const camera = new THREE.PerspectiveCamera(TERRAIN_3D_FOV_DEG, 16 / 9, 0.01, 1e6);
      camera.position.copy(pose.position);
      camera.lookAt(pose.target);
      camera.updateMatrixWorld();
      for (const corner of corners) {
        const ndc = corner.clone().project(camera);
        expect(Math.abs(ndc.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(ndc.y)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('η κάμερα δεν βρίσκεται ποτέ κάτω από το κέντρο του όγκου', () => {
    const pose = terrainPoseFor(new THREE.Vector3(0, -1, 1), BOUNDS, 1)!;
    expect(pose.position.y).toBeGreaterThan(pose.target.y);
  });
});

describe('terrainOrbitLimits', () => {
  it('θετικά, αύξοντα όρια· το near πριν από το minDistance, το far πέρα από το maxDistance', () => {
    const limits = terrainOrbitLimits(BOUNDS);
    expect(limits.near).toBeGreaterThan(0);
    expect(limits.near).toBeLessThan(limits.minDistance);
    expect(limits.minDistance).toBeLessThan(limits.maxDistance);
    expect(limits.far).toBeGreaterThan(limits.maxDistance);
    expect(limits.maxTargetRadius).toBeGreaterThan(0);
  });
});

describe('orbitAround — σύρση του κύβου', () => {
  it('δεν κατεβαίνει κάτω από τις 85°, όσο κι αν σύρεις', () => {
    const target = new THREE.Vector3();
    const next = orbitAround(new THREE.Vector3(10, 10, 10), target, 0, -100);
    expect(polarOf(next.clone().sub(target))).toBeCloseTo(TERRAIN_3D_MAX_POLAR_RAD, 6);
  });

  it('κρατά την απόσταση από τον στόχο', () => {
    const target = new THREE.Vector3(1, 2, 3);
    const start = new THREE.Vector3(11, 12, 13);
    expect(orbitAround(start, target, 0.7, 0.2).distanceTo(target)).toBeCloseTo(start.distanceTo(target), 9);
  });
});

function cornersOf(box: { readonly min: THREE.Vector3; readonly max: THREE.Vector3 }): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) out.push(new THREE.Vector3(x, y, z));
  return out;
}
