/**
 * ADR-534 Φ5 — Ο σοβάς της ΠΛΑΚΑΣ: soffit (κάτω παρειά) + ενιαίο top-cap + Απόφαση Δ.
 *
 * Καλύπτει τα ΤΡΙΑ ρίσκα του σχεδίου:
 *   (1) **soffit down face** — μια finish-member πλάκα παράγει `slabFaces` (direction `down`)·
 *       non-member (`ground`) → κανένα.
 *   (2) **self-obstacle (Απόφαση Δ, bug 100928 σε slab μορφή)** — η πλάκα ΔΕΝ σβήνει τον εαυτό
 *       της (ούτε το soffit της ούτε το top-cap της)· τοίχος από κάτω ΤΗΝ αφαιρεί (associative).
 *   (3) **regression guard** — μια `ground` (non-member) πλάκα coplanar εξακολουθεί να **καλύπτει**
 *       το top-cap τοίχου (id-based exclusion αφορά ΜΟΝΟ members — όχι blanket z-filter).
 *
 * Όλα σε **mm** coords (sceneUnits default 'mm' → s=1, unitToMeters=1e-3): area_mm² × 1e-6 = m².
 */

import {
  computeStructuralHorizontalFinishFaces,
  computeMergedStructuralTopCap,
  type HorizontalSlabObstacle,
} from '../structural-finish-scene-horizontal';
import type { StructuralFinishSpec } from '../structural-finish-types';
import type { SlabKind } from '../../types/slab-types';
import type { WallFinishObstacle } from '../structural-finish-scene';
import { buildDefaultWallParams } from '../../../hooks/drawing/wall-completion';

const SPEC: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 15,
};

/** Ορθογώνια πλάκα (mm). `top` = πάνω παρειά (FFL)· κρέμεται κάτω 200mm. */
const slab = (
  id: string,
  top: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  opts: { kind?: SlabKind; finish?: StructuralFinishSpec | undefined } = {},
): HorizontalSlabObstacle => ({
  id,
  params: {
    kind: opts.kind ?? 'floor',
    ...(opts.finish !== undefined || !('finish' in opts) ? { finish: opts.finish ?? SPEC } : {}),
    levelElevation: top,
    heightOffsetFromLevel: 0,
    thickness: 200,
    outline: {
      vertices: [
        { x: x0, y: y0, z: 0 }, { x: x1, y: y0, z: 0 }, { x: x1, y: y1, z: 0 }, { x: x0, y: y1, z: 0 },
      ],
    },
  },
});

/** Τοίχος (mm) με ελεύθερη κορυφή στο `height` — obstacle κάλυψης από κάτω. */
const wall = (id: string, x0: number, y0: number, x1: number, y1: number, height: number): WallFinishObstacle => ({
  id,
  kind: 'straight',
  params: buildDefaultWallParams({ x: x0, y: y0 }, { x: x1, y: y1 }, { height }, 'mm'),
});

const faces = (over: {
  slabs?: HorizontalSlabObstacle[];
  walls?: WallFinishObstacle[];
}) =>
  computeStructuralHorizontalFinishFaces({
    columns: [], beams: [], walls: over.walls ?? [], slabs: over.slabs ?? [],
    beamObstacles: [], floorElevationMm: 0,
  });

const totalArea = (fs: readonly { areaM2: number }[]): number => fs.reduce((a, f) => a + f.areaM2, 0);

describe('slab soffit (down face) — ADR-534 Φ5', () => {
  it('finish-member floor slab → ΕΝΑ soffit face (direction down), area ≈ footprint', () => {
    const { slabFaces } = faces({ slabs: [slab('s1', 3000, 0, 0, 4000, 3000)] });
    expect(slabFaces.length).toBeGreaterThanOrEqual(1);
    expect(slabFaces.every((f) => f.direction === 'down')).toBe(true);
    // 4000×3000 mm² = 12 m² (self ΔΕΝ σβήνει — αν έσβηνε θα ήταν 0· bug 100928 σε slab μορφή).
    expect(totalArea(slabFaces)).toBeCloseTo(12, 1);
  });

  it('ground slab (non-member) → ΚΑΝΕΝΑ slab face (kind gate)', () => {
    const { slabFaces } = faces({ slabs: [slab('s1', 0, 0, 0, 4000, 3000, { kind: 'ground' })] });
    expect(slabFaces).toHaveLength(0);
  });

  it('slab ΧΩΡΙΣ finish spec → ΚΑΝΕΝΑ slab face (legacy, μηδέν migration)', () => {
    const { slabFaces } = faces({ slabs: [slab('s1', 3000, 0, 0, 4000, 3000, { finish: undefined })] });
    expect(slabFaces).toHaveLength(0);
  });

  it('τοίχος από κάτω (κορυφή στο soffit-plane) → αφαιρεί σοβά εκεί (associative)', () => {
    const s = slab('s1', 3000, 0, 0, 4000, 3000); // soffit plane = 2800
    const free = faces({ slabs: [s] });
    // Τοίχος ύψους 2800 (κορυφή = 2800 = soffit) που διασχίζει την πλάκα.
    const covered = faces({ slabs: [s], walls: [wall('w1', 0, 1500, 4000, 1500, 2800)] });
    expect(totalArea(covered.slabFaces)).toBeLessThan(totalArea(free.slabFaces));
  });
});

describe('merged top-cap με πλάκες — ADR-534 Φ5 Απόφαση Δ', () => {
  const cap = (slabs: HorizontalSlabObstacle[], walls: WallFinishObstacle[] = []) =>
    computeMergedStructuralTopCap({
      columns: [], beams: [], walls, slabs, beamObstacles: [], floorElevationMm: 0,
    });

  it('finish-member πλάκα → η ΠΑΝΩ παρειά της μπαίνει στο ενιαίο cap (ΔΕΝ σβήνει τον εαυτό της)', () => {
    const cf = cap([slab('s1', 3000, 0, 0, 4000, 3000)]);
    expect(cf.length).toBeGreaterThanOrEqual(1);
    expect(totalArea(cf)).toBeGreaterThan(10); // ~12 m², self-exclusion δουλεύει
  });

  it('ground (non-member) coplanar καλύπτει το top-cap τοίχου (id-exclusion ΜΟΝΟ σε members)', () => {
    // Τοίχος-member, κορυφή 2800. Ground πλάκα με top=2800 πάνω του → καλύπτει το cap του.
    const w = wall('w1', 0, 1500, 4000, 1500, 2800);
    const free = cap([], [w]);
    const groundCovers = cap([slab('g1', 2800, 0, 0, 4000, 3000, { kind: 'ground' })], [w]);
    expect(totalArea(free)).toBeGreaterThan(0);
    // Η ground πλάκα (non-member → όχι στα excludeIds) σκεπάζει την κορυφή του τοίχου.
    expect(totalArea(groundCovers)).toBeLessThan(totalArea(free));
  });
});
