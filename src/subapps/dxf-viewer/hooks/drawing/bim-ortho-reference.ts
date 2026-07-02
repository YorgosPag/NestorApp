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
 *   - `applyBimDrawingConstraint` projects a point onto the ortho/polar/step
 *     constraint relative to that anchor via the shared `resolveOrthoPolarStep`
 *     SSoT (ORTHO→POLAR→fixed-step), and reads the live toggle state from the
 *     non-React `cadToggleState` mirror so it can be called from the event-time
 *     BIM commit path that cannot subscribe to the React `useCadToggles` hook
 *     (ADR-040 orchestrator-decoupling). Wall-only face-relative magnet stays here.
 *
 * Both the preview path (`drawing-hover-handler`) and the commit path
 * (`useCanvasClickHandler`) resolve the reference through `getBimOrthoReference`
 * and run the SAME `resolveOrthoPolarStep` pipeline, so the rubber-band ghost
 * always matches the committed geometry (WYSIWYG, Google-level).
 *
 * @see hooks/drawing/drawing-handler-utils.ts — resolveOrthoPolarStep / hardOrtho SSoT
 * @see systems/constraints/polar-utils.ts — applyPolar SSoT
 * @see systems/constraints/cad-toggle-state.ts — live ortho/polar flags
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md
 */

import type { Point2D } from '../../rendering/types/Types';
import { wallPreviewStore } from '../../bim/walls/wall-preview-store';
import { stairPreviewStore } from '../../bim/stairs/stair-preview-store';
import { beamPreviewStore } from '../../bim/beams/beam-preview-store';
import { foundationPreviewStore } from '../../bim/foundations/foundation-preview-store';
import { slabPreviewStore } from '../../bim/slabs/slab-preview-store';
import { floorFinishPreviewStore } from '../../bim/floor-finishes/floor-finish-preview-store';
import { mepUnderfloorPreviewStore } from '../../bim/mep-underfloor/mep-underfloor-preview-store';
import { resolveOrthoPolarStep, worldPolarSnapConfig } from './drawing-handler-utils';
import { applyPolar, type PolarSnapResult } from '../../systems/constraints/polar-utils';
import { cadToggleState } from '../../systems/constraints/cad-toggle-state';
import { getColumnPlacementAnchor } from '../../systems/cursor/ColumnPlacementAnchorStore';
import { getColumnRotationLock } from '../../systems/cursor/ColumnRotationStore';
import { getColumnTopLeanLock } from '../../systems/cursor/ColumnTopLeanStore';
import { getPlacementTrackingAnchor } from '../../systems/cursor/PlacementTrackingAnchorStore';
import { isGripStepActive } from '../../bim/grips/grip-step-quantize';
// ADR-508 — reuse the SAME zoom-adaptive distance snap as the alignment traces
// (no duplicate): the wall length grows in nice round steps that keep a constant
// on-screen spacing. @see systems/tracking/adaptive-distance-snap.ts
import { adaptiveDistanceStep, quantizePointFromAnchor, quantizeMagnitude } from '../../systems/tracking/adaptive-distance-snap';

/** BIM tools whose FSM exposes a constraint anchor (last placed point). */
const BIM_ORTHO_TOOLS = new Set<string>(['wall', 'stair', 'beam', 'slab', 'floor-finish', 'mep-underfloor', 'column', 'foundation-strip', 'foundation-tie-beam']);

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
      // `awaitingEnd` — lock the end against the start point. ADR-363 §wall-ortho-tracking:
      // στο `awaitingStart` (startPoint=null) πέσε στο hover-acquired tracking anchor (OTRACK) —
      // η αρχή κλειδώνει ΟΡΘΟ/Q ως προς την οντότητα που «αγγίζει» ο κέρσορας (π.χ. διπλανή κολόνα).
      return s.startPoint ?? getPlacementTrackingAnchor();
    }
    case 'stair':
      // `awaitingDirection` — lock the direction click against the base point.
      return stairPreviewStore.get().basePoint;
    case 'beam': {
      const s = beamPreviewStore.get();
      // Straight: lock end vs start. Curved: lock the bulge control vs the end.
      return s.endPoint ?? s.startPoint;
    }
    case 'foundation-strip':
    case 'foundation-tie-beam': {
      // ADR-564 §foundation-hud — τα γραμμικά πέδιλα κρατούν τα σημεία τους στο dedicated
      // `foundationPreviewStore` (ΟΧΙ στο `tempPoints`), όπως το δοκάρι. `awaitingEnd`: lock end
      // vs start → η αναφορά = αρχή band (pivot του τόξου φοράς + βάση ΟΡΘΟ/POLAR). `null` πριν
      // το 1ο κλικ → no-op (ίδιο με δοκάρι/τοίχο).
      const s = foundationPreviewStore.get();
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
    case 'column': {
      // ADR-363 §column-ortho — αναφορά = η ΠΡΟΗΓΟΥΜΕΝΗ τοποθετημένη κολόνα (single-point tool,
      // δεν έχει FSM anchor σαν τον τοίχο). Ενεργό ΜΟΝΟ στο 1ο κλικ (awaitingPosition): μόλις κλειδώσει
      // η θέση (rotation/top-lean phase) το 2ο κλικ ορίζει ΓΩΝΙΑ/ΚΛΙΣΗ — η θέση δεν πρέπει να ξανα-
      // περιοριστεί (θα μετακινούσε το κλειδωμένο origin). `null` πριν την 1η κολόνα → no-op (ως τώρα).
      if (getColumnRotationLock() || getColumnTopLeanLock()) return null;
      // ADR-363 §wall-ortho-tracking (extended to column) — hover σε υφιστάμενη οντότητα (OTRACK)
      // ΥΠΕΡΙΣΧΥΕΙ (πιο πρόσφατη ρητή πρόθεση)· αλλιώς η προηγούμενη τοποθετημένη κολόνα.
      return getPlacementTrackingAnchor() ?? getColumnPlacementAnchor();
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
  let result = applyPolar(point, ref, { ...worldPolarSnapConfig(), baseAngle });
  // ADR-508 — quantize the LENGTH along the (angle-snapped) ray in zoom-adaptive
  // steps. Reuses the alignment-trace SSoT so the wall "grows" exactly like the
  // green tracking lines do. Direction = ref → snapped point.
  const step = worldPerPixel ? adaptiveDistanceStep(worldPerPixel) : 0;
  if (step > 0) {
    const len = Math.hypot(result.point.x - ref.x, result.point.y - ref.y);
    if (len > 1e-9) {
      // ONE SSoT for "quantize a point's length from an anchor along its direction".
      result = { ...result, point: quantizePointFromAnchor(result.point, ref, step), distance: quantizeMagnitude(len, step) };
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
  // ORTHO (explicit world H/V lock) wins over the face magnet — via the shared
  // ORTHO/POLAR/step SSoT so the fixed step grid (F9+Q) rides on top automatically.
  if (cadToggleState.isOrthoOn()) return resolveOrthoPolarStep(point, ref, { ortho: true, polar: false }).stepped;
  // ADR-508 — wall 2nd click anchored to a face → relative-polar-to-face (auto magnet),
  // which owns its own zoom-adaptive step (not the fixed grid).
  // ADR-363 §wall-ortho-tracking — Q (F9+Q fixed step) ΝΙΚΑ τον μαγνήτη παρειάς (Giorgio: όταν
  // κρατάω Q θέλω το ΔΙΚΟ μου βήμα, όχι το zoom-adaptive του magnet) → skip magnet όσο Q κρατιέται.
  const faceRel = isGripStepActive() ? null : resolveWallFaceRelativePolar(point, worldPerPixel);
  if (faceRel) return faceRel.result.point;
  // World POLAR or free → SAME ORTHO/POLAR/step SSoT the preview + line commit use.
  return resolveOrthoPolarStep(point, ref, { ortho: false, polar: cadToggleState.isPolarOn() }).stepped;
}
