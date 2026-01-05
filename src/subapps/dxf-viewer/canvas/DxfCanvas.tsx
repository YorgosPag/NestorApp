'use client';

import React, { forwardRef, useImperativeHandle } from 'react';
import { DxfCanvasCore, type DxfCanvasImperativeAPI } from './DxfCanvasCore';
import CanvasOverlays from './CanvasOverlays';
import { useCanvasContext } from '../contexts/CanvasContext';
import type { SceneModel } from '../types/scene';
// ✅ ENTERPRISE FIX: Correct Point2D import path
import type { Point2D as Point } from '../rendering/types/Types';
import type { DrawingState } from '../hooks/drawing/useUnifiedDrawing';
// ✅ ENTERPRISE FIX: AnyMeasurement type from correct path
import type { AnyMeasurement } from '../types/measurements';
import type { ViewTransform } from '../systems/rulers-grid/config';
import type { Entity } from '../types/entities';
import type { GripSettings } from '../types/gripSettings';
// 🏢 ENTERPRISE: Centralized spacing tokens (ADR-013)
import { PANEL_LAYOUT } from '../config/panel-tokens';

interface DxfCanvasProps {
  scene?: SceneModel | null;
  selectedEntityIds?: string[];
  overlayEntities?: Entity[]; // 🎯 NEW: Extract overlay entities for snapping
  onSelectEntity?: (ids: string[]) => void;
  onRequestColorMenu?: (at: {x:number; y:number}) => void;
  onMouseMove?: (pt: {x:number; y:number}) => void;
  alwaysShowCoarseGrid?: boolean;
  className?: string;
  showCalibration?: boolean;
  onCalibrationToggle?: (show: boolean) => void;
  onSceneChange?: (scene: SceneModel) => void;
  onTransformChange?: (transform: ViewTransform) => void;
  isZoomWindowActive?: boolean;
  onZoomWindowModeChange?: (active: boolean) => void;
  activeTool?: string;
  measurements?: AnyMeasurement[];
  tempMeasurementPoints?: Point[];
  drawingState?: DrawingState;
  onEntityCreated?: (entity: Entity) => void;
  onMeasurementPoint?: (point: Point) => void;
  onMeasurementHover?: (point: Point | null) => void;
  onMeasurementCancel?: () => void;
  onDrawingPoint?: (point: Point) => void;
  onDrawingHover?: (point: Point | null) => void;
  onDrawingCancel?: () => void;
  onDrawingDoubleClick?: () => void;
  gripSettings?: GripSettings;
}

export interface DxfCanvasRef {
  fitToView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoom: (factor: number) => void;
  zoomAtScreenPoint: (factor: number, screenPt: Point) => void;
  resetToOrigin: () => void;
  getCanvas: () => HTMLCanvasElement | null;
  setSelectedEntityIds: (ids: string[]) => void;
  renderScene: (scene: SceneModel) => void;
  clearCanvas: () => void;
  getTransform: () => ViewTransform;
  activateZoomWindow: () => void;
  deactivateZoomWindow: () => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const DxfCanvas = forwardRef<DxfCanvasRef, DxfCanvasProps>((props, ref) => {
  const {
    scene,
    selectedEntityIds = [],
    overlayEntities = [],
    onSelectEntity,
    onRequestColorMenu,
    onMouseMove,
    alwaysShowCoarseGrid = false,
    className = '',
    showCalibration = false,
    onCalibrationToggle,
    onSceneChange,
    onTransformChange,
    isZoomWindowActive = false,
    onZoomWindowModeChange,
    activeTool = 'select',
    measurements = [],
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
    gripSettings,
  } = props;

  // State for overlays
  const [mouseCss, setMouseCss] = React.useState<Point | null>(null);
  const [mouseWorld, setMouseWorld] = React.useState<Point | null>(null);
  const [canvasRect, setCanvasRect] = React.useState<DOMRect | null>(null);
  const [transform, setTransform] = React.useState<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 });

  // 🎯 ΣΤΑΘΕΡΟΤΗΤΑ: Σύνδεση με CanvasContext για useCanvasOperations
  const context = useCanvasContext();
  const coreCanvasRef = context?.canvasRef || React.useRef<DxfCanvasImperativeAPI>(null);

  // Expose imperative API
  useImperativeHandle(ref, () => ({
    fitToView: () => coreCanvasRef.current?.fitToView(),
    zoomIn: () => coreCanvasRef.current?.zoomIn(),
    zoomOut: () => coreCanvasRef.current?.zoomOut(),
    zoom: (factor: number) => coreCanvasRef.current?.zoom(factor),
    zoomAtScreenPoint: (factor: number, screenPt: Point) => {
      // TODO: Implement zoomAtScreenPoint in DxfCanvasCore
      console.warn('zoomAtScreenPoint not yet implemented');
    },
    resetToOrigin: () => {
      // TODO: Implement resetToOrigin in DxfCanvasCore
      console.warn('resetToOrigin not yet implemented');
    },
    getCanvas: () => {
      // TODO: Get canvas from DxfCanvasCore
      return document.querySelector('canvas') as HTMLCanvasElement || null;
    },
    setSelectedEntityIds: (ids: string[]) => coreCanvasRef.current?.setSelectedEntityIds(ids),
    renderScene: (scene: SceneModel) => coreCanvasRef.current?.renderScene(scene),
    clearCanvas: () => coreCanvasRef.current?.clearCanvas(),
    getTransform: () => {
      console.log('🔍 [DxfCanvas] getTransform called, coreCanvasRef.current:', coreCanvasRef.current);
      if (coreCanvasRef.current && coreCanvasRef.current.getTransform) {
        return coreCanvasRef.current.getTransform();
      } else {
        console.warn('⚠️ [DxfCanvas] coreCanvasRef.current or getTransform not available, using fallback');
        return { scale: 1, offsetX: 0, offsetY: 0 };
      }
    },
    activateZoomWindow: () => {
      // TODO: Implement activateZoomWindow
      console.warn('activateZoomWindow not yet implemented');
    },
    deactivateZoomWindow: () => {
      // TODO: Implement deactivateZoomWindow
      console.warn('deactivateZoomWindow not yet implemented');
    },
    undo: () => {
      // TODO: Implement undo functionality
      console.warn('undo not yet implemented');
      return false;
    },
    redo: () => {
      // TODO: Implement redo functionality
      console.warn('redo not yet implemented');
      return false;
    },
    canUndo: () => {
      // TODO: Implement canUndo functionality
      return false;
    },
    canRedo: () => {
      // TODO: Implement canRedo functionality
      return false;
    },
  }), []);

  // Handle mouse move - update both mouse positions and call parent
  const handleMouseMove = React.useCallback((pt: Point) => {
    setMouseCss(pt);
    onMouseMove?.(pt);
  }, [onMouseMove]);

  // Handle transform change - update local state, call parent, and emit zoom event
  const handleTransformChange = React.useCallback((newTransform: ViewTransform) => {
    setTransform(newTransform);
    onTransformChange?.(newTransform);

    // 🎯 ΣΤΑΘΕΡΟΤΗΤΑ: Emit zoom event για useCanvasOperations sync
    const zoomEvent = new CustomEvent('dxf-zoom-changed', {
      detail: { scale: newTransform.scale, transform: newTransform }
    });
    document.dispatchEvent(zoomEvent);
  }, [onTransformChange]);

  // Get canvas rect on mount and resize
  React.useEffect(() => {
    const updateCanvasRect = () => {
      if (coreCanvasRef.current) {
        const canvas = document.querySelector('canvas'); // Get the actual canvas element
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          setCanvasRect(rect);
        }
      }
    };

    updateCanvasRect();
    window.addEventListener('resize', updateCanvasRect);
    return () => window.removeEventListener('resize', updateCanvasRect);
  }, []);

  // Calculate world position from CSS position
  React.useEffect(() => {
    if (mouseCss && transform) {
      const worldPos = {
        x: (mouseCss.x - transform.offsetX) / transform.scale,
        y: (mouseCss.y - transform.offsetY) / transform.scale
      };
      setMouseWorld(worldPos);
    } else {
      setMouseWorld(null);
    }
  }, [mouseCss, transform]);

  return (
    <div
      className={`relative h-full ${PANEL_LAYOUT.OVERFLOW.HIDDEN} bg-transparent ${className}`}
    >
      <DxfCanvasCore
        ref={coreCanvasRef}
        scene={scene}
        selectedEntityIds={selectedEntityIds}
        overlayEntities={overlayEntities}
        onSelectChange={onSelectEntity}
        onRequestColorMenu={onRequestColorMenu}
        onMouseMove={handleMouseMove}
        onRendererReady={() => {}}
        alwaysShowCoarseGrid={alwaysShowCoarseGrid}
        onSceneChange={onSceneChange}
        isZoomWindowActive={isZoomWindowActive}
        activeTool={activeTool}
        onDrawingPoint={onDrawingPoint}
        onDrawingHover={onDrawingHover}
        onDrawingCancel={onDrawingCancel}
        onDrawingDoubleClick={onDrawingDoubleClick}
        gripSettings={gripSettings}
        className={`absolute ${PANEL_LAYOUT.INSET['0']}`}
      />
      <CanvasOverlays
        mouseCss={mouseCss}
        mouseWorld={mouseWorld}
        canvasRect={canvasRect}
        isZoomWindowActive={isZoomWindowActive}
        showCalibration={showCalibration}
        onCalibrationToggle={onCalibrationToggle}
        currentScene={scene || null}
        snapResult={null} // TODO: Get from snap system
        transform={transform}
        enabledSnapModes={new Set()} // TODO: Get from snap system
        activeTool={activeTool}
        tempPoints={tempMeasurementPoints}
      />
    </div>
  );
});

DxfCanvas.displayName = 'DxfCanvas';

export default DxfCanvas;
// ✅ ENTERPRISE FIX: DxfCanvasRef moved to DxfCanvasCore to avoid export conflict
// export type { DxfCanvasRef };