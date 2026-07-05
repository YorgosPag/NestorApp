/**
 * Footing element summary — SSoT extractor (ADR-459 Phase 2).
 *
 * ΕΝΑ σημείο που αναγνωρίζει «footing» οντότητες και εξάγει το geometry summary
 * (plan footprint + Z extents) τους. Footing = ό,τι παρέχει έδραση από κάτω:
 *   · `FoundationEntity` (pad/strip/tie-beam).
 *   · `SlabEntity` kind `foundation`/`ground` (εδαφόπλακα / γενική κοιτόστρωση).
 *
 * Μοιραζόμενο από `structural-graph.ts` (footing nodes) + `foundation-column-
 * attach-coordinator.ts` (explicit-FK pairing) → μηδέν duplicate (N.0.2).
 *
 * Pure module — μηδέν side-effects.
 *
 * @see footing-column-coverage.ts — το bearing κριτήριο
 * @see structural-graph.ts
 * @see foundation-column-attach-coordinator.ts
 */

import type { Entity } from '../../types/entities';
import { isFoundationEntity, isSlabEntity } from '../../types/entities';
import { slabHostInput } from '../geometry/wall-host-plan-builder';
import type { SlabEntity } from '../types/slab-types';
import type { CoveragePoint } from './footing-column-coverage';
import { projectVerticesTo2D } from '../geometry/shared/polygon-utils';

/** Underlying entity type ενός footing element. */
export type FootingEntityType = 'foundation' | 'foundation-slab';

/** Geometry summary ενός footing element (plan footprint + absolute mm Z extents). */
export interface FootingSummary {
  readonly footprint: readonly CoveragePoint[];
  /** Absolute mm — άνω παρειά (έδραση κολόνας από κάτω). */
  readonly topZmm: number;
  /** Absolute mm — κάτω παρειά. */
  readonly baseZmm: number;
  readonly entityType: FootingEntityType;
}

/** Foundation/ground πλάκα (raft/εδαφόπλακα) → μετράει ως footing. */
function isFoundationSlab(e: Entity): e is SlabEntity {
  return isSlabEntity(e) && (e.kind === 'foundation' || e.kind === 'ground');
}

/** True αν η οντότητα είναι footing element (foundation ή foundation/ground slab). */
export function isFootingElement(e: Entity): boolean {
  return isFoundationEntity(e) || isFoundationSlab(e);
}

/**
 * Absolute (datum-relative) Z extents ενός footing summary, δεδομένου του FFL του
 * ορόφου που ζει (ADR-459 Phase 6 — cross-level).
 *
 * 🔑 Σύμβαση υψομέτρων (ADR-369, επιβεβαιωμένη στους 3D converters):
 *   · `FoundationEntity` (entityType 'foundation') → το `topElevationMm` είναι ΗΔΗ
 *     **ΑΠΟΛΥΤΟ** (το `foundation-to-three` αγνοεί σκόπιμα το floorElevationMm) → +0.
 *   · foundation/ground SLAB (entityType 'foundation-slab') → **floor-relative**
 *     (το `slab-multilayer-solid-3d` προσθέτει floorElevationMm) → +floorElevationMm.
 *
 * Single-level (floorElevationMm = 0) → +0 και στις δύο → byte-for-byte η παλιά
 * συμπεριφορά.
 */
export function footingAbsoluteZ(
  summary: FootingSummary,
  floorElevationMm: number,
): { readonly topZmm: number; readonly baseZmm: number } {
  const offset = summary.entityType === 'foundation' ? 0 : floorElevationMm;
  return { topZmm: summary.topZmm + offset, baseZmm: summary.baseZmm + offset };
}

/**
 * Geometry summary ενός footing element, ή `null` αν δεν είναι footing / έχει
 * εκφυλισμένο footprint (< 3 κορυφές).
 */
export function resolveFootingSummary(e: Entity): FootingSummary | null {
  if (isFoundationEntity(e)) {
    const verts = e.geometry?.footprint?.vertices;
    if (!verts || verts.length < 3) return null;
    const topZmm = e.params.topElevationMm;
    return {
      footprint: projectVerticesTo2D(verts),
      topZmm,
      baseZmm: topZmm - e.params.thicknessMm,
      entityType: 'foundation',
    };
  }
  if (isFoundationSlab(e)) {
    const input = slabHostInput(e);
    if (input.footprint.length < 3) return null;
    const topZmm = input.topsideZmm ?? input.undersideZmm;
    return {
      footprint: projectVerticesTo2D(input.footprint),
      topZmm,
      baseZmm: input.undersideZmm,
      entityType: 'foundation-slab',
    };
  }
  return null;
}
