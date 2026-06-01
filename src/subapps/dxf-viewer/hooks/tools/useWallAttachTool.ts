/**
 * USE WALL ATTACH TOOL — ADR-401 Phase E.1 (wall) + F.3 (column) manual attach pick-host.
 *
 * Revit «Attach Top/Base to…» pick-host interaction, for BOTH walls and columns:
 *   select walls/columns → ribbon button activates the matching tool
 *     ('wall-attach-top'/'-base' or 'column-attach-top'/'-base')
 *     → snapshot the selected elements as targets (on activation)
 *     → click a structural host (beam/slab) → AttachWalls{Top|Base}Command /
 *       AttachColumnsCommand → 'select'
 *   ESC → exit to 'select'.
 *
 * The element kind (wall/column) AND the side (top/base) are encoded in the tool
 * type. Return prop names keep the `…WallAttach…` prefix (the canvas-click wiring
 * is shared, ADR-040 — no churn there); the tool itself is element-agnostic.
 *
 * Activation mirrors `useBimCopyTool` (snapshot selection on isActive transition);
 * click mirrors `useWallSplitTool`. Host pick reuses the unit-correct `HoverStore`
 * (`getHoveredEntity()`) first; a mm-space geometry fallback covers the case where
 * hover misses the beam/slab.
 *
 * @see bim/walls/wall-attach-pick.ts — pure target/host resolution SSoT
 * @see core/commands/entity-commands/AttachWallsTopCommand.ts / AttachColumnsCommand.ts
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §2.5 §5
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
  AttachColumnsCommand,
  type ColumnAttachTarget,
} from '../../core/commands/entity-commands/AttachColumnsCommand';
import {
  AttachStairsCommand,
  type StairAttachTarget,
} from '../../core/commands/entity-commands/AttachStairsCommand';
import {
  resolveWallAttachTargets,
  resolveColumnAttachTargets,
  resolveStairAttachTargets,
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
  const isWallTool = activeTool === 'wall-attach-top' || activeTool === 'wall-attach-base';
  const isColumnTool = activeTool === 'column-attach-top' || activeTool === 'column-attach-base';
  const isStairTool = activeTool === 'stair-attach-top' || activeTool === 'stair-attach-base';
  const isActive = isWallTool || isColumnTool || isStairTool;
  const entityKind: 'wall' | 'column' | 'stair' = isColumnTool ? 'column' : isStairTool ? 'stair' : 'wall';
  const side: 'top' | 'base' = activeTool.endsWith('-base') ? 'base' : 'top';

  const transformScaleRef = useRef(transformScale);
  transformScaleRef.current = transformScale;

  /** Snapshot of attach targets captured on activation — stable for the session. */
  const targetsRef = useRef<WallAttachTarget[] | ColumnAttachTarget[] | StairAttachTarget[]>([]);
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
      const targets = !scene
        ? []
        : entityKind === 'column'
          ? resolveColumnAttachTargets(selectedEntityIds, scene.entities)
          : entityKind === 'stair'
            ? resolveStairAttachTargets(selectedEntityIds, scene.entities)
            : resolveWallAttachTargets(selectedEntityIds, scene.entities);
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
  }, [isActive, entityKind, selectedEntityIds, levelManager, onToolChange]);

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

  // Build + execute the attach command for the captured target(s) against a
  // structural host id. Shared by the 2D canvas pick (worldPoint → findHost) and
  // the 3D viewport pick (raycast → host via `bim:attach-host-picked-3d`). The
  // host id is re-validated against the live scene so both callers are safe.
  const dispatchAttachToHost = useCallback(
    (hostId: string): void => {
      const targets = targetsRef.current;
      if (targets.length === 0) return;
      const sm = getSceneManager();
      if (!sm) return;
      const scene = levelManager.currentLevelId
        ? levelManager.getLevelScene(levelManager.currentLevelId)
        : null;
      if (!scene || !resolveStructuralHostId(scene.entities, hostId)) return; // not a beam/slab

      if (entityKind === 'column') {
        const colTargets = targets as ColumnAttachTarget[];
        executeCommand(new AttachColumnsCommand(side, hostId, colTargets, sm));
        EventBus.emit('bim:columns-attached-manual', {
          side,
          hostId,
          columnIds: colTargets.map((t) => t.columnId),
        });
      } else if (entityKind === 'stair') {
        const stairTargets = targets as StairAttachTarget[];
        executeCommand(new AttachStairsCommand(side, hostId, stairTargets, sm));
        EventBus.emit('bim:stairs-attached-manual', {
          side,
          hostId,
          stairIds: stairTargets.map((t) => t.stairId),
        });
      } else {
        const wallTargets = targets as WallAttachTarget[];
        const cmd = side === 'top'
          ? new AttachWallsTopCommand(hostId, wallTargets, sm)
          : new AttachWallsBaseCommand(hostId, wallTargets, sm);
        executeCommand(cmd);
        EventBus.emit('bim:walls-attached-manual', {
          side,
          hostId,
          wallIds: wallTargets.map((t) => t.wallId),
        });
      }
      toolHintOverrideStore.setOverride(null);
      onToolChange?.('select');
    },
    [entityKind, side, getSceneManager, levelManager, executeCommand, onToolChange],
  );

  const handleWallAttachClick = useCallback(
    (worldPoint: Point2D): void => {
      if (!isActive) return;
      if (targetsRef.current.length === 0) return;
      const hostId = findHost(worldPoint);
      if (!hostId) return; // missed — stay in pick mode
      dispatchAttachToHost(hostId);
    },
    [isActive, findHost, dispatchAttachToHost],
  );

  // ── 3D viewport pick-host bridge (ADR-401) ────────────────────────────────
  // The 3D attach-pick hook (`useBim3DAttachPick`) raycasts a structural host in
  // the 3D overlay and emits its id. This 2D tool stays mounted and holds the
  // captured target snapshot even while the 3D overlay is on top (the 3D↔2D
  // selection bridge feeds `selectedEntityIds`), so it commits via the SAME path
  // as a 2D pick. Mirror of the column `bim:place-column-3d` bridge.
  useEffect(() => {
    if (!isActive) return;
    return EventBus.on('bim:attach-host-picked-3d', ({ hostId }) => {
      dispatchAttachToHost(hostId);
    });
  }, [isActive, dispatchAttachToHost]);

  // ── Escape: exit tool ─────────────────────────────────────────────────────

  const handleWallAttachEscape = useCallback((): void => {
    toolHintOverrideStore.setOverride(null);
    onToolChange?.('select');
  }, [onToolChange]);

  return { isActive, handleWallAttachClick, handleWallAttachEscape };
}
