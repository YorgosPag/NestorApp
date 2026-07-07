/**
 * ADR-357/513 §grip-polar — POLAR angle-snap for an endpoint RESHAPE grip (plain-line grip 0/1
 * OR an OPEN polyline / lwpolyline true endpoint), the ONE SSoT called by BOTH the live ghost
 * (`useGripGhostPreview`) AND the commit (`grip-mouseup-handler`) so preview ≡ committed geometry
 * (WYSIWYG — same guarantee as the length/angle lock `resolveLineEndpointLockedDelta`).
 *
 * Reuses the EXACT drawing polar SSoT — zero new mechanism:
 *   · fixed anchor  → `getLineGripAlignmentAnchors` / `getPolylineGripAlignmentAnchors` (the
 *                     un-dragged neighbour the moving segment pivots about = the polar ray origin),
 *   · polar snap    → `resolveOrthoPolarStep` (the SAME 0°/45°/90°… lock the line/wall DRAW uses).
 *
 * Fires only when POLAR is on AND ORTHO is off (parity with the drawing polar gate; when ORTHO is
 * on it keeps its existing axis-lock via `applyResizeConstraints`). Returns `null` — so the caller
 * keeps the raw/ortho delta — when polar is off, the grip is not an endpoint reshape, no fixed
 * anchor exists, or the cursor is not within pull of a polar ray. Wiring it into either seam is a
 * no-op whenever it does not apply (zero regression).
 *
 * NOTE: the commit seam reads the RAW scene entity, so a joined system arrives as `'lwpolyline'`
 * (the preview seam already normalized it to `'polyline'`) — the polyline branch accepts BOTH.
 *
 * @see ./grip-endpoint-lock is unavailable at this layer — that length/angle lock lives under
 *      `systems/dynamic-input`; the polar lock lives here because it needs the hooks-layer
 *      `resolveOrthoPolarStep` drawing SSoT.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { LineGripKind } from '../grip-types';
import type { PolarSnapResult } from '../../systems/constraints/polar-utils';
import { cadToggleState } from '../../systems/constraints/cad-toggle-state';
import { resolveOrthoPolarStep } from '../drawing/drawing-handler-utils';
import { getLineGripAlignmentAnchors } from '../../systems/line/line-grips';
import { getPolylineGripAlignmentAnchors } from '../../systems/polyline/polyline-grips';
// ADR-508 §grip-tracking (Giorgio 2026-07-06) — καθολικό POLAR σε reshape λαβές πολυγωνικών BIM
// οντοτήτων (κολόνα/πλάκα/άνοιγμα/στέγη/…): ο σταθερός polar origin από το ΕΝΑ footprint SSoT.
import { getBimCharacteristicPointsOfCategory } from '../../bim/utils/bim-characteristic-points';
import { getFootprintReshapePolarAnchor } from '../../systems/grip/footprint-reshape-anchors';
// ADR-557 — blur-proof whole-entity Alt-move flag (SSoT). A text/mtext/any non-reshape grip carries no
// endpoint/footprint anchor, so an Alt «move-from-base-point» pivots its POLAR ray about the base point.
import { isActiveGripAltMove } from '../../systems/cursor/GripDragStore';

interface EndpointReshapeGeom {
  readonly type?: string;
  readonly start?: Point2D;
  readonly end?: Point2D;
  readonly vertices?: readonly Point2D[];
  readonly closed?: boolean;
}

/**
 * The FIXED neighbour anchor the reshaped endpoint pivots about (polar ray origin), or `null` for
 * any grip that is not a true endpoint reshape: line grip 0/1 → the OTHER endpoint; open
 * polyline/lwpolyline endpoint (grip 0 / n−1) → the adjacent vertex. Interior vertices, edge and
 * whole-entity move/rotation grips return `null` (their gripIndex falls outside 0 / n−1).
 */
function resolveEndpointReshapeAnchor(
  entity: EndpointReshapeGeom,
  gripIndex: number,
  lineGripKind: LineGripKind | null | undefined,
  footprintGripKind?: string,
): Point2D | null {
  if (entity.type === 'line' && entity.start && entity.end) {
    if (lineGripKind) return null; // rotation / move handles carry a kind → excluded
    return getLineGripAlignmentAnchors(gripIndex, null, { start: entity.start, end: entity.end }, null)?.[0] ?? null;
  }
  if ((entity.type === 'polyline' || entity.type === 'lwpolyline') && entity.vertices) {
    const n = entity.vertices.length;
    const isEndpoint = !entity.closed && n >= 2 && (gripIndex === 0 || gripIndex === n - 1);
    if (!isEndpoint) return null;
    return getPolylineGripAlignmentAnchors(gripIndex, entity.vertices, !!entity.closed)?.[0] ?? null;
  }
  // ADR-508 §grip-tracking — πολυγωνικό BIM footprint (κολόνα/πλάκα/άνοιγμα/στέγη/επένδυση/ενδοδαπέδια):
  // ο σταθερός polar origin (prev γείτονας κορυφής / πρώτο άκρο ακμής) από το ΕΝΑ ordered-corner SSoT.
  // Παρειά/parametric (single-axis) → `null` μέσα στο `getFootprintReshapePolarAnchor`.
  if (footprintGripKind) {
    const corners = getBimCharacteristicPointsOfCategory(entity as unknown as Entity, 'corner');
    return getFootprintReshapePolarAnchor(corners, footprintGripKind);
  }
  return null;
}

export interface EndpointReshapePolarLock {
  /** Displacement from the endpoint's ORIGINAL position (`anchorPos`) to the polar-snapped point. */
  readonly delta: Point2D;
  /** The fixed neighbour the moving segment pivots about (polar ray origin). */
  readonly fixed: Point2D;
  /** The polar snap result — the orange ray / angle label reads it (always `isSnapped: true` here). */
  readonly polar: PolarSnapResult;
}

/**
 * The POLAR-snapped displacement for an endpoint reshape, relative to the endpoint's ORIGINAL
 * position (`anchorPos` = the dragged endpoint at grab time). `cursorWorld` = the live cursor
 * (`anchorPos + rawDelta`). Returns `null` unless POLAR is on, ORTHO is off, the cursor actually
 * snapped to a polar ray AND the grip is either (a) a true endpoint / footprint reshape OR (b) a
 * whole-entity Alt «move-from-base-point» (ADR-557) — the latter pivots about the base point itself,
 * so ANY entity (text / mtext / line / column …) shows the SAME orange polar ray when Alt-moved.
 */
export function resolveEndpointReshapePolarLock(
  entity: unknown,
  gripIndex: number | undefined,
  lineGripKind: LineGripKind | null | undefined,
  anchorPos: Readonly<Point2D>,
  cursorWorld: Readonly<Point2D>,
  footprintGripKind?: string,
): EndpointReshapePolarLock | null {
  if (gripIndex === undefined) return null;
  if (!cadToggleState.isPolarOn() || cadToggleState.isOrthoOn()) return null;
  let fixed = resolveEndpointReshapeAnchor(entity as EndpointReshapeGeom, gripIndex, lineGripKind, footprintGripKind);
  // ADR-557 — ENTITY-AGNOSTIC whole-entity Alt «move-from-base-point» (text / mtext / any grip that is
  // NOT a line-polyline endpoint nor a BIM-footprint reshape): no fixed neighbour anchor exists, so the
  // POLAR ray pivots about the BASE POINT itself (the grabbed grip = `anchorPos`). Same orange-ray SSoT
  // (`resolveOrthoPolarStep` + `paintPolarTrackingLine`) the line-endpoint move already runs — just a
  // base-point origin instead of the far endpoint. Gated on the blur-proof alt-move flag so BOTH seams
  // that call this (the live ghost `useGripGhostPreview` AND the commit `grip-mouseup-handler`) stay
  // preview ≡ commit. NO regression: a line/polyline ENDPOINT alt-move keeps its far-end origin (`fixed`
  // is already non-null there → fallback skipped); a NON-alt reshape grip returns null (no ray), exactly
  // as before. Base-point polar is geometry-free (`anchorPos` + cursor), so text ≡ mtext ≡ multi-line.
  if (!fixed && isActiveGripAltMove()) fixed = anchorPos;
  if (!fixed) return null;
  const step = resolveOrthoPolarStep(cursorWorld, fixed, { ortho: false, polar: true });
  const polar = step.polarResult;
  if (!polar || !polar.isSnapped) return null;
  return {
    delta: { x: step.stepped.x - anchorPos.x, y: step.stepped.y - anchorPos.y },
    fixed,
    polar,
  };
}
