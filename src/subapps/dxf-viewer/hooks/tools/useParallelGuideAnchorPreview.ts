/**
 * USE PARALLEL GUIDE ANCHOR PREVIEW — δυναμική διακεκομμένη «οδηγός → κέρσορας»
 *
 * ADR-189 §3.13: μόλις το κλικ ορίσει τον οδηγό αναφοράς, ένα κόκκινο ＋ καρφώνεται
 * ΠΑΝΩ στη γραμμή του (στην προβολή του κλικ) και μια χρυσή διακεκομμένη το ενώνει
 * με τον κέρσορα, ζωντανά, μέχρι το Enter.
 *
 * ΜΗΔΕΝ νέος κώδικας ζωγραφικής: καλεί ΑΥΤΟΥΣΙΟΥΣ τους painters που χρησιμοποιούν ήδη
 * τα άλλα εργαλεία — `drawMoveBasePointMarker` + `drawRubberBandLine` (εργαλείο
 * «Μετακίνηση», ADR-049) και `paintTooltip` (το λευκό νούμερο απόστασης του Object
 * Snap Tracking, ADR-357 Φ4 — το ΙΔΙΟ που δείχνει η περιστροφή δίπλα στη δική της
 * διακεκομμένη). Η οπτική ταυτότητα είναι εγγυημένη από ΚΟΙΝΟ ΚΩΔΙΚΑ, όχι από
 * ταιριασμένες τιμές· γι' αυτό εδώ μέσα ΔΕΝ επιτρέπεται κανένα χρώμα / `setLineDash` /
 * `lineWidth` / `font` (source-level φρουρός στο test).
 *
 * ADR-398 §4: RAF lifecycle, DPR-clear, clear-on-exit και ο ζωντανός κέρσορας ζουν
 * στο `useCanvasGhostPreview` — εδώ μένει ΜΟΝΟ η draw logic.
 *
 * @module hooks/tools/useParallelGuideAnchorPreview
 */

import { useCallback } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { Guide } from '../../systems/guides/guide-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
// ADR-049 — κόκκινο ＋ (world-space· προβάλλει μόνο του) + χρυσή διακεκομμένη (screen-space).
import { drawMoveBasePointMarker } from '../../rendering/ui/move-base-point-marker';
import { drawRubberBandLine } from '../../canvas-v2/preview-canvas/rubber-band-paint';
// ADR-357 Φ4 — το ΚΟΙΝΟ λευκό νούμερο δίπλα στον κέρσορα (ίδιο SSoT με το distance
// tooltip του tracking και του `rotation-tracking-overlay`)· μηδέν νέος κώδικας κειμένου.
import { paintTooltip } from '../../canvas-v2/preview-canvas/tracking-paint';
import { getCurrentTrackingPalette } from '../../canvas-v2/preview-canvas/tracking-colors';
import { fromTransform } from '../../canvas-v2/preview-canvas/overlay-projector';
import { formatLengthForDisplay } from '../../config/display-length-format';
import { immediateSceneScale } from '../../systems/cursor/ImmediateSceneScaleStore';
import { isLengthAngleHudVisible } from '../../systems/constraints/length-angle-hud-gate';
import {
  resolveParallelCursor,
  readParallelCursorToggles,
  type ParallelCursorResolution,
} from '../../systems/guides/guide-parallel-cursor';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

export interface UseParallelGuideAnchorPreviewProps {
  /** Το παγωμένο σημείο πάνω στον οδηγό· `null` ⇒ καμία ενεργή χειρονομία. */
  anchor: Point2D | null;
  /**
   * Ο παγωμένος οδηγός αναφοράς (ADR-189 §3.13) — ο mount τον διαβάζει από το
   * `useCanvasNumericRefGuide()`, ώστε το hook να μένει καθαρό από store subscriptions.
   * `null` ⇒ δεν υπάρχει περιορισμός· η γραμμή πέφτει πίσω στον ωμό κέρσορα.
   */
  refGuide: Guide | null;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

/**
 * Το λευκό HUD μήκους στο άκρο της διακεκομμένης. Η τιμή είναι το **ΜΗΚΟΣ ΤΗΣ ΓΡΑΜΜΗΣ**
 * (`lineLength`, ρητή επιλογή του χρήστη) — ΟΧΙ η κάθετη απόσταση· με ΟΡΘΟ ON τα δύο
 * ταυτίζονται, με ΟΡΘΟ OFF σε διαγώνιο οδηγό αποκλίνουν (αποδεκτό, τεκμηριωμένο).
 *
 * scene units → mm μέσω του event-time `immediateSceneScale` (ΙΔΙΑ πηγή με το
 * `guide-parallel-cursor`), μορφοποίηση μέσω του κεντρικού `formatLengthForDisplay`
 * → ακολουθεί ζωντανά τον επιλογέα μονάδας της status bar (N.11-clean: μηδέν literal).
 */
function paintLengthHud(
  ctx: CanvasRenderingContext2D,
  resolution: ParallelCursorResolution,
  frame: Pick<GhostDrawFrame, 'viewport' | 'transform'>,
): void {
  const lengthMm = resolution.lineLength / Math.max(immediateSceneScale.getMmToScene(), 1e-9);
  paintTooltip(
    ctx,
    resolution.point,
    formatLengthForDisplay(lengthMm),
    fromTransform(frame.transform, frame.viewport),
    getCurrentTrackingPalette(),
  );
}

export function useParallelGuideAnchorPreview(props: UseParallelGuideAnchorPreviewProps): void {
  const { anchor, refGuide, transform, getCanvas, getViewportElement } = props;

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    if (!anchor) return;

    // ΠΡΙΝ το gate του κέρσορα — καθρεφτίζει `useMovePreview` (:113 vs :115). Αλλιώς
    // το ＋ τρεμοπαίζει στα frames που το store δεν έχει ακόμη θέση κέρσορα.
    drawMoveBasePointMarker(ctx, anchor, t, viewport);
    if (!effectiveCursor) return;

    // ΤΟ ΕΝΑ περιορισμένο σημείο: ΟΡΘΟ (κάθετα ΣΤΟΝ ΟΔΗΓΟ) + ΒΗΜΑ (F9), από το SSoT που
    // διαβάζουν ΚΑΙ τα δύο commit paths (Enter + δεύτερο κλικ) → preview ≡ commit.
    // Οι διακόπτες διαβάζονται EVENT-TIME (ADR-040 κανόνας 2): snapshot σε dependency
    // array θα κόλλαγε τη γραμμή στην παλιά τιμή του F8/F9.
    const resolution = refGuide
      ? resolveParallelCursor(refGuide, anchor, effectiveCursor, readParallelCursorToggles())
      : null;
    const tip = resolution ? resolution.point : effectiveCursor;

    drawRubberBandLine(
      ctx,
      CoordinateTransforms.worldToScreen(anchor, t, viewport),
      CoordinateTransforms.worldToScreen(tip, t, viewport),
    );

    // Πύλη «ΜΗΚΟΣ/ΓΩΝΙΑ» (status bar) στο CALL SITE — ΠΟΤΕ μέσα στον κοινό painter.
    if (resolution && isLengthAngleHudVisible()) {
      paintLengthHud(ctx, resolution, { viewport, transform: t });
    }
  }, [anchor, refGuide]);

  // `useImmediateSnap` σκόπιμα ΑΘΙΚΤΟ (default `false`): ο περιορισμός του κέρσορα ζει
  // ΟΛΟΚΛΗΡΟΣ στο `resolveParallelCursor` παραπάνω, το οποίο θέλει τον ΩΜΟ κέρσορα ως
  // είσοδο. Αν το harness παρέδιδε ήδη snapped κέρσορα, θα εφαρμοζόταν ΔΕΥΤΕΡΟΣ,
  // ανεξάρτητος περιορισμός → η γραμμή θα ξανα-απέκλινε από αυτό που τοποθετεί το commit.
  useCanvasGhostPreview({
    isActive: anchor !== null,
    getCanvas,
    getViewportElement,
    transform,
    draw,
  });
}
