/**
 * ADR-449 Slice 11 — structural-finish-scene-horizontal tests (scene adapter).
 *
 * Καλύπτει το adjacency-driven της σκηνής (Firestore baseline col_fb3215e9 +
 * beam_d9d8da55): κολόνα top cap εκτεθειμένο· δοκάρι top + soffit εκτεθειμένα·
 * πλάκα από πάνω → καπάκι/δοκάρι-top εξαφανίζεται· βάση κολόνας μόνο σε absolute.
 */

import {
  computeStructuralHorizontalFinishFaces,
  type HorizontalColumnSource,
  type HorizontalBeamSource,
  type HorizontalSlabObstacle,
} from '../structural-finish-scene-horizontal';
import type { StructuralFinishSpec } from '../structural-finish-types';

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
  params: { finish: SPEC, sceneUnits: 'm', topElevation: 3000, zOffset: 0, depth: 500, envelopeFunction: undefined },
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

const run = (over: {
  columns?: HorizontalColumnSource[]; beams?: HorizontalBeamSource[]; slabs?: HorizontalSlabObstacle[];
} = {}) => computeStructuralHorizontalFinishFaces({
  columns: over.columns ?? [], beams: over.beams ?? [], walls: [], slabs: over.slabs ?? [],
  beamObstacles: [], floorElevationMm: 0,
});

describe('computeStructuralHorizontalFinishFaces', () => {
  it('μεμονωμένη κολόνα (storey-ceiling, καμία πλάκα) → top cap εκτεθειμένο, καμία βάση', () => {
    const { columnFaces } = run({ columns: [column()] });
    expect(columnFaces).toHaveLength(1);
    expect(columnFaces[0].direction).toBe('up');
    expect(columnFaces[0].zMm).toBe(3000);
    expect(columnFaces[0].areaM2).toBeCloseTo(0.25, 5);
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

  it('inactive finish → κανένα face', () => {
    const c = column({ finish: { ...SPEC, enabled: false } });
    expect(run({ columns: [c] }).columnFaces).toHaveLength(0);
  });
});
