/**
 * ADR-376 Phase A — Opening Tag Renderer (Ταμπελάκια Ανοιγμάτων).
 *
 * 2D-only annotation overlay για openings. Draws a uniform pill (canvas-pill
 * SSoT, identical με dimension labels ADR-362 και column dim pills) στο
 * auto-centroid του opening, offset normal-to-wall outward. Colour-coded ανά
 * `OpeningKind` (reuses `OPENING_KIND_STROKE`, ADR-376 Q4 decision).
 *
 * Standalone helper class — NOT a `BaseEntityRenderer` subclass — γιατί ο tag
 * δεν είναι entity but annotation των openings. Called by `OpeningRenderer.
 * render()` μετά το geometry pass.
 *
 * ADR-040 compliance: pure renderer, ZERO subscriptions to high-frequency
 * stores. All inputs passed as arguments by the caller.
 *
 * Visibility chain (any FALSE → no draw):
 *   1. `layerVisible` (caller, layer `__system_opening_tags__` state)
 *   2. `opening.params.tagVisible !== false` (per-opening override)
 *   3. `opening.params.mark` not empty
 *   4. `transform.scale ≥ OPENING_TAG_MIN_ZOOM`
 *
 * @see docs/centralized-systems/reference/adrs/ADR-376-opening-tags.md §4.4
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { OpeningEntity } from '../types/opening-types';
import type { Point3D } from '../types/bim-base';
import { OPENING_KIND_STROKE } from './opening-kind-style';
import {
  PILL_FONT,
  PILL_TEXT_COLOR,
  PILL_BG_COLOR,
  PILL_PADDING,
  PILL_RADIUS,
  pillPath,
} from '../../rendering/utils/canvas-pill';

/** Below this zoom scale, tags are hidden to reduce clutter. */
export const OPENING_TAG_MIN_ZOOM = 0.5;

/** mm — distance the tag centre is pushed normal-to-wall outward από το centroid. */
const TAG_OFFSET_MM = 500;

const LINE_HEIGHT = 11;

/** Screen-px below which the leader line is skipped (tag sits on the anchor). */
const LEADER_MIN_DISTANCE_PX = 18;
/** Leader line colour — neutral grey ώστε να μην ανταγωνίζεται το pill border. */
const LEADER_COLOR = '#7a8696';
/** Leader line width in screen pixels. */
const LEADER_WIDTH_PX = 1;

/**
 * Public arguments contract για a single tag render call. The caller resolves
 * layer state και supplies the canvas context + transform.
 */
export interface RenderOpeningTagArgs {
  readonly ctx: CanvasRenderingContext2D;
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
  readonly opening: OpeningEntity;
  /** Layer `__system_opening_tags__` visibility. False → no draw. */
  readonly layerVisible: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ────────────────────────────────────────────────────────────────────────────

export class OpeningTagRenderer {
  render(args: RenderOpeningTagArgs): void {
    if (!shouldRenderTag(args.opening, args.layerVisible, args.transform.scale)) return;
    const mark = args.opening.params.mark;
    if (!mark) return;

    // ADR-376 Phase C.1 — anchor = auto-centroid (without offset); pill = anchor
    // + user `tagOffset` delta. Leader drawn between the two when distance is
    // significant. Always rendered "tag horizontal" (Q2 industry default 3/3).
    const anchorWorld = computeTagCenter(args.opening);
    const offset = args.opening.params.tagOffset ?? { dx: 0, dy: 0 };
    const tagWorld = { x: anchorWorld.x + offset.dx, y: anchorWorld.y + offset.dy };

    const anchorScreen = CoordinateTransforms.worldToScreen(
      { x: anchorWorld.x, y: anchorWorld.y },
      args.transform,
      args.viewport,
    );
    const tagScreen = CoordinateTransforms.worldToScreen(
      { x: tagWorld.x, y: tagWorld.y },
      args.transform,
      args.viewport,
    );

    const color = OPENING_KIND_STROKE[args.opening.kind];
    drawLeaderLine(args.ctx, anchorScreen, tagScreen);
    drawPillTag(args.ctx, tagScreen, mark, color);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// PURE HELPERS (exported for unit tests)
// ────────────────────────────────────────────────────────────────────────────

export function shouldRenderTag(
  opening: OpeningEntity,
  layerVisible: boolean,
  zoomScale: number,
): boolean {
  if (!layerVisible) return false;
  if (opening.params.tagVisible === false) return false;
  if (!opening.params.mark) return false;
  if (zoomScale < OPENING_TAG_MIN_ZOOM) return false;
  return true;
}

/**
 * Auto-centroid + offset normal-to-wall outward. The outline rectangle vertex
 * order is `[start-outer, end-outer, end-inner, start-inner]` (see
 * `computeOpeningGeometry`). The outward normal is the unit vector from
 * `inner-mid` toward `outer-mid`.
 */
export function computeTagCenter(opening: OpeningEntity): Point3D {
  const verts = opening.geometry.outline.vertices;
  if (verts.length < 4) return opening.geometry.position;

  const cx = (verts[0].x + verts[1].x + verts[2].x + verts[3].x) / 4;
  const cy = (verts[0].y + verts[1].y + verts[2].y + verts[3].y) / 4;

  const outerMidX = (verts[0].x + verts[1].x) / 2;
  const outerMidY = (verts[0].y + verts[1].y) / 2;
  const innerMidX = (verts[2].x + verts[3].x) / 2;
  const innerMidY = (verts[2].y + verts[3].y) / 2;

  const nx = outerMidX - innerMidX;
  const ny = outerMidY - innerMidY;
  const len = Math.hypot(nx, ny);
  if (len === 0) return { x: cx, y: cy, z: 0 };

  const ux = nx / len;
  const uy = ny / len;

  return {
    x: cx + ux * TAG_OFFSET_MM,
    y: cy + uy * TAG_OFFSET_MM,
    z: 0,
  };
}

/**
 * ADR-376 Phase C.1 — γωνιακή (elbow) leader line from the opening centroid
 * (`anchor`) to the tag pill centre (`tag`). Single 90° break point: half the
 * horizontal run, then the vertical run, then the remaining horizontal run.
 * This is the Revit 2027 / ArchiCAD plan-annotation default — keeps the
 * leader visually parallel-to-axis even when the user drags diagonally.
 *
 * Pattern (anchor → break1 → break2 → tag) when |Δx| > |Δy|:
 *   anchor ───── break1
 *                  │
 *                break2 ───── tag
 *
 * Skipped when the tag sits within `LEADER_MIN_DISTANCE_PX` of the anchor —
 * avoids a degenerate "stub" leader inside the pill border.
 */
export function drawLeaderLine(
  ctx: CanvasRenderingContext2D,
  anchor: Point2D,
  tag: Point2D,
): void {
  const dx = tag.x - anchor.x;
  const dy = tag.y - anchor.y;
  if (Math.hypot(dx, dy) < LEADER_MIN_DISTANCE_PX) return;

  ctx.save();
  ctx.strokeStyle = LEADER_COLOR;
  ctx.lineWidth = LEADER_WIDTH_PX;
  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y);
  // Elbow break: split half-horizontal, then full vertical, then half-horizontal.
  // For mostly-vertical drags (|dy| > |dx|) swap to split-vertical for cleaner shape.
  if (Math.abs(dx) >= Math.abs(dy)) {
    const midX = anchor.x + dx / 2;
    ctx.lineTo(midX, anchor.y);
    ctx.lineTo(midX, tag.y);
    ctx.lineTo(tag.x, tag.y);
  } else {
    const midY = anchor.y + dy / 2;
    ctx.lineTo(anchor.x, midY);
    ctx.lineTo(tag.x, midY);
    ctx.lineTo(tag.x, tag.y);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw centred pill at `screenCenter`. Pure canvas — no React, no stores.
 * Mirrors `drawColumnDimPill()` pattern (`column-dim-labels.ts`).
 *
 * The pill is rendered με:
 *   - white-ish background (canvas-pill PILL_BG_COLOR)
 *   - dark text (canvas-pill PILL_TEXT_COLOR)
 *   - 1px stroke σε kind colour, so the tag visually links to the opening
 */
export function drawPillTag(
  ctx: CanvasRenderingContext2D,
  screenCenter: Point2D,
  mark: string,
  kindColor: string,
): void {
  ctx.save();
  ctx.font = PILL_FONT;
  const textWidth = ctx.measureText(mark).width;
  const pillW = textWidth + PILL_PADDING * 2;
  const pillH = LINE_HEIGHT + PILL_PADDING * 2;
  const x = screenCenter.x - pillW / 2;
  const y = screenCenter.y - pillH / 2;

  pillPath(ctx, x, y, pillW, pillH, PILL_RADIUS);
  ctx.fillStyle = PILL_BG_COLOR;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = kindColor;
  ctx.stroke();

  ctx.fillStyle = PILL_TEXT_COLOR;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(mark, screenCenter.x, screenCenter.y);
  ctx.restore();
}

