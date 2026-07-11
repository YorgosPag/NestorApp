/**
 * DXF GRIP COMPUTATION — SHARED TYPES
 *
 * Type declarations for the grip interaction / drag-preview pipeline.
 * Extracted from `grip-computation.ts` (pure type defs, no logic) so the
 * computation module stays under the 500-line limit. Re-exported from
 * `grip-computation.ts` for backwards-compatible import paths.
 *
 * @module hooks/grip-computation-types
 */

import type { Point2D } from '../rendering/types/Types';
// ADR-602 (ADR-587 Φ6) Stage 5 — tagged grip discriminator SSoT (canonical module).
import type { EntityGripKind } from './grip-kinds';

// ============================================================================
// TYPES (still used by grips/ modules and CanvasLayerStack)
// ============================================================================

/** Interaction phase of the grip state machine */
export type GripPhase = 'idle' | 'hovering' | 'warm' | 'dragging';

/** Unique grip identifier for rendering pipeline */
export interface GripIdentifier {
  entityId: string;
  gripIndex: number;
}

/** Drag preview data for live rendering */
export interface DxfGripDragPreview {
  entityId: string;
  gripIndex: number;
  delta: Point2D;
  movesEntity: boolean;
  edgeVertexIndices?: [number, number];
  /**
   * ADR-602 (ADR-587 Φ6) Stage 5 — tagged grip discriminator SSoT. The SOLE
   * per-entity grip discriminator: the legacy `xxxGripKind?` optionals were
   * removed (Wave 2). Consumed by `applyEntityPreview` to route the live ghost
   * through the entity-specific `applyXxxGripDrag` path. `anchorPos` carries the
   * grip world position captured at mouseDown so the preview can reconstruct
   * `currentPos = anchorPos + delta` (the same value the commit path uses). Read
   * via `gripKindOf(preview, '<entity.type>')`.
   */
  gripKind?: EntityGripKind;
  anchorPos?: Point2D;
  /**
   * ADR-637 Phase 4-D — target rest-landing id for the `stair-rest-landing-*` grips.
   * Forwarded from `UnifiedGripInfo.landingId` by `buildDxfDragPreview` so the live
   * WYSIWYG ghost (`applyEntityPreview` → `applyStairGripDrag`) edits the SAME landing
   * the commit (`commitStairGripDrag`) does — preview ≡ commit. Undefined for every
   * other grip kind.
   */
  landingId?: string;
  /**
   * ADR-363 Phase 1G — set when the active grip is a wall corner being moved via
   * the hot-grip (click-click) state. Consumed by `useGripGhostPreview` to draw
   * the dashed rubber-band leader from `anchorPos` → cursor (anchorPos + delta).
   */
  hotGrip?: boolean;
  /**
   * ADR-363 Phase 1G — rotation centre for the `wall-rotation` hot-grip. When set
   * the live ghost rotates around it (passed to `applyWallGripDrag` as `pivot`).
   */
  rotatePivot?: Point2D;
  /**
   * ADR-363 Phase 1G.3 — rotate-reference (6-click) guide segments, drawn dashed
   * by `useGripGhostPreview` (display-only; NOT consumed by `applyEntityPreview`).
   * `rotateRefLine` = the existing/reference direction the user traced (2 clicks);
   * `rotateAlignLine` = the target/alignment direction being traced live. The wall
   * spins by `angle(align) − angle(ref)` around `rotatePivot`.
   */
  rotateRefLine?: { from: Point2D; to: Point2D };
  rotateAlignLine?: { from: Point2D; to: Point2D };
  /**
   * ADR-397 Σ3 — signed sweep angle (degrees, +CCW/−CW) of a FREE rotate, for the
   * live ON-CURSOR angle readout drawn by `useGripGhostPreview`. Set from the cursor
   * sweep, or overridden by the typed angle while the user is keying one in.
   */
  rotateSweepDeg?: number;
  /** ADR-397 Σ3 — world anchor (the cursor) for the rotate angle readout pill. */
  rotateReadoutAnchor?: Point2D;
  /**
   * ADR-040 Φ12 — set when this rotation sweep is CURSOR-DRIVEN (free rotate, or the
   * 6-click reference `await-align-end` step), as opposed to a keyed-in typed angle.
   * Lets `useGripGhostPreview` recompute the sweep LIVE from the realtime effective-world
   * cursor (`resolveLiveRotationFromCursor`) so the rotating ghost is locked 1:1 to the
   * crosshair — same as translate. NOT set for typed-angle (the value is keyed, not the
   * cursor) → that flow keeps the React `dragPreview`.
   */
  rotateCursorDriven?: boolean;
}

/** Grip interaction state for rendering pipeline */
export interface DxfGripInteractionState {
  hoveredGrip?: GripIdentifier;
  activeGrip?: GripIdentifier;
  /**
   * ADR-501 — grip keys (`${entityId}_${gripIndex}`) clicked-to-select for a
   * multi-grip move → render orange ('armed'). Fed from {@link GripArmedStore}.
   */
  armedKeys?: ReadonlySet<string>;
}

/** Return type of useDxfGripInteraction */
export interface UseDxfGripInteractionReturn {
  gripInteractionState: DxfGripInteractionState;
  isDraggingGrip: boolean;
  /** @deprecated Use isDraggingGrip */
  isFollowingGrip: boolean;
  handleGripMouseMove: (worldPos: Point2D, screenPos: Point2D) => boolean;
  handleGripMouseDown: (worldPos: Point2D) => boolean;
  handleGripMouseUp: (worldPos: Point2D) => boolean;
  /** @deprecated No-op in drag-release model */
  handleGripClick: (worldPos: Point2D) => boolean;
  handleGripEscape: () => boolean;
  handleGripRightClick: () => boolean;
  dragPreview: DxfGripDragPreview | null;
}
