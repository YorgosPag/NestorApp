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

export { applyEntityPreview, normalizePreviewEntity } from './apply-entity-preview';
export { makeTranslationPreview } from './make-translation-preview';
export type { EntityPreviewTransform } from './apply-entity-preview';
export { drawGhostEntity } from './draw-ghost-entity';
// Cross-backend ghost opacity policy (shared with the 3D WebGL overlays) — SSoT.
import { GHOST_ALPHA } from './ghost-policy';
export { GHOST_ALPHA } from './ghost-policy';
// NOTE: `drawRealEntityPreview` is intentionally NOT re-exported here — it pulls in the full
// EntityRendererComposite (41 leaf renderers). Import it directly from
// './draw-real-entity-preview' to keep this lightweight barrel free of that heavy graph.

/**
 * Canonical ghost-preview style. Caller pre-applies these on the 2D context
 * before invoking `drawGhostEntity` — keeps per-frame overhead minimal and
 * allows batching multiple entities under a single save()/restore() block.
 */
export const GHOST_DEFAULTS = {
  /** Stroke + fill color (cyan-blue, matches AutoCAD MOVE preview). */
  color: '#00BFFF',
  /** Opacity multiplier for the whole ghost layer (shared 2D+3D policy SSoT). */
  alpha: GHOST_ALPHA,
  /** Stroke width in screen pixels. */
  lineWidth: 1.5,
} as const;
