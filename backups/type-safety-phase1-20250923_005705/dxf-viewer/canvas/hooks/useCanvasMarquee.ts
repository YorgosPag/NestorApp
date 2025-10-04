import { useCallback, useRef, useState } from 'react';
import type { Point2D as Point } from '../../types/scene';
import type { SceneModel } from '../../types/scene';
import { rectFromScreenPoints, pickEntitiesInRect, type MarqueeMode } from '../../utils/marquee-selection';

interface UseCanvasMarqueeProps {
  scene?: SceneModel | null;
  selectedEntityIds?: string[];
  rendererRef: React.RefObject<any>;
  activeTool: string;
  commitSelection: (ids: string[]) => void;
}

interface UseCanvasMarqueeReturn {
  marqueeRenderTrigger: number;
  marqueeOverlayRef: React.RefObject<{start: Point; end: Point} | null>;
  handleMarqueeMouseDown: (point: Point, e?: React.MouseEvent<HTMLCanvasElement>) => void;
  handleMarqueeMouseMove: (point: Point, e?: React.MouseEvent<HTMLCanvasElement>) => boolean;
  handleMarqueeMouseUp: (e?: React.MouseEvent<HTMLCanvasElement>) => void;
  cancelMarquee: () => void;
}

export function useCanvasMarquee({
  scene,
  selectedEntityIds = [],
  rendererRef,
  activeTool,
  commitSelection,
}: UseCanvasMarqueeProps): UseCanvasMarqueeReturn {
  // Marquee render trigger
  const [marqueeRenderTrigger, setMarqueeRenderTrigger] = useState(0);

  // Marquee selection refs
  const marqueeStartRef = useRef<Point | null>(null);
  const marqueeEndRef = useRef<Point | null>(null);
  const marqueeActiveRef = useRef(false);
  const marqueeAdditiveRef = useRef(false); // Ctrl/⌘/Shift → toggle/ένωση
  const marqueeSubtractRef = useRef(false); // Alt → αφαίρεση
  const marqueeOverlayRef = useRef<{start: Point; end: Point} | null>(null);

  const MARQUEE_THRESHOLD_PX = 4; // για να μη «πιάνει» σε τυχαίο τρεμοπαίξιμο

  // Marquee overlay helper
  const setMarqueeOverlay = useCallback((ov: {start: Point; end: Point} | null) => {
    marqueeOverlayRef.current = ov;
    // Trigger re-render to show marquee overlay
    setMarqueeRenderTrigger(prev => prev + 1);
  }, []);

  // Cancel marquee helper  
  const cancelMarquee = useCallback(() => {
    marqueeActiveRef.current = false;
    marqueeStartRef.current = null;
    marqueeEndRef.current = null;
    setMarqueeOverlay(null);
  }, [setMarqueeOverlay]);

  const handleMarqueeMouseDown = useCallback((point: Point, e?: React.MouseEvent<HTMLCanvasElement>) => {
    // 2) Ένα απλό click select (όπως ήδη): αν φύγει σε drag > threshold, θα γίνει marquee
    // Αποθήκευσε μόνο την αρχή και τα modifiers
    if (activeTool === 'select') {
      marqueeStartRef.current = point;
      marqueeEndRef.current = point;
      marqueeActiveRef.current = false;
      marqueeAdditiveRef.current = !!(e && (e.ctrlKey || e.metaKey || e.shiftKey));
      marqueeSubtractRef.current = !!(e && e.altKey);
    }
  }, [activeTool]);

  const handleMarqueeMouseMove = useCallback((point: Point, e?: React.MouseEvent<HTMLCanvasElement>): boolean => {
    // αν δεν πατιέται αριστερό ή είμαστε σε marquee, cancel
    if (e && (e.buttons & 1) === 0 && marqueeActiveRef.current) {
      cancelMarquee();
      return false;
    }
    
    // Marquee preview
    if (marqueeStartRef.current && activeTool === 'select') {
      const dx = Math.abs(point.x - marqueeStartRef.current.x);
      const dy = Math.abs(point.y - marqueeStartRef.current.y);
      if (!marqueeActiveRef.current && (dx > MARQUEE_THRESHOLD_PX || dy > MARQUEE_THRESHOLD_PX)) {
        marqueeActiveRef.current = true;
      }
      marqueeEndRef.current = point;
      if (marqueeActiveRef.current) {
        setMarqueeOverlay({ start: marqueeStartRef.current, end: point });
        return true; // όσο σύρεις, μην κάνεις entity hover
      }
    }
    return false;
  }, [activeTool, setMarqueeOverlay, MARQUEE_THRESHOLD_PX, cancelMarquee]);

  const handleMarqueeMouseUp = useCallback((e?: React.MouseEvent<HTMLCanvasElement>) => {
    const start = marqueeStartRef.current, end = marqueeEndRef.current;
    const wasMarquee = marqueeActiveRef.current;
    
    // καθάρισε overlay/flags
    marqueeStartRef.current = null;
    marqueeEndRef.current = null;
    marqueeActiveRef.current = false;
    setMarqueeOverlay(null);

    if (!wasMarquee || !start || !end || !scene || !rendererRef.current) {
      // απλό click — άφησε την υπάρχουσα ροή σου
      return;
    }

    // 1) Υπολόγισε world-rect
    const canvas = rendererRef.current.getCanvas();
    const canvasRect = canvas?.getBoundingClientRect();
    const transform = rendererRef.current.getTransform();
    
    if (!canvasRect || !transform) return;
    
    const worldRect = rectFromScreenPoints(start, end, transform, canvasRect);

    // 2) Διάλεξε mode (LTR=window, RTL=crossing)
    const mode: MarqueeMode = end.x >= start.x ? 'window' : 'crossing';

    // 3) Βρες ids που ταιριάζουν
    const picked = pickEntitiesInRect(scene, worldRect, mode);

    // 4) Εφάρμοσε modifiers
    const current = new Set(selectedEntityIds ?? []);
    if (marqueeSubtractRef.current) {
      // Alt → αφαίρεση
      picked.forEach(id => current.delete(id));
    } else if (marqueeAdditiveRef.current) {
      // Ctrl/Cmd/Shift → toggle
      picked.forEach(id => current.has(id) ? current.delete(id) : current.add(id));
    } else {
      // χωρίς modifiers → αντικατάσταση
      current.clear();
      picked.forEach(id => current.add(id));
    }
    const next = Array.from(current);

    // 5) Δημοσίευση/σχεδίαση
    commitSelection(next);
  }, [selectedEntityIds, scene, commitSelection, rendererRef, setMarqueeOverlay]);

  return {
    marqueeRenderTrigger,
    marqueeOverlayRef,
    handleMarqueeMouseDown,
    handleMarqueeMouseMove,
    handleMarqueeMouseUp,
    cancelMarquee,
  };
}