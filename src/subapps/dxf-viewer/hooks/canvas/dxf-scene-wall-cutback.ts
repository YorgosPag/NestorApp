/**
 * ADR-458 — Wall-to-column **cutback** scene post-pass (2Δ κάτοψη). Αδελφό του
 * `dxf-scene-beam-cutback.ts` — ίδιο pattern, ίδιο generic SSoT (`member-column-cutback`).
 *
 * Cross-element pass πάνω στο ΗΔΗ converted `DxfEntityUnion[]` (μετά το per-entity WeakMap
 * cache του `useDxfSceneConversion`): για κάθε τοίχο που τέμνεται από κολόνα, θέτει το
 * DERIVED `geometry.displayFootprint` (footprint ring κομμένο στις παρειές των κολωνών, «η
 * κολόνα νικάει» → η κολόνα μένει διακριτό box, ο τοίχος σταματά στην παρειά). Ο
 * `WallRenderer` διαβάζει `displayFootprint ?? outer+inner ring` → ίδια γεωμετρία σε bitmap
 * pass ΚΑΙ interactive overlay (ένα entity, μία αλήθεια).
 *
 * Γιατί post-pass (όχι μέσα στο `convertEntity`): το cut εξαρτάται από ΑΛΛΑ entities (τις
 * κολόνες) → δεν χωράει στο per-entity cache (κλειδώνει στο wall ref· κολόνα κινείται, wall
 * ref ίδιο → stale). Το post-pass τρέχει σε κάθε scene-memo (νέο ref όταν αλλάζει κολόνα) →
 * πάντα fresh. DERIVED, ΠΟΤΕ persisted.
 *
 * Zero-cost fast path: χωρίς κολόνες Ή χωρίς τοίχους → επιστρέφει το input ΑΥΤΟΥΣΙΟ (ίδιο
 * reference). Μόνο οι τοίχοι που πραγματικά κόβονται γίνονται νέα objects → μηδέν περιττό churn.
 *
 * @see bim/geometry/member-column-cutback.ts — pure generic SSoT
 * @see hooks/canvas/dxf-scene-beam-cutback.ts — sibling (beam)
 * @see bim/renderers/WallRenderer.ts — displayFootprint consumer
 */

import type { DxfEntityUnion, DxfWall } from '../../canvas-v2/dxf-canvas/dxf-types';
// ADR-911 Φ3α-4 — το βήμα «κόψιμο από κολώνες» ζει στο ΕΝΑ SSoT του ζωγραφισμένου σώματος
// (κοινό με την προεπισκόπηση πλήρωσης)· εδώ μένει μόνο η εφαρμογή του πάνω στη σκηνή.
import { cutWallBodyByColumns } from '../../bim/walls/wall-painted-body';
import { scanColumnCutters } from './dxf-scene-column-cutters';

/**
 * Εφαρμόζει το wall-to-column cutback στους τοίχους του DxfScene. Επιστρέφει το ίδιο array
 * (by-reference) όταν δεν υπάρχει τομή να υπολογιστεί· αλλιώς νέο array με τους κομμένους
 * τοίχους ανανεωμένους (υπόλοιπα entities by-reference).
 */
export function applyWallColumnCutback2D(entities: DxfEntityUnion[]): DxfEntityUnion[] {
  const { columnFootprints, hasMember: hasWall } = scanColumnCutters(entities, 'wall');
  if (!hasWall || columnFootprints.length === 0) return entities;

  return entities.map((e) => {
    if (e.type !== 'wall') return e;
    const wall = e as DxfWall;
    const pieces = cutWallBodyByColumns(wall, columnFootprints);
    if (pieces === null) return e; // καμία τομή → αυτούσιο (zero regression)
    const displayFootprint = pieces;
    return {
      ...wall,
      geometry: { ...wall.geometry, displayFootprint } } as DxfEntityUnion;
  });
}
