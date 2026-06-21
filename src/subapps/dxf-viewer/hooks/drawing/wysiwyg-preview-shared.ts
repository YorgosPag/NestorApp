/**
 * @module wysiwyg-preview-shared
 * @description SSoT για τα κοινά glue μοτίβα **όλων** των WYSIWYG placement previews
 * (δοκάρι / τοίχος / θεμελίωση / κολώνα). Πριν, κάθε `*-preview-helpers.ts` αντέγραφε:
 *   1. το «snapped-or-raw cursor» read (`getImmediateSnap()` με fallback)·
 *   2. το «flag εντότητα ως WYSIWYG ghost» wrapper (`preview`+`wysiwygPreview`+status).
 * Πλέον ζουν ΜΙΑ φορά εδώ — μηδέν διπλότυπο (N.0.2 / SSoT).
 *
 * @see ./beam-preview-helpers.ts · ./foundation-preview-helpers.ts · ./column-preview-helpers.ts — consumers
 * @see ../../canvas-v2/preview-canvas/bim-preview-render.ts — ρεντάρει το flagged entity με τον πραγματικό renderer
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.8
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ExtendedSceneEntity } from './drawing-types';
import type { GhostStatusColor } from '../../bim/ghosts/ghost-status-color';
import { getImmediateSnap } from '../../systems/cursor/ImmediateSnapStore';

/**
 * Το σημείο στο οποίο κουμπώνει το ghost = **ΑΚΡΙΒΩΣ** το σημείο που χρησιμοποιεί το
 * commit. Ο `snap-scheduler` γράφει το face/corner/grid snapped point στο `ImmediateSnap`
 * στο ίδιο move· εδώ διαβάζεται imperatively (zero React, ADR-040). Fallback στον raw
 * cursor όταν δεν υπάρχει armed snap → ο άξονας του ghost ταυτίζεται με το σταυρόνημα.
 */
export function resolveEffectivePreviewCursor(cursorPoint: Readonly<Point2D>): Point2D {
  const snap = getImmediateSnap();
  return snap?.found === true && snap.point != null
    ? { x: snap.point.x, y: snap.point.y }
    : { x: cursorPoint.x, y: cursorPoint.y };
}

/**
 * Flag μια φρεσκο-χτισμένη BIM εντότητα ως **WYSIWYG placement ghost**: ο PreviewCanvas
 * (`BimPreviewRenderer`) τη ρεντάρει μέσω του ΠΡΑΓΜΑΤΙΚΟΥ renderer (full fidelity).
 * Optional `ghostStatusColor` (🔴 overlap) → ο `PreviewRenderer` ζωγραφίζει status schematic
 * αντί WYSIWYG (ADR-398 §3.6 red-only). Generic ώστε να δέχεται κάθε `*Entity` + display-modified
 * παραλλαγές (π.χ. beam cutback) χωρίς `any`.
 */
export function toWysiwygPreviewEntity<T extends object>(
  entity: T,
  id: string,
  ghostStatusColor?: GhostStatusColor | null,
): ExtendedSceneEntity {
  return {
    ...entity,
    id,
    preview: true,
    wysiwygPreview: true,
    ...(ghostStatusColor ? { ghostStatusColor } : {}),
  } as unknown as ExtendedSceneEntity;
}
