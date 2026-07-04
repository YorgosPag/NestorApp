/**
 * @module rotation-tracking-overlay
 * @description POLAR + AutoAlign ίχνη κατά την ΠΕΡΙΣΤΡΟΦΗ (hot-grip, ADR-397), σε πλήρη parity
 * με τη σχεδίαση. ΜΗΔΕΝ νέα μηχανή — αλυσιδώνει τα ΙΔΙΑ SSoT primitives που χρησιμοποιεί το
 * `drawing-hover-handler.processDrawingHover`:
 *   • `resolveOrthoPolarStep`  → POLAR/ORTHO angle-lock γύρω από το pivot (ref = κέντρο περιστροφής),
 *   • `resolveAlignmentTracking` → λευκή/AutoAlign alignment (acquired ⊕ ambient),
 *   • `paintPolarTrackingLine` / `paintAlignmentPaths` / `paintIntersections` / `paintTooltip` → ΙΔΙΑ paints.
 *
 * Η σειρά πράξεων (polar πρώτα → alignment override) είναι ΙΔΙΑ με τη σχεδίαση ώστε η πορτοκαλί/
 * λευκή γραμμή να συμπίπτει με τον περιστρεφόμενο τοίχο (preview ≡ commit).
 *
 * @see ADR-397 — rotation hot-grip
 * @see ADR-357 Phase 4 — Object Snap Tracking
 * @see ADR-508 §column place+rotate — το ίδιο μοτίβο πορτοκαλί γραμμής στην περιστροφή κολώνας
 */
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { PolarSnapResult } from '../../systems/constraints/polar-utils';
import type { ComposedTracking } from '../../systems/tracking/ambient-tracking-compose';
import { resolveOrthoPolarStep } from '../drawing/drawing-handler-utils';
import { resolveAlignmentTracking } from '../../systems/tracking/resolve-alignment-tracking';
import { cadToggleState } from '../../systems/constraints/cad-toggle-state';
import { formatPolarLabel } from '../../systems/constraints/polar-utils';
import { formatSnapTrackingLabel } from '../../rendering/entities/shared/distance-label-utils';
import { paintPolarTrackingLine } from '../../canvas-v2/preview-canvas/polar-tracking-line-paint';
import { paintAlignmentPaths, paintIntersections, paintTooltip } from '../../canvas-v2/preview-canvas/tracking-paint';
import { getCurrentTrackingPalette } from '../../canvas-v2/preview-canvas/tracking-colors';
import { fromTransform } from '../../canvas-v2/preview-canvas/overlay-projector';

export interface RotationTracking {
  /** Ο cursor μετά το POLAR/ORTHO angle-lock (+ alignment snap) γύρω από το pivot — τροφοδοτεί το sweep. */
  readonly cursor: Point2D;
  /** Μη-null όταν το POLAR κούμπωσε τη γωνία (η πορτοκαλί γραμμή το διαβάζει). */
  readonly polar: PolarSnapResult | null;
  /** Μη-null όταν βρέθηκε alignment path εντός ανοχής (λευκές γραμμές + intersection + tooltip). */
  readonly tracking: ComposedTracking | null;
}

/**
 * Resolve POLAR + AutoAlign γύρω από το `pivot` (κέντρο περιστροφής) προς τον `cursor`. ΙΔΙΑ
 * σειρά με τη σχεδίαση: ORTHO/POLAR angle-lock → alignment override. Τα F8/F10/AutoAlign
 * διαβάζονται live από τα ΙΔΙΑ SSoT stores (`cadToggleState`, ambient config μέσα στον resolver).
 */
export function resolveRotationTracking(
  pivot: Point2D,
  cursor: Point2D,
  scale: number,
  sceneEntities: readonly Entity[] | null,
): RotationTracking {
  const ortho = cadToggleState.isOrthoOn();
  const polar = cadToggleState.isPolarOn();
  // 1) POLAR/ORTHO angle-lock γύρω από το pivot — ΙΔΙΟ SSoT chain με τη σχεδίαση.
  const opStep = resolveOrthoPolarStep(cursor, pivot, { ortho, polar });
  let c = opStep.stepped;
  // 2) Alignment tracking override (acquired ⊕ ambient). Τρέχει ΜΕΤΑ το polar (ίδια προτεραιότητα).
  const tracking = resolveAlignmentTracking(c, {
    scale,
    polarEnabled: polar && !ortho,
    sceneEntities,
  });
  if (tracking) c = tracking.point;
  return { cursor: c, polar: opStep.polarResult, tracking };
}

/**
 * Ζωγράφισε τα ίχνη της περιστροφής στο PreviewCanvas ctx (AFTER ο pivot + το ghost). Reuse
 * ΑΚΡΙΒΩΣ των paints της σχεδίασης → ίδιο χρώμα/πάχος/dash/slots (πορτοκαλί ΠΑΝΩ, λευκό ΚΑΤΩ).
 * `toMm` = scene-units → mm (ο caller το παρέχει από το επίπεδο), για το distance label.
 */
export function paintRotationTracking(
  ctx: CanvasRenderingContext2D,
  pivot: Point2D,
  cursor: Point2D,
  result: RotationTracking,
  transform: ViewTransform,
  viewport: Viewport,
  toMm: (worldDist: number) => number,
): void {
  // Πορτοκαλί POLAR γραμμή pivot→cursor (ΙΔΙΟ SSoT paint με σχεδίαση/κολώνα).
  if (result.polar?.isSnapped && result.polar.snappedAngle !== null) {
    paintPolarTrackingLine(
      ctx,
      pivot,
      result.polar.snappedAngle,
      formatPolarLabel(result.polar.snappedAngle, toMm(result.polar.distance)),
      cursor,
      transform,
      viewport,
    );
  }
  // Λευκή/AutoAlign alignment paths + intersection halo + distance tooltip (ΙΔΙΑ SSoT paints).
  const trk = result.tracking;
  if (trk) {
    const palette = getCurrentTrackingPalette();
    const project = fromTransform(transform, viewport);
    paintAlignmentPaths(ctx, trk.result.activePaths, project, palette);
    paintIntersections(ctx, trk.result.intersections, project, palette);
    const distWorld = Math.hypot(
      trk.point.x - trk.result.anchorPoint.x,
      trk.point.y - trk.result.anchorPoint.y,
    );
    const label = trk.result.snappedAngle !== null
      ? formatSnapTrackingLabel(trk.result.snappedAngle, toMm(distWorld))
      : null;
    paintTooltip(ctx, trk.point, label, project, palette);
  }
}
