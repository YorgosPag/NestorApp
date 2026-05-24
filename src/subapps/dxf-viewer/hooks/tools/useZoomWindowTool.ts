/**
 * useZoomWindowTool — ADR-374 / ADR-040 compliant.
 *
 * Owner of the "ZOOM Window" tool lifecycle inside CanvasSection.
 *
 * Listens for the `zoom-window:apply` EventBus event (emitted by the mouse-up
 * handler when the user finishes the drag). Computes the fit-to-rect transform
 * via FitToViewService and applies it through `onTransformChange`. After a
 * successful zoom the tool returns to 'select' (AutoCAD ZOOM W one-shot).
 *
 * Also wires Escape to cancel a half-finished drag and exit the tool.
 *
 * ADR-040 compliance:
 *   §1 — does not call useSyncExternalStore (uses useEffect + EventBus.on /
 *        window keydown). CanvasSection orchestrator stays subscription-free.
 *   §2 — callback references stored in refs; reads are at event time.
 *   §3 — never touches dxf-bitmap-cache state.
 */
'use client';

import { useEffect, useRef } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import { FitToViewService } from '../../services/FitToViewService';
import { ZoomWindowStore } from '../../systems/zoom-window/ZoomWindowStore';
import type { ViewTransform } from '../../rendering/types/Types';

export interface UseZoomWindowToolProps {
  activeTool: string;
  onTransformChange: (transform: ViewTransform) => void;
  onToolChange?: (tool: string) => void;
}

export function useZoomWindowTool({
  activeTool,
  onTransformChange,
  onToolChange,
}: UseZoomWindowToolProps): void {
  const onTransformChangeRef = useRef(onTransformChange);
  const onToolChangeRef = useRef(onToolChange);
  onTransformChangeRef.current = onTransformChange;
  onToolChangeRef.current = onToolChange;

  // ── Apply zoom on mouse-up dispatched rect ─────────────────────────────
  useEffect(() => {
    const cleanup = EventBus.on('zoom-window:apply', (payload) => {
      const result = FitToViewService.calculateFitToViewFromBounds(
        payload.worldBounds,
        payload.viewport,
        { padding: 0.1, maxScale: 20 },
      );
      if (result.success && result.transform) {
        onTransformChangeRef.current(result.transform);
      }
      onToolChangeRef.current?.('select');
    });
    return cleanup;
  }, []);

  // ── Escape — abort drag and exit tool ───────────────────────────────────
  useEffect(() => {
    if (activeTool !== 'zoom-window') {
      ZoomWindowStore.cancel();
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      ZoomWindowStore.cancel();
      onToolChangeRef.current?.('select');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      ZoomWindowStore.cancel();
    };
  }, [activeTool]);
}
