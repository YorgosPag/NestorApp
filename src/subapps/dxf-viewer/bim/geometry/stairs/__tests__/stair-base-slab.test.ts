/**
 * ADR-685 Φάση 1 — tests για την ανίχνευση πλάκας-βάσης + ταξινόμηση σχέσης +
 * BOQ embedment volume. Pure (μηδέν scene/React).
 */

import type { Polygon3D } from '../../../types/bim-base';
import type {
  StairFootprintInput,
  StairwellSlabCandidate,
} from '../stair-slab-overlap';
import {
  classifyStairBaseRelation,
  computeStairWaistSlabOverlapVolumeM3,
  findSlabToSeatStairBase,
  type StairWaistSection,
} from '../stair-base-slab';

/** Τετράγωνο footprint [0,size]² στο z=0. */
function square(size: number): Polygon3D {
  return {
    vertices: [
      { x: 0, y: 0, z: 0 },
      { x: size, y: 0, z: 0 },
      { x: size, y: size, z: 0 },
      { x: 0, y: size, z: 0 },
    ],
  };
}

function stair(baseZmm: number, footprintSize = 1000): StairFootprintInput {
  return { stairId: 'stair-1', footprint: square(footprintSize), baseZmm, topZmm: baseZmm + 3000 };
}

function slab(
  slabId: string,
  topZmm: number,
  thicknessMm: number,
  outlineSize = 2000,
): StairwellSlabCandidate {
  return { slabId, outline: square(outlineSize), topZmm, undersideZmm: topZmm - thicknessMm };
}

describe('classifyStairBaseRelation', () => {
  // Πλάκα top=0, underside=−180 (πυρήνας 180mm).
  it('βάση στην κορυφή της πλάκας → seat', () => {
    expect(classifyStairBaseRelation(0, 0, -180)).toBe('seat');
  });

  it('βάση μέσα στον πυρήνα (βυθισμένη) → seat', () => {
    expect(classifyStairBaseRelation(-100, 0, -180)).toBe('seat');
  });

  it('βάση κάτω από την κάτω παρειά → pass-through', () => {
    expect(classifyStairBaseRelation(-250, 0, -180)).toBe('pass-through');
  });

  it('βάση πάνω από την πλάκα → floating', () => {
    expect(classifyStairBaseRelation(500, 0, -180)).toBe('floating');
  });

  it('οριακό: base == underside → seat (εντός eps)', () => {
    expect(classifyStairBaseRelation(-180, 0, -180)).toBe('seat');
  });
});

describe('findSlabToSeatStairBase', () => {
  it('βρίσκει την πλάκα βάσης όταν η σκάλα εδράζεται πάνω της', () => {
    const res = findSlabToSeatStairBase(stair(0), [slab('floor', 0, 180)]);
    expect(res?.slab.slabId).toBe('floor');
    expect(res?.overlapArea).toBeGreaterThan(0);
  });

  it('επιστρέφει null όταν η σκάλα διαπερνά (pass-through) — δεν εδράζουμε', () => {
    // base=−250 < underside=−180 → pass-through.
    expect(findSlabToSeatStairBase(stair(-250), [slab('floor', 0, 180)])).toBeNull();
  });

  it('επιστρέφει null όταν η σκάλα αιωρείται πάνω από την πλάκα', () => {
    expect(findSlabToSeatStairBase(stair(500), [slab('floor', 0, 180)])).toBeNull();
  });

  it('επιστρέφει null χωρίς footprint overlap', () => {
    const far: StairwellSlabCandidate = {
      slabId: 'far',
      outline: {
        vertices: [
          { x: 5000, y: 5000, z: 0 },
          { x: 6000, y: 5000, z: 0 },
          { x: 6000, y: 6000, z: 0 },
          { x: 5000, y: 6000, z: 0 },
        ],
      },
      topZmm: 0,
      undersideZmm: -180,
    };
    expect(findSlabToSeatStairBase(stair(0), [far])).toBeNull();
  });

  it('προτιμά την πλάκα με το ψηλότερο top-face όταν πολλές εδράζουν', () => {
    const low = slab('low', -50, 180);
    const high = slab('high', 0, 180);
    const res = findSlabToSeatStairBase(stair(0), [low, high]);
    expect(res?.slab.slabId).toBe('high');
  });

  it('σέβεται το minOverlapArea', () => {
    const res = findSlabToSeatStairBase(stair(0), [slab('floor', 0, 180)], {
      minOverlapArea: Number.MAX_SAFE_INTEGER,
    });
    expect(res).toBeNull();
  });
});

describe('computeStairWaistSlabOverlapVolumeM3', () => {
  const section: StairWaistSection = {
    widthMm: 1000,
    waistThicknessMm: 180,
    riseMm: 175,
    goingMm: 280,
    stepCount: 16,
  };

  it('όγκος = διατομή μηρού × κεκλιμένο μήκος εντός ζώνης πλάκας', () => {
    // hyp=hypot(175,280)=330.03· sinθ=175/330.03=0.5303· inclinedBand=min(180/0.5303=339.4,
    // 16×330=5280)=339.4· vol=1000×180×339.4×1e-9 ≈ 0.0611 m³.
    expect(computeStairWaistSlabOverlapVolumeM3(section, 180)).toBeCloseTo(0.0611, 3);
  });

  it('πολύ μικρότερο από το naive bbox×thickness (δεν υπερ-αφαιρεί)', () => {
    // Naive 3m² bbox × 0.18m = 0.54 m³· το σωστό μοντέλο δίνει ~9× λιγότερο.
    expect(computeStairWaistSlabOverlapVolumeM3(section, 180)).toBeLessThan(0.1);
  });

  it('cap σε ρηχή σκάλα (stepCount·hyp < slabThickness/sinθ)', () => {
    // 1 βαθμίδα: steps×hyp=330 < 339 → inclinedBand=330· vol=1000×180×330×1e-9=0.0594.
    expect(computeStairWaistSlabOverlapVolumeM3({ ...section, stepCount: 1 }, 180)).toBeCloseTo(0.0594, 3);
  });

  it('μηδέν σε εκφυλισμένη σκάλα (μηδέν width/waist/rise/steps ή πάχος)', () => {
    expect(computeStairWaistSlabOverlapVolumeM3({ ...section, widthMm: 0 }, 180)).toBe(0);
    expect(computeStairWaistSlabOverlapVolumeM3({ ...section, waistThicknessMm: 0 }, 180)).toBe(0);
    expect(computeStairWaistSlabOverlapVolumeM3({ ...section, riseMm: 0 }, 180)).toBe(0);
    expect(computeStairWaistSlabOverlapVolumeM3({ ...section, stepCount: 0 }, 180)).toBe(0);
    expect(computeStairWaistSlabOverlapVolumeM3(section, 0)).toBe(0);
  });

  it('clamp ≥ 0 σε αρνητικές εισόδους', () => {
    expect(computeStairWaistSlabOverlapVolumeM3({ ...section, widthMm: -5 }, 180)).toBe(0);
    expect(computeStairWaistSlabOverlapVolumeM3(section, -180)).toBe(0);
  });
});
