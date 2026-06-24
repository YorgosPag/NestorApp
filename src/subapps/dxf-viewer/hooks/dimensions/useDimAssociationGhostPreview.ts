/**
 * ADR-362 Phase J4 (gap real-time) — live associative-dimension follow during drag.
 *
 * Mounted once inside `PreviewCanvasMounts` (canvas-layer-stack-leaves.tsx). While
 * the user is dragging geometry (the toolbar **Move** tool or a **grip** stretch),
 * this hook recomputes every dimension associated with the moving host(s) and
 * paints it at its LIVE position on the shared PreviewCanvas, frame-for-frame —
 * so the dimension value + extension lines + text follow the drag in real time
 * instead of "jumping" only on release.
 *
 * SSoT reuse (zero new mechanism):
 *   - Live host geometry  → `applyEntityPreview` + (`makeTranslationPreview` for
 *     Move, `toEntityPreviewTransform` for grip) — the SAME transform the entity
 *     ghost (`useMovePreview` / `useGripGhostPreview`) draws, so the dim ghost and
 *     the entity ghost can never diverge.
 *   - Recompute defPoints  → `applyAssociationUpdates` (shared with the command-time
 *     observer `useDimAssociationObserver`) → preview ≡ commit.
 *   - Render               → `paintAssociatedDimensionGhosts` → `renderPreviewDimension`.
 *   - RAF lifecycle        → `useCanvasGhostPreview` harness (ADR-398 §4 / ADR-040).
 *
 * The committed dim keeps drawing at its OLD position on the main DXF canvas
 * during the drag (the scene is untouched until commit); the live green ghost is
 * the preview of the post-commit result — identical convention to the entity move
 * ghost (original solid + translucent preview at destination).
 *
 * @see systems/dimensions/dim-association-ghost-paint.ts — pure paint SSoT
 * @see hooks/dimensions/useDimAssociationObserver.ts — command-time observer (release)
 */

import React, { useCallback, useRef } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { AnySceneEntity } from '../../types/entities';
import type { SceneEntity } from '../../core/commands/interfaces';
import type { DimensionEntity } from '../../types/dimension';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { DxfGripDragPreview } from '../grip-computation';
import type { MovePhase } from '../tools/useMoveTool';
import type { useLevels } from '../../systems/levels';
import { applyEntityPreview, makeTranslationPreview } from '../../rendering/ghost';
import { toEntityPreviewTransform } from '../tools/grip-drag-preview-transform';
// ADR-363 — ORTHO (F8) axis-lock for the live destination, mirroring useMovePreview
// so the dim ghost lands on the SAME destination the move ghost + commit use.
import { applyOrthoToDelta } from '../../bim/grips/grip-move-constraints';
import { getDimStyleRegistry } from '../../systems/dimensions/dim-style-registry';
import { resolveSceneUnits } from '../../utils/scene-units';
import { paintAssociatedDimensionGhosts } from '../../systems/dimensions/dim-association-ghost-paint';
import { useCanvasGhostPreview } from '../tools/useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

type LevelManagerLike = Pick<ReturnType<typeof useLevels>, 'getLevelScene' | 'currentLevelId'>;

export interface UseDimAssociationGhostPreviewProps {
  /** Move-tool phase (only `awaiting-destination` actually moves geometry). */
  readonly movePhase: MovePhase;
  readonly moveBasePoint: Point2D | null;
  readonly moveSelectedEntityIds: readonly string[];
  /** Live grip-drag snapshot (null when no grip drag). */
  readonly gripDragPreview: DxfGripDragPreview | null;
  readonly levelManager: LevelManagerLike;
  readonly transform: ViewTransform;
  readonly getCanvas: () => HTMLCanvasElement | null;
  readonly getViewportElement?: () => HTMLElement | null;
}

const EPS = 1e-6;

export function useDimAssociationGhostPreview(props: UseDimAssociationGhostPreviewProps): void {
  const {
    movePhase, moveBasePoint, moveSelectedEntityIds, gripDragPreview,
    levelManager, transform, getCanvas, getViewportElement,
  } = props;

  // Active only while geometry is actually moving: a grip drag, or the Move tool
  // after the base point is set (destination phase).
  const isMoveActive = movePhase === 'awaiting-destination' && moveBasePoint !== null;
  const isActive = gripDragPreview !== null || isMoveActive;

  // O(1) entity lookup + cached associated-dim list — rebuilt only when the scene
  // entities array ref changes (not every RAF frame), à la useMovePreview.
  const entityMapRef = useRef<Map<string, AnySceneEntity>>(new Map());
  const dimsRef = useRef<DimensionEntity[]>([]);
  const entityArrayRef = useRef<readonly AnySceneEntity[] | undefined>(undefined);

  const refreshCaches = useCallback((): {
    getEntity: (id: string) => SceneEntity | undefined;
    dims: readonly DimensionEntity[];
  } | null => {
    const levelId = levelManager.currentLevelId;
    if (!levelId) return null;
    const scene = levelManager.getLevelScene(levelId);
    if (!scene?.entities) return null;
    if (scene.entities !== entityArrayRef.current) {
      entityArrayRef.current = scene.entities;
      entityMapRef.current = new Map(scene.entities.map(e => [e.id, e]));
      dimsRef.current = scene.entities.filter(
        (e): e is DimensionEntity & AnySceneEntity =>
          e.type === 'dimension' && !!(e as DimensionEntity).associations?.length,
      ) as unknown as DimensionEntity[];
    }
    const getEntity = (id: string): SceneEntity | undefined =>
      entityMapRef.current.get(id) as unknown as SceneEntity | undefined;
    return { getEntity, dims: dimsRef.current };
  }, [levelManager]);

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    const caches = refreshCaches();
    if (!caches || caches.dims.length === 0) return;
    const { getEntity, dims } = caches;

    // Build the live (transformed) geometry for the moving host(s) this frame.
    const moving = new Map<string, SceneEntity>();

    if (gripDragPreview) {
      const orig = getEntity(gripDragPreview.entityId);
      if (orig) {
        const transformed = applyEntityPreview(
          orig as unknown as DxfEntityUnion,
          toEntityPreviewTransform(gripDragPreview),
        );
        if (transformed !== (orig as unknown as DxfEntityUnion)) {
          moving.set(gripDragPreview.entityId, transformed as unknown as SceneEntity);
        }
      }
    } else if (isMoveActive && moveBasePoint && effectiveCursor) {
      // Same ORTHO-locked, snapped destination delta the move ghost + commit use.
      const delta = applyOrthoToDelta({
        x: effectiveCursor.x - moveBasePoint.x,
        y: effectiveCursor.y - moveBasePoint.y,
      });
      if (Math.abs(delta.x) > EPS || Math.abs(delta.y) > EPS) {
        for (const id of moveSelectedEntityIds) {
          const orig = getEntity(id);
          if (!orig) continue;
          const transformed = applyEntityPreview(
            orig as unknown as DxfEntityUnion,
            makeTranslationPreview(id, delta),
          );
          if (transformed !== (orig as unknown as DxfEntityUnion)) {
            moving.set(id, transformed as unknown as SceneEntity);
          }
        }
      }
    }

    if (moving.size === 0) return;

    const registry = getDimStyleRegistry();
    const scene = levelManager.currentLevelId
      ? levelManager.getLevelScene(levelManager.currentLevelId)
      : null;

    paintAssociatedDimensionGhosts({
      ctx,
      transform: t,
      viewport,
      movingEntities: moving,
      dims,
      getOriginalEntity: getEntity,
      resolveStyle: (dim) => registry.getStyle(dim.styleId) ?? registry.getActiveStyle(),
      sceneUnits: resolveSceneUnits(scene),
    });
  }, [refreshCaches, gripDragPreview, isMoveActive, moveBasePoint, moveSelectedEntityIds, levelManager]);

  useCanvasGhostPreview({
    isActive,
    getCanvas,
    getViewportElement,
    transform,
    // Move needs the live (snapped) world cursor for its delta; grip ignores it
    // (the delta is carried in dragPreview). useImmediateSnap = WYSIWYG with commit.
    cursorMode: 'world-position',
    useImmediateSnap: true,
    // Layer on top of the entity ghost frame without wiping it (its own clear-on-exit
    // still fires). The committed dim stays on the main canvas; this paints the ghost.
    clearMode: 'skip-clear',
    draw,
  });
}

export interface DimAssociationGhostPreviewMountProps extends UseDimAssociationGhostPreviewProps {}

/**
 * Zero-JSX mount (ADR-040 micro-leaf) — runs the live dim-follow preview and
 * draws imperatively to the shared PreviewCanvas. Keeps the shell inert.
 */
export const DimAssociationGhostPreviewMount = React.memo(function DimAssociationGhostPreviewMount(
  props: DimAssociationGhostPreviewMountProps,
) {
  useDimAssociationGhostPreview(props);
  return null;
});
