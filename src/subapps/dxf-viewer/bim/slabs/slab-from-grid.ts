/**
 * ADR-441 Slice GEN-SLAB — «Πλάκες από κάναβο» (slabs from construction grid).
 *
 * Pure builders, mirror του `beam-from-grid.ts`. Δύο εντελώς διαφορετικές
 * γεωμετρικές συμπεριφορές (αποφάσεις Revit-grade, ADR-441 §GEN-SLAB):
 *
 *  - **MAT (εδαφόπλακα / κοιτόστρωση)** → `buildFoundationMatSlabs`: ΕΝΑ ενιαίο
 *    `SlabEntity kind='foundation'` ανά building component, outline = το merged
 *    περίγραμμα κτιρίου (`computeBuildingFootprint().outerRings`). Revit slab-on-grade:
 *    μία κλειστή περίμετρος που καλύπτει όλο το αποτύπωμα — **ΔΕΝ** υποδιαιρείται από
 *    τον κάναβο, **δεν** φέρει grid bindings (ακολουθεί τα δομικά στοιχεία, όχι έναν άξονα).
 *
 *  - **FLOOR / ROOF (δάπεδο / οροφή)** → Slice FLOOR (ξεχωριστή συνάρτηση εδώ, επόμενο
 *    slice): ΠΟΛΛΕΣ πλάκες, μία ανά φάτνωμα, born-bound στους 4 άξονες.
 *
 * ΜΗΔΕΝ duplication geometry/builder math — κάθε πλάκα περνά από το ΥΠΑΡΧΟΝ SSoT
 * `completeSlabFromPolygonClicks` (slab-completion.ts). Το footprint βγαίνει από το
 * ΥΠΑΡΧΟΝ `computeBuildingFootprint` (boolean union τοίχων+κολωνών+δοκαριών).
 *
 * v1 περιορισμός (DEFER): το `SlabParams.outline` είναι απλό πολύγωνο (χωρίς holes),
 * άρα εσωτερικά κενά (αίθρια) αγνοούνται στην εδαφόπλακα — θα καλυφθούν ως ξεχωριστά
 * `slab-opening` entities (ADR-363 Phase 3.5). Slab-on-grade σπανίως έχει αίθριο.
 *
 * @see bim/beams/beam-from-grid.ts — γραμμικό πρότυπο
 * @see bim/geometry/building-footprint.ts — computeBuildingFootprint (footprint SSoT)
 * @see hooks/drawing/slab-completion.ts — buildSlabEntity SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §GEN-SLAB
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SlabEntity } from '../types/slab-types';
import {
  completeSlabFromPolygonClicks,
  type SlabParamOverrides,
  type SceneUnits,
} from '../../hooks/drawing/slab-completion';
import {
  computeBuildingFootprint,
  type BeamForFootprint,
} from '../geometry/building-footprint';
import type { WallForEnvelope } from '../geometry/envelope-perimeter';
import type { ColumnForEnvelope } from '../geometry/envelope-column-bridge';

export interface BuildSlabMatResult {
  readonly ok: boolean;
  /** Όταν `ok=false`: δεν υπάρχει αποτύπωμα (μηδέν δομικά στοιχεία στον όροφο). */
  readonly reason?: 'no-footprint';
  /** Οι ενιαίες εδαφόπλακες (μία ανά building component). */
  readonly slabs: readonly SlabEntity[];
  /** Πλήθος components που απορρίφθηκαν από τον slab validator (degenerate). */
  readonly ignoredCount: number;
}

/**
 * Παράγει την/τις **ενιαία/ες** εδαφόπλακα/ες από το αποτύπωμα του κτιρίου.
 *
 * Ένα `SlabEntity kind='foundation'` ανά συνεκτικό component του περιγράμματος (ένα για
 * συνεχόμενο κτίριο, περισσότερα για αποσπασμένα). Outline = το εξώτατο όριο του
 * component (holes → DEFER, βλ. module doc). `levelElevation` default per-kind (0 για
 * foundation) εκτός αν δοθεί override. Δεν φέρει `guideBindings` — η εδαφόπλακα ΔΕΝ
 * κρέμεται σε άξονα (ακολουθεί τα δομικά στοιχεία μέσω επανα-δημιουργίας, όχι follow-move).
 */
export function buildFoundationMatSlabs(
  walls: readonly WallForEnvelope[],
  columns: readonly ColumnForEnvelope[],
  beams: readonly BeamForFootprint[],
  overrides: SlabParamOverrides,
  layerId: string,
  sceneUnits: SceneUnits,
): BuildSlabMatResult {
  const footprint = computeBuildingFootprint(walls, columns, beams, sceneUnits);
  if (footprint.outerRings.length === 0) {
    return { ok: false, reason: 'no-footprint', slabs: [], ignoredCount: 0 };
  }

  const slabs: SlabEntity[] = [];
  let ignoredCount = 0;
  for (const ring of footprint.outerRings) {
    const vertices: Point2D[] = ring.points.points.map((p) => ({ x: p.x, y: p.y }));
    const result = completeSlabFromPolygonClicks(
      vertices,
      layerId,
      { ...overrides, kind: 'foundation' },
      sceneUnits,
    );
    if (result.ok) slabs.push(result.entity);
    else ignoredCount++;
  }

  return { ok: slabs.length > 0, slabs, ignoredCount };
}
