import { useCallback, useMemo } from 'react';
import type React from 'react';
import type { MutableRefObject } from 'react';
import type { ICommand } from '../../core/commands';
import type { OverlayEditorMode } from '../../overlays/types';
import type { ToolType } from '../../ui/toolbar/types';
import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import type { SelectedGrip } from '../grips/unified-grip-types';
import type { UniversalSelectionHook } from '../../systems/selection';
import type { useOverlayStore } from '../../overlays/overlay-store';
import type { useEventBus } from '../../systems/events/EventBus';
import { useTextCreationTool } from './useTextCreationTool';
import { useArrayRepickHandlers } from './useArrayRepickHandlers';
import { useSmartDelete } from './useSmartDelete';
import { useEntityJoin } from '../useEntityJoin';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { ReorderEntityCommand } from '../../core/commands/entity-commands';
// ADR-344 Phase 13 — feed active scene units into ribbon text creation so 2.5
// paper-mm default lands in world units regardless of DXF unit system.
import { resolveSceneUnits } from '../../utils/scene-units';

interface Params {
  activeTool: ToolType;
  overlayMode: OverlayEditorMode;
  setOverlayMode: ((mode: OverlayEditorMode) => void) | undefined;
  transformRef: React.MutableRefObject<{ scale: number; offsetX: number; offsetY: number }>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onToolChange: ((tool: string) => void) | undefined;
  executeCommand: (command: ICommand) => void;
  selectedEntityIds: string[];
  selectedGrips: SelectedGrip[];
  setSelectedGrips: (grips: SelectedGrip[]) => void;
  overlayStoreRef: MutableRefObject<ReturnType<typeof useOverlayStore>>;
  universalSelectionRef: MutableRefObject<UniversalSelectionHook>;
  levelManager: LevelsHookReturn;
  setSelectedEntityIds: (ids: string[]) => void;
  eventBus: ReturnType<typeof useEventBus>;
  notifyWarning: (msg: string) => void;
  notifySuccess: (msg: string) => void;
}

export function useCanvasEditActions({
  activeTool, overlayMode, setOverlayMode,
  transformRef, containerRef, onToolChange, executeCommand,
  selectedEntityIds, selectedGrips, setSelectedGrips,
  overlayStoreRef, universalSelectionRef,
  levelManager, setSelectedEntityIds, eventBus,
  notifyWarning, notifySuccess,
}: Params) {
  const textCreation = useTextCreationTool({
    transformRef, containerRef, activeTool,
    onToolChange: (tool) => onToolChange?.(tool),
    executeCommand,
    getSceneUnits: () => resolveSceneUnits(
      levelManager.currentLevelId ? levelManager.getLevelScene(levelManager.currentLevelId) : null,
    ),
  });
  const { handleArrayPolarCenterRepick, handleArrayPathEntityRepick } = useArrayRepickHandlers({ levelManager, executeCommand });
  const { handleSmartDelete } = useSmartDelete({
    selectedGrips, setSelectedGrips, executeCommand,
    overlayStoreRef, universalSelectionRef, levelManager, setSelectedEntityIds, eventBus,
  });
  const entityJoinHook = useEntityJoin({ levelManager, executeCommand, setSelectedEntityIds, onWarning: notifyWarning, onSuccess: notifySuccess });
  const entityJoinState = useMemo(() => {
    const canJoin = entityJoinHook.canJoin(selectedEntityIds);
    const preview = canJoin ? entityJoinHook.getJoinPreview(selectedEntityIds) : null;
    return { canJoin, joinResultLabel: preview?.resultType !== 'not-joinable' ? preview?.resultType : undefined };
  }, [entityJoinHook, selectedEntityIds]);
  const handleExitDrawMode = useCallback(() => {
    if (overlayMode === 'draw' && setOverlayMode) setOverlayMode('select');
  }, [overlayMode, setOverlayMode]);
  const handleReorderEntity = useCallback((direction: 'front' | 'back') => {
    if (selectedEntityIds.length !== 1 || !levelManager.currentLevelId) return;
    const adapter = new LevelSceneManagerAdapter(levelManager.getLevelScene, levelManager.setLevelScene, levelManager.currentLevelId);
    executeCommand(new ReorderEntityCommand(selectedEntityIds[0], direction, adapter));
  }, [selectedEntityIds, levelManager, executeCommand]);
  return { textCreation, handleArrayPolarCenterRepick, handleArrayPathEntityRepick, handleSmartDelete, entityJoinHook, entityJoinState, handleExitDrawMode, handleReorderEntity };
}
