'use client';

/**
 * useDxfViewerEffects — All useEffect blocks extracted from DxfViewerContent.
 * ADR-065 SRP split: effects/subscriptions module.
 *
 * Related files:
 * - DxfViewerContent.tsx (main orchestrator)
 * - useDxfViewerCallbacks.ts (callbacks module)
 */

import React from 'react';
import { PERFORMANCE_THRESHOLDS } from '../../../core/performance/components/utils/performance-utils';
import { MOVEMENT_DETECTION } from '../config/tolerance-config';
import { matchesShortcut } from '../config/keyboard-shortcuts';
import { dxfPerformanceOptimizer } from '../performance/DxfPerformanceOptimizer';
import { useEventBus, EventBus } from '../systems/events/EventBus';
import type { DrawingEventPayload } from '../systems/events/EventBus';
import { preservesOverlayMode } from '../systems/tools/ToolStateManager';
import { dlog } from '../debug';
import type { ViewTransform, Point2D } from '../rendering/types/Types';
import type { SceneModel } from '../types/scene';
import type { FloatingPanelHandle } from '../ui/FloatingPanelContainer';
import type { ToolType } from '../ui/toolbar/types';
import type { NotificationContextValue } from '@/types/notifications';
import type { LevelsHookReturn } from '../systems/levels/useLevels';
import type { UniversalSelectionHook } from '../systems/selection/SelectionSystem';
import type { OverlayEditorMode } from '../overlays/types';

// Types used only by debug keyboard shortcuts
interface WorkflowStepResult {
  step: string;
  status: 'success' | 'failed';
  error?: string;
  durationMs: number;
}

interface WorkflowTestResult {
  success: boolean;
  steps: WorkflowStepResult[];
  layerDisplayed: boolean;
  reportTime: string;
}

/** Params for useDxfViewerEffects */
export interface DxfViewerEffectsParams {
  activeTool: ToolType;
  overlayMode: OverlayEditorMode;
  currentScene: SceneModel | null;
  canvasTransform: { scale: number; offsetX: number; offsetY: number };
  showLayers: boolean;
  selectedEntityIds: string[];
  primarySelectedId: string | null;

  setOverlayMode: (mode: OverlayEditorMode) => void;
  setCanvasTransform: (t: { scale: number; offsetX: number; offsetY: number }) => void;
  setSelectedEntityIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleToolChange: (tool: ToolType) => void;
  handleAction: (action: string, data?: string | number | Record<string, unknown>) => void;
  handleSceneChange: (scene: SceneModel) => void;
  updateGripSettings: (settings: { showGrips: boolean; multiGripEdit: boolean; snapToGrips: boolean }) => void;
  showCopyableNotification: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;

  eventBus: ReturnType<typeof useEventBus>;
  notifications: NotificationContextValue;
  canvasOps: { getTransform: () => ViewTransform };

  levelManager: LevelsHookReturn;
  overlayStore: {
    currentLevelId: string | null;
    setCurrentLevel: (id: string | null) => void;
    update: (id: string, data: Record<string, unknown>) => void;
  };
  universalSelection: UniversalSelectionHook;

  floatingRef: React.RefObject<FloatingPanelHandle | null>;
  isInitializedRef: React.MutableRefObject<boolean>;
  canvasTransformRef: React.MutableRefObject<{ scale: number; offsetX: number; offsetY: number }>;
  prevGripStateRef: React.MutableRefObject<{ shouldEnableGrips: boolean } | null>;
  prevPrimarySelectedIdRef: React.MutableRefObject<string | null>;
  levelManagerRef: React.MutableRefObject<LevelsHookReturn>;
  handleSceneChangeRef: React.MutableRefObject<(scene: SceneModel) => void>;
}

/**
 * Custom hook extracting all useEffect blocks from DxfViewerContent.
 * ADR-065 SRP split.
 */
export function useDxfViewerEffects(params: DxfViewerEffectsParams): void {
  const {
    activeTool, overlayMode, currentScene, canvasTransform,
    showLayers, selectedEntityIds, primarySelectedId,
    setOverlayMode, setCanvasTransform, setSelectedEntityIds,
    handleToolChange, handleAction, handleSceneChange,
    updateGripSettings, showCopyableNotification,
    eventBus, notifications, canvasOps,
    levelManager, overlayStore, universalSelection,
    floatingRef, isInitializedRef, canvasTransformRef,
    prevGripStateRef, prevPrimarySelectedIdRef,
    levelManagerRef, handleSceneChangeRef,
  } = params;

  // ⚡ ENTERPRISE: Initialize DXF Performance Optimizer
  React.useEffect(() => {
    dxfPerformanceOptimizer.updateConfig({
      rendering: {
        enableRequestAnimationFrame: true,
        maxFPS: PERFORMANCE_THRESHOLDS.fps.excellent,
        enableCanvasBuffering: true,
        enableViewportCulling: true,
        enableLOD: true,
        debounceDelay: 8,
      },
      memory: {
        enableGarbageCollection: true,
        maxMemoryUsage: PERFORMANCE_THRESHOLDS.memory.warning,
        enableMemoryProfiling: true,
        memoryCheckInterval: 3000,
      },
      bundling: {
        enableChunkSplitting: true,
        enablePreloading: true,
        maxChunkSize: 200,
        enableTreeShaking: true,
      },
      monitoring: {
        enableRealTimeMonitoring: true,
        performanceThresholds: {
          maxLoadTime: PERFORMANCE_THRESHOLDS.loadTime.good,
          maxRenderTime: PERFORMANCE_THRESHOLDS.renderTime.excellent,
          maxMemoryUsage: PERFORMANCE_THRESHOLDS.memory.warning,
          minFPS: PERFORMANCE_THRESHOLDS.fps.minTarget
        },
        enableAlerts: true
      }
    });
    dxfPerformanceOptimizer.applyOptimizationById('canvas_buffer');
    dxfPerformanceOptimizer.applyOptimizationById('viewport_culling');
  }, []);

  // Expose showCopyableNotification to window for debug overlays
  React.useEffect(() => {
    window.showCopyableNotification = showCopyableNotification;
    return () => { delete window.showCopyableNotification; };
  }, [showCopyableNotification]);

  // Keep refs updated (non-dep effect)
  React.useEffect(() => {
    levelManagerRef.current = levelManager;
    handleSceneChangeRef.current = handleSceneChange;
  });

  // 🏢 ENTERPRISE (2026-01-31): Sync level scene with currentScene on drawing:complete
  React.useEffect(() => {
    const handleDrawingComplete = (payload: DrawingEventPayload<'drawing:complete'>) => {
      const sceneChange = handleSceneChangeRef.current;

      if (payload.updatedScene) {
        sceneChange(payload.updatedScene);
      } else {
        const lm = levelManagerRef.current;
        if (lm.currentLevelId) {
          const levelScene = lm.getLevelScene(lm.currentLevelId);
          if (levelScene) {
            sceneChange(levelScene);
          }
        }
      }
    };

    const unsubscribe = EventBus.on('drawing:complete', handleDrawingComplete);
    return () => { unsubscribe(); };
  }, [levelManagerRef, handleSceneChangeRef]);

  // ⌨️ ENTERPRISE: Keyboard shortcuts (Ctrl+F2, F3, ESC)
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // ⌨️ Ctrl+F2 or Ctrl+Shift+T: Layering Workflow Test
      if (matchesShortcut(event, 'debugLayeringTest') || matchesShortcut(event, 'debugLayeringTestAlt')) {
        event.preventDefault();
        event.stopPropagation();

        if (window.runLayeringWorkflowTest) {
          window.runLayeringWorkflowTest().then((rawResult: unknown) => {
            const result = rawResult as WorkflowTestResult;
            const successSteps = result.steps.filter((s: WorkflowStepResult) => s.status === 'success').length;
            const totalSteps = result.steps.length;
            const summary = `Workflow: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}\nSteps: ${successSteps}/${totalSteps}\nLayer Displayed: ${result.layerDisplayed ? '✅ YES' : '❌ NO'}`;
            showCopyableNotification(summary, result.success ? 'success' : 'error');
          });
        } else {
          import('../debug/layering-workflow-test.qa').then(module => {
            const runLayeringWorkflowTest = module.runLayeringWorkflowTest;
            runLayeringWorkflowTest().then((result) => {
              const successSteps = result.steps.filter((s) => s.status === 'success').length;
              const totalSteps = result.steps.length;
              const summary = `Workflow: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}\nSteps: ${successSteps}/${totalSteps}\nLayer Displayed: ${result.layerDisplayed ? '✅ YES' : '❌ NO'}`;
              showCopyableNotification(summary, result.success ? 'success' : 'error');
            });
          });
        }
        return;
      }

      // ⌨️ F3: Cursor-Crosshair Alignment Test
      if (matchesShortcut(event, 'debugCursorTest')) {
        event.preventDefault();
        event.stopPropagation();

        import('../debug/enterprise-cursor-crosshair-test').then(module => {
          const { runEnterpriseMouseCrosshairTests, startEnterpriseInteractiveTest } = module.default;
          const results = runEnterpriseMouseCrosshairTests();
          const summary = `Enterprise Test: ${results.overallStatus}
Scenarios: ${results.passedScenarios}/${results.totalScenarios} passed
Avg Performance: ${results.avgPerformance.toFixed(1)}ms
Max Error: ${results.maxError.toFixed(3)}px
Min Pass Rate: ${(results.minPassRate * 100).toFixed(1)}%

Check console for detailed metrics`;
          startEnterpriseInteractiveTest();
          showCopyableNotification(summary, results.overallStatus === 'PASS' ? 'success' : 'warning');
        }).catch(() => {
          showCopyableNotification('Failed to load enterprise cursor-crosshair test module', 'error');
        });
        return;
      }

      // ⌨️ ESC to exit layering mode — full cleanup in one press
      if (matchesShortcut(event, 'escape') && activeTool === 'layering') {
        if (overlayMode === 'draw') {
          setOverlayMode('select');
          eventBus.emit('overlay:cancel-polygon', undefined as unknown as void);
        }
        handleToolChange('select');
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [activeTool, handleToolChange, overlayMode, setOverlayMode, eventBus, showCopyableNotification]);

  // 🚨 Canvas transform initialization (once when scene becomes available)
  React.useEffect(() => {
    if (isInitializedRef.current || !currentScene) return;
    try {
      const initialTransform = canvasOps.getTransform();
      setCanvasTransform({
        scale: initialTransform.scale || 1,
        offsetX: initialTransform.offsetX || 0,
        offsetY: initialTransform.offsetY || 0,
      });
      isInitializedRef.current = true;
    } catch {
      // Swallow silently - not critical
    }
  }, [currentScene]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ PERFORMANCE: Keep canvasTransformRef in sync
  React.useEffect(() => {
    canvasTransformRef.current = canvasTransform;
  }, [canvasTransform, canvasTransformRef]);

  // Zoom listener — sync canvasTransform from EventBus
  React.useEffect(() => {
    if (activeTool !== 'layering') return;

    const cleanup = eventBus.on('dxf-zoom-changed', ({ transform: newTransform }) => {
      try {
        if (!newTransform) return;
        const currentTransform = canvasTransformRef.current;
        if (Math.abs(currentTransform.scale - newTransform.scale) > MOVEMENT_DETECTION.ZOOM_PRESET_MATCH ||
            Math.abs(currentTransform.offsetX - newTransform.offsetX) > MOVEMENT_DETECTION.OFFSET_CHANGE ||
            Math.abs(currentTransform.offsetY - newTransform.offsetY) > MOVEMENT_DETECTION.OFFSET_CHANGE) {
          setCanvasTransform({
            scale: newTransform.scale || 1,
            offsetX: newTransform.offsetX || 0,
            offsetY: newTransform.offsetY || 0,
          });
        }
      } catch {
        // Swallow silently - not critical
      }
    });

    return cleanup;
  }, [activeTool, eventBus, setCanvasTransform, canvasTransformRef]);

  // Auto-expand selection in levels panel when selection changes
  React.useEffect(() => {
    if (!selectedEntityIds?.length) return;
    floatingRef.current?.expandForSelection(selectedEntityIds, currentScene);
  }, [selectedEntityIds, currentScene, floatingRef]);

  // Enable grips for selected entities in select, grip-edit, and layering modes
  React.useEffect(() => {
    const shouldEnableGrips =
      activeTool === 'select' ||
      activeTool === 'grip-edit' ||
      (activeTool === 'layering' && (overlayMode === 'edit' || overlayMode === 'draw'));

    if (prevGripStateRef.current?.shouldEnableGrips === shouldEnableGrips) return;
    prevGripStateRef.current = { shouldEnableGrips };

    updateGripSettings({
      showGrips: shouldEnableGrips,
      multiGripEdit: true,
      snapToGrips: true,
    });
  }, [activeTool, overlayMode, updateGripSettings, prevGripStateRef]);

  // Sync level manager currentLevelId with overlay store
  React.useEffect(() => {
    if (levelManager.currentLevelId !== overlayStore.currentLevelId) {
      overlayStore.setCurrentLevel(levelManager.currentLevelId);
    }
  }, [levelManager.currentLevelId, overlayStore]);

  // 🔺 AUTO-ACTIVATE LAYERING TOOL when overlay is selected
  React.useEffect(() => {
    const isNewSelection = primarySelectedId !== null && primarySelectedId !== prevPrimarySelectedIdRef.current;
    prevPrimarySelectedIdRef.current = primarySelectedId;

    if (isNewSelection && activeTool !== 'layering') {
      const primaryEntry = universalSelection.context.universalSelection.get(primarySelectedId!);
      const isOverlaySelection = primaryEntry?.type === 'overlay' || primaryEntry?.type === 'region';
      if (isOverlaySelection) {
        handleToolChange('layering');
      }
    }
  }, [primarySelectedId, activeTool, handleToolChange, universalSelection, prevPrimarySelectedIdRef]);

  // 🔺 Bridge overlay edit mode to grip editing system
  React.useEffect(() => {
    if (activeTool === 'layering') return;
    if (activeTool === 'grip-edit' && overlayMode !== 'edit') {
      handleToolChange('layering');
    }
  }, [overlayMode, activeTool, handleToolChange]);

  // 🏢 ENTERPRISE (2026-01-26): Cancel overlay drawing on non-overlay tool switch - ADR-033
  React.useEffect(() => {
    if (overlayMode === 'draw' && !preservesOverlayMode(activeTool)) {
      dlog('DxfViewerContent', 'Cancelling overlay draw mode - switched to non-overlay tool:', activeTool);
      setOverlayMode('select');
      eventBus.emit('overlay:cancel-polygon', undefined as unknown as void);
    }
  }, [activeTool, overlayMode, setOverlayMode, eventBus]);

  // Listen for tool change requests from LevelPanel
  React.useEffect(() => {
    const cleanup = eventBus.on('level-panel:tool-change', (requestedTool) => {
      handleToolChange(requestedTool as ToolType);
    });
    return cleanup;
  }, [eventBus, handleToolChange]);

  // Listen for layering activation from LevelPanel
  React.useEffect(() => {
    const cleanup = eventBus.on('level-panel:layering-activate', () => {
      if (!showLayers) {
        handleAction('toggle-layers');
      }
    });
    return cleanup;
  }, [eventBus, handleAction, showLayers]);

  // 🔺 Listen for polygon updates from grip editing
  React.useEffect(() => {
    const cleanup = eventBus.on('overlay:polygon-update', ({ regionId, newVertices }) => {
      if (newVertices && regionId) {
        const polygon: [number, number][] = newVertices.map((v: Point2D) => [v.x, v.y]);
        overlayStore.update(regionId, { polygon });
      }
    });
    return cleanup;
  }, [eventBus, overlayStore]);

  // Sync selection from bus (mode: 'select' only)
  React.useEffect(() => {
    const cleanup = eventBus.on('dxf.highlightByIds', ({ mode, ids }) => {
      if (mode !== 'select') return;
      const validIds: string[] = Array.isArray(ids) ? ids : [];
      setSelectedEntityIds(prev => {
        if (prev.length === validIds.length && prev.every((v, i) => v === validIds[i])) return prev;
        return validIds;
      });
    });
    return cleanup;
  }, [eventBus, setSelectedEntityIds]);

  // 🏢 ENTERPRISE: Centralized notification for polygon save errors
  React.useEffect(() => {
    const cleanup = eventBus.on('overlay:save-error', ({ reason }) => {
      if (reason === 'no-level-selected') {
        notifications.warning('Παρακαλώ επιλέξτε ένα επίπεδο (Level) πρώτα για να αποθηκευτεί το polygon.', { duration: 4000 });
      }
    });
    return cleanup;
  }, [eventBus, notifications]);
}
