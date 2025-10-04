/**
 * CanvasContainer Component
 * Handles the main canvas rendering area with DXF and overlay layers
 * Extracted from DxfViewerContent.tsx for better separation of concerns
 */

import React from 'react';
import { DxfCanvas } from '../../canvas/DxfCanvas';
import { OverlayCanvasCore } from '../../canvas/OverlayCanvasCore';
import { overlaysToRegions } from '../../overlays/overlay-adapter';
import { getOverlayEntitiesForLevel } from '../../overlays/snap-adapter';
import type { DxfCanvasRef } from '../../canvas/DxfCanvas';
import type { SceneModel } from '../../types/scene';
import type { OverlayEditorMode, Status } from '../../overlays/types';

interface CanvasContainerProps {
  // DXF Canvas Props
  dxfCanvasRef: React.RefObject<DxfCanvasRef>;
  currentScene: SceneModel | null;
  selectedEntityIds: string[];
  activeTool: string;
  showGrid: boolean;
  showCalibration: boolean;
  snapEnabled: boolean;

  // Overlay Props
  overlayMode: OverlayEditorMode;
  overlayStatus: Status;
  draftPolygon: Array<[number, number]>;
  snapPoint: {x: number, y: number} | null;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;

  // Transform and Store Props
  canvasTransform: { scale: number; offsetX: number; offsetY: number };
  overlayStore: any;
  levelManager: any;
  snapManager: any;

  // Handlers
  onTransformChange: (transform: any) => void;
  onSelectEntity: (entityIds: string | string[]) => void;
  onMouseMove: (pt: {x: number; y: number}) => void;
  onRequestColorMenu: (at: {x: number; y: number}) => void;
  onZoomWindowModeChange: (active: boolean) => void;
  onCalibrationToggle: () => void;
  onSceneChange: (scene: SceneModel) => void;

  // Measurement Props
  onMeasurementPoint: any;
  onMeasurementHover: any;
  onMeasurementCancel: any;

  // Drawing Props
  drawingState: any;
  onDrawingPoint: any;
  onDrawingHover: any;
  onDrawingCancel: any;
  onDrawingDoubleClick: any;
  onEntityCreated: any;
  gripSettings: any;

  // Overlay Handlers
  onRegionClick: (regionId: string) => void;
  onVertexDrag: (overlayId: string, vertexIndex: number, newPoint: { x: number; y: number }) => void;
  onRegionUpdate: (regionId: string, updates: { vertices?: Array<{x: number, y: number}> }) => void;
  onOverlayMouseMove: (worldX: number, worldY: number) => void;
  onOverlayCanvasClick: (point: { x: number; y: number }) => void;
  clearSnapPoint: () => void;
}

// Debug flag
const DEBUG_DXF_VIEWER_CONTENT = false;

export const CanvasContainer: React.FC<CanvasContainerProps> = ({
  dxfCanvasRef,
  currentScene,
  selectedEntityIds,
  activeTool,
  showGrid,
  showCalibration,
  snapEnabled,
  overlayMode,
  overlayStatus,
  draftPolygon,
  snapPoint,
  overlayCanvasRef,
  canvasTransform,
  overlayStore,
  levelManager,
  snapManager,
  onTransformChange,
  onSelectEntity,
  onMouseMove,
  onRequestColorMenu,
  onZoomWindowModeChange,
  onCalibrationToggle,
  onSceneChange,
  onMeasurementPoint,
  onMeasurementHover,
  onMeasurementCancel,
  drawingState,
  onDrawingPoint,
  onDrawingHover,
  onDrawingCancel,
  onDrawingDoubleClick,
  onEntityCreated,
  gripSettings,
  onRegionClick,
  onVertexDrag,
  onRegionUpdate,
  onOverlayMouseMove,
  onOverlayCanvasClick,
  clearSnapPoint
}) => {
  return (
    <div className="flex-1 relative bg-gray-900 rounded-lg shadow-lg border border-gray-500 overflow-hidden">
      {/* DXF Canvas Layer */}
      {(() => {
        // 🎯 UNIFIED SNAP: Calculate overlay entities for snap engine
        const currentLevelId = levelManager.currentLevelId;
        const overlayEntities = getOverlayEntitiesForLevel(
          overlayStore,
          currentLevelId,
          overlaysToRegions
        );
        if (DEBUG_DXF_VIEWER_CONTENT) console.log('🎯 [CanvasContainer] Unified snap entities calculated:', overlayEntities.length);

        return (
          <DxfCanvas
            ref={dxfCanvasRef}
            scene={currentScene}
            overlayEntities={overlayEntities} // 🎯 PASS overlay entities for unified snapping
            onTransformChange={onTransformChange}
            selectedEntityIds={selectedEntityIds}
            onSelectEntity={(entityIds) => {
              // Always allow entity selection when clicking on canvas
              onSelectEntity(Array.isArray(entityIds) ? entityIds : [entityIds]);
            }}
            onMouseMove={onMouseMove}
            onRequestColorMenu={(at) => {
              if (!selectedEntityIds?.length) return;
              onRequestColorMenu(at);
            }}
            alwaysShowCoarseGrid={showGrid}
            isZoomWindowActive={activeTool === 'zoom-window'}
            onZoomWindowModeChange={onZoomWindowModeChange}
            showCalibration={showCalibration}
            onCalibrationToggle={onCalibrationToggle}
            onSceneChange={onSceneChange}
            activeTool={activeTool}
            measurements={[]}
            tempMeasurementPoints={[]}
            onMeasurementPoint={onMeasurementPoint}
            onMeasurementHover={onMeasurementHover}
            onMeasurementCancel={onMeasurementCancel}
            drawingState={drawingState}
            onDrawingPoint={onDrawingPoint}
            onDrawingHover={onDrawingHover}
            onDrawingCancel={onDrawingCancel}
            onDrawingDoubleClick={onDrawingDoubleClick}
            gripSettings={gripSettings}
            onEntityCreated={onEntityCreated}
            className="absolute inset-0"
          />
        );
      })()}

      {/* Overlay Canvas Layer */}
      {activeTool === 'layering' && (() => {
        const currentLevelId = levelManager.currentLevelId;
        const overlaysForLevel = Object.values(overlayStore.overlays)
          .filter((ov: any) => !ov.levelId || ov.levelId === currentLevelId);
        const regions = overlaysToRegions(overlaysForLevel);

        // Use same transform format as DXF system
        const viewTransform = {
          scale: canvasTransform.scale,
          offsetX: canvasTransform.offsetX,
          offsetY: canvasTransform.offsetY
        };

        return (
          <div style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'auto' }}>
            <OverlayCanvasCore
              transform={viewTransform}
              visibleRegions={regions}
              selectedRegionIds={overlayStore.selectedOverlayId ? [overlayStore.selectedOverlayId] : []}
              showHandles={overlayMode === 'edit'}
              showLabels={true}
              isDrawing={overlayMode === 'draw'}
              drawingVertices={draftPolygon.map(([x, y]) => ({ x, y }))}
              drawingStatus={overlayStatus as any}
              editingRegionId={overlayStore.selectedOverlayId || null}
              mousePosition={null}
              onRegionClick={onRegionClick}
              onVertexDrag={onVertexDrag}
              onRegionUpdate={onRegionUpdate}
              snapEnabled={snapEnabled}
              findSnapPoint={snapManager?.findSnapPoint}
              onRendererReady={(renderer) => {
                // Store the renderer for potential canvas ref access
                if (renderer.canvas) {
                  overlayCanvasRef.current = renderer.canvas;
                }
              }}
              onMouseDown={() => {}}
              onMouseMove={(e) => {
                if (overlayMode === 'draw' && snapManager.findSnapPoint) {
                  const canvas = e.currentTarget as HTMLCanvasElement;
                  const rect = canvas.getBoundingClientRect();
                  const screenX = e.clientX - rect.left;
                  const screenY = e.clientY - rect.top;

                  // Convert screen to world coordinates
                  const worldX = (screenX - canvasTransform.offsetX) / canvasTransform.scale;
                  const worldY = (screenY - canvasTransform.offsetY) / canvasTransform.scale;

                  // Use overlay drawing hook's mouse move handler
                  onOverlayMouseMove(worldX, worldY);
                }
              }}
              onMouseUp={(e) => {
                if (overlayMode === 'draw') {
                  const canvas = e.currentTarget as HTMLCanvasElement;
                  const r = canvas.getBoundingClientRect();
                  const sp = { x: e.clientX - r.left, y: e.clientY - r.top };
                  // Use snap point if available, otherwise use mouse position
                  const wp = snapPoint ? snapPoint : {
                    x: (sp.x - canvasTransform.offsetX) / canvasTransform.scale,
                    y: (sp.y - canvasTransform.offsetY) / canvasTransform.scale
                  };

                  onOverlayCanvasClick(wp);

                  // Clear snap point after use
                  clearSnapPoint();
                }
              }}
              onMouseLeave={() => {}}
              onContextMenu={() => {}}
            />
          </div>
        );
      })()}
    </div>
  );
};