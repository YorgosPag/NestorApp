/**
 * USE PARALLEL GUIDE ANCHOR PREVIEW — δυναμική διακεκομμένη «οδηγός → κέρσορας»
 *
 * ADR-189 §3.13: μόλις το κλικ ορίσει τον οδηγό αναφοράς, ένα κόκκινο ＋ καρφώνεται
 * ΠΑΝΩ στη γραμμή του (στην προβολή του κλικ) και μια χρυσή διακεκομμένη το ενώνει
 * με τον κέρσορα, ζωντανά, μέχρι το Enter.
 *
 * ΜΗΔΕΝ νέος κώδικας ζωγραφικής: καλεί ΑΥΤΟΥΣΙΟΥΣ τους δύο painters που χρησιμοποιεί
 * το εργαλείο «Μετακίνηση» (ADR-049) — `drawMoveBasePointMarker` + `drawRubberBandLine`.
 * Η οπτική ταυτότητα με το Move είναι εγγυημένη από ΚΟΙΝΟ ΚΩΔΙΚΑ, όχι από ταιριασμένες
 * τιμές· γι' αυτό εδώ μέσα ΔΕΝ επιτρέπεται κανένα χρώμα / `setLineDash` / `lineWidth`.
 *
 * ADR-398 §4: RAF lifecycle, DPR-clear, clear-on-exit και ο ζωντανός κέρσορας ζουν
 * στο `useCanvasGhostPreview` — εδώ μένει ΜΟΝΟ η draw logic.
 *
 * @module hooks/tools/useParallelGuideAnchorPreview
 */

import { useCallback } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
// ADR-049 — κόκκινο ＋ (world-space· προβάλλει μόνο του) + χρυσή διακεκομμένη (screen-space).
import { drawMoveBasePointMarker } from '../../rendering/ui/move-base-point-marker';
import { drawRubberBandLine } from '../../canvas-v2/preview-canvas/rubber-band-paint';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

export interface UseParallelGuideAnchorPreviewProps {
  /** Το παγωμένο σημείο πάνω στον οδηγό· `null` ⇒ καμία ενεργή χειρονομία. */
  anchor: Point2D | null;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

export function useParallelGuideAnchorPreview(props: UseParallelGuideAnchorPreviewProps): void {
  const { anchor, transform, getCanvas, getViewportElement } = props;

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    if (!anchor) return;

    // ΠΡΙΝ το gate του κέρσορα — καθρεφτίζει `useMovePreview` (:113 vs :115). Αλλιώς
    // το ＋ τρεμοπαίζει στα frames που το store δεν έχει ακόμη θέση κέρσορα.
    drawMoveBasePointMarker(ctx, anchor, t, viewport);
    if (!effectiveCursor) return;

    drawRubberBandLine(
      ctx,
      CoordinateTransforms.worldToScreen(anchor, t, viewport),
      CoordinateTransforms.worldToScreen(effectiveCursor, t, viewport),
    );
  }, [anchor]);

  // `useImmediateSnap` σκόπιμα ΑΘΙΚΤΟ (default `false`): ο sign resolver του commit
  // διαβάζει τον ΩΜΟ `getRealtimeWorldCursor()`. Αν εδώ ζωγραφίζαμε snapped κέρσορα,
  // η γραμμή θα έδειχνε άλλη πλευρά από αυτήν που θα τοποθετούσε το Enter.
  useCanvasGhostPreview({
    isActive: anchor !== null,
    getCanvas,
    getViewportElement,
    transform,
    draw,
  });
}
