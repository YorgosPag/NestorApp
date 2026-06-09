'use client';

/**
 * ADR-363 Φ1G.5 Slice 2d/2g — useBim3DOpeningMove: the DEDICATED 3D drag for a hosted
 * opening (door/window), replacing the generic gizmo (which a hosted «hole» cannot
 * use — its grab-mesh-slide preview spawns a confusing floating cube and never moves
 * the void live). Revit-style host-aware move:
 *
 *   press ON the selected opening → drag → the cursor is raycast onto the walls →
 *   the host wall is rebuilt live so the HOLE + the solid opening body follow the cursor
 *   (Slice 2g — correct rotation + thickness on the wall under the cursor, per frame) →
 *   release = slide along the same wall, or RE-HOST onto another wall (Pick New Host).
 *
 * Combines the two existing 3D-bridge patterns (like `useBim3DBeamFromWallPick`):
 *   - AbortController-gated DOM listeners on the renderer canvas, armed only while a
 *     single opening is selected AND the viewport is in 3D (ADR-040: no
 *     `useSyncExternalStore`, store reads at event time).
 *   - a live wall-hole preview (`OpeningHostWallPreview` + `buildOpeningHostWallPreview`):
 *     the host wall(s) are rebuilt through the `wallToMesh` SSoT with the dragged opening,
 *     hiding the originals — so the moving hole === the committed result.
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
import { OpeningHostWallPreview, type OpeningHostWallRebuild } from '../placement/OpeningHostWallPreview';
import { buildOpeningHostWallPreview } from '../animation/bim3d-preview-rebuild';
import { TempOpeningDimOverlay } from '../placement/TempOpeningDimOverlay';
import { getSiblingOpeningsOnWall } from '../../bim/walls/opening-siblings';
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

/** The bimIds the host-wall preview must hide: the wall itself + every opening body on it. */
function hideIdsForWall(wallId: string, openings: readonly OpeningEntity[]): Set<string> {
  const ids = new Set<string>([wallId]);
  for (const o of openings) if (o.params.wallId === wallId) ids.add(o.id);
  return ids;
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

    const wallPreview = new OpeningHostWallPreview(manager.bimLayer.group);
    const dimOverlay = new TempOpeningDimOverlay(manager.scene);
    let abort: AbortController | null = null;
    let drag: OpeningDrag | null = null;
    let justDragged = false;
    /** Last `host:offset(mm)` rendered — skips redundant wall rebuilds on idle frames. */
    let lastPreviewKey: string | null = null;

    /** Rebuild + show the host wall(s) with the dragged opening: new host (with the moved
     *  opening), plus the old host WITHOUT it on a re-host (its hole closes live). */
    const showWallPreview = (d: OpeningDrag, host: WallEntity, params: OpeningParams): void => {
      const allOpenings = useBim3DEntitiesStore.getState().openings;
      const rebuilds: OpeningHostWallRebuild[] = [];
      const newObj = buildOpeningHostWallPreview(host.id, d.opening.id, params);
      if (newObj) rebuilds.push({ hideIds: hideIdsForWall(host.id, allOpenings), object: newObj });
      if (host.id !== d.host.id) {
        const oldObj = buildOpeningHostWallPreview(d.host.id, d.opening.id, null);
        if (oldObj) rebuilds.push({ hideIds: hideIdsForWall(d.host.id, allOpenings), object: oldObj });
      }
      wallPreview.update(rebuilds);
    };

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
      if (!point) { wallPreview.cancel(); dimOverlay.hide(); lastPreviewKey = null; manager.markSceneDirty(); return; }
      const f = mmToSceneUnits(drag.host.params.sceneUnits ?? 'mm');
      const dxf = worldToDxfPlan(point);
      const currentPos = { x: dxf.x * f, y: dxf.y * f };
      const hit = manager.raycastBimEntities(e.clientX, e.clientY);
      const forcedHost = hit?.bimType === 'wall' ? drag.walls.find((w) => w.id === hit.bimId) : undefined;
      const resolved = resolveOpeningAltMove({
        originalParams: drag.opening.params,
        basePoint: drag.basePoint,
        currentPos,
        currentHost: drag.host,
        candidateWalls: drag.walls,
        rehostToleranceWorld: openingRehostToleranceWorld(drag.host),
        ...(forcedHost ? { forcedHost } : {}),
      });
      drag.resolvedParams = resolved?.params ?? null;
      drag.resolvedHost = resolved?.host ?? null;
      if (resolved) {
        // Throttle: rebuild the wall(s) only when the resolved host/offset actually changed.
        const key = `${resolved.host.id}:${Math.round(resolved.params.offsetFromStart)}`;
        if (key !== lastPreviewKey) {
          lastPreviewKey = key;
          showWallPreview(drag, resolved.host, resolved.params);
        }
        const siblings = getSiblingOpeningsOnWall(resolved.host.id, useBim3DEntitiesStore.getState().openings, drag.opening.id);
        dimOverlay.update(resolved.params, resolved.host, siblings, drag.floorElevationMm, drag.buildingBaseElevationM, manager.getCamera(), manager.getRendererCanvas(), drag.walls);
      } else {
        wallPreview.cancel();
        dimOverlay.hide();
        lastPreviewKey = null;
      }
      e.preventDefault();
      e.stopPropagation();
      manager.markSceneDirty();
    };

    const onUp = (e: PointerEvent): void => {
      if (!drag) return;
      const moved = Math.hypot(e.clientX - drag.downX, e.clientY - drag.downY);
      const current = drag;
      const isCommit = moved > DRAG_THRESHOLD_PX && !!current.resolvedParams;
      endDrag(e, isCommit);
      if (!isCommit) return; // a click, or a no-op move
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

    /** Common drag cleanup. `isCommit` → keep originals hidden (the re-sync replaces the
     *  walls → no old-hole flash); otherwise restore them. Controls back, capture released. */
    const endDrag = (e: PointerEvent, isCommit: boolean): void => {
      e.preventDefault();
      e.stopPropagation();
      canvasEl.releasePointerCapture?.(e.pointerId);
      if (isCommit) wallPreview.commit();
      else wallPreview.cancel();
      drag = null;
      dimOverlay.hide();
      lastPreviewKey = null;
      manager.viewport.setControlsEnabled(true);
      manager.markSceneDirty();
    };

    const onCancel = (): void => {
      if (!drag) return;
      wallPreview.cancel();
      drag = null;
      dimOverlay.hide();
      lastPreviewKey = null;
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
      if (drag) onCancel(); // armed mid-drag → restore the original walls, no command
      abort?.abort();
      abort = null;
      justDragged = false;
      wallPreview.cancel();
      dimOverlay.hide();
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
      wallPreview.dispose();
      dimOverlay.dispose();
    };
  }, [canvasEl, managerRef]);
}
