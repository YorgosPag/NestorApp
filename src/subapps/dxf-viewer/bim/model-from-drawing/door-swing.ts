/**
 * ADR-911 Φ4-2 — από τη γεωμετρία του συμβόλου στα δύο enum της πόρτας.
 *
 * Ο πυρήνας (Φ4-1) δίνει γεωμετρία: `span.start` = η πλευρά του μεντεσέ, `swing` = μοναδιαίο προς
 * την πλευρά που ανοίγει το φύλλο. Η οντότητα θέλει `handing` / `openDirection`, που ορίζονται ως
 * προς τον άξονα του ΤΕΛΙΚΟΥ ξενιστή (`buildHingeArc`, `bim/geometry/opening-geometry.ts`):
 *   · `handing: 'left'`  ⇔ μεντεσές στο ΧΑΜΗΛΟ offset του ανοίγματος·
 *   · `openDirection: 'inward'` ⇔ το φύλλο ανοίγει προς το αριστερό κάθετο του άξονα.
 *
 * Γι' αυτό υπολογίζεται ΜΕΤΑ τη γεφύρωση: ο ενωμένος τοίχος παίρνει τη φορά του πρωτεύοντος, και
 * η ίδια πόρτα γίνεται 'left' ή 'right' ανάλογα με το ποιος τοίχος της αλυσίδας είναι πρώτος.
 */

import type { Point2D } from '../../rendering/types/Types';
import { dotProduct } from '../../rendering/entities/shared/geometry-vector-utils';
import type { OpeningParams } from '../types/opening-types';
import type { WallEntity } from '../types/wall-types';
import type { OpeningSpan } from './opening-host-plan';
import { frameCoords, leftNormal, wallHostFrame } from './wall-host-frame';

export type DoorSwingParams = Required<Pick<OpeningParams, 'handing' | 'openDirection'>>;

/** `null` μόνο για εκφυλισμένο ξενιστή (μηδενικός άξονας). */
export function resolveDoorSwing(host: WallEntity, span: OpeningSpan, swing: Point2D): DoorSwingParams | null {
  // Μόνο η ΦΟΡΑ του άξονα μετρά εδώ — η κλίμακα mm↔σκηνής δεν αλλάζει κανένα πρόσημο.
  const frame = wallHostFrame(host, 1);
  if (!frame) return null;
  const hingeAlong = frameCoords(frame, span.start).along;
  const latchAlong = frameCoords(frame, span.end).along;
  return {
    handing: hingeAlong <= latchAlong ? 'left' : 'right',
    openDirection: dotProduct(swing, leftNormal(frame.u)) >= 0 ? 'inward' : 'outward',
  };
}
