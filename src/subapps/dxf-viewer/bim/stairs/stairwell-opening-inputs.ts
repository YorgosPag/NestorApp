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
  /**
   * ADR-632 cross-level — datum-relative FFL (mm) του ορόφου της σκάλας, ώστε τα z
   * να ανέβουν σε **απόλυτο** datum (ADR-369 §2). Η in-scene γεωμετρία είναι
   * **level-relative** (0-based ανά όροφο· ο 3D stacker προσθέτει `floorElevationMm`
   * — βλ. `multi-floor-3d-source`). Same-level/single-level → default `0` =
   * byte-for-byte η προηγούμενη συμπεριφορά (σκάλα & πλάκα μοιράζονται τον ίδιο
   * offset, ακυρώνεται). Cross-level (σκάλα ορόφου Ν, πλάκα ορόφου Ν+1) → κάθε
   * πλευρά περνά το **δικό της** FFL ώστε ο planner να συγκρίνει headroom σε κοινό
   * απόλυτο datum. Reuse `resolveFloorElevationMm` (`building-foundation-level`).
   */
  readonly floorElevationMm?: number;
}

// ─── Slab candidates ─────────────────────────────────────────────────────────

/**
 * Υποψήφιες υπερκείμενες πλάκες από `SlabEntity[]`. `topZmm = floorElevationMm +
 * levelElevation + heightOffsetFromLevel` (top-face FFL, ADR-369 §2.1)·
 * `undersideZmm = top − thickness`. Και τα δύο σε mm· `outline` στις μονάδες σκηνής
 * (κοινός χώρος x/y με τη σκάλα — cross-floor plans share building origin, ίδια
 * υπόθεση με το ETICS `resolveSlabsAboveForLevel`).
 *
 * ADR-632 cross-level — `floorElevationMm` = datum-relative FFL (mm) του ορόφου
 * **της πλάκας** (default `0` = same-level/single-level, byte-for-byte η παλιά
 * συμπεριφορά). Η in-scene `levelElevation` είναι level-relative (0-based ανά
 * όροφο)· προσθέτοντας το FFL του ορόφου της πλάκας ανεβαίνει σε απόλυτο datum ώστε
 * να συγκρίνεται με σκάλα άλλου ορόφου.
 */
export function buildStairwellSlabCandidates(
  slabs: readonly SlabEntity[],
  floorElevationMm = 0,
): StairwellSlabCandidate[] {
  return slabs.map((slab) => {
    const topZmm =
      floorElevationMm + slab.params.levelElevation + (slab.params.heightOffsetFromLevel ?? 0);
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
  floorElevationMm: number,
): StairwellPlanStair {
  const profile = resolveStairVerticalProfile(stair.params, ctx);
  // ADR-632 — FULL tread set (below + above the 2D cut plane). `StairGeometry.treads`
  // is a **legacy alias = `treadsBelowCut`** (only treads under `cutPlaneHeight`, default
  // 1200mm — the 2D section-view subset). The headroom-violating treads sit near the
  // ceiling, ABOVE the cut plane, so reading `.treads` alone dropped exactly the
  // dangerous upper steps → the auto «well» opening landed on the wrong (lower) slice
  // of the run. Mirror the 3D SSoT (`StairToThreeConverter` spreads
  // `treadsBelowCut ∪ treadsAboveCut`) so nosings + outline cover the whole stair.
  // Fallback to `.treads` keeps legacy fixtures (that only set the alias) working.
  const belowCut = stair.geometry.treadsBelowCut ?? stair.geometry.treads;
  const aboveCut = stair.geometry.treadsAboveCut ?? [];
  // Tread shape adapter (SSoT boundary): the planner reads `{ vertices }` `Polygon3D`,
  // but the stair geometry SSoT stores each tread as a BARE `Point3D[]`. Wrap ONCE here
  // (this file is the scene→planner translation boundary) so both consumers
  // (`computeStairNosings` + `computeStairwellOpeningOutline`) read `.vertices` safely.
  const treads: Polygon3D[] = [...belowCut, ...aboveCut].map((vertices) => ({ vertices: [...vertices] }));
  // ADR-632 cross-level — lift every z into ABSOLUTE datum by adding this stair's
  // floor FFL. In-scene geometry is level-relative (0-based per floor); the profile
  // (base/top) and nosings are all in that same relative frame, so a single uniform
  // offset moves the whole stair into the building's absolute datum. Same-level →
  // `floorElevationMm = 0` (both stair & the overhead slab share the offset → cancels).
  const nosingsZmm = computeStairNosings(treads, stair.params.direction).map((n) => ({
    treadIndex: n.treadIndex,
    zMm: floorElevationMm + n.point.z * sceneToMm,
  }));
  return {
    stairId: stair.id,
    footprint: bboxFootprint(stair),
    baseZmm: floorElevationMm + profile.baseZmm,
    topZmm: floorElevationMm + profile.topZmm,
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
  const floorElevationMm = options.floorElevationMm ?? 0;
  const ctx: StairVerticalContext = { resolveHostInput: options.resolveHostInput };
  return stairs.map((stair) => buildStairInput(stair, ctx, sceneToMm, floorElevationMm));
}

// ─── Managed openings ────────────────────────────────────────────────────────

/**
 * Τα ήδη-υπάρχοντα auto («autoStairId») stairwell openings της σκηνής — υποψήφια
 * για update/delete από τον engine. Χειροκίνητα openings (χωρίς `autoStairId`)
 * ΔΕΝ αγγίζονται.
 *
 * ADR-632 Φ5 — τα **detached** (Override) openings ΣΥΛΛΕΓΟΝΤΑΙ κι αυτά (με το
 * `detached` flag) ώστε ο planner να τα μετρά ως «υπάρχον» για το pair identity
 * (μηδέν διπλό regenerate)· ο diff τα «παγώνει» (skip update/delete).
 */
export function collectManagedStairwellOpenings(
  entities: readonly Entity[],
): StairwellManagedOpening[] {
  const out: StairwellManagedOpening[] = [];
  for (const e of entities) {
    if (!isSlabOpeningEntity(e)) continue;
    const autoStairId = e.params.autoStairId;
    if (!autoStairId) continue;
    out.push({
      openingId: e.id,
      autoStairId,
      slabId: e.params.slabId,
      outline: e.params.outline,
      detached: e.params.autoStairDetached === true,
    });
  }
  return out;
}
