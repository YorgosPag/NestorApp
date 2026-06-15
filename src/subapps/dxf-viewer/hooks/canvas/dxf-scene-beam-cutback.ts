/**
 * ADR-458 — Beam-to-column **cutback** scene post-pass (2Δ κάτοψη).
 *
 * Cross-element pass πάνω στο ΗΔΗ converted `DxfEntityUnion[]` (μετά το per-entity
 * WeakMap cache του `useDxfSceneConversion`): για κάθε δοκάρι που τέμνει κολόνα, θέτει
 * το DERIVED `geometry.displayOutline` (κομμένο στις παρειές των κολωνών, «η κολόνα
 * νικάει»). Ο `BeamRenderer` διαβάζει `displayOutline ?? outline` → ίδια γεωμετρία σε
 * bitmap pass, interactive overlay ΚΑΙ hit-test (ένα entity, μία αλήθεια).
 *
 * Γιατί post-pass (όχι μέσα στο `convertEntity`): το trim εξαρτάται από ΑΛΛΑ entities
 * (τις κολόνες) → δεν χωράει στο per-entity cache (που κλειδώνει στο beam ref· κολόνα
 * κινείται, beam ref ίδιο → stale). Το post-pass τρέχει σε κάθε scene-memo (νέο scene
 * ref όταν αλλάζει κολόνα) → πάντα fresh. DERIVED, ΠΟΤΕ persisted.
 *
 * Zero-cost fast path: χωρίς κολόνες Ή χωρίς δοκάρια → επιστρέφει το input ΑΥΤΟΥΣΙΟ
 * (ίδιο reference). Μόνο τα δοκάρια που πραγματικά κόβονται γίνονται νέα objects → μηδέν
 * περιττό churn referential stability.
 *
 * @see bim/geometry/beam-column-cutback.ts — pure SSoT
 * @see bim/renderers/BeamRenderer.ts — displayOutline ?? outline consumer
 */

import type { DxfEntityUnion, DxfBeam, DxfColumn } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Point3D } from '../../bim/types/bim-base';
import { computeBeamCutbackOutline } from '../../bim/geometry/beam-column-cutback';

/**
 * Εφαρμόζει το beam-to-column cutback στα δοκάρια του DxfScene. Επιστρέφει το ίδιο array
 * (by-reference) όταν δεν υπάρχει τομή να υπολογιστεί· αλλιώς νέο array με τα κομμένα
 * δοκάρια ανανεωμένα (υπόλοιπα entities by-reference).
 */
export function applyBeamColumnCutback2D(entities: DxfEntityUnion[]): DxfEntityUnion[] {
  let hasBeam = false;
  const columnFootprints: Point3D[][] = [];
  for (const e of entities) {
    if (e.type === 'beam') hasBeam = true;
    else if (e.type === 'column') {
      const verts = (e as DxfColumn).geometry?.footprint?.vertices;
      if (verts && verts.length >= 3) columnFootprints.push(verts.map((v) => ({ x: v.x, y: v.y, z: 0 })));
    }
  }
  if (!hasBeam || columnFootprints.length === 0) return entities;

  return entities.map((e) => {
    if (e.type !== 'beam') return e;
    const beam = e as DxfBeam;
    const outline = beam.geometry?.outline?.vertices;
    if (!outline || outline.length < 3) return e;
    const pieces = computeBeamCutbackOutline(
      outline.map((v) => ({ x: v.x, y: v.y })),
      columnFootprints,
    );
    if (pieces === null) return e; // καμία τομή → αυτούσιο (zero regression)
    const displayOutline: Point3D[][] = pieces.map((ring) => ring.map((p) => ({ x: p.x, y: p.y, z: 0 })));
    return { ...beam, geometry: { ...beam.geometry, displayOutline } } as DxfEntityUnion;
  });
}
