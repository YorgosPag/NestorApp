/**
 * ADR-449/493/458 — `beamFinishOutline`: το outline δοκαριού για το plaster union = **ΤΟ ΟΡΑΤΟ ΣΩΜΑ**
 * (deep seat-fill → cutback στην παρειά → sliver-reject), ίδιο SSoT με το μπετόν → ο σοβάς τυλίγει τη
 * diagonal μύτη miter. Επιστρέφει **ένα ring ανά ορατό κομμάτι** (`readonly (readonly Pt2[])[]`).
 *
 * Setup: οριζόντιο δοκάρι (πλάτος 200) του οποίου ο άξονας σταματά ΑΚΡΙΒΩΣ στη δυτική παρειά μιας
 * κολόνας 400×400 (frame-into). Το ορατό σώμα κόβεται στη δυτική παρειά (x=800) και ακουμπά edge-to-edge
 * την κολόνα → το `safeUnion` (+ grid-weld) δίνει ΕΝΑ ενιαίο καπάκι.
 * Regression: καμία κολόνα / χωρίς άξονα / curved (>2 σημεία) → `[raw]` outline αμετάβλητο.
 */

import { beamFinishOutline } from '../structural-finish-scene-silhouette';
import { computeMergedStructuralTopCap } from '../structural-finish-scene-horizontal';
import type { Pt2 } from '../../geometry/shared/segment-polygon-coverage';

/** Κολόνα 400×400 κεντραρισμένη στο (1000,0): δυτική παρειά x=800, ανατολική x=1200. */
const COLUMN_FP: Pt2[] = [
  { x: 800, y: -200 },
  { x: 1200, y: -200 },
  { x: 1200, y: 200 },
  { x: 800, y: 200 },
];

/** Raw outline δοκαριού (πλάτος 200) — ανατολικό άκρο εφαπτόμενο στη δυτική παρειά (x=800). */
const RAW_OUTLINE: Pt2[] = [
  { x: 0, y: -100 },
  { x: 800, y: -100 },
  { x: 800, y: 100 },
  { x: 0, y: 100 },
];

function beam(geometry: {
  outline?: { vertices?: readonly Pt2[] };
  axisPolyline?: { points?: readonly Pt2[] };
}) {
  return {
    id: 'beam_test',
    params: { finish: undefined, sceneUnits: 'mm' as const, topElevation: 3000, zOffset: 0, depth: 500 },
    geometry,
  };
}

describe('beamFinishOutline (ADR-449/493/458) — ορατό σώμα δοκαριού (deep+cutback+sliver-reject)', () => {
  it('straight δοκάρι, άκρο στην παρειά κολόνας → ορατό σώμα κομμένο στην παρειά (edge-to-edge, ενιαίο καπάκι)', () => {
    const rings = beamFinishOutline(
      beam({ outline: { vertices: RAW_OUTLINE }, axisPolyline: { points: [{ x: 0, y: 0 }, { x: 800, y: 0 }] } }),
      [COLUMN_FP],
    );
    expect(rings).toHaveLength(1); // ένα ορατό κομμάτι (κολόνα στο άκρο, όχι mid-span)
    const pts = rings[0];
    // Το deep-extend σπρώχνει το άκρο στο x=1000 (μέσα στην κολόνα) και το cutback το κόβει ΠΙΣΩ στη
    // δυτική παρειά x=800 → το ορατό μπετόν σταματά flush στην παρειά (ακουμπά edge-to-edge → union).
    expect(Math.max(...pts.map((p) => p.x))).toBeCloseTo(800);
    // Το δυτικό άκρο (x=0, μη πλαισιωμένο) μένει ακίνητο.
    expect(Math.min(...pts.map((p) => p.x))).toBeCloseTo(0);
  });

  it('regression: καμία κολόνα → [raw] outline αμετάβλητο', () => {
    const out = beamFinishOutline(
      beam({ outline: { vertices: RAW_OUTLINE }, axisPolyline: { points: [{ x: 0, y: 0 }, { x: 800, y: 0 }] } }),
      [],
    );
    expect(out).toEqual([RAW_OUTLINE]);
  });

  it('regression: χωρίς άξονα → [raw] outline αμετάβλητο', () => {
    const out = beamFinishOutline(beam({ outline: { vertices: RAW_OUTLINE } }), [COLUMN_FP]);
    expect(out).toEqual([RAW_OUTLINE]);
  });

  it('regression: curved δοκάρι (>2 σημεία άξονα) → [raw] outline αμετάβλητο', () => {
    const out = beamFinishOutline(
      beam({
        outline: { vertices: RAW_OUTLINE },
        axisPolyline: { points: [{ x: 0, y: 0 }, { x: 400, y: 50 }, { x: 800, y: 0 }] },
      }),
      [COLUMN_FP],
    );
    expect(out).toEqual([RAW_OUTLINE]);
  });
});

/**
 * ADR-449/493 — το ΕΝΙΑΙΟ πάνω-καπάκι (`computeMergedStructuralTopCap`) πρέπει να καλύπτει
 * δοκάρι + πλαισιωμένες κολόνες σε ΕΝΑ συνδεδεμένο πολύγωνο ΧΩΡΙΣ τρύπα. Δύο ανεξάρτητες
 * αιτίες που έλυσε αυτή η αλλαγή (Giorgio screenshot 100928, 2026-07-02):
 *   A) beam core = raw outline → σταματά στην παρειά → union άφηνε 2 rings (ασύνδετο).
 *   B) το δοκάρι-obstacle κάλυπτε τον ΕΑΥΤΟ του στο δικό του plane → τρύπα «κανένα καπάκι».
 *
 * Setup: δύο κολόνες 400×400 (δυτική x[0,400], ανατολική x[2000,2400]) + δοκάρι πλάτους 200
 * που πλαισιώνεται παρειά-με-παρειά (x[400,2000]), ΟΛΑ με κορυφή στο 3000 (ίδιο top-plane).
 */
const SPEC = { enabled: true, thickness: 15, interiorMaterialId: 'i', exteriorMaterialId: 'e', exteriorThickness: 25 } as const;
const COL_WEST: Pt2[] = [{ x: 0, y: -200 }, { x: 400, y: -200 }, { x: 400, y: 200 }, { x: 0, y: 200 }];
const COL_EAST: Pt2[] = [{ x: 2000, y: -200 }, { x: 2400, y: -200 }, { x: 2400, y: 200 }, { x: 2000, y: 200 }];
const BEAM_OUT: Pt2[] = [{ x: 400, y: -100 }, { x: 2000, y: -100 }, { x: 2000, y: 100 }, { x: 400, y: 100 }];
const BEAM_AXIS: Pt2[] = [{ x: 400, y: 0 }, { x: 2000, y: 0 }];

const hCol = (fp: Pt2[]) => ({
  params: { finish: SPEC, sceneUnits: 'mm' as const, baseOffset: 0, height: 3000, baseBinding: 'storey-floor' as const, envelopeFunction: undefined },
  geometry: { footprint: { vertices: fp } },
});
const hBeam = () => ({
  params: { finish: SPEC, sceneUnits: 'mm' as const, topElevation: 3000, zOffset: 0, depth: 500, envelopeFunction: undefined, startPoint: BEAM_AXIS[0], endPoint: BEAM_AXIS[1] },
  geometry: { outline: { vertices: BEAM_OUT }, axisPolyline: { points: BEAM_AXIS } },
});
const hBeamObs = () => ({ id: 'beam1', params: { topElevation: 3000, zOffset: 0, depth: 500 }, geometry: { outline: { vertices: BEAM_OUT } } });

const holesOf = (fs: ReturnType<typeof computeMergedStructuralTopCap>) => fs.reduce((n, f) => n + f.polygons.reduce((h, p) => h + p.holes.length, 0), 0);
const polysOf = (fs: ReturnType<typeof computeMergedStructuralTopCap>) => fs.reduce((n, f) => n + f.polygons.length, 0);
const areaOf = (fs: ReturnType<typeof computeMergedStructuralTopCap>) => fs.reduce((a, f) => a + f.areaM2, 0);

describe('computeMergedStructuralTopCap (ADR-449/493) — ενιαίο καπάκι δοκάρι↔κολόνες Τ/Γ', () => {
  it('δοκάρι + 2 πλαισιωμένες κολόνες (ίδιο top-plane) → ΕΝΑ συνδεδεμένο πολύγωνο ΧΩΡΙΣ τρύπα', () => {
    const faces = computeMergedStructuralTopCap({
      columns: [hCol(COL_WEST), hCol(COL_EAST)], beams: [hBeam()], walls: [], slabs: [],
      beamObstacles: [hBeamObs()], floorElevationMm: 0,
    });
    expect(polysOf(faces)).toBe(1); // fix A: επέκταση → 1 ring (raw = 2 ασύνδετα)
    expect(holesOf(faces)).toBe(0); // fix B: μηδέν self-cover τρύπα πάνω στο δοκάρι
    expect(faces[0].zMm).toBe(3000);
  });

  it('fix B: η παρουσία του δοκαριού-obstacle ΔΕΝ μικραίνει το καπάκι (δεν καλύπτει τον εαυτό του)', () => {
    const withObs = computeMergedStructuralTopCap({
      columns: [hCol(COL_WEST), hCol(COL_EAST)], beams: [hBeam()], walls: [], slabs: [], beamObstacles: [hBeamObs()], floorElevationMm: 0,
    });
    const noObs = computeMergedStructuralTopCap({
      columns: [hCol(COL_WEST), hCol(COL_EAST)], beams: [hBeam()], walls: [], slabs: [], beamObstacles: [], floorElevationMm: 0,
    });
    expect(areaOf(withObs)).toBeCloseTo(areaOf(noObs), 3);
  });

  it('regression: γνήσια κάλυψη άνωθεν (πλάκα ΠΑΝΩ από το plane) εξακολουθεί να κρύβει το καπάκι', () => {
    const slabAbove = { params: { outline: { vertices: [{ x: -500, y: -500 }, { x: 3000, y: -500 }, { x: 3000, y: 500 }, { x: -500, y: 500 }] }, levelElevation: 3200, heightOffsetFromLevel: 0, thickness: 200 } };
    const faces = computeMergedStructuralTopCap({
      columns: [hCol(COL_WEST), hCol(COL_EAST)], beams: [hBeam()], walls: [], slabs: [slabAbove], beamObstacles: [hBeamObs()], floorElevationMm: 0,
    });
    expect(faces).toHaveLength(0); // slab zBot=3000 → zTop=3200 > plane → coversAbove → πλήρης κάλυψη
  });
});
