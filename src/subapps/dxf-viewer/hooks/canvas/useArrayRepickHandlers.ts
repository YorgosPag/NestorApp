import { useCallback } from 'react';
import { useLevels } from '../../systems/levels';
import type { ICommand } from '../../core/commands';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  applyCenterPick as applyPolarCenterPick,
  getPickingCenterArrayId as getPolarPickingArrayId,
} from '../../systems/array/polar-center-pick-controller';
import {
  applyPathPick,
  getPickingPathArrayId,
} from '../../systems/array/path-pick-controller';

type LevelManager = ReturnType<typeof useLevels>;

interface UseArrayRepickHandlersProps {
  levelManager: LevelManager;
  executeCommand: (cmd: ICommand) => void;
}

export function useArrayRepickHandlers({ levelManager, executeCommand }: UseArrayRepickHandlersProps) {
  const handleArrayPolarCenterRepick = useCallback((worldPoint: { x: number; y: number }): boolean => {
    if (!getPolarPickingArrayId()) return false;
    if (!levelManager.currentLevelId) return false;
    const adapter = new LevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
    const result = applyPolarCenterPick(worldPoint, adapter, executeCommand);
    return result.ok;
  }, [levelManager, executeCommand]);

  const handleArrayPathEntityRepick = useCallback((): boolean => {
    if (!getPickingPathArrayId()) return false;
    if (!levelManager.currentLevelId) return false;
    const adapter = new LevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
    const result = applyPathPick(adapter, executeCommand);
    return result.ok;
  }, [levelManager, executeCommand]);

  return { handleArrayPolarCenterRepick, handleArrayPathEntityRepick };
}
