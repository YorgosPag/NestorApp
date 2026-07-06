/**
 * ADR-376 Phase C.1 — Opening Tag Drag Controller (pure FSM + hit-test math).
 *
 * Owns the drag finite-state machine for opening tag pills:
 *
 *   idle  ──pointerdown over tag──▶  dragging
 *   dragging ──pointermove──▶  emit new tagOffset (delta from default centroid)
 *   dragging ──pointerup──▶  commit final offset, return to idle
 *   dragging ──cancel──▶  rollback to startOffset, return to idle
 *
 * The drag math is screen-space → world-space conversion through the active
 * `ViewTransform` + `Viewport`. The `tagOffset` is stored in *world mm* delta
 * from the auto-centroid so that pan / zoom never affect the persisted value.
 *
 * Pure module — no React, no Zustand, no DOM listeners. The caller
 * (`use-opening-tag-drag-interaction` hook) owns DOM glue and persistence.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-376-opening-tags.md §C.1
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import type { OpeningEntity } from '../types/opening-types';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import {
  computeTagCenter,
  OPENING_TAG_MIN_ZOOM,
} from '../renderers/OpeningTagRenderer';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

export type TagDragFsmState = 'idle' | 'dragging';

/** Default screen-space half-width του pill για hit-test fallback (px). */
export const TAG_HIT_HALF_WIDTH_PX = 22;
/** Default screen-space half-height του pill για hit-test fallback (px). */
export const TAG_HIT_HALF_HEIGHT_PX = 12;

/** Below this screen-px distance from anchor, the leader is hidden. */
export const LEADER_MIN_SCREEN_DISTANCE_PX = 18;

export interface TagDragOffset {
  readonly dx: number;
  readonly dy: number;
}

export interface TagHitTestArgs {
  readonly openings: readonly OpeningEntity[];
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
  readonly clientX: number;
  readonly clientY: number;
  /** Bounding rect of the canvas DOM element — for client→canvas offset. */
  readonly canvasRect: { readonly left: number; readonly top: number };
}

export interface TagHitResult {
  readonly opening: OpeningEntity;
  /** Existing offset at drag start (used to compute incremental delta). */
  readonly startOffset: TagDragOffset;
}

export interface DragControllerEvents {
  readonly onDragStart?: (hit: TagHitResult) => void;
  readonly onDragMove?: (opening: OpeningEntity, offset: TagDragOffset) => void;
  readonly onDragEnd?: (opening: OpeningEntity, offset: TagDragOffset) => void;
  readonly onDragCancel?: (opening: OpeningEntity, startOffset: TagDragOffset) => void;
}

// ────────────────────────────────────────────────────────────────────────────
// PURE HELPERS (exported for unit tests)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Default offset (no user override yet). Used when entity.params.tagOffset is
 * undefined — the FSM still tracks a starting offset of (0, 0) so the delta
 * math during drag does not branch on `undefined`.
 */
export const NULL_OFFSET: TagDragOffset = { dx: 0, dy: 0 };

/**
 * Resolve the persisted `tagOffset` from an opening, falling back to (0, 0).
 */
export function getOffsetOrZero(opening: OpeningEntity): TagDragOffset {
  return opening.params.tagOffset ?? NULL_OFFSET;
}

/**
 * Compute the tag's world centre with the offset applied. Mirrors what the
 * renderer uses to draw the pill so that drag math + render math align.
 */
export function tagWorldCenter(opening: OpeningEntity): Point2D {
  const base = computeTagCenter(opening);
  const off = getOffsetOrZero(opening);
  // `base` is a Point3D (z:0); this is a 2D tag centre, so strip z after the
  // canonical translate to keep the Point2D contract (the pre-SSoT inline
  // `{ x: base.x+…, y: base.y+… }` dropped z implicitly).
  const world = translatePoint(base, { x: off.dx, y: off.dy });
  return { x: world.x, y: world.y };
}

/**
 * Test whether `(clientX, clientY)` lies inside any opening tag pill.
 * Iterates *backwards* so that openings drawn last (top of the z-order)
 * win the hit. Returns the deepest match.
 *
 * Hit area is the screen-space axis-aligned bounding box centred on the
 * computed pill centre. The exact pill text width is unknown without a
 * canvas measureText() pass — we use a conservative fixed half-width that
 * fits the typical `Π.123` mark string.
 */
export function hitTestTag(args: TagHitTestArgs): TagHitResult | null {
  if (args.transform.scale < OPENING_TAG_MIN_ZOOM) return null;
  const canvasX = args.clientX - args.canvasRect.left;
  const canvasY = args.clientY - args.canvasRect.top;
  for (let i = args.openings.length - 1; i >= 0; i--) {
    const opening = args.openings[i];
    if (!opening.params.mark) continue;
    if (opening.params.tagVisible === false) continue;
    const center = tagWorldCenter(opening);
    const screen = CoordinateTransforms.worldToScreen(
      { x: center.x, y: center.y },
      args.transform,
      args.viewport,
    );
    const dx = canvasX - screen.x;
    const dy = canvasY - screen.y;
    if (Math.abs(dx) <= TAG_HIT_HALF_WIDTH_PX && Math.abs(dy) <= TAG_HIT_HALF_HEIGHT_PX) {
      return { opening, startOffset: getOffsetOrZero(opening) };
    }
  }
  return null;
}

/**
 * Convert a screen-space delta (in canvas-local px) to a world-space delta
 * (mm) using the active transform. Pan-invariant: only the zoom scale
 * matters since we are computing a translation, not an absolute position.
 */
export function screenDeltaToWorldDelta(
  dxScreenPx: number,
  dyScreenPx: number,
  transform: ViewTransform,
): TagDragOffset {
  if (transform.scale === 0) return NULL_OFFSET;
  return {
    dx: dxScreenPx / transform.scale,
    // Canvas Y is inverted vs world Y (screen +y goes down). Flip on the way.
    dy: -dyScreenPx / transform.scale,
  };
}

/**
 * True when an offset is *significantly* different from (0, 0) — used to
 * decide whether the leader line should be drawn at all. Threshold expressed
 * in world mm so callers can reason in physical units.
 */
export function isOffsetSignificant(offset: TagDragOffset, minMm = 1): boolean {
  return Math.hypot(offset.dx, offset.dy) >= minMm;
}

// ────────────────────────────────────────────────────────────────────────────
// CONTROLLER (FSM)
// ────────────────────────────────────────────────────────────────────────────

export class OpeningTagDragController {
  private state: TagDragFsmState = 'idle';
  private activeOpening: OpeningEntity | null = null;
  private startOffset: TagDragOffset = NULL_OFFSET;
  /** Pointer position (canvas-local px) where the drag began. */
  private startCanvasX = 0;
  private startCanvasY = 0;

  getState(): TagDragFsmState {
    return this.state;
  }

  getActiveOpeningId(): string | null {
    return this.activeOpening?.id ?? null;
  }

  /**
   * Begin a drag. The caller has already performed hit-test and supplies
   * the matched opening + its pre-drag offset.
   */
  startDrag(
    hit: TagHitResult,
    startCanvasX: number,
    startCanvasY: number,
    events?: DragControllerEvents,
  ): void {
    this.state = 'dragging';
    this.activeOpening = hit.opening;
    this.startOffset = hit.startOffset;
    this.startCanvasX = startCanvasX;
    this.startCanvasY = startCanvasY;
    events?.onDragStart?.(hit);
  }

  /**
   * Process a pointermove during an active drag. Returns the new world
   * `tagOffset` (start offset + screen delta projected to world mm), or
   * `null` when no drag is active.
   */
  updateDrag(
    canvasX: number,
    canvasY: number,
    transform: ViewTransform,
    events?: DragControllerEvents,
  ): TagDragOffset | null {
    if (this.state !== 'dragging' || !this.activeOpening) return null;
    const deltaPx = {
      dx: canvasX - this.startCanvasX,
      dy: canvasY - this.startCanvasY,
    };
    const worldDelta = screenDeltaToWorldDelta(deltaPx.dx, deltaPx.dy, transform);
    const next: TagDragOffset = {
      dx: this.startOffset.dx + worldDelta.dx,
      dy: this.startOffset.dy + worldDelta.dy,
    };
    events?.onDragMove?.(this.activeOpening, next);
    return next;
  }

  /**
   * Commit the drag — emits the final offset and returns to idle. The
   * caller is responsible for persisting the new offset to Firestore.
   */
  endDrag(
    canvasX: number,
    canvasY: number,
    transform: ViewTransform,
    events?: DragControllerEvents,
  ): { opening: OpeningEntity; offset: TagDragOffset } | null {
    if (this.state !== 'dragging' || !this.activeOpening) return null;
    const opening = this.activeOpening;
    const offset = this.updateDrag(canvasX, canvasY, transform) ?? this.startOffset;
    events?.onDragEnd?.(opening, offset);
    this.state = 'idle';
    this.activeOpening = null;
    this.startOffset = NULL_OFFSET;
    return { opening, offset };
  }

  /**
   * Abort an in-flight drag (pointercancel, Escape, tool change). The
   * caller should rollback the optimistic scene patch to `startOffset`.
   */
  cancelDrag(events?: DragControllerEvents): void {
    if (this.state !== 'dragging' || !this.activeOpening) return;
    const opening = this.activeOpening;
    const startOffset = this.startOffset;
    this.state = 'idle';
    this.activeOpening = null;
    this.startOffset = NULL_OFFSET;
    events?.onDragCancel?.(opening, startOffset);
  }
}
