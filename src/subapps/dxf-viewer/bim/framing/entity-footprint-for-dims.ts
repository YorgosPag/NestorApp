/**
 * entity-footprint-for-dims — SSoT: 2D plan footprint ενός entity για τις κυανές listening /
 * neighbor-clearance dimensions (ADR-508 §neighbor-clearance) στη ΜΕΤΑΚΙΝΗΣΗ. Γενικεύει το
 * `resolveMemberFootprintVertices` (μόνο κολόνα/δοκός) ώστε να καλύπτει ΟΛΑ τα footprint-έχοντα
 * στοιχεία που μετακινούνται.
 *
 * Reuse (ΜΗΔΕΝ νέα γεωμετρία):
 *   · κολόνα / δοκός → `resolveMemberFootprintVertices` (`member-footprint-2d`)
 *   · τοίχος → `wallFootprintPolygon` (`wall-footprint-union`, raw+mitered union)
 *
 * Επιστρέφει `undefined` για ό,τι δεν έχει footprint με νόημα (απλή γραμμή/κύκλος μηδενικού
 * πλάτους → η παρειά-προς-παρειά clearance δεν ορίζεται) → ο caller απλώς δεν δείχνει dims
 * (no-op, ασφαλές). Απλές γραμμές = follow-up (bbox) αν χρειαστεί.
 *
 * Pure — zero React/DOM.
 *
 * @see ./neighbor-clearance-dims.ts — ο consumer (resolveNeighborClearanceDims)
 * @see ../structural/member-footprint-2d.ts — κολόνα/δοκός footprint SSoT
 * @see ../finishes/wall-footprint-union.ts — τοίχος footprint SSoT
 */

import type { Point2D } from '../../rendering/types/Types';
import { isColumnEntity, isBeamEntity, isWallEntity, type Entity } from '../../types/entities';
import { resolveMemberFootprintVertices } from '../structural/member-footprint-2d';
import { wallFootprintPolygon } from '../finishes/wall-footprint-union';
import { getEntityBounds, type BoundsEntity } from '../../systems/zoom/utils/bounds-entity';

/** Plan footprint (world/scene coords) του entity για clearance dims, ή `undefined` αν δεν ορίζεται. */
export function resolveEntityFootprintForDims(entity: Entity): ReadonlyArray<Point2D> | undefined {
  // Δομικά με ακριβές plan polygon (παρειές): κολόνα/δοκός → member footprint, τοίχος → wall footprint.
  if (isColumnEntity(entity) || isBeamEntity(entity)) {
    return resolveMemberFootprintVertices(entity);
  }
  if (isWallEntity(entity)) {
    // WallEntity ⊇ WallFinishObstacle ({id, kind, params}) — μηδέν cast, structural.
    const fp = wallFootprintPolygon({ id: entity.id, kind: entity.kind, params: entity.params });
    if (fp.length >= 3) return fp;
  }
  // Γενικό fallback (Giorgio: «οποιαδήποτε οντότητα BIM ή DXF»): axis-aligned bounding box ως footprint
  // — γραμμή/πολυγραμμή/ορθογώνιο/κύκλος/τόξο + λοιπά. Προσέγγιση αρκετή για clearance dims (bbox παρειές).
  const b = getEntityBounds(entity as unknown as BoundsEntity);
  if (!b) return undefined;
  const { min, max } = b;
  if (max.x - min.x < 1e-6 && max.y - min.y < 1e-6) return undefined; // degenerate σημείο → άκυρο
  return [
    { x: min.x, y: min.y }, { x: max.x, y: min.y },
    { x: max.x, y: max.y }, { x: min.x, y: max.y },
  ];
}
