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

import React, { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { AnySceneEntity } from '../../types/entities';
import type { SceneEntity } from '../../core/commands/interfaces';
import type { DimensionEntity } from '../../types/dimension';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { DxfGripDragPreview } from '../grip-computation';
import type { MovePhase } from '../tools/useMoveTool';
import type { RotationPhase } from '../tools/useRotationTool';
import type { MirrorPhase } from '../tools/useMirrorTool';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';
import { applyEntityPreview, makeTranslationPreview } from '../../rendering/ghost';
import { toEntityPreviewTransform } from '../tools/grip-drag-preview-transform';
// ADR-363 — ORTHO (F8) axis-lock for the live destination, mirroring useMovePreview
// so the dim ghost lands on the SAME destination the move ghost + commit use.
import { applyOrthoToDelta } from '../../bim/grips/grip-move-constraints';
import { orthoSnap } from '../../utils/mirror-math';
import { useCadToggles } from '../common/useCadToggles';
import { ScaleToolStore } from '../../systems/scale/ScaleToolStore';
import { StretchToolStore } from '../../systems/stretch/StretchToolStore';
import { getDimStyleRegistry } from '../../systems/dimensions/dim-style-registry';
import { resolveSceneUnits } from '../../utils/scene-units';
import { paintAssociatedDimensionGhosts } from '../../systems/dimensions/dim-association-ghost-paint';
import { buildTransformedHosts } from '../../systems/dimensions/dim-transform-live-hosts';
import { useCanvasGhostPreview } from '../tools/useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';

export interface UseDimAssociationGhostPreviewProps {
  /** Move-tool phase (only `awaiting-destination` actually moves geometry). */
  readonly movePhase: MovePhase;
  readonly moveBasePoint: Point2D | null;
  readonly moveSelectedEntityIds: readonly string[];
  /** Live grip-drag snapshot (null when no grip drag). */
  readonly gripDragPreview: DxfGripDragPreview | null;
  // ── ADR-362 Round 23 — ROTATE / MIRROR live state (props; the same the entity
  //    ghost mounts receive). SCALE / STRETCH read their own stores below. ──
  readonly rotationPhase: RotationPhase;
  readonly rotationBasePoint: Point2D | null;
  readonly rotationAngle: number;
  readonly mirrorPhase: MirrorPhase;
  readonly mirrorFirstPoint: Point2D | null;
  readonly mirrorSecondPoint: Point2D | null;
  readonly levelManager: LevelSceneReader;
  readonly transform: ViewTransform;
  readonly getCanvas: () => HTMLCanvasElement | null;
  readonly getViewportElement?: () => HTMLElement | null;
}

const EPS = 1e-6;
const EMPTY_MOVING: ReadonlyMap<string, SceneEntity> = new Map();

/**
 * Mirror axis 2nd point this frame — committed `secondPoint` once placed, else the
 * (ortho/shift-snapped) live cursor. Mirrors useMirrorPreview so the dim ghost
 * lands on the SAME axis as the entity ghost. Returns null when not resolvable.
 */
function deriveMirrorAxisP2(
  phase: MirrorPhase,
  firstPoint: Point2D | null,
  secondPoint: Point2D | null,
  cursor: Point2D | null,
  orthoOrShift: boolean,
): Point2D | null {
  const rawP2 = phase === 'awaiting-keep-originals' ? secondPoint : cursor;
  if (!rawP2) return null;
  return phase === 'awaiting-second-point' && firstPoint && orthoOrShift
    ? orthoSnap(firstPoint, rawP2)
    : rawP2;
}

/** Live uniform scale factor from cursor distance — mirrors useScalePreview. */
function deriveScaleFactor(subPhase: string, currentSx: number, base: Point2D, cursor: Point2D): number {
  if (subPhase !== 'direct') return currentSx;
  const dist = Math.hypot(cursor.x - base.x, cursor.y - base.y);
  return dist > 0.001 ? dist / 100 : 1;
}

export function useDimAssociationGhostPreview(props: UseDimAssociationGhostPreviewProps): void {
  const {
    movePhase, moveBasePoint, moveSelectedEntityIds, gripDragPreview,
    rotationPhase, rotationBasePoint, rotationAngle,
    mirrorPhase, mirrorFirstPoint, mirrorSecondPoint,
    levelManager, transform, getCanvas, getViewportElement,
  } = props;

  // SCALE / STRETCH live state is store-owned (ADR-348/349) — subscribe for the
  // isActive gate + harness re-schedule, then read fresh state per-frame in draw.
  const scalePhase = useSyncExternalStore(ScaleToolStore.subscribe, () => ScaleToolStore.getState().phase);
  const stretchPhase = useSyncExternalStore(StretchToolStore.subscribe, () => StretchToolStore.getState().phase);

  // ORTHO (toggle) + Shift gate the mirror axis snap — reuse the SAME `orthoSnap`
  // SSoT + ortho source the mirror entity ghost uses (useMirrorPreview), so the
  // dim ghost lands on the SAME axis. Shift listener mirrors useMirrorPreview.
  const { ortho } = useCadToggles();
  const orthoOnRef = useRef(ortho.on);
  orthoOnRef.current = ortho.on;
  const shiftHeldRef = useRef(false);
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftHeldRef.current = true; };
    const onUp = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftHeldRef.current = false; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  // Active only while geometry is actually moving: a grip drag, the Move tool
  // after the base point is set, or a live rotate/mirror/scale/stretch drag.
  const isMoveActive = movePhase === 'awaiting-destination' && moveBasePoint !== null;
  const isRotateActive = rotationPhase === 'awaiting-angle';
  const isMirrorActive = mirrorPhase === 'awaiting-second-point' || mirrorPhase === 'awaiting-keep-originals';
  const isScaleActive = scalePhase === 'scale_input';
  const isStretchActive = stretchPhase === 'displacement';
  const isActive = gripDragPreview !== null || isMoveActive
    || isRotateActive || isMirrorActive || isScaleActive || isStretchActive;

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

  // Rotate / mirror / scale / stretch → live transformed hosts via the per-type
  // math SSoT (buildTransformedHosts). Tools are mutually exclusive, so the first
  // active branch wins. Params are derived to MATCH each tool's entity ghost.
  const buildTransformMoving = useCallback((
    effectiveCursor: Point2D | null,
    getEntity: (id: string) => SceneEntity | undefined,
  ): ReadonlyMap<string, SceneEntity> => {
    // ROTATE — pivot + live angle in props; gate like the entity ghost (>0.01°).
    if (rotationPhase === 'awaiting-angle' && rotationBasePoint && Math.abs(rotationAngle) > 0.01) {
      return buildTransformedHosts(
        { kind: 'rotate', entityIds: moveSelectedEntityIds, pivot: rotationBasePoint, angleDeg: rotationAngle },
        getEntity,
      );
    }
    // MIRROR — axis = firstPoint → (ortho/shift-snapped) cursor / committed 2nd point.
    if (isMirrorActive && mirrorFirstPoint) {
      const axisP2 = deriveMirrorAxisP2(
        mirrorPhase, mirrorFirstPoint, mirrorSecondPoint, effectiveCursor,
        orthoOnRef.current || shiftHeldRef.current,
      );
      if (axisP2) {
        return buildTransformedHosts(
          { kind: 'mirror', entityIds: moveSelectedEntityIds, axis: { p1: mirrorFirstPoint, p2: axisP2 } },
          getEntity,
        );
      }
    }
    // SCALE — live uniform factor from cursor distance (mirrors useScalePreview).
    const sc = ScaleToolStore.getState();
    if (sc.phase === 'scale_input' && sc.basePoint && effectiveCursor) {
      const factor = deriveScaleFactor(sc.subPhase, sc.currentSx, sc.basePoint, effectiveCursor);
      return buildTransformedHosts(
        { kind: 'scale', entityIds: sc.selectedEntityIds, base: sc.basePoint, sx: factor, sy: factor },
        getEntity,
      );
    }
    // STRETCH — live delta from cursor (mirrors useStretchPreview).
    const st = StretchToolStore.getState();
    if (st.phase === 'displacement' && st.basePoint && effectiveCursor) {
      const delta = { x: effectiveCursor.x - st.basePoint.x, y: effectiveCursor.y - st.basePoint.y };
      if (Math.abs(delta.x) > EPS || Math.abs(delta.y) > EPS) {
        return buildTransformedHosts(
          { kind: 'stretch', capturedEntities: st.capturedEntities, capturedVertices: st.capturedVertices, delta },
          getEntity,
        );
      }
    }
    return EMPTY_MOVING;
  }, [
    rotationPhase, rotationBasePoint, rotationAngle,
    mirrorPhase, mirrorFirstPoint, mirrorSecondPoint, moveSelectedEntityIds,
  ]);

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    const caches = refreshCaches();
    if (!caches || caches.dims.length === 0) return;
    const { getEntity, dims } = caches;

    // Build the live (transformed) geometry for the moving host(s) this frame.
    let moving: ReadonlyMap<string, SceneEntity> = new Map<string, SceneEntity>();

    if (gripDragPreview) {
      const grip = new Map<string, SceneEntity>();
      const orig = getEntity(gripDragPreview.entityId);
      if (orig) {
        const transformed = applyEntityPreview(
          orig as unknown as DxfEntityUnion,
          toEntityPreviewTransform(gripDragPreview),
        );
        if (transformed !== (orig as unknown as DxfEntityUnion)) {
          grip.set(gripDragPreview.entityId, transformed as unknown as SceneEntity);
        }
      }
      moving = grip;
    } else if (isMoveActive && moveBasePoint && effectiveCursor) {
      // Same ORTHO-locked, snapped destination delta the move ghost + commit use.
      const mv = new Map<string, SceneEntity>();
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
            mv.set(id, transformed as unknown as SceneEntity);
          }
        }
      }
      moving = mv;
    } else {
      // ROTATE / MIRROR / SCALE / STRETCH — transformed hosts via math SSoT.
      moving = buildTransformMoving(effectiveCursor, getEntity);
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
  }, [refreshCaches, gripDragPreview, isMoveActive, moveBasePoint, moveSelectedEntityIds, levelManager, buildTransformMoving]);

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
