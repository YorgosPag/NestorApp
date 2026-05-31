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
  type WallAttachTarget,
} from '../bim/walls/wall-structural-attach-coordinator';
import { AttachWallsTopCommand } from '../core/commands/entity-commands/AttachWallsTopCommand';
import { isWallEntity } from '../types/entities';
import type { Entity } from '../types/entities';
import type { SceneModel } from '../types/scene';
import type { WallEntity } from '../bim/types/wall-types';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
  setLevelScene: (levelId: string, scene: SceneModel) => void;
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
      const wallIds = findWallsToAutoAttachToHost(entity as unknown as Entity, entities);
      if (wallIds.length === 0) return;

      const targets: WallAttachTarget[] = [];
      for (const id of wallIds) {
        const w = entities.find((e) => e.id === id);
        if (w && isWallEntity(w)) targets.push({ wallId: id, kind: (w as WallEntity).kind });
      }
      if (targets.length === 0) return;

      const sm = new LevelSceneManagerAdapter(
        levelManager.getLevelScene,
        levelManager.setLevelScene,
        levelId,
      );
      execute(new AttachWallsTopCommand(entity.id, targets, sm));
      EventBus.emit('bim:walls-auto-attached', { wallIds: targets.map((t) => t.wallId), hostId: entity.id });
    });
    return () => unsub();
  }, [levelManager, execute]);
}
