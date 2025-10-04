'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_DXF_VIEWER_CONTENT = false;

import { useNotifications } from '../../../providers/NotificationProvider';

// 🧹 CLEAN CONSOLE: Αφαίρεση React development noise
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Disable React DevTools για μείωση noise
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    isDisabled: true,
    supportsFiber: true,
    inject: () => {},
    onCommitFiberRoot: () => {},
    onCommitFiberUnmount: () => {},
  } as any;
}

import React from 'react';

// Types - Updated for Canvas V2
import type { DxfViewerAppProps } from '../types';
import type { SceneModel, LineEntity, CircleEntity, ArcEntity, PolylineEntity } from '../types/scene';
import type { OverlayEditorMode, OverlayKind, Status } from '../overlays/types';
import type { ViewTransform, Point2D } from '../rendering/types/Types';
import type { ToolType } from '../ui/toolbar/types';

// Hooks
import { useDxfViewerState } from '../hooks/useDxfViewerState';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useOverlayDrawing } from '../hooks/useOverlayDrawing';
import { useCursor } from '../systems/cursor';
import { useSnapContext } from '../snapping/context/SnapContext';
import { useCanvasOperations } from '../hooks/interfaces/useCanvasOperations';

// Stores and Managers
import { useOverlayStore } from '../overlays/overlay-store';
import { useLevelManager } from '../systems/levels/useLevels';
import { useGripContext } from '../providers/GripProvider';
import { globalRulerStore } from '../providers/DxfSettingsProvider';

// UI Components
import { FloatingPanelContainer, type FloatingPanelHandle } from '../ui/FloatingPanelContainer';
import { EnhancedDXFToolbar } from '../ui/toolbar';
import { OverlayToolbar } from '../ui/OverlayToolbar'; // Η σωστή εργαλειοθήκη με τα status buttons
import { ColorManager } from '../ui/components/ColorManager';
import { ProSnapToolbar } from '../ui/components/ProSnapToolbar';
import CursorSettingsPanel from '../ui/CursorSettingsPanel';
import CoordinateCalibrationOverlay from '../ui/CoordinateCalibrationOverlay';
import { AutoSaveStatus } from '../ui/components/AutoSaveStatus';
import { CentralizedAutoSaveStatus } from '../ui/components/CentralizedAutoSaveStatus';
import { OverlayProperties } from '../ui/OverlayProperties';

// Layout Components - Canvas V2
import { DXFViewerLayout } from '../integration/DXFViewerLayout';
import { getKindFromLabel } from '../config/color-mapping';
import { isFeatureEnabled } from '../config/experimental-features';

// ✅ ENTERPRISE ARCHITECTURE: Transform Context (Single Source of Truth)
import { TransformProvider, useTransform } from '../contexts/TransformContext';

// Draggable Overlay Toolbar Component - Inline Definition
interface DraggableOverlayToolbarProps {
  mode: OverlayEditorMode;
  onModeChange: (mode: OverlayEditorMode) => void;
  currentStatus: Status;
  onStatusChange: (status: Status) => void;
  currentKind: OverlayKind;
  onKindChange: (kind: OverlayKind) => void;
  snapEnabled: boolean;
  onSnapToggle: () => void;
  selectedOverlayId: string | null;
  onDuplicate: () => void;
  onDelete: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onToolChange: (tool: ToolType) => void;
}

const DraggableOverlayToolbar: React.FC<DraggableOverlayToolbarProps> = (props) => {
  // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ PRECISION POSITIONING για toolbar
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const { position: initialPosition, hasInitialized } = usePrecisionPositioning(toolbarRef, {
    targetPoint: { x: 2550, y: 237 }, // 🎯 ΝΕΕΣ ΣΥΝΤΕΤΑΓΜΕΝΕΣ: X=2550, Y=237 για πάνω δεξιά γωνία
    alignment: 'top-right' // Top-right γιατί θέλουμε το toolbar στο πάνω μέρος με δεξιά ευθυγράμμιση
  });

  // State για dragging (μετά την αρχική τοποθέτηση, επιτρέπουμε dragging)
  const [position, setPosition] = React.useState(initialPosition);
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  // 🎯 ΜΟΝΟ ΑΡΧΙΚΗ ΘΕΣΗ: Ενημέρωση position μόνο για την πρώτη initialization
  // ΔΕΝ επαναφέρουμε τη θέση μετά το drag - αφήνουμε τον χρήστη να επιλέξει
  const [hasSetInitialPosition, setHasSetInitialPosition] = React.useState(false);

  React.useEffect(() => {
    if (hasInitialized && !hasSetInitialPosition) {
      setPosition(initialPosition);
      setHasSetInitialPosition(true);
    }
  }, [hasInitialized, hasSetInitialPosition, initialPosition]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start drag if clicking on the toolbar background, not buttons
    if ((e.target as HTMLElement).closest('button, input, select')) {
      return;
    }

    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      // Keep within viewport bounds
      const maxX = window.innerWidth - 300; // Approximate toolbar width
      const maxY = window.innerHeight - 100; // Approximate toolbar height

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  return (
    <div
      ref={toolbarRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000,
        pointerEvents: 'auto',
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      className="bg-gray-900 rounded-lg shadow-xl border border-gray-500 select-none"
      onMouseDown={handleMouseDown}
    >
      {/* Drag Handle - Visible area για dragging */}
      <div
        className="bg-gray-700 rounded-t-lg px-3 py-1 border-b border-gray-600 flex items-center justify-between cursor-grab active:cursor-grabbing"
        style={{ minHeight: '24px' }}
      >
        <span className="text-xs text-gray-400 font-medium">🔧 Overlay Tools</span>
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
          <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
          <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
        </div>
      </div>

      {/* Actual Toolbar Content */}
      <OverlayToolbar {...props} />
    </div>
  );
};

// Draggable Overlay Properties Component - Inline Definition
interface DraggableOverlayPropertiesProps {
  overlay: any;
  onUpdate: (overlayId: string, updates: any) => void;
  onClose: () => void;
}

import { usePrecisionPositioning } from '../utils/precision-positioning';

const DraggableOverlayProperties: React.FC<DraggableOverlayPropertiesProps> = ({
  overlay,
  onUpdate,
  onClose
}) => {
  // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ PRECISION POSITIONING
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { position } = usePrecisionPositioning(containerRef, {
    targetPoint: { x: 2550, y: 1230 },
    alignment: 'bottom-right',
    dependencies: [overlay]
  });

  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start drag if clicking on the header, not buttons or inputs
    if ((e.target as HTMLElement).closest('button, input, select')) {
      return;
    }
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      // Keep within viewport bounds
      const maxX = window.innerWidth - 320; // Panel width
      const maxY = window.innerHeight - 400; // Panel height estimate

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000,
        pointerEvents: 'auto',
        cursor: isDragging ? 'grabbing' : 'grab',
        width: '320px'
      }}
      className="bg-gray-900 rounded-lg shadow-xl border border-gray-500 select-none"
    >
      {/* Drag Handle Header */}
      <div
        className="bg-gray-700 rounded-t-lg px-3 py-2 border-b border-gray-600 flex items-center justify-between cursor-grab active:cursor-grabbing"
        style={{ minHeight: '32px' }}
        onMouseDown={handleMouseDown}
      >
        <span className="text-sm text-gray-300 font-medium">🏠 Ιδιότητες Overlay</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-lg leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-gray-600 transition-colors"
          style={{ pointerEvents: 'auto' }}
        >
          ✕
        </button>
      </div>

      {/* Properties Panel Content */}
      <div className="p-0">
        <OverlayProperties
          overlay={overlay}
          onUpdate={onUpdate}
          onClose={onClose}
        />
      </div>
    </div>
  );
};

// 🎯 Professional Layout Debug System - conditionally imported
const FullLayoutDebug = React.lazy(() =>
  import('../debug/layout-debug').then(module => ({ default: module.FullLayoutDebug }))
);

// Component that uses cursor context and renders toolbar with coordinates
interface ToolbarWithCursorCoordinatesProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onAction: (action: string, data?: number | string | Record<string, unknown>) => void;
  showGrid: boolean;
  autoCrop: boolean;
  canUndo: boolean;
  canRedo: boolean;
  snapEnabled: boolean;
  showLayers: boolean;
  showCalibration?: boolean;
  showCursorSettings?: boolean;
  currentZoom: number;
  commandCount?: number;
  className?: string;
  onSceneImported?: (file: File, encoding?: string) => void;
}

export function ToolbarWithCursorCoordinates(props: ToolbarWithCursorCoordinatesProps) {
  const { worldPosition, settings } = useCursor();
  
  return (
    <EnhancedDXFToolbar
      {...props}
      mouseCoordinates={worldPosition}
      showCoordinates={settings.behavior.coordinate_display}
    />
  );
}

export function DxfViewerContent(props: DxfViewerAppProps) {
  const floatingRef = React.useRef<FloatingPanelHandle>(null);
  const state = useDxfViewerState();
  const notifications = useNotifications();

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

  // Add state for overlay toolbar
  const [overlayMode, setOverlayMode] = React.useState<OverlayEditorMode>('select');

  // 🔍 DEBUG - Track overlayMode changes
  React.useEffect(() => {
    // console.log('🔍 OverlayMode changed:', overlayMode);
  }, [overlayMode]);

  const [overlayStatus, setOverlayStatus] = React.useState<Status>('for-sale');
  const [overlayKind, setOverlayKind] = React.useState<OverlayKind>('unit');

  // Add canvas transform state for overlay layer
  const [canvasTransform, setCanvasTransform] = React.useState({ scale: 1, offsetX: 0, offsetY: 0 });
  
  // Use shared constants from overlays/types
  
  // State για color menu popover
  const [colorMenu, setColorMenu] = React.useState<{open:boolean; x:number; y:number; ids:string[]}>({
    open: false, x: 0, y: 0, ids: []
  });

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
    levelManager,
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
        if ((window as any).runLayeringWorkflowTest) {
          (window as any).runLayeringWorkflowTest().then((result: any) => {
            console.log('📊 LAYERING WORKFLOW RESULT:', result);
            const successSteps = result.steps.filter((s: any) => s.status === 'success').length;
            const totalSteps = result.steps.length;
            const summary = `Workflow: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}\nSteps: ${successSteps}/${totalSteps}\nLayer Displayed: ${result.layerDisplayed ? '✅ YES' : '❌ NO'}`;
            showCopyableNotification(summary, result.success ? 'success' : 'error');
          });
        } else {
          // Fallback to import
          import('../debug/layering-workflow-test').then(module => {
            const runLayeringWorkflowTest = module.runLayeringWorkflowTest;
            runLayeringWorkflowTest().then((result: any) => {
              console.log('📊 LAYERING WORKFLOW RESULT:', result);
              const successSteps = result.steps.filter((s: any) => s.status === 'success').length;
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
        if ((window as any).runLayeringWorkflowTest) {
          (window as any).runLayeringWorkflowTest().then((result: any) => {
            console.log('📊 LAYERING WORKFLOW RESULT:', result);
            const successSteps = result.steps.filter((s: any) => s.status === 'success').length;
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
      console.warn('Failed to get initial transform:', error);
    }
  }, [currentScene]); // ✅ FIXED: Removed canvasOps from dependency array

  // 🚨 FIXED: Replaced periodic sync with event-based sync to prevent infinite loops
  React.useEffect(() => {
    if (activeTool !== 'layering') return;

    const handleTransformChange = (event: CustomEvent) => {
      try {
        const { transform } = event.detail;
        if (!transform) return;

        setCanvasTransform(prev => {
          // Only update if values changed significantly - STRONGER thresholds
          if (Math.abs(prev.scale - transform.scale) > 0.01 ||
              Math.abs(prev.offsetX - transform.offsetX) > 5 ||
              Math.abs(prev.offsetY - transform.offsetY) > 5) {
            return {
              scale: transform.scale || 1,
              offsetX: transform.offsetX || 0,
              offsetY: transform.offsetY || 0,
            };
          }
          return prev;
        });
      } catch (error) {
        console.warn('Failed to sync transform from event:', error);
      }
    };

    // 🔺 EVENT-BASED: Listen for zoom events instead of polling every 100ms
    document.addEventListener('dxf-zoom-changed', handleTransformChange as EventListener);
    return () => {
      document.removeEventListener('dxf-zoom-changed', handleTransformChange as EventListener);
    };
  }, [activeTool]);

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
  React.useEffect(() => {
    // Νέο: κρατάμε τα grips ενεργά ΚΑΙ στο overlayMode: 'draw' (layering)
    const shouldEnableGrips = 
      activeTool === 'select' || 
      activeTool === 'grip-edit' ||
      (activeTool === 'layering' && (overlayMode === 'edit' || overlayMode === 'draw'));

    updateGripSettings({
      showGrips: shouldEnableGrips,
      multiGripEdit: true,
      snapToGrips: true,
    });
  }, [activeTool, overlayMode, updateGripSettings]);

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
    const handleToolChangeRequest = (event: CustomEvent) => {
      const requestedTool = event.detail;
      handleToolChange(requestedTool);
    };

    window.addEventListener('level-panel:tool-change', handleToolChangeRequest as EventListener);
    return () => window.removeEventListener('level-panel:tool-change', handleToolChangeRequest as EventListener);
  }, [handleToolChange]);

  // ✅ ΧΡΗΣΗ ΥΠΑΡΧΟΝΤΟΣ EVENT SYSTEM: Listen for layering activation from LevelPanel
  React.useEffect(() => {
    const handleLayeringActivation = (event: CustomEvent) => {
      const { levelId } = event.detail;
      console.log('🎯 Level panel activated layering for level:', levelId);

      // ✅ ΔΙΟΡΘΩΣΗ: Ensure layers are always shown (not toggled)
      if (!showLayers) {
        handleAction('toggle-layers');
      }
      // If layers are already shown, keep them shown (no action needed)
    };
    window.addEventListener('level-panel:layering-activate', handleLayeringActivation as EventListener);
    return () => window.removeEventListener('level-panel:layering-activate', handleLayeringActivation as EventListener);
  }, [handleAction, showLayers]);

  // 🔺 Listen for polygon updates from grip editing
  React.useEffect(() => {
    const handlePolygonUpdate = (event: CustomEvent) => {
      const { regionId, newVertices } = event.detail;

      if (newVertices && regionId) {
        // Convert Point2D array to flat array for overlay store
        const flatVertices = newVertices.flatMap((v: Point2D) => [v.x, v.y]);
        overlayStore.update(regionId, { polygon: flatVertices });

      }
    };

    window.addEventListener('overlay:polygon-update', handlePolygonUpdate as EventListener);
    return () => window.removeEventListener('overlay:polygon-update', handlePolygonUpdate as EventListener);
  }, [overlayStore]);

  // Fix 2: Ασφάλεια στο parent - sync από το bus (μόνο για 'select')
  React.useEffect(() => {
    const onSelectFromBus = (ev: Event) => {
      const d = (ev as CustomEvent<{ mode: string; ids: string[] }>).detail;
      if (!d || d.mode !== 'select') return;
      const ids: string[] = Array.isArray(d.ids) ? d.ids : [];
      setSelectedEntityIds(prev => {
        if (prev.length === ids.length && prev.every((v, i) => v === ids[i])) return prev; // no-op
        return ids;
      });
    };
    window.addEventListener('dxf.highlightByIds', onSelectFromBus as EventListener);
    return () => window.removeEventListener('dxf.highlightByIds', onSelectFromBus as EventListener);
  }, []);

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
      if (e.type === 'polyline' && Array.isArray((e as PolylineEntity).points)) {
        const polyline = e as PolylineEntity;
        const pts = polyline.points?.map((p: Point2D) => ({ x: p.x + dx, y: p.y + dy })) || [];
        return { ...e, points: pts };
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
    onColorMenuClose: () => setColorMenu(s => ({...s, open:false})),
    activeTool,
    overlayMode,
    overlayStore
  });

  return (
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
      {/* Container 1: FloatingPanelContainer (Left) */}
      <div style={{
        width: '384px',
        minWidth: '384px',
        maxWidth: '384px',
        height: '100%',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        // 🔥 ΔΙΟΡΘΩΣΗ: Re-enable pointer events για sidebar ακόμη και σε layering mode
        pointerEvents: 'auto'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '384px',
          height: '100%',
          overflow: 'hidden',
          backgroundColor: '#111827',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #6B7280'
        }}>
          {/* FLOATING PANEL ΣΤΟΝ ΥΠΟΛΟΙΠΟ ΧΩΡΟ */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: '120px', /* Αφήνουμε χώρο για το status bar */
            overflow: 'hidden'
          }}>
            <FloatingPanelContainer
              ref={floatingRef}
              sceneModel={currentScene}
              selectedEntityIds={selectedEntityIds}
              onEntitySelect={setSelectedEntityIds}
              zoomLevel={currentZoom}
              currentTool={activeTool}
            />
          </div>

          {/* STATUS BAR ΣΤΗ ΒΑΣΗ ΤΟΥ CONTAINER */}
          <div
            className="border-t border-gray-500 px-4 py-3 bg-gray-800 space-y-2"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              borderBottomLeftRadius: '8px',
              borderBottomRightRadius: '8px'
            }}
          >
            {/* Scene Auto-Save Status */}
            <AutoSaveStatus />

            {/* DXF Settings Auto-Save Status - ΚΕΝΤΡΙΚΟΣ PROVIDER */}
            <CentralizedAutoSaveStatus />

            <div className="flex justify-between items-center text-xs text-gray-400">
              <span>Αριστερό Container Status</span>
              <span>Zoom: {currentZoom}%</span>
            </div>

            {/* Storage Status */}
            {/* <StorageStatus showDetails={true} className="bg-gray-800 border-gray-600" /> */}
            <div className="text-xs text-gray-500">Storage Status (προσωρινά απενεργοποιημένο)</div>
          </div>
        </div>
      </div>

      {/* Main content area (Right) */}
      <div
        className="flex-1 flex flex-col gap-2 h-full"
        style={{
          // 🔥 ΔΙΟΡΘΩΣΗ: Re-enable pointer events για main content area
          pointerEvents: 'auto'
        }}
      >
        {/* 🎯 DEBUG CANVAS TEST BUTTONS - Στην επικεφαλίδα της εφαρμογής */}
        <div className="flex gap-2 p-2 bg-gray-800 border-b border-gray-700">
          <button
            onClick={() => {
              console.log('🎯 MANUAL CANVAS ALIGNMENT TEST TRIGGERED FROM HEADER');
              // Import το CanvasAlignmentTester
              import('../debug/canvas-alignment-test').then(module => {
                const CanvasAlignmentTester = module.CanvasAlignmentTester;
                const alignmentResult = CanvasAlignmentTester.testCanvasAlignment();
                const zIndexResult = CanvasAlignmentTester.testCanvasZIndex();
                const greenBorder = CanvasAlignmentTester.findGreenBorder();

                console.log('🔍 DETAILED Z-INDEX DEBUG:', {
                  alignmentResult,
                  zIndexResult,
                  greenBorder: !!greenBorder
                });

                // Direct DOM inspection
                const dxfEl = document.querySelector('canvas[data-canvas-type="dxf"]');
                const layerEl = document.querySelector('canvas[data-canvas-type="layer"]');
                console.log('🔍 DIRECT DOM INSPECTION:', {
                  dxfCanvas: dxfEl ? {
                    inlineStyle: (dxfEl as HTMLElement).style.cssText,
                    computedZIndex: window.getComputedStyle(dxfEl).zIndex,
                    computedPosition: window.getComputedStyle(dxfEl).position
                  } : 'NOT FOUND',
                  layerCanvas: layerEl ? {
                    inlineStyle: (layerEl as HTMLElement).style.cssText,
                    computedZIndex: window.getComputedStyle(layerEl).zIndex,
                    computedPosition: window.getComputedStyle(layerEl).position
                  } : 'NOT FOUND'
                });

                const testMessage = `Canvas Alignment: ${alignmentResult.isAligned ? '✅ OK' : '❌ MISALIGNED'}\nZ-Index Order: ${zIndexResult.isCorrectOrder ? '✅ OK' : '❌ WRONG'}\nGreen Border Found: ${greenBorder ? '✅ YES' : '❌ NO'}`;
                const allTestsPass = alignmentResult.isAligned && zIndexResult.isCorrectOrder && greenBorder;
                showCopyableNotification(testMessage, allTestsPass ? 'success' : 'warning');
              }).catch(err => {
                console.error('Failed to load CanvasAlignmentTester:', err);
                showCopyableNotification('Failed to load test module', 'error');
              });
            }}
            className="px-3 py-1 text-xs font-bold rounded shadow-lg bg-yellow-500 text-black hover:bg-yellow-400 transition-all"
          >
            🎯 Test Canvas
          </button>

          {/* 🔥 NEW: Layering Workflow Test Button */}
          <button
            onClick={() => {
              console.log('🎯 LAYERING WORKFLOW TEST TRIGGERED FROM HEADER');
              import('../debug/layering-workflow-test').then(module => {
                const runLayeringWorkflowTest = module.runLayeringWorkflowTest;
                runLayeringWorkflowTest().then(result => {
                  console.log('📊 LAYERING WORKFLOW RESULT:', result);
                  const successSteps = result.steps.filter(s => s.status === 'success').length;
                  const totalSteps = result.steps.length;
                  const summary = `Workflow: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}\nSteps: ${successSteps}/${totalSteps}\nLayer Displayed: ${result.layerDisplayed ? '✅ YES' : '❌ NO'}`;

                  if (result.layerData) {
                    console.log('🎨 Layer Display Data:', result.layerData);
                  }

                  showCopyableNotification(summary, result.success ? 'success' : 'error');
                }).catch(err => {
                  console.error('Failed to run layering workflow test:', err);
                  showCopyableNotification('Failed to run workflow test', 'error');
                });
              }).catch(err => {
                console.error('Failed to load layering workflow test:', err);
                showCopyableNotification('Failed to load workflow test module', 'error');
              });
            }}
            className="px-3 py-1 text-xs font-bold rounded shadow-lg bg-green-500 text-white hover:bg-green-400 transition-all"
          >
            🔄 Test Layering (Ctrl+F2)
          </button>

          {/* 🔍 NEW: DOM Inspector Debug Button */}
          <button
            onClick={() => {
              console.log('🔍 DOM INSPECTOR TRIGGERED FROM HEADER');
              import('../debug/dom-inspector').then(module => {
                const { inspectDOMElements, findFloatingPanelAdvanced, showDetailedDOMInfo } = module;

                console.log('📋 Running complete DOM inspection...');
                const inspection = inspectDOMElements();

                console.log('🔍 Trying advanced floating panel detection...');
                const panel = findFloatingPanelAdvanced();

                console.log('📊 Showing detailed DOM info...');
                showDetailedDOMInfo();

                const summary = `DOM Inspection Complete!\n\n` +
                  `Floating Panels Found: ${inspection.floatingPanels.filter(p => p.found).length}\n` +
                  `Tabs Found: ${inspection.tabs.length}\n` +
                  `Cards Found: ${inspection.cards.length}\n` +
                  `Canvases Found: ${inspection.canvases.length}\n` +
                  `Advanced Panel Detection: ${panel ? '✅ SUCCESS' : '❌ FAILED'}\n\n` +
                  `Check console for detailed results.`;

                showCopyableNotification(summary, 'info');
              }).catch(err => {
                console.error('Failed to load DOM inspector:', err);
                showCopyableNotification('Failed to load DOM inspector', 'error');
              });
            }}
            className="px-3 py-1 text-xs font-bold rounded shadow-lg bg-blue-500 text-white hover:bg-blue-400 transition-all"
          >
            🔍 Inspect DOM
          </button>

          {/* 🎯 Canvas Control Buttons */}
          <button
            onClick={() => {
              setDxfCanvasVisible(!dxfCanvasVisible);
              console.log('🎯 DxfCanvas visibility toggled:', !dxfCanvasVisible);
            }}
            className={`px-3 py-1 text-xs font-bold rounded shadow-lg transition-all ${
              dxfCanvasVisible
                ? 'bg-green-500 text-white hover:bg-green-400'
                : 'bg-red-500 text-white hover:bg-red-400'
            }`}
          >
            {dxfCanvasVisible ? '🟢 DXF ON' : '🔴 DXF OFF'}
          </button>

          <button
            onClick={() => {
              setLayerCanvasVisible(!layerCanvasVisible);
              console.log('🎯 LayerCanvas visibility toggled:', !layerCanvasVisible);
            }}
            className={`px-3 py-1 text-xs font-bold rounded shadow-lg transition-all ${
              layerCanvasVisible
                ? 'bg-blue-500 text-white hover:bg-blue-400'
                : 'bg-red-500 text-white hover:bg-red-400'
            }`}
          >
            {layerCanvasVisible ? '🔵 LAYER ON' : '🔴 LAYER OFF'}
          </button>

          {/* 🏢 NEW: Enterprise Cursor-Crosshair Alignment Test */}
          <button
            onClick={() => {
              console.log('🏢 ENTERPRISE CURSOR-CROSSHAIR ALIGNMENT TEST TRIGGERED');
              import('../debug/enterprise-cursor-crosshair-test').then(module => {
                const { runEnterpriseMouseCrosshairTests, startEnterpriseInteractiveTest } = module.default;

                console.log('🔍 Running enterprise cursor-crosshair alignment tests...');
                const results = runEnterpriseMouseCrosshairTests();

                // Summary για alert
                const summary = `Enterprise Test: ${results.overallStatus}
Scenarios: ${results.passedScenarios}/${results.totalScenarios} passed
Avg Performance: ${results.avgPerformance.toFixed(1)}ms
Max Error: ${results.maxError.toFixed(3)}px
Min Pass Rate: ${(results.minPassRate * 100).toFixed(1)}%

Check console for detailed metrics`;

                // Προαιρετικά: Ξεκινάμε και interactive test
                console.log('🎮 Starting enterprise interactive test - Move mouse over canvas, press ESC to stop');
                startEnterpriseInteractiveTest();

                showCopyableNotification(summary, results.overallStatus === 'PASS' ? 'success' : 'warning');
              }).catch(error => {
                console.error('Failed to load enterprise cursor-crosshair test:', error);
                showCopyableNotification('Failed to load enterprise cursor-crosshair test module', 'error');
              });
            }}
            className="px-3 py-1 text-xs font-bold rounded shadow-lg bg-purple-500 text-white hover:bg-purple-400 transition-all"
          >
            🏢 Enterprise Test (F3)
          </button>

          {/* 🛠️ NEW: Origin Markers Debug Toggle */}
          <button
            onClick={() => {
              console.log('🛠️ ORIGIN MARKERS DEBUG TOGGLE TRIGGERED');
              import('../debug/OriginMarkersDebugOverlay').then(module => {
                const { originMarkersDebug } = module;

                // Toggle the debug overlay (persistence handled internally)
                const enabled = originMarkersDebug.toggle();

                // 🎯 TRIGGER RE-RENDER: Force canvas re-render to show/hide markers immediately
                if (typeof window !== 'undefined') {
                  // Small delay to ensure state is updated
                  setTimeout(() => {
                    // Dispatch custom event to trigger canvas re-render
                    window.dispatchEvent(new CustomEvent('origin-markers-toggle', {
                      detail: { enabled }
                    }));
                  }, 50);
                }

                const status = originMarkersDebug.getStatus();
                const originMessage = `Origin Markers: ${enabled ? 'ENABLED ✅' : 'DISABLED ❌'}\n\nMarkers ${enabled ? 'are now visible!' : 'are now hidden!'}`;
                showCopyableNotification(originMessage, enabled ? 'success' : 'info');
              }).catch(error => {
                console.error('Failed to load origin markers debug:', error);
                showCopyableNotification('Failed to load origin markers debug module', 'error');
              });
            }}
            className="px-3 py-1 text-xs font-bold rounded shadow-lg bg-orange-500 text-white hover:bg-orange-400 transition-all"
          >
            🎯 Origin (0,0)
          </button>

          {/* 🏠 PAN TO WORLD ORIGIN (0,0) */}
          <button
            onClick={() => {
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
              // (wrappedHandleTransformChange also updates window.dxfTransform)
              wrappedHandleTransformChange(newTransform);

              // 🎯 SHOW VISUAL INDICATOR: Pulsing crosshair at center
              // Calculate canvas-relative position of world (0,0)
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
                  <!-- Top arrow -->
                  <path d="M 100 20 L 95 35 L 105 35 Z" fill="#00ff00" opacity="0.8">
                    <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" />
                    <animateTransform attributeName="transform" type="translate" values="0 0; 0 10; 0 0" dur="1.5s" repeatCount="indefinite" />
                  </path>

                  <!-- Right arrow -->
                  <path d="M 180 100 L 165 95 L 165 105 Z" fill="#00ff00" opacity="0.8">
                    <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" begin="0.375s" />
                    <animateTransform attributeName="transform" type="translate" values="0 0; -10 0; 0 0" dur="1.5s" repeatCount="indefinite" begin="0.375s" />
                  </path>

                  <!-- Bottom arrow -->
                  <path d="M 100 180 L 95 165 L 105 165 Z" fill="#00ff00" opacity="0.8">
                    <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" begin="0.75s" />
                    <animateTransform attributeName="transform" type="translate" values="0 0; 0 -10; 0 0" dur="1.5s" repeatCount="indefinite" begin="0.75s" />
                  </path>

                  <!-- Left arrow -->
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
            }}
            className="px-3 py-1 text-xs font-bold rounded shadow-lg bg-purple-500 text-white hover:bg-purple-400 transition-all"
          >
            🏠 Pan to (0,0)
          </button>

          {/* 🛠️ RULER DEBUG & CALIBRATION SYSTEM */}
          <button
            onClick={() => {
              console.log('🛠️ RULER DEBUG TOGGLE TRIGGERED');
              import('../debug/RulerDebugOverlay').then(module => {
                const { rulerDebugOverlay } = module;

                const enabled = rulerDebugOverlay.toggle();

                // 🎯 TRIGGER RE-RENDER: Force canvas re-render immediately
                if (typeof window !== 'undefined') {
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('ruler-debug-toggle', {
                      detail: { enabled }
                    }));
                  }, 50);
                }

                // Show enterprise-style diagnostic message
                const diagnostics = rulerDebugOverlay.getDiagnostics();
                const shortMessage = `Ruler Debug: ${enabled ? 'ENABLED ✅' : 'DISABLED ❌'}\n\n${enabled ? '🎯 Tick Markers: RED (major) / GREEN (minor)\n📐 Calibration Grid: CYAN 100mm grid\n🔍 Auto-verification: ACTIVE' : 'All debug overlays hidden'}`;

                showCopyableNotification(shortMessage, enabled ? 'success' : 'info');

                // Log full diagnostics to console
                console.log(diagnostics);
              });
            }}
            className="px-3 py-1 text-xs font-bold rounded shadow-lg bg-blue-500 text-white hover:bg-blue-400 transition-all"
          >
            📏 Rulers
          </button>

          {/* 📐 NEW: Grid Enterprise Test Button */}
          <button
            onClick={() => {
              console.log('🎯 GRID ENTERPRISE TEST TRIGGERED FROM HEADER');
              import('../debug/grid-enterprise-test').then(module => {
                const { runGridEnterpriseTests } = module;

                runGridEnterpriseTests().then(report => {
                  console.log('📊 GRID ENTERPRISE TEST REPORT:', report);

                  const summary = `Grid Enterprise Tests Complete!\n\n` +
                    `✅ Passed: ${report.passed}/${report.totalTests}\n` +
                    `❌ Failed: ${report.failed}\n` +
                    `⚠️ Warnings: ${report.warnings}\n\n` +
                    `🏗️ Topological Integrity: ${report.topologicalIntegrity.percentage.toFixed(0)}%\n` +
                    `📏 Coordinate Precision: ${report.coordinatePrecision.withinTolerance ? '✅ OK' : '⚠️ WARNING'}\n` +
                    `🎨 Grid Pixels Detected: ${report.canvasState.gridPixelsDetected}\n\n` +
                    `Check console for detailed report.`;

                  showCopyableNotification(
                    summary,
                    report.success ? 'success' : (report.failed > 0 ? 'error' : 'info')
                  );
                }).catch(err => {
                  console.error('Failed to run grid enterprise tests:', err);
                  showCopyableNotification('Failed to run grid tests', 'error');
                });
              }).catch(err => {
                console.error('Failed to load grid enterprise test:', err);
                showCopyableNotification('Failed to load grid test module', 'error');
              });
            }}
            className={`px-3 py-1 text-xs font-bold rounded shadow-lg transition-all ${
              showGrid
                ? 'bg-green-500 text-white hover:bg-green-400'
                : 'bg-gray-500 text-white hover:bg-gray-400'
            }`}
          >
            {showGrid ? '📐 Grid TEST' : '📐 Grid TEST'}
          </button>

          <div className="text-xs bg-gray-700 text-white px-2 py-1 rounded">
            Canvas Debug Tools
          </div>
        </div>

        {/* Container 2: Main Toolbar - REMOVED - DXFViewerLayout handles toolbar */}

        {/* Container 3: Overlay Toolbar - FLOATING VERSION */}
        {/* Removed from flex layout - now rendered as floating at bottom of DxfViewerContent */}

        {/* Snap Toolbar αφαιρέθηκε - υπάρχει ήδη στην κεντρική εργαλειοθήκη */}

        {/* Container 4: Canvas - CANVAS V2 */}
        <div className="canvas-area relative flex-1 overflow-hidden">
          {/* 🔺 CANVAS V2: Now using DXFViewerLayout → NormalView → CanvasSection */}
          <DXFViewerLayout
            currentScene={currentScene}
            activeTool={activeTool}
            onToolChange={handleToolChange}
            selectedEntityIds={selectedEntityIds}
            onEntitySelect={setSelectedEntityIds}
            showGrid={showGrid}
            showLayers={showLayers} // ✅ ΔΙΟΡΘΩΣΗ: Missing prop που έλειπε!
            onAction={(action, data) => {
              console.log('📋 DxfViewerContent onAction called:', { action, data }); // DEBUG
              handleAction(action, data);
            }}
            onSceneChange={handleSceneChange}
            onFileImport={handleFileImportWithEncoding}
            canUndo={canUndo}
            canRedo={canRedo}
            snapEnabled={snapEnabled}
            transform={canvasTransform}
            onTransformChange={wrappedHandleTransformChange}
            onRegionClick={handleRegionClick}
            onMouseMove={handleCanvasMouseMove}
            // 🎯 Canvas visibility controls
            dxfCanvasVisible={dxfCanvasVisible}
            layerCanvasVisible={layerCanvasVisible}
            overlayMode={overlayMode}
            overlayStatus={overlayStatus}
            overlayKind={overlayKind}
            setOverlayMode={setOverlayMode}
            setOverlayStatus={setOverlayStatus}
            setOverlayKind={setOverlayKind}
          />
        </div>
      </div>

      {/* Color Manager */}
      <ColorManager
        colorMenu={colorMenu}
        currentScene={currentScene}
        onSceneChange={handleSceneChange}
        onColorMenuClose={() => setColorMenu(s => ({...s, open:false}))}
        onExpandForSelection={(ids, scene) => floatingRef.current?.expandForSelection(ids, scene)}
      />

      {/* Cursor Settings Panel */}
      {showCursorSettings && (
        <CursorSettingsPanel
          isVisible={showCursorSettings}
          onClose={() => handleAction('toggle-cursor-settings')}
        />
      )}

      {/* Calibration Panel */}
      {showCalibration && (
        <CoordinateCalibrationOverlay
          show={showCalibration}
          onToggle={() => handleAction('toggle-calibration')}
          mousePos={null}
          worldPos={null}
        />
      )}


      {/* FloatingPanel τώρα είναι μέσα στον αριστερό container */}

      {/* 🚀 DRAGGABLE FLOATING OVERLAY TOOLBAR - Μετακινείται με drag και δεν συμπιέζει τον καμβά */}
      {(activeTool && (activeTool === 'layering' || (activeTool === 'polyline' && overlayMode === 'draw'))) || overlayStore.getSelectedOverlay() ? (
        <DraggableOverlayToolbar
          mode={overlayMode}
          onModeChange={setOverlayMode}
          currentStatus={overlayStatus}
          onStatusChange={setOverlayStatus}
          currentKind={overlayKind}
          onKindChange={setOverlayKind}
          snapEnabled={snapEnabled}
          onSnapToggle={() => handleAction('toggle-snap')}
          selectedOverlayId={overlayStore.selectedOverlayId}
          onDuplicate={() => {}}
          onDelete={() => {}}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={() => handleAction('undo')}
          onRedo={() => handleAction('redo')}
          onToolChange={handleToolChange}
        />
      ) : null}

      {/* 🚀 DRAGGABLE FLOATING OVERLAY PROPERTIES - Αιωρούμενο panel ιδιοτήτων που δεν συμπιέζει καμβά */}
      {overlayStore.getSelectedOverlay() && (
        <DraggableOverlayProperties
          overlay={overlayStore.getSelectedOverlay()}
          onUpdate={(overlayId, updates) => overlayStore.update(overlayId, updates)}
          onClose={() => {
            overlayStore.setSelectedOverlay(null);
          }}
        />
      )}

      {/* 🎯 PROFESSIONAL LAYOUT DEBUG SYSTEM - CAD-level precision debugging */}
      {isFeatureEnabled('LAYOUT_DEBUG_SYSTEM') && (
        <React.Suspense fallback={null}>
          <FullLayoutDebug />
        </React.Suspense>
      )}
      </div>
    </TransformProvider>
  );
}