/**
 * ADR-449 Slice 11 — structural-finish-scene-horizontal tests (scene adapter).
 *
 * Καλύπτει το adjacency-driven της σκηνής (Firestore baseline col_fb3215e9 +
 * beam_d9d8da55): κολόνα top cap εκτεθειμένο· δοκάρι top + soffit εκτεθειμένα·
 * πλάκα από πάνω → καπάκι/δοκάρι-top εξαφανίζεται· βάση κολόνας μόνο σε absolute.
 */

import {
  computeStructuralHorizontalFinishFaces,
  computeMergedStructuralTopCap,
  type HorizontalColumnSource,
  type HorizontalBeamSource,
  type HorizontalSlabObstacle,
} from '../structural-finish-scene-horizontal';
import { mergeCoresToFinishedRings } from '../structural-finish-horizontal';
import type { StructuralFinishSpec } from '../structural-finish-types';
import type { WallFinishObstacle } from '../structural-finish-scene';
import { buildDefaultWallParams } from '../../../hooks/drawing/wall-completion';

const SPEC: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 15,
};

// Κολόνα 0.5×0.5 (m-scene), βάση στη στάθμη, ύψος 3000, καπάκι εκτεθειμένο.
const column = (over: Partial<HorizontalColumnSource['params']> = {}): HorizontalColumnSource => ({
  params: {
    finish: SPEC, sceneUnits: 'm', baseOffset: 0, height: 3000, baseBinding: 'storey-floor',
    envelopeFunction: undefined, ...over,
  },
  geometry: { footprint: { vertices: [
    { x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 0.5 }, { x: 0, y: 0.5 },
  ] } },
});

// Δοκάρι: top 3000, depth 500 → soffit 2500· outline 1×0.25 μακριά από την κολόνα.
const beam = (): HorizontalBeamSource => ({
  params: {
    finish: SPEC, sceneUnits: 'm', topElevation: 3000, zOffset: 0, depth: 500, envelopeFunction: undefined,
    startPoint: { x: 2, y: 0.125, z: 0 }, endPoint: { x: 3, y: 0.125, z: 0 },
  },
  geometry: { outline: { vertices: [
    { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 0.25 }, { x: 2, y: 0.25 },
  ] } },
});

// Πλάκα που καλύπτει περιοχή [x0..x1]×[y0..y1] σε στάθμη top (πάχος 200).
const slabAt = (topMm: number, x0: number, y0: number, x1: number, y1: number): HorizontalSlabObstacle => ({
  params: {
    levelElevation: topMm, heightOffsetFromLevel: 0, thickness: 200,
    outline: { vertices: [
      { x: x0, y: y0, z: 0 }, { x: x1, y: y0, z: 0 }, { x: x1, y: y1, z: 0 }, { x: x0, y: y1, z: 0 },
    ] },
  },
});

// ADR-449 X4/E — νέος τοίχος (finish skin + brick-only DNA), 3m μήκος· ελεύθερη κορυφή στο 3000.
const wall = (over: { stripFinish?: boolean } = {}): WallFinishObstacle => {
  let params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 3, y: 0 }, { height: 3000 }, 'm');
  if (over.stripFinish) {
    const { finish: _f, ...rest } = params;
    params = rest;
  }
  return { id: 'w1', kind: 'straight', params };
};

const run = (over: {
  columns?: HorizontalColumnSource[]; beams?: HorizontalBeamSource[]; slabs?: HorizontalSlabObstacle[];
  walls?: WallFinishObstacle[];
} = {}) => computeStructuralHorizontalFinishFaces({
  columns: over.columns ?? [], beams: over.beams ?? [], walls: over.walls ?? [], slabs: over.slabs ?? [],
  beamObstacles: [], floorElevationMm: 0,
});

describe('computeStructuralHorizontalFinishFaces', () => {
  it('μεμονωμένη κολόνα (storey-ceiling, καμία πλάκα) → top cap εκτεθειμένο, καμία βάση', () => {
    const { columnFaces } = run({ columns: [column()] });
    expect(columnFaces).toHaveLength(1);
    expect(columnFaces[0].direction).toBe('up');
    expect(columnFaces[0].zMm).toBe(3000);
    // ADR-449 Slice 11 — finished outline: core 0.5 + 2×0.015 σοβάς = 0.53 → 0.2809 m².
    expect(columnFaces[0].areaM2).toBeCloseTo(0.53 * 0.53, 4);
  });

  it('δοκάρι (καμία πλάκα/τοίχος) → top + soffit εκτεθειμένα', () => {
    const { beamFaces } = run({ beams: [beam()] });
    expect(beamFaces).toHaveLength(2);
    const dirs = beamFaces.map((f) => f.direction).sort();
    expect(dirs).toEqual(['down', 'up']);
    const top = beamFaces.find((f) => f.direction === 'up')!;
    const soffit = beamFaces.find((f) => f.direction === 'down')!;
    expect(top.zMm).toBe(3000);
    expect(soffit.zMm).toBe(2500);
  });

  it('finished outline: ελεύθερο δοκάρι (χωρίς γείτονες) → offset ΣΕ ΟΛΕΣ τις εκτεθειμένες όψεις', () => {
    // outline 1.0×0.25· καμία γειτονιά → 4 εκτεθειμένες όψεις → +0.015 παντού = 1.03×0.28.
    const { beamFaces } = run({ beams: [beam()] });
    for (const f of beamFaces) expect(f.areaM2).toBeCloseTo(1.03 * 0.28, 3);
  });

  it('finished outline στη ΣΥΜΒΟΛΗ: κολόνα στο δυτικό άκρο → soffit ΔΕΝ προεξέχει μέσα στην κολόνα', () => {
    // Κολόνα 0.5×0.5 με ανατολική παρειά x=2 (= δυτικό άκρο δοκαριού) → το δυτικό άκρο
    // καλύπτεται/αφαιρείται → soffit ΜΙΚΡΟΤΕΡΟ από το ελεύθερο (δεν επεκτείνεται δυτικά).
    const col: HorizontalColumnSource = {
      params: { finish: SPEC, sceneUnits: 'm', baseOffset: 0, height: 3000, baseBinding: 'storey-floor', envelopeFunction: undefined },
      geometry: { footprint: { vertices: [
        { x: 1.5, y: -0.125 }, { x: 2, y: -0.125 }, { x: 2, y: 0.375 }, { x: 1.5, y: 0.375 },
      ] } },
    };
    const free = run({ beams: [beam()] }).beamFaces;
    const joined = run({ beams: [beam()], columns: [col] }).beamFaces;
    const freeSoffit = free.find((f) => f.direction === 'down')!.areaM2;
    const joinedSoffit = joined.find((f) => f.direction === 'down')!.areaM2;
    expect(joinedSoffit).toBeLessThan(freeSoffit); // κόπηκε στο δυτικό άκρο (μηδέν διείσδυση)
  });

  it('πλάκα πάνω από την κολόνα → top cap εξαφανίζεται (associative)', () => {
    const { columnFaces } = run({ columns: [column()], slabs: [slabAt(3000, -1, -1, 1.5, 1.5)] });
    expect(columnFaces).toHaveLength(0);
  });

  it('πλάκα πάνω από το δοκάρι → top εξαφανίζεται, soffit παραμένει', () => {
    const { beamFaces } = run({ beams: [beam()], slabs: [slabAt(3000, 1.5, -1, 3.5, 1)] });
    expect(beamFaces).toHaveLength(1);
    expect(beamFaces[0].direction).toBe('down'); // μόνο soffit
  });

  it('βάση κολόνας: storey-floor → καμία· absolute (pilotis) χωρίς πλάκα κάτω → base cap', () => {
    expect(run({ columns: [column({ baseBinding: 'storey-floor' })] }).columnFaces).toHaveLength(1); // top only
    const abs = run({ columns: [column({ baseBinding: 'absolute' })] }).columnFaces;
    expect(abs).toHaveLength(2); // top + base
    expect(abs.some((f) => f.direction === 'down' && f.zMm === 0)).toBe(true);
  });

  it('πλάκα-πέδιλο κάτω από absolute κολόνα → base cap εξαφανίζεται', () => {
    const { columnFaces } = run({
      columns: [column({ baseBinding: 'absolute' })],
      slabs: [slabAt(0, -1, -1, 1.5, 1.5)], // top=0 → καλύπτει τη βάση z=0
    });
    expect(columnFaces.some((f) => f.direction === 'down')).toBe(false);
    expect(columnFaces.some((f) => f.direction === 'up')).toBe(true); // top παραμένει (πλάκα κάτω, όχι πάνω)
  });

  it('REAL Firestore geometry (flush col↔beam): soffit ΔΕΝ διεισχωρεί δυτικά του προσώπου σοβά κολόνας', () => {
    const realCol: HorizontalColumnSource = {
      params: { finish: SPEC, sceneUnits: 'm', baseOffset: 0, height: 3000, baseBinding: 'storey-floor', envelopeFunction: undefined },
      geometry: { footprint: { vertices: [
        { x: 21.38551615846648, y: 3.637711913020941 },
        { x: 21.88508095646823, y: 3.637711913020941 },
        { x: 21.88508095646823, y: 4.636841509024424 },
        { x: 21.38551615846648, y: 4.636841509024424 },
      ] } },
    };
    const realBeam: HorizontalBeamSource = {
      params: {
        finish: SPEC, sceneUnits: 'm', topElevation: 3000, zOffset: 0, depth: 500, envelopeFunction: undefined,
        startPoint: { x: 21.88508095646823, y: 3.762711913020941, z: 0 },
        endPoint: { x: 23.587993621959576, y: 3.762711913020941, z: 0 },
      },
      geometry: { outline: { vertices: [
        { x: 21.88508095646823, y: 3.887711913020941 },
        { x: 23.587993621959576, y: 3.887711913020941 },
        { x: 23.587993621959576, y: 3.637711913020941 },
        { x: 21.88508095646823, y: 3.637711913020941 },
      ] } },
    };
    const { beamFaces } = run({ beams: [realBeam], columns: [realCol] });
    const soffit = beamFaces.find((f) => f.direction === 'down')!;
    const verts = soffit.polygons.flatMap((p) => p.outer);
    // ΜΗΔΕΝ διείσδυση: στη ζώνη ΠΑΝΩ από την παρειά του δοκαριού (y > 3.8877, όπου η κολόνα
    // ΕΧΕΙ κάθετο σοβά) ο soffit δεν πάει δυτικά του προσώπου σοβά κολόνας (x ≥ 21.90008).
    const northMinX = Math.min(...verts.filter((pt) => pt.y > 3.887711913020941 + 1e-4).map((pt) => pt.x));
    expect(northMinX).toBeGreaterThanOrEqual(21.88508095646823 + 0.015 - 1e-4);
    // Under-beam: φτάνει το ΠΡΟΣΩΠΟ ΚΟΡΜΟΥ κολόνας (21.88508· εκεί δεν υπάρχει σοβάς, καλυμμένο) — μηδέν κενό.
    expect(Math.min(...verts.map((pt) => pt.x))).toBeCloseTo(21.88508095646823, 3);
    // Ελεύθερο ανατολικό άκρο: φτάνει 15mm πέρα από το core (free end → +thickness).
    expect(Math.max(...verts.map((pt) => pt.x))).toBeGreaterThan(23.587993621959576 + 0.01);
  });

  it('inactive finish → κανένα face', () => {
    const c = column({ finish: { ...SPEC, enabled: false } });
    expect(run({ columns: [c] }).columnFaces).toHaveLength(0);
  });

  // ─── ADR-449 Slice X4/E — top-cap ελεύθερης κορυφής τοίχου ──────────────────────
  it('ελεύθερος τοίχος (καμία πλάκα/δοκάρι από πάνω) → top-cap στην κορυφή (zMm=3000, up)', () => {
    const { wallFaces } = run({ walls: [wall()] });
    expect(wallFaces).toHaveLength(1);
    expect(wallFaces[0].direction).toBe('up');
    expect(wallFaces[0].zMm).toBe(3000);
    expect(wallFaces[0].areaM2).toBeGreaterThan(0);
  });

  it('πλάκα πάνω από τον τοίχο → top-cap εξαφανίζεται (associative, ίδιο με κολόνα)', () => {
    const { wallFaces } = run({ walls: [wall()], slabs: [slabAt(3000, -1, -1, 4, 1)] });
    expect(wallFaces).toHaveLength(0);
  });

  it('τοίχος ΧΩΡΙΣ finish spec (legacy/bare) → κανένα top-cap', () => {
    const { wallFaces } = run({ walls: [wall({ stripFinish: true })] });
    expect(wallFaces).toHaveLength(0);
  });

  it('ADR-449 height-SSoT: columnExtents override → cap στο resolved zTop (3000), ΟΧΙ raw params.height (2700)', () => {
    // Firestore repro: storey-ceiling κολόνα με raw height=2700 ενώ storey ceiling=3000.
    // Χωρίς extents → legacy cap στο 2700· με extents (= πυρήνας) → cap στο 3000.
    const c: HorizontalColumnSource = {
      id: 'col_fb3215e9',
      params: { finish: SPEC, sceneUnits: 'm', baseOffset: 0, height: 2700, baseBinding: 'storey-floor', envelopeFunction: undefined },
      geometry: { footprint: { vertices: [
        { x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 0.5 }, { x: 0, y: 0.5 },
      ] } },
    };
    const legacy = computeStructuralHorizontalFinishFaces({
      columns: [c], beams: [], walls: [], slabs: [], beamObstacles: [], floorElevationMm: 0,
    }).columnFaces;
    expect(legacy[0].zMm).toBe(2700); // legacy fallback (raw height) — η συμπεριφορά του bug

    const resolved = computeStructuralHorizontalFinishFaces({
      columns: [c], beams: [], walls: [], slabs: [], beamObstacles: [], floorElevationMm: 0,
      columnExtents: new Map([['col_fb3215e9', { zBotMm: 0, zTopMm: 3000 }]]),
    }).columnFaces;
    expect(resolved[0].zMm).toBe(3000); // σοβάς = πυρήνας (storey ceiling)
  });
});

// ─── ADR-449 §top-cap-coincidence — ΕΝΙΑΙΟ πάνω-καπάκι (union πυρήνων + μία διαστολή) ──────
describe('computeMergedStructuralTopCap', () => {
  const mrun = (over: {
    columns?: HorizontalColumnSource[]; beams?: HorizontalBeamSource[]; slabs?: HorizontalSlabObstacle[]; walls?: WallFinishObstacle[];
  } = {}) => computeMergedStructuralTopCap({
    columns: over.columns ?? [], beams: over.beams ?? [], walls: over.walls ?? [], slabs: over.slabs ?? [],
    beamObstacles: [], floorElevationMm: 0,
  });
  const polyCount = (fs: ReturnType<typeof mrun>) => fs.reduce((n, f) => n + f.polygons.length, 0);
  const totalArea = (fs: ReturnType<typeof mrun>) => fs.reduce((a, f) => a + f.areaM2, 0);

  it('μεμονωμένη κολόνα → ίδιο cap με per-member (union ενός = ο πυρήνας, offset ίδιο)', () => {
    const faces = mrun({ columns: [column()] });
    expect(faces).toHaveLength(1);
    expect(faces[0].direction).toBe('up');
    expect(faces[0].zMm).toBe(3000);
    expect(faces[0].areaM2).toBeCloseTo(0.53 * 0.53, 3); // core 0.5 + 2×0.015
  });

  it('τοίχος + επικαλυπτόμενη κολόνα → ΕΝΑ ενιαίο συνδεδεμένο cap (μηδέν εσωτερική ραφή/εισχώρηση)', () => {
    const col: HorizontalColumnSource = {
      params: { finish: SPEC, sceneUnits: 'm', baseOffset: 0, height: 3000, baseBinding: 'storey-floor', envelopeFunction: undefined },
      geometry: { footprint: { vertices: [
        { x: -0.3, y: -0.3 }, { x: 0.2, y: -0.3 }, { x: 0.2, y: 0.3 }, { x: -0.3, y: 0.3 },
      ] } },
    };
    const merged = mrun({ walls: [wall()], columns: [col] });
    expect(merged.length).toBeGreaterThan(0);
    expect(polyCount(merged)).toBe(1); // ΕΝΑ συνδεδεμένο πολύγωνο → καμία ξεχωριστή ραφή
    // Το ενιαίο εμβαδό < άθροισμα ξεχωριστών (η επικάλυψη τοίχου/κολόνας μετριέται ΜΙΑ φορά).
    const wallOnly = totalArea(mrun({ walls: [wall()] }));
    const colOnly = totalArea(mrun({ columns: [col] }));
    expect(totalArea(merged)).toBeLessThan(wallOnly + colOnly);
    expect(totalArea(merged)).toBeGreaterThan(Math.max(wallOnly, colOnly)); // ...αλλά καλύπτει και τα δύο
  });

  it('πλάκα πάνω από όλα → ενιαίο cap εξαφανίζεται (associative)', () => {
    const merged = mrun({ walls: [wall()], columns: [column()], slabs: [slabAt(3000, -5, -5, 5, 5)] });
    expect(merged).toHaveLength(0);
  });

  it('κανένα δομικό μέλος με σοβά → κενό', () => {
    expect(mrun({ walls: [wall({ stripFinish: true })] })).toHaveLength(0);
    expect(mrun({})).toHaveLength(0);
  });

  it('flush πυρήνες (float drift) → grid-weld ενώνει σε ΕΝΑ ring, ΟΧΙ δύο καπάκια', () => {
    // Giorgio 2026-07-01: κάθετος τοίχος flush στην κολόνα (float drift ~1e-9) έμενε ξεχωριστό
    // καπάκι. Το grid-weld (ADR-049) πριν το union κλείνει τη sub-ULP ραφή → ΕΝΑ ring.
    const a = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    const b = [{ x: 1 + 1e-9, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 1 + 1e-9, y: 1 }];
    expect(mergeCoresToFinishedRings([a, b], 15, 1)).toHaveLength(1);
  });
});
