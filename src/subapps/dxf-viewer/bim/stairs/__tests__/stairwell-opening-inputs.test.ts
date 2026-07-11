/**
 * ADR-632 — `buildStairwellPlanStairs` FULL tread-set regression.
 *
 * Bug (pre-existing Φ1/Φ3): ο builder διάβαζε `stair.geometry.treads`, που είναι
 * **legacy alias = `treadsBelowCut`** (μόνο τα σκαλοπάτια ΚΑΤΩ από το cut plane).
 * Τα headroom-παραβατικά σκαλοπάτια είναι τα ΨΗΛΑ (κοντά στην πλάκα, ΠΑΝΩ από το
 * cut) → έλειπαν → η auto «well» τρύπα έβγαινε σε λάθος (κάτω) φέτα της σκάλας.
 * Fix: FULL set `treadsBelowCut ∪ treadsAboveCut` (mirror `StairToThreeConverter`).
 *
 * @see bim/stairs/stairwell-opening-inputs.ts — buildStairInput (fix site)
 * @see bim-3d/converters/StairToThreeConverter.ts — 3D SSoT precedent (spread below+above)
 */

import type { Point3D } from '../../types/bim-base';
import type { StairEntity } from '../../types/stair-types';
import type { SlabEntity } from '../../types/slab-types';
import {
  buildStairwellPlanStairs,
  buildStairwellSlabCandidates,
} from '../stairwell-opening-inputs';
import { planStairwellOpenings } from '../../geometry/stairs/stairwell-opening-plan';

/** Ένα τετράγωνο tread (bare `Point3D[]`, όπως το `StairGeometry.treads`) στο ύψος z. */
function tread(z: number): Point3D[] {
  return [
    { x: 0, y: 0, z },
    { x: 300, y: 0, z },
    { x: 300, y: 1000, z },
    { x: 0, y: 1000, z },
  ];
}

const BELOW_CUT = [tread(300), tread(600)];   // z ≤ 1200 (κάτω από cut)
const ABOVE_CUT = [tread(1500), tread(1800)]; // z > 1200 (ΠΑΝΩ από cut — τα παραβατικά)

function stairParams() {
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: 0,
    rise: 300,
    stepCount: 4,
    totalRise: 1800,
    totalRun: 1200,
    width: 1000,
    codeProfile: 'nok',
  };
}

/** Σκάλα με ΞΕΧΩΡΙΣΤΑ below/above cut treads (πραγματική γεωμετρία). */
function fullStair(): StairEntity {
  return {
    id: 'stair-1',
    type: 'stair',
    geometry: {
      treads: BELOW_CUT, // alias = below-cut
      treadsBelowCut: BELOW_CUT,
      treadsAboveCut: ABOVE_CUT,
      bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 300, y: 1000, z: 1800 } },
    },
    params: stairParams(),
  } as unknown as StairEntity;
}

/** Legacy fixture: ΜΟΝΟ το `treads` alias (χωρίς below/above split). */
function legacyStair(): StairEntity {
  return {
    id: 'stair-legacy',
    type: 'stair',
    geometry: {
      treads: [...BELOW_CUT, ...ABOVE_CUT],
      bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 300, y: 1000, z: 1800 } },
    },
    params: stairParams(),
  } as unknown as StairEntity;
}

describe('buildStairwellPlanStairs — FULL tread set (ADR-632 above-cut fix)', () => {
  it('συμπεριλαμβάνει τα ΠΑΝΩ-από-cut σκαλοπάτια (τα headroom-παραβατικά)', () => {
    const [plan] = buildStairwellPlanStairs([fullStair()]);

    // 2 below + 2 above = 4 (πριν το fix: μόνο 2 below-cut).
    expect(plan.treads).toHaveLength(4);

    // Τα ψηλά nosing z (1500, 1800 mm) πρέπει να υπάρχουν — αλλιώς ο planner δεν βλέπει
    // ποτέ την πραγματική παράβαση headroom κοντά στην πλάκα.
    const zs = plan.nosingsZmm.map((n) => n.zMm).sort((a, b) => a - b);
    expect(zs).toEqual([300, 600, 1500, 1800]);
  });

  it('backward-compat: legacy fixture με μόνο `treads` alias → χρησιμοποιεί το alias', () => {
    const [plan] = buildStairwellPlanStairs([legacyStair()]);
    expect(plan.treads).toHaveLength(4);
    const zs = plan.nosingsZmm.map((n) => n.zMm).sort((a, b) => a - b);
    expect(zs).toEqual([300, 600, 1500, 1800]);
  });

  it('χωρίς above-cut → μόνο τα below-cut (κανένα crash σε απόν πεδίο)', () => {
    const stair = {
      id: 'stair-below-only',
      type: 'stair',
      geometry: {
        treads: BELOW_CUT,
        treadsBelowCut: BELOW_CUT,
        treadsAboveCut: [],
        bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 300, y: 1000, z: 600 } },
      },
      params: stairParams(),
    } as unknown as StairEntity;

    const [plan] = buildStairwellPlanStairs([stair]);
    expect(plan.treads).toHaveLength(2);
  });
});

// ─── ADR-632 cross-level: absolute-Z offset (σκάλα ορόφου Ν, πλάκα ορόφου Ν+1) ──

/** Πολυβάθμια σκάλα με nosings 300…2900mm (level-relative, ίδιο x/y footprint). */
function crossLevelStair(): StairEntity {
  const treads = [300, 600, 900, 1200, 1500, 1800, 2100, 2400, 2700, 2900].map(tread);
  return {
    id: 'stair-ground',
    type: 'stair',
    geometry: {
      treads,
      treadsBelowCut: treads.filter((t) => t[0].z <= 1200),
      treadsAboveCut: treads.filter((t) => t[0].z > 1200),
      bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 300, y: 1000, z: 2900 } },
    },
    params: {
      basePoint: { x: 0, y: 0, z: 0 },
      direction: 0,
      rise: 290,
      stepCount: 10,
      totalRise: 2900,
      totalRun: 1200,
      width: 1000,
      codeProfile: 'nok',
    },
  } as unknown as StairEntity;
}

/** Πλάκα-οροφή που καλύπτει (x/y) το footprint της σκάλας· level-relative FFL=0. */
function ceilingSlab(): SlabEntity {
  return {
    id: 'slab-above',
    type: 'slab',
    params: {
      outline: {
        vertices: [
          { x: -500, y: -500, z: 0 },
          { x: 800, y: -500, z: 0 },
          { x: 800, y: 1500, z: 0 },
          { x: -500, y: 1500, z: 0 },
        ],
      },
      levelElevation: 0, // in-scene level-relative (0-based· το absolute έρχεται από το FFL offset)
      thickness: 200,
    },
  } as unknown as SlabEntity;
}

describe('ADR-632 cross-level — absolute-Z FFL offset', () => {
  it('buildStairwellSlabCandidates: το floorElevationMm ανεβάζει top/underside σε απόλυτο datum', () => {
    const [c0] = buildStairwellSlabCandidates([ceilingSlab()]); // default 0
    expect(c0.topZmm).toBe(0);
    expect(c0.undersideZmm).toBe(-200);

    const [c1] = buildStairwellSlabCandidates([ceilingSlab()], 3000); // FFL 1ου ορόφου
    expect(c1.topZmm).toBe(3000);
    expect(c1.undersideZmm).toBe(2800);
  });

  it('buildStairwellPlanStairs: το floorElevationMm ανεβάζει base/top/nosings ομοιόμορφα', () => {
    const [rel] = buildStairwellPlanStairs([crossLevelStair()]); // default 0
    const [lifted] = buildStairwellPlanStairs([crossLevelStair()], { floorElevationMm: 6000 });

    expect(rel.baseZmm).toBe(0);
    expect(rel.nosingsZmm.map((n) => n.zMm).sort((a, b) => a - b)[0]).toBe(300);

    // +6000 σε ΟΛΑ τα z (base, top, κάθε nosing).
    expect(lifted.baseZmm).toBe(6000);
    expect(lifted.topZmm).toBe(rel.topZmm + 6000);
    const liftedZs = lifted.nosingsZmm.map((n) => n.zMm).sort((a, b) => a - b);
    expect(liftedZs[0]).toBe(6300);
    expect(liftedZs[liftedZs.length - 1]).toBe(8900);
  });

  it('planner ζευγαρώνει σκάλα ορόφου Ν με πλάκα ορόφου Ν+1 ΜΟΝΟ σε κοινό absolute datum', () => {
    // Σκάλα ισόγειο (FFL 0), πλάκα 1ου ορόφου (FFL 3000): διαφορετικές σκηνές.
    const stairsGround = buildStairwellPlanStairs([crossLevelStair()], { floorElevationMm: 0 });

    // ΣΩΣΤΟ (absolute): η πλάκα ανεβαίνει στο +3000 → underside 2800 > stair base 0
    // → ζευγαρώνει· τα ψηλά σκαλοπάτια (2900) δίνουν clearance < 2200 → opening.
    const slabsAbsolute = buildStairwellSlabCandidates([ceilingSlab()], 3000);
    const planOk = planStairwellOpenings(stairsGround, slabsAbsolute, []);
    expect(planOk.creates).toHaveLength(1);
    expect(planOk.creates[0].slabId).toBe('slab-above');
    expect(planOk.creates[0].autoStairId).toBe('stair-ground');

    // ΛΑΘΟΣ (χωρίς FFL offset στην πλάκα): underside -200 < stair base 0 →
    // `isSlabAboveStairBase` false → κανένα ζευγάρωμα → καμία τρύπα. Αποδεικνύει
    // ότι το offset είναι ΑΠΑΡΑΙΤΗΤΟ ΚΑΙ ΕΠΑΡΚΕΣ για το cross-level pairing.
    const slabsRelative = buildStairwellSlabCandidates([ceilingSlab()]); // default 0
    const planNone = planStairwellOpenings(stairsGround, slabsRelative, []);
    expect(planNone.creates).toHaveLength(0);
  });

  it('same-level regression: floorElevationMm=0 → byte-for-byte η προηγούμενη συμπεριφορά', () => {
    const a = buildStairwellPlanStairs([crossLevelStair()]);
    const b = buildStairwellPlanStairs([crossLevelStair()], { floorElevationMm: 0 });
    expect(b[0].baseZmm).toBe(a[0].baseZmm);
    expect(b[0].topZmm).toBe(a[0].topZmm);
    expect(b[0].nosingsZmm).toEqual(a[0].nosingsZmm);
  });
});
