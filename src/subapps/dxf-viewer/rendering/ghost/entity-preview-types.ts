/**
 * SSOT — EntityPreviewTransform type
 *
 * Per-entity drag-preview descriptor shared by `applyEntityPreview` and its
 * callers (Move tool, grip drag). Extracted from `apply-entity-preview.ts`
 * (2026-06-04 file-size split) — pure types, no logic.
 *
 * @see rendering/ghost/apply-entity-preview — consumer
 * @see ADR-040 — Preview Canvas Performance (unified ghost preview)
 * @see ADR-049 — Move Tool / Grip Drag SSoT
 */

import type { Point2D } from '../types/Types';
// ADR-602 (ADR-587 Φ6) Stage 5 — tagged grip discriminator SSoT (canonical module).
import type { EntityGripKind } from '../../hooks/grip-kinds';

/**
 * Per-entity preview transform. Structurally compatible with `DxfGripDragPreview`
 * (the grip system's projection) so callers can pass the value through without
 * re-mapping.
 *
 * Semantics:
 *  - `movesEntity=true`        → translate every coordinate by `delta`
 *  - `edgeVertexIndices`       → translate exactly two vertices (edge stretch)
 *  - otherwise (`gripIndex`)   → stretch single vertex / quadrant / arc end
 */
export interface EntityPreviewTransform {
  readonly entityId: string;
  readonly gripIndex: number;
  readonly delta: Point2D;
  readonly movesEntity: boolean;
  readonly edgeVertexIndices?: readonly [number, number];
  /**
   * ADR-363 Phase 1G — rotation centre for the `wall-rotation` 3-click hot-grip.
   * Passed to `applyWallGripDrag` as `pivot` so the live ghost rotates around the
   * picked centre instead of the wall midpoint.
   */
  readonly rotatePivot?: Point2D;
  /**
   * ADR-602 (ADR-587 Φ6) Stage 5 — tagged grip discriminator SSoT. The SOLE
   * per-entity grip discriminator: the legacy `xxxGripKind?` optionals were
   * removed (Wave 2). Routes the preview through the entity-specific
   * `applyXxxGripDrag` path (params-only or geometry recompute per entity kind).
   * `anchorPos` = the grabbed grip world pos at mouseDown (rotation sweep start).
   * Read via `gripKindOf(transform, '<entity.type>')`.
   */
  readonly gripKind?: EntityGripKind;
  readonly anchorPos?: Point2D;
}
