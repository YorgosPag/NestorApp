'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_DXF_VIEWER_CONTENT = false;

import { useNotifications } from '../../../providers/NotificationProvider';
import { UI_COLORS } from '../config/color-config';
import { PANEL_LAYOUT } from '../config/panel-tokens';
// 🏢 ENTERPRISE FIX (2026-01-27): ADR-045 - Use centralized margins (was hardcoded 80px!)
import { COORDINATE_LAYOUT } from '../rendering/core/CoordinateTransforms';
import { PERFORMANCE_THRESHOLDS } from '../../../core/performance/components/utils/performance-utils';
// 🏢 ENTERPRISE: Centralized movement detection thresholds - ADR-079
import { MOVEMENT_DETECTION } from '../config/tolerance-config';
// ⌨️ ENTERPRISE: Centralized keyboard shortcuts - Single source of truth
import { matchesShortcut } from '../config/keyboard-shortcuts';
// 🤖 ADR-185: AI Drawing Assistant feature flag
import { USE_AI_DRAWING_ASSISTANT } from '../config/feature-flags';

// ✅ React stack suppression handled globally in layout.tsx via public/suppress-console.js


import React from 'react';

// Types - Updated for Canvas V2
import type { DxfViewerAppProps } from '../types';
import type { CircleEntity, ArcEntity, PolylineEntity } from '../types/scene';
import type { ViewTransform, Point2D } from '../rendering/types/Types';
import type { ToolType } from '../ui/toolbar/types';

// ✅ ENTERPRISE: Window interface extension for debug functions
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

// Window augmentation for runLayeringWorkflowTest is in src/types/window.d.ts
// WorkflowTestResult is used locally for type narrowing of the Promise<unknown> return

// Hooks
import { useDxfViewerState } from '../hooks/useDxfViewerState';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useOverlayDrawing } from '../hooks/useOverlayDrawing';
import { useSnapContext } from '../snapping/context/SnapContext';
import { useCanvasOperations } from '../hooks/interfaces/useCanvasOperations';
import { useEventBus, EventBus } from '../systems/events/EventBus';
import type { DrawingEventPayload } from '../systems/events/EventBus';
// 🏢 ENTERPRISE (2026-01-26): Centralized tool metadata - ADR-033
import { preservesOverlayMode } from '../systems/tools/ToolStateManager';
// 🏢 ENTERPRISE (2026-01-30): ADR-055 Entity Creation Manager - Event Bus + Command Pattern
import { useEntityCreationManager } from '../systems/entity-creation';
// 🏢 ENTERPRISE: Centralized debug logging
import { dlog } from '../debug';

// ✅ ENTERPRISE: State Management Hooks (PHASE 4)
import { useOverlayState } from '../hooks/state/useOverlayState';
import { useCanvasTransformState } from '../hooks/state/useCanvasTransformState';
import { useColorMenuState } from '../hooks/state/useColorMenuState';

// Stores and Managers
import { useOverlayStore } from '../overlays/overlay-store';
// 🏢 ENTERPRISE (2026-01-25): Universal Selection System - ADR-030
import { useUniversalSelection } from '../systems/selection';
import { useLevelManager } from '../systems/levels/useLevels';
import { useGripContext } from '../providers/GripProvider';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// ⚡ LCP OPTIMIZATION: Critical UI Components (Load immediately for paint)
import { type FloatingPanelHandle } from '../ui/FloatingPanelContainer';

// 🚀 LAZY LOADED: Non-Critical UI Components (Load after initial paint to reduce LCP)
const OverlayToolbar = React.lazy(() => import('../ui/OverlayToolbar').then(mod => ({ default: mod.OverlayToolbar })));
const ColorManager = React.lazy(() => import('../ui/components/ColorManager').then(mod => ({ default: mod.ColorManager })));
const ProSnapToolbar = React.lazy(() => import('../ui/components/ProSnapToolbar').then(mod => ({ default: mod.ProSnapToolbar })));
const TestsModal = React.lazy(() => import('../ui/components/TestsModal').then(mod => ({ default: mod.TestsModal })));
const CursorSettingsPanel = React.lazy(() => import('../ui/CursorSettingsPanel'));
const CoordinateCalibrationOverlay = React.lazy(() => import('../ui/CoordinateCalibrationOverlay'));
const AutoSaveStatus = React.lazy(() => import('../ui/components/AutoSaveStatus').then(mod => ({ default: mod.AutoSaveStatus })));
const CentralizedAutoSaveStatus = React.lazy(() => import('../ui/components/CentralizedAutoSaveStatus').then(mod => ({ default: mod.CentralizedAutoSaveStatus })));
const OverlayProperties = React.lazy(() => import('../ui/OverlayProperties').then(mod => ({ default: mod.OverlayProperties })));
const DraggableOverlayToolbar = React.lazy(() => import('../ui/components/DraggableOverlayToolbar').then(mod => ({ default: mod.DraggableOverlayToolbar })));
const DraggableOverlayProperties = React.lazy(() => import('../ui/components/DraggableOverlayProperties').then(mod => ({ default: mod.DraggableOverlayProperties })));
// 🏢 PDF BACKGROUND: Lazy load PDF controls panel
const PdfControlsPanel = React.lazy(() => import('../pdf-background').then(mod => ({ default: mod.PdfControlsPanel })));
// 🤖 ADR-185: AI Drawing Assistant (lazy loaded, behind feature flag)
const DxfAiChatPanel = React.lazy(() => import('../ai-assistant/components/DxfAiChatPanel'));
const ToolbarWithCursorCoordinates = React.lazy(() => import('../ui/components/ToolbarWithCursorCoordinates').then(mod => ({ default: mod.ToolbarWithCursorCoordinates })));

// Layout Components - Canvas V2

// ⚡ LCP OPTIMIZATION: Critical layout for initial paint
import { SidebarSection } from '../layout/SidebarSection';
import { MobileSidebarDrawer } from '../layout/MobileSidebarDrawer';
// ADR-176: Responsive layout detection
import { useResponsiveLayout } from '@/components/contacts/dynamic/hooks/useResponsiveLayout';

// 🚀 AGGRESSIVE LAZY LOADING: Heavy layout sections loaded after initial paint
const MainContentSection = React.lazy(() => import('../layout/MainContentSection').then(mod => ({ default: mod.MainContentSection })));
const FloatingPanelsSection = React.lazy(() => import('../layout/FloatingPanelsSection').then(mod => ({ default: mod.FloatingPanelsSection })));

// ✅ ENTERPRISE ARCHITECTURE: Transform Context (Single Source of Truth)
import { TransformProvider } from '../contexts/TransformContext';
// 🏢 ENTERPRISE FIX (2026-02-18): CanvasProvider moved to DxfViewerApp.tsx
// REASON: useDxfViewerState() calls useCanvasContext() which needs CanvasProvider as ancestor
// CanvasProvider is no longer imported or rendered here

// 🧪 UNIFIED TEST RUNNER - Import modal (test functions moved to DebugToolbar)
import { type UnifiedTestReport } from '../debug/unified-test-runner';

// 🛠️ DEBUG TOOLBAR - Consolidated debug/test controls (development only)

// ✅ PERFORMANCE: Use existing LazyLoadWrapper system για heavy components



// ⚡ ENTERPRISE: DXF Performance Optimizer (729 γραμμές Enterprise system)
import { dxfPerformanceOptimizer } from '../performance/DxfPerformanceOptimizer';

// 🏢 ENTERPRISE: Performance Monitor - DXF Viewer only (Bentley/Autodesk pattern)
import { usePerformanceMonitorToggle } from '../hooks/usePerformanceMonitorToggle';
import { PerformanceCategory } from '@/core/performance/types/performance.types';
import { ClientOnlyPerformanceDashboard } from '@/core/performance/components/ClientOnlyPerformanceDashboard';

// ✅ PERFORMANCE: Memoize το main component για να αποφύγουμε άχρηστα re-renders
export const DxfViewerContent = React.memo<DxfViewerAppProps>((props) => {
  const floatingRef = React.useRef<FloatingPanelHandle>(null);
  const state = useDxfViewerState();
  const notifications = useNotifications();
  const eventBus = useEventBus(); // 🔧 PHASE 3: Centralized event coordination
  const colors = useSemanticColors();

  // ADR-176: Responsive layout + sidebar drawer state
  const { layoutMode } = useResponsiveLayout();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  // 🧪 UNIFIED TEST RUNNER - State για modal
  const [testModalOpen, setTestModalOpen] = React.useState(false);
  const [testReport, setTestReport] = React.useState<UnifiedTestReport | null>(null);
  const [formattedTestReport, setFormattedTestReport] = React.useState<string>('');

  // 🧪 TESTS MODAL - State για tests button
  const [testsModalOpen, setTestsModalOpen] = React.useState(false);

  // 🏢 PDF BACKGROUND: State για PDF controls panel visibility
  const [pdfPanelOpen, setPdfPanelOpen] = React.useState(false);

  // 🤖 ADR-185: AI Drawing Assistant panel state
  const [aiChatOpen, setAiChatOpen] = React.useState(false);

  // 🏢 ENTERPRISE: Performance Monitor Toggle (Bentley/Autodesk pattern - DXF Viewer only)
  const { isEnabled: perfMonitorEnabled, toggle: togglePerfMonitor } = usePerformanceMonitorToggle();

  // ⚡ ENTERPRISE: Initialize DXF Performance Optimizer
  // 🏢 Uses centralized PERFORMANCE_THRESHOLDS from performance-utils.ts
  React.useEffect(() => {
    // 🎯 LIGHTHOUSE OPTIMIZATION: Target 7.0s → <2.5s LCP
    dxfPerformanceOptimizer.updateConfig({
      rendering: {
        enableRequestAnimationFrame: true,
        maxFPS: PERFORMANCE_THRESHOLDS.fps.excellent, // 60 FPS
        enableCanvasBuffering: true,
        enableViewportCulling: true,
        enableLOD: true,
        debounceDelay: 8, // Increased from 16ms for better LCP
      },
      memory: {
        enableGarbageCollection: true,
        maxMemoryUsage: PERFORMANCE_THRESHOLDS.memory.warning, // 384MB for better performance
        enableMemoryProfiling: true,
        memoryCheckInterval: 3000, // More frequent checks
      },
      bundling: {
        enableChunkSplitting: true,
        enablePreloading: true,
        maxChunkSize: 200, // Smaller chunks for faster initial load
        enableTreeShaking: true,
      },
      monitoring: {
        enableRealTimeMonitoring: true,
        performanceThresholds: {
          maxLoadTime: PERFORMANCE_THRESHOLDS.loadTime.good, // 2500ms
          maxRenderTime: PERFORMANCE_THRESHOLDS.renderTime.excellent, // 8ms for aggressive optimization
          maxMemoryUsage: PERFORMANCE_THRESHOLDS.memory.warning, // 384MB
          minFPS: PERFORMANCE_THRESHOLDS.fps.minTarget // 45 FPS
        },
        enableAlerts: true
      }
    });

    // 🚀 ENTERPRISE: Enable critical optimizations immediately
    dxfPerformanceOptimizer.applyOptimizationById('canvas_buffer');
    dxfPerformanceOptimizer.applyOptimizationById('viewport_culling');

    return () => {
      // Cleanup όταν component unmounts
      // dxfPerformanceOptimizer.destroy(); // Removed - singleton pattern
    };
  }, []);

  // ✅ PERFORMANCE: Memoize heavy callbacks
  const showCopyableNotification = React.useCallback((message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    const notifyMethod = notifications[type];
    notifyMethod(message, {
      duration: 5000,
      actions: [{
        label: 'Αντιγραφή',
        onClick: () => {
          navigator.clipboard.writeText(message).then(() => {
            notifications.success('Αντιγράφηκε στο πρόχειρο!', { duration: 2000 });
          }).catch(err => {
            console.error('Failed to copy to clipboard:', err);
            notifications.error('Αποτυχία αντιγραφής');
          });
        }
      }]
    });
  }, [notifications]);

  // Expose showCopyableNotification to window for debug overlays
  React.useEffect(() => {
    window.showCopyableNotification = showCopyableNotification;
    return () => {
      delete window.showCopyableNotification;
    };
  }, [showCopyableNotification]);

  // ✅ ENTERPRISE: Overlay State Management (PHASE 4)
  const {
    overlayMode,
    overlayStatus,
    overlayKind,
    setOverlayMode,
    setOverlayStatus,
    setOverlayKind,
  } = useOverlayState();

  // ✅ ENTERPRISE: Canvas Transform State Management (PHASE 4)
  const {
    canvasTransform,
    setCanvasTransform,
  } = useCanvasTransformState({
    currentScene: state.currentScene,
    activeTool: state.activeTool,
  });

  // ✅ ENTERPRISE: Color Menu State Management (PHASE 4)
  const {
    colorMenu,
    openColorMenu,
    closeColorMenu,
    colorMenuRef,
  } = useColorMenuState();

  // 🎯 Canvas visibility states για debug controls
  const [dxfCanvasVisible, setDxfCanvasVisible] = React.useState(true);
  const [layerCanvasVisible, setLayerCanvasVisible] = React.useState(true);
  const {
    activeTool,
    handleToolChange,
    handleAction,
    showGrid,
    toggleGrid, // ✅ ADD: Grid toggle function
    canUndo,
    canRedo,
    snapEnabled,
    showLayers,
    showCalibration,
    showCursorSettings,
    showGuidePanel,
    currentZoom,
    handleFileImport,
    currentScene,
    selectedEntityIds,
    setSelectedEntityIds,
    handleSceneChange,
    handleCalibrationToggle,
        drawingState,
    onMeasurementPoint,
    onMeasurementHover,
    onMeasurementCancel,
    onDrawingPoint,
    onDrawingHover,
    onDrawingCancel,
    onDrawingDoubleClick,
    onEntityCreated,
    gripSettings
  } = state;

  // Get overlay store and level manager
  const overlayStore = useOverlayStore();
  // 🏢 ENTERPRISE (2026-01-25): Universal Selection System - ADR-030
  const universalSelection = useUniversalSelection();
  const levelManager = useLevelManager();

  // 🏢 ENTERPRISE (2026-01-31): CRITICAL FIX - Sync level scene with currentScene
  // PROBLEM: useUnifiedDrawing saves to level scene (via useLevels), but DxfCanvas
  // receives currentScene (via useSceneState) - these are TWO DIFFERENT systems!
  // SOLUTION: Listen to 'drawing:complete' event and sync level scene → currentScene

  // 🔧 FIX: Use refs to avoid re-subscribing on every render (prevents race conditions)
  const levelManagerRef = React.useRef(levelManager);
  const handleSceneChangeRef = React.useRef(handleSceneChange);

  // Keep refs updated
  React.useEffect(() => {
    levelManagerRef.current = levelManager;
    handleSceneChangeRef.current = handleSceneChange;
  });

  React.useEffect(() => {
    const handleDrawingComplete = (payload: DrawingEventPayload<'drawing:complete'>) => {
      const sceneChange = handleSceneChangeRef.current;

      if (payload.updatedScene) {
        sceneChange(payload.updatedScene);
      } else {
        // Fallback to lookup (legacy compatibility)
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
  }, []);

  // 🏢 ENTERPRISE (2026-01-30): ADR-055 Entity Creation Manager - Event Bus + Command Pattern
  // This enables full undo/redo support for all entity creation operations
  // useUnifiedDrawing emits 'entity:create-request' events → this manager handles saving via Commands
  useEntityCreationManager({
    getLevelScene: levelManager.getLevelScene,
    setLevelScene: levelManager.setLevelScene,
    defaultLevelId: levelManager.currentLevelId || '0',
    debug: false, // ADR-055 Event Bus pattern needs debugging
  });

  // Get grip context for manual control
  const { updateGripSettings } = useGripContext();

  // 🧪 WRAP handleAction to intercept special actions
  const wrappedHandleAction = React.useCallback((action: string, data?: string | number | Record<string, unknown>) => {
    if (action === 'run-tests') {
      setTestsModalOpen(true);
      return;
    }
    // 🏢 ENTERPRISE: Performance Monitor Toggle (Bentley/Autodesk pattern)
    if (action === 'toggle-perf') {
      togglePerfMonitor();
      const newState = !perfMonitorEnabled;
      notifications.success(
        `Performance Monitor: ${newState ? 'ON ✅' : 'OFF ❌'}`,
        { content: newState ? 'Μετρήσεις FPS, Memory, Rendering ενεργές' : 'Καλύτερη απόδοση - παρακολούθηση απενεργοποιημένη' }
      );
      return;
    }
    // 🏢 PDF BACKGROUND: Toggle PDF controls panel
    if (action === 'toggle-pdf-background') {
      setPdfPanelOpen(prev => !prev);
      return;
    }
    // 🤖 ADR-185: Toggle AI Drawing Assistant
    if (action === 'toggle-ai-assistant') {
      setAiChatOpen(prev => !prev);
      return;
    }
    // Pass all other actions to original handleAction
    handleAction(action, data);
  }, [handleAction, togglePerfMonitor, perfMonitorEnabled, notifications]);

  // ✅ PERFORMANCE: Memoize wrapped state to prevent unnecessary child re-renders
  const wrappedState = React.useMemo(() => ({
    ...state,
    handleAction: wrappedHandleAction,
    onAction: wrappedHandleAction  // Also add onAction alias
  }), [state, wrappedHandleAction]);
  
  // Get snap context for ProSnapToolbar
  const { enabledModes, toggleMode } = useSnapContext();

  // Get canvas operations hook
  const canvasOps = useCanvasOperations();

  // Use overlay drawing hook
  const {
    overlayCanvasRef,
    draftPolygon,
    snapPoint,
    handleOverlayCanvasClick,
    finishDrawing,
    handleVertexDrag,
    handleRegionUpdate,
    handleOverlayMouseMove,
    clearSnapPoint,
    setDraftPolygon,
    snapManager
  } = useOverlayDrawing({
    overlayMode,
    activeTool,
    overlayKind,
    overlayStatus,
    overlayStore,
    levelManager: {
      getCurrentLevel: () => levelManager.currentLevelId ? { id: levelManager.currentLevelId } : null,
      setLevelScene: levelManager.setLevelScene,
      getLevelScene: levelManager.getLevelScene
    },
    canvasTransform,
    // 🏢 ENTERPRISE (2026-01-25): Route overlay selection through universal selection - ADR-030
    onOverlaySelect: (id: string | null) => {
      if (id) {
        universalSelection.select(id, 'overlay');
      } else {
        universalSelection.clearByType('overlay');
      }
    }
  });

  // ⌨️ ENTERPRISE: Keyboard shortcuts using centralized keyboard-shortcuts.ts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // ⌨️ Ctrl+F2 or Ctrl+Shift+T: Layering Workflow Test
      if (matchesShortcut(event, 'debugLayeringTest') || matchesShortcut(event, 'debugLayeringTestAlt')) {
        event.preventDefault();
        event.stopPropagation();

        // Direct call to window function
        if (window.runLayeringWorkflowTest) {
          window.runLayeringWorkflowTest().then((rawResult: unknown) => {
            const result = rawResult as WorkflowTestResult;
            const successSteps = result.steps.filter((s: WorkflowStepResult) => s.status === 'success').length;
            const totalSteps = result.steps.length;
            const summary = `Workflow: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}\nSteps: ${successSteps}/${totalSteps}\nLayer Displayed: ${result.layerDisplayed ? '✅ YES' : '❌ NO'}`;
            showCopyableNotification(summary, result.success ? 'success' : 'error');
          });
        } else {
          // Fallback to import
          import('../debug/layering-workflow-test').then(module => {
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
        // 🏢 FIX (2026-02-19): Reset overlayMode + cancel polygon + change tool
        // Previously only changed activeTool, leaving overlayMode as 'draw'
        // This caused the user to need 2 Escape presses instead of 1
        if (overlayMode === 'draw') {
          setOverlayMode('select');
          eventBus.emit('overlay:cancel-polygon', undefined as unknown as void);
        }
        handleToolChange('select');
      }
    };

    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [activeTool, handleToolChange, overlayMode, setOverlayMode, eventBus]);

  // 🚨 FIXED: Initialize canvasTransform only once to prevent infinite loops
  const isInitializedRef = React.useRef(false);
  React.useEffect(() => {
    // Only initialize once when scene becomes available
    if (isInitializedRef.current || !currentScene) return;

    try {
      const initialTransform = canvasOps.getTransform();
      setCanvasTransform({
        scale: initialTransform.scale || 1,
        offsetX: initialTransform.offsetX || 0,
        offsetY: initialTransform.offsetY || 0,
      });
      isInitializedRef.current = true;
    } catch (error) {
      // Swallow silently - not critical
    }
  }, [currentScene]); // ✅ FIXED: Removed canvasOps from dependency array

  // ✅ PERFORMANCE: Use ref to avoid canvasTransform dependency (prevents infinite loops)
  const canvasTransformRef = React.useRef(canvasTransform);
  canvasTransformRef.current = canvasTransform;

  React.useEffect(() => {
    if (activeTool !== 'layering') return;

    // 🔧 PHASE 3: Use EventBus instead of direct addEventListener
    const cleanup = eventBus.on('dxf-zoom-changed', ({ transform: newTransform }) => {
      try {
        if (!newTransform) return;

        const currentTransform = canvasTransformRef.current;
        // Only update if values changed significantly - STRONGER thresholds
        // 🏢 ENTERPRISE: Use centralized MOVEMENT_DETECTION from tolerance-config.ts
        if (Math.abs(currentTransform.scale - newTransform.scale) > MOVEMENT_DETECTION.ZOOM_PRESET_MATCH ||
            Math.abs(currentTransform.offsetX - newTransform.offsetX) > MOVEMENT_DETECTION.OFFSET_CHANGE ||
            Math.abs(currentTransform.offsetY - newTransform.offsetY) > MOVEMENT_DETECTION.OFFSET_CHANGE) {
          setCanvasTransform({
            scale: newTransform.scale || 1,
            offsetX: newTransform.offsetX || 0,
            offsetY: newTransform.offsetY || 0,
          });
        }
      } catch (error) {
        // Swallow silently - not critical
      }
    });

    return cleanup;
  }, [activeTool, eventBus, setCanvasTransform]);

  // ✅ REF: Store the Context setTransform function
  const contextSetTransformRef = React.useRef<((t: ViewTransform) => void) | null>(null);

  // ✅ STABLE CALLBACK: Κάνω το onTransformReady stable με useCallback
  const handleTransformReady = React.useCallback((setTransform: (t: ViewTransform) => void) => {
    contextSetTransformRef.current = setTransform;
  }, []);

  // Wrap handleTransformChange to also update canvasTransform state
  const wrappedHandleTransformChange = React.useCallback((transform: ViewTransform) => {
    const normalizedTransform = {
      scale: transform.scale || 1,
      offsetX: transform.offsetX || 0,
      offsetY: transform.offsetY || 0,
    };

    // Update the canvas transform state for OverlayLayer
    setCanvasTransform(normalizedTransform);

    // ✅ UPDATE CONTEXT: Ενημέρωση του Transform Context (Single Source of Truth)
    if (contextSetTransformRef.current) {
      contextSetTransformRef.current(normalizedTransform);
    }
  }, [setCanvasTransform]);

  // 🏠 PAN TO WORLD ORIGIN (0,0) - Function for DebugToolbar
  const panToWorldOrigin = React.useCallback(() => {
    // Get canvas element to determine viewport size
    const canvasElement = document.querySelector('[data-canvas-type="dxf"]') as HTMLCanvasElement;
    if (!canvasElement) {
      showCopyableNotification('Canvas not found', 'error');
      return;
    }

    // ✅ FIX: Use DISPLAY size (CSS pixels), not internal canvas resolution!
    const rect = canvasElement.getBoundingClientRect();
    const viewport = {
      width: rect.width,
      height: rect.height
    };

    // 🏢 ENTERPRISE FIX (2026-01-27): ADR-045 - Use CENTRALIZED margins (was hardcoded 80px!)
    // PROBLEM: Hardcoded 80px caused ~50px offset (actual rulers are 30px)
    // SOLUTION: Use COORDINATE_LAYOUT.MARGINS from CoordinateTransforms.ts (Single Source of Truth)
    const MARGIN_LEFT = COORDINATE_LAYOUT.MARGINS.left;   // 30px - synced with actual ruler width
    const MARGIN_TOP = COORDINATE_LAYOUT.MARGINS.top;     // 30px - synced with actual ruler height

    // Calculate offsets to center world (0,0) in viewport
    const screenCenterX = viewport.width / 2;
    const screenCenterY = viewport.height / 2;

    const newOffsetX = screenCenterX - MARGIN_LEFT;
    const newOffsetY = (viewport.height - MARGIN_TOP) - screenCenterY;

    const newTransform: ViewTransform = {
      scale: 1,  // Keep current zoom level (or reset to 1)
      offsetX: newOffsetX,
      offsetY: newOffsetY
    };

    // Apply the new transform
    wrappedHandleTransformChange(newTransform);

    // 🎯 SHOW VISUAL INDICATOR: Pulsing crosshair at center
    const canvasX = MARGIN_LEFT + newOffsetX;
    const canvasY = (viewport.height - MARGIN_TOP) - newOffsetY;

    // ✅ FIX: Convert to browser screen coordinates
    const finalScreenX = rect.left + canvasX;
    const finalScreenY = rect.top + canvasY;

    // Create overlay div for visual indicator
    const overlay = document.createElement('div');
    overlay.id = 'origin-indicator-overlay';
    overlay.style.cssText = `
      position: fixed;
      left: ${finalScreenX}px;
      top: ${finalScreenY}px;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 10000;
    `;

    // Create crosshair with pulsing animation
    overlay.innerHTML = `
      <svg width="200" height="200" style="overflow: visible;">
        <!-- Outer pulsing circle -->
        <circle cx="100" cy="100" r="60" fill="none" stroke={UI_COLORS.BRIGHT_YELLOW} stroke-width="3" opacity="0.8">
          <animate attributeName="r" values="60;80;60" dur="2s" repeatCount="3" />
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="3" />
        </circle>

        <!-- Inner pulsing circle -->
        <circle cx="100" cy="100" r="30" fill="none" stroke="${UI_COLORS.BRIGHT_GREEN}" stroke-width="2" opacity="0.9">
          <animate attributeName="r" values="30;50;30" dur="2s" repeatCount="3" />
          <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="3" />
        </circle>

        <!-- Crosshair lines -->
        <line x1="100" y1="50" x2="100" y2="150" stroke="${UI_COLORS.SELECTED_RED}" stroke-width="2" opacity="0.9" />
        <line x1="50" y1="100" x2="150" y2="100" stroke="${UI_COLORS.SELECTED_RED}" stroke-width="2" opacity="0.9" />

        <!-- Center dot -->
        <circle cx="100" cy="100" r="5" fill="${UI_COLORS.BRIGHT_YELLOW}" stroke="${UI_COLORS.SELECTED_RED}" stroke-width="1">
          <animate attributeName="r" values="5;8;5" dur="1s" repeatCount="6" />
        </circle>

        <!-- Arrows pointing to center -->
        <path d="M 100 20 L 95 35 L 105 35 Z" fill="${UI_COLORS.BRIGHT_GREEN}" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="translate" values="0 0; 0 10; 0 0" dur="1.5s" repeatCount="indefinite" />
        </path>

        <path d="M 180 100 L 165 95 L 165 105 Z" fill="${UI_COLORS.BRIGHT_GREEN}" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" begin="0.375s" />
          <animateTransform attributeName="transform" type="translate" values="0 0; -10 0; 0 0" dur="1.5s" repeatCount="indefinite" begin="0.375s" />
        </path>

        <path d="M 100 180 L 95 165 L 105 165 Z" fill="${UI_COLORS.BRIGHT_GREEN}" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" begin="0.75s" />
          <animateTransform attributeName="transform" type="translate" values="0 0; 0 -10; 0 0" dur="1.5s" repeatCount="indefinite" begin="0.75s" />
        </path>

        <path d="M 20 100 L 35 95 L 35 105 Z" fill="${UI_COLORS.BRIGHT_GREEN}" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" begin="1.125s" />
          <animateTransform attributeName="transform" type="translate" values="0 0; 10 0; 0 0" dur="1.5s" repeatCount="indefinite" begin="1.125s" />
        </path>

        <!-- Label -->
        <text x="100" y="210" text-anchor="middle" fill="${UI_COLORS.WHITE}" font-size="14" font-weight="bold"
              stroke="${UI_COLORS.BLACK}" stroke-width="3" paint-order="stroke">
          WORLD (0,0)
        </text>
        <text x="100" y="210" text-anchor="middle" fill="${UI_COLORS.BRIGHT_GREEN}" font-size="14" font-weight="bold">
          WORLD (0,0)
        </text>
      </svg>
    `;

    document.body.appendChild(overlay);

    // Remove overlay after 6 seconds
    setTimeout(() => {
      const elem = document.getElementById('origin-indicator-overlay');
      if (elem) {
        elem.style.transition = 'opacity 0.5s';
        elem.style.opacity = '0';
        setTimeout(() => elem.remove(), PANEL_LAYOUT.TIMING.ELEMENT_REMOVE);
      }
    }, 6000);

    showCopyableNotification(
      `Panned to World Origin (0,0)\n\n` +
      `🎯 World (0,0) is now at screen center\n` +
      `📐 Screen Position: (${finalScreenX.toFixed(1)}, ${finalScreenY.toFixed(1)})\n` +
      `🔍 Transform: offset=(${newOffsetX.toFixed(1)}, ${newOffsetY.toFixed(1)})`,
      'success'
    );
  }, [wrappedHandleTransformChange, showCopyableNotification]);

  // Wrapper για το handleFileImport που υποστηρίζει encoding
  const handleFileImportWithEncoding = async (file: File, encoding?: string) => {
    try {
      // 🔺 USE EXISTING LEVEL instead of creating new one
      // Check if we have a current level to use
      const currentLevel = levelManager.currentLevelId;
      
      if (currentLevel) {

        // Clear overlays for current level to start fresh
        overlayStore.setCurrentLevel(currentLevel);

        // Import the DXF into the existing level
        handleFileImport(file);
      } else {
        console.warn('⚠️ [Enhanced Import] No current level found, creating default level');
        // Only create new level if no current level exists
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '');
        const newLevelName = `${file.name.replace('.dxf', '')}_${timestamp}`;
        
        const newLevelId = await levelManager.addLevel(newLevelName, true);
        
        if (newLevelId) {

          overlayStore.setCurrentLevel(newLevelId);

          handleFileImport(file);
        } else {
          console.error('❌ [Enhanced Import] Failed to create new level');
          return;
        }
      }

      // ✅ ΣΩΣΤΗ ΚΑΤΑΝΟΗΣΗ: Το layering tool δεν χρειάζεται για την εμφάνιση της DXF κάτοψης
      // Η DXF κάτοψη πρέπει να εμφανίζεται στον DxfCanvas ανεξάρτητα από το layering tool
      // Το layering tool ελέγχει μόνο τα έγχρωμα overlay layers, όχι την βασική κάτοψη
    } catch (error) {
      console.error('⛔ [Enhanced Import] Error in enhanced DXF import:', error);
      // Fallback to normal import on any error
      handleFileImport(file);
    }
  };

  // Auto-expand selection in levels panel when selection changes
  React.useEffect(() => {
    if (!selectedEntityIds?.length) return;
    // REMOVED: showTab('properties') - Properties καρτέλα αφαιρέθηκε
    floatingRef.current?.expandForSelection(selectedEntityIds, currentScene); // άπλωσε groups + scroll
  }, [selectedEntityIds, currentScene]);

  // Handle overlay region click
  const handleRegionClick = React.useCallback((regionId: string) => {
    // 🏢 ENTERPRISE (2026-01-25): Use universal selection system - ADR-030
    universalSelection.select(regionId, 'overlay');

    // Auto-open levels tab when clicking on overlay in canvas
    floatingRef.current?.showTab('levels');

    // Update toolbar with selected overlay's status and kind
    const selectedOverlay = overlayStore.overlays[regionId];
    if (selectedOverlay) {
      setOverlayStatus(selectedOverlay.status || 'for-sale');
      setOverlayKind(selectedOverlay.kind);
    }

    // ✅ COORDINATE OFFSET FIX: Real-time bounds detection now handled in useCentralizedMouseHandlers
    
    // Auto-open layers panel when clicking on layer in canvas
    if (!showLayers) {
      handleAction('toggle-layers');
    }
    
    // Auto-expand the project level that contains this overlay
    if (selectedOverlay && selectedOverlay.levelId && selectedOverlay.levelId !== levelManager.currentLevelId) {
      levelManager.setCurrentLevel(selectedOverlay.levelId);
    }
  }, [overlayStore, showLayers, handleAction, levelManager]);

  // Enable grips for selected entities in select mode, grip-edit mode, and layering modes
  // ✅ ENTERPRISE: ChatGPT5 Solution - Track previous values to prevent unnecessary updates
  const prevGripStateRef = React.useRef<{ shouldEnableGrips: boolean } | null>(null);

  React.useEffect(() => {
    // Νέο: κρατάμε τα grips ενεργά ΚΑΙ στο overlayMode: 'draw' (layering)
    const shouldEnableGrips =
      activeTool === 'select' ||
      activeTool === 'grip-edit' ||
      (activeTool === 'layering' && (overlayMode === 'edit' || overlayMode === 'draw'));

    // ✅ ENTERPRISE: Guard - Skip if nothing changed (ChatGPT5 solution)
    if (prevGripStateRef.current?.shouldEnableGrips === shouldEnableGrips) {
      return;
    }

    prevGripStateRef.current = { shouldEnableGrips };

    updateGripSettings({
      showGrips: shouldEnableGrips,
      multiGripEdit: true,
      snapToGrips: true,
    });
  }, [activeTool, overlayMode, updateGripSettings]); // ✅ Keep updateGripSettings but guard prevents loops

  // Sync level manager currentLevelId with overlay store
  React.useEffect(() => {
    if (levelManager.currentLevelId !== overlayStore.currentLevelId) {
      overlayStore.setCurrentLevel(levelManager.currentLevelId);
    }
  }, [levelManager.currentLevelId, overlayStore]);

  // 🔺 AUTO-ACTIVATE LAYERING TOOL when overlay is selected
  // 🏢 ENTERPRISE (2026-01-25): Use universal selection system - ADR-030
  // 🔧 FIX (2026-02-13): Only auto-switch on NEW selection, not on every activeTool change.
  // Previous code had [primarySelectedId, activeTool] deps → feedback loop: any tool change
  // with a selected overlay immediately reverted back to 'layering'.
  const primarySelectedId = universalSelection.getPrimaryId();
  const prevPrimarySelectedIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const isNewSelection = primarySelectedId !== null && primarySelectedId !== prevPrimarySelectedIdRef.current;
    prevPrimarySelectedIdRef.current = primarySelectedId;

    // Auto-switch to layering ONLY when a different OVERLAY is first selected
    // 🔧 FIX (2026-02-15): Gate by selection type — dxf-entity clicks stay in current tool
    if (isNewSelection && activeTool !== 'layering') {
      const primaryEntry = universalSelection.context.universalSelection.get(primarySelectedId!);
      const isOverlaySelection = primaryEntry?.type === 'overlay' || primaryEntry?.type === 'region';
      if (isOverlaySelection) {
        handleToolChange('layering');
      }
    }
  }, [primarySelectedId, activeTool, handleToolChange, universalSelection]);


  // 🔺 Bridge overlay edit mode to grip editing system (with guard to prevent loops)
  React.useEffect(() => {
    // Guard: αν είμαστε σε layering tool, μην κάνουμε auto-switch σε grip-edit
    // Αυτό σταματάει το loop και το «πέταγμα» της καρτέλας
    if (activeTool === 'layering') {
      return;
    }

    if (activeTool === 'grip-edit' && overlayMode !== 'edit') {
      // If we're in grip-edit but overlay mode changed away from edit, go back to layering
      handleToolChange('layering');
    }
  }, [overlayMode, activeTool, handleToolChange]);

  // 🏢 ENTERPRISE (2026-01-26): Cancel overlay drawing when switching to non-overlay tools - ADR-033
  // Uses centralized tool metadata from ToolStateManager.ts (preservesOverlayMode property)
  // Fixes bug where overlay draw mode persists when switching to measure-distance, etc.
  React.useEffect(() => {
    // Use centralized tool metadata - NO hardcoded arrays!
    // preservesOverlayMode() checks TOOL_DEFINITIONS[tool].preservesOverlayMode
    if (overlayMode === 'draw' && !preservesOverlayMode(activeTool)) {
      dlog('DxfViewerContent', 'Cancelling overlay draw mode - switched to non-overlay tool:', activeTool);
      setOverlayMode('select');
      // Also emit cancel event to clear any draft polygon
      eventBus.emit('overlay:cancel-polygon', undefined as unknown as void);
    }
  }, [activeTool, overlayMode, setOverlayMode, eventBus]);

  // Listen for tool change requests from LevelPanel
  React.useEffect(() => {
    // 🔧 PHASE 3: Use EventBus instead of window.addEventListener
    const cleanup = eventBus.on('level-panel:tool-change', (requestedTool) => {
      handleToolChange(requestedTool as ToolType);
    });

    return cleanup;
  }, [eventBus, handleToolChange]);

  // ✅ ΧΡΗΣΗ ΥΠΑΡΧΟΝΤΟΣ EVENT SYSTEM: Listen for layering activation from LevelPanel
  React.useEffect(() => {
    // 🔧 PHASE 3: Use EventBus instead of window.addEventListener
    const cleanup = eventBus.on('level-panel:layering-activate', () => {
      // ✅ ΔΙΟΡΘΩΣΗ: Ensure layers are always shown (not toggled)
      if (!showLayers) {
        handleAction('toggle-layers');
      }
    });

    return cleanup;
  }, [eventBus, handleAction, showLayers]);

  // 🔺 Listen for polygon updates from grip editing
  React.useEffect(() => {
    // 🔧 PHASE 3: Use EventBus instead of window.addEventListener
    const cleanup = eventBus.on('overlay:polygon-update', ({ regionId, newVertices }) => {
      if (newVertices && regionId) {
        // Convert Point2D array to [number, number][] for overlay store
        const polygon: [number, number][] = newVertices.map((v: Point2D) => [v.x, v.y]);
        overlayStore.update(regionId, { polygon });
      }
    });

    return cleanup;
  }, [eventBus, overlayStore]);

  // Fix 2: Ασφάλεια στο parent - sync από το bus (μόνο για 'select')
  React.useEffect(() => {
    // 🔧 PHASE 3: Use EventBus instead of window.addEventListener
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

  // ✅ PERFORMANCE: Memoize selection set to avoid recreating on every call
  const selectionIdSet = React.useMemo(() =>
    new Set(selectedEntityIds || []),
    [selectedEntityIds]
  );

  // ✅ PERFORMANCE: Optimize nudgeSelection with memoized selection set
  const nudgeSelection = React.useCallback((dx: number, dy: number) => {
    if (!currentScene || !selectedEntityIds?.length) return;

    const moved = currentScene.entities.map(e => {
      if (!selectionIdSet.has(e.id)) return e;

      if (e.type === 'line' && e.start && e.end) {
        return {
          ...e,
          start: { x: e.start.x + dx, y: e.start.y + dy },
          end:   { x: e.end.x   + dx, y: e.end.y   + dy }
        };
      }
      if ((e.type === 'circle' || e.type === 'arc') && (e as CircleEntity | ArcEntity).center) {
        const circleOrArc = e as CircleEntity | ArcEntity;
        return { ...e, center: { x: circleOrArc.center.x + dx, y: circleOrArc.center.y + dy } };
      }
      if (e.type === 'polyline' && Array.isArray((e as PolylineEntity).vertices)) {
        const polyline = e as PolylineEntity;
        const pts = polyline.vertices?.map((p: Point2D) => ({ x: p.x + dx, y: p.y + dy })) || [];
        return { ...e, vertices: pts };
      }
      // fallback: αν έχεις bounds-only ή άλλα types, άφησέ τα ως έχουν
      return e;
    });

    const updated = { ...currentScene, entities: moved };
    handleSceneChange(updated);
    // Scene rendering is handled by Canvas V2 system
  }, [currentScene, selectionIdSet, handleSceneChange]);

  // Keyboard shortcuts hook
  const { handleCanvasMouseMove } = useKeyboardShortcuts({
    selectedEntityIds,
    currentScene,
    onNudgeSelection: nudgeSelection,
    onColorMenuClose: closeColorMenu,
    onDrawingCancel: state.onDrawingCancel, // 🎯 ADR-047: Cancel drawing on Escape
    activeTool,
    overlayMode,
    overlayStore
  });

  // Keep global pointer lock behavior scoped to desktop only.
  // Mobile/tablet must keep toolbar taps active in layering mode.
  const rootPointerEventsClass =
    layoutMode === 'desktop' && activeTool === 'layering'
      ? PANEL_LAYOUT.POINTER_EVENTS.NONE
      : PANEL_LAYOUT.POINTER_EVENTS.AUTO;

  return (
      <TransformProvider
        initialTransform={canvasTransform}
        onTransformReady={handleTransformReady}
      >
      <section
        className={`flex h-full ${PANEL_LAYOUT.SPACING.SM} ${PANEL_LAYOUT.GAP.SM} ${colors.bg.primary} ${rootPointerEventsClass}`}
      >
      {/* ✅ PHASE 5: Sidebar Section — ADR-176: Responsive */}
      {layoutMode === 'desktop' ? (
        <SidebarSection
          floatingRef={floatingRef}
          currentScene={currentScene}
          selectedEntityIds={selectedEntityIds}
          setSelectedEntityIds={setSelectedEntityIds}
          currentZoom={currentZoom}
          activeTool={activeTool}
        />
      ) : (
        <MobileSidebarDrawer
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          floatingRef={floatingRef}
          currentScene={currentScene}
          selectedEntityIds={selectedEntityIds}
          setSelectedEntityIds={setSelectedEntityIds}
          currentZoom={currentZoom}
          activeTool={activeTool}
        />
      )}

      {/* 🚀 LCP OPTIMIZATION: Lazy-loaded Main Content Section */}
      <React.Suspense fallback={<div className={`flex-1 ${colors.bg.skeleton} ${PANEL_LAYOUT.ANIMATE.PULSE}`} />}>
        <MainContentSection
        state={wrappedState}
        currentScene={currentScene}
        handleFileImportWithEncoding={handleFileImportWithEncoding}
        canvasTransform={canvasTransform}
        wrappedHandleTransformChange={wrappedHandleTransformChange}
        handleRegionClick={handleRegionClick}
        handleCanvasMouseMove={handleCanvasMouseMove}
        overlayMode={overlayMode}
        overlayStatus={overlayStatus}
        overlayKind={overlayKind}
        setOverlayMode={setOverlayMode}
        setOverlayStatus={setOverlayStatus}
        setOverlayKind={setOverlayKind}
        dxfCanvasVisible={dxfCanvasVisible}
        layerCanvasVisible={layerCanvasVisible}
        setDxfCanvasVisible={setDxfCanvasVisible}
        setLayerCanvasVisible={setLayerCanvasVisible}
        showCopyableNotification={showCopyableNotification}
        showGrid={showGrid}
        activeTool={activeTool}
        handleToolChange={handleToolChange}
        testModalOpen={testModalOpen}
        setTestModalOpen={setTestModalOpen}
        testReport={testReport}
        setTestReport={setTestReport}
        formattedTestReport={formattedTestReport}
        setFormattedTestReport={setFormattedTestReport}
        panToWorldOrigin={panToWorldOrigin}
        showCalibration={showCalibration}
        handleCalibrationToggle={handleCalibrationToggle}
        onSidebarToggle={() => setSidebarOpen(prev => !prev)}
        />
      </React.Suspense>

      {/* 🚀 LCP OPTIMIZATION: Lazy-loaded Floating Panels Section */}
      <React.Suspense fallback={<div className={`${PANEL_LAYOUT.WIDTH.PANEL_SM} ${colors.bg.skeleton} ${PANEL_LAYOUT.ANIMATE.PULSE}`} />}>
        <FloatingPanelsSection
        colorMenu={colorMenu}
        currentScene={currentScene}
        handleSceneChange={handleSceneChange}
        closeColorMenu={closeColorMenu}
        floatingRef={floatingRef}
        showCursorSettings={showCursorSettings}
        showCalibration={showCalibration}
        showGuidePanel={showGuidePanel}
        handleAction={wrappedHandleAction}
        activeTool={activeTool}
        overlayMode={overlayMode}
        overlayStatus={overlayStatus}
        overlayKind={overlayKind}
        setOverlayMode={setOverlayMode}
        setOverlayStatus={setOverlayStatus}
        setOverlayKind={setOverlayKind}
        snapEnabled={snapEnabled}
        handleToolChange={handleToolChange}
        canUndo={canUndo}
        canRedo={canRedo}
        overlayStore={overlayStore}
        testModalOpen={testModalOpen}
        setTestModalOpen={setTestModalOpen}
        testReport={testReport}
        formattedTestReport={formattedTestReport}
        />
      </React.Suspense>

      {/* 🚀 LCP OPTIMIZATION: Lazy-loaded Tests Modal for reduced initial bundle */}
      <React.Suspense fallback={<div className="hidden" />}>
        <TestsModal
          isOpen={testsModalOpen}
          onClose={() => setTestsModalOpen(false)}
          showCopyableNotification={showCopyableNotification}
        />
      </React.Suspense>

      {/* 🏢 PDF BACKGROUND: Lazy-loaded PDF Controls Panel */}
      <React.Suspense fallback={<div className="hidden" />}>
        <PdfControlsPanel
          isOpen={pdfPanelOpen}
          onClose={() => setPdfPanelOpen(false)}
        />
      </React.Suspense>

      {/* 🤖 ADR-185: AI Drawing Assistant Chat Panel */}
      {USE_AI_DRAWING_ASSISTANT && (
        <React.Suspense fallback={<div className="hidden" />}>
          <DxfAiChatPanel
            isOpen={aiChatOpen}
            onClose={() => setAiChatOpen(false)}
            getScene={levelManager.getLevelScene}
            setScene={levelManager.setLevelScene}
            levelId={levelManager.currentLevelId || '0'}
          />
        </React.Suspense>
      )}

      {/* 🏢 ENTERPRISE: Performance Monitor - DXF Viewer only (Bentley/Autodesk pattern)
          - OFF by default for better performance
          - Toggle available in DebugToolbar (PERF ON/OFF button)
          - State persisted in localStorage */}
      {perfMonitorEnabled && (
        <ClientOnlyPerformanceDashboard
          showDetails
          updateInterval={2000}
          categories={[
            PerformanceCategory.RENDERING,
            PerformanceCategory.MEMORY
          ]}
        />
      )}
      </section>
      </TransformProvider>
  );
});

export default DxfViewerContent;



