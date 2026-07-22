'use client';

/**
 * ADR-685 Φάση 1 (μέρος 3) — BOQ safety-guard: σκηνή → κοινός όγκος
 * σκυροδέματος σκάλας↔πλάκας βάσης.
 *
 * Καθαρή scene→pure γέφυρα (mirror `stair-host-resolver.ts` idiom): παίρνει
 * `StairEntity` + `SceneModel`, χτίζει τα pure inputs που τρώει το
 * `stair-base-slab.ts` (ADR-685) — `StairFootprintInput` (bbox footprint,
 * mirror `stairwell-opening-inputs.bboxFootprint`, + resolved `baseZmm`/
 * `topZmm` μέσω `resolveStairVerticalProfile`, ΙΔΙΟ SSoT με τα BOQ effective
 * params) και `StairwellSlabCandidate[]` (μέσω `buildStairwellSlabCandidates`,
 * ΙΔΙΟ SSoT με τον ADR-632 opening engine) — βρίσκει την πλάκα-έδρασης
 * (`findSlabToSeatStairBase`) και επιστρέφει τον κοινό όγκο
 * (`computeStairSlabEmbedmentVolumeM3`). `undefined` όταν η σκηνή λείπει, δεν
 * υπάρχουν πλάκες, ή καμία δεν εδράζει τη σκάλα (αιωρούμενη / διαπερνά /
 * χωρίς οριζόντια επικάλυψη) — ο caller τότε ΔΕΝ αφαιρεί τίποτα.
 *
 * REUSE (SSoT, N.0.2): `stair-base-slab.ts` (γεωμετρία/ταξινόμηση/όγκος),
 * `stairwell-opening-inputs.buildStairwellSlabCandidates` (slab inputs),
 * `resolveStairVerticalProfile` (baseZmm/topZmm). Καμία διπλή γεωμετρία.
 *
 * @see bim/geometry/stairs/stair-base-slab.ts
 * @see docs/centralized-systems/reference/adrs/ADR-685-stair-base-slab-seating-ssot.md
 */

import type { SceneModel, SlabEntity } from '../../types/entities';
import { isSlabEntity } from '../../types/entities';
import type { StairEntity } from '../types/stair-types';
import type { Point3D, Polygon3D } from '../types/bim-base';
import type { StairVerticalContext } from '../geometry/stair-vertical-profile';
import { resolveEffectiveStairParams } from '../geometry/stairs/stair-effective-params';
import {
  findSlabToSeatStairBase,
  computeStairWaistSlabOverlapVolumeM3,
  type StairWaistSection,
} from '../geometry/stairs/stair-base-slab';
import type { StairFootprintInput } from '../geometry/stairs/stair-slab-overlap';
import { buildStairwellSlabCandidates } from '../stairs/stairwell-opening-inputs';
import { DEFAULT_WAIST_SLAB_THICKNESS_MM } from '../stairs/stair-boq-quantities';

/**
 * Ορθογώνιο footprint (CCW, z=0) από το bbox της σκάλας — mirror
 * `stairwell-opening-inputs.bboxFootprint` (ίδια coarse overlap gate γεωμετρία,
 * private εκεί· επαναλαμβάνεται εδώ ως single-expression adapter, όχι formula).
 */
function stairBboxFootprint(stair: StairEntity): Polygon3D {
  const { min, max } = stair.geometry.bbox;
  const vertices: Point3D[] = [
    { x: min.x, y: min.y, z: 0 },
    { x: max.x, y: min.y, z: 0 },
    { x: max.x, y: max.y, z: 0 },
    { x: min.x, y: max.y, z: 0 },
  ];
  return { vertices };
}

/**
 * Πλήρης «έδραση σκάλας↔πλάκας βάσης» (ADR-685) — ΕΝΑ detection, δύο καταναλωτές:
 *   • **BOQ dedup** (Φ1) → `embeddedVolumeM3` (κοινό σκυρόδεμα προς αφαίρεση).
 *   • **3D terminating trim** (Φ2) → `slabUndersideZmm` (επίπεδο κοπής του μηρού).
 *
 * `undefined` όταν δεν υπάρχουν πλάκες ή καμία δεν εδράζει τη σκάλα (αιωρούμενη /
 * διαπερνά / χωρίς οριζόντια επικάλυψη) — ο caller τότε ΔΕΝ εδράζει/αφαιρεί τίποτα.
 * Και τα δύο z σε mm (level-relative, ίδιο datum με `basePoint.z`).
 */
export interface StairBaseSlabSeat {
  /** Απόλυτο Z άνω παρειάς πλάκας-έδρασης (mm). */
  readonly slabTopZmm: number;
  /** Απόλυτο Z κάτω παρειάς πλάκας-έδρασης (mm) — το επίπεδο trim του μηρού. */
  readonly slabUndersideZmm: number;
  /** Πάχος πλάκας-έδρασης (mm) = `top − underside`. */
  readonly slabThicknessMm: number;
  /** Effective Z βάσης σκάλας (mm) — resolved profile (ίδιο SSoT με το BOQ). */
  readonly baseZmm: number;
  /** Κοινό σκυρόδεμα μηρού↔πλάκας στη ζώνη βάσης (m³) — BOQ dedup. */
  readonly embeddedVolumeM3: number;
}

/**
 * Βρίσκει την πλάκα-έδρασης της σκάλας (`findSlabToSeatStairBase` SSoT) και επιστρέφει
 * ό,τι χρειάζονται ΚΑΙ οι δύο καταναλωτές (BOQ όγκος + 3D underside). Ίδιο effective
 * params SSoT με το BOQ (ADR-401 Phase G.2). `undefined` όταν καμία πλάκα δεν εδράζει.
 * `slabs` = level-scoped set (ο caller περνά τις ίδιες πλάκες με τον host resolver).
 */
export function resolveStairBaseSlabSeat(
  stair: StairEntity,
  slabs: readonly SlabEntity[],
  ctx: StairVerticalContext,
): StairBaseSlabSeat | undefined {
  if (slabs.length === 0) return undefined;

  // ΙΔΙΑ effective params με το BOQ concrete (ADR-401 Phase G.2 SSoT): attach → re-step
  // (rise/stepCount snap + baseZmm στο slab top). Ένας υπολογισμός → profile + section.
  const { params: eff, profile } = resolveEffectiveStairParams(stair.params, ctx);
  const stairInput: StairFootprintInput = {
    stairId: stair.id,
    footprint: stairBboxFootprint(stair),
    baseZmm: profile.baseZmm,
    topZmm: profile.topZmm,
  };

  const seat = findSlabToSeatStairBase(stairInput, buildStairwellSlabCandidates([...slabs]));
  if (!seat) return undefined;

  const slabThicknessMm = seat.slab.topZmm - seat.slab.undersideZmm;
  const section: StairWaistSection = {
    widthMm: eff.width,
    waistThicknessMm: eff.waistThickness ?? DEFAULT_WAIST_SLAB_THICKNESS_MM,
    riseMm: eff.rise,
    goingMm: eff.tread,
    stepCount: eff.stepCount,
  };
  return {
    slabTopZmm: seat.slab.topZmm,
    slabUndersideZmm: seat.slab.undersideZmm,
    slabThicknessMm,
    baseZmm: profile.baseZmm,
    embeddedVolumeM3: computeStairWaistSlabOverlapVolumeM3(section, slabThicknessMm),
  };
}

/**
 * BOQ safety-guard όγκος (m³) προς αφαίρεση από το concrete row ΤΗΣ ΣΚΑΛΑΣ: το
 * κοινό σκυρόδεμα σκάλας↔πλάκας βάσης. Thin wrapper του `resolveStairBaseSlabSeat`
 * (ΕΝΑ detection SSoT). `undefined` όταν η σκηνή λείπει ή καμία πλάκα δεν εδράζει τη
 * σκάλα — ο caller τότε αφήνει το nominal concrete volume αμετάβλητο (καμία αφαίρεση).
 */
export function computeStairBaseSlabEmbeddedVolumeM3(
  stair: StairEntity,
  scene: SceneModel | null,
  ctx: StairVerticalContext,
): number | undefined {
  if (!scene) return undefined;
  return resolveStairBaseSlabSeat(stair, scene.entities.filter(isSlabEntity), ctx)?.embeddedVolumeM3;
}
