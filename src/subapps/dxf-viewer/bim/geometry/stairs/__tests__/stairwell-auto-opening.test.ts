/**
 * ADR-632 — Stairwell auto-opening pure-geometry tests (Phase 1 + 2).
 *
 * Καλύπτει: nosing-line εξαγωγή, headroom evaluation + margin expansion, outline
 * (union ∩ slab) [Φ1] και ανίχνευση ζεύγους σκάλα↔πλάκα-από-πάνω [Φ2]. Καθαρές
 * συναρτήσεις — καμία scene/React εξάρτηση.
 */

import type { Polygon3D } from '../../../types/bim-base';
import { computeStairNosings } from '../stair-nosing-line';
import {
  evaluateStairHeadroom,
  expandViolatingRange,
  type TreadNosingZ,
} from '../stairwell-headroom';
import { computeStairwellOpeningOutline } from '../stairwell-opening-outline';
import { MIN_HEADROOM_MM, resolveMinHeadroomMm } from '../../../stairs/stair-headroom-constants';
import {
  footprintOverlapArea,
  isSlabAboveStairBase,
  findSlabsAboveStair,
  findStairSlabOverlaps,
  type StairFootprintInput,
  type StairwellSlabCandidate,
} from '../stair-slab-overlap';

/** Ορθογώνιο tread CCW: [x0,x0+depth] × [y0,y0+width] στο ύψος z. */
function makeTread(x0: number, y0: number, depth: number, width: number, z: number): Polygon3D {
  return {
    vertices: [
      { x: x0, y: y0, z },
      { x: x0 + depth, y: y0, z },
      { x: x0 + depth, y: y0 + width, z },
      { x: x0, y: y0 + width, z },
    ],
  };
}

describe('stair-headroom-constants (SSoT)', () => {
  it('nok = 2200mm (Κτιριοδομικός Άρθρο 13)', () => {
    expect(MIN_HEADROOM_MM.nok).toBe(2200);
    expect(resolveMinHeadroomMm('nok')).toBe(2200);
  });

  it("'none' profile → 0 (caller decides fallback)", () => {
    expect(resolveMinHeadroomMm('none')).toBe(0);
  });
});

describe('computeStairNosings', () => {
  it('leading-edge midpoint ανά σκαλοπάτι (φορά +X)', () => {
    const treads = [
      makeTread(0, 0, 300, 1000, 200),
      makeTread(300, 0, 300, 1000, 400),
    ];
    const nosings = computeStairNosings(treads, 0);
    expect(nosings).toHaveLength(2);
    expect(nosings[0]).toEqual({ treadIndex: 0, point: { x: 300, y: 500, z: 200 } });
    expect(nosings[1]).toEqual({ treadIndex: 1, point: { x: 600, y: 500, z: 400 } });
  });

  it('αγνοεί degenerate tread (<3 κορυφές)', () => {
    const degenerate: Polygon3D = { vertices: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }] };
    expect(computeStairNosings([degenerate], 0)).toHaveLength(0);
  });
});

describe('evaluateStairHeadroom', () => {
  const nosings: TreadNosingZ[] = [
    { treadIndex: 0, zMm: 300 },
    { treadIndex: 1, zMm: 600 },
    { treadIndex: 2, zMm: 900 },
    { treadIndex: 3, zMm: 1200 },
  ];

  it('μαρκάρει μόνο τα σκαλοπάτια με clearance < κατώφλι', () => {
    // slab underside 2800, threshold 2200 → clearance: 2500,2200,1900,1600.
    const ev = evaluateStairHeadroom(nosings, 2800, 2200);
    expect(ev.violatingTreadIndices).toEqual([2, 3]);
    expect(ev.minClearanceMm).toBe(1600);
    expect(ev.anyViolation).toBe(true);
  });

  it('clearance ΑΚΡΙΒΩΣ ίσο με το ελάχιστο ΔΕΝ είναι παραβατικό', () => {
    // idx1: 2800-600 = 2200 == threshold → όχι παραβατικό.
    const ev = evaluateStairHeadroom([nosings[1]], 2800, 2200);
    expect(ev.anyViolation).toBe(false);
  });

  it('ψηλή πλάκα → καμία παράβαση', () => {
    const ev = evaluateStairHeadroom(nosings, 5000, 2200);
    expect(ev.violatingTreadIndices).toEqual([]);
    expect(ev.anyViolation).toBe(false);
  });

  it('καμία μύτη → minClearance = +Infinity', () => {
    const ev = evaluateStairHeadroom([], 2800, 2200);
    expect(ev.minClearanceMm).toBe(Infinity);
    expect(ev.anyViolation).toBe(false);
  });
});

describe('expandViolatingRange', () => {
  it('προσθέτει περιθώριο 1 σκαλοπάτι προς τα κάτω', () => {
    expect(expandViolatingRange([2, 3], 1, 6)).toEqual([1, 2, 3]);
  });

  it('clamp στο 0 (δεν βγαίνει κάτω από το πρώτο σκαλοπάτι)', () => {
    expect(expandViolatingRange([0, 1], 1, 6)).toEqual([0, 1]);
  });

  it('margin 2 προσθέτει δύο σκαλοπάτια', () => {
    expect(expandViolatingRange([5], 2, 6)).toEqual([3, 4, 5]);
  });

  it('κενή είσοδος → κενό', () => {
    expect(expandViolatingRange([], 1, 6)).toEqual([]);
  });
});

describe('computeStairwellOpeningOutline', () => {
  const slab: Polygon3D = {
    vertices: [
      { x: 0, y: 0, z: 3000 },
      { x: 1000, y: 0, z: 3000 },
      { x: 1000, y: 1000, z: 3000 },
      { x: 0, y: 1000, z: 3000 },
    ],
  };

  it('union σκαλοπατιών ∩ πλάκα → σωστό εμβαδό + z του outline', () => {
    const treads = [
      makeTread(0, 0, 300, 1000, 400),
      makeTread(300, 0, 300, 1000, 600),
    ];
    const res = computeStairwellOpeningOutline(treads, slab, 3000);
    expect(res).not.toBeNull();
    // Ένωση = 600 × 1000 = 600.000, όλη μέσα στην πλάκα.
    expect(res!.area).toBeCloseTo(600_000, 0);
    expect(res!.outline.vertices.every((v) => v.z === 3000)).toBe(true);
  });

  it('προβολή εκτός πλάκας → null (κενή τομή)', () => {
    const treads = [makeTread(2000, 2000, 300, 300, 400)];
    expect(computeStairwellOpeningOutline(treads, slab, 3000)).toBeNull();
  });

  it('καθόλου έγκυρα σκαλοπάτια → null', () => {
    expect(computeStairwellOpeningOutline([], slab, 3000)).toBeNull();
  });
});

// ─── Φάση 2 — ανίχνευση ζεύγους σκάλα ↔ πλάκα-από-πάνω ──────────────────────────

/** Τετράγωνο footprint [x0,x0+size] × [y0,y0+size] (z=0, κάτοψη). */
function makeFootprint(x0: number, y0: number, size: number): Polygon3D {
  return {
    vertices: [
      { x: x0, y: y0, z: 0 },
      { x: x0 + size, y: y0, z: 0 },
      { x: x0 + size, y: y0 + size, z: 0 },
      { x: x0, y: y0 + size, z: 0 },
    ],
  };
}

function makeSlab(
  slabId: string,
  outline: Polygon3D,
  topZmm: number,
  thickness: number,
): StairwellSlabCandidate {
  return { slabId, outline, topZmm, undersideZmm: topZmm - thickness };
}

describe('footprintOverlapArea', () => {
  it('πλήρης επικάλυψη → εμβαδό footprint', () => {
    const a = makeFootprint(0, 0, 1000);
    expect(footprintOverlapArea(a, a)).toBeCloseTo(1_000_000, 0);
  });

  it('μερική επικάλυψη → εμβαδό τομής', () => {
    const a = makeFootprint(0, 0, 1000);
    const b = makeFootprint(500, 0, 1000); // τομή 500 × 1000
    expect(footprintOverlapArea(a, b)).toBeCloseTo(500_000, 0);
  });

  it('καμία επικάλυψη → 0', () => {
    const a = makeFootprint(0, 0, 1000);
    const b = makeFootprint(5000, 5000, 1000);
    expect(footprintOverlapArea(a, b)).toBe(0);
  });

  it('degenerate polygon (<3 κορυφές) → 0', () => {
    const a = makeFootprint(0, 0, 1000);
    const bad: Polygon3D = { vertices: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }] };
    expect(footprintOverlapArea(a, bad)).toBe(0);
  });
});

describe('isSlabAboveStairBase', () => {
  const stair: StairFootprintInput = {
    stairId: 's1',
    footprint: makeFootprint(0, 0, 1000),
    baseZmm: 0,
    topZmm: 3000,
  };

  it('πλάκα οροφής (underside > base) → πάνω', () => {
    const ceiling = makeSlab('slabU', makeFootprint(0, 0, 1000), 3000, 200); // underside 2800
    expect(isSlabAboveStairBase(ceiling, stair)).toBe(true);
  });

  it('πλάκα στήριξης (top-face = base → underside < base) → όχι πάνω', () => {
    const support = makeSlab('slabB', makeFootprint(0, 0, 1000), 0, 200); // underside -200
    expect(isSlabAboveStairBase(support, stair)).toBe(false);
  });

  it('κάτω παρειά ΑΚΡΙΒΩΣ στη βάση → όχι πάνω (αυστηρή ανισότητα)', () => {
    const flush = makeSlab('slabF', makeFootprint(0, 0, 1000), 200, 200); // underside 0 == base
    expect(isSlabAboveStairBase(flush, stair)).toBe(false);
  });
});

describe('findSlabsAboveStair', () => {
  const stair: StairFootprintInput = {
    stairId: 's1',
    footprint: makeFootprint(0, 0, 1000),
    baseZmm: 0,
    topZmm: 3000,
  };

  it('κρατά μόνο επικαλυπτόμενες πλάκες πάνω από τη βάση', () => {
    const ceiling = makeSlab('above', makeFootprint(0, 0, 1000), 3000, 200);
    const support = makeSlab('support', makeFootprint(0, 0, 1000), 0, 200); // κάτω από βάση
    const elsewhere = makeSlab('far', makeFootprint(9000, 9000, 1000), 3000, 200); // δεν επικαλύπτει
    const res = findSlabsAboveStair(stair, [ceiling, support, elsewhere]);
    expect(res.map((r) => r.slab.slabId)).toEqual(['above']);
    expect(res[0].stairId).toBe('s1');
    expect(res[0].overlapArea).toBeCloseTo(1_000_000, 0);
  });

  it('ταξινομεί κατά κάτω-παρειά αύξουσα (πλησιέστερη οροφή πρώτη)', () => {
    const low = makeSlab('low', makeFootprint(0, 0, 1000), 3000, 200); // underside 2800
    const high = makeSlab('high', makeFootprint(0, 0, 1000), 6000, 200); // underside 5800
    const res = findSlabsAboveStair(stair, [high, low]);
    expect(res.map((r) => r.slab.slabId)).toEqual(['low', 'high']);
  });

  it('minOverlapArea φιλτράρει οριακή επικάλυψη', () => {
    const tiny = makeSlab('tiny', makeFootprint(990, 0, 1000), 3000, 200); // τομή 10 × 1000 = 10.000
    expect(findSlabsAboveStair(stair, [tiny])).toHaveLength(1);
    expect(findSlabsAboveStair(stair, [tiny], { minOverlapArea: 50_000 })).toHaveLength(0);
  });

  it('καμία υποψήφια → κενό', () => {
    expect(findSlabsAboveStair(stair, [])).toEqual([]);
  });
});

describe('findStairSlabOverlaps', () => {
  it('cross-product πολλών σκαλών → ένα ζεύγος ανά επικάλυψη', () => {
    const stairs: StairFootprintInput[] = [
      { stairId: 'sA', footprint: makeFootprint(0, 0, 1000), baseZmm: 0, topZmm: 3000 },
      { stairId: 'sB', footprint: makeFootprint(5000, 0, 1000), baseZmm: 0, topZmm: 3000 },
    ];
    const slabs = [
      makeSlab('slabA', makeFootprint(0, 0, 1000), 3000, 200),
      makeSlab('slabB', makeFootprint(5000, 0, 1000), 3000, 200),
    ];
    const res = findStairSlabOverlaps(stairs, slabs);
    expect(res).toHaveLength(2);
    expect(res.map((r) => `${r.stairId}:${r.slab.slabId}`).sort()).toEqual([
      'sA:slabA',
      'sB:slabB',
    ]);
  });
});
