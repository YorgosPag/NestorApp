/**
 * USE CORNER TOOL PREVIEW — Cluster #16 SSoT (ADR-625)
 *
 * Shared paint primitive for the two-line corner edit tools (CHAMFER bevel /
 * FILLET arc). Both overlays share the IDENTICAL frame:
 *   - active-tool + phase gate (`picking-first` | `picking-second`)
 *   - hover hit-test → recompute ghost geometry every frame → dashed green stroke
 *   - a value label near the cursor (d1×d2 / ∠ / R …)
 *   - a yellow pickbox crosshair
 *
 * The per-tool variation is the geometry: which entities to hit-test and how to
 * compute the resulting bevel/arc + trimmed edges. The IDENTICAL polyline-mode /
 * same-polyline-corner branches are hoisted here ({@link buildCornerPolylineStrokes});
 * only the genuinely divergent two-line dispatch stays in the caller's
 * {@link CornerPreviewConfig.computeStrokes}.
 *
 * Harness stack: {@link useGhostOverlay} → `useCanvasGhostPreview` (ADR-398 §4).
 * `useActiveTool` (ADR-055) gates painting so the pickbox/label never bleed into
 * other tools (both corner stores have NO distinct 'idle' phase — their reset
 * ready-state is 'picking-first').
 *
 * @module hooks/tools/use-corner-tool-preview
 * @see hooks/tools/use-ghost-overlay — subscribe + toScreen harness-consumption layer
 */

import { useCallback } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';
import { distanceToEntity } from '../../utils/entity-distance';
import { resolveSharedPolylineCorner } from '../../systems/corner/corner-math';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import type { Entity } from '../../types/entities';
import type { SceneModel } from '../../types/scene';
import { useActiveTool } from '../../stores/ToolStateStore';
import type { ToolType } from '../../ui/toolbar/types';
import { useGhostOverlay, type GhostOverlayStore } from './use-ghost-overlay';
import { tracePolyline } from './overlay-draw-primitives';

const GHOST_COLOR = '#22DD55';
const PICKBOX_COLOR = '#FFD24A';

/** One ghost stroke: an entity to tessellate (via `pathFn`) and whether to close it. */
export interface CornerGhostStroke {
  readonly entity: Entity;
  readonly close: boolean;
}

/** A corner-geometry result with a closable entity (whole polyline / same-polyline corner). */
export interface PolylineCornerResult {
  readonly entity: Entity & { readonly closed?: boolean };
}

/** State fields the shared polyline branches read (both corner stores satisfy it). */
export interface CornerPolyState {
  readonly phase: string;
  readonly polylineMode: boolean;
  readonly first: Entity | null;
  readonly firstPick: Point2D | null;
}

export interface CornerPreviewConfig<S extends { readonly phase: string }> {
  readonly store: GhostOverlayStore<S>;
  /** Active-tool id this preview belongs to (paint only while it is active). */
  readonly activeToolId: ToolType;
  readonly transform: ViewTransform;
  readonly getCanvas: () => HTMLCanvasElement | null;
  readonly getViewportElement?: () => HTMLElement | null;
  /** Live scene getter (event-time read, not captured) for the hover hit-test. */
  readonly getScene: () => SceneModel | null;
  /**
   * Bespoke geometry: hit-test the scene under the cursor and return the ghost
   * strokes (bevel/arc + trimmed edges). Empty array = nothing to paint this frame.
   */
  readonly computeStrokes: (
    state: S,
    scene: SceneModel,
    cursor: Point2D,
    tol: number,
  ) => ReadonlyArray<CornerGhostStroke>;
  /** Cursor label text (d1×d2 / ∠ / R …). */
  readonly buildLabel: (state: S) => string;
  /** Entity → screen-space polyline tessellator (chamfer: SSoT path; fillet: arc-degrees). */
  readonly pathFn: (entity: Entity) => ReadonlyArray<Point2D>;
}

export function useCornerToolPreview<S extends { readonly phase: string }>(
  config: CornerPreviewConfig<S>,
): void {
  const {
    store, activeToolId, transform, getCanvas, getViewportElement,
    getScene, computeStrokes, buildLabel, pathFn,
  } = config;

  const activeTool = useActiveTool();

  const draw = useCallback(
    (frame: GhostDrawFrame, s: S, toScreen: (p: Point2D) => Point2D) => {
      const { ctx, effectiveCursor, transform: t } = frame;
      const scene = getScene();

      if (effectiveCursor && scene) {
        const tol = TOLERANCE_CONFIG.SNAP_DEFAULT / (t.scale || 1);
        for (const stroke of computeStrokes(s, scene, effectiveCursor, tol)) {
          strokeGhost(ctx, stroke.entity, toScreen, stroke.close, pathFn);
        }
        // Value label near the cursor (AutoCAD dynamic-input style).
        const c = toScreen(effectiveCursor);
        ctx.save();
        ctx.fillStyle = GHOST_COLOR;
        ctx.font = '12px sans-serif';
        ctx.fillText(buildLabel(s), c.x + 12, c.y - 12);
        ctx.restore();
      }

      // Pickbox crosshair.
      if (!effectiveCursor) return;
      const c = toScreen(effectiveCursor);
      ctx.save();
      ctx.strokeStyle = PICKBOX_COLOR;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(c.x - 6, c.y - 6, 12, 12);
      ctx.restore();
    },
    [getScene, computeStrokes, buildLabel, pathFn],
  );

  useGhostOverlay<S>({
    store,
    isActive: (phase) => activeTool === activeToolId && (phase === 'picking-first' || phase === 'picking-second'),
    transform,
    getCanvas,
    getViewportElement,
    draw,
  });
}

/** Dashed-green ghost stroke of one entity, tessellated via the caller's `pathFn`. */
function strokeGhost(
  ctx: CanvasRenderingContext2D,
  entity: Entity,
  toScreen: (p: Point2D) => Point2D,
  close: boolean,
  pathFn: (entity: Entity) => ReadonlyArray<Point2D>,
): void {
  const path = pathFn(entity);
  if (path.length < 2) return;
  ctx.save();
  ctx.strokeStyle = GHOST_COLOR;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  tracePolyline(ctx, path, toScreen);
  if (close) ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/**
 * Nearest scene entity matching a predicate within `tol`, by point-distance.
 * Shared by the chamfer/fillet hover hit-tests (line / polyline / fillet-target).
 */
export function nearestEntityMatching<T extends Entity>(
  scene: SceneModel,
  cursor: Point2D,
  tol: number,
  predicate: (e: Entity) => e is T,
  distanceFn: (cursor: Point2D, e: T, tol: number) => number | null,
  excludeId?: string,
): T | null {
  let best: { e: T; d: number } | null = null;
  for (const e of scene.entities) {
    if ((excludeId !== undefined && e.id === excludeId) || !predicate(e)) continue;
    const d = distanceFn(cursor, e, tol);
    if (d === null || d > tol) continue;
    if (!best || d < best.d) best = { e, d };
  }
  return best?.e ?? null;
}

/**
 * The IDENTICAL polyline branches shared by CHAMFER and FILLET:
 *   - «Polyline» mode → one pick chamfers/fillets EVERY fitting corner.
 *   - picking-second + first is a polyline → same-polyline corner ghost.
 * Returns the strokes when a polyline branch applies (possibly empty), or `null`
 * to fall through to the caller's bespoke two-line dispatch.
 */
export function buildCornerPolylineStrokes<Poly extends Entity>(
  s: CornerPolyState,
  scene: SceneModel,
  cursor: Point2D,
  tol: number,
  isPolyline: (e: Entity) => e is Poly,
  wholePolyline: (poly: Poly) => PolylineCornerResult | null,
  polylineCorner: (poly: Poly, cornerIndex: number) => PolylineCornerResult | null,
): CornerGhostStroke[] | null {
  if (s.polylineMode) {
    const poly = nearestEntityMatching(scene, cursor, tol, isPolyline, distanceToEntity);
    if (!poly) return [];
    const res = wholePolyline(poly);
    return res ? [{ entity: res.entity, close: res.entity.closed === true }] : [];
  }
  if (s.phase === 'picking-second' && s.first && isPolyline(s.first)) {
    const first = s.first;
    const d = distanceToEntity(cursor, first, tol);
    if (d === null || d > tol) return [];
    const cornerIndex = resolveSharedPolylineCorner(first, s.firstPick ?? cursor, cursor);
    if (cornerIndex === null) return [];
    const res = polylineCorner(first, cornerIndex);
    return res ? [{ entity: res.entity, close: res.entity.closed === true }] : [];
  }
  return null;
}

/**
 * Full CHAMFER/FILLET stroke resolution: try the shared polyline branches
 * ({@link buildCornerPolylineStrokes}); otherwise, once we know it is the
 * two-line `picking-second` case, delegate to the caller's bespoke `twoLines`
 * (bevel vs tangent-arc/curve). Keeps the identical dispatch in ONE place.
 */
export function resolveCornerStrokes<S extends CornerPolyState, Poly extends Entity>(
  s: S,
  scene: SceneModel,
  cursor: Point2D,
  tol: number,
  ops: {
    readonly isPolyline: (e: Entity) => e is Poly;
    readonly wholePolyline: (poly: Poly) => PolylineCornerResult | null;
    readonly polylineCorner: (poly: Poly, cornerIndex: number) => PolylineCornerResult | null;
    readonly twoLines: (state: S, first: Entity, scene: SceneModel, cursor: Point2D, tol: number) => ReadonlyArray<CornerGhostStroke>;
  },
): ReadonlyArray<CornerGhostStroke> {
  const polyStrokes = buildCornerPolylineStrokes(s, scene, cursor, tol, ops.isPolyline, ops.wholePolyline, ops.polylineCorner);
  if (polyStrokes !== null) return polyStrokes;
  if (!(s.phase === 'picking-second' && s.first)) return [];
  return ops.twoLines(s, s.first, scene, cursor, tol);
}
