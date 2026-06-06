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
import { hardOrtho } from './drawing-handler-utils';
import { applyPolar } from '../../systems/constraints/polar-utils';
import { polarTrackingStore } from '../../systems/constraints/polar-tracking-store';
import { cadToggleState } from '../../systems/constraints/cad-toggle-state';

/** BIM tools whose FSM exposes a constraint anchor (last placed point). */
const BIM_ORTHO_TOOLS = new Set<string>(['wall', 'stair', 'beam', 'slab', 'floor-finish']);

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
    default:
      return null;
  }
}

/**
 * Projects `point` onto the active ORTHO (F8) / POLAR (F10) constraint for a BIM
 * tool, relative to its live anchor. Returns `point` unchanged when the tool is
 * not a constrained BIM tool, when no anchor exists, or when neither toggle is
 * on. Reads the live toggle state from `cadToggleState` (ortho/polar are
 * mutually exclusive — enforced in `useCadToggles`).
 */
export function applyBimDrawingConstraint(tool: string, point: Readonly<Point2D>): Point2D {
  if (!isBimOrthoTool(tool)) return point;
  const ref = getBimOrthoReference(tool);
  if (!ref) return point;
  if (cadToggleState.isOrthoOn()) return hardOrtho(point, ref);
  if (cadToggleState.isPolarOn()) {
    return applyPolar(point, ref, {
      incrementAngle: polarTrackingStore.incrementAngle,
      additionalAngles: polarTrackingStore.additionalAngles,
      angleTolerance: 3,
    }).point;
  }
  return point;
}
