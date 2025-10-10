'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_DXF_VIEWER_CONTENT = false;

import { useNotifications } from '../../../providers/NotificationProvider';

// ✅ React stack suppression handled globally in layout.tsx via public/suppress-console.js


import React from 'react';

// Types - Updated for Canvas V2
import type { DxfViewerAppProps, Status as AppStatus } from '../types';
import type { SceneModel, LineEntity, CircleEntity, ArcEntity, PolylineEntity } from '../types/scene';
import type { OverlayEditorMode, OverlayKind, Status } from '../overlays/types';
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

declare global {
  interface Window {
    showCopyableNotification?: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
    runLayeringWorkflowTest?: () => Promise<WorkflowTestResult>;
  }
}

// Hooks
import { useDxfViewerState } from '../hooks/useDxfViewerState';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useOverlayDrawing } from '../hooks/useOverlayDrawing';
import { useCursor } from '../systems/cursor';
import { useSnapContext } from '../snapping/context/SnapContext';
import { useCanvasOperations } from '../hooks/interfaces/useCanvasOperations';
import { useEventBus } from '../systems/events/EventBus';

// ✅ ENTERPRISE: State Management Hooks (PHASE 4)
import { useOverlayState } from '../hooks/state/useOverlayState';
import { useCanvasTransformState } from '../hooks/state/useCanvasTransformState';
import { useColorMenuState } from '../hooks/state/useColorMenuState';

// Stores and Managers
import { useOverlayStore } from '../overlays/overlay-store';
import { useLevelManager } from '../systems/levels/useLevels';
import { useGripContext } from '../providers/GripProvider';
import { globalRulerStore } from '../settings-provider';

// UI Components
import { FloatingPanelContainer, type FloatingPanelHandle } from '../ui/FloatingPanelContainer';
import { EnhancedDXFToolbar } from '../ui/toolbar';
import { OverlayToolbar } from '../ui/OverlayToolbar';
import { ColorManager } from '../ui/components/ColorManager';
import { ProSnapToolbar } from '../ui/components/ProSnapToolbar';
import { TestsModal } from '../ui/components/TestsModal';
import CursorSettingsPanel from '../ui/CursorSettingsPanel';
import CoordinateCalibrationOverlay from '../ui/CoordinateCalibrationOverlay';
import { AutoSaveStatus } from '../ui/components/AutoSaveStatus';
import { CentralizedAutoSaveStatus } from '../ui/components/CentralizedAutoSaveStatus';
import { OverlayProperties } from '../ui/OverlayProperties';
import { DraggableOverlayToolbar } from '../ui/components/DraggableOverlayToolbar';
import { DraggableOverlayProperties } from '../ui/components/DraggableOverlayProperties';
import { ToolbarWithCursorCoordinates } from '../ui/components/ToolbarWithCursorCoordinates';

// Layout Components - Canvas V2
import { DXFViewerLayout } from '../integration/DXFViewerLayout';
import { getKindFromLabel } from '../config/color-mapping';
import { isFeatureEnabled } from '../config/experimental-features';

// ✅ PHASE 5: Layout Section Components
import { SidebarSection } from '../layout/SidebarSection';
import { MainContentSection } from '../layout/MainContentSection';
import { FloatingPanelsSection } from '../layout/FloatingPanelsSection';

// ✅ ENTERPRISE ARCHITECTURE: Transform Context (Single Source of Truth)
import { TransformProvider, useTransform } from '../contexts/TransformContext';
// 🏢 ENTERPRISE: Canvas Context (Centralized Zoom System)
import { CanvasProvider } from '../contexts/CanvasContext';

// 🧪 UNIFIED TEST RUNNER - Import modal (test functions moved to DebugToolbar)
import { TestResultsModal } from '../debug/TestResultsModal';
import { type UnifiedTestReport } from '../debug/unified-test-runner';

// 🛠️ DEBUG TOOLBAR - Consolidated debug/test controls (development only)
import { DebugToolbar } from '../debug/DebugToolbar';

// ✅ CENTRALIZED: Use existing LazyLoadWrapper system
import { LazyFullLayoutDebug } from '../ui/components/LazyLoadWrapper';

export function DxfViewerContent(props: DxfViewerAppProps) {
  const floatingRef = React.useRef<FloatingPanelHandle>(null);
  const state = useDxfViewerState();
  const notifications = useNotifications();
  const eventBus = useEventBus(); // 🔧 PHASE 3: Centralized event coordination

  // 🧪 UNIFIED TEST RUNNER - State για modal
  const [testModalOpen, setTestModalOpen] = React.useState(false);
  const [testReport, setTestReport] = React.useState<UnifiedTestReport | null>(null);
  const [formattedTestReport, setFormattedTestReport] = React.useState<string>('');

  // 🧪 TESTS MODAL - State για tests button
  const [testsModalOpen, setTestsModalOpen] = React.useState(false);

  // 🔧 HELPER: Replace alert() with notification + copy button
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
  const levelManager = useLevelManager();

  // Get grip context for manual control
  const { updateGripSettings } = useGripContext();

  // 🧪 WRAP handleAction to intercept run-tests action
  const wrappedHandleAction = React.useCallback((action: string, data?: any) => {
    console.log('🧪 wrappedHandleAction called:', { action, data });
    if (action === 'run-tests') {
      console.log('🧪 Tests button clicked - opening tests modal');
      setTestsModalOpen(true);
      return;
    }
    // Pass all other actions to original handleAction
    handleAction(action, data);
  }, [handleAction]);

  // 🧪 CREATE wrapped state with new handleAction
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
    canvasTransform
  });

  // 🎯 KEYBOARD SHORTCUTS
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      console.log('🎯 KEY EVENT:', { key: event.key, ctrlKey: event.ctrlKey, keyCode: event.keyCode });

      // 🎯 Multiple ways to detect Ctrl+F2
      const isCtrlF2 = (event.key === 'F2' && event.ctrlKey) ||
                       (event.keyCode === 113 && event.ctrlKey) ||
                       (event.code === 'F2' && event.ctrlKey);

      if (isCtrlF2) {
        event.preventDefault();
        event.stopPropagation();
        console.log('🎯 Ctrl+F2 SHORTCUT: LAYERING WORKFLOW TEST TRIGGERED');

        // Direct call to window function
        if (window.runLayeringWorkflowTest) {
          window.runLayeringWorkflowTest().then((result) => {
            console.log('📊 LAYERING WORKFLOW RESULT:', result);
            const successSteps = result.steps.filter((s) => s.status === 'success').length;
            const totalSteps = result.steps.length;
            const summary = `Workflow: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}\nSteps: ${successSteps}/${totalSteps}\nLayer Displayed: ${result.layerDisplayed ? '✅ YES' : '❌ NO'}`;
            showCopyableNotification(summary, result.success ? 'success' : 'error');
          });
        } else {
          // Fallback to import
          import('../debug/layering-workflow-test').then(module => {
            const runLayeringWorkflowTest = module.runLayeringWorkflowTest;
            runLayeringWorkflowTest().then((result) => {
              console.log('📊 LAYERING WORKFLOW RESULT:', result);
              const successSteps = result.steps.filter((s) => s.status === 'success').length;
              const totalSteps = result.steps.length;
              const summary = `Workflow: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}\nSteps: ${successSteps}/${totalSteps}\nLayer Displayed: ${result.layerDisplayed ? '✅ YES' : '❌ NO'}`;
              showCopyableNotification(summary, result.success ? 'success' : 'error');
            });
          });
        }
        return;
      }

      // 🎯 Alternative: F12 shortcut (less likely to conflict)
      if (event.key === 'F12') {
        event.preventDefault();
        console.log('🎯 F12 SHORTCUT: LAYERING WORKFLOW TEST TRIGGERED');
        if (window.runLayeringWorkflowTest) {
          window.runLayeringWorkflowTest().then((result) => {
            console.log('📊 LAYERING WORKFLOW RESULT:', result);
            const successSteps = result.steps.filter((s) => s.status === 'success').length;
            const totalSteps = result.steps.length;
            const summary = `Workflow: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}\nSteps: ${successSteps}/${totalSteps}\nLayer Displayed: ${result.layerDisplayed ? '✅ YES' : '❌ NO'}`;
            showCopyableNotification(summary, result.success ? 'success' : 'error');
          });
        }
        return;
      }

      // 🎯 F3 SHORTCUT: Cursor-Crosshair Alignment Test
      const isF3 = event.key === 'F3' || event.keyCode === 114 || event.code === 'F3';
      if (isF3) {
        event.preventDefault();
        event.stopPropagation();
        console.log('🎯 F3 SHORTCUT: CURSOR-CROSSHAIR ALIGNMENT TEST TRIGGERED');

        import('../debug/enterprise-cursor-crosshair-test').then(module => {
          const { runEnterpriseMouseCrosshairTests, startEnterpriseInteractiveTest } = module.default;

          console.log('🔍 Running enterprise cursor-crosshair alignment tests...');
          const results = runEnterpriseMouseCrosshairTests();

          const summary = `Enterprise Test: ${results.overallStatus}
Scenarios: ${results.passedScenarios}/${results.totalScenarios} passed
Avg Performance: ${results.avgPerformance.toFixed(1)}ms
Max Error: ${results.maxError.toFixed(3)}px
Min Pass Rate: ${(results.minPassRate * 100).toFixed(1)}%

Check console for detailed metrics`;

          console.log('🎮 Starting enterprise interactive test - Move mouse over canvas, press ESC to stop');
          startEnterpriseInteractiveTest();

          showCopyableNotification(summary, results.overallStatus === 'PASS' ? 'success' : 'warning');
        }).catch(error => {
          console.error('Failed to load enterprise cursor-crosshair test:', error);
          showCopyableNotification('Failed to load enterprise cursor-crosshair test module', 'error');
        });
        return;
      }

      // ESC to exit layering mode
      if (event.key === 'Escape' && activeTool === 'layering') {
        handleToolChange('select');
      }
    };

    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [activeTool, handleToolChange]);

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

  // 🚨 FIXED: Replaced periodic sync with event-based sync to prevent infinite loops
  React.useEffect(() => {
    if (activeTool !== 'layering') return;

    // 🔧 PHASE 3: Use EventBus instead of direct addEventListener
    const cleanup = eventBus.on('dxf-zoom-changed', ({ transform: newTransform }) => {
      try {
        if (!newTransform) return;

        // Only update if values changed significantly - STRONGER thresholds
        if (Math.abs(canvasTransform.scale - newTransform.scale) > 0.01 ||
            Math.abs(canvasTransform.offsetX - newTransform.offsetX) > 5 ||
            Math.abs(canvasTransform.offsetY - newTransform.offsetY) > 5) {
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
  }, [activeTool, eventBus, canvasTransform, setCanvasTransform]);

  // ✅ REF: Store the Context setTransform function
  const contextSetTransformRef = React.useRef<((t: ViewTransform) => void) | null>(null);

  // ✅ STABLE CALLBACK: Κάνω το onTransformReady stable με useCallback
  const handleTransformReady = React.useCallback((setTransform: (t: ViewTransform) => void) => {
    console.log('🔗 DxfViewerContent: Received setTransform from Context');
    contextSetTransformRef.current = setTransform;
  }, []);

  // Wrap handleTransformChange to also update canvasTransform state
  const wrappedHandleTransformChange = React.useCallback((transform: ViewTransform) => {
    const normalizedTransform = {
      scale: transform.scale || 1,
      offsetX: transform.offsetX || 0,
      offsetY: transform.offsetY || 0,
    };

    console.log('🔄 wrappedHandleTransformChange called:', normalizedTransform);

    // Update the canvas transform state for OverlayLayer
    setCanvasTransform(normalizedTransform);

    // ✅ UPDATE CONTEXT: Ενημέρωση του Transform Context (Single Source of Truth)
    if (contextSetTransformRef.current) {
      console.log('🎯 Updating Context via ref:', normalizedTransform);
      contextSetTransformRef.current(normalizedTransform);
    } else {
      console.warn('⚠️ Context setTransform not ready yet!');
    }
  }, [setCanvasTransform]);

  // 🏠 PAN TO WORLD ORIGIN (0,0) - Function for DebugToolbar
  const panToWorldOrigin = React.useCallback(() => {
    console.log('🏠 PAN TO ORIGIN (0,0) TRIGGERED');

    // Get canvas element to determine viewport size
    const canvasElement = document.querySelector('[data-canvas-type="dxf"]') as HTMLCanvasElement;
    if (!canvasElement) {
      console.error('❌ Canvas element not found');
      showCopyableNotification('Canvas not found', 'error');
      return;
    }

    // ✅ FIX: Use DISPLAY size (CSS pixels), not internal canvas resolution!
    const rect = canvasElement.getBoundingClientRect();
    const viewport = {
      width: rect.width,
      height: rect.height
    };

    const MARGIN_LEFT = 80;  // Left margin for vertical ruler
    const MARGIN_TOP = 30;   // Top margin for horizontal ruler

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
        <circle cx="100" cy="100" r="60" fill="none" stroke="#ff00ff" stroke-width="3" opacity="0.8">
          <animate attributeName="r" values="60;80;60" dur="2s" repeatCount="3" />
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="3" />
        </circle>

        <!-- Inner pulsing circle -->
        <circle cx="100" cy="100" r="30" fill="none" stroke="#00ffff" stroke-width="2" opacity="0.9">
          <animate attributeName="r" values="30;50;30" dur="2s" repeatCount="3" />
          <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="3" />
        </circle>

        <!-- Crosshair lines -->
        <line x1="100" y1="50" x2="100" y2="150" stroke="#ff0000" stroke-width="2" opacity="0.9" />
        <line x1="50" y1="100" x2="150" y2="100" stroke="#ff0000" stroke-width="2" opacity="0.9" />

        <!-- Center dot -->
        <circle cx="100" cy="100" r="5" fill="#ffff00" stroke="#ff0000" stroke-width="1">
          <animate attributeName="r" values="5;8;5" dur="1s" repeatCount="6" />
        </circle>

        <!-- Arrows pointing to center -->
        <path d="M 100 20 L 95 35 L 105 35 Z" fill="#00ff00" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="translate" values="0 0; 0 10; 0 0" dur="1.5s" repeatCount="indefinite" />
        </path>

        <path d="M 180 100 L 165 95 L 165 105 Z" fill="#00ff00" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" begin="0.375s" />
          <animateTransform attributeName="transform" type="translate" values="0 0; -10 0; 0 0" dur="1.5s" repeatCount="indefinite" begin="0.375s" />
        </path>

        <path d="M 100 180 L 95 165 L 105 165 Z" fill="#00ff00" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" begin="0.75s" />
          <animateTransform attributeName="transform" type="translate" values="0 0; 0 -10; 0 0" dur="1.5s" repeatCount="indefinite" begin="0.75s" />
        </path>

        <path d="M 20 100 L 35 95 L 35 105 Z" fill="#00ff00" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" begin="1.125s" />
          <animateTransform attributeName="transform" type="translate" values="0 0; 10 0; 0 0" dur="1.5s" repeatCount="indefinite" begin="1.125s" />
        </path>

        <!-- Label -->
        <text x="100" y="210" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="bold"
              stroke="#000000" stroke-width="3" paint-order="stroke">
          WORLD (0,0)
        </text>
        <text x="100" y="210" text-anchor="middle" fill="#00ffff" font-size="14" font-weight="bold">
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
        setTimeout(() => elem.remove(), 500);
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
    console.log('📋 DxfViewerContent.handleFileImportWithEncoding called:', {
      fileName: file.name,
      encoding,
      currentLevelId: levelManager.currentLevelId
    });

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
    // Enable selection in all overlay modes for bidirectional sync
    overlayStore.setSelectedOverlay(regionId);

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
  React.useEffect(() => {
    const selectedOverlay = overlayStore.getSelectedOverlay();
    if (selectedOverlay && activeTool !== 'layering') {
      // Αυτόματη ενεργοποίηση layering tool όταν επιλέγεται overlay
      handleToolChange('layering');
    }
  }, [overlayStore.selectedOverlayId, activeTool, handleToolChange]);


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
    const cleanup = eventBus.on('level-panel:layering-activate', ({ levelId }) => {
      console.log('🎯 Level panel activated layering for level:', levelId);

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

  // helper: μετατόπιση όλων των επιλεγμένων κατά (dx, dy) σε world units
  const nudgeSelection = React.useCallback((dx: number, dy: number) => {
    if (!currentScene || !selectedEntityIds?.length) return;
    const idSet = new Set(selectedEntityIds);

    const moved = currentScene.entities.map(e => {
      if (!idSet.has(e.id)) return e;

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
  }, [currentScene, selectedEntityIds, handleSceneChange]);

  // Keyboard shortcuts hook
  const { handleCanvasMouseMove } = useKeyboardShortcuts({
    selectedEntityIds,
    currentScene,
    onNudgeSelection: nudgeSelection,
    onColorMenuClose: closeColorMenu,
    activeTool,
    overlayMode,
    overlayStore
  });

  return (
    <CanvasProvider>
      <TransformProvider
        initialTransform={canvasTransform}
        onTransformReady={handleTransformReady}
      >
      <div
        className="flex h-full p-2 gap-2 bg-gray-800"
        style={{
          // 🔥 ΔΙΟΡΘΩΣΗ: Disable pointer events όταν layering tool είναι ενεργό
          pointerEvents: activeTool === 'layering' ? 'none' : 'auto'
        }}
      >
      {/* ✅ PHASE 5: Sidebar Section */}
      <SidebarSection
        floatingRef={floatingRef}
        currentScene={currentScene}
        selectedEntityIds={selectedEntityIds}
        setSelectedEntityIds={setSelectedEntityIds}
        currentZoom={currentZoom}
        activeTool={activeTool}
      />

      {/* ✅ PHASE 5: Main Content Section */}
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
      />

      {/* ✅ PHASE 5: Floating Panels Section */}
      <FloatingPanelsSection
        colorMenu={colorMenu}
        currentScene={currentScene}
        handleSceneChange={handleSceneChange}
        closeColorMenu={closeColorMenu}
        floatingRef={floatingRef}
        showCursorSettings={showCursorSettings}
        showCalibration={showCalibration}
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

      {/* 🧪 TESTS MODAL - Tests button modal */}
      <TestsModal
        isOpen={testsModalOpen}
        onClose={() => setTestsModalOpen(false)}
        showCopyableNotification={showCopyableNotification}
      />
      </div>
      </TransformProvider>
    </CanvasProvider>
  );
}