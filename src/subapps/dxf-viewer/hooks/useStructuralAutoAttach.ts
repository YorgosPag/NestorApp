/**
 * useStructuralAutoAttach — ADR-401 Phase D (auto-attach UX).
 *
 * Thin, decoupled bridge: listens for `drawing:entity-created` and, when the
 * created entity is a structural host (beam / slab) placed OVER `storey-ceiling`
 * walls, dispatches ONE undoable `AttachWallsTopCommand` so those walls attach
 * their top to the host from below (Revit auto-attach). Detection + Z-gate live
 * in the `wall-structural-attach-coordinator` SSoT; this hook only wires the
 * event → command history.
 *
 * Mounted once by the viewer shell (alongside `useDxfViewerNotifications`),
 * after `levelManager` is available so the command-history provider is in scope.
 *
 * @see bim/walls/wall-structural-attach-coordinator.ts — findWallsToAutoAttachToHost
 * @see core/commands/entity-commands/AttachWallsTopCommand.ts — the batch command
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §6 Phase D
 */

import { useEffect } from 'react';
import { EventBus } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { LevelSceneManagerAdapter } from '../systems/entity-creation/LevelSceneManagerAdapter';
import {
  findWallsToAutoAttachToHost,
  findWallsToAutoAttachBaseToHost,
} from '../bim/walls/wall-structural-attach-coordinator';
import {
  findColumnsToAutoAttachToHost,
  findColumnsToAutoAttachBaseToHost,
} from '../bim/columns/column-structural-attach-coordinator';
import {
  findStairsToAutoAttachToHost,
  findStairsToAutoAttachBaseToHost,
} from '../bim/stairs/stair-structural-attach-coordinator';
import {
  AttachWallsTopCommand,
  type WallAttachTarget,
} from '../core/commands/entity-commands/AttachWallsTopCommand';
import { AttachWallsBaseCommand } from '../core/commands/entity-commands/AttachWallsBaseCommand';
import {
  AttachColumnsCommand,
  type ColumnAttachTarget,
} from '../core/commands/entity-commands/AttachColumnsCommand';
import {
  AttachStairsCommand,
  type StairAttachTarget,
} from '../core/commands/entity-commands/AttachStairsCommand';
import { isWallEntity, isColumnEntity, isStairEntity } from '../types/entities';
import type { Entity } from '../types/entities';
import type { SceneModel } from '../types/scene';
import type { WallEntity } from '../bim/types/wall-types';
import type { ColumnEntity } from '../bim/types/column-types';
import type { StairEntity } from '../bim/types/stair-types';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
}

/** Map wall ids → attach targets ({wallId, kind}) από το live scene. */
function buildAttachTargets(
  wallIds: readonly string[],
  entities: readonly Entity[],
): WallAttachTarget[] {
  const targets: WallAttachTarget[] = [];
  for (const id of wallIds) {
    const w = entities.find((e) => e.id === id);
    if (w && isWallEntity(w)) targets.push({ wallId: id, kind: (w as WallEntity).kind });
  }
  return targets;
}

/** Map column ids → attach targets ({columnId, kind}) από το live scene. */
function buildColumnAttachTargets(
  columnIds: readonly string[],
  entities: readonly Entity[],
): ColumnAttachTarget[] {
  const targets: ColumnAttachTarget[] = [];
  for (const id of columnIds) {
    const c = entities.find((e) => e.id === id);
    if (c && isColumnEntity(c)) targets.push({ columnId: id, kind: (c as ColumnEntity).kind });
  }
  return targets;
}

/** Map stair ids → attach targets ({stairId, kind}) από το live scene. */
function buildStairAttachTargets(
  stairIds: readonly string[],
  entities: readonly Entity[],
): StairAttachTarget[] {
  const targets: StairAttachTarget[] = [];
  for (const id of stairIds) {
    const s = entities.find((e) => e.id === id);
    if (s && isStairEntity(s)) targets.push({ stairId: id, kind: (s as StairEntity).kind });
  }
  return targets;
}

export function useStructuralAutoAttach(props: { levelManager: LevelManagerLike }): void {
  const { levelManager } = props;
  const { execute } = useCommandHistory();

  useEffect(() => {
    const unsub = EventBus.on('drawing:entity-created', ({ entity }) => {
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;

      const entities = scene.entities as unknown as readonly Entity[];
      const host = entity as unknown as Entity;
      const topTargets = buildAttachTargets(findWallsToAutoAttachToHost(host, entities), entities);
      const baseTargets = buildAttachTargets(findWallsToAutoAttachBaseToHost(host, entities), entities);
      // ADR-401 Phase F.3 — same auto-attach for columns under the new host.
      const colTopTargets = buildColumnAttachTargets(findColumnsToAutoAttachToHost(host, entities), entities);
      const colBaseTargets = buildColumnAttachTargets(findColumnsToAutoAttachBaseToHost(host, entities), entities);
      // ADR-401 Phase G.3 — same auto-attach for stairs under the new host.
      const stairTopTargets = buildStairAttachTargets(findStairsToAutoAttachToHost(host, entities), entities);
      const stairBaseTargets = buildStairAttachTargets(findStairsToAutoAttachBaseToHost(host, entities), entities);
      if (
        topTargets.length === 0 && baseTargets.length === 0 &&
        colTopTargets.length === 0 && colBaseTargets.length === 0 &&
        stairTopTargets.length === 0 && stairBaseTargets.length === 0
      ) return;

      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelId,
      );
      if (topTargets.length > 0) {
        execute(new AttachWallsTopCommand(entity.id, topTargets, sm));
        EventBus.emit('bim:walls-auto-attached', { wallIds: topTargets.map((t) => t.wallId), hostId: entity.id });
      }
      if (baseTargets.length > 0) {
        execute(new AttachWallsBaseCommand(entity.id, baseTargets, sm));
        EventBus.emit('bim:walls-auto-attached-base', { wallIds: baseTargets.map((t) => t.wallId), hostId: entity.id });
      }
      if (colTopTargets.length > 0) {
        execute(new AttachColumnsCommand('top', entity.id, colTopTargets, sm));
        EventBus.emit('bim:columns-auto-attached', { columnIds: colTopTargets.map((t) => t.columnId), hostId: entity.id });
      }
      if (colBaseTargets.length > 0) {
        execute(new AttachColumnsCommand('base', entity.id, colBaseTargets, sm));
        EventBus.emit('bim:columns-auto-attached-base', { columnIds: colBaseTargets.map((t) => t.columnId), hostId: entity.id });
      }
      if (stairTopTargets.length > 0) {
        execute(new AttachStairsCommand('top', entity.id, stairTopTargets, sm));
        EventBus.emit('bim:stairs-auto-attached', { stairIds: stairTopTargets.map((t) => t.stairId), hostId: entity.id });
      }
      if (stairBaseTargets.length > 0) {
        execute(new AttachStairsCommand('base', entity.id, stairBaseTargets, sm));
        EventBus.emit('bim:stairs-auto-attached-base', { stairIds: stairBaseTargets.map((t) => t.stairId), hostId: entity.id });
      }
    });
    return () => unsub();
  }, [levelManager, execute]);
}
