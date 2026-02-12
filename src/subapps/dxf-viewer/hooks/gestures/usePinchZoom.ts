/**
 * ADR-176: Pinch-to-Zoom Touch Gesture
 *
 * Tracks two active pointers on a target element.
 * When distance between pointers changes, fires a synthetic zoom event.
 * The midpoint between fingers becomes the zoom center.
 *
 * @since 2026-02-12
 */

import { useEffect, useRef, useCallback } from 'react';
import type { Point2D } from '../../rendering/types/Types';

interface PinchZoomOptions {
  /** Ref to the target element (canvas container) */
  targetRef: React.RefObject<HTMLElement | null>;
  /** Whether pinch-zoom is enabled */
  enabled: boolean;
  /** Callback when zoom changes: delta > 1 = zoom in, < 1 = zoom out */
  onZoom: (delta: number, center: Point2D) => void;
}

/** Active pointer tracking */
interface PointerState {
  id: number;
  x: number;
  y: number;
}

/** Calculate Euclidean distance between two points */
function pointerDistance(a: PointerState, b: PointerState): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Calculate midpoint between two pointers */
function pointerMidpoint(a: PointerState, b: PointerState): Point2D {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

export function usePinchZoom({ targetRef, enabled, onZoom }: PinchZoomOptions): void {
  // Active pointers map — max 2 for pinch
  const pointersRef = useRef<Map<number, PointerState>>(new Map());
  const prevDistRef = useRef<number | null>(null);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    if (pointersRef.current.size >= 2) return;
    pointersRef.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const pointers = pointersRef.current;
    if (!pointers.has(e.pointerId)) return;

    // Update pointer position
    pointers.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });

    // Need exactly 2 pointers for pinch
    if (pointers.size !== 2) return;

    const [a, b] = Array.from(pointers.values());
    const currentDist = pointerDistance(a, b);
    const center = pointerMidpoint(a, b);

    if (prevDistRef.current !== null && prevDistRef.current > 0) {
      const delta = currentDist / prevDistRef.current;
      // Only fire if meaningful change (avoid noise)
      if (Math.abs(delta - 1) > 0.01) {
        onZoom(delta, center);
      }
    }

    prevDistRef.current = currentDist;
  }, [onZoom]);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      prevDistRef.current = null;
    }
  }, []);

  useEffect(() => {
    const el = targetRef.current;
    if (!el || !enabled) return;

    el.addEventListener('pointerdown', handlePointerDown, { passive: true });
    el.addEventListener('pointermove', handlePointerMove, { passive: true });
    el.addEventListener('pointerup', handlePointerUp, { passive: true });
    el.addEventListener('pointercancel', handlePointerUp, { passive: true });

    return () => {
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
      el.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [targetRef, enabled, handlePointerDown, handlePointerMove, handlePointerUp]);
}
