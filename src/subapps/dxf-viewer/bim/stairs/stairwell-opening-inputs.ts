/**
 * ADR-632 — Φάση 3: Καθαροί input builders για τον `StairwellOpeningEngine`.
 *
 * Μεταφράζουν τις σκηνικές οντότητες (`SlabEntity` / `StairEntity` /
 * `SlabOpeningEntity`) στα plain-data inputs του pure planner
 * (`stairwell-opening-plan.ts`). Εδώ — και ΜΟΝΟ εδώ — γίνεται η μετατροπή του
 * κατακόρυφου nosing z από μονάδες σκηνής σε **απόλυτα mm** (ADR-358 §9.2 Q22 /
 * ADR-369 datum), ώστε ο planner να συγκρίνει headroom στην ίδια μονάδα με την
 * κάτω παρειά της πλάκας (`levelElevation` — πάντα mm).
 *
 * Pure — μηδέν scene mutation / React / IO. Reuse (SSoT, N.0.2):
 * `resolveStairVerticalProfile` (κατακόρυφο εύρος), `computeStairNosings`
 * (nosing line), `effectiveMinHeadroomMm` (κατώφλι ανά κανονισμό), `dxfUnitToMm`
 * (scene→mm). Καμία διπλή γεωμετρία/φόρμουλα.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-632-stairwell-auto-opening-ssot.md §3
 */

import type { Point3D, Polygon3D } from '../types/bim-base';
import type { Entity } from '../../types/entities';
import type { SlabEntity } from '../types/slab-types';
import type { StairEntity } from '../types/stair-types';
import { isSlabOpeningEntity } from '../../types/entities';
import { dxfUnitToMm, type SceneUnits } from '../../utils/scene-units';
import {
  resolveStairVerticalProfile,
  type StairVerticalContext,
} from '../geometry/stair-vertical-profile';
import { computeStairNosings } from '../geometry/stairs/stair-nosing-line';
import { effectiveMinHeadroomMm } from './stair-headroom-constants';
import type {
  StairwellManagedOpening,
  StairwellPlanStair,
} from '../geometry/stairs/stairwell-opening-plan';
import type { StairwellSlabCandidate } from '../geometry/stairs/stair-slab-overlap';

export interface StairwellInputOptions {
  /** Μονάδες σκηνής (για scene→mm του nosing z). Default `'mm'` (ADR-462 canonical). */
  readonly sceneUnits?: SceneUnits;
  /** Host lookup για attach-resolved κατακόρυφο προφίλ (ADR-401). Απόν → nominal. */
  readonly resolveHostInput?: StairVerticalContext['resolveHostInput'];
}

// ─── Slab candidates ─────────────────────────────────────────────────────────

/**
 * Υποψήφιες υπερκείμενες πλάκες από `SlabEntity[]`. `topZmm = levelElevation +
 * heightOffsetFromLevel` (top-face FFL, ADR-369 §2.1)· `undersideZmm = top −
 * thickness`. Και τα δύο σε mm· `outline` στις μονάδες σκηνής (ίδιος χώρος με τη σκάλα).
 */
export function buildStairwellSlabCandidates(
  slabs: readonly SlabEntity[],
): StairwellSlabCandidate[] {
  return slabs.map((slab) => {
    const topZmm = slab.params.levelElevation + (slab.params.heightOffsetFromLevel ?? 0);
    return {
      slabId: slab.id,
      outline: slab.params.outline,
      topZmm,
      undersideZmm: topZmm - slab.params.thickness,
    };
  });
}

// ─── Stair plan inputs ───────────────────────────────────────────────────────

/** Ορθογώνιο footprint (CCW, z=0) από το bbox της σκάλας — coarse overlap gate. */
function bboxFootprint(stair: StairEntity): Polygon3D {
  const { min, max } = stair.geometry.bbox;
  const vertices: Point3D[] = [
    { x: min.x, y: min.y, z: 0 },
    { x: max.x, y: min.y, z: 0 },
    { x: max.x, y: max.y, z: 0 },
    { x: min.x, y: max.y, z: 0 },
  ];
  return { vertices };
}

/** Μία σκάλα → `StairwellPlanStair` (profile mm + nosings mm + footprint). */
function buildStairInput(
  stair: StairEntity,
  ctx: StairVerticalContext,
  sceneToMm: number,
): StairwellPlanStair {
  const profile = resolveStairVerticalProfile(stair.params, ctx);
  const treads = stair.geometry.treads;
  const nosingsZmm = computeStairNosings(treads, stair.params.direction).map((n) => ({
    treadIndex: n.treadIndex,
    zMm: n.point.z * sceneToMm,
  }));
  return {
    stairId: stair.id,
    footprint: bboxFootprint(stair),
    baseZmm: profile.baseZmm,
    topZmm: profile.topZmm,
    treads,
    nosingsZmm,
    minHeadroomMm: effectiveMinHeadroomMm(stair.params.codeProfile),
  };
}

/**
 * `StairEntity[]` → resolved planner inputs. Η μετατροπή scene→mm του nosing z
 * γίνεται ΜΙΑ φορά εδώ (`dxfUnitToMm(sceneUnits)`).
 */
export function buildStairwellPlanStairs(
  stairs: readonly StairEntity[],
  options: StairwellInputOptions = {},
): StairwellPlanStair[] {
  const sceneToMm = dxfUnitToMm(options.sceneUnits ?? 'mm');
  const ctx: StairVerticalContext = { resolveHostInput: options.resolveHostInput };
  return stairs.map((stair) => buildStairInput(stair, ctx, sceneToMm));
}

// ─── Managed openings ────────────────────────────────────────────────────────

/**
 * Τα ήδη-υπάρχοντα auto («autoStairId») stairwell openings της σκηνής — υποψήφια
 * για update/delete από τον engine. Χειροκίνητα openings (χωρίς `autoStairId`)
 * ΔΕΝ αγγίζονται.
 */
export function collectManagedStairwellOpenings(
  entities: readonly Entity[],
): StairwellManagedOpening[] {
  const out: StairwellManagedOpening[] = [];
  for (const e of entities) {
    if (!isSlabOpeningEntity(e)) continue;
    const autoStairId = e.params.autoStairId;
    if (!autoStairId) continue;
    out.push({ openingId: e.id, autoStairId, slabId: e.params.slabId, outline: e.params.outline });
  }
  return out;
}
