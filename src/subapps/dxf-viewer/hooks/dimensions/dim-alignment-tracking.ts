/**
 * ADR-562 Φ9 / ADR-357 — Alignment-tracking SSoT wrapper για τις διαστάσεις.
 *
 * Οι ροές της διάστασης (δημιουργία / λαβές / μετακίνηση) χρειάζονται τα ΙΔΙΑ ίχνη
 * ευθυγράμμισης με κάθε άλλο εργαλείο, αλλά με έναν επιπλέον τύπο anchor: τα **ήδη
 * picked σημεία** της τρέχουσας ενέργειας (clicks δημιουργίας ή τα υπόλοιπα defPoints
 * της διάστασης). Το `resolveAlignmentTracking` διαβάζει μόνο store+ambient, οπότε εδώ
 * περνάμε ΡΗΤΑ τα reference points ως extra anchors — ακριβώς όπως το
 * `rotation-tracking-overlay` περνά το pivot.
 *
 * Ίδια μηχανή (`composeTrackingSnap`), ίδιο ambient gate, ίδιο adaptive-distance quantize
 * — μηδέν παράλληλο σύστημα. ΕΝΑ brain, τώρα τρεις ακόμη consumers (dim create/grip/move).
 *
 * @see systems/tracking/resolve-alignment-tracking.ts — ο generic wrapper (store+ambient)
 * @see hooks/tools/rotation-tracking-overlay.ts — το πρότυπο grip-drag consumer
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas';
import { TrackingPointStore, type AcquiredTrackingPoint } from '../../systems/tracking/TrackingPointStore';
import { composeTrackingSnap, type ComposedTracking } from '../../systems/tracking/ambient-tracking-compose';
import { collectAmbientAlignmentAnchors } from '../../systems/tracking/ambient-alignment-source';
import { ambientAlignmentConfigStore } from '../../systems/tracking/ambient-alignment-config-store';
import { polarTrackingStore } from '../../systems/constraints/polar-tracking-store';
import { worldPerPixel, pixelsToWorld } from '../../rendering/utils/viewport-scale';
import { cadToggleState } from '../../systems/constraints/cad-toggle-state';
import { formatPolarLabel, type PolarSnapResult } from '../../systems/constraints/polar-utils';
import { resolveOrthoPolarStep } from '../drawing/drawing-handler-utils';
import { formatSnapTrackingLabel } from '../../rendering/entities/shared/distance-label-utils';
import { paintAlignmentPaths, paintIntersections, paintTooltip } from '../../canvas-v2/preview-canvas/tracking-paint';
import { getCurrentTrackingPalette } from '../../canvas-v2/preview-canvas/tracking-colors';
import { fromTransform } from '../../canvas-v2/preview-canvas/overlay-projector';
import { sceneDistanceToMeters } from '../../bim/labels/move-readout';
import type { SceneUnits } from '../../utils/scene-units';

/** `sourceSnapType` tag για τα explicit reference points της τρέχουσας διάστασης. */
const DIM_REF_SOURCE = 'dim-refpoint';

/**
 * ADR-562 Φ9.4 — «tracking pull» ανοχή (px) για τις interactive ACTION drags (2-click MOVE,
 * body-drag, grip). Ευρύτερη από την 3px OSNAP hover aperture που κρατά η ΔΗΜΙΟΥΡΓΙΑ: σε ένα
 * ελεύθερο hand-drag δεν υπάρχει hover-acquire dwell ούτε POLAR-lock που να κάθεται τον cursor
 * πάνω στον άξονα, οπότε το single-anchor projection με 3px δεν κουμπώνει ποτέ → τα ίχνη «χάνονται».
 * ~8px = η AutoCAD tracking aperture: κουμπώνει όταν όντως ευθυγραμμίζεσαι, χωρίς να «κολλάει» παντού.
 */
const ACTION_ALIGN_TOLERANCE_PX = 8;

/** Default match aperture (px) — η OSNAP hover ανοχή που κρατά η δημιουργία διάστασης/γραμμής. */
const DEFAULT_ALIGN_TOLERANCE_PX = 3;

export interface DimAlignmentInput {
  /** Live transform scale (viewport). */
  readonly scale: number;
  /** F10 polar increments συμμετέχουν (true ⇔ POLAR on && !ORTHO). */
  readonly polarEnabled: boolean;
  /**
   * Scene entities για τα ambient (Revit-style) anchors, Ή null για παράλειψη
   * (acquired/ref-only). Ο CALLER κάνει το gate πίσω από το AutoAlign toggle
   * (`ambientAlignmentConfigStore.enabled`) ώστε το scene read να μένει lazy.
   */
  readonly sceneEntities: readonly Entity[] | null;
  /**
   * Match aperture σε screen px (default {@link DEFAULT_ALIGN_TOLERANCE_PX} = 3, η OSNAP hover
   * ανοχή της δημιουργίας). Οι interactive action drags περνούν {@link ACTION_ALIGN_TOLERANCE_PX}
   * (ευρύτερο pull) μέσω του `resolveActionAlignmentTracking`. Ο caller δίνει px· εδώ γίνεται
   * `pixelsToWorld` ώστε το feel να μένει σταθερό σε κάθε zoom.
   */
  readonly matchTolerancePx?: number;
}

/**
 * Resolve το καλύτερο alignment-path snap από (refPoints ⊕ acquired ⊕ ambient) προς τον
 * `cursor`. Επιστρέφει null όταν δεν υπάρχει anchor / path εντός tolerance (ο caller κρατά
 * τον raw cursor). Τα `refPoints` είναι τα ήδη-picked σημεία της τρέχουσας διάστασης.
 */
export function resolveDimAlignmentTracking(
  cursor: Point2D,
  refPoints: readonly Point2D[],
  input: DimAlignmentInput,
): ComposedTracking | null {
  const { scale, polarEnabled, sceneEntities } = input;
  const worldTolerance = pixelsToWorld(input.matchTolerancePx ?? DEFAULT_ALIGN_TOLERANCE_PX, scale);

  // Τα ήδη-picked σημεία ως ρητά anchors (transient — acquiredAt:0, δεν μπαίνουν στο FIFO),
  // μαζί με τα AutoCAD hover-acquired points.
  const refAnchors: AcquiredTrackingPoint[] = refPoints.map((p) => ({
    x: p.x, y: p.y, acquiredAt: 0, sourceSnapType: DIM_REF_SOURCE,
  }));
  const acquired: readonly AcquiredTrackingPoint[] = [...refAnchors, ...TrackingPointStore.getPoints()];

  const ambientCfg = ambientAlignmentConfigStore.getSnapshot();
  const ambient = sceneEntities
    ? collectAmbientAlignmentAnchors(cursor, sceneEntities, {
        radiusWorld: pixelsToWorld(ambientCfg.radiusPx, scale),
        maxMembers: ambientCfg.maxMembers,
        axisToleranceWorld: worldTolerance,
      })
    : [];

  return composeTrackingSnap(cursor, acquired, ambient, {
    polar: {
      incrementAngle: polarTrackingStore.incrementAngle,
      additionalAngles: polarTrackingStore.additionalAngles,
      polarEnabled,
    },
    worldTolerance,
    worldPerPixel: worldPerPixel(scale),
  });
}

/**
 * ADR-562 Φ9.3 — convenience wrapper for the interactive ACTION flows (2-click MOVE,
 * future move gestures) that don't already read the CAD toggles: reads the POLAR/ORTHO
 * state (`cadToggleState`) and the AutoAlign toggle (`ambientAlignmentConfigStore`)
 * internally, then delegates to `resolveDimAlignmentTracking`. The caller passes the
 * level's scene entities (or `null`); the ambient scan is gated here so it stays lazy.
 *
 * `refPoints` = the explicit anchors of the action (e.g. the MOVE base point). Polar
 * increments participate only when POLAR is on AND ORTHO is off (parity with drawing).
 */
export function resolveActionAlignmentTracking(
  cursor: Point2D,
  refPoints: readonly Point2D[],
  scale: number,
  sceneEntities: readonly Entity[] | null,
): ComposedTracking | null {
  const ambientOn = ambientAlignmentConfigStore.getSnapshot().enabled;
  return resolveDimAlignmentTracking(cursor, refPoints, {
    scale,
    polarEnabled: cadToggleState.isPolarOn() && !cadToggleState.isOrthoOn(),
    sceneEntities: ambientOn ? sceneEntities : null,
    // Interactive drag → ευρύτερο tracking pull (χωρίς hover-acquire dwell/POLAR-lock, το 3px
    // single-anchor projection δεν κουμπώνει ποτέ με το χέρι → τα ίχνη έλειπαν εντελώς).
    matchTolerancePx: ACTION_ALIGN_TOLERANCE_PX,
  });
}

/**
 * ADR-563 §cutline-tracking — the endpoint of an interactive 2-point dim ACTION
 * (cut-line start→end, offset placement) resolved with the FULL wall-drawing chain:
 *   1) POLAR/ORTHO angle-lock around `refPoints[0]` (`resolveOrthoPolarStep`) — the
 *      SAME SSoT + order the wall/line drawing uses (`processDrawingHover`), so the
 *      orange polar line appears identically;
 *   2) alignment override (acquired ⊕ ambient ⊕ ref anchors) via
 *      `resolveActionAlignmentTracking` — the green dashed traces + Polar increments.
 *
 * ΜΗΔΕΝ νέα μηχανή — μόνο σύνθεση των υπαρχόντων primitives (ίδια που τρέχει inline η
 * σχεδίαση τοίχου), ώστε η γραμμή τομής να δείχνει ΤΑ ΙΔΙΑ ίχνη + Polar. Preview και
 * commit καλούν το ίδιο resolve → η αποθηκευμένη γραμμή == το preview (WYSIWYG).
 *
 * `refPoints[0]` = ο άξονας του POLAR (η αρχή της τρέχουσας γραμμής)· ΟΛΑ τα `refPoints`
 * συμμετέχουν ως alignment anchors. Επιστρέφει πάντα ένα σημείο (τον raw cursor όταν
 * τίποτα δεν κουμπώνει) + το polar/tracking για το paint.
 *
 * @see hooks/drawing/drawing-hover-handler.ts — η inline αλυσίδα της σχεδίασης
 * @see hooks/tools/rotation-tracking-overlay.ts — ο rotation αδελφός των ίδιων primitives
 */
export interface DimActionEndpoint {
  /** Cursor after POLAR/ORTHO lock + alignment override (the committed/preview point). */
  readonly point: Point2D;
  /** Non-null when POLAR locked the angle (the orange polar line reads it). */
  readonly polar: PolarSnapResult | null;
  /** Non-null when an alignment path was found within tolerance (green traces). */
  readonly tracking: ComposedTracking | null;
}

export function resolveDimActionEndpoint(
  refPoints: readonly Point2D[],
  cursor: Point2D,
  scale: number,
  sceneEntities: readonly Entity[] | null,
): DimActionEndpoint {
  const polarRef = refPoints[0];
  let point = cursor;
  let polar: PolarSnapResult | null = null;
  // 1) POLAR/ORTHO angle-lock around the action's anchor — ΙΔΙΟ SSoT με τη σχεδίαση.
  if (polarRef) {
    const opStep = resolveOrthoPolarStep(cursor, polarRef, {
      ortho: cadToggleState.isOrthoOn(),
      polar: cadToggleState.isPolarOn(),
    });
    point = opStep.stepped;
    polar = opStep.polarResult;
  }
  // 2) Alignment override (acquired ⊕ ambient ⊕ ref anchors) — τρέχει ΜΕΤΑ το polar.
  const tracking = resolveActionAlignmentTracking(point, refPoints, scale, sceneEntities);
  if (tracking) point = tracking.point;
  return { point, polar, tracking };
}

/**
 * Paint the interactive-action traces (orange POLAR line + green alignment paths /
 * intersections / distance tooltip) onto the preview canvas via the SAME handle
 * methods the wall drawing uses (`drawPolarTrackingLine` / `drawTrackingAlignment`) —
 * ίδιο χρώμα/dash/label με τη σχεδίαση. `refPoint` = ο άξονας του POLAR (αρχή γραμμής)·
 * `toMm` = world-distance → mm (ο caller το παρέχει από τα scene units του επιπέδου).
 */
export function paintDimActionTracking(
  canvas: PreviewCanvasHandle,
  refPoint: Point2D,
  resolved: DimActionEndpoint,
  toMm: (worldDist: number) => number,
): void {
  const { point, polar, tracking } = resolved;
  // Πορτοκαλί POLAR γραμμή refPoint→point (ΙΔΙΟ SSoT paint με σχεδίαση/κολώνα).
  if (polar?.isSnapped && polar.snappedAngle !== null) {
    canvas.drawPolarTrackingLine(
      refPoint,
      polar.snappedAngle,
      formatPolarLabel(polar.snappedAngle, toMm(polar.distance)),
      point,
    );
  }
  // Πράσινες/AutoAlign alignment paths + intersection halo + distance tooltip.
  if (tracking) {
    const r = tracking.result;
    const distWorld = Math.hypot(point.x - r.anchorPoint.x, point.y - r.anchorPoint.y);
    const label = r.snappedAngle !== null
      ? formatSnapTrackingLabel(r.snappedAngle, toMm(distWorld))
      : null;
    canvas.drawTrackingAlignment(r.activePaths, r.intersections, point, label);
  }
}

/**
 * Paint the alignment traces (dashed paths + intersection halos + distance tooltip)
 * for a resolved grip tracking result onto a preview-canvas ctx. Reuses the EXACT SSoT
 * paints of the drawing flow (`paintAlignmentPaths`/`paintIntersections`/`paintTooltip`)
 * — same colour/dash/width/label-slot — so the grip-drag traces are visually identical
 * to the creation-time traces. Mirror of `rotation-tracking-overlay.paintRotationTracking`
 * (without the polar ray — the action flow shows only alignment lines, matching creation).
 *
 * Shared SSoT paint for EVERY grip-drag consumer (dimension defPoint, plain-line endpoint /
 * centre-move) — the store scopes it to one active drag, so one painter, no per-family copy.
 *
 * `toMm` converts a world distance → millimetres for the distance label. INTERNAL: every
 * app consumer goes through `paintActionAlignmentTracking` (scene-units overload) below —
 * this generic form only exists so the tooltip unit-mapping has one seam.
 */
function paintGripAlignmentTracking(
  ctx: CanvasRenderingContext2D,
  tracking: ComposedTracking,
  transform: ViewTransform,
  viewport: Viewport,
  toMm: (worldDist: number) => number,
): void {
  const palette = getCurrentTrackingPalette();
  const project = fromTransform(transform, viewport);
  const r = tracking.result;
  paintAlignmentPaths(ctx, r.activePaths, project, palette);
  paintIntersections(ctx, r.intersections, project, palette);
  const distWorld = Math.hypot(
    tracking.point.x - r.anchorPoint.x,
    tracking.point.y - r.anchorPoint.y,
  );
  const label = r.snappedAngle !== null
    ? formatSnapTrackingLabel(r.snappedAngle, toMm(distWorld))
    : null;
  paintTooltip(ctx, tracking.point, label, project, palette);
}

/**
 * SSoT paint for EVERY action-alignment consumer (2-click MOVE, body-drag, plain-line grip,
 * dimension grip). ONE public entry: the caller supplies the active level's `sceneUnits` and
 * the world→mm tooltip mapping (`sceneDistanceToMeters(d) * 1000`) lives here ONCE — no more
 * per-hook `(d) => sceneDistanceToMeters(d, units) * 1000` boilerplate copied across 4 files.
 *
 * @see hooks/tools/rotation-tracking-overlay.ts — the sibling grip-drag paint helper
 * @see hooks/drawing/drawing-hover-handler.ts — the creation-time paint (drawTrackingAlignment)
 */
export function paintActionAlignmentTracking(
  ctx: CanvasRenderingContext2D,
  tracking: ComposedTracking,
  transform: ViewTransform,
  viewport: Viewport,
  sceneUnits: SceneUnits,
): void {
  paintGripAlignmentTracking(
    ctx, tracking, transform, viewport, (d) => sceneDistanceToMeters(d, sceneUnits) * 1000,
  );
}
