/**
 * clearance-dims — SSoT wrapper: «footprint ελεύθερου ghost → κυανές neighbor-clearance dims με τα
 * ΚΑΝΟΝΙΚΑ metrics» (ADR-508 §neighbor-clearance).
 *
 * **Γιατί υπάρχει (Giorgio SSoT order 2026-07-04):** το «build opts + call resolveNeighborClearanceDims»
 * idiom (τα 4 πεδία `gap/min/max × wpp` + `orthoToleranceDeg:1`) ήταν copy-pasted σε ΔΥΟ σημεία —
 * `placement-ghost-assembly` (τοποθέτηση νέου μέλους) + `move-clearance-dims` (μετακίνηση υπάρχοντος).
 * Εδώ ζει ΜΙΑ φορά: ΕΝΑ σημείο ορίζει τα clearance metrics· και οι δύο ροές το καλούν → μηδέν drift.
 *
 * Pure — zero React/DOM.
 *
 * @see ./neighbor-clearance-dims.ts — η γεωμετρική μηχανή (resolveNeighborClearanceDims)
 * @see ../placement/placement-ghost-assembly.ts — consumer (τοποθέτηση)
 * @see ./move-clearance-dims.ts — consumer (μετακίνηση)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import type { SceneSnapTargets } from './scene-snap-targets';
import type { GhostFaceDimensionsMeta } from './ghost-face-dim-references';
import { resolveNeighborClearanceDims, NEIGHBOR_DIM_MAX_CLEARANCE_PX } from './neighbor-clearance-dims';
import { GHOST_DIM_GAP_OFFSET_PX, GHOST_DIM_MIN_PX } from '../../hooks/drawing/wysiwyg-preview-shared';

/**
 * Οι κυανές clearance dims για ένα ghost footprint με τα ΚΑΝΟΝΙΚΑ (zoom-adaptive) metrics — το ΜΟΝΟ
 * σημείο που ορίζει gap/min/max offsets. `wpp` = world-units ανά screen pixel. `null` όταν κανένας
 * γείτονας εντός ορίων.
 */
export function resolveClearanceDimsForGhost(
  ghostFootprint: readonly Point2D[],
  targets: Readonly<SceneSnapTargets>,
  sceneUnits: SceneUnits,
  wpp: number,
): GhostFaceDimensionsMeta | null {
  return resolveNeighborClearanceDims(ghostFootprint, targets, sceneUnits, {
    gapOffsetScene: GHOST_DIM_GAP_OFFSET_PX * wpp,
    minValueScene: GHOST_DIM_MIN_PX * wpp,
    maxClearanceScene: NEIGHBOR_DIM_MAX_CLEARANCE_PX * wpp,
    orthoToleranceDeg: 1,
  });
}
