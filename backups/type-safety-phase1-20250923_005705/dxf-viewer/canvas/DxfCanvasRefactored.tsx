'use client';

// ✅ Debug flag for DxfCanvasRefactored logging
const DEBUG_CANVAS_CORE = false;

import React, { forwardRef, useImperativeHandle, useEffect, useCallback, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { DxfCanvasCore } from './DxfCanvasCore';
import CanvasOverlays from './CanvasOverlays';
// CoordProvider removed - using only RulersGrid system now (from parent DxfViewerApp)

// Custom hooks
import { useCanvasRenderer } from './hooks/useCanvasRenderer';
// 🚫 ΑΦΑΙΡΕΣΗ - useCanvasSnapping (χρησιμοποιείται μόνο το useSnapIntegration)
import { useCanvasTools } from './hooks/useCanvasTools';
import { useCanvasPanZoom } from './hooks/useCanvasPanZoom';
import { useCanvasMarquee } from './hooks/useCanvasMarquee';
import { useDynamicInputHandler } from '../systems/dynamic-input';
import { useMousePosition } from './hooks/useMousePosition';
import { useSyncRendererRefs } from './hooks/useSyncRendererRefs';
import { useCanvasImperativeApi } from './hooks/useCanvasImperativeApi';
import { useSelectionWiring } from './hooks/useSelectionWiring';
import { useSceneRender } from './hooks/useSceneRender';
import { useGripContext } from '../providers/GripProvider';
import { createCommitSelection, findEntityAtPoint, processAdditiveSelection, isAdditiveEvent, getScreenPointFromEvent } from './utils/selection-helpers';
import { useSnapIntegration } from './components/dxf-viewer/hooks/useSnapIntegration';
import { useGripInteraction } from './interaction/useGripInteraction';
// import { useCentralizedMouse } from '../mouse/useCentralizedMouse'; // Future use

// Types
import type { SceneModel } from '../types/scene';
import type { Point2D as Point } from '../types/scene';
import type { DrawingState } from '../hooks/drawing/useUnifiedDrawing';
import type { AnyMeasurement } from '../types/measurements';
import type { ViewTransform } from '../systems/rulers-grid/config';

interface DxfCanvasProps {
  scene?: SceneModel | null;
  selectedEntityIds?: string[];
  onSelectEntity?: (ids: string[]) => void;
  onRequestColorMenu?: (at: {x:number; y:number}) => void;
  onMouseMove?: (pt: {x:number; y:number}) => void;
  alwaysShowCoarseGrid?: boolean;
  className?: string;
  showCalibration?: boolean;
  onCalibrationToggle?: (show: boolean) => void;
  onSceneChange?: (scene: SceneModel) => void;
  onTransformChange?: (transform: any) => void;
  isZoomWindowActive?: boolean;
  onZoomWindowModeChange?: (active: boolean) => void;
  activeTool?: string;
  measurements?: AnyMeasurement[];
  tempMeasurementPoints?: Point[];
  drawingState?: DrawingState;
  onEntityCreated: (entity: any) => void;
  onMeasurementPoint?: (worldPoint: Point) => void;
  onMeasurementHover?: (worldPoint: Point | null) => void;
  onMeasurementCancel?: () => void;
  onDrawingPoint?: (worldPoint: Point) => void;
  onDrawingHover?: (worldPoint: Point | null) => void;
  onDrawingCancel?: () => void;
  onDrawingDoubleClick?: () => void;
  gripSettings?: any;
  overlayEntities?: any[]; // 🎯 NEW: Overlay entities for unified snapping
}

export interface DxfCanvasRef {
  fitToView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomAtScreenPoint: (factor: number, screenPt: Point) => void;
  resetToOrigin: () => void;
  getCanvas: () => HTMLCanvasElement | null;
  setSelectedEntityIds: (ids: string[]) => void;
  renderScene: (scene: SceneModel) => void;
  clearCanvas: () => void;
  getTransform: () => { scale: number; offsetX: number; offsetY: number };
  activateZoomWindow: () => void;
  deactivateZoomWindow: () => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const DxfCanvasRefactored = forwardRef<DxfCanvasRef, DxfCanvasProps>(
  function DxfCanvasRefactored(props, ref) {
    const {
      scene,
      selectedEntityIds = [],
      onSelectEntity,
      onRequestColorMenu,
      onMouseMove,
      alwaysShowCoarseGrid = true,
      className = '',
      showCalibration = false,
      onCalibrationToggle,
      onSceneChange,
      onTransformChange,
      isZoomWindowActive = false,
      onZoomWindowModeChange,
      activeTool = 'select',
      measurements = [],
      overlayEntities = [], // 🎯 NEW: Extract overlay entities
      tempMeasurementPoints = [],
      drawingState,
      onEntityCreated,
      onMeasurementPoint,
      onMeasurementHover,
      onMeasurementCancel,
      onDrawingPoint,
      onDrawingHover,
      onDrawingCancel,
      onDrawingDoubleClick,
      gripSettings: propGripSettings,
    } = props;

    // Get grip settings from context or props
    const { gripSettings: contextGripSettings } = useGripContext() ?? {};
    const gripSettings = propGripSettings ?? contextGripSettings;

    const ignoreNextMouseUpRef = useRef(false); // για δεξί-κλικ mouseup ignore
    
    // ✅ Cursor state for DxfCanvasCore
    const [cursorStyle, setCursorStyle] = useState<string>('crosshair');
    
    // ✅ Grip preview state for drag operations
    const [gripPreview, setGripPreview] = useState<{ entityId: string; next: any } | null>(null);

    // Renderer hook
    const {
      rendererRef,
      canvasRef,
            currentScene,
      canvasRect,
      handleRendererReady,
      fitToView,
      zoomIn,
      zoomOut,
      zoom,
      getTransform,
      getCoordinateManager,
      renderScene: renderSceneInternal,
      setSelectedEntityIds: setSelectedEntityIdsInternal,
      clearCanvas,
      setCurrentScene,
    } = useCanvasRenderer({
      scene: scene || null,
      gripSettings,
      alwaysShowCoarseGrid,
    });

    // Pan/Zoom hook
    const {
      isPanning,
      handleWheel,
      handlePanMouseDown,
      handlePanMouseMove,
      handlePanMouseUp,
      zoomAtScreenPoint,
    } = useCanvasPanZoom({
      rendererRef,
      onTransformChange,
      activeTool,
    });

    // ✅ Sync renderer refs (canvas + transform)  
    const { canvasForHitTestRef, transformRef } = useSyncRendererRefs(rendererRef, getTransform);

    // 🎯 SNAP INTEGRATION - Unified snap functionality (πριν από useCanvasTools)
    const { snapEnabled, enabledModes, findSnapPoint, applySnap, currentSnapResult, trackSnapForPoint } = useSnapIntegration({
      canvasRef: canvasForHitTestRef,
      currentScene: currentScene,
      overlayEntities, // 🎯 PASS overlay entities for unified snapping
      onSnapPoint: (point) => {
        if (DEBUG_CANVAS_CORE) console.log('🎯 Snap point found:', point);
      }
    });

    // Tools hook
    const {
      isDrawingMode,
      isMeasurementMode,
      isSelectionMode,
      handleToolHover,
      handleToolClick,
      handleToolDoubleClick,
      selectEntities,
      clearSelection,
    } = useCanvasTools({
      scene: currentScene,
      selectedEntityIds,
      activeTool,
      drawingState,
      rendererRef,
      snapResult: currentSnapResult,
      onSelectEntity,
      onMeasurementPoint,
      onMeasurementHover,
      onMeasurementCancel,
      onDrawingPoint,
      onDrawingHover,
      onDrawingCancel,
      onDrawingDoubleClick,
    });

    // 🎯 ΔΙΟΡΘΩΣΗ: Function για έλεγχο drawing mode
    const checkIsDrawingMode = useCallback(() => {
      return drawingState?.isDrawing === true;
    }, [drawingState?.isDrawing]);

    // Mouse position hook
    const {
      mouseCss,
      mouseWorld,
      updateMousePosition,
    } = useMousePosition({
      getCoordinateManager,
      handleToolHover,
      onMouseMove,
      trackSnapForPoint, // ✅ Για live snap tracking
      isDrawingMode: checkIsDrawingMode, // 🎯 ΝΕΟ: Περνάμε τη συνάρτηση για έλεγχο drawing mode
    });

    // Helper - single source of truth για επιλογές
    const commitSelection = createCommitSelection({
      onSelectEntity,
      rendererRef,
      scene,
    });

    // Marquee selection hook
    const {
      marqueeRenderTrigger,
      marqueeOverlayRef,
      handleMarqueeMouseDown,
      handleMarqueeMouseMove,
      handleMarqueeMouseUp,
      cancelMarquee,
    } = useCanvasMarquee({
      scene: currentScene,
      selectedEntityIds,
      rendererRef,
      activeTool,
      commitSelection,
    });


    // Dynamic Input Handler
    useDynamicInputHandler({
      activeTool,
      onDrawingPoint,
      onEntityCreated,
    });

    // Selection wiring
    const { onMouseDownSelection, onContextMenuSelection } = useSelectionWiring({
      activeTool,
      scene: currentScene,
      rendererRef,
      selectedEntityIds,
      commitSelection,
      onRequestColorMenu,
    });

    // Create refs for mouse interactions
    const selectedIdsRef = useRef(new Set(selectedEntityIds));
    const hoverIdRef = useRef<string | null>(null);
    
    // Update refs when values change
    selectedIdsRef.current = new Set(selectedEntityIds);

    // Grip interaction system (restored temporarily)
    const gripInteraction = useGripInteraction({
      scene: currentScene,
      selectedIdsRef,
      transformRef,
      canvasRef: canvasForHitTestRef || canvasRef,
      entityRendererRef: rendererRef,
      render: (scene: SceneModel) => {
        renderSceneInternal(scene, { gripPreview });
      },
      gripSettings,
      setPreviewOverride: (preview) => {
        if (DEBUG_CANVAS_CORE) console.log('🎯 Grip preview:', preview);
        setGripPreview(preview);
      },
      onCommitLine: (entityId, updates) => {
        if (!currentScene || !onSceneChange) return;
        const newScene = {
          ...currentScene,
          entities: currentScene.entities.map(e => e.id === entityId ? { ...e, ...updates } : e)
        };
        onSceneChange(newScene);
      },
      onSceneChange,
      setCursor: (cursor) => {
        if (DEBUG_CANVAS_CORE) console.log('🎯 Grip cursor change:', cursor);
        setCursorStyle(cursor);
      }
    });

    // Scene render loop
    useSceneRender({
      currentScene,
            renderSceneInternal,
      measurements,
      tempMeasurementPoints,
      mouseCss,
      drawingState,
      marqueeOverlayRef,
      marqueeRenderTrigger,
    });

    // Handle mouse events (restored)
    const handleMouseMove = useCallback((point: Point, e?: React.MouseEvent<HTMLCanvasElement>) => {
      handlePanMouseMove(point);
      
      if (ignoreNextMouseUpRef.current) return;
      
      // Handle grip drag first (highest priority)
      const dragActive = gripInteraction.onMouseMoveDrag(point);
      
      const isDragging = gripInteraction.isDraggingRef.current;
      if (isDragging) {
        flushSync(() => {
          updateMousePosition(point);
        });
        setCursorStyle('grabbing');
      }
      
      if (dragActive) {
        return;
      }
      
      gripInteraction.onMouseMoveGrip(point);
      
      // ✅ ΠΆΝΤΟΤΕ ενημέρωσε το mouse position ακόμα και κατά τη διάρκεια marquee selection
      updateMousePosition(point);
      
      if (handleMarqueeMouseMove(point, e)) {
        return;
      }
    }, [handlePanMouseMove, handleMarqueeMouseMove, updateMousePosition, gripInteraction]);

    const handleMouseLeave = useCallback(() => {
      updateMousePosition(null);
      // Καθάρισε marquee αν φύγει ο δείκτης έξω
      cancelMarquee();
    }, [updateMousePosition, cancelMarquee]);

    const handleMouseDown = useCallback((point: Point, e?: React.MouseEvent<HTMLCanvasElement>) => {
      // Pan: Μεσαίο κουμπί ή αριστερό με pan tool
      if (handlePanMouseDown(point, e)) {
        return; // Pan started, don't process other events
      }
      
      // ΜΟΝΟ το αριστερό κουμπί ξεκινά interactions
      if (e?.button === 2) { // δεξί
        e.preventDefault();
        e.stopPropagation();
        cancelMarquee(); // ⬅️ σβήστο χειροκίνητα
        ignoreNextMouseUpRef.current = true; // ο browser θα στείλει mouseup μετά
        onRequestColorMenu?.({ x: e.clientX, y: e.clientY }); // άνοιξε παλέτα
        return;
      }
      if (e?.button !== 0) return; // όχι άλλα κουμπιά

      if (DEBUG_CANVAS_CORE) console.log('🎯 [DxfCanvas] Mouse down at:', point, 'activeTool:', activeTool);
      
      // Emit canvas-click event για το DynamicInputOverlay
      if (DEBUG_CANVAS_CORE) console.log('[DxfCanvasRefactored] 🎯 DISPATCHING canvas-click event');
      window.dispatchEvent(new CustomEvent('canvas-click'));

      // 🎯 ΔΙΟΡΘΩΣΗ: Emit overlay:canvas-click event για το layering system
      if (activeTool === 'layering') {
        if (DEBUG_CANVAS_CORE) console.log('[DxfCanvasRefactored] 🎯 DISPATCHING overlay:canvas-click event with point:', point);
        window.dispatchEvent(new CustomEvent('overlay:canvas-click', { detail: { point } }));
      }

      // ✅ FIX: Check for grip interaction FIRST (highest priority)
      if (activeTool === 'select') {
        if (DEBUG_CANVAS_CORE) console.log('🔍 [DxfCanvas] MouseDown in select tool - checking grip first');
        if (DEBUG_CANVAS_CORE) console.log('🔍 [DxfCanvas] Selected entities:', Array.from(selectedIdsRef.current));
        if (DEBUG_CANVAS_CORE) console.log('🔍 [DxfCanvas] Scene entities:', currentScene?.entities?.length || 0);
        
        const gripHandled = gripInteraction.onMouseDownGrip(point);
        if (DEBUG_CANVAS_CORE) console.log('🔍 [DxfCanvas] Grip interaction result:', gripHandled);
        
        const alreadyDragging = gripInteraction.isDraggingRef.current;
        if (DEBUG_CANVAS_CORE) console.log('🔍 [DxfCanvas] Already dragging?', alreadyDragging);
        
        if (gripHandled || alreadyDragging) {
          if (DEBUG_CANVAS_CORE) console.log('🎯 Grip handled, skipping selection and marquee');
          return;
        }
        
        if (DEBUG_CANVAS_CORE) console.log('🔍 [DxfCanvas] Grip not handled - trying selection');
        // Only if grip not handled, try selection using the entity hit test
        if (currentScene && rendererRef.current) {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            const hit = findEntityAtPoint({ point, scene: currentScene, rendererRef });
            if (hit) {
              if (DEBUG_CANVAS_CORE) console.log('🎯 Entity selection hit:', hit.id);
              selectEntities([hit.id], e?.ctrlKey || e?.metaKey);
              return; // Selection handled
            }
          }
        }
        
        if (DEBUG_CANVAS_CORE) console.log('🔍 [DxfCanvas] Selection not handled - falling back to marquee');
        // Finally, try marquee if nothing else handled
        handleMarqueeMouseDown(point, e);
      }

      // 3) Κανονικά (χωρίς modifiers): grips → single-select fallback
      const toolHandled = handleToolClick(point);
      if (!toolHandled) {
        // Handle empty space click for selection tool
        if (activeTool === 'select' && currentScene && rendererRef.current) {
          const hit = findEntityAtPoint({ point, scene: currentScene, rendererRef });
          
          if (!hit) {
            // Μόνο αν ΔΕΝ κρατάει additive modifier
            if (!isAdditiveEvent(e)) {
              commitSelection([]);
            }
            return;
          }
          
          // Single click entity selection (χωρίς modifiers)
          if (!isAdditiveEvent(e) && hit?.entityId) {
            commitSelection([hit.entityId]);
            return;
          }
        }

        if (DEBUG_CANVAS_CORE) console.log('Click not handled by any tool');
      }
    }, [handlePanMouseDown, activeTool, currentScene, selectedEntityIds, commitSelection, rendererRef, cancelMarquee, onRequestColorMenu, handleToolClick, handleMarqueeMouseDown, gripInteraction]);

    const handleMouseUp = useCallback((e?: React.MouseEvent<HTMLCanvasElement>) => {
      // End pan if active
      handlePanMouseUp();
      
      // κατάπιε το «ορφανό» mouseup μετά από right-click
      if (ignoreNextMouseUpRef.current) {
        ignoreNextMouseUpRef.current = false; // consume
        return;
      }
      
      // Handle grip mouse up only if actually dragging
      const wasDragging = gripInteraction.isDraggingRef.current;
      
      if (wasDragging) {
        gripInteraction.onMouseUpDrag();
        setCursorStyle('crosshair');
      }
      
      handleMarqueeMouseUp(e);
    }, [handlePanMouseUp, handleMarqueeMouseUp, gripInteraction]);

    const handleDoubleClick = useCallback(() => {
      handleToolDoubleClick();
    }, [handleToolDoubleClick]);

    const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();    // ⛔️ κόψε το browser menu
      e.stopPropagation();

      cancelMarquee();
      ignoreNextMouseUpRef.current = true;
      onContextMenuSelection(e);
    }, [cancelMarquee, onContextMenuSelection]);


    // Expose imperative API via ref
    const api = useCanvasImperativeApi({
      canvasRef,
      rendererRef,
      currentScene,
      fitToView,
      getTransform,
      renderSceneInternal,
      setSelectedEntityIdsInternal,
      setCurrentScene,
      onTransformChange,
      clearCanvas,
      zoomAtScreenPoint,
    });
    useImperativeHandle(ref, () => api, [api]);


    return (
      <>
        <div 
          className={`relative h-full overflow-hidden bg-gray-900 ${className}`}
          style={{ 
            cursor: gripInteraction.isDraggingRef.current ? 'grabbing' : 
                   (isPanning ? 'grabbing' : (activeTool === 'pan' ? 'grab' : cursorStyle)) 
          }}
          onDoubleClick={handleDoubleClick}
          onContextMenu={(e) => e.preventDefault()} // ✅ Global safety net
        >
          <DxfCanvasCore
              onRendererReady={handleRendererReady}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onWheel={handleWheel}
              selectedEntityIds={selectedEntityIds}
              hoveredEntityId={null}
              alwaysShowCoarseGrid={alwaysShowCoarseGrid}
              scene={currentScene}
              activeTool={activeTool}
              isZoomWindowActive={isZoomWindowActive}
              hitTestCanvasRef={canvasForHitTestRef}      // ✅ renderer's canvas
              hitTestTransformRef={transformRef}          // ✅ renderer's transform
              onSceneChange={onSceneChange}                // ✅ grip drag commits
              onSelectChange={onSelectEntity}              // ✅ selection callback
              onRequestColorMenu={onRequestColorMenu}      // ✅ right-click color menu
              setCursor={setCursorStyle}                   // ✅ cursor callback
              snapEnabled={snapEnabled}                    // ✅ snap enabled state
              findSnapPoint={findSnapPoint}                // ✅ snap function
            />
          <CanvasOverlays
            mouseCss={mouseCss}
            mouseWorld={mouseWorld}
            canvasRect={canvasRect}
            isZoomWindowActive={isZoomWindowActive}
            showCalibration={showCalibration}
            onCalibrationToggle={onCalibrationToggle}
            currentScene={currentScene}
            coordinateManager={getCoordinateManager()}
            transform={getTransform()}
            snapResult={currentSnapResult}
            enabledSnapModes={enabledModes}
            activeTool={activeTool}
            tempPoints={drawingState?.tempPoints || null}
            marqueeOverlayRef={marqueeOverlayRef}
          />
        </div>
      </>
    );
  }
);

export default DxfCanvasRefactored;