import { useCallback, useMemo } from 'react';
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
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { ReorderEntityCommand } from '../../core/commands/entity-commands';
// ADR-344 Phase 13 — feed active scene units into ribbon text creation so 2.5
// paper-mm default lands in world units regardless of DXF unit system.
import { resolveSceneUnits } from '../../utils/scene-units';

/**
 * Perf guard — `getJoinPreview` runs an O(n²) segment-chain (force-connect) just
 * to derive a context-menu label. On large selections (e.g. marquee-selecting a
 * whole floorplan before a mass-delete) that chaining saturates the main thread
 * and drops FPS to ~1, which in turn starves the auto-save fetch into a 60s
 * timeout. The label is only meaningful for the small "join these few segments"
 * case, so above this size we keep the menu enabled (cheap `canJoin`) but skip
 * the preview. See HANDOFF 2026-06-16 perf FPS-1 + ADR-186.
 */
const JOIN_PREVIEW_MAX_SELECTION = 64;

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
  /** ADR-363 Phase 3.8 — hovered DXF grip for context-aware vertex delete */
  hoveredDxfGrip?: UnifiedGripInfo | null;
}

export function useCanvasEditActions({
  activeTool, overlayMode, setOverlayMode,
  transformRef, containerRef, onToolChange, executeCommand,
  selectedEntityIds, selectedGrips, setSelectedGrips,
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
  const entityJoinHook = useEntityJoin({ levelManager, executeCommand, setSelectedEntityIds, onWarning: notifyWarning, onSuccess: notifySuccess });
  const entityJoinState = useMemo(() => {
    const canJoin = entityJoinHook.canJoin(selectedEntityIds);
    // Perf: skip the expensive O(n²) join-preview chain on large selections —
    // it only produces a context-menu label and otherwise starves the main
    // thread (FPS-1) during marquee-select before a mass-delete.
    const preview = canJoin && selectedEntityIds.length <= JOIN_PREVIEW_MAX_SELECTION
      ? entityJoinHook.getJoinPreview(selectedEntityIds)
      : null;
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
