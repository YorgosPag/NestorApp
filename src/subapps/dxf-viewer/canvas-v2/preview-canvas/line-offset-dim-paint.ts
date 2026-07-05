/**
 * line-offset-dim-paint — overlay painter for the PERPENDICULAR move-offset dimension of a line
 * (body-drag OR centre-grip translate). Composes the existing SSoTs, zero bespoke drawing:
 *   · geometry → `resolveParallelOffsetDim` (pure),
 *   · number   → `formatLengthForDisplay` (display-length SSoT, forced metres),
 *   · draw     → `paintAlignedOverlayDimension` (full ISO dim: arrows + extension lines + label).
 *
 * PRODUCT RULE (Giorgio 2026-07-05): shown ONLY while ORTHO (F8) is armed — a free move has no
 * well-defined perpendicular reference. No-op otherwise. Called AFTER the ghost so the dim overlays
 * it; wiped on the next `drawPreview`/`clear` like every overlay. Zero-React, immediate paint (ADR-040).
 *
 * @see systems/dimensions/line-parallel-offset-dim.ts — pure geometry SSoT
 * @see ./ghost-face-dim-paint.ts — `paintAlignedOverlayDimension` full-dimension draw SSoT
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { LineEntity } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import { cadToggleState } from '../../systems/constraints/cad-toggle-state';
import { mmToSceneUnits } from '../../utils/scene-units';
import { formatLengthForDisplay } from '../../config/display-length-format';
import { resolveParallelOffsetDim } from '../../systems/dimensions/line-parallel-offset-dim';
import { paintAlignedOverlayDimension } from './ghost-face-dim-paint';
import { OVERLAY_LINE_COLORS } from './overlay-line-style';

/**
 * Paint the perpendicular offset dimension between a line's ORIGINAL axis and its translated
 * ghost (`delta`). No-op when ORTHO is OFF or the move is along the axis (no perpendicular gap).
 */
export function paintLineParallelOffsetDim(
  ctx: CanvasRenderingContext2D,
  line: LineEntity,
  delta: Point2D,
  transform: ViewTransform,
  viewport: { readonly width: number; readonly height: number },
  sceneUnits: SceneUnits,
): void {
  if (!cadToggleState.isOrthoOn()) return; // κάθετη διάσταση ΜΟΝΟ με ΟΡΘΟ (Giorgio 2026-07-05)
  const dim = resolveParallelOffsetDim(line.start, line.end, delta);
  if (!dim) return;
  const mmPerScene = 1 / Math.max(mmToSceneUnits(sceneUnits), 1e-9);
  const label = formatLengthForDisplay(dim.distanceScene * mmPerScene, { unit: 'm' });
  paintAlignedOverlayDimension(
    ctx, dim.p1, dim.p2, dim.dimLineRef, label, transform, viewport, OVERLAY_LINE_COLORS.listeningDim,
  );
}
