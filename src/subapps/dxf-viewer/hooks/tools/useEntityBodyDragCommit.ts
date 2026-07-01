/**
 * USE ENTITY BODY-DRAG COMMIT — ADR (Entity Body-Drag: move / Ctrl-copy)
 *
 * Owns the command side of the body-drag gesture. The canvas mouseup
 * (`mouse-handler-up`) emits `entity-body-drag:commit` with the entity ids,
 * the (ORTHO-locked) displacement and the copy flag; this hook — which has the
 * command history + level manager wired — turns it into an undoable command:
 *
 *   - copy → shared clone SSoT `buildEntityCloneCommand` (BIM enterprise IDs +
 *     host rewire + DXF id-swap), then re-select the clones (Revit feedback).
 *   - move → `MoveEntityCommand` / `MoveMultipleEntitiesCommand` (the SAME
 *     commands the 2-click Move tool commits), selection preserved.
 *
 * EventBus-driven (mirror of {@link useEntityClipboard}) so the mouse pipeline
 * stays free of command/level wiring.
 *
 * @see systems/cursor/mouse-handler-up.ts — emits the commit event
 * @see bim/transforms/build-entity-clone-command.ts — clone SSoT (shared with Ctrl+V)
 */
'use client';

import { useCallback, useEffect } from 'react';
import { EventBus } from '../../systems/events';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { buildEntityCloneCommand } from '../../bim/transforms/build-entity-clone-command';
import { MoveEntityCommand, MoveMultipleEntitiesCommand } from '../../core/commands';
import type { ICommand, SceneEntity } from '../../core/commands/interfaces';
import type { Point2D } from '../../rendering/types/Types';
import type { useLevels } from '../../systems/levels';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseEntityBodyDragCommitProps {
  levelManager: LevelManagerLike;
  executeCommand: (cmd: ICommand) => void;
  /** Re-selects the freshly pasted clones (copy) — Revit feedback. */
  selectEntities: (ids: string[]) => void;
}

interface BodyDragCommitPayload {
  entityIds: string[];
  delta: Point2D;
  copy: boolean;
}

export function useEntityBodyDragCommit({
  levelManager,
  executeCommand,
  selectEntities,
}: UseEntityBodyDragCommitProps): void {
  const commit = useCallback((payload: BodyDragCommitPayload) => {
    const { entityIds, delta, copy } = payload;
    const floorId = levelManager.currentLevelId;
    if (!floorId || entityIds.length === 0) return;
    if (delta.x === 0 && delta.y === 0) return;

    const sm = createLevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      floorId,
    );

    if (copy) {
      const scene = levelManager.getLevelScene(floorId);
      if (!scene) return;
      const idSet = new Set(entityIds);
      const sources = scene.entities.filter((e) => idSet.has(e.id)) as unknown as SceneEntity[];
      const result = buildEntityCloneCommand(sources, delta, sm);
      if (!result) return;
      executeCommand(result.command);
      selectEntities(result.cloneIds);
      return;
    }

    // Move — same commands as the 2-click Move tool (selection preserved).
    const command = entityIds.length === 1
      ? new MoveEntityCommand(entityIds[0], delta, sm, false)
      : new MoveMultipleEntitiesCommand(entityIds, delta, sm, false);
    executeCommand(command);
  }, [levelManager, executeCommand, selectEntities]);

  useEffect(() => {
    const off = EventBus.on('entity-body-drag:commit', commit);
    return () => { off(); };
  }, [commit]);
}
