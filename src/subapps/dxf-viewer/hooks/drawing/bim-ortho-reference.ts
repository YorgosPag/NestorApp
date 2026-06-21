/**
 * ADR-363 — BIM drawing ORTHO (F8) / POLAR (F10) constraint SSoT.
 *
 * Problem: the generic line/polyline tools keep their click points in
 * `drawingState.tempPoints`, so `onDrawingPoint` / `processDrawingHover` resolve
 * the ortho/polar reference as `tempPoints[last]`. The BIM tools (wall, stair,
 * beam, slab) each run their own FSM and keep their points in a dedicated
 * preview store — `tempPoints` stays empty for them. Consequence: ORTHO/POLAR
 * silently did nothing while drawing a BIM element (the wall "did not listen"
 * to F8).
 *
 * Fix (single source of truth, preview == commit):
 *   - `getBimOrthoReference` resolves the active anchor point for a BIM tool by
 *     reading its preview store. This is the ONE place that knows where the
 *     constraint baseline lives for each BIM tool.
 *   - `applyBimDrawingConstraint` projects a point onto the ortho/polar
 *     constraint relative to that anchor, reusing the existing `hardOrtho`
 *     (AutoCAD-style H/V lock) and `applyPolar` SSoT helpers, and reads the live
 *     toggle state from the non-React `cadToggleState` mirror so it can be
 *     called from the event-time BIM commit path that cannot subscribe to the
 *     React `useCadToggles` hook (ADR-040 orchestrator-decoupling).
 *
 * Both the preview path (`drawing-hover-handler`) and the commit path
 * (`useCanvasClickHandler`) resolve the reference through `getBimOrthoReference`
 * and apply the same `hardOrtho` / `applyPolar` math, so the rubber-band ghost
 * always matches the committed geometry (WYSIWYG, Google-level).
 *
 * @see hooks/drawing/drawing-handler-utils.ts — hardOrtho SSoT
 * @see systems/constraints/polar-utils.ts — applyPolar SSoT
 * @see systems/constraints/cad-toggle-state.ts — live ortho/polar flags
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md
 */

import type { Point2D } from '../../rendering/types/Types';
import { wallPreviewStore } from '../../bim/walls/wall-preview-store';
import { stairPreviewStore } from '../../bim/stairs/stair-preview-store';
import { beamPreviewStore } from '../../bim/beams/beam-preview-store';
import { slabPreviewStore } from '../../bim/slabs/slab-preview-store';
import { floorFinishPreviewStore } from '../../bim/floor-finishes/floor-finish-preview-store';
import { mepUnderfloorPreviewStore } from '../../bim/mep-underfloor/mep-underfloor-preview-store';
import { hardOrtho } from './drawing-handler-utils';
import { applyPolar, type PolarSnapResult } from '../../systems/constraints/polar-utils';
import { polarTrackingStore } from '../../systems/constraints/polar-tracking-store';
import { cadToggleState } from '../../systems/constraints/cad-toggle-state';
// ADR-508 — reuse the SAME zoom-adaptive distance snap as the alignment traces
// (no duplicate): the wall length grows in nice round steps that keep a constant
// on-screen spacing. @see systems/tracking/adaptive-distance-snap.ts
import { adaptiveDistanceStep, quantizeAlongPath, quantizeMagnitude } from '../../systems/tracking/adaptive-distance-snap';

/** BIM tools whose FSM exposes a constraint anchor (last placed point). */
const BIM_ORTHO_TOOLS = new Set<string>(['wall', 'stair', 'beam', 'slab', 'floor-finish', 'mep-underfloor']);

/** True if `tool` is a BIM tool that participates in ortho/polar constraints. */
export function isBimOrthoTool(tool: string): boolean {
  return BIM_ORTHO_TOOLS.has(tool);
}

/**
 * Resolves the live ortho/polar anchor (last placed point) for a BIM tool by
 * reading its preview store. Returns `null` when there is no meaningful anchor
 * yet (first click) or when the current phase must not be constrained (e.g. the
 * wall's free lateral side-pick during `awaitingAlignment`).
 */
export function getBimOrthoReference(tool: string): Point2D | null {
  switch (tool) {
    case 'wall': {
      const s = wallPreviewStore.get();
      // Polyline chain — constrain the next vertex against the previous one.
      if (s.polylineVertices.length > 0) {
        return s.polylineVertices[s.polylineVertices.length - 1];
      }
      // endPoint present ⇒ straight-kind `awaitingAlignment`: the pending click
      // is the free lateral side-pick, which must NOT be ortho/polar-locked.
      if (s.endPoint) return null;
      // `awaitingEnd` — lock the end against the start point.
      return s.startPoint;
    }
    case 'stair':
      // `awaitingDirection` — lock the direction click against the base point.
      return stairPreviewStore.get().basePoint;
    case 'beam': {
      const s = beamPreviewStore.get();
      // Straight: lock end vs start. Curved: lock the bulge control vs the end.
      return s.endPoint ?? s.startPoint;
    }
    case 'slab': {
      const s = slabPreviewStore.get();
      return s.vertices.length > 0 ? s.vertices[s.vertices.length - 1] : null;
    }
    case 'floor-finish': {
      const s = floorFinishPreviewStore.get();
      return s.vertices.length > 0 ? s.vertices[s.vertices.length - 1] : null;
    }
    case 'mep-underfloor': {
      const s = mepUnderfloorPreviewStore.get();
      return s.vertices.length > 0 ? s.vertices[s.vertices.length - 1] : null;
    }
    default:
      return null;
  }
}

/**
 * ADR-508 (2026-06-21) — relative-polar-to-face base angle for the wall tool's
 * 2nd click. Returns the captured perpendicular-to-face angle (degrees, world)
 * when the start was face-anchored and we are in the `awaitingEnd` phase, else
 * `null`. This is the ONE place both the preview (`drawing-hover-handler`) and the
 * commit (`applyBimDrawingConstraint`) read the relative-polar base, so the ghost
 * matches the committed wall (preview === commit).
 */
export function getWallFaceRelativeBaseAngle(tool: string): number | null {
  if (tool !== 'wall') return null;
  const s = wallPreviewStore.get();
  // `awaitingEnd`: start locked, end not yet set, AND the start snapped onto a face.
  if (!s.startPoint || s.endPoint) return null;
  if (!s.startAnchored) return null;
  return s.startFaceAngle;
}

/**
 * ADR-508 — resolves the wall face-relative polar snap for the 2nd click. Active
 * (returns non-null) only when the start anchored to a member face (Revit "angle
 * relative to face") and F8 ortho is NOT engaged (explicit world H/V lock wins).
 * It supersedes world polar (F10) and is on automatically — no toggle required —
 * because anchoring the start to a face IS the user's intent to align to it.
 *
 * `baseAngle` = perpendicular-to-face ⇒ `0°` relative = perpendicular (the flush
 * case: both base corners land on the face) and `±90°` = parallel. Used by BOTH
 * the preview (needs the `PolarSnapResult` for the tracking-line overlay) and the
 * commit path. Returns the anchor `ref` (= the face-anchored start) too.
 *
 * `worldPerPixel` (= `1/scale`, optional) enables the **zoom-adaptive length step**:
 * the wall length is quantized along the snapped ray to a nice round value whose
 * on-screen spacing stays constant — the SAME `adaptiveDistanceStep` /
 * `quantizeAlongPath` SSoT the alignment traces use (no duplicate). Omit it (tests)
 * to get the raw, un-quantized length.
 */
export function resolveWallFaceRelativePolar(
  point: Readonly<Point2D>,
  worldPerPixel?: number,
): { ref: Point2D; result: PolarSnapResult; baseAngle: number } | null {
  if (cadToggleState.isOrthoOn()) return null;
  const baseAngle = getWallFaceRelativeBaseAngle('wall');
  if (baseAngle === null) return null;
  const ref = getBimOrthoReference('wall');
  if (!ref) return null;
  let result = applyPolar(point, ref, {
    incrementAngle: polarTrackingStore.incrementAngle,
    additionalAngles: polarTrackingStore.additionalAngles,
    angleTolerance: 3,
    baseAngle,
  });
  // ADR-508 — quantize the LENGTH along the (angle-snapped) ray in zoom-adaptive
  // steps. Reuses the alignment-trace SSoT so the wall "grows" exactly like the
  // green tracking lines do. Direction = ref → snapped point.
  const step = worldPerPixel ? adaptiveDistanceStep(worldPerPixel) : 0;
  if (step > 0) {
    const dx = result.point.x - ref.x;
    const dy = result.point.y - ref.y;
    const len = Math.hypot(dx, dy);
    if (len > 1e-9) {
      const point2 = quantizeAlongPath(result.point, ref, dx / len, dy / len, step);
      result = { ...result, point: point2, distance: quantizeMagnitude(len, step) };
    }
  }
  return { ref, result, baseAngle };
}

/**
 * Projects `point` onto the active ORTHO (F8) / POLAR (F10) constraint for a BIM
 * tool, relative to its live anchor. Returns `point` unchanged when the tool is
 * not a constrained BIM tool, when no anchor exists, or when neither toggle is
 * on. Reads the live toggle state from `cadToggleState` (ortho/polar are
 * mutually exclusive — enforced in `useCadToggles`).
 *
 * ADR-508 — for the wall tool's 2nd click, the face-relative polar magnet
 * (`resolveWallFaceRelativePolar`) takes precedence over world polar when the
 * start anchored to a member face. `worldPerPixel` (= `1/scale`) lets the commit
 * apply the SAME zoom-adaptive length step as the preview ghost (preview === commit).
 */
export function applyBimDrawingConstraint(
  tool: string,
  point: Readonly<Point2D>,
  worldPerPixel?: number,
): Point2D {
  if (!isBimOrthoTool(tool)) return point;
  const ref = getBimOrthoReference(tool);
  if (!ref) return point;
  if (cadToggleState.isOrthoOn()) return hardOrtho(point, ref);
  // ADR-508 — wall 2nd click anchored to a face → relative-polar-to-face (auto magnet)
  // + zoom-adaptive length step (same SSoT as alignment traces).
  const faceRel = resolveWallFaceRelativePolar(point, worldPerPixel);
  if (faceRel) return faceRel.result.point;
  if (cadToggleState.isPolarOn()) {
    return applyPolar(point, ref, {
      incrementAngle: polarTrackingStore.incrementAngle,
      additionalAngles: polarTrackingStore.additionalAngles,
      angleTolerance: 3,
    }).point;
  }
  return point;
}
