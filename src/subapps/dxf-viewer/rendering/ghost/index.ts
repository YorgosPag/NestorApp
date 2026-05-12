/**
 * SSOT — Ghost preview rendering primitives.
 *
 * Single source of truth for drag-time "ghost" entity rendering shared by:
 *   - useMovePreview        (toolbar Move tool, 2-click translation)
 *   - useGripGhostPreview   (grip drag — center/vertex/edge handles)
 *
 * Both renderers paint onto the dedicated PreviewCanvas overlay (ADR-040)
 * via the same `drawGhostEntity()` primitive, using the same style constants.
 * No more bitmap-cache invalidation during drag, no more entity-color ghosts
 * scattered across the main canvas — every preview lives in one place.
 *
 * @see ADR-040 — Preview Canvas Performance
 * @see ADR-049 — Unified Move Tool
 */

export { applyEntityPreview, makeTranslationPreview } from './apply-entity-preview';
export type { EntityPreviewTransform } from './apply-entity-preview';
export { drawGhostEntity } from './draw-ghost-entity';

/**
 * Canonical ghost-preview style. Caller pre-applies these on the 2D context
 * before invoking `drawGhostEntity` — keeps per-frame overhead minimal and
 * allows batching multiple entities under a single save()/restore() block.
 */
export const GHOST_DEFAULTS = {
  /** Stroke + fill color (cyan-blue, matches AutoCAD MOVE preview). */
  color: '#00BFFF',
  /** Opacity multiplier for the whole ghost layer. */
  alpha: 0.45,
  /** Stroke width in screen pixels. */
  lineWidth: 1.5,
} as const;
