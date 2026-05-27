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
import { ZOOM_LIMITS } from '../../config/transform-config';
// ADR-040 Phase XXII.A — transform reads from SSoT (orchestrator-decoupling).
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';

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
  // ADR-040 XXII.A: `transform` param retained for signature compat; reads via SSoT.
  transform: _transform,
  setTransform,
}: UseTouchGesturesParams): void {
  void _transform;

  const handlePinchZoom = useCallback((delta: number, center: { x: number; y: number }) => {
    // ADR-040 XXII.A: live SSoT read — eliminates stale-closure on rapid pinch.
    const live = getImmediateTransform();
    const newScale = live.scale * delta;
    const clampedScale = Math.max(ZOOM_LIMITS.MIN_SCALE, Math.min(newScale, ZOOM_LIMITS.MAX_SCALE));
    setTransform({
      scale: clampedScale,
      offsetX: center.x - (center.x - live.offsetX) * (clampedScale / live.scale),
      offsetY: center.y - (center.y - live.offsetY) * (clampedScale / live.scale),
    });
  }, [setTransform]);

  const handlePan = useCallback((deltaX: number, deltaY: number) => {
    // ADR-040 XXII.A: live SSoT read.
    const live = getImmediateTransform();
    setTransform({
      scale: live.scale,
      offsetX: live.offsetX + deltaX,
      offsetY: live.offsetY + deltaY,
    });
  }, [setTransform]);

  usePinchZoom({ targetRef, enabled, onZoom: handlePinchZoom });
  useTouchPan({ targetRef, enabled, activeTool, onPan: handlePan });
}
