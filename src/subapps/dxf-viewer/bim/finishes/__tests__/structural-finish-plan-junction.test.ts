/**
 * ADR-449/458 — `dropPlanHiddenJunctionFaces` (2Δ κάτοψη) unit tests.
 *
 * Σε plan top-down, η όψη κολόνας που «κοιτάει» προς διπλανό δοκάρι (από πάνω) κρύβεται →
 * δεν σχεδιάζεται· οι ελεύθερες όψεις (προς κενό) μένουν. Τα γειτονικά άκρα της αφαιρεθείσας
 * όψης γίνονται junctions → ορθογώνια extend (ΟΧΙ chamfer). 3Δ αμετάβλητο (δεν περνά το flag).
 */

import { dropPlanHiddenJunctionFaces } from '../structural-finish-scene-silhouette';
import type { SilhouetteBand } from '../structural-finish-silhouette';
import type { FinishFaceSegment } from '../structural-finish-types';
import type { Pt2 } from '../../geometry/shared/segment-polygon-coverage';

function seg(a: Pt2, b: Pt2): FinishFaceSegment {
  return { a, b, classification: 'interior', materialId: 'mat-plaster-int', thickness: 15, lengthM: 1 };
}

/** Κολόνα 300×300 (CCW): south / east / north / west όψεις. */
const SOUTH = seg({ x: 0, y: 0 }, { x: 300, y: 0 });
const EAST = seg({ x: 300, y: 0 }, { x: 300, y: 300 }); // outward +X → προς δοκάρι
const NORTH = seg({ x: 300, y: 300 }, { x: 0, y: 300 });
const WEST = seg({ x: 0, y: 300 }, { x: 0, y: 0 });

/** Δοκάρι ανατολικά της κολόνας (καλύπτει x∈[300,600]). */
const BEAM_FP: Pt2[] = [
  { x: 300, y: 100 },
  { x: 600, y: 100 },
  { x: 600, y: 200 },
  { x: 300, y: 200 },
];

const COLUMN_FP: Pt2[] = [
  { x: 0, y: 0 },
  { x: 300, y: 0 },
  { x: 300, y: 300 },
  { x: 0, y: 300 },
];

function band(segments: FinishFaceSegment[]): SilhouetteBand {
  return { faces: { segments, heightM: 3, interiorAreaM2: 1, exteriorAreaM2: 0 }, zBottomMm: 0, zTopMm: 3000 };
}

describe('dropPlanHiddenJunctionFaces (ADR-449/458)', () => {
  it('αφαιρεί την όψη κολόνας προς το δοκάρι (κρυμμένη σε κάτοψη)· κρατά τις ελεύθερες', () => {
    const out = dropPlanHiddenJunctionFaces([band([SOUTH, EAST, NORTH, WEST])], [COLUMN_FP, BEAM_FP], 1);
    const kept = out.flatMap((b) => b.faces.segments);
    expect(kept).toHaveLength(3); // EAST (προς δοκάρι) αφαιρέθηκε
    // καμία εναπομείνασα όψη δεν είναι η EAST (a=(300,0)→b=(300,300))
    expect(kept.some((s) => s.a.x === 300 && s.a.y === 0 && s.b.x === 300 && s.b.y === 300)).toBe(false);
    // οι 3 ελεύθερες (SOUTH/NORTH/WEST) διατηρήθηκαν
    expect(kept.some((s) => s.a.x === 0 && s.a.y === 0 && s.b.x === 300 && s.b.y === 0)).toBe(true); // SOUTH
    expect(kept.some((s) => s.a.x === 0 && s.a.y === 300 && s.b.x === 0 && s.b.y === 0)).toBe(true); // WEST
  });

  it('τα γειτονικά άκρα της αφαιρεθείσας όψης γίνονται junctions → ορθογώνια extend (ΟΧΙ chamfer)', () => {
    const out = dropPlanHiddenJunctionFaces([band([SOUTH, EAST, NORTH, WEST])], [COLUMN_FP, BEAM_FP], 1);
    const kept = out.flatMap((b) => b.faces.segments);
    // SOUTH (a=(0,0)→b=(300,0)): το άκρο b=(300,0) ακουμπούσε την EAST → bJunction.
    const south = kept.find((s) => s.a.x === 0 && s.a.y === 0)!;
    expect(south.bJunction).toBe(true);
    // NORTH (a=(300,300)→b=(0,300)): το άκρο a=(300,300) ακουμπούσε την EAST → aJunction.
    const north = kept.find((s) => s.b.x === 0 && s.b.y === 300)!;
    expect(north.aJunction).toBe(true);
  });

  it('χωρίς διπλανό member → καμία όψη δεν αφαιρείται (μόνο η κολόνα)', () => {
    const out = dropPlanHiddenJunctionFaces([band([SOUTH, EAST, NORTH, WEST])], [COLUMN_FP], 1);
    expect(out[0].faces.segments).toHaveLength(4);
  });

  it('band που μένει χωρίς όψεις → απορρίπτεται', () => {
    const out = dropPlanHiddenJunctionFaces([band([EAST])], [COLUMN_FP, BEAM_FP], 1);
    expect(out).toHaveLength(0);
  });
});
