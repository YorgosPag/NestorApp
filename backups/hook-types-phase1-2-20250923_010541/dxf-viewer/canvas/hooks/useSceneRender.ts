import { useEffect } from 'react';
import type { SceneModel } from '../../types/scene';
import type { Point2D as Point } from '../../types/scene';
import type { DrawingState } from '../../hooks/drawing/useUnifiedDrawing';

interface UseSceneRenderProps {
  currentScene: SceneModel | null;
  renderSceneInternal: (scene: SceneModel, options?: any) => void;
  mouseCss: Point | null;
  drawingState?: DrawingState;
  marqueeOverlayRef: React.RefObject<{start: Point; end: Point} | null>;
  marqueeRenderTrigger: number;
}

export function useSceneRender({
  currentScene, renderSceneInternal,
  mouseCss, drawingState, marqueeOverlayRef, marqueeRenderTrigger
}: UseSceneRenderProps) {
  useEffect(() => {
    if (currentScene) {
      renderSceneInternal(currentScene, {
        mousePosition: mouseCss,
        drawingState,
        marqueeOverlayRef,
      });
    }
  }, [
    currentScene,
    mouseCss,
    drawingState,
    renderSceneInternal,
    marqueeOverlayRef,
    marqueeRenderTrigger,
  ]);
}