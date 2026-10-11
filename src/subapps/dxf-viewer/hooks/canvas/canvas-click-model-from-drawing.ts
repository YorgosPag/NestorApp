/**
 * ADR-911 Φ3β — το **κλικ-δείγμα** του βοηθού «Μοντέλο από το σχέδιο» (Δ1): όσο ο βοηθός είναι
 * οπλισμένος, ΕΝΑ κλικ δείχνει τη γραμμή που είναι «τοίχος».
 *
 * Ζει σε δικό του module (ίδιο idiom με `canvas-click-pick-base-point.ts`) — το wiring μένει ΕΝΑΣ
 * κλάδος στο `useCanvasClickHandler`. Ο καμβάς ΜΟΝΟ αφήνει το σημείο κόσμου στο store της
 * συνεδρίας· δεν διαβάζει σκηνή ούτε στρώσεις. Την υιοθέτηση (γραμμή → χρώμα → πρόταση) την κάνει
 * ο host, που έχει και τα δύο. Πάντα consume όσο είναι οπλισμένος (το gating γίνεται από τον
 * caller μέσω `isModelFromDrawingPicking`), ώστε το κλικ να ΜΗΝ πέσει σε grips/σχεδίαση/επιλογή.
 *
 * @see ../../systems/model-from-drawing/model-from-drawing-store.ts — captureModelFromDrawingSample
 * @see ../../app/ModelFromDrawingHost.tsx — ο host που υιοθετεί το δείγμα
 */

import type { Point2D } from '../../rendering/types/Types';
import { captureModelFromDrawingSample } from '../../systems/model-from-drawing/model-from-drawing-store';

/** Αφήνει το σημείο κόσμου ως δείγμα. Πάντα consume το κλικ. */
export function handleModelFromDrawingSampleClick(worldPoint: Point2D): boolean {
  captureModelFromDrawingSample(worldPoint);
  return true;
}
