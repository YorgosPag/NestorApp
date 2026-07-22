/**
 * ADR-685 Φάση 1 (μέρος 3) — tests για `computeStairBaseSlabEmbeddedVolumeM3`
 * (scene → BOQ safety-guard όγκος). Reuse fixture idiom του
 * `stairwell-opening-inputs.test.ts` (`as unknown as StairEntity/SlabEntity`).
 */

import type { StairEntity } from '../../types/stair-types';
import type { SlabEntity } from '../../types/slab-types';
import type { SceneModel } from '../../../types/entities';
import type { Entity } from '../../../types/entities';
import {
  computeStairBaseSlabEmbeddedVolumeM3,
  resolveStairBaseSlabSeat,
} from '../stair-slab-embedment';

function stairParams(basePointZ: number) {
  return {
    basePoint: { x: 0, y: 0, z: basePointZ },
    direction: 0,
    totalRun: 3000,
    totalRise: 1750,
    stepCount: 10,
    rise: 175,
    tread: 280, // going (mm)
    width: 1000,
    waistThickness: 180, // μηρός RC (mm)
  };
}

/** Σκάλα με τετράγωνο bbox footprint [0,1000]² — mirror bboxFootprint SSoT. */
function stair(basePointZ: number): StairEntity {
  return {
    id: 'stair-1',
    type: 'stair',
    geometry: {
      bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 1000, y: 1000, z: 1750 } },
    },
    params: stairParams(basePointZ),
  } as unknown as StairEntity;
}

/** Πλάκα βάσης που καλύπτει πλήρως το footprint της σκάλας. top=0, underside=-thickness. */
function baseSlab(thickness = 200): SlabEntity {
  return {
    id: 'slab-base',
    type: 'slab',
    params: {
      outline: {
        vertices: [
          { x: -500, y: -500, z: 0 },
          { x: 1500, y: -500, z: 0 },
          { x: 1500, y: 1500, z: 0 },
          { x: -500, y: 1500, z: 0 },
        ],
      },
      levelElevation: 0,
      thickness,
    },
  } as unknown as SlabEntity;
}

function sceneWith(entities: readonly Entity[]): SceneModel {
  return { entities } as unknown as SceneModel;
}

describe('computeStairBaseSlabEmbeddedVolumeM3', () => {
  it('undefined όταν η σκηνή είναι null', () => {
    expect(computeStairBaseSlabEmbeddedVolumeM3(stair(0), null, {})).toBeUndefined();
  });

  it('undefined όταν η σκηνή δεν έχει πλάκες', () => {
    expect(
      computeStairBaseSlabEmbeddedVolumeM3(stair(0), sceneWith([]), {}),
    ).toBeUndefined();
  });

  it('θετικός όγκος (waist prism εντός ζώνης πλάκας) όταν η σκάλα εδράζεται', () => {
    // basePoint.z=0 == slab top(0) → seat. Section: width 1000, waist 180, rise 175,
    // going 280, steps 10· hyp=330· sinθ=0.5303· inclinedBand=min(200/0.5303=377.1,
    // 10×330=3300)=377.1· vol=1000×180×377.1×1e-9 ≈ 0.0679 m³ (≪ naive bbox×thickness 0.2).
    const vol = computeStairBaseSlabEmbeddedVolumeM3(stair(0), sceneWith([baseSlab(200)]), {});
    expect(vol).toBeCloseTo(0.0679, 3);
  });

  it('undefined όταν η σκάλα αιωρείται πάνω από την πλάκα (floating)', () => {
    // basePoint.z=500 > slab top(0) → floating, δεν εδράζει.
    expect(
      computeStairBaseSlabEmbeddedVolumeM3(stair(500), sceneWith([baseSlab(200)]), {}),
    ).toBeUndefined();
  });

  it('undefined όταν η σκάλα διαπερνά την πλάκα (pass-through)', () => {
    // basePoint.z=-250 < slab underside(-200) → pass-through, δεν εδράζει (opening territory).
    expect(
      computeStairBaseSlabEmbeddedVolumeM3(stair(-250), sceneWith([baseSlab(200)]), {}),
    ).toBeUndefined();
  });

  it('undefined όταν καμία πλάκα δεν επικαλύπτει το footprint', () => {
    const farSlab: SlabEntity = {
      id: 'slab-far',
      type: 'slab',
      params: {
        outline: {
          vertices: [
            { x: 5000, y: 5000, z: 0 },
            { x: 6000, y: 5000, z: 0 },
            { x: 6000, y: 6000, z: 0 },
            { x: 5000, y: 6000, z: 0 },
          ],
        },
        levelElevation: 0,
        thickness: 200,
      },
    } as unknown as SlabEntity;
    expect(
      computeStairBaseSlabEmbeddedVolumeM3(stair(0), sceneWith([farSlab]), {}),
    ).toBeUndefined();
  });
});

describe('resolveStairBaseSlabSeat (ADR-685 Φ2 — 3D terminating trim SSoT)', () => {
  it('εκθέτει top/underside/thickness/όγκο της πλάκας-έδρασης (ίδιο detection με το BOQ)', () => {
    const seat = resolveStairBaseSlabSeat(stair(0), [baseSlab(285)], {});
    expect(seat).toBeDefined();
    // top=0 (levelElevation), underside=−thickness → το επίπεδο trim του μηρού.
    expect(seat!.slabTopZmm).toBeCloseTo(0, 6);
    expect(seat!.slabUndersideZmm).toBeCloseTo(-285, 6);
    expect(seat!.slabThicknessMm).toBeCloseTo(285, 6);
    expect(seat!.baseZmm).toBeCloseTo(0, 6);
    // Ο όγκος = ΙΔΙΟΣ SSoT με το wrapper (μηδέν απόκλιση).
    expect(seat!.embeddedVolumeM3).toBeCloseTo(
      computeStairBaseSlabEmbeddedVolumeM3(stair(0), sceneWith([baseSlab(285)]), {})!,
      6,
    );
  });

  it('undefined χωρίς πλάκες / floating / pass-through (κανένα trim)', () => {
    expect(resolveStairBaseSlabSeat(stair(0), [], {})).toBeUndefined();
    expect(resolveStairBaseSlabSeat(stair(500), [baseSlab(200)], {})).toBeUndefined();
    expect(resolveStairBaseSlabSeat(stair(-250), [baseSlab(200)], {})).toBeUndefined();
  });
});
