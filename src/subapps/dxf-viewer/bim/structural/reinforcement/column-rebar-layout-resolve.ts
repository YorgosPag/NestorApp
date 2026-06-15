/**
 * Column rebar layout DISPATCHER — SSoT entry (ADR-460 — Multi-shape, Slice 2).
 *
 * ΕΝΑ σημείο που επιλέγει τη σωστή layout engine ανά detailing mode:
 *   - `perimeter` ορθογ.    → rect fast-path `computeColumnRebarLayout` (μηδέν regression)
 *   - `perimeter` Γ/Τ/Π/Ι   → `buildMultiHoopLayout` (επικαλυπτόμενοι ορθογ. συνδετήρες
 *                             ανά σκέλος — η σωστή μέθοδος, ADR-460 follow-up 6)
 *   - `perimeter` μη-rectilinear (N-gon/διαγώνιο) → `buildPerimeterLayoutFromOutline` (fallback)
 *   - `circular`            → `buildCircularLayout`
 *   - `wall`                → `buildWallLayout` (boundary elements + web)
 *
 * Όλοι οι consumers (ποσότητες, 2Δ, 3Δ, detail-sheet) καλούν ΑΥΤΟ — όχι τις
 * επιμέρους engines — ώστε η επιλογή σχήματος να ζει σε ΕΝΑ σημείο. Ξεχωριστό
 * module από το `column-rebar-layout` ώστε οι leaf engines να εισάγουν primitives
 * από εκεί χωρίς κύκλο. Pure.
 *
 * @see ./column-section-outline.ts
 */

import type { ColumnParams } from '../../types/column-types';
import type { ColumnReinforcement } from './column-reinforcement-types';
import { MAX_RESTRAINED_BAR_SPACING_MM } from './column-reinforcement-types';
import { computeColumnRebarLayout, type ColumnRebarLayout } from './column-rebar-layout';
import { buildPerimeterLayoutFromOutline } from './column-perimeter-layout';
import { decomposeColumnSectionRects } from './column-rect-decomposition';
import { buildMultiHoopLayout } from './column-multihoop-layout';
import { buildCircularLayout } from './column-circular-layout';
import { buildWallLayout } from './column-wall-reinforcement';
import { buildColumnCrossTies, buildTiesFromAnchors, type ColumnCrossTie } from './column-cross-ties';
import {
  resolveColumnReinforcementSection,
  type ColumnReinforcementSection,
} from './column-section-outline';

/**
 * Διάταξη οπλισμού για **οποιοδήποτε** σχήμα διατομής, από προ-υπολογισμένο section.
 * Επιστρέφει `null` για εκφυλισμένη διατομή / απουσία οπλισμού.
 *
 * `maxBarSpacingMm` (EC8/ΕΑΚ όριο συγκρατημένων ράβδων) → πλήθος ράβδων ανά σκέλος στο
 * multihoop. Default = {@link MAX_RESTRAINED_BAR_SPACING_MM} (= η τιμή ΚΑΙ των δύο
 * providers σήμερα) ώστε οι **pure renderers** να μένουν code-free· compute/validator
 * (που resolve-άρουν τον ενεργό κανονισμό) μπορούν να περάσουν την ακριβή τιμή (DCH).
 */
export function resolveColumnRebarLayout(
  r: ColumnReinforcement,
  section: ColumnReinforcementSection,
  maxBarSpacingMm: number = MAX_RESTRAINED_BAR_SPACING_MM,
): ColumnRebarLayout | null {
  switch (section.mode) {
    case 'circular':
      return buildCircularLayout(r, section.diameterMm ?? section.bboxWidthMm);
    case 'wall':
      return buildWallLayout(r, section);
    case 'perimeter':
    default: {
      if (section.kind === 'rectangular') {
        return computeColumnRebarLayout(r, section.bboxWidthMm, section.bboxDepthMm);
      }
      // Γ/Τ/Π/Ι/composite-ορθογώνιο → επικαλυπτόμενα ορθογώνια στεφάνια ανά σκέλος.
      // Μη-rectilinear (N-gon polygon, διαγώνιο composite) → decomposition `[]` →
      // fallback στο outline-driven στεφάνι.
      const rects = decomposeColumnSectionRects(section.outlineMm);
      return rects.length > 0
        ? buildMultiHoopLayout(r, rects, maxBarSpacingMm)
        : buildPerimeterLayoutFromOutline(r, section.outlineMm);
    }
  }
}

/** Convenience: section + dispatch από `ColumnParams` σε ένα βήμα. */
export function resolveColumnRebarLayoutForParams(
  r: ColumnReinforcement,
  params: ColumnParams,
  maxBarSpacingMm: number = MAX_RESTRAINED_BAR_SPACING_MM,
): ColumnRebarLayout | null {
  return resolveColumnRebarLayout(r, resolveColumnReinforcementSection(params), maxBarSpacingMm);
}

/**
 * Εσωτερικά συνδετήρια (cross-ties) ανά mode (SSoT):
 *   - anchors παρόντα (wall web front↔back, **ή** perimeter μη-ορθογ. ενδιάμεσες ↔
 *     αντικριστές — ADR-460 grid) → `buildTiesFromAnchors`
 *   - rectangular → `buildColumnCrossTies` (diamond/grid)
 *   - circular / perimeter χωρίς ενδιάμεσες → [] (όλες οι ράβδοι σε γωνίες/στεφάνι)
 */
export function resolveColumnCrossTies(
  layout: ColumnRebarLayout,
  section: ColumnReinforcementSection,
  r: ColumnReinforcement,
): ColumnCrossTie[] {
  const dbw = layout.stirrupDiameterMm;
  const dbL = layout.barDiameterMm;
  if (layout.crossTieAnchorsMm && layout.crossTieAnchorsMm.length > 0) {
    return buildTiesFromAnchors(layout.crossTieAnchorsMm, dbw, dbL);
  }
  if (section.kind === 'rectangular') {
    return buildColumnCrossTies(layout.longitudinalBarsMm, dbw, dbL, r.crossTiePattern);
  }
  return [];
}
