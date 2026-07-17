/**
 * ADR-534 Φ7b — merged top-cap «hup» regression: το ενιαίο top-cap ΔΕΝ αφήνει πλέον περιμετρικό
 * plaster frame πάνω σε τοίχο/κολόνα που καλύπτεται από πλάκα.
 *
 * ΠΡΙΝ: το cap χτιζόταν στο finished (διεσταλμένο κατά το πάχος) outline, αλλά ο cover (πλάκα) είχε
 * outline = δομικός πυρήνας → έμενε δαχτυλίδι ~πάχος (μετρήθηκε 0.1272 m² σε 4m τοίχο, πάχος 15mm).
 * ΤΩΡΑ: ο cover διαστέλλεται κατά το πάχος (`dilatedCover`) → καταπίνει το frame → 0. Εκτεθειμένο
 * parapet (καμία πλάκα) → πλήρες cap αμετάβλητο.
 */

import {
  computeMergedStructuralTopCap,
  type HorizontalSlabObstacle,
} from '../structural-finish-scene-horizontal';
import { wallFootprintPolygon, type WallFinishObstacle } from '../structural-finish-scene';
import { bboxOf } from '../structural-finish-horizontal-obstacles';
import type { StructuralFinishSpec } from '../structural-finish-types';
import { buildDefaultWallParams } from '../../../hooks/drawing/wall-completion';

const SPEC: StructuralFinishSpec = {
  enabled: true, interiorMaterialId: 'mat-plaster-int', exteriorMaterialId: 'mat-plaster-ext', thickness: 15,
};

const wall = (id: string, x0: number, y0: number, x1: number, y1: number, height: number): WallFinishObstacle => ({
  id, kind: 'straight', params: buildDefaultWallParams({ x: x0, y: y0 }, { x: x1, y: y1 }, { height }, 'mm'),
});

const slabCovering = (id: string, x0: number, y0: number, x1: number, y1: number): HorizontalSlabObstacle => ({
  id,
  params: {
    kind: 'floor', finish: SPEC, levelElevation: 3000, heightOffsetFromLevel: 0, thickness: 200,
    outline: { vertices: [{ x: x0, y: y0, z: 0 }, { x: x1, y: y0, z: 0 }, { x: x1, y: y1, z: 0 }, { x: x0, y: y1, z: 0 }] },
  },
});

const totalArea = (fs: readonly { areaM2: number }[]): number => fs.reduce((a, f) => a + f.areaM2, 0);

describe('ADR-534 Φ7b — merged top-cap «hup» (πλάκα από πάνω → μηδέν plaster frame)', () => {
  const w = wall('w1', 0, 1500, 4000, 1500, 2800); // κορυφή 2800 = soffit της slab (top 3000, thick 200)
  const bb = bboxOf(wallFootprintPolygon(w));
  const cap = (slabs: HorizontalSlabObstacle[]) =>
    computeMergedStructuralTopCap({ columns: [], beams: [], walls: [w], slabs, beamObstacles: [], floorElevationMm: 0 });

  it('slab outline = δομικός ΠΥΡΗΝΑΣ τοίχου → ΚΑΝΕΝΑ hup (0 faces, 0 area)', () => {
    const faces = cap([slabCovering('s', bb.minX, bb.minY, bb.maxX, bb.maxY)]);
    expect(faces).toHaveLength(0);
    expect(totalArea(faces)).toBe(0);
  });

  it('ΕΚΤΕΘΕΙΜΕΝΟ parapet (καμία πλάκα από πάνω) → ΔΙΑΤΗΡΕΙ πλήρες cap (plaster στην κορυφή)', () => {
    const faces = cap([]);
    expect(faces.length).toBeGreaterThan(0);
    expect(totalArea(faces)).toBeGreaterThan(0);
  });
});
