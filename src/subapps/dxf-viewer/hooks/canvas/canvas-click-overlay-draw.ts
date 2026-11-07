/**
 * ADR-933 — Χειριστές κλικ της εντολής «Περιοχή» (overlay draw, PRIORITY 5 του
 * `useCanvasClickHandler`). Εξήχθησαν από το `canvas-click-tool-handlers.ts` όταν οι μέθοδοι
 * γεωμετρίας (πολυγωνική · ορθογώνια) έφεραν το αρχείο στο όριο των 500 γραμμών (N.7.1).
 *
 * Κάθε μέθοδος καταλήγει στην ΙΔΙΑ πόρτα αποθήκευσης: `finishDrawingWithPolygonRef` →
 * `commitOverlayPolygon` (είδος από το SSoT, ιδεμποτία, γεγονότα).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-933-region-command.md
 */

import type { Point2D } from '../../rendering/types/Types';
import { POLYGON_TOLERANCES } from '../../config/tolerance-config';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import type { UseCanvasClickHandlerParams } from './canvas-click-types';
import { overlayDrawSettingsStore } from '../../stores/overlay-draw-settings-store';
import { regionRectangleRing } from '../../overlays/region-rectangle';

// ============================================================================
// OVERLAY POLYGON DRAW (PRIORITY 5)
// ============================================================================
/**
 * Overlay polygon drawing — accumulates click-to-add points, auto-closing
 * (and saving) when the user clicks near the first point with ≥3 points.
 * Always consumes the click while `overlayMode === 'draw'` (returns once the
 * caller has matched that mode).
 *
 * 🚀 PERF (2026-05-09): `isNearFirstPoint` is computed inline at click time
 * (was a reactive prop forcing CanvasSection to re-render on mousemove).
 * ADR-040 XXII.A: live SSoT transform read at click time.
 */
export function handleOverlayDrawClick(worldPoint: Point2D, p: UseCanvasClickHandlerParams): void {
  if (p.isSavingPolygon) return;
  // ADR-933 — η μέθοδος διαβάζεται τη στιγμή του κλικ (ADR-040 κανόνας 2), ποτέ από render.
  if (overlayDrawSettingsStore.get().method === 'rectangle') {
    handleOverlayRectangleClick(worldPoint, p);
    return;
  }
  const { draftPolygon } = p;
  const isNearFirst = (() => {
    if (draftPolygon.length < 3) return false;
    const [fx, fy] = draftPolygon[0];
    const dx = worldPoint.x - fx;
    const dy = worldPoint.y - fy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (POLYGON_TOLERANCES.CLOSE_DETECTION / getImmediateTransform().scale);
  })();
  if (isNearFirst && draftPolygon.length >= 3) {
    p.setIsSavingPolygon(true);
    p.finishDrawingWithPolygonRef.current(draftPolygon).then(success => {
      p.setIsSavingPolygon(false);
      if (success) p.setDraftPolygon([]);
    });
    return;
  }
  const worldPointArray: [number, number] = [worldPoint.x, worldPoint.y];
  p.setDraftPolygon(prev => [...prev, worldPointArray]);
}

/**
 * ADR-933 — Μέθοδος «Ορθογώνια» (ArchiCAD Zone «Rectangular»): 1ο κλικ = γωνία, 2ο κλικ =
 * αντίθετη γωνία ⇒ αποθήκευση μέσω της ΜΙΑΣ πόρτας (`finishDrawingWithPolygonRef` →
 * `commitOverlayPolygon`). Η προεπισκόπηση (`useDraftPolygonLayer`) χτίζει ΤΟ ΙΔΙΟ ορθογώνιο
 * με το ίδιο `regionRectangleRing` — ό,τι βλέπει ο άνθρωπος είναι ό,τι γράφεται.
 */
function handleOverlayRectangleClick(worldPoint: Point2D, p: UseCanvasClickHandlerParams): void {
  const first = p.draftPolygon[0];
  if (!first) {
    p.setDraftPolygon([[worldPoint.x, worldPoint.y]]);
    return;
  }
  const ring = regionRectangleRing(first, worldPoint);
  if (!ring) return; // εκφυλισμένο (μηδενικό πλάτος/ύψος) — περιμένει άλλη γωνία
  p.setIsSavingPolygon(true);
  p.finishDrawingWithPolygonRef.current(ring).then(success => {
    p.setIsSavingPolygon(false);
    if (success) p.setDraftPolygon([]);
  });
}
