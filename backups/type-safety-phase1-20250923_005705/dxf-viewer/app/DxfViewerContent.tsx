'use client';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_DXF_VIEWER_CONTENT = false;

import React from 'react';

// Types
import type { DxfCanvasRef } from '../canvas/DxfCanvas';
import type { DxfViewerAppProps } from '../types';
import type { SceneModel } from '../types/scene';
import type { OverlayEditorMode, OverlayKind, Status } from '../overlays/types';

// Hooks
import { useDxfViewerState } from '../hooks/useDxfViewerState';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useOverlayDrawing } from '../hooks/useOverlayDrawing';
import { useCursor } from '../systems/cursor';
import { useSnapContext } from '../snapping/context/SnapContext';

// Stores and Managers
import { useOverlayStore } from '../overlays/overlay-store';
import { useLevelManager } from '../systems/levels/useLevels';
import { useGripContext } from '../providers/GripProvider';

// UI Components
import { FloatingPanelContainer, type FloatingPanelHandle } from '../ui/FloatingPanelContainer';
import { EnhancedDXFToolbar } from '../ui/toolbar';
import { OverlayToolbar } from '../ui/OverlayToolbar';
import { ColorManager } from '../ui/components/ColorManager';
import { CanvasContainer } from '../ui/components/CanvasContainer';
import { ProSnapToolbar } from '../ui/components/ProSnapToolbar';
import CursorSettingsPanel from '../ui/CursorSettingsPanel';
// Component that uses cursor context and renders toolbar with coordinates
export function ToolbarWithCursorCoordinates(props: any) {
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
  const dxfCanvasRef = React.useRef<DxfCanvasRef>(null);
  const floatingRef = React.useRef<FloatingPanelHandle>(null);
  const state = useDxfViewerState(dxfCanvasRef);

  // Add state for overlay toolbar
  const [overlayMode, setOverlayMode] = React.useState<OverlayEditorMode>('select');

  const [overlayStatus, setOverlayStatus] = React.useState<Status>('for-sale');
  const [overlayKind, setOverlayKind] = React.useState<OverlayKind>('unit');

  // Add canvas transform state for overlay layer
  const [canvasTransform, setCanvasTransform] = React.useState({ scale: 1, offsetX: 0, offsetY: 0 });
  
  // Use shared constants from overlays/types
  
  // State για color menu popover
  const [colorMenu, setColorMenu] = React.useState<{open:boolean; x:number; y:number; ids:string[]}>({
    open: false, x: 0, y: 0, ids: []
  });
  const {
    activeTool,
    handleToolChange,
    handleAction,
    showGrid,
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
    handleTransformChange,
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

  // Initialize canvasTransform from the canvas when it's ready
  React.useEffect(() => {
    if (dxfCanvasRef.current) {
      const initialTransform = dxfCanvasRef.current.getTransform();
      setCanvasTransform({
        scale: initialTransform.scale || 1,
        offsetX: initialTransform.offsetX || 0,
        offsetY: initialTransform.offsetY || 0,
      });
    }
  }, [dxfCanvasRef.current, currentScene]);

  // Periodically sync transform from canvas (workaround for missing callbacks)
  React.useEffect(() => {
    if (!dxfCanvasRef.current || activeTool !== 'layering') return;
    
    const syncTransform = () => {
      if (dxfCanvasRef.current) {
        const currentTransform = dxfCanvasRef.current.getTransform();
        setCanvasTransform(prev => {
          // Only update if values changed significantly
          if (Math.abs(prev.scale - currentTransform.scale) > 0.001 || 
              Math.abs(prev.offsetX - currentTransform.offsetX) > 1 ||
              Math.abs(prev.offsetY - currentTransform.offsetY) > 1) {
            return {
              scale: currentTransform.scale || 1,
              offsetX: currentTransform.offsetX || 0,
              offsetY: currentTransform.offsetY || 0,
            };
          }
          return prev;
        });
      }
    };
    
    // Sync every 100ms when layering tool is active
    const interval = setInterval(syncTransform, 100);
    return () => clearInterval(interval);
  }, [activeTool]);

  // Wrap handleTransformChange to also update canvasTransform state
  const wrappedHandleTransformChange = React.useCallback((transform: any) => {
    // Update the canvas transform state for OverlayLayer
    setCanvasTransform({
      scale: transform.scale || 1,
      offsetX: transform.offsetX || 0,
      offsetY: transform.offsetY || 0,
    });
    
    // Call the original handler
    handleTransformChange(transform);
  }, [handleTransformChange, setCanvasTransform]);


  // Wrapper για το handleFileImport που υποστηρίζει encoding
  const handleFileImportWithEncoding = async (file: File, encoding?: string) => {
    try {
      // 🎯 USE EXISTING LEVEL instead of creating new one
      // Check if we have a current level to use
      const currentLevel = levelManager.currentLevelId;
      
      if (currentLevel) {
        console.log('📋 [Enhanced Import] Using existing level for DXF:', currentLevel);
        
        // Clear overlays for current level to start fresh
        overlayStore.setCurrentLevel(currentLevel);
        console.log('🧹 [Enhanced Import] Cleared overlays for current level:', currentLevel);
        
        // Import the DXF into the existing level
        handleFileImport(file);
      } else {
        console.warn('⚠️ [Enhanced Import] No current level found, creating default level');
        // Only create new level if no current level exists
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '');
        const newLevelName = `${file.name.replace('.dxf', '')}_${timestamp}`;
        
        const newLevelId = await levelManager.addLevel(newLevelName, true);
        
        if (newLevelId) {
          console.log('✅ [Enhanced Import] New level created:', newLevelId);
          overlayStore.setCurrentLevel(newLevelId);
          // console.log('🔄 [Enhanced Import] Overlay store switched to level:', newLevelId);
          handleFileImport(file);
        } else {
          console.error('❌ [Enhanced Import] Failed to create new level');
          return;
        }
      }
      
      // Auto-activate UGS overlay system after DXF import
      setTimeout(() => {
        if (DEBUG_DXF_VIEWER_CONTENT) console.log('🎯 [Enhanced Import] Auto-activating layering tools for new DXF');
        handleToolChange('layering'); // This will call both tool change AND toggle-layers
        if (DEBUG_DXF_VIEWER_CONTENT) console.log('🎯 [Enhanced Import] Layering tools activated');
      }, 500); // Small delay to ensure DXF is loaded
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


  // 🎯 Bridge overlay edit mode to grip editing system (with guard to prevent loops)
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

  // 🎯 Listen for polygon updates from grip editing
  React.useEffect(() => {
    const handlePolygonUpdate = (event: CustomEvent) => {
      const { regionId, newVertices } = event.detail;
      if (DEBUG_DXF_VIEWER_CONTENT) console.log('🎯 [DxfViewerContent] Received polygon update for region:', regionId, newVertices);
      
      if (newVertices && regionId) {
        // Convert Point2D array to flat array for overlay store
        const flatVertices = newVertices.flatMap((v: { x: number; y: number }) => [v.x, v.y]);
        overlayStore.update(regionId, { polygon: flatVertices });
        console.log('✅ [DxfViewerContent] Updated overlay polygon in store');
      }
    };

    window.addEventListener('overlay:polygon-update', handlePolygonUpdate as EventListener);
    return () => window.removeEventListener('overlay:polygon-update', handlePolygonUpdate as EventListener);
  }, [overlayStore]);


  // Fix 2: Ασφάλεια στο parent - sync από το bus (μόνο για 'select')
  React.useEffect(() => {
    const onSelectFromBus = (ev: Event) => {
      const d = (ev as CustomEvent<any>).detail;
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
      if ((e.type === 'circle' || e.type === 'arc') && (e as any).center) {
        return { ...e, center: { x: (e as any).center.x + dx, y: (e as any).center.y + dy } };
      }
      if (e.type === 'polyline' && Array.isArray((e as any).points)) {
        const pts = (e as any).points.map((p: any) => ({ x: p.x + dx, y: p.y + dy }));
        return { ...e, points: pts };
      }
      // fallback: αν έχεις bounds-only ή άλλα types, άφησέ τα ως έχουν
      return e;
    });

    const updated = { ...currentScene, entities: moved };
    handleSceneChange(updated);
    dxfCanvasRef.current?.renderScene(updated);
  }, [currentScene, selectedEntityIds, handleSceneChange]);

  // Keyboard shortcuts hook
  const { handleCanvasMouseMove } = useKeyboardShortcuts({
    dxfCanvasRef,
    selectedEntityIds,
    currentScene,
    onNudgeSelection: nudgeSelection,
    onColorMenuClose: () => setColorMenu(s => ({...s, open:false})),
    activeTool,
    overlayMode,
    overlayStore
  });


  return (
      <div className="flex h-full p-2 gap-2 bg-gray-800">
      {/* Container 1: FloatingPanelContainer (Left) */}
      <div style={{
        width: '384px',
        minWidth: '384px',
        maxWidth: '384px',
        height: '100%',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden'
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
          <FloatingPanelContainer
            ref={floatingRef}
            sceneModel={currentScene}
            selectedEntityIds={selectedEntityIds}
            onEntitySelect={setSelectedEntityIds}
            zoomLevel={currentZoom}
            currentTool={activeTool}
          />
        </div>
      </div>

      {/* Main content area (Right) */}
      <div className="flex-1 flex flex-col gap-2 h-full">
        {/* Container 2: Main Toolbar */}
        <div className="bg-gray-900 rounded-lg shadow-lg border border-gray-500">
          <ToolbarWithCursorCoordinates
            activeTool={activeTool}
            onToolChange={handleToolChange}
            onAction={handleAction}
            showGrid={showGrid}
            autoCrop={false}
            canUndo={canUndo}
            canRedo={canRedo}
            snapEnabled={snapEnabled}
            showLayers={showLayers}
            showCalibration={showCalibration}
            showCursorSettings={showCursorSettings}
            currentZoom={currentZoom}
            commandCount={0}
            onSceneImported={handleFileImportWithEncoding}
          />
        </div>

        {/* Container 3: Overlay Toolbar - Visible when layering tool is active OR in overlay drawing mode */}
        {activeTool && (activeTool === 'layering' || (activeTool === 'polyline' && overlayMode === 'draw')) && (
          <div className="bg-gray-900 rounded-lg shadow-lg border border-gray-500">
            <OverlayToolbar
               mode={overlayMode}
               onModeChange={setOverlayMode}
               currentStatus={overlayStatus}
               onStatusChange={setOverlayStatus}
               currentKind={overlayKind}
               onKindChange={setOverlayKind}
               snapEnabled={snapEnabled}
               onSnapToggle={() => handleAction('toggle-snap')}
               selectedOverlayId={null}
               onDuplicate={() => {}}
               onDelete={() => {}}
               canUndo={canUndo}
               canRedo={canRedo}
               onUndo={() => handleAction('undo')}
               onRedo={() => handleAction('redo')}
               onToolChange={handleToolChange} // 🎯 NEW: Περνάμε το callback για global activeTool sync
            />
          </div>
        )}

        {/* Container 3.5: Snap Toolbar - Visible when in overlay drawing mode */}
        {activeTool === 'layering' && overlayMode === 'draw' && (
          <div className="bg-gray-900 rounded-lg shadow-lg border border-gray-500">
            <ProSnapToolbar
              enabledModes={enabledModes}
              onToggleMode={toggleMode}
              snapEnabled={snapEnabled}
              onToggleSnap={() => handleAction('toggle-snap')}
            />
          </div>
        )}

        {/* Container 4: Canvas */}
        <CanvasContainer
          dxfCanvasRef={dxfCanvasRef}
          currentScene={currentScene}
          selectedEntityIds={selectedEntityIds}
          activeTool={activeTool}
          showGrid={showGrid}
          showCalibration={showCalibration}
          snapEnabled={snapEnabled}
          overlayMode={overlayMode}
          overlayStatus={overlayStatus}
          draftPolygon={draftPolygon}
          snapPoint={snapPoint}
          overlayCanvasRef={overlayCanvasRef}
          canvasTransform={canvasTransform}
          overlayStore={overlayStore}
          levelManager={levelManager}
          snapManager={snapManager}
          onTransformChange={wrappedHandleTransformChange}
          onSelectEntity={(entityIds) => {
            // Always allow entity selection when clicking on canvas
            setSelectedEntityIds(Array.isArray(entityIds) ? entityIds : [entityIds]);
          }}
          onMouseMove={handleCanvasMouseMove}
          onRequestColorMenu={(at) => {
            if (!selectedEntityIds?.length) return;
            setColorMenu({ open: true, x: at.x, y: at.y, ids: selectedEntityIds.slice() });
          }}
          onZoomWindowModeChange={(active) => {
            if (!active) handleToolChange('select');
          }}
          onCalibrationToggle={handleCalibrationToggle}
          onSceneChange={handleSceneChange}
          onMeasurementPoint={onMeasurementPoint}
          onMeasurementHover={onMeasurementHover}
          onMeasurementCancel={onMeasurementCancel}
          drawingState={drawingState}
          onDrawingPoint={onDrawingPoint}
          onDrawingHover={onDrawingHover}
          onDrawingCancel={onDrawingCancel}
          onDrawingDoubleClick={onDrawingDoubleClick}
          onEntityCreated={onEntityCreated}
          gripSettings={gripSettings}
          onRegionClick={handleRegionClick}
          onVertexDrag={handleVertexDrag}
          onRegionUpdate={handleRegionUpdate}
          onOverlayMouseMove={handleOverlayMouseMove}
          onOverlayCanvasClick={handleOverlayCanvasClick}
          clearSnapPoint={clearSnapPoint}
        />
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
      </div>
  );
}