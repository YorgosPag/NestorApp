/**
 * useCanvasZoomWindow — ADR-374 / ADR-040.
 *
 * Thin wiring hook extracted from CanvasSection to keep the orchestrator under
 * the 500-line budget (N.7.1). Owns the combined transform handler for the ZOOM
 * Window tool: it MUST mirror CanvasLayerStack.handleTransformChange — a bare
 * `setTransform` leaves `zoomSystem` with a stale internal transform, so the next
 * wheel zoom computes from the pre-zoom-window state and snaps the drawing away.
 *
 * ADR-040 compliance: adds no store subscription — only composes `setTransform`
 * with `zoomSystem.setTransform` and forwards to `useZoomWindowTool` (which is
 * itself subscription-free).
 */
'use client';

import { useCallback } from 'react';
import { useZoomWindowTool } from '../tools/useZoomWindowTool';
import type { ViewTransform } from '../../rendering/types/Types';

export interface UseCanvasZoomWindowProps {
  activeTool: string;
  setTransform: (transform: ViewTransform) => void;
  zoomSystem: { setTransform: (transform: ViewTransform) => void };
  onToolChange?: (tool: string) => void;
}

export function useCanvasZoomWindow({
  activeTool,
  setTransform,
  zoomSystem,
  onToolChange,
}: UseCanvasZoomWindowProps): void {
  const handleZoomWindowTransform = useCallback(
    (newTransform: ViewTransform) => {
      setTransform(newTransform);
      zoomSystem.setTransform(newTransform);
    },
    [setTransform, zoomSystem],
  );
  useZoomWindowTool({ activeTool, onTransformChange: handleZoomWindowTransform, onToolChange });
}
