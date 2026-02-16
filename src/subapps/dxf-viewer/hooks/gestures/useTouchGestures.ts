/**
 * ADR-176: Unified Touch Gestures — Pinch Zoom + Pan
 *
 * Combines usePinchZoom and useTouchPan into a single hook for CanvasSection.
 * Encapsulates the transform math (zoom around center, pan offset).
 */

import { useCallback } from 'react';
import { usePinchZoom } from './usePinchZoom';
import { useTouchPan } from './useTouchPan';
import type { ViewTransform } from '../../rendering/types/Types';

export interface UseTouchGesturesParams {
  targetRef: React.RefObject<HTMLElement | null>;
  enabled: boolean;
  activeTool: string;
  transform: ViewTransform;
  setTransform: (t: ViewTransform) => void;
}

export function useTouchGestures({
  targetRef,
  enabled,
  activeTool,
  transform,
  setTransform,
}: UseTouchGesturesParams): void {

  const handlePinchZoom = useCallback((delta: number, center: { x: number; y: number }) => {
    const newScale = transform.scale * delta;
    const clampedScale = Math.max(0.01, Math.min(newScale, 1000));
    setTransform({
      scale: clampedScale,
      offsetX: center.x - (center.x - transform.offsetX) * (clampedScale / transform.scale),
      offsetY: center.y - (center.y - transform.offsetY) * (clampedScale / transform.scale),
    });
  }, [transform, setTransform]);

  const handlePan = useCallback((deltaX: number, deltaY: number) => {
    setTransform({
      scale: transform.scale,
      offsetX: transform.offsetX + deltaX,
      offsetY: transform.offsetY + deltaY,
    });
  }, [transform, setTransform]);

  usePinchZoom({ targetRef, enabled, onZoom: handlePinchZoom });
  useTouchPan({ targetRef, enabled, activeTool, onPan: handlePan });
}
