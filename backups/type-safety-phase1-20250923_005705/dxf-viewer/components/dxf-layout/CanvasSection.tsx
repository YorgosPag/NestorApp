'use client';
import React, { useRef, useState } from 'react';
import { DxfCanvas, type DxfCanvasRef } from '../../canvas/DxfCanvas';
// OverlayCanvas import removed - it was dead code
import { FloatingPanelContainer } from '../../ui/FloatingPanelContainer';
import { OverlayList } from '../../ui/OverlayList';
import { OverlayProperties } from '../../ui/OverlayProperties';
import { useOverlayStore } from '../../overlays/overlay-store';
import { useLevels } from '../../systems/levels';
import type { DXFViewerLayoutProps } from '../../integration/types';
import type { OverlayEditorMode, Point2D } from '../../overlays/types';
import { createOverlayHandlers } from '../../overlays/types';
import { calculateDistance } from '../../utils/renderers/shared/geometry-rendering-utils';

/**
 * Renders the main canvas area, including the renderer and floating panels.
 */
export const CanvasSection: React.FC<DXFViewerLayoutProps & { overlayMode: OverlayEditorMode, currentStatus: any, currentKind: any }> = (props) => {
  const dxfCanvasRef = useRef<DxfCanvasRef>(null);
  const overlayStore = useOverlayStore();
  const levelManager = useLevels();
  const [draftPolygon, setDraftPolygon] = useState<Array<[number, number]>>([]);
  
  const {
    activeTool,
    showGrid,
    overlayMode = 'select',
    currentStatus = 'for-sale',
    currentKind = 'unit',
    ...restProps
  } = props;

  // Get overlays for current level
  const currentOverlays = levelManager.currentLevelId 
    ? overlayStore.getByLevel(levelManager.currentLevelId)
    : [];

  const selectedOverlay = overlayStore.getSelectedOverlay();

  // Use shared overlay handlers to eliminate duplicate code
  const { handleOverlaySelect, handleOverlayEdit, handleOverlayDelete, handleOverlayUpdate } = 
    createOverlayHandlers(overlayStore);

  // Drawing logic
  const handleOverlayClick = (overlayId: string, point: Point2D) => {
    console.log('Overlay clicked:', overlayId, point);
    if (overlayMode === 'select') {
      handleOverlaySelect(overlayId);
    }
  };

  const handleCanvasClick = (point: Point2D) => {
    console.log('Canvas clicked:', point, 'Mode:', overlayMode);
    
    if (overlayMode === 'draw') {
      const newPoint: [number, number] = [point.x, point.y];
      setDraftPolygon(prev => [...prev, newPoint]);
      
      // Close polygon if clicking near first point
      if (draftPolygon.length >= 3) {
        const firstPoint = draftPolygon[0];
        const distance = calculateDistance(point, { x: firstPoint[0], y: firstPoint[1] });
        
        if (distance < 20) { // Close threshold
          console.log('Closing polygon with', draftPolygon.length + 1, 'points');
          finishDrawing();
          return;
        }
      }
    } else {
      // Clicked on empty space - deselect
      handleOverlaySelect(null);
    }
  };

  const finishDrawing = async () => {
    if (draftPolygon.length >= 3 && levelManager.currentLevelId) {
      console.log('Creating overlay with polygon:', draftPolygon);
      try {
        await overlayStore.add({
          levelId: levelManager.currentLevelId,
          kind: currentKind,
          polygon: draftPolygon,
          status: currentStatus,
          label: `Overlay ${Date.now()}`, // Temporary label
        });
        console.log('Overlay created successfully');
      } catch (error) {
        console.error('Failed to create overlay:', error);
      }
    }
    setDraftPolygon([]);
  };

  // Handle Escape key to cancel drawing
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDraftPolygon([]);
      } else if (e.key === 'Enter' && draftPolygon.length >= 3) {
        finishDrawing();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draftPolygon]);

  return (
    <>
      {/* Left Sidebar */}
      <div className="w-80 flex-shrink-0 pl-3 pr-0 py-0 flex flex-col gap-3">
        {/* Original Floating Panel */}
        <div className="flex-1 bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden">
          <FloatingPanelContainer
            sceneModel={props.currentScene}
            selectedEntityIds={props.selectedEntityIds}
            onEntitySelect={props.setSelectedEntityIds}
            zoomLevel={props.currentZoom}
            currentTool={props.activeTool}
          />
        </div>
        
        {/* Overlay List */}
        <OverlayList
          overlays={currentOverlays}
          selectedOverlayId={overlayStore.selectedOverlayId}
          onSelect={handleOverlaySelect}
          onEdit={handleOverlayEdit}
          onDelete={handleOverlayDelete}
        />
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative">
        <DxfCanvas
          ref={dxfCanvasRef}
          scene={props.currentScene}
          onTransformChange={props.handleTransformChange}
          selectedEntityIds={props.selectedEntityIds}
          onSelectEntity={(entityIds) => {
            // Always allow entity selection when clicking on canvas
            console.log('🎯 [CanvasSection] onSelectEntity called with:', entityIds, 'activeTool:', activeTool);
            props.setSelectedEntityIds(Array.isArray(entityIds) ? entityIds : [entityIds]);
          }}
          alwaysShowCoarseGrid={true}
          isZoomWindowActive={activeTool === 'zoom-window'}
          onZoomWindowModeChange={(active) => {
            if (!active) props.handleToolChange('select');
          }}
          showCalibration={props.showCalibration}
          onCalibrationToggle={props.handleCalibrationToggle}
          onSceneChange={props.handleSceneChange}
          activeTool={props.activeTool}
          measurements={[]}
          tempMeasurementPoints={[]}
          drawingState={props.drawingState}
          onDrawingPoint={props.onDrawingPoint}
          onDrawingHover={props.onDrawingHover}
          onDrawingCancel={props.onDrawingCancel}
          onDrawingDoubleClick={props.onDrawingDoubleClick}
          gripSettings={props.gripSettings}
          onEntityCreated={props.onEntityCreated}
          className="absolute inset-0"
        />
        
        {/* Overlay Layer removed - it was dead code with red warning messages */}
      </div>

      {/* Right Sidebar - Properties Panel */}
      {selectedOverlay && (
        <div className="w-80 flex-shrink-0 pr-3 pl-0 py-0">
          <OverlayProperties
            overlay={selectedOverlay}
            onUpdate={handleOverlayUpdate}
            onClose={() => overlayStore.setSelectedOverlay(null)}
          />
        </div>
      )}
    </>
  );
};
