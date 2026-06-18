/**
 * member-footprint-2d — SSoT για το 2D footprint (plan polygon) φέροντος μέλους
 * (ADR-490). Κοινό από τα structural overlays (utilization ADR-485, warnings ADR-490)
 * ώστε η ανάλυση «ποια κορυφή ζωγραφίζω ανά μέλος» να ζει σε ΕΝΑ σημείο.
 *
 * Κανόνας (DERIVED geometry, ADR-458): κολόνα → `geometry.footprint`· δοκάρι →
 * `geometry.displayOutline` (post-pass cutback, αν υπάρχει) αλλιώς `geometry.outline`.
 * Επιστρέφει `undefined` αν δεν υπάρχει έγκυρο πολύγωνο (≥3 κορυφές).
 *
 * Pure — zero React/DOM.
 *
 * @see ../../components/dxf-layout/StructuralUtilizationOverlay.tsx — consumer (fill)
 * @see ../../components/dxf-layout/StructuralWarningOverlay.tsx — consumer (halo+badge)
 */

import { isColumnEntity, isBeamEntity, type Entity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';

/** Πολύγωνο κάτοψης (world coords) ενός φέροντος μέλους, ή `undefined` αν δεν υπάρχει. */
export function resolveMemberFootprintVertices(entity: Entity): ReadonlyArray<Point2D> | undefined {
  let verts: ReadonlyArray<Point2D> | undefined;
  if (isColumnEntity(entity)) {
    verts = entity.geometry?.footprint?.vertices;
  } else if (isBeamEntity(entity)) {
    verts = entity.geometry?.displayOutline?.vertices ?? entity.geometry?.outline?.vertices;
  }
  return verts && verts.length >= 3 ? verts : undefined;
}

/** Κεντροειδές (centroid) ενός πολυγώνου — σημείο αγκύρωσης για badge/glyph. */
export function polygonCentroid(vertices: ReadonlyArray<Point2D>): Point2D {
  let x = 0;
  let y = 0;
  for (const v of vertices) {
    x += v.x;
    y += v.y;
  }
  return { x: x / vertices.length, y: y / vertices.length };
}
