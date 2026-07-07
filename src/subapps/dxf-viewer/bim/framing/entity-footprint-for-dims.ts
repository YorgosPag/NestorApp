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
import { isColumnEntity, isBeamEntity, isWallEntity, isTextEntity, isMTextEntity, type Entity } from '../../types/entities';
import type { DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';
import { resolveMemberFootprintVertices } from '../structural/member-footprint-2d';
import { wallFootprintPolygon } from '../finishes/wall-footprint-union';
import { textBoxCornersWorld } from '../text/text-box';
import { getEntityBounds, type BoundsEntity } from '../../systems/zoom/utils/bounds-entity';
import { arcToPolyline } from '../../utils/geometry/GeometryUtils';
import { isFinitePoint } from '../../config/geometry-constants';

/** Δείγματα της σαρωμένης καμπύλης τόξου ως footprint (πυκνά αρκετά για ομαλό perp clearance). */
const ARC_FOOTPRINT_SEGMENTS = 24;

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
  // ADR-508/557 §move-clearance — TEXT/MTEXT: το attachment/rotation/MULTI-LINE-aware VISUAL box
  // (`textBoxCornersWorld` — ΤΟ ΙΔΙΟ SSoT box με grips/hover/hitTest), ώστε ένα κινούμενο κείμενο να
  // δείχνει clearance προς τους γείτονες στο ΠΡΑΓΜΑΤΙΚΟ του footprint. Το generic `getEntityBounds`
  // fallback γνώριζε ΜΟΝΟ 'text' (single-line char-count bbox) κι επέστρεφε null για 'mtext' → ένα
  // κινούμενο MTEXT δεν έδειχνε ΚΑΜΙΑ κυανή clearance dim (Giorgio 2026-07-07). ΕΝΑ SSoT καλύπτει
  // και τους δύο τύπους + περιστροφή + πολλαπλές γραμμές. Height fallback ίδιο με το hitTest
  // (`Bounds.calculateTextBounds`): height → fontSize → AutoCAD DIMTXT default.
  if (isTextEntity(entity) || isMTextEntity(entity)) {
    const src = entity as unknown as { position?: Point2D; height?: number; fontSize?: number };
    if (src.position && isFinitePoint(src.position)) {
      const dxfText: DxfText = {
        ...(entity as unknown as DxfText),
        height: src.height || src.fontSize || 2.5,
      };
      const corners = textBoxCornersWorld(dxfText);
      // Finite-guard (SSoT `isFinitePoint`): a degenerate text (no glyph metrics / bad width)
      // must NOT emit NaN corners — those poison the clearance aggregate. Fall through to the
      // generic bbox fallback below when the box is not usable.
      if (corners.length >= 3 && corners.every(isFinitePoint)) return corners;
    }
    // no position / non-finite box → fall through to the generic bbox fallback (undefined for bare text).
  }
  // ADR-508 §move-clearance — ΤΟΞΟ: η ΠΡΑΓΜΑΤΙΚΗ σαρωμένη καμπύλη (δειγματοληπτημένη), ΟΧΙ το γεμάτο
  // disc-bbox (center±r). Το bbox περιλαμβάνει τη γωνία-κέντρο (π.χ. μεντεσές πόρτας) που συχνά κάθεται
  // ΠΑΝΩ στον host τοίχο → perp-overlap → η μηχανή clearance (`pushMemberCandidate`) απορρίπτει ΟΛΟΥΣ
  // τους γείτονες ως «πολύ κοντά» → καμία κυανή dim. Η καμπύλη (χωρίς το κέντρο) δίνει το σωστό λεπτό
  // perp extent → clearance στη σαρωμένη ακμή (Revit door-swing parity). Μοιράζεται το `arcToPolyline`
  // SSoT με το arc listening-dim paint. Το κυκλικό/full arc πέφτει πάλι στο bbox παρακάτω (curve ≈ disc).
  if (entity.type === 'arc') {
    const arc = entity as unknown as { center: Point2D; radius: number; startAngle: number; endAngle: number };
    const curve = arcToPolyline(
      { center: arc.center, radius: arc.radius, startAngle: arc.startAngle, endAngle: arc.endAngle },
      ARC_FOOTPRINT_SEGMENTS,
    );
    if (curve.length >= 2) return curve;
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
