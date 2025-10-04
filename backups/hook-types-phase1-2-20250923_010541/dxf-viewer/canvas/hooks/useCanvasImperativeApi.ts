import { useMemo } from 'react';
import type { SceneModel } from '../../types/scene';
import type { Point2D as Point } from '../../types/scene';

export function useCanvasImperativeApi(deps: {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  rendererRef: any;
  currentScene: SceneModel | null;
  fitToView: () => void;
  getTransform: () => any;
  renderSceneInternal: (scene: SceneModel) => void;
  setSelectedEntityIdsInternal: (ids: string[]) => void;
  setCurrentScene: (scene: SceneModel) => void;
  onTransformChange?: (t: any) => void;
  clearCanvas: () => void;
  zoomAtScreenPoint: (factor: number, screenPt: Point) => void;
}) {
  const {
    canvasRef, rendererRef, currentScene, fitToView,
    getTransform, renderSceneInternal, setSelectedEntityIdsInternal,
    setCurrentScene, onTransformChange, clearCanvas, zoomAtScreenPoint
  } = deps;

  const ZOOM_FACTOR = 1.2;

  return useMemo(() => ({
    fitToView: () => { fitToView(); onTransformChange?.(getTransform()); },
    getCanvas: () => canvasRef.current,
    zoomAtScreenPoint,
    zoomIn: () => {
      const r = canvasRef.current?.getBoundingClientRect();
      if (!r) return;
      zoomAtScreenPoint(ZOOM_FACTOR, { x: r.width/2, y: r.height/2 });
    },
    zoomOut: () => {
      const r = canvasRef.current?.getBoundingClientRect();
      if (!r) return;
      zoomAtScreenPoint(1/ZOOM_FACTOR, { x: r.width/2, y: r.height/2 });
    },
    resetToOrigin: () => {
      if (rendererRef.current && currentScene) {
        rendererRef.current.fitToView(currentScene, 'fitFullAnchorBL');
        onTransformChange?.(rendererRef.current.getTransform());
      }
    },
    setSelectedEntityIds: (ids: string[]) => setSelectedEntityIdsInternal(ids),
    renderScene: (scene: SceneModel) => { setCurrentScene(scene); renderSceneInternal(scene); },
    clearCanvas,
    getTransform,
    activateZoomWindow: () => rendererRef.current?.activateZoomWindow?.(),
    deactivateZoomWindow: () => rendererRef.current?.deactivateZoomWindow?.(),
    undo: () => rendererRef.current?.undo?.() || false,
    redo: () => rendererRef.current?.redo?.() || false,
    canUndo: () => rendererRef.current?.canUndo?.() || false,
    canRedo: () => rendererRef.current?.canRedo?.() || false,
  }), [canvasRef, rendererRef, currentScene, fitToView, getTransform, renderSceneInternal, setSelectedEntityIdsInternal, setCurrentScene, onTransformChange, clearCanvas, zoomAtScreenPoint]);
}