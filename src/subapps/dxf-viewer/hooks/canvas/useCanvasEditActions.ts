import { useCallback } from 'react';
import type React from 'react';
import type { MutableRefObject } from 'react';
import type { ICommand } from '../../core/commands';
import type { OverlayEditorMode } from '../../overlays/types';
import type { ToolType } from '../../ui/toolbar/types';
import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import type { SelectedGrip, UnifiedGripInfo } from '../grips/unified-grip-types';
import type { UniversalSelectionHook } from '../../systems/selection';
import type { useOverlayStore } from '../../overlays/overlay-store';
import type { useEventBus } from '../../systems/events/EventBus';
import { useTextCreationTool } from './useTextCreationTool';
import { useArrayRepickHandlers } from './useArrayRepickHandlers';
import { useSmartDelete } from './useSmartDelete';
import { useEntityJoin } from '../useEntityJoin';
// ADR-532 B4 — event-time selection read (CanvasSection no longer re-renders on selection).
import { SelectedEntitiesStore } from '../../systems/selection/SelectedEntitiesStore';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { BatchReorderEntityCommand } from '../../core/commands/entity-commands';
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
  selectedGrips: SelectedGrip[];
  setSelectedGrips: (grips: SelectedGrip[]) => void;
  overlayStoreRef: MutableRefObject<ReturnType<typeof useOverlayStore>>;
  universalSelectionRef: MutableRefObject<UniversalSelectionHook>;
  levelManager: LevelsHookReturn;
  setSelectedEntityIds: (ids: string[]) => void;
  eventBus: ReturnType<typeof useEventBus>;
  notifyWarning: (msg: string) => void;
  notifySuccess: (msg: string) => void;
  /** ADR-363 Phase 3.8 — hovered DXF grip for context-aware vertex delete */
  hoveredDxfGrip?: UnifiedGripInfo | null;
}

export function useCanvasEditActions({
  activeTool, overlayMode, setOverlayMode,
  transformRef, containerRef, onToolChange, executeCommand,
  selectedGrips, setSelectedGrips,
  overlayStoreRef, universalSelectionRef,
  levelManager, setSelectedEntityIds, eventBus,
  notifyWarning, notifySuccess,
  hoveredDxfGrip,
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
    hoveredDxfGrip,
  });
  // ADR-532 B4 — `entityJoinHook` is selection-agnostic (takes ids as args). The
  // join-STATE display moved to the selection-subscribed `EntityContextMenuHost`
  // leaf (computeEntityJoinState), and the keyboard join reads the selection at
  // event time — so this orchestrator hook no longer derives a join-state snapshot.
  const entityJoinHook = useEntityJoin({ levelManager, executeCommand, setSelectedEntityIds, onWarning: notifyWarning, onSuccess: notifySuccess });
  const handleExitDrawMode = useCallback(() => {
    if (overlayMode === 'draw' && setOverlayMode) setOverlayMode('select');
  }, [overlayMode, setOverlayMode]);
  const handleReorderEntity = useCallback((direction: 'front' | 'back') => {
    // ADR-532 B4 — read the selection at event time (no stale render snapshot).
    // ADR-661 — N≥1: BatchReorderEntityCommand moves the whole selected set in one
    // atomic commit, preserving relative order (do NOT sort `ids` here).
    const ids = SelectedEntitiesStore.getSelectedEntityIds();
    if (ids.length === 0 || !levelManager.currentLevelId) return;
    const adapter = createLevelSceneManagerAdapter(levelManager.getLevelScene, levelManager.setLevelScene, levelManager.currentLevelId);
    executeCommand(new BatchReorderEntityCommand(ids, direction, adapter));
  }, [levelManager, executeCommand]);
  return { textCreation, handleArrayPolarCenterRepick, handleArrayPathEntityRepick, handleSmartDelete, entityJoinHook, handleExitDrawMode, handleReorderEntity };
}
