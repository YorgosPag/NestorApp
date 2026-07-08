/**
 * USE STRETCH PREVIEW — ADR-349 Phase 1c-B1
 *
 * Live ghost overlay for the STRETCH / MSTRETCH command during the
 * `displacement` phase. Subscribes to {@link StretchToolStore} (LOW-freq —
 * one transition per click) and {@link useCursorWorldPosition} (60fps), then
 * draws a translucent ghost of every captured entity translated by the live
 * delta `(cursor - basePoint)`.
 *
 * Migrated to the shared `useCanvasGhostPreview` harness (ADR-398 §4): RAF
 * lifecycle + DPR-clear + canonical viewport/transform + cursor subscription
 * ζουν πλέον ΜΙΑ φορά στο harness· εδώ μένει ΜΟΝΟ η draw logic.
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
 * @see hooks/tools/useCanvasGhostPreview — shared RAF/clear/viewport harness (ADR-398 §4)
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { Entity, AnySceneEntity } from '../../types/entities';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { StretchToolStore } from '../../systems/stretch/StretchToolStore';
import {
  applyVertexDisplacement,
  translateEntityByAnchor,
} from '../../systems/stretch/stretch-entity-transform';
// ADR-550 (WYSIWYG) — moving copies render through the REAL entity renderer (full fidelity,
// byte-identical to commit), the same SSoT as the Move tool / grip drag.
import { drawRealEntityPreview } from '../../rendering/ghost/draw-real-entity-preview';
import { useBimPreviewRenderer } from './useBimPreviewRenderer';
import { useLevelLayersById } from './useLevelLayersById';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';
import type { VertexRef } from '../../systems/stretch/stretch-vertex-classifier';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseStretchPreviewProps {
  levelManager: LevelSceneReader;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useStretchPreview(props: UseStretchPreviewProps): void {
  const { levelManager, transform, getCanvas, getViewportElement } = props;

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

  // ADR-550 — lazy real-entity renderer + level layer-table getter (shared SSoT hooks).
  const getBimPreview = useBimPreviewRenderer();
  const layersById = useLevelLayersById(levelManager);

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    const s = StretchToolStore.getState();
    if (s.phase !== 'displacement' || !s.basePoint || !effectiveCursor) return;

    const toScreen = (p: Point2D) => CoordinateTransforms.worldToScreen(p, t, viewport);
    const basePt = toScreen(s.basePoint);
    const cursorPt = toScreen(effectiveCursor);

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

    const delta: Point2D = { x: effectiveCursor.x - s.basePoint.x, y: effectiveCursor.y - s.basePoint.y };

    // Δ tooltip
    ctx.save();
    ctx.font = '12px monospace';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`Δ${delta.x.toFixed(1)}, ${delta.y.toFixed(1)}`, cursorPt.x + 12, cursorPt.y - 8);
    ctx.restore();

    if (Math.abs(delta.x) < 0.001 && Math.abs(delta.y) < 0.001) return;

    // ── Real WYSIWYG copies (full fidelity) — originals dim to ghosts at their source ──
    ctx.save();
    const bimPreview = getBimPreview(ctx);
    const layers = layersById();

    // Group captured vertices by entityId once per frame.
    const refsByEntity = groupRefsByEntity(s.capturedVertices);

    // Anchor entities → whole-entity translation
    for (const entityId of s.capturedEntities) {
      const entity = getEntity(entityId);
      if (!entity) continue;
      const moved = buildAnchorGhost(entity as Entity, delta);
      if (moved) drawRealEntityPreview(bimPreview, moved, layers, t, viewport);
    }

    // Per-vertex entities → partial deformation
    for (const [entityId, refs] of refsByEntity) {
      const entity = getEntity(entityId);
      if (!entity) continue;
      const moved = buildVertexGhost(entity as Entity, refs, delta);
      if (moved) drawRealEntityPreview(bimPreview, moved, layers, t, viewport);
    }

    ctx.restore();
  }, [getEntity, getBimPreview, layersById]);

  useCanvasGhostPreview({
    isActive: phase !== 'idle',
    getCanvas,
    getViewportElement,
    transform,
    draw,
  });
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
