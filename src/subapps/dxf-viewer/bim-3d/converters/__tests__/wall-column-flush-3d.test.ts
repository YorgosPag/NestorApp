/**
 * ADR-449 #2/#C (2026-07-19 — FLUSH join) — ο 3Δ πυρήνας του τοίχου φτάνει ΑΚΡΙΒΩΣ στην
 * παρειά της κολόνας, χωρίς pull-back → μηδέν κενό στο 3D/OBJ (C4D-grade).
 *
 * Regression pin του παλιού bug: το 2mm-ανά-άκρη pull-back κόντυνε τον πυρήνα 4mm (1750→1746).
 * Σενάριο = handoff: οριζόντιος τοίχος 1750mm ανάμεσα σε 2 κολόνες που «κουμπώνει» flush και
 * στα δύο άκρα (start ΠΑΝΩ στη δεξιά παρειά της αριστ. κολόνας, end ΠΑΝΩ στην αριστ. παρειά
 * της δεξ. κολόνας). Το X-άνοιγμα του mesh πρέπει να είναι 1.750 m, ΟΧΙ 1.746.
 */

import * as THREE from 'three';
import { wallToMesh } from '../BimToThreeConverter';
import { computeWallGeometry } from '../../../bim/geometry/wall-geometry';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';
import type { Point3D } from '../../../bim/types/bim-base';

/** X extent (μήκος κατά τον άξονα, metres) ενός built mesh/group. */
function spanX(obj: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(obj);
  return box.max.x - box.min.x;
}

// Ίσιος οριζόντιος τοίχος, μήκος 1.750 m (scene units = m), πάχος 210 mm.
// Άκρα = οι παρειές των κολονών (handoff): start x=−8.915, end x=−7.165.
function flushWall(): WallEntity {
  const params: WallParams = {
    category: 'interior',
    start: { x: -8.915, y: 0, z: 0 },
    end: { x: -7.165, y: 0, z: 0 },
    height: 3000,
    thickness: 210,
    flip: false,
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
    sceneUnits: 'm',
  };
  return {
    id: 'wall_flush', type: 'wall', kind: 'straight', layerId: '0', params,
    geometry: computeWallGeometry(params, 'straight'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as WallEntity;
}

const rect = (x0: number, x1: number, y0: number, y1: number): Point3D[] => [
  { x: x0, y: y0, z: 0 }, { x: x1, y: y0, z: 0 }, { x: x1, y: y1, z: 0 }, { x: x0, y: y1, z: 0 },
];

// Αριστ. κολόνα: δεξιά παρειά x=−8.915 (edge-touch με τη start, μηδέν x-overlap → butt, όχι cutback).
const LEFT_COLUMN: Point3D[] = rect(-9.165, -8.915, -0.125, 0.125);
// Δεξ. κολόνα: αριστ. παρειά x=−7.165 (edge-touch με την end).
const RIGHT_COLUMN: Point3D[] = rect(-7.165, -6.915, -0.125, 0.125);

describe('wallToMesh — wall↔column FLUSH join (ADR-449 #2/#C, 2026-07-19)', () => {
  it('ο τοίχος που κουμπώνει σε 2 κολόνες μένει flush → X-άνοιγμα = 1.750 m (όχι 1.746)', () => {
    const mesh = wallToMesh(
      flushWall(), [], 0, '0', 0, undefined, undefined, undefined, undefined,
      [LEFT_COLUMN, RIGHT_COLUMN],
    );
    expect(mesh).not.toBeNull();
    // Flush: κανένα άκρο δεν υποχωρεί → πλήρες μήκος. Το παλιό pull-back θα έδινε 1.746 (fail).
    expect(spanX(mesh as THREE.Object3D)).toBeCloseTo(1.75, 3);
  });

  it('ίδιος τοίχος ΧΩΡΙΣ κολόνες → ίδιο X-άνοιγμα (η παρουσία κολόνας δεν κονταίνει πια τον πυρήνα)', () => {
    const withCols = wallToMesh(
      flushWall(), [], 0, '0', 0, undefined, undefined, undefined, undefined,
      [LEFT_COLUMN, RIGHT_COLUMN],
    );
    const noCols = wallToMesh(flushWall(), [], 0, '0', 0);
    expect(spanX(withCols as THREE.Object3D)).toBeCloseTo(spanX(noCols as THREE.Object3D), 6);
  });
});
