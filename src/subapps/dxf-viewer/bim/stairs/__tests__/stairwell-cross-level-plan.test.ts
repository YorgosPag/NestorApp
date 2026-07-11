/**
 * ADR-632 CL-2 — building-wide (cross-level) stairwell-opening planner.
 *
 * Σκάλα ισόγειο (σκηνή A, FFL 0) + πλάκα-οροφή 1ου ορόφου (σκηνή B, FFL 3000) →
 * το «well» opening ανοίγει στη σκηνή B, βάσει απόλυτου Z. Επαληθεύει: cross-level
 * pairing, same-level skip (command-owned), orphan delete, idempotency, και ότι το
 * cross-level ΔΕΝ αγγίζει same-level managed openings.
 *
 * @see bim/stairs/stairwell-cross-level-plan.ts
 */

import type { Point3D } from '../../types/bim-base';
import type { StairEntity } from '../../types/stair-types';
import type { SlabEntity } from '../../types/slab-types';
import type { SlabOpeningEntity } from '../../types/slab-opening-types';
import {
  planCrossLevelStairwellOpenings,
  type CrossLevelFloorEntry,
} from '../stairwell-cross-level-plan';

function tread(z: number): Point3D[] {
  return [
    { x: 0, y: 0, z },
    { x: 300, y: 0, z },
    { x: 300, y: 1000, z },
    { x: 0, y: 1000, z },
  ];
}

/** Σκάλα ισογείου με nosings 300…2900mm (level-relative, ίδιο x/y footprint). */
function groundStair(id = 'stair-ground'): StairEntity {
  const treads = [300, 600, 900, 1200, 1500, 1800, 2100, 2400, 2700, 2900].map(tread);
  return {
    id,
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
function ceilingSlab(id = 'slab-above'): SlabEntity {
  return {
    id,
    type: 'slab',
    layerId: 'layer-slab',
    params: {
      outline: {
        vertices: [
          { x: -500, y: -500, z: 0 },
          { x: 800, y: -500, z: 0 },
          { x: 800, y: 1500, z: 0 },
          { x: -500, y: 1500, z: 0 },
        ],
      },
      levelElevation: 0,
      thickness: 200,
    },
  } as unknown as SlabEntity;
}

/** Ένα managed «well» opening (autoStairId marker), ήδη στη σκηνή της πλάκας. */
function managedOpening(autoStairId: string, slabId = 'slab-above', id = 'opening-x'): SlabOpeningEntity {
  return {
    id,
    type: 'slab-opening',
    kind: 'well',
    layerId: 'layer-slab',
    params: {
      kind: 'well',
      slabId,
      autoStairId,
      outline: { vertices: ceilingSlab().params.outline.vertices },
    },
  } as unknown as SlabOpeningEntity;
}

function floor(
  levelId: string,
  floorElevationMm: number,
  bundle: Partial<Pick<CrossLevelFloorEntry, 'stairs' | 'slabs' | 'managedOpenings'>>,
): CrossLevelFloorEntry {
  return {
    levelId,
    floorId: `flr-${levelId}`,
    floorplanId: `file-${levelId}`,
    projectId: 'proj-1',
    floorElevationMm,
    stairs: bundle.stairs ?? [],
    slabs: bundle.slabs ?? [],
    managedOpenings: bundle.managedOpenings ?? [],
  };
}

describe('planCrossLevelStairwellOpenings', () => {
  it('ζευγαρώνει σκάλα ισογείου (σκηνή A) με πλάκα 1ου ορόφου (σκηνή B) → opening στη B', () => {
    const entries = [
      floor('level-0', 0, { stairs: [groundStair()] }),
      floor('level-1', 3000, { slabs: [ceilingSlab()] }),
    ];
    const applies = planCrossLevelStairwellOpenings(entries);

    expect(applies).toHaveLength(1);
    expect(applies[0].levelId).toBe('level-1'); // opening ζει στη σκηνή της ΠΛΑΚΑΣ
    expect(applies[0].floorId).toBe('flr-level-1');
    expect(applies[0].creates).toHaveLength(1);
    expect(applies[0].creates[0].params.slabId).toBe('slab-above');
    expect(applies[0].creates[0].params.autoStairId).toBe('stair-ground');
    expect(applies[0].deletes).toHaveLength(0);
  });

  it('same-level ζεύγος (σκάλα+πλάκα ίδιος όροφος) → ΚΑΝΕΝΑ cross-level opening (command-owned)', () => {
    const entries = [
      floor('level-0', 0, { stairs: [groundStair()], slabs: [ceilingSlab()] }),
      floor('level-1', 3000, {}),
    ];
    // Ο μόνος συνδυασμός είναι same-level → ο cross-level τον αγνοεί εντελώς.
    expect(planCrossLevelStairwellOpenings(entries)).toHaveLength(0);
  });

  it('χωρίς FFL offset στην πλάκα (λάθος datum) → underside κάτω από τη βάση → κανένα ζευγάρωμα', () => {
    const entries = [
      floor('level-0', 0, { stairs: [groundStair()] }),
      floor('level-1', 0, { slabs: [ceilingSlab()] }), // λάθος: πλάκα ΔΕΝ ανέβηκε
    ];
    expect(planCrossLevelStairwellOpenings(entries)).toHaveLength(0);
  });

  it('idempotent: το ήδη-δημιουργημένο opening στη σκηνή της πλάκας → 2ο run κενό', () => {
    const entries = [
      floor('level-0', 0, { stairs: [groundStair()] }),
      floor('level-1', 3000, { slabs: [ceilingSlab()] }),
    ];
    const first = planCrossLevelStairwellOpenings(entries);
    const created = first[0].creates[0];

    const entries2 = [
      floor('level-0', 0, { stairs: [groundStair()] }),
      floor('level-1', 3000, { slabs: [ceilingSlab()], managedOpenings: [created] }),
    ];
    expect(planCrossLevelStairwellOpenings(entries2)).toHaveLength(0);
  });

  it('orphan delete: managed opening στη σκηνή της πλάκας αλλά η σκάλα έφυγε → delete', () => {
    const entries = [
      floor('level-0', 0, {}), // η σκάλα διαγράφηκε
      floor('level-1', 3000, { slabs: [ceilingSlab()], managedOpenings: [managedOpening('stair-ground')] }),
    ];
    const applies = planCrossLevelStairwellOpenings(entries);
    expect(applies).toHaveLength(1);
    expect(applies[0].levelId).toBe('level-1');
    expect(applies[0].deletes).toEqual(['opening-x']);
    expect(applies[0].creates).toHaveLength(0);
  });

  it('ΔΕΝ αγγίζει same-level managed opening (autoStairId σκάλας ΙΔΙΟΥ ορόφου)', () => {
    // level-0 έχει σκάλα «stair-local» + το same-level managed opening της (command-owned).
    const entries = [
      floor('level-0', 0, {
        stairs: [groundStair('stair-local')],
        slabs: [ceilingSlab('slab-local')],
        managedOpenings: [managedOpening('stair-local', 'slab-local', 'opening-local')],
      }),
      floor('level-1', 3000, {}),
    ];
    const applies = planCrossLevelStairwellOpenings(entries);
    // Το same-level opening εξαιρείται από το `existing` → ποτέ delete/update από cross-level.
    const allDeletes = applies.flatMap((a) => a.deletes);
    expect(allDeletes).not.toContain('opening-local');
  });

  it('λιγότεροι από 2 όροφοι-με-σκάλες → κανένα cross-level (μόνο ένας όροφος)', () => {
    const entries = [floor('level-0', 0, { stairs: [groundStair()], slabs: [ceilingSlab()] })];
    expect(planCrossLevelStairwellOpenings(entries)).toHaveLength(0);
  });
});
