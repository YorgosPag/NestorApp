import { useEffect, useRef } from 'react';
import type { ViewTransform } from '../../systems/rulers-grid/config';

/**
 * Syncs the renderer's canvas + transform into stable refs
 */
export function useSyncRendererRefs(rendererRef: any, getTransform: () => ViewTransform) {
  const canvasForHitTestRef = useRef<HTMLCanvasElement | null>(null);
  const transformRef = useRef<ViewTransform>({ scale: 1, offsetX: 0, offsetY: window.innerHeight });

  useEffect(() => {
    if (rendererRef.current) {
      canvasForHitTestRef.current = rendererRef.current.getCanvas();
      transformRef.current = rendererRef.current.getTransform();
    }
  }, [rendererRef.current]);

  useEffect(() => {
    if (rendererRef.current) {
      transformRef.current = rendererRef.current.getTransform();
    }
  }, [getTransform()]); // run whenever transform changes

  return { canvasForHitTestRef, transformRef };
}