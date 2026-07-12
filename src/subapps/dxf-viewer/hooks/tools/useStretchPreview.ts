/**
 * USE STRETCH PREVIEW — ADR-349 Phase 1c-B1
 *
 * Live ghost overlay for the STRETCH / MSTRETCH command during the `displacement`
 * phase. Thin binding over the shared {@link useTransformGhostPreview} draw-skeleton
 * (Cluster #16 SSoT, ADR-625): the base-point crosshair, rubber-band and tooltip
 * chrome live in the primitive. Here we bind only the STRETCH specifics — anchor
 * entities translate wholesale, per-vertex entities deform via the
 * {@link applyVertexDisplacement} SSoT (same math the command uses on commit), all
 * rendered through the REAL entity renderer (ADR-550).
 *
 * @module hooks/tools/useStretchPreview
 * @see hooks/tools/use-transform-ghost-preview — shared transform draw-skeleton (ADR-625)
 */

import { useCallback } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { StretchToolStore, type StretchToolState } from '../../systems/stretch/StretchToolStore';
import {
  applyVertexDisplacement,
  translateEntityByAnchor,
} from '../../systems/stretch/stretch-entity-transform';
// ADR-550 (WYSIWYG) — moving copies render through the REAL entity renderer (full fidelity,
// byte-identical to commit), the same SSoT as the Move tool / grip drag.
import { drawRealEntityPreview } from '../../rendering/ghost/draw-real-entity-preview';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';
import type { VertexRef } from '../../systems/stretch/stretch-vertex-classifier';
import { useTransformGhostPreview, type TransformGhostFrame } from './use-transform-ghost-preview';

export interface UseStretchPreviewProps {
  levelManager: LevelSceneReader;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

export function useStretchPreview(props: UseStretchPreviewProps): void {
  const { levelManager, transform, getCanvas, getViewportElement } = props;

  // ADR-641 — `getEntity` (BEDIT-aware, VIEW-space members) is supplied by the harness frame.
  const renderCopies = useCallback(
    ({ state: s, cursor, basePoint, transform: t, viewport, bimPreview, layers, getEntity }: TransformGhostFrame<StretchToolState>) => {
      const delta: Point2D = { x: cursor.x - basePoint.x, y: cursor.y - basePoint.y };
      if (Math.abs(delta.x) < 0.001 && Math.abs(delta.y) < 0.001) return;

      // Group captured vertices by entityId once per frame.
      const refsByEntity = groupRefsByEntity(s.capturedVertices);

      // Anchor entities → whole-entity translation.
      for (const entityId of s.capturedEntities) {
        const entity = getEntity(entityId);
        if (!entity) continue;
        const moved = buildAnchorGhost(entity as Entity, delta);
        if (moved) drawRealEntityPreview(bimPreview, moved, layers, t, viewport);
      }

      // Per-vertex entities → partial deformation.
      for (const [entityId, refs] of refsByEntity) {
        const entity = getEntity(entityId);
        if (!entity) continue;
        const moved = buildVertexGhost(entity as Entity, refs, delta);
        if (moved) drawRealEntityPreview(bimPreview, moved, layers, t, viewport);
      }
    },
    [],
  );

  useTransformGhostPreview<StretchToolState>({
    store: StretchToolStore,
    levelManager,
    transform,
    getCanvas,
    getViewportElement,
    isActivePhase: (phase) => phase !== 'idle',
    isDrawPhase: (s) => s.phase === 'displacement',
    getBasePoint: (s) => s.basePoint,
    buildTooltip: (_s, cursor, basePoint) =>
      `Δ${(cursor.x - basePoint.x).toFixed(1)}, ${(cursor.y - basePoint.y).toFixed(1)}`,
    renderCopies,
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
