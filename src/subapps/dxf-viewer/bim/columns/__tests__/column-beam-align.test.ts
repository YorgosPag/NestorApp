/**
 * Tests for column-beam-align (ADR-496) — έξυπνη ευθυγράμμιση κολώνας στο πλαισιωτικό
 * δοκάρι κατά την αλλαγή τύπου σε L-shape.
 *
 * Επαληθεύουμε τις 4 απαιτήσεις (Revit-canonical, το δοκάρι = reference):
 *   (1) όψη «α» (near-end centerline του bearing arm) flush στην παρειά #1 του δοκαριού
 *   (2) άξονας bearing arm ≡ άξονας δοκαριού (rotateVector({0,1}, rotation) == u_span)
 *   (3) armWidth == beam.width
 *   (4) anchor='center', flipY=false (deterministic placement)
 * + catalog fallback (κανένα δοκάρι → null) + non-L kind → null + width clamp.
 */

import {
  alignColumnToFramingBeam,
  alignTShapeColumnToFramingBeams,
  alignLShapeColumnToFramingBeams,
  alignColumnOnTypeChange,
} from '../column-beam-align';
import { rotateVector } from '../../grips/grip-math';
import { mmToSceneUnits } from '../../../utils/scene-units';
import type { Point2D } from '../../../rendering/types/Types';
import type { BeamEntity } from '../../types/beam-types';
import type { ColumnEntity, ColumnParams } from '../../types/column-types';

/** Ορθογωνική κολώνα (current geometry) — footprint κεντραρισμένο στο (cx,cy), 2h × 2h. */
function rectColumn(cx: number, cy: number, h = 200): ColumnEntity {
  return {
    id: 'col_1', type: 'column', kind: 'rectangular',
    params: { kind: 'rectangular', position: { x: cx, y: cy, z: 0 }, width: 2 * h, depth: 2 * h, sceneUnits: 'mm' },
    geometry: {
      footprint: {
        vertices: [
          { x: cx - h, y: cy - h, z: 0 }, { x: cx + h, y: cy - h, z: 0 },
          { x: cx + h, y: cy + h, z: 0 }, { x: cx - h, y: cy + h, z: 0 },
        ],
      },
    },
  } as unknown as ColumnEntity;
}

function beam(start: Point2D, end: Point2D, width = 250): BeamEntity {
  return {
    id: 'beam_1', type: 'beam', kind: 'straight',
    params: {
      kind: 'straight', startPoint: { x: start.x, y: start.y, z: 0 }, endPoint: { x: end.x, y: end.y, z: 0 },
      width, depth: 700, topElevation: 3000, zOffset: 0, sceneUnits: 'mm',
    },
  } as unknown as BeamEntity;
}

/** L-shape catalog nextParams (placeholder armWidth — το smart-fit το υπερισχύει). */
function lshapeNext(width = 400, depth = 400): ColumnParams {
  return {
    kind: 'L-shape', position: { x: 0, y: 0, z: 0 }, anchor: 'center',
    width, depth, height: 3000, rotation: 0, sceneUnits: 'mm',
    baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
    lshape: { armWidth: width / 3, armLength: depth / 3 },
  } as unknown as ColumnParams;
}

/** Reconstruct world θέσης ενός LOCAL mm σημείου (anchor='center' → centredPolyToWorld). */
function worldOfLocal(params: ColumnParams, localMm: Point2D): Point2D {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const r = rotateVector({ x: localMm.x * s, y: localMm.y * s }, params.rotation);
  return { x: params.position.x + r.x, y: params.position.y + r.y };
}

/** Near-end centerline του bearing arm σε LOCAL mm (flipY=false). */
function bearingNearEndLocal(p: ColumnParams): Point2D {
  const armWidth = p.lshape?.armWidth ?? 0;
  return { x: -p.width / 2 + armWidth / 2, y: p.depth / 2 };
}

describe('alignColumnToFramingBeam (ADR-496)', () => {
  it('horizontal beam — flush + axis-coincidence + width-match', () => {
    // Δοκάρι από την παρειά της κολώνας (0,0) προς +X. near-end = (0,0), u_span = (1,0).
    const col = rectColumn(0, 0);
    const fit = alignColumnToFramingBeam(col, lshapeNext(), [beam({ x: 0, y: 0 }, { x: 3000, y: 0 })]);
    expect(fit).not.toBeNull();
    if (!fit) return;

    // (3) armWidth == beam.width· (4) anchor/flip deterministic.
    expect(fit.lshape?.armWidth).toBe(250);
    expect(fit.anchor).toBe('center');
    expect(fit.lshape?.flipY).toBe(false);

    // (2) τοπικό +Y → u_span (1,0).
    const dir = rotateVector({ x: 0, y: 1 }, fit.rotation);
    expect(dir.x).toBeCloseTo(1, 6);
    expect(dir.y).toBeCloseTo(0, 6);

    // (1) near-end centerline flush στο near-end του δοκαριού (0,0).
    const w = worldOfLocal(fit, bearingNearEndLocal(fit));
    expect(w.x).toBeCloseTo(0, 6);
    expect(w.y).toBeCloseTo(0, 6);
  });

  it('vertical beam — bearing arm follows the +Y axis', () => {
    // Κολώνα στο (0,0)· δοκάρι προς +Y. near-end = (0,0), u_span = (0,1).
    const col = rectColumn(0, 0);
    const fit = alignColumnToFramingBeam(col, lshapeNext(), [beam({ x: 0, y: 0 }, { x: 0, y: 3000 })]);
    expect(fit).not.toBeNull();
    if (!fit) return;

    const dir = rotateVector({ x: 0, y: 1 }, fit.rotation);
    expect(dir.x).toBeCloseTo(0, 6);
    expect(dir.y).toBeCloseTo(1, 6);

    const w = worldOfLocal(fit, bearingNearEndLocal(fit));
    expect(w.x).toBeCloseTo(0, 6);
    expect(w.y).toBeCloseTo(0, 6);
  });

  it('diagonal beam — generic axis alignment (no hard-coded X/Y)', () => {
    const col = rectColumn(0, 0);
    const end = { x: 3000, y: 3000 };
    const fit = alignColumnToFramingBeam(col, lshapeNext(), [beam({ x: 0, y: 0 }, end)]);
    expect(fit).not.toBeNull();
    if (!fit) return;

    const len = Math.hypot(end.x, end.y);
    const dir = rotateVector({ x: 0, y: 1 }, fit.rotation);
    expect(dir.x).toBeCloseTo(end.x / len, 6);
    expect(dir.y).toBeCloseTo(end.y / len, 6);

    const w = worldOfLocal(fit, bearingNearEndLocal(fit));
    expect(w.x).toBeCloseTo(0, 6);
    expect(w.y).toBeCloseTo(0, 6);
  });

  it('picks the near-end (closest beam endpoint to the column)', () => {
    // Δοκάρι (3000,0)→(0,0): το κοντινό άκρο στην κολώνα-(0,0) είναι το end (0,0)·
    // u_span δείχνει προς το ΜΑΚΡΙΝΟ άκρο (3000,0) = +X — ανεξάρτητα της σειράς start/end.
    const col = rectColumn(0, 0);
    const fit = alignColumnToFramingBeam(col, lshapeNext(), [beam({ x: 3000, y: 0 }, { x: 0, y: 0 })]);
    expect(fit).not.toBeNull();
    if (!fit) return;
    const dir = rotateVector({ x: 0, y: 1 }, fit.rotation);
    expect(dir.x).toBeCloseTo(1, 6);
    expect(dir.y).toBeCloseTo(0, 6);
    const w = worldOfLocal(fit, bearingNearEndLocal(fit));
    expect(w.x).toBeCloseTo(0, 6);
    expect(w.y).toBeCloseTo(0, 6);
  });

  it('width clamp — beam wider than catalog bbox grows the bbox', () => {
    const col = rectColumn(0, 0);
    const fit = alignColumnToFramingBeam(col, lshapeNext(400, 400), [beam({ x: 0, y: 0 }, { x: 3000, y: 0 }, 600)]);
    expect(fit).not.toBeNull();
    if (!fit) return;
    expect(fit.lshape?.armWidth).toBe(600);
    expect(fit.width).toBe(600); // max(400, 600)
    expect(fit.depth).toBe(600);
  });

  it('no framing beam → null (catalog fallback, μηδέν regression)', () => {
    const col = rectColumn(0, 0);
    // Δοκάρι μακριά (perp >> halfWidth) → δεν πλαισιώνει.
    expect(alignColumnToFramingBeam(col, lshapeNext(), [])).toBeNull();
  });

  it('non-L kind → null (v1 scope)', () => {
    const col = rectColumn(0, 0);
    const tShape = { ...lshapeNext(), kind: 'T-shape' } as unknown as ColumnParams;
    expect(alignColumnToFramingBeam(col, tShape, [beam({ x: 0, y: 0 }, { x: 3000, y: 0 })])).toBeNull();
  });
});

// ─── ADR-496 Phase 2 — T-shape dual-beam (T-junction) ─────────────────────────

/** T-shape catalog nextParams (placeholder defaults — το smart-fit τα υπερισχύει). */
function tshapeNext(width = 400, depth = 400): ColumnParams {
  return {
    kind: 'T-shape', position: { x: 0, y: 0, z: 0 }, anchor: 'center',
    width, depth, height: 3000, rotation: 0, sceneUnits: 'mm',
    baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
    tshape: { flangeLength: width, webThickness: depth / 3 },
  } as unknown as ColumnParams;
}

/** Flange centerline σε LOCAL mm (τομή flange-centerline × web-centerline = ο κόμβος). */
function flangeWebNodeLocal(p: ColumnParams): Point2D {
  const ft = p.tshape?.flangeThickness ?? 0;
  return { x: 0, y: p.depth / 2 - ft / 2 };
}

describe('alignTShapeColumnToFramingBeams (ADR-496 Phase 2)', () => {
  it('H-flange (περνά ευθεία) + V-web (καταλήγει) — πάχη + προσανατολισμός + flush κόμβος', () => {
    // Οριζόντιο δοκάρι (w=300) περνά ευθεία από τον κόμβο (-3000..3000)· κατακόρυφο (w=250)
    // καταλήγει στον κόμβο (0,0)→(0,-3000). Κόμβος = (0,0).
    const col = rectColumn(0, 0);
    const flangeBeam = beam({ x: -3000, y: 0 }, { x: 3000, y: 0 }, 300);
    const webBeam = beam({ x: 0, y: 0 }, { x: 0, y: -3000 }, 250);
    const fit = alignTShapeColumnToFramingBeams(col, tshapeNext(), [flangeBeam, webBeam]);
    expect(fit).not.toBeNull();
    if (!fit) return;

    // πάχη = πλάτη δοκαριών· flange = συνεχόμενο (300), web = καταλήγον (250).
    expect(fit.tshape?.flangeThickness).toBe(300);
    expect(fit.tshape?.webThickness).toBe(250);
    expect(fit.anchor).toBe('center');
    expect(fit.tshape?.flipY).toBe(false);

    // τοπικό +Y (κορμός→πέλμα) → (0,1) (ο κορμός εκτείνεται προς -Y = κάτω).
    const dir = rotateVector({ x: 0, y: 1 }, fit.rotation);
    expect(dir.x).toBeCloseTo(0, 6);
    expect(dir.y).toBeCloseTo(1, 6);

    // ο κόμβος (flange-centerline × web-centerline) πέφτει flush στην τομή των αξόνων (0,0).
    const w = worldOfLocal(fit, flangeWebNodeLocal(fit));
    expect(w.x).toBeCloseTo(0, 6);
    expect(w.y).toBeCloseTo(0, 6);
  });

  it('διαγώνιο κάθετο ζεύγος (45°) — generic axis alignment, μηδέν hard-coded X/Y', () => {
    const col = rectColumn(0, 0);
    // flange ∥ (1,1) περνά ευθεία· web ∥ (1,-1) καταλήγει στον κόμβο (0,0).
    const flangeBeam = beam({ x: -2121, y: -2121 }, { x: 2121, y: 2121 }, 300);
    const webBeam = beam({ x: 0, y: 0 }, { x: 2121, y: -2121 }, 250);
    const fit = alignTShapeColumnToFramingBeams(col, tshapeNext(), [flangeBeam, webBeam]);
    expect(fit).not.toBeNull();
    if (!fit) return;

    expect(fit.tshape?.flangeThickness).toBe(300);
    expect(fit.tshape?.webThickness).toBe(250);

    // u_webOut = (1,-1)/√2 → target = (-1,1)/√2 → τοπικό +Y ευθυγραμμίζεται σε αυτό.
    const inv = 1 / Math.SQRT2;
    const dir = rotateVector({ x: 0, y: 1 }, fit.rotation);
    expect(dir.x).toBeCloseTo(-inv, 6);
    expect(dir.y).toBeCloseTo(inv, 6);

    const w = worldOfLocal(fit, flangeWebNodeLocal(fit));
    expect(w.x).toBeCloseTo(0, 6);
    expect(w.y).toBeCloseTo(0, 6);
  });

  it('bbox μεγαλώνει ώστε να χωρά πέλμα+κορμό (D ≥ flangeThickness + webThickness)', () => {
    const col = rectColumn(0, 0);
    // Φαρδιά δοκάρια: 500 (flange) + 400 (web) = 900 > catalog depth 400.
    const flangeBeam = beam({ x: -3000, y: 0 }, { x: 3000, y: 0 }, 500);
    const webBeam = beam({ x: 0, y: 0 }, { x: 0, y: -3000 }, 400);
    const fit = alignTShapeColumnToFramingBeams(col, tshapeNext(400, 400), [flangeBeam, webBeam]);
    expect(fit).not.toBeNull();
    if (!fit) return;
    expect(fit.depth).toBe(900); // max(400, 500 + 400)
    expect(fit.width).toBe(400); // max(400, 400)
    expect(fit.tshape?.flangeLength).toBe(400); // = W (πλήρες bbox-πλάτος)
  });

  it('< 2 framing beams → null (μηδέν regression)', () => {
    const col = rectColumn(0, 0);
    expect(alignTShapeColumnToFramingBeams(col, tshapeNext(), [beam({ x: 0, y: 0 }, { x: 3000, y: 0 })])).toBeNull();
    expect(alignTShapeColumnToFramingBeams(col, tshapeNext(), [])).toBeNull();
  });

  it('μη-κάθετο ζεύγος → null (catalog fallback)', () => {
    const col = rectColumn(0, 0);
    // Δύο ~παράλληλα δοκάρια (dot ≈ 1) → κανένα κάθετο ζεύγος.
    const b1 = beam({ x: -3000, y: 0 }, { x: 3000, y: 0 }, 300);
    const b2 = beam({ x: -3000, y: 50 }, { x: 3000, y: 50 }, 250);
    expect(alignTShapeColumnToFramingBeams(col, tshapeNext(), [b1, b2])).toBeNull();
  });

  it('non-T kind → null', () => {
    const col = rectColumn(0, 0);
    const flangeBeam = beam({ x: -3000, y: 0 }, { x: 3000, y: 0 }, 300);
    const webBeam = beam({ x: 0, y: 0 }, { x: 0, y: -3000 }, 250);
    expect(alignTShapeColumnToFramingBeams(col, lshapeNext(), [flangeBeam, webBeam])).toBeNull();
  });
});

// ─── ADR-496 Phase 3 — L-shape dual-beam corner (Γ στη ΓΩΝΙΑ) ─────────────────

/** Κόμβος-γωνία (τομή leg-centerlines) σε LOCAL mm (flipY=false). */
function lCornerNodeLocal(p: ColumnParams): Point2D {
  const aw = p.lshape?.armWidth ?? 0;
  const al = p.lshape?.armLength ?? 0;
  return { x: -p.width / 2 + aw / 2, y: -p.depth / 2 + al / 2 };
}

const dirsEqual = (a: Point2D, b: Point2D): boolean =>
  Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;

describe('alignLShapeColumnToFramingBeams (ADR-496 Phase 3 — corner)', () => {
  // Ορθογωνικό πλαίσιο 6000×6000· Γ-κολώνα σε κάθε γωνία· σε κάθε γωνία ΔΥΟ κάθετα δοκάρια
  // ΚΑΤΑΛΗΓΟΥΝ (corner junction), με φορά προς το εσωτερικό του πλαισίου. Το δοκάρι κατά μήκος
  // του X έχει width=300, το κατά μήκος Y width=250 — ώστε να επαληθεύεται η αντιστοίχιση
  // armWidth/armLength ↔ σωστό σκέλος (handedness), ΟΧΙ απλώς ότι «κάτι» ταίριαξε.
  const CORNERS = [
    { name: 'κάτω-αριστερά (+X,+Y)',  c: { x: 0, y: 0 },       dX: { x: 1, y: 0 },  dY: { x: 0, y: 1 } },
    { name: 'κάτω-δεξιά (−X,+Y)',     c: { x: 6000, y: 0 },    dX: { x: -1, y: 0 }, dY: { x: 0, y: 1 } },
    { name: 'πάνω-δεξιά (−X,−Y)',     c: { x: 6000, y: 6000 }, dX: { x: -1, y: 0 }, dY: { x: 0, y: -1 } },
    { name: 'πάνω-αριστερά (+X,−Y)',  c: { x: 0, y: 6000 },    dX: { x: 1, y: 0 },  dY: { x: 0, y: -1 } },
  ];

  it.each(CORNERS)('γωνία $name — κάθε σκέλος συνέχεια του δοκαριού του + κόμβος flush', ({ c, dX, dY }) => {
    const col = rectColumn(c.x, c.y);
    const beamX = beam(c, { x: c.x + dX.x * 3000, y: c.y + dX.y * 3000 }, 300); // ∥ X-άξονα, w=300
    const beamY = beam(c, { x: c.x + dY.x * 3000, y: c.y + dY.y * 3000 }, 250); // ∥ Y-άξονα, w=250
    const fit = alignLShapeColumnToFramingBeams(col, lshapeNext(), [beamX, beamY]);
    expect(fit).not.toBeNull();
    if (!fit) return;

    expect(fit.anchor).toBe('center');
    expect(fit.lshape?.flipY).toBe(false);

    // (κόμβος) η γωνία του Γ πέφτει flush στον κόμβο = τομή των δύο αξόνων = c.
    const node = worldOfLocal(fit, lCornerNodeLocal(fit));
    expect(node.x).toBeCloseTo(c.x, 4);
    expect(node.y).toBeCloseTo(c.y, 4);

    // (άξονες + handedness) το κατακόρυφο σκέλος (τοπικό +Y) και ο foot (τοπικό +X) δείχνουν
    // καθένα στην outward φορά ΕΝΟΣ δοκαριού — και τα δύο δοκάρια καλύπτονται, ένα ανά σκέλος.
    const legVdir = rotateVector({ x: 0, y: 1 }, fit.rotation);
    const footDir = rotateVector({ x: 1, y: 0 }, fit.rotation);
    const candidates = [{ d: dX, w: 300 }, { d: dY, w: 250 }];
    const vMatch = candidates.find((bm) => dirsEqual(legVdir, bm.d));
    const hMatch = candidates.find((bm) => dirsEqual(footDir, bm.d));
    expect(vMatch).toBeDefined();
    expect(hMatch).toBeDefined();
    expect(vMatch).not.toBe(hMatch);

    // (πάχη) κάθε σκέλος = πλάτος του δοκαριού με το οποίο είναι συγγραμμικό.
    expect(fit.lshape?.armWidth).toBe(vMatch?.w);
    expect(fit.lshape?.armLength).toBe(hMatch?.w);
  });

  it('bbox μεγαλώνει ώστε να χωρά τα σκέλη (W ≥ armWidth, D ≥ armLength)', () => {
    const col = rectColumn(0, 0);
    // Φαρδιά δοκάρια > catalog 400.
    const beamX = beam({ x: 0, y: 0 }, { x: 3000, y: 0 }, 600);
    const beamY = beam({ x: 0, y: 0 }, { x: 0, y: 3000 }, 500);
    const fit = alignLShapeColumnToFramingBeams(col, lshapeNext(400, 400), [beamX, beamY]);
    expect(fit).not.toBeNull();
    if (!fit) return;
    // chirality: legV ∥ Y-δοκάρι (w=500) → armWidth=500, W=max(400,500)=500· foot ∥ X (w=600) → armLength=600, D=600.
    expect(fit.lshape?.armWidth).toBe(500);
    expect(fit.lshape?.armLength).toBe(600);
    expect(fit.width).toBe(500);
    expect(fit.depth).toBe(600);
  });

  it('< 2 framing beams → null (fallback στο single-beam μέσω dispatcher)', () => {
    const col = rectColumn(0, 0);
    expect(alignLShapeColumnToFramingBeams(col, lshapeNext(), [beam({ x: 0, y: 0 }, { x: 3000, y: 0 })])).toBeNull();
    expect(alignLShapeColumnToFramingBeams(col, lshapeNext(), [])).toBeNull();
  });

  it('μη-κάθετο ζεύγος → null (catalog fallback)', () => {
    const col = rectColumn(0, 0);
    const b1 = beam({ x: 0, y: 0 }, { x: 3000, y: 0 }, 300);
    const b2 = beam({ x: 0, y: 0 }, { x: 3000, y: 50 }, 250); // ~παράλληλο → κανένα κάθετο ζεύγος
    expect(alignLShapeColumnToFramingBeams(col, lshapeNext(), [b1, b2])).toBeNull();
  });

  it('non-L kind → null', () => {
    const col = rectColumn(0, 0);
    const beamX = beam({ x: 0, y: 0 }, { x: 3000, y: 0 }, 300);
    const beamY = beam({ x: 0, y: 0 }, { x: 0, y: 3000 }, 250);
    expect(alignLShapeColumnToFramingBeams(col, tshapeNext(), [beamX, beamY])).toBeNull();
  });
});

describe('alignColumnOnTypeChange (ADR-496 dispatcher)', () => {
  const col = rectColumn(0, 0);
  const hBeam = beam({ x: -3000, y: 0 }, { x: 3000, y: 0 }, 300);
  const vBeam = beam({ x: 0, y: 0 }, { x: 0, y: -3000 }, 250);

  it('T-shape → dual-beam fit', () => {
    const fit = alignColumnOnTypeChange(col, tshapeNext(), [hBeam, vBeam]);
    expect(fit).not.toBeNull();
    expect(fit?.tshape?.webThickness).toBe(250);
    expect(fit?.tshape?.flangeThickness).toBe(300);
  });

  it('L-shape με 2 κάθετα (corner) → dual-leg fit (Phase 3)', () => {
    // Δύο δοκάρια ΚΑΤΑΛΗΓΟΥΝ στη γωνία (0,0): X-δοκάρι w=300, Y-δοκάρι w=250.
    const cornerX = beam({ x: 0, y: 0 }, { x: 3000, y: 0 }, 300);
    const cornerY = beam({ x: 0, y: 0 }, { x: 0, y: 3000 }, 250);
    const fit = alignColumnOnTypeChange(col, lshapeNext(), [cornerX, cornerY]);
    expect(fit).not.toBeNull();
    // Και τα δύο σκέλη πήραν πάχος από δοκάρι (dual-leg), όχι catalog default.
    expect([fit?.lshape?.armWidth, fit?.lshape?.armLength].sort()).toEqual([250, 300]);
  });

  it('L-shape → single-beam fit (Phase 1, fallback όταν 1 δοκάρι)', () => {
    const fit = alignColumnOnTypeChange(col, lshapeNext(), [hBeam]);
    expect(fit).not.toBeNull();
    expect(fit?.lshape?.armWidth).toBe(300);
  });

  it('rectangular (ή άλλο kind) → null', () => {
    const rectNext = { ...lshapeNext(), kind: 'rectangular' } as unknown as ColumnParams;
    expect(alignColumnOnTypeChange(col, rectNext, [hBeam, vBeam])).toBeNull();
  });
});
