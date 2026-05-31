/**
 * USE WALL ATTACH TOOL — ADR-401 Phase E.1 (manual attach pick-host).
 *
 * Revit «Attach Top/Base to…» pick-host interaction:
 *   select walls → ribbon button activates 'wall-attach-top' / 'wall-attach-base'
 *     → snapshot the selected walls as targets (on activation)
 *     → click a structural host (beam/slab) → AttachWalls{Top|Base}Command → 'select'
 *   ESC → exit to 'select'.
 *
 * Activation mirrors `useBimCopyTool` (snapshot selection on isActive transition);
 * click mirrors `useWallSplitTool`. The mode (top/base) is encoded in the tool
 * type. Host pick reuses the unit-correct `HoverStore` (`getHoveredEntity()`)
 * first; a mm-space geometry fallback covers the case where hover misses the
 * beam/slab (the click point is converted scene-units → mm at the boundary).
 *
 * @see bim/walls/wall-attach-pick.ts — pure target/host resolution SSoT
 * @see core/commands/entity-commands/AttachWallsTopCommand.ts
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §2.5
 */
'use client';

import { useCallback, useEffect, useRef } from 'react';
import i18next from 'i18next';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  AttachWallsTopCommand,
  type WallAttachTarget,
} from '../../core/commands/entity-commands/AttachWallsTopCommand';
import { AttachWallsBaseCommand } from '../../core/commands/entity-commands/AttachWallsBaseCommand';
import {
  resolveWallAttachTargets,
  resolveStructuralHostId,
  findStructuralHostAtPoint,
} from '../../bim/walls/wall-attach-pick';
import { getHoveredEntity } from '../../systems/hover/HoverStore';
import { EventBus } from '../../systems/events/EventBus';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { mmToSceneUnits, resolveSceneUnits } from '../../utils/scene-units';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import type { useLevels } from '../../systems/levels';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseWallAttachToolProps {
  activeTool: string;
  selectedEntityIds: string[];
  levelManager: LevelManagerLike;
  executeCommand: (cmd: ICommand) => void;
  /** Current viewport scale factor — converts snap tolerance to world units. */
  transformScale: number;
  onToolChange?: (tool: string) => void;
}

export interface UseWallAttachToolReturn {
  isActive: boolean;
  handleWallAttachClick: (worldPoint: Point2D) => void;
  handleWallAttachEscape: () => void;
}

export function useWallAttachTool({
  activeTool,
  selectedEntityIds,
  levelManager,
  executeCommand,
  transformScale,
  onToolChange,
}: UseWallAttachToolProps): UseWallAttachToolReturn {
  const isActive = activeTool === 'wall-attach-top' || activeTool === 'wall-attach-base';
  const side: 'top' | 'base' = activeTool === 'wall-attach-base' ? 'base' : 'top';

  const transformScaleRef = useRef(transformScale);
  transformScaleRef.current = transformScale;

  /** Snapshot of wall targets captured on activation — stable for the session. */
  const targetsRef = useRef<WallAttachTarget[]>([]);
  const wasActiveRef = useRef(false);

  const getSceneManager = useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return new LevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
  }, [levelManager]);

  // ── Activate / deactivate: snapshot targets + prompt ──────────────────────

  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      const scene = levelManager.currentLevelId
        ? levelManager.getLevelScene(levelManager.currentLevelId)
        : null;
      const targets = scene
        ? resolveWallAttachTargets(selectedEntityIds, scene.entities)
        : [];
      targetsRef.current = targets;
      if (targets.length === 0) {
        onToolChange?.('select');
      } else {
        toolHintOverrideStore.setOverride(
          i18next.t('attachToStructural.pickHostPrompt', { ns: 'dxf-viewer-shell' }),
        );
      }
    } else if (!isActive && wasActiveRef.current) {
      targetsRef.current = [];
      toolHintOverrideStore.setOverride(null);
    }
    wasActiveRef.current = isActive;
  }, [isActive, selectedEntityIds, levelManager, onToolChange]);

  // ── Host pick (hover SSoT first, mm-space geometry fallback) ──────────────

  const findHost = useCallback(
    (worldPoint: Point2D): string | null => {
      const scene = levelManager.currentLevelId
        ? levelManager.getLevelScene(levelManager.currentLevelId)
        : null;
      if (!scene?.entities) return null;
      const byHover = resolveStructuralHostId(scene.entities, getHoveredEntity());
      if (byHover) return byHover;
      // Fallback: convert scene-unit click point → mm (slab/beam params are mm).
      const factor = mmToSceneUnits(resolveSceneUnits(scene)); // scene units per mm
      if (factor <= 0) return null;
      const pointMm = { x: worldPoint.x / factor, y: worldPoint.y / factor };
      const tolMm = TOLERANCE_CONFIG.SNAP_DEFAULT / transformScaleRef.current / factor;
      return findStructuralHostAtPoint(scene.entities, pointMm, tolMm);
    },
    [levelManager],
  );

  // ── Click: pick host → build + execute attach command ─────────────────────

  const handleWallAttachClick = useCallback(
    (worldPoint: Point2D): void => {
      if (!isActive) return;
      const targets = targetsRef.current;
      if (targets.length === 0) return;
      const sm = getSceneManager();
      if (!sm) return;
      const hostId = findHost(worldPoint);
      if (!hostId) return; // missed — stay in pick mode

      const cmd = side === 'top'
        ? new AttachWallsTopCommand(hostId, targets, sm)
        : new AttachWallsBaseCommand(hostId, targets, sm);
      executeCommand(cmd);
      EventBus.emit('bim:walls-attached-manual', {
        side,
        hostId,
        wallIds: targets.map((t) => t.wallId),
      });
      toolHintOverrideStore.setOverride(null);
      onToolChange?.('select');
    },
    [isActive, side, getSceneManager, findHost, executeCommand, onToolChange],
  );

  // ── Escape: exit tool ─────────────────────────────────────────────────────

  const handleWallAttachEscape = useCallback((): void => {
    toolHintOverrideStore.setOverride(null);
    onToolChange?.('select');
  }, [onToolChange]);

  return { isActive, handleWallAttachClick, handleWallAttachEscape };
}
