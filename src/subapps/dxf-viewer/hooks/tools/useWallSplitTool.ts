/**
 * USE WALL SPLIT TOOL — ADR-363 Phase 5.6
 *
 * Editing hook for the wall-split tool. State machine (Revit Split Element pattern):
 *   idle → picking (on activeTool === 'wall-split') → click wall → execute split → loop
 *   right-click / ESC → exit, onToolChange('select')
 *
 * Mouse move: subscribes to ImmediatePositionStore (ADR-040 high-freq path),
 * finds the nearest wall within snap tolerance via `projectPointOnWallAxis`,
 * and updates WallSplitStore with the split-indicator preview. Zero React state
 * for the mouse-move path — mirrors useTrimTool pattern.
 *
 * Click: computes split params (computeSplitOffset + computeSplitWallParams +
 * redistributeOpenings), builds WallSplitCommand, executes via executeCommand
 * (full undo/redo support), loops back to picking.
 *
 * Lives in hooks/tools/ (editing hook) not hooks/drawing/ (creation hook)
 * because it requires executeCommand for undo/redo — same as useTrimTool.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §Phase 5.6
 */
'use client';

import { useCallback, useEffect, useRef } from 'react';
import { generateWallId } from '@/services/enterprise-id.service';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import { isWallEntity, isOpeningEntity } from '../../types/entities';
import { WallSplitStore } from '../../systems/wall-split/WallSplitStore';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { computeWallGeometry } from '../../bim/geometry/wall-geometry';
import { subscribeToImmediateWorldPosition } from '../../systems/cursor/ImmediatePositionStore';
import { projectPointOnWallAxis } from '../../bim/walls/wall-axis-projection';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import {
  computeSplitOffset,
  computeSplitWallParams,
  redistributeOpenings,
  computeSplitIndicatorLine,
} from '../../bim/walls/wall-split';
import { WallSplitCommand } from '../../core/commands/entity-commands/WallSplitCommand';
import { EventBus } from '../../systems/events/EventBus';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import type { useLevels } from '../../systems/levels';

// ── Types ─────────────────────────────────────────────────────────────────────

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseWallSplitToolProps {
  activeTool: string;
  levelManager: LevelManagerLike;
  executeCommand: (cmd: ICommand) => void;
  /** Current viewport scale factor — used to convert snap tolerance to world units. */
  transformScale: number;
  onToolChange?: (tool: string) => void;
}

export interface UseWallSplitToolReturn {
  isActive: boolean;
  handleWallSplitClick: (worldPoint: Point2D) => void;
  handleWallSplitMouseMove: (worldPoint: Point2D) => void;
  handleWallSplitEscape: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWallSplitTool({
  activeTool,
  levelManager,
  executeCommand,
  transformScale,
  onToolChange,
}: UseWallSplitToolProps): UseWallSplitToolReturn {
  const isActive = activeTool === 'wall-split';
  const transformScaleRef = useRef(transformScale);
  transformScaleRef.current = transformScale;

  // ── Scene manager factory (mirrors useTrimTool pattern) ──────────────────

  const getSceneManager = useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return new LevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
  }, [levelManager]);

  // ── Wall hit-test (snap tolerance) ───────────────────────────────────────

  const findWallAtPoint = useCallback((worldPoint: Point2D): WallEntity | null => {
    if (!levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene?.entities) return null;

    const hitTol = TOLERANCE_CONFIG.SNAP_DEFAULT / transformScaleRef.current;
    const walls = scene.entities.filter(isWallEntity) as WallEntity[];

    let best: WallEntity | null = null;
    let bestDist = Infinity;

    for (const wall of walls) {
      const foot = projectPointOnWallAxis(wall, worldPoint);
      if (!foot) continue;
      const d = calculateDistance(worldPoint, foot);
      if (d < hitTol && d < bestDist) {
        bestDist = d;
        best = wall;
      }
    }

    return best;
  }, [levelManager]);

  // ── Mouse move: update WallSplitStore preview ─────────────────────────────

  const handleWallSplitMouseMove = useCallback((worldPoint: Point2D): void => {
    const wall = findWallAtPoint(worldPoint);
    if (!wall) {
      WallSplitStore.reset();
      return;
    }
    const splitPoint = projectPointOnWallAxis(wall, worldPoint);
    if (!splitPoint) {
      WallSplitStore.reset();
      return;
    }
    const splitLine = computeSplitIndicatorLine(wall, splitPoint);
    WallSplitStore.set({ hoveredWallId: wall.id, splitPoint, splitLine });
  }, [findWallAtPoint]);

  // ── Subscribe to high-frequency mouse position (ADR-040) ─────────────────

  useEffect(() => {
    if (!isActive) {
      WallSplitStore.reset();
      return;
    }
    return subscribeToImmediateWorldPosition((pos) => {
      if (pos) handleWallSplitMouseMove(pos);
    });
  }, [isActive, handleWallSplitMouseMove]);

  // ── Click: build + execute WallSplitCommand ───────────────────────────────

  const handleWallSplitClick = useCallback((worldPoint: Point2D): void => {
    const sm = getSceneManager();
    if (!sm || !levelManager.currentLevelId) return;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene?.entities) return;

    const targetWall = findWallAtPoint(worldPoint);
    if (!targetWall) return;

    const splitOffset = computeSplitOffset(targetWall, worldPoint);
    if (splitOffset === null) return; // curved/polyline: not yet supported

    const { wall1Params, wall2Params } = computeSplitWallParams(targetWall, splitOffset);
    const wall1Id = generateWallId();
    const wall2Id = generateWallId();

    const wall1: WallEntity = {
      ...targetWall,
      id: wall1Id,
      params: wall1Params,
      geometry: computeWallGeometry(wall1Params, targetWall.kind),
      hostedOpeningIds: [],
    };
    const wall2: WallEntity = {
      ...targetWall,
      id: wall2Id,
      params: wall2Params,
      geometry: computeWallGeometry(wall2Params, targetWall.kind),
      hostedOpeningIds: [],
    };

    const openingsByIdFn = (oid: string): OpeningEntity | null => {
      const e = scene.entities.find((x) => x.id === oid);
      if (!e) return null;
      const c = e as unknown as Partial<OpeningEntity>;
      return c.type === 'opening' && c.params ? (e as unknown as OpeningEntity) : null;
    };

    const { wall1OpeningIds, wall2OpeningIds, openingUpdates } = redistributeOpenings(
      targetWall.hostedOpeningIds ?? [],
      openingsByIdFn,
      splitOffset,
      wall1Id,
      wall2Id,
    );

    const cmd = new WallSplitCommand(
      {
        originalWall: targetWall,
        wall1: { ...wall1, hostedOpeningIds: wall1OpeningIds },
        wall2: { ...wall2, hostedOpeningIds: wall2OpeningIds },
        openingUpdates,
      },
      sm,
    );

    executeCommand(cmd);
    EventBus.emit('bim:wall-split-committed', {
      originalWallId: targetWall.id,
      wall1: { ...wall1, hostedOpeningIds: wall1OpeningIds },
      wall2: { ...wall2, hostedOpeningIds: wall2OpeningIds },
      openingUpdates,
    });
  }, [getSceneManager, levelManager, findWallAtPoint, executeCommand]);

  // ── Escape: exit tool ─────────────────────────────────────────────────────

  const handleWallSplitEscape = useCallback((): void => {
    WallSplitStore.reset();
    onToolChange?.('select');
  }, [onToolChange]);

  return { isActive, handleWallSplitClick, handleWallSplitMouseMove, handleWallSplitEscape };
}
