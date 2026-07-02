/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-552 + ADR-554 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * docs/centralized-systems/reference/adrs/ADR-552-analytical-overlay-dispatch-canvas.md
 * docs/centralized-systems/reference/adrs/ADR-554-proposal-dispatch-canvas.md
 *
 * Overlay dispatch frame — the ONE pull-model frame renderer shared by every "dispatch canvas"
 * that folds N overlays into ONE `<canvas>` (ADR-551 §5.3 pattern):
 *   • analytical overlays (ADR-552)  — React-`useEffect`-driven, transform from props.
 *   • MEP proposal ghosts (ADR-554)  — zero-lag scheduler-driven, transform from `getImmediateTransform()`.
 *
 * **Pull model:** the dispatch sizes (DPR-aware) + clears the canvas **ONCE**, then calls every
 * active painter in array (z-) order. A painter NEVER clears/resizes (else painters would wipe each
 * other — the reason the imperative `PreviewCanvas` push does not fit a multi-painter canvas).
 *
 * SSoT: extracted here so analytical (ADR-552) and proposal (ADR-554) share ONE frame renderer
 * instead of two byte-identical copies. The two dispatch COMPONENTS differ only in WHAT triggers a
 * repaint (React effect vs zero-lag scheduler) and WHICH painters they host — the per-frame
 * size+clear+ordered-paint loop is identical and lives here.
 */

import { CanvasUtils } from '../../../rendering/canvas/utils/CanvasUtils';
import type { ViewTransform, Viewport } from '../../../rendering/types/Types';

/**
 * One overlay layer's painter. Receives `transform`/`viewport` as args (not capture) so it stays
 * memoized on its own low-freq data and does not change identity on every pan/zoom. It only DRAWS
 * its content — never clears/resizes the shared canvas.
 */
export type OverlayDispatchPainter = (
  ctx: CanvasRenderingContext2D,
  transform: ViewTransform,
  viewport: Viewport,
) => void;

/**
 * Size (DPR-aware) + clear ONCE, then paint each active painter in order. `null` painters
 * (inactive layers) are skipped. No-op when the 2D context is unavailable.
 */
export function paintOverlayDispatchFrame(
  canvas: HTMLCanvasElement,
  painters: ReadonlyArray<OverlayDispatchPainter | null>,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  // 🏢 SSoT sizing — DPR-aware backing store via the ONE primitive (CanvasUtils.sizeCanvasToViewport),
  // shared with dxf/layer/preview/grid/floorplan. This block was byte-identical to the primitive; it
  // now delegates so there is a single source of truth for canvas-layer sizing.
  const ctx = CanvasUtils.sizeCanvasToViewport(canvas, viewport);
  if (!ctx) return;
  ctx.clearRect(0, 0, viewport.width, viewport.height);

  for (const paint of painters) {
    if (paint) paint(ctx, transform, viewport);
  }
}
