/**
 * USE TRANSFORM GHOST PREVIEW — Cluster #16 SSoT (ADR-625)
 *
 * Shared paint primitive for base-point transform overlays (SCALE / STRETCH — and
 * the natural home for MOVE / MIRROR / ROTATION later). Every base-point transform
 * paints the IDENTICAL manipulator frame:
 *   - a red base-point crosshair (#FF4444)
 *   - a dashed gold rubber-band (#FFD700) from base to cursor
 *   - a gold monospace value tooltip near the cursor
 *   - the live WYSIWYG copies rendered through the REAL entity renderer (ADR-550)
 *
 * The primitive also owns the WYSIWYG renderer wiring (`useBimPreviewRenderer` +
 * `useLevelLayersById`) and hands a ready `bimPreview` + `layers` into the caller's
 * {@link TransformGhostConfig.renderCopies}. The ONLY per-tool variation is the
 * value shown (×factor vs Δx,Δy) and how each copy is transformed — those live in
 * `buildTooltip` + `renderCopies`.
 *
 * Harness stack: {@link useGhostOverlay} → `useCanvasGhostPreview` (ADR-398 §4).
 *
 * @module hooks/tools/use-transform-ghost-preview
 * @see hooks/tools/use-ghost-overlay — subscribe + toScreen harness-consumption layer
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { AnySceneEntity } from '../../types/entities';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';
import { useBimPreviewRenderer } from './useBimPreviewRenderer';
import { useLevelLayersById } from './useLevelLayersById';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';
import { useGhostOverlay, type GhostOverlayStore } from './use-ghost-overlay';
// ADR-641 — the harness owns the BEDIT-aware entity getter so every base-point transform preview
// resolves a member in the editor's VIEW frame automatically (no per-tool getEntity boilerplate).
import { useBeditAwareEntityGetter } from './use-bedit-aware-entity-getter';
// ADR-646 Φ6 — O(1)/frame matrix ghost: render the selection ONCE, blit under one affine per frame.
import {
  TransformGhostMatrixCache, runMatrixGhost, type MatrixGhostConfig,
} from './transform-ghost-matrix-cache';

const BASE_POINT_COLOR = '#FF4444';
const RUBBER_BAND_COLOR = '#FFD700';

/**
 * Paint the identical manipulator chrome every base-point transform shares: a red base crosshair, a
 * dashed-gold rubber-band from base to cursor, and a gold monospace value tooltip. Screen-space inputs.
 */
function paintBasePointChrome(
  ctx: CanvasRenderingContext2D, basePt: Point2D, cursorPt: Point2D, label: string,
): void {
  ctx.save();
  ctx.strokeStyle = BASE_POINT_COLOR;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(basePt.x - 8, basePt.y); ctx.lineTo(basePt.x + 8, basePt.y);
  ctx.moveTo(basePt.x, basePt.y - 8); ctx.lineTo(basePt.x, basePt.y + 8);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = RUBBER_BAND_COLOR;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(basePt.x, basePt.y);
  ctx.lineTo(cursorPt.x, cursorPt.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.save();
  ctx.font = '12px monospace';
  ctx.fillStyle = RUBBER_BAND_COLOR;
  ctx.fillText(label, cursorPt.x + 12, cursorPt.y - 8);
  ctx.restore();
}

/** The REAL-entity preview renderer bound to the frame's ctx (ADR-550). */
type BimPreviewContext = ReturnType<ReturnType<typeof useBimPreviewRenderer>>;
/** The active level's layer table (id → layer). */
type LevelLayerTable = ReturnType<ReturnType<typeof useLevelLayersById>>;

/** Frame handed to `renderCopies` once the base crosshair / rubber-band / tooltip are painted. */
export interface TransformGhostFrame<S> {
  readonly ctx: CanvasRenderingContext2D;
  readonly state: S;
  readonly cursor: Point2D;
  readonly basePoint: Point2D;
  readonly transform: ViewTransform;
  readonly viewport: GhostDrawFrame['viewport'];
  readonly bimPreview: BimPreviewContext;
  readonly layers: LevelLayerTable;
  /** BEDIT-aware entity resolver (top-level, or the active block's member in VIEW space). ADR-641. */
  readonly getEntity: (id: string) => AnySceneEntity | null;
}

export interface TransformGhostConfig<S extends { phase: string }> {
  readonly store: GhostOverlayStore<S>;
  readonly levelManager: LevelSceneReader;
  readonly transform: ViewTransform;
  readonly getCanvas: () => HTMLCanvasElement | null;
  readonly getViewportElement?: () => HTMLElement | null;
  /** Reactive activation gate (redraw re-schedule trigger). */
  readonly isActivePhase: (phase: S['phase']) => boolean;
  /** Per-frame paint gate — the tool is mid-transform (e.g. phase + basePoint present). */
  readonly isDrawPhase: (state: S) => boolean;
  /** Base point of the transform (crosshair + rubber-band anchor). */
  readonly getBasePoint: (state: S) => Point2D | null;
  /** Cursor value label (×factor / Δx,Δy). */
  readonly buildTooltip: (state: S, cursor: Point2D, basePoint: Point2D) => string;
  /** Paint the live WYSIWYG copies. The renderer ctx is already saved/restored by the primitive. */
  readonly renderCopies: (frame: TransformGhostFrame<S>) => void;
  /**
   * ADR-646 Φ6 — opt-in O(1)/frame matrix ghost. When supplied AND the selection is rasterable, the
   * primitive renders the selection ONCE and blits it under a single affine per frame (independent of
   * entity count). Omit it (or return `null` from `getWorldAffine`) to stay on `renderCopies` — the
   * correct choice for per-vertex tools (stretch) and the automatic fallback for oversize selections.
   */
  readonly matrixGhost?: MatrixGhostConfig<S>;
}

export function useTransformGhostPreview<S extends { phase: string }>(
  config: TransformGhostConfig<S>,
): void {
  const {
    store, levelManager, transform, getCanvas, getViewportElement,
    isActivePhase, isDrawPhase, getBasePoint, buildTooltip, renderCopies, matrixGhost,
  } = config;

  // ADR-550 — lazy real-entity renderer + level layer-table getter (shared SSoT hooks).
  const getBimPreview = useBimPreviewRenderer();
  const layersById = useLevelLayersById(levelManager);
  // ADR-641 — BEDIT-aware entity getter handed to every renderCopies (members resolve in VIEW space).
  const getEntity = useBeditAwareEntityGetter(levelManager);
  // ADR-646 Φ6 — one offscreen ghost raster reused across the whole drag (mirrors ADR-516 backdrop).
  const matrixCacheRef = useRef<TransformGhostMatrixCache | null>(null);
  useEffect(() => () => { matrixCacheRef.current?.dispose(); matrixCacheRef.current = null; }, []);

  const draw = useCallback(
    (frame: GhostDrawFrame, s: S, toScreen: (p: Point2D) => Point2D) => {
      const { ctx, effectiveCursor } = frame;
      if (!isDrawPhase(s) || !effectiveCursor) return;
      const basePoint = getBasePoint(s);
      if (!basePoint) return;

      // Base crosshair + rubber-band + value tooltip (identical across every base-point transform).
      paintBasePointChrome(
        ctx, toScreen(basePoint), toScreen(effectiveCursor),
        buildTooltip(s, effectiveCursor, basePoint),
      );

      const layers = layersById();

      // ADR-646 Φ6 — matrix ghost: render the selection ONCE + blit under one affine (O(1)/frame). For
      // affine tools (scale/move/rotate) this replaces the O(N)-per-frame real render that froze huge
      // selections. Returns false for per-vertex tools / oversize selections → the renderCopies fallback.
      if (matrixGhost) {
        const cache = (matrixCacheRef.current ??= new TransformGhostMatrixCache());
        const handled = runMatrixGhost(cache, {
          ctx, state: s, cursor: effectiveCursor, basePoint,
          current: frame.transform, viewport: frame.viewport,
          getEntity: getEntity as (id: string) => DxfEntityUnion | null, layers, config: matrixGhost,
        });
        if (handled) return;
      }

      // Live WYSIWYG copies (full fidelity) — caller-owned transform per entity.
      ctx.save();
      const bimPreview = getBimPreview(ctx);
      renderCopies({
        ctx, state: s, cursor: effectiveCursor, basePoint,
        transform: frame.transform, viewport: frame.viewport, bimPreview, layers, getEntity,
      });
      ctx.restore();
    },
    [isDrawPhase, getBasePoint, buildTooltip, renderCopies, matrixGhost, getBimPreview, layersById, getEntity],
  );

  useGhostOverlay<S>({
    store,
    isActive: isActivePhase,
    transform,
    getCanvas,
    getViewportElement,
    draw,
  });
}
