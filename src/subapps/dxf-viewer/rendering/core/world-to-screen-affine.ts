/**
 * Κόσμος → οθόνη ως **πίνακας** (`Affine2x3`): ο τύπος του `CoordinateTransforms.worldToScreen` (κατάσταση `ready`),
 * γραμμένος μία φορά για όσους ζωγραφίζουν με `ctx.transform` αντί για σημείο-σημείο.
 *
 * 🔑 Ίδια άγκυρα με το `worldToScreen`: η κάτω-αριστερή γωνία της περιοχής σχεδίασης (`drawing-area.ts`, ADR-741). Αν
 * αποκλίνει, ό,τι ζωγραφίζεται με αυτόν «χορεύει» σε σχέση με τις οντότητες.
 *
 * Καταναλωτές: το φάντασμα μετασχηματισμού (ADR-646 Φ6) και ο ζωγράφος του υποβάθρου κάτοψης (ADR-929 Δ3).
 * Μετακόμισε εδώ από το `hooks/tools/transform-ghost-matrix.ts` (ADR-929 Φ0): ο αφινικός πυρήνας πήγε στο
 * `lib/geometry/affine-2x3`, και ό,τι εξαρτάται από την περιοχή σχεδίασης μένει δίπλα της.
 *
 * @module subapps/dxf-viewer/rendering/core/world-to-screen-affine
 */

import type { Affine2x3 } from '@/lib/geometry/affine-2x3';
import type { ViewTransform, Viewport } from '../types/Types';
import { DRAWING_AREA_CHROME, getDrawingAreaRect, type DrawingAreaChrome } from './drawing-area';

/**
 * Το `chrome` δίνεται μόνο από όποιον το **ενίει** (το υπόβαθρο: `CadCoordinateAdaptation.chrome`)· προεπιλογή το SSoT
 * `DRAWING_AREA_CHROME`.
 */
export function worldToScreenAffine(
  transform: ViewTransform,
  viewport: Viewport,
  chrome: DrawingAreaChrome = DRAWING_AREA_CHROME,
): Affine2x3 {
  const area = getDrawingAreaRect(viewport, chrome);
  return {
    a: transform.scale, b: 0, c: 0, d: -transform.scale,
    e: area.x + transform.offsetX,
    f: area.bottom - transform.offsetY,
  };
}
