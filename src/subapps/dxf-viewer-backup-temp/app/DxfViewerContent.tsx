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
import { useViewerEventHandlers } from '../hooks/useViewerEventHandlers';

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

// ✅ REFACTOR: Extracted overlay components
import { DraggableOverlayToolbar } from '../components/overlay/DraggableOverlayToolbar';
import { DraggableOverlayProperties } from '../components/overlay/DraggableOverlayProperties';

// ✅ REFACTOR: Extracted debug control panel (was 1027 lines inline)
import { DebugControlPanel } from '../components/debug/DebugControlPanel';

// Layout Components - Canvas V2
import { DXFViewerLayout } from '../integration/DXFViewerLayout';
import { getKindFromLabel } from '../config/color-mapping';
import { isFeatureEnabled } from '../config/experimental-features';

// ✅ ENTERPRISE ARCHITECTURE: Transform Context (Single Source of Truth)
import { TransformProvider, useTransform } from '../contexts/TransformContext';

// ✅ REFACTOR: DraggableOverlayToolbar extracted to separate file (was 100 lines inline)
// ✅ REFACTOR: DraggableOverlayProperties extracted to separate file (was 114 lines inline)

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
    handleFileImport,
    currentScene,
    selectedEntityIds,
    setSelectedEntityIds,
    handleSceneChange,
    gripSettings,
    showLayers // ✅ ΔΙΟΡΘΩΣΗ: showLayers υπάρχει στο state, όχι fallback!
  } = state;

  // 🔧 FALLBACK: Provide default values for missing properties until hooks are updated
  const canUndo = (state as any).canUndo ?? false;
  const canRedo = (state as any).canRedo ?? false;
  const snapEnabled = (state as any).snapEnabled ?? true;
  const showCalibration = (state as any).showCalibration ?? false;
  const showCursorSettings = (state as any).showCursorSettings ?? false;
  const currentZoom = (state as any).currentZoom ?? 100;
  const handleCalibrationToggle = (state as any).handleCalibrationToggle ?? (() => {});
  const drawingState = (state as any).drawingState ?? null;
  const onMeasurementPoint = (state as any).onMeasurementPoint ?? (() => {});
  const onMeasurementHover = (state as any).onMeasurementHover ?? (() => {});
  const onMeasurementCancel = (state as any).onMeasurementCancel ?? (() => {});
  const onDrawingPoint = (state as any).onDrawingPoint ?? (() => {});
  const onDrawingHover = (state as any).onDrawingHover ?? (() => {});
  const onDrawingCancel = (state as any).onDrawingCancel ?? (() => {});
  const onDrawingDoubleClick = (state as any).onDrawingDoubleClick ?? (() => {});
  const onEntityCreated = (state as any).onEntityCreated ?? (() => {});

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
  // ✅ RE-ENABLED: After fixing infinite loops in LevelsSystem.tsx
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

  // ✅ REFACTOR: Event handlers extracted to useViewerEventHandlers hook (was ~135 lines inline)
  // ✅ RE-ENABLED: After fixing infinite loops in LevelsSystem.tsx
  useViewerEventHandlers({
    activeTool,
    handleToolChange,
    showCopyableNotification,
    currentScene,
    canvasOps,
    setCanvasTransform,
    overlayStore,
    setSelectedEntityIds,
    handleAction,
    showLayers
  });

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
  // ✅ RE-ENABLED: After fixing infinite loops in LevelsSystem.tsx
  const { handleCanvasMouseMove } = useKeyboardShortcuts({
    selectedEntityIds,
    currentScene,
    onNudgeSelection: nudgeSelection,
    onColorMenuClose: () => setColorMenu(s => ({...s, open:false})),
    activeTool,
    overlayMode,
    overlayStore
  });

  // 🔧 Handler: Transform ready callback για TransformProvider
  const handleTransformReady = React.useCallback((setTransformFn: (t: ViewTransform) => void) => {
    // Store the setTransform function if needed for imperative updates
    console.log('🎯 Transform context ready');
  }, []);

  // 🔧 Handler: Wrapped transform change που συγχρονίζει και το local state
  const wrappedHandleTransformChange = React.useCallback((transform: ViewTransform) => {
    setCanvasTransform({
      scale: transform.scale,
      offsetX: transform.offsetX,
      offsetY: transform.offsetY
    });
  }, []);

  // 🔧 Handler: File import με encoding support
  const handleFileImportWithEncoding = React.useCallback((file: File, encoding?: string) => {
    console.log('📂 File import with encoding:', { file: file.name, encoding });
    handleFileImport(file);
  }, [handleFileImport]);

  // 🔧 Handler: Region click για overlay regions
  const handleRegionClick = React.useCallback((regionId: string) => {
    console.log('🎯 Region clicked:', regionId);
    // Handle region selection/interaction
  }, []);

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
            {/* ✅ RE-ENABLED: After fixing infinite loop in TransformContext.tsx */}
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
        {/* 🎯 DEBUG CONTROL PANEL - Centralized debug tools (was 1027 lines inline) */}
        <DebugControlPanel
          onNotify={showCopyableNotification}
          dxfCanvasVisible={dxfCanvasVisible}
          layerCanvasVisible={layerCanvasVisible}
          onDxfToggle={() => setDxfCanvasVisible(!dxfCanvasVisible)}
          onLayerToggle={() => setLayerCanvasVisible(!layerCanvasVisible)}
          canvasTransform={canvasTransform}
          onTransformChange={wrappedHandleTransformChange}
        />

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