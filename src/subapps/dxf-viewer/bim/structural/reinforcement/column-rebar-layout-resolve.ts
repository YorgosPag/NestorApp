/**
 * Column rebar layout DISPATCHER — SSoT entry (ADR-460 — Multi-shape, Slice 2).
 *
 * ΕΝΑ σημείο που επιλέγει τη σωστή layout engine ανά detailing mode:
 *   - `perimeter` ορθογ. → rect fast-path `computeColumnRebarLayout` (μηδέν regression)
 *   - `perimeter` άλλο   → `buildPerimeterLayoutFromOutline` (outline-driven)
 *   - `circular`         → `buildCircularLayout`
 *   - `wall`             → `buildWallLayout` (boundary elements + web)
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
import { computeColumnRebarLayout, type ColumnRebarLayout } from './column-rebar-layout';
import { buildPerimeterLayoutFromOutline } from './column-perimeter-layout';
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
 */
export function resolveColumnRebarLayout(
  r: ColumnReinforcement,
  section: ColumnReinforcementSection,
): ColumnRebarLayout | null {
  switch (section.mode) {
    case 'circular':
      return buildCircularLayout(r, section.diameterMm ?? section.bboxWidthMm);
    case 'wall':
      return buildWallLayout(r, section);
    case 'perimeter':
    default:
      return section.kind === 'rectangular'
        ? computeColumnRebarLayout(r, section.bboxWidthMm, section.bboxDepthMm)
        : buildPerimeterLayoutFromOutline(r, section.outlineMm);
  }
}

/** Convenience: section + dispatch από `ColumnParams` σε ένα βήμα. */
export function resolveColumnRebarLayoutForParams(
  r: ColumnReinforcement,
  params: ColumnParams,
): ColumnRebarLayout | null {
  return resolveColumnRebarLayout(r, resolveColumnReinforcementSection(params));
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
