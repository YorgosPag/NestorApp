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
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PERFORMANCE_THRESHOLDS } from '../../../core/performance/components/utils/performance-utils';
import { matchesShortcut } from '../config/keyboard-shortcuts';
import { dxfPerformanceOptimizer } from '../performance/DxfPerformanceOptimizer';
import { useEventBus, EventBus } from '../systems/events/EventBus';
import type { DrawingEventPayload } from '../systems/events/EventBus';
import { preservesOverlayMode } from '../systems/tools/ToolStateManager';
// ADR-364 — Escape Command Bus SSoT (no raw ESC branch on this hook's listener)
import { useEscapeHandler, ESC_PRIORITY } from '../systems/escape-bus';
import { dlog } from '../debug';
import type { Point2D } from '../rendering/types/Types';
import type { SceneModel } from '../types/scene';
import type { FloatingPanelHandle } from '../ui/FloatingPanelContainer';
import type { ToolType } from '../ui/toolbar/types';
import type { NotificationContextValue } from '@/types/notifications';
import type { LevelsHookReturn } from '../systems/levels/useLevels';
import type { OverlayEditorMode } from '../overlays/types';
// ADR-532 Stage B5 — the bus `dxf.highlightByIds` sync reads/writes the selection
// store imperatively (no reactive selection prop). The two selection-DRIVEN
// effects moved to SelectionSideEffectsHost (its own store subscription).
import { SelectedEntitiesStore } from '../systems/selection';

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

/**
 * Single owner of the Ctrl+F2 layering-workflow report (N.0.2 / N.18, ADR-364 §10.14).
 *
 * The two ways of obtaining the runner (QA global vs dynamic import) used to carry a
 * verbatim copy of this summary each — a real 62-token clone that `jscpd --diff` flagged
 * the first time this file was staged. Debug-only output, so no i18n (N.11 exempts
 * developer diagnostics, same as `logger.*`).
 */
function reportLayeringWorkflowResult(
  result: WorkflowTestResult,
  notify: (message: string, kind: 'success' | 'error') => void,
): void {
  const successSteps = result.steps.filter(s => s.status === 'success').length;
  const summary =
    `Workflow: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}\n` +
    `Steps: ${successSteps}/${result.steps.length}\n` +
    `Layer Displayed: ${result.layerDisplayed ? '✅ YES' : '❌ NO'}`;
  notify(summary, result.success ? 'success' : 'error');
}

/** Params for useDxfViewerEffects */
export interface DxfViewerEffectsParams {
  activeTool: ToolType;
  overlayMode: OverlayEditorMode;
  currentScene: SceneModel | null;
  showLayers: boolean;

  setOverlayMode: (mode: OverlayEditorMode) => void;
  handleToolChange: (tool: ToolType) => void;
  handleAction: (action: string, data?: string | number | Record<string, unknown>) => void;
  handleSceneChange: (scene: SceneModel) => void;
  updateGripSettings: (settings: { showGrips: boolean; multiGripEdit: boolean; snapToGrips: boolean }) => void;
  showCopyableNotification: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;

  eventBus: ReturnType<typeof useEventBus>;
  notifications: NotificationContextValue;

  levelManager: LevelsHookReturn;
  overlayStore: {
    currentLevelId: string | null;
    setCurrentLevel: (id: string | null) => void;
    update: (id: string, data: Record<string, unknown>) => void;
  };

  floatingRef: React.RefObject<FloatingPanelHandle | null>;
  prevGripStateRef: React.MutableRefObject<{ shouldEnableGrips: boolean } | null>;
  levelManagerRef: React.MutableRefObject<LevelsHookReturn>;
  handleSceneChangeRef: React.MutableRefObject<(scene: SceneModel) => void>;
}

/**
 * Custom hook extracting all useEffect blocks from DxfViewerContent.
 * ADR-065 SRP split.
 */
export function useDxfViewerEffects(params: DxfViewerEffectsParams): void {
  const { t } = useTranslation('dxf-viewer');
  const {
    activeTool, overlayMode, currentScene,
    showLayers,
    setOverlayMode,
    handleToolChange, handleAction, handleSceneChange,
    updateGripSettings, showCopyableNotification,
    eventBus, notifications,
    levelManager, overlayStore,
    floatingRef,
    prevGripStateRef,
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

        // N.0.2 / N.18 (ADR-364 §10.14) — the two branches below differ ONLY in where the
        // runner comes from (a global installed by the QA bundle vs a dynamic import).
        // Their reporting was duplicated verbatim (jscpd: 62 tokens); it now lives in
        // `reportLayeringWorkflowResult` below, so the summary format has one owner.
        const run: Promise<WorkflowTestResult> = window.runLayeringWorkflowTest
          ? window.runLayeringWorkflowTest().then((raw: unknown) => raw as WorkflowTestResult)
          : import('../debug/layering-workflow-test.qa').then(m => m.runLayeringWorkflowTest());
        run.then(result => reportLayeringWorkflowResult(result, showCopyableNotification));
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

      // ADR-364 §10.14 — ESC is NOT handled here any more; see the bus slot below.
    };

    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
    // ADR-364 §10.14 — `activeTool`, `handleToolChange`, `overlayMode`, `setOverlayMode`
    // and `eventBus` left this dependency list together with the ESC branch: they were
    // read ONLY there. The listener now re-registers only when the notifier changes,
    // instead of on every tool change and every overlay-mode flip.
  }, [showCopyableNotification]);

  // ADR-364 §10.14 (Κ2 #12) — ESC exits the layering tool, on the central bus.
  //
  // The listener above registers the SAME handler on both `document` and `window` in
  // capture, so its ESC branch was a doubly-registered Zone-A owner. Measured live
  // 2026-07-25: it fires only when no bus slot consumed (`command-line/dismiss` claimed
  // a press and the tool correctly stayed «Επίπεδα»), which is why LAYERING_EXIT (270)
  // sits BELOW the composite deselect at 400 — see the constant's doc for the full
  // reasoning and for why GROUP_EXIT went the other way.
  //
  // N.0.2 — the old branch open-coded `if (overlayMode === 'draw') setOverlayMode('select')`,
  // which is character-for-character `handleExitDrawMode` in `useCanvasEditActions.ts` —
  // already wired into the bus at OVERLAY_DRAW_MODE (350) and inside the 400 composite.
  // Both of those run BEFORE this slot in the same dispatch (350 deliberately returns
  // `false` so the chain continues), so overlay draw-mode is already back to 'select' by
  // the time we get here. The duplicate is dropped; only the two things nobody else does
  // remain: cancelling the draft overlay polygon and returning the toolbar to 'select'.
  useEscapeHandler({
    id: 'app/layering-exit',
    priority: ESC_PRIORITY.LAYERING_EXIT,
    canHandle: () => activeTool === 'layering',
    handle: () => {
      // Live consumer: `hooks/canvas/usePolygonCompletion.ts` (`eventBus.on('overlay:cancel-polygon')`).
      eventBus.emit('overlay:cancel-polygon', undefined as unknown as void);
      handleToolChange('select');
      return true;
    },
  });

  // ADR-040 Phase XIII: canvas transform initialization, ref sync, and zoom
  // listener are owned by `useCanvasTransformState` (TransformStore-backed).

  // ADR-532 Stage B5 — the selection-DRIVEN effects (auto-expand levels panel +
  // auto-activate layering on overlay selection) moved to SelectionSideEffectsHost,
  // which subscribes to the selection store as a leaf. Keeping them here would
  // re-run this whole orchestrator hook on every click (the 122ms cascade).

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

  // ADR-358 Phase Q17 9B-5 — auto-open left "Properties" floating panel tab
  // when the stair tool activates, so the user sees the contextual ribbon tab
  // AND the floating Properties surface together (Giorgio request 2026-05-17).
  // Industry pattern: Revit Stair tool → Modify tab + Properties palette
  // appear together. Switching away from the tool leaves the tab choice alone.
  React.useEffect(() => {
    if (activeTool === 'stair') {
      floatingRef.current?.showTab('properties');
    }
  }, [activeTool, floatingRef]);

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

  // Sync selection from bus (mode: 'select' only) — writes to SelectedEntitiesStore (SSoT)
  React.useEffect(() => {
    const cleanup = eventBus.on('dxf.highlightByIds', ({ mode, ids }) => {
      if (mode !== 'select') return;
      const validIds: string[] = Array.isArray(ids) ? ids : [];
      // ADR-532 Stage B5 — read/replace via the store (skip-if-unchanged lives in
      // SelectedEntitiesStore.replaceEntitySelection). Equivalent to the old
      // universalSelection.* round-trip but with zero subscription here.
      const currentIds = SelectedEntitiesStore.getSelectedEntityIds();
      if (currentIds.length !== validIds.length || !currentIds.every((v, i) => v === validIds[i])) {
        SelectedEntitiesStore.replaceEntitySelection(validIds);
      }
    });
    return cleanup;
  }, [eventBus]);

  // 🏢 ENTERPRISE: Centralized notification for polygon save errors
  React.useEffect(() => {
    const cleanup = eventBus.on('overlay:save-error', ({ reason }) => {
      if (reason === 'no-level-selected') {
        notifications.warning(t('callbacks.selectLevelForPolygon'), { duration: 4000 });
      } else if (reason === 'no-background-context') {
        notifications.warning(t('callbacks.overlayNeedsBackground'), { duration: 5000 });
      }
    });
    return cleanup;
  }, [eventBus, notifications, t]);
}
