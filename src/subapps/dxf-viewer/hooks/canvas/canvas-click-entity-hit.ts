/**
 * 🏢 ENTERPRISE: Canvas click entity hit-testing helpers
 *
 * @description Pure geometric hit-testing used by the rotation tool's
 * entity-selection phase (PRIORITY 1.3 in `useCanvasClickHandler`). Extracted
 * from `useCanvasClickHandler.ts` to keep that hook under the 500-line limit
 * (N.7.1) — no behaviour change, the functions are byte-identical to their
 * previous in-file definitions.
 *
 * @see ADR-188: Rotation tool entity selection
 */
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import {
  isLineEntity, isPolylineEntity, isLWPolylineEntity,
  isArcEntity, isCircleEntity, isRectangleEntity, isRectEntity,
  isTextEntity, isMTextEntity, isEllipseEntity,
} from '../../types/entities';
import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
import { pointToArcDistance } from '../../utils/angle-entity-math';
import { resolveEntityText } from '../../utils/text-node-utils';
// ADR-737 §18 — SSoT ύψους χαρακτήρα. Το inline `height ?? fontSize ?? 2.5` που ήταν εδώ
// (α) αγνοούσε το run του `textNode` και (β) στο MTEXT διάβαζε το ύψος ΠΛΑΙΣΙΟΥ.
// Λεξιλόγιο μεγέθους: το κουτί χτυπήματος πρέπει να μιλά την ΙΔΙΑ γλώσσα με τα γράμματα που
// βλέπει ο χρήστης — αλλιώς σε 1:200 το κείμενο διπλασιάζεται και το κλικ ψάχνει το μισό.
import { resolveTextHeightLive } from './dxf-text-style-extractor';
// ADR-089 — SSoT point-in-bounds· ADR-737 §18 — SSoT εκτίμησης πλάτους (ίδια αναλογία 0.6
// που ήταν γραμμένη inline εδώ δύο φορές).
import { SpatialUtils } from '../../core/spatial/SpatialUtils';
import { estimateTextWidth } from '../../config/text-rendering-config';

/**
 * Tests if a world point hits any entity type. Returns true if hit.
 * Supports: LINE, ARC, CIRCLE, POLYLINE, LWPOLYLINE, RECTANGLE, ELLIPSE, TEXT, MTEXT.
 */
export function testEntityHit(
  worldPoint: Point2D,
  entity: Entity,
  hitTolerance: number,
): boolean {
  if (isLineEntity(entity)) {
    return pointToLineDistance(worldPoint, entity.start, entity.end) <= hitTolerance;
  }
  if (isArcEntity(entity)) {
    return pointToArcDistance(worldPoint, entity) <= hitTolerance;
  }
  if (isCircleEntity(entity)) {
    const dx = worldPoint.x - entity.center.x;
    const dy = worldPoint.y - entity.center.y;
    const distFromCenter = Math.sqrt(dx * dx + dy * dy);
    return Math.abs(distFromCenter - entity.radius) <= hitTolerance;
  }
  if (isPolylineEntity(entity)) {
    return testPolylineHit(worldPoint, entity.vertices, entity.closed, hitTolerance);
  }
  if (isLWPolylineEntity(entity)) {
    return testPolylineHit(worldPoint, entity.vertices, entity.closed, hitTolerance);
  }
  if (isRectangleEntity(entity) || isRectEntity(entity)) {
    const { x, y, width: w, height: h } = entity;
    const corners = [
      { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h },
    ];
    for (let i = 0; i < 4; i++) {
      if (pointToLineDistance(worldPoint, corners[i], corners[(i + 1) % 4]) <= hitTolerance) {
        return true;
      }
    }
    return false;
  }
  if (isEllipseEntity(entity)) {
    const dx = worldPoint.x - entity.center.x;
    const dy = worldPoint.y - entity.center.y;
    const rx = entity.majorAxis;
    const ry = entity.minorAxis;
    const normalizedDist = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
    return Math.abs(normalizedDist - 1) <= hitTolerance / Math.min(rx, ry);
  }
  if (isTextEntity(entity)) {
    const height = resolveTextHeightLive(entity);
    return testTextBoxHit(worldPoint, entity, estimateTextWidth(resolveEntityText(entity), height), height, hitTolerance);
  }
  if (isMTextEntity(entity)) {
    // ADR-737 §18 — ΟΧΙ `entity.definedHeight`: αυτό είναι το ύψος του πλαισίου. Το hit-test
    // θέλει ύψος ΧΑΡΑΚΤΗΡΑ, που είναι άλλο μέγεθος (πριν τα δύο μοιράζονταν το όνομα `height`
    // και εδώ διαβαζόταν σιωπηλά το λάθος).
    const height = resolveTextHeightLive(entity);
    // Το ρητό πλάτος στήλης του MTEXT υπερισχύει· `||` όχι `??` — πλάτος 0 σημαίνει
    // «χωρίς αναδίπλωση», δηλαδή πέφτουμε στην εκτίμηση από το κείμενο.
    const width = entity.width || estimateTextWidth(resolveEntityText(entity), height);
    return testTextBoxHit(worldPoint, entity, width, height, hitTolerance);
  }
  return false;
}

/**
 * ADR-737 §18 — ΕΝΑ κουτί χτυπήματος κειμένου, για TEXT **και** MTEXT.
 *
 * Ήταν γραμμένο **δύο φορές** ολόκληρο (4 συγκρίσεις × 2 κλάδοι) και οι δύο εκδοχές ήταν ήδη
 * ταυτόσημες — το CHECK 3.28 το είδε μόλις η μετονομασία `height`→`definedHeight` ισοπέδωσε
 * και την τελευταία διαφορά τους. Ό,τι διαφέρει πραγματικά (πώς βγαίνει το πλάτος) μένει
 * στον καλούντα· ό,τι είναι κοινό (η γεωμετρία του κουτιού) ζει εδώ.
 *
 * Το κουτί κρέμεται **κάτω** από το `position` (`minY = y - height`), γιατί το σημείο
 * εισαγωγής του DXF TEXT είναι στη γραμμή βάσης — δεν είναι top-left κουτί UI.
 */
function testTextBoxHit(
  worldPoint: Point2D,
  entity: { position: Point2D },
  width: number,
  height: number,
  hitTolerance: number,
): boolean {
  // ADR-089 — ο κανονικός point-in-bounds· εδώ δίνουμε μόνο το κουτί, διογκωμένο κατά την ανοχή.
  return SpatialUtils.pointInBounds(worldPoint, {
    minX: entity.position.x - hitTolerance,
    maxX: entity.position.x + width + hitTolerance,
    minY: entity.position.y - height - hitTolerance,
    maxY: entity.position.y + hitTolerance,
  });
}

/** Helper: Test if point hits a polyline (vertices + optional closed) */
export function testPolylineHit(
  worldPoint: Point2D,
  vertices: ReadonlyArray<{ x: number; y: number }> | undefined,
  closed: boolean | undefined,
  hitTolerance: number,
): boolean {
  if (!vertices || vertices.length < 2) return false;
  for (let i = 0; i < vertices.length - 1; i++) {
    if (pointToLineDistance(worldPoint, vertices[i], vertices[i + 1]) <= hitTolerance) {
      return true;
    }
  }
  if (closed && vertices.length > 2) {
    if (pointToLineDistance(worldPoint, vertices[vertices.length - 1], vertices[0]) <= hitTolerance) {
      return true;
    }
  }
  return false;
}
