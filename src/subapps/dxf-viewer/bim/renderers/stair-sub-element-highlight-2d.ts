/**
 * stair-sub-element-highlight-2d — 2D plan highlight of a selected tread
 * (ADR-358 Q19 Φ3a). Extracted from `StairRenderer` to keep it under the 500-line
 * SRP limit (N.7.1).
 *
 * Reads the SHARED `useStairSubElementSelectionStore.selected` ref (low-freq —
 * click / Tab / Esc) so a tread sub-selected in 3D (Φ1/Φ2) highlights in the 2D
 * plan too ("3D mirrors 2D"). A translucent cyan fill + outline, reusing the
 * `EDIT_EDGE_HIGHLIGHT` SSoT colour (same "sub-element under edit" language as the
 * ADR-417 roof per-edge highlight).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §Q19
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Polygon3D } from '../types/stair-types';
import type { StairSubElementRef } from '../stairs/stair-sub-element-selection-store';
import { UI_COLORS_BASE } from '../../config/color-config';

const FILL_ALPHA = 0.25;
const OUTLINE_WIDTH_PX = 2;

/**
 * Paint the selection halo for a stair sub-element. No-op when `selected` is null,
 * targets a different stair, is not a tread, or the index is out of range.
 * `allTreads` MUST be the global build-order list so `selected.index` aligns with
 * the store / 3D tag / `perTreadOverrides`.
 */
export function drawStairSubElementHighlight(
  ctx: CanvasRenderingContext2D,
  worldToScreen: (p: Point2D) => Point2D,
  allTreads: readonly Polygon3D[],
  stairId: string,
  selected: StairSubElementRef | null,
): void {
  if (!selected || selected.stairId !== stairId || selected.part !== 'tread') return;
  const tread = allTreads[selected.index];
  if (!tread || tread.length < 3) return;

  ctx.save();
  ctx.setLineDash([]);
  ctx.beginPath();
  const first = worldToScreen({ x: tread[0]!.x, y: tread[0]!.y });
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < tread.length; i++) {
    const s = worldToScreen({ x: tread[i]!.x, y: tread[i]!.y });
    ctx.lineTo(s.x, s.y);
  }
  ctx.closePath();

  ctx.globalAlpha = FILL_ALPHA;
  ctx.fillStyle = UI_COLORS_BASE.EDIT_EDGE_HIGHLIGHT;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = OUTLINE_WIDTH_PX;
  ctx.strokeStyle = UI_COLORS_BASE.EDIT_EDGE_HIGHLIGHT;
  ctx.stroke();
  ctx.restore();
}
