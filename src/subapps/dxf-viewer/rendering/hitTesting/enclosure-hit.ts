/**
 * ENCLOSURE HIT-TEST (SSoT) — «είναι το σημείο ΜΕΣΑ σε κλειστή περιοχή;».
 *
 * Ξεχωριστό ερώτημα από τον stroke hit-test (`performDetailedHitTest` → «είναι ο κέρσορας ΠΑΝΩ
 * στη γεωμετρία;»). Οι μεγάλοι παίκτες (Revit / ArchiCAD / Figma / AutoCAD) κρατούν τα δύο
 * χωριστά: τα **wireframe** κλειστά σχήματα επιλέγονται από το **περίγραμμα** (stroke-only), και
 * το «κλικ ΜΕΣΑ» είναι **ρητή** δυνατότητα που ζητά μόνο όποιο εργαλείο τη χρειάζεται (π.χ. η
 * επιλογή ορίου οικοπέδου, ADR-650 M6). Έτσι ένα πλέγμα ομόκεντρων ισοϋψών ΔΕΝ «καταπίνεται» από
 * τον εξωτερικό κύκλο (ο παλιός fill fallback στο `hitTestPolyline`).
 *
 * Δεν καλύπτει τα γνήσια filled entities (hatch / image / BIM solids) — αυτά έχουν ήδη δικό τους
 * fill hit-test στο `hit-test-entity-tests`· εδώ μόνο η γενική κλειστή πολυγραμμή.
 *
 * @see ./pick-top-entity-at — `pickTopEntityAt(..., { includeEnclosure })` (ο καταναλωτής: stroke Ή enclosure)
 * @see ./hit-test-entity-tests — `hitTestPolyline` (stroke-only πλέον)
 */

import type { Point2D } from '../types/Types';
import type { Entity } from '../../types/entities';
import { isPolylineEntity, isLWPolylineEntity } from '../../types/entities';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';

/**
 * `true` όταν το `point` βρίσκεται ΜΕΣΑ στο κλειστό σώμα ενός polyline/lwpolyline (≥3 κορυφές).
 * Ό,τι δεν είναι κλειστή πολυγραμμή δεν έχει «μέσα» → `false` (ίδιο συμβόλαιο με το boundary pick).
 */
export function isPointInsideClosedEntity(entity: Entity, point: Point2D): boolean {
  if (!isPolylineEntity(entity) && !isLWPolylineEntity(entity)) return false;
  if (entity.closed !== true || entity.vertices.length < 3) return false;
  return isPointInPolygon(point, entity.vertices);
}
