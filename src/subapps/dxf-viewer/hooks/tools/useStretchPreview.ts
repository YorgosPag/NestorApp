/**
 * USE STRETCH PREVIEW — ADR-349 Phase 1c-B1
 *
 * Live ghost overlay for the STRETCH / MSTRETCH command during the
 * `displacement` phase. Subscribes to {@link StretchToolStore} (LOW-freq —
 * one transition per click) and {@link useCursorWorldPosition} (60fps), then
 * draws a translucent ghost of every captured entity translated by the live
 * delta `(cursor - basePoint)`.
 *
 * Pattern: identical to {@link useScalePreview} / {@link useMovePreview}
 * (ADR-040 micro-leaf — RAF-driven, zero React re-renders).
 *
 * Phase 1c-B1 scope:
 *  - Anchor entities (`capturedEntities`) → whole-entity translation ghost
 *  - Per-vertex entities (`capturedVertices`) → partial deformation ghost via
 *    {@link applyVertexDisplacement} SSoT (same math the command uses on commit
 *    — preview cannot diverge from final result by construction).
 *  - Base-point crosshair (red) + rubber-band line (dashed gold) + Δx,Δy tooltip
 *
 * Deferred:
 *  - Crossing-window in-command drag preview (Phase 1c — selection sub-machine)
 *  - DIMENSION defpoint follow-up & HATCH associative re-fit
 *
 * @module hooks/tools/useStretchPreview
 */

import { useCallback, useRef, useEffect, useSyncExternalStore } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { Entity, AnySceneEntity } from '../../types/entities';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { useCursorWorldPosition } from '../../systems/cursor/useCursor';
import { StretchToolStore } from '../../systems/stretch/StretchToolStore';
import {
  applyVertexDisplacement,
  translateEntityByAnchor,
} from '../../systems/stretch/stretch-entity-transform';
import { drawGhostEntity, GHOST_DEFAULTS } from '../../rendering/ghost';
import type { useLevels } from '../../systems/levels';
import type { VertexRef } from '../../systems/stretch/stretch-vertex-classifier';

// ── Types ─────────────────────────────────────────────────────────────────────

type LevelManagerLike = Pick<ReturnType<typeof useLevels>, 'getLevelScene' | 'currentLevelId'>;

export interface UseStretchPreviewProps {
  levelManager: LevelManagerLike;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useStretchPreview(props: UseStretchPreviewProps): void {
  const { levelManager, transform, getCanvas, getViewportElement } = props;
  const cursorWorld = useCursorWorldPosition();
  const rafRef = useRef<number>(0);

  const phase = useSyncExternalStore(
    StretchToolStore.subscribe,
    () => StretchToolStore.getState().phase,
  );

  // O(1) entity lookup memoised on scene array identity (rebuilt only when scene swaps).
  const entityMapRef = useRef<Map<string, AnySceneEntity>>(new Map());
  const entityArrayRef = useRef<readonly AnySceneEntity[] | null>(null);

  const getEntity = useCallback((id: string): AnySceneEntity | null => {
    if (!levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene?.entities) return null;
    if (scene.entities !== entityArrayRef.current) {
      entityArrayRef.current = scene.entities;
      entityMapRef.current = new Map(scene.entities.map(e => [e.id, e]));
    }
    return entityMapRef.current.get(id) ?? null;
  }, [levelManager]);

  const getViewport = useCallback((canvas: HTMLCanvasElement) => {
    const el = getViewportElement?.() ?? canvas;
    const rect = el.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }, [getViewportElement]);

  const drawFrame = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const s = StretchToolStore.getState();
    if (s.phase !== 'displacement' || !s.basePoint || !cursorWorld) return;

    const viewport = getViewport(canvas);
    const toScreen = (p: Point2D) => CoordinateTransforms.worldToScreen(p, transform, viewport);
    const basePt = toScreen(s.basePoint);
    const cursorPt = toScreen(cursorWorld);

    // Base point crosshair (red)
    ctx.save();
    ctx.strokeStyle = '#FF4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(basePt.x - 8, basePt.y); ctx.lineTo(basePt.x + 8, basePt.y);
    ctx.moveTo(basePt.x, basePt.y - 8); ctx.lineTo(basePt.x, basePt.y + 8);
    ctx.stroke();
    ctx.restore();

    // Rubber band (dashed gold)
    ctx.save();
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(basePt.x, basePt.y);
    ctx.lineTo(cursorPt.x, cursorPt.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    const delta: Point2D = { x: cursorWorld.x - s.basePoint.x, y: cursorWorld.y - s.basePoint.y };

    // Δ tooltip
    ctx.save();
    ctx.font = '12px monospace';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`Δ${delta.x.toFixed(1)}, ${delta.y.toFixed(1)}`, cursorPt.x + 12, cursorPt.y - 8);
    ctx.restore();

    if (Math.abs(delta.x) < 0.001 && Math.abs(delta.y) < 0.001) return;

    // ── Ghost entities ──
    ctx.save();
    ctx.globalAlpha = GHOST_DEFAULTS.alpha;
    ctx.strokeStyle = GHOST_DEFAULTS.color;
    ctx.fillStyle = GHOST_DEFAULTS.color;
    ctx.lineWidth = GHOST_DEFAULTS.lineWidth;

    // Group captured vertices by entityId once per frame.
    const refsByEntity = groupRefsByEntity(s.capturedVertices);

    // Anchor entities → whole-entity translation
    for (const entityId of s.capturedEntities) {
      const entity = getEntity(entityId);
      if (!entity) continue;
      const ghost = buildAnchorGhost(entity as Entity, delta);
      if (ghost) drawGhostEntity(ctx, ghost, transform, viewport);
    }

    // Per-vertex entities → partial deformation
    for (const [entityId, refs] of refsByEntity) {
      const entity = getEntity(entityId);
      if (!entity) continue;
      const ghost = buildVertexGhost(entity as Entity, refs, delta);
      if (ghost) drawGhostEntity(ctx, ghost, transform, viewport);
    }

    ctx.restore();
  }, [cursorWorld, transform, getCanvas, getViewport, getEntity]);

  // RAF only during displacement phase
  useEffect(() => {
    if (phase !== 'displacement') return;
    rafRef.current = requestAnimationFrame(drawFrame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [phase, drawFrame]);

  // Clear canvas when leaving displacement phase
  useEffect(() => {
    if (phase === 'displacement') return;
    const canvas = getCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [phase, getCanvas]);
}

// ── Pure ghost builders (SSoT-aligned with stretch-entity-transform) ─────────

function groupRefsByEntity(refs: ReadonlyArray<VertexRef>): Map<string, VertexRef[]> {
  const map = new Map<string, VertexRef[]>();
  for (const r of refs) {
    const list = map.get(r.entityId);
    if (list) list.push(r); else map.set(r.entityId, [r]);
  }
  return map;
}

function buildAnchorGhost(entity: Entity, delta: Point2D): DxfEntityUnion | null {
  const partial = translateEntityByAnchor(entity, delta);
  if (Object.keys(partial).length === 0) return null;
  return { ...entity, ...partial } as DxfEntityUnion;
}

function buildVertexGhost(
  entity: Entity,
  refs: ReadonlyArray<VertexRef>,
  delta: Point2D,
): DxfEntityUnion | null {
  const result = applyVertexDisplacement(entity, refs, delta);
  if (result.kind === 'noop') return null;
  if (result.kind === 'update') return { ...entity, ...result.updates } as DxfEntityUnion;
  // 'replace' — wholesale entity replacement (e.g. rectangle → polyline coercion).
  return result.entity as unknown as DxfEntityUnion;
}
