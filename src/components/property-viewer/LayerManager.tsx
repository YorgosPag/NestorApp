'use client';

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
} from 'react';

import { DxfCanvas as DxfCanvasCore } from '@/subapps/dxf-viewer/canvas/DxfCanvas';
import ZoomWindowOverlay from '@/subapps/dxf-viewer/canvas/ZoomWindowOverlay';
import SelectionMarqueeOverlay from '@/subapps/dxf-viewer/canvas/SelectionMarqueeOverlay';
import CoordinateCalibrationOverlay from '@/subapps/dxf-viewer/canvas/CoordinateCalibrationOverlay';
import CursorSettingsPanel from '@/subapps/dxf-viewer/ui/CursorSettingsPanel';

import type { SceneModel } from '@/subapps/dxf-viewer/types/scene';

type Point = { x:number; y:number };

interface Props {
  scene?: SceneModel | null;
  selectedEntityIds?: string[];
  onSelectEntity?: (ids: string[]) => void;
  alwaysShowCoarseGrid?: boolean;
  className?: string;
  showCalibration?: boolean;
  onCalibrationToggle?: (show: boolean) => void;
  onSceneChange?: (scene: SceneModel) => void;
  onTransformChange?: (transform: any) => void;
  isZoomWindowActive?: boolean;
  onZoomWindowModeChange?: (active: boolean) => void;
}

export interface DxfCanvasRef {
  fitToView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
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

const DxfCanvasComponent = forwardRef<DxfCanvasRef, Props>(function DxfCanvas({
  scene,
  selectedEntityIds = [],
  onSelectEntity,
  alwaysShowCoarseGrid = true,
  className = '',
  showCalibration = false,
  onCalibrationToggle,
  onSceneChange,
  onTransformChange,
  isZoomWindowActive = false,
  onZoomWindowModeChange,
}: Props, ref) {

  const rendererRef = useRef<any | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentScene, setCurrentScene] = useState<SceneModel | null>(scene ?? null);
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);
  const [mouseCss, setMouseCss] = useState<Point | null>(null);
  const [mouseWorld, setMouseWorld] = useState<Point | null>(null);

  const handleRendererReady = (renderer: any) => {
    rendererRef.current = renderer;
    if (renderer.getCanvas) {
      canvasRef.current = renderer.getCanvas();
    }
    try {
      const rect = renderer.getCanvas?.()?.getBoundingClientRect?.();
      if (rect) setCanvasRect(rect);
    } catch {}
    
    if (currentScene) {
      requestAnimationFrame(() => {
        try {
          renderer.setScene(currentScene);
          renderer.fitToView(currentScene);
        } catch (e) { console.warn('fitToView failed:', e); }
      });
    }
  };

  useEffect(() => {
    if (!scene) return;
    setCurrentScene(scene);
    if (rendererRef.current) {
      try {
        rendererRef.current.setScene(scene);
        if (scene.entities.length > 0) {
            rendererRef.current.fitToView(scene);
        }
      } catch (e) { console.warn('fitToView on scene change failed:', e); }
    }
  }, [scene]);

  const updateMouseWorld = (pt: Point | null) => {
    setMouseCss(pt);
    if (!pt) { setMouseWorld(null); return; }
    try {
      const cm = rendererRef.current?.getCoordinateManager?.();
      const world = cm?.screenToWorld?.(pt) ?? null;
      setMouseWorld(world);
    } catch { setMouseWorld(null); }
  };
  
  const handleMouseMove = (point: Point) => updateMouseWorld(point);
  const handleMouseLeave = () => updateMouseWorld(null);
  
  const handleMouseDown = (point: Point) => {
    if (!rendererRef.current) return;
    const hit = rendererRef.current.findEntityAt(point, 12);
    onSelectEntity?.(hit ? [hit.id] : []);
  };
  
  const handleWheel = (e: React.WheelEvent) => {
    e.deltaY > 0 ? rendererRef.current?.zoomOut() : rendererRef.current?.zoomIn();
    onTransformChange?.(rendererRef.current?.getTransform());
  };

  useImperativeHandle(ref, () => ({
    fitToView: () => {
      rendererRef.current?.fitToView(currentScene);
      onTransformChange?.(rendererRef.current?.getTransform());
    },
    zoomIn: () => {
      rendererRef.current?.zoomIn();
      onTransformChange?.(rendererRef.current?.getTransform());
    },
    zoomOut: () => {
      rendererRef.current?.zoomOut();
      onTransformChange?.(rendererRef.current?.getTransform());
    },
    setSelectedEntityIds: (ids: string[]) => rendererRef.current?.setSelectedEntityIds?.(ids),
    renderScene: (s: SceneModel) => { 
      setCurrentScene(s); 
      rendererRef.current?.setScene?.(s);
    },
    clearCanvas: () => rendererRef.current?.clearCanvas?.(),
    getTransform: () => rendererRef.current?.getTransform?.() ?? { scale: 1, offsetX: 0, offsetY: 0 },
    activateZoomWindow: () => rendererRef.current?.activateZoomWindow(),
    deactivateZoomWindow: () => rendererRef.current?.deactivateZoomWindow(),
    undo: () => rendererRef.current?.undo(),
    redo: () => rendererRef.current?.redo(),
    canUndo: () => rendererRef.current?.canUndo(),
    canRedo: () => rendererRef.current?.canRedo(),
  }));

  return (
    <>
      <div className={`relative h-full overflow-hidden ${className}`}>
        <DxfCanvasCore
          onRendererReady={handleRendererReady}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onMouseDown={handleMouseDown}
          onMouseUp={() => {}}
          onWheel={handleWheel}
          selectedEntityIds={selectedEntityIds}
          hoveredEntityId={null}
          alwaysShowCoarseGrid={alwaysShowCoarseGrid}
          scene={currentScene}
          isZoomWindowActive={isZoomWindowActive || false}
        />
        
        <ZoomWindowOverlay 
          zoomWindowState={{ isActive: isZoomWindowActive || false, isDragging: false, startPoint: null, currentPoint: null, previewRect: null }}
          className="absolute inset-0"
        />

        <SelectionMarqueeOverlay
          state={{ marquee: { active: false }, lasso: { active: false, points: []} }}
          className="absolute inset-0"
        />

        <CoordinateCalibrationOverlay
          mousePos={mouseCss}
          worldPos={mouseWorld}
          canvasRect={canvasRect ?? undefined}
          coordinateManager={rendererRef.current?.getCoordinateManager?.()}
          currentScene={currentScene ?? undefined}
          onInjectTestEntity={() => {}}
          show={showCalibration}
          onToggle={onCalibrationToggle}
        />
      </div>
      <CursorSettingsPanel />
    </>
  );
});

export const DxfCanvas = DxfCanvasComponent;
export default DxfCanvasComponent;