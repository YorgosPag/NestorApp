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
 * Also wires Escape to cancel a half-finished drag and exit the tool — through the
 * central EscapeCommandBus (ADR-364 §10.14), not a private window listener.
 *
 * ADR-040 compliance:
 *   §1 — does not call useSyncExternalStore (uses useEffect + EventBus.on /
 *        an ESC bus slot). CanvasSection orchestrator stays subscription-free.
 *   §2 — callback references stored in refs; reads are at event time.
 *   §3 — never touches dxf-bitmap-cache state.
 */
'use client';

import { useEffect, useRef } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import { FitToViewService } from '../../services/FitToViewService';
import { ZoomWindowStore } from '../../systems/zoom-window/ZoomWindowStore';
import { UI_ZOOM_LIMITS } from '../../config/transform-config';
// ADR-364 — Escape Command Bus SSoT (no private window keydown listener)
import { useEscapeHandler, ESC_PRIORITY } from '../../systems/escape-bus';
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
      // AutoCAD ZOOM W: το rect γεμίζει την οθόνη ανεξάρτητα από scale.
      // maxScale must match wheel-zoom upper bound (UI_ZOOM_LIMITS.MAX_SCALE = 10000),
      // otherwise small rects clamp at 20× and the user "loses" zoom mid-way.
      const result = FitToViewService.calculateFitToViewFromBounds(
        payload.worldBounds,
        payload.viewport,
        { padding: 0.1, maxScale: UI_ZOOM_LIMITS.MAX_SCALE, minScale: UI_ZOOM_LIMITS.MIN_SCALE },
      );
      if (result.success && result.transform) {
        onTransformChangeRef.current(result.transform);
      }
      onToolChangeRef.current?.('select');
    });
    return cleanup;
  }, []);

  // ── Tool deactivation — always drop a half-finished rect ────────────────
  // Unchanged behaviour, minus the ESC listener (see the bus registration below):
  // leaving the tool by ANY route (toolbar click, another shortcut, unmount) must
  // not leave a stale rectangle in the store.
  useEffect(() => {
    if (activeTool !== 'zoom-window') {
      ZoomWindowStore.cancel();
      return;
    }
    return () => { ZoomWindowStore.cancel(); };
  }, [activeTool]);

  // ── ESC — abort drag and exit tool (ADR-364 §10.14, Κ2 #11) ─────────────
  // Was a private `window` keydown listener — Zone-A, invisible to the bus and to
  // `stopImmediatePropagation`, so it fired even when a higher context had already
  // claimed the press.
  //
  // Its own slot rather than DRAW_TOOL: see the ZOOM_WINDOW_TOOL doc in
  // `escape-priority.ts` for why widening `isInteractiveTool` would be wrong.
  useEscapeHandler({
    id: 'tools/zoom-window',
    priority: ESC_PRIORITY.ZOOM_WINDOW_TOOL,
    canHandle: () => activeTool === 'zoom-window',
    handle: () => {
      ZoomWindowStore.cancel();
      onToolChangeRef.current?.('select');
      return true;
    },
  });
}
