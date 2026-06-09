'use client';

/**
 * ADR-363 Φ1G.5 Slice 2d — useBim3DOpeningMove: the DEDICATED 3D drag for a hosted
 * opening (door/window), replacing the generic gizmo (which a hosted «hole» cannot
 * use — its grab-mesh-slide preview spawns a confusing floating cube and never moves
 * the void live). Revit-style host-aware move:
 *
 *   press ON the selected opening → drag → the cursor is raycast onto the walls →
 *   a translucent ghost of the opening previews exactly where it will land (correct
 *   rotation + thickness on the wall under the cursor, recomputed per frame) →
 *   release = slide along the same wall, or RE-HOST onto another wall (Pick New Host).
 *
 * Combines the two existing 3D-bridge patterns (like `useBim3DBeamFromWallPick`):
 *   - AbortController-gated DOM listeners on the renderer canvas, armed only while a
 *     single opening is selected AND the viewport is in 3D (ADR-040: no
 *     `useSyncExternalStore`, store reads at event time).
 *   - a translucent WYSIWYG ghost (`OpeningMoveGhost`) following the cursor.
 *
 * The move resolution is the SINGLE SSoT shared with the 2D grip + gizmo commit
 * (`resolveOpeningAltMove` + `forcedHost`); the release dispatches the SAME
 * `UpdateOpeningParamsCommand` the 2D path uses, so the scene re-syncs (the wall void
 * moves onto the resolved host) with zero duplication. The post-drag click is
 * consumed so it never falls through to the 3D selection handler underneath.
 */

import { useEffect, useRef, type MutableRefObject } from 'react';
import { useLevelsOptional, type LevelsHookReturn } from '../../systems/levels/useLevels';
import { useViewMode3DStore, selectIs3D } from '../stores/ViewMode3DStore';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import type { OpeningEntity, OpeningParams } from '../../bim/types/opening-types';
import type { WallEntity } from '../../bim/types/wall-types';
import { isWallEntity } from '../../types/entities';
import { resolveOpeningAltMove, openingRehostToleranceWorld } from '../../bim/walls/opening-grips';
import { mmToSceneUnits } from '../../utils/scene-units';
import { resolveEntityBuilding } from '../../bim/utils/bim-floor-utils';
import { resolveActiveFloorElevationMm } from '../placement/raycast-floor-point';
import { worldToDxfPlan } from './coordinate-transforms';
import { raycastWorldPoint } from '../systems/raycaster/BimEntityRaycaster';
import { OpeningMoveGhost } from '../placement/OpeningMoveGhost';
import { resolveEntityLevelId } from '../animation/bim3d-edit-live-preview-apply';
import { createSceneManagerAdapter } from '../../hooks/grips/grip-commit-adapters';
import type { DxfCommitDeps } from '../../hooks/grips/unified-grip-types';
import { getGlobalCommandHistory } from '../../core/commands';
import { UpdateOpeningParamsCommand } from '../../core/commands/entity-commands/UpdateOpeningParamsCommand';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';

/** A press whose pointer moved less than this (px) before release was a click, not a
 *  drag — don't commit (and let the selection click through). */
const DRAG_THRESHOLD_PX = 5;

export interface UseBim3DOpeningMoveParams {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
  readonly canvasEl: HTMLCanvasElement | null;
}

/** Snapshot captured at pointerdown — the scene is static for the whole drag. */
interface OpeningDrag {
  readonly opening: OpeningEntity;
  readonly host: WallEntity;
  readonly walls: readonly WallEntity[];
  readonly basePoint: { x: number; y: number };
  readonly floorElevationMm: number;
  readonly buildingBaseElevationM: number;
  readonly downX: number;
  readonly downY: number;
  resolvedParams: OpeningParams | null;
  resolvedHost: WallEntity | null;
}

/** Resolve the single selected opening + its host + sibling walls from the live store. */
function captureDrag(opening: OpeningEntity, downX: number, downY: number): OpeningDrag | null {
  const s = useBim3DEntitiesStore.getState();
  const host = s.walls.find((w) => w.id === opening.params.wallId);
  if (!host) return null;
  const building = resolveEntityBuilding(host, s.floors, s.buildings);
  return {
    opening,
    host,
    walls: s.walls.filter(isWallEntity),
    basePoint: { x: opening.geometry.position.x, y: opening.geometry.position.y },
    floorElevationMm: resolveActiveFloorElevationMm(),
    buildingBaseElevationM: building?.baseElevation ?? 0,
    downX,
    downY,
    resolvedParams: null,
    resolvedHost: null,
  };
}

/** Set the visibility of every body mesh tagged with `bimId` (hide the original while dragging). */
function setOpeningBodyVisible(manager: ThreeJsSceneManager, bimId: string, visible: boolean): void {
  manager.bimLayer.group.traverse((obj) => {
    if ((obj.userData['bimId'] as string | undefined) === bimId) obj.visible = visible;
  });
}

/** Build the scene-manager adapter for the opening's level (mirror of the gizmo dispatch path). */
function buildAdapter(levels: LevelsHookReturn, openingId: string): ReturnType<typeof createSceneManagerAdapter> {
  const levelId = resolveEntityLevelId(levels, openingId) ?? levels.currentLevelId;
  if (!levelId) return null;
  const deps: DxfCommitDeps = {
    currentLevelId: levelId,
    getLevelScene: levels.getLevelScene,
    setLevelScene: levels.setLevelScene,
    execute: () => {},
    moveEntities: () => {},
    onToolChange: () => {},
  };
  return createSceneManagerAdapter(deps);
}

export function useBim3DOpeningMove({ managerRef, canvasEl }: UseBim3DOpeningMoveParams): void {
  const levels = useLevelsOptional();
  const levelsRef = useRef(levels);
  levelsRef.current = levels;

  useEffect(() => {
    const manager = managerRef.current;
    if (!canvasEl || !manager) return;

    const ghost = new OpeningMoveGhost(manager.scene);
    let abort: AbortController | null = null;
    let drag: OpeningDrag | null = null;
    let justDragged = false;

    /** The single selected opening, or null (not a single opening selection). */
    const selectedOpening = (): OpeningEntity | null => {
      const sel = useSelection3DStore.getState();
      if (sel.selectedBimIds.length !== 1 || sel.selectedBimType !== 'opening') return null;
      return useBim3DEntitiesStore.getState().openings.find((o) => o.id === sel.selectedBimIds[0]) ?? null;
    };

    const onDown = (e: PointerEvent): void => {
      if (e.button !== 0 || drag) return;
      const opening = selectedOpening();
      if (!opening) return;
      const hit = manager.raycastBimEntities(e.clientX, e.clientY);
      if (hit?.bimId !== opening.id) return; // press must land ON the opening to start a move
      drag = captureDrag(opening, e.clientX, e.clientY);
      if (!drag) return;
      setOpeningBodyVisible(manager, opening.id, false); // hide the original body while the ghost previews
      manager.viewport.setControlsEnabled(false);
      (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    };

    const onMove = (e: PointerEvent): void => {
      if (!drag) return;
      // World-space point ON the wall under the cursor (the pure raycaster SSoT, called
      // with the manager's public group/camera/canvas — no extra ThreeJsSceneManager API).
      const point = raycastWorldPoint(manager.bimLayer.group, manager.getCamera(), manager.getRendererCanvas(), e.clientX, e.clientY);
      if (!point) { ghost.hide(); manager.markSceneDirty(); return; }
      const f = mmToSceneUnits(drag.host.params.sceneUnits ?? 'mm');
      const dxf = worldToDxfPlan(point);
      const hit = manager.raycastBimEntities(e.clientX, e.clientY);
      const forcedHost = hit?.bimType === 'wall' ? drag.walls.find((w) => w.id === hit.bimId) : undefined;
      const resolved = resolveOpeningAltMove({
        originalParams: drag.opening.params,
        basePoint: drag.basePoint,
        currentPos: { x: dxf.x * f, y: dxf.y * f },
        currentHost: drag.host,
        candidateWalls: drag.walls,
        rehostToleranceWorld: openingRehostToleranceWorld(drag.host),
        ...(forcedHost ? { forcedHost } : {}),
      });
      drag.resolvedParams = resolved?.params ?? null;
      drag.resolvedHost = resolved?.host ?? null;
      if (resolved) ghost.showFor(drag.opening, resolved.params, resolved.host, drag.floorElevationMm, drag.buildingBaseElevationM);
      else ghost.hide();
      e.preventDefault();
      e.stopPropagation();
      manager.markSceneDirty();
    };

    const onUp = (e: PointerEvent): void => {
      if (!drag) return;
      const moved = Math.hypot(e.clientX - drag.downX, e.clientY - drag.downY);
      const current = drag;
      endDrag(e);
      if (moved <= DRAG_THRESHOLD_PX || !current.resolvedParams) return; // a click, or a no-op move
      justDragged = true; // swallow the trailing selection click
      commitMove(current);
    };

    const commitMove = (d: OpeningDrag): void => {
      const levels = levelsRef.current;
      if (!levels || !d.resolvedParams) return;
      const sm = buildAdapter(levels, d.opening.id);
      if (!sm) return;
      const cmd = new UpdateOpeningParamsCommand(d.opening.id, d.resolvedParams, d.opening.params, sm, false);
      getGlobalCommandHistory().execute(cmd);
    };

    /** Common drag cleanup: ghost off, original body restored, controls back, capture released. */
    const endDrag = (e: PointerEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      canvasEl.releasePointerCapture?.(e.pointerId);
      if (drag) setOpeningBodyVisible(manager, drag.opening.id, true);
      drag = null;
      ghost.hide();
      manager.viewport.setControlsEnabled(true);
      manager.markSceneDirty();
    };

    const onCancel = (): void => {
      if (!drag) return;
      setOpeningBodyVisible(manager, drag.opening.id, true);
      drag = null;
      ghost.hide();
      manager.viewport.setControlsEnabled(true);
      manager.markSceneDirty();
    };

    // Post-drag click suppression: a move drag still emits a trailing `click`; swallow it
    // so the 3D selection handler underneath does not re-pick at the release point.
    const onClick = (e: MouseEvent): void => {
      if (!justDragged) return;
      justDragged = false;
      e.preventDefault();
      e.stopPropagation();
    };

    const setup = (): void => {
      if (abort) return;
      abort = new AbortController();
      const { signal } = abort;
      canvasEl.addEventListener('pointerdown', onDown, { signal });
      canvasEl.addEventListener('pointermove', onMove, { signal });
      canvasEl.addEventListener('pointerup', onUp, { signal });
      canvasEl.addEventListener('pointercancel', onCancel, { signal });
      canvasEl.addEventListener('click', onClick, { signal });
    };

    const teardown = (): void => {
      if (drag) onCancel(); // armed mid-drag → restore the original body, no command
      abort?.abort();
      abort = null;
      justDragged = false;
      ghost.hide();
      manager.markSceneDirty();
    };

    const apply = (): void => {
      const sel = useSelection3DStore.getState();
      const isOpening = sel.selectedBimIds.length === 1 && sel.selectedBimType === 'opening';
      const active = isOpening && selectIs3D(useViewMode3DStore.getState());
      if (active) setup();
      else teardown();
    };

    apply();
    const unsubSelection = useSelection3DStore.subscribe(apply);
    const unsubView = useViewMode3DStore.subscribe(apply);

    return () => {
      unsubSelection();
      unsubView();
      teardown();
      ghost.dispose();
    };
  }, [canvasEl, managerRef]);
}
