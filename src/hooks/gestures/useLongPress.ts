/**
 * Long-press detection (ADR-176) — the touch equivalent of «hover» / right-click: a primary pointer held still for
 * `threshold` ms. Shared platform hook: promoted from `subapps/dxf-viewer/hooks/gestures/useLongPress.ts` (now a shim)
 * when the listing terrain inspector (ADR-920 §14.10) needed the same gesture outside the viewer (CHECK 3.62).
 *
 * @module hooks/gestures/useLongPress
 */

import { useCallback, useRef } from 'react';

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';

/** Platform default: half a second (iOS / Android long-press convention). */
const LONG_PRESS_THRESHOLD_MS = 500;

/** Maximum finger travel while holding, css px — beyond it the gesture is a drag, not a press. */
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

export interface UseLongPressOptions {
  /** Called once, when the press has been held long enough (client coordinates of the press). */
  readonly onLongPress: (position: PlanarPoint) => void;
  readonly enabled?: boolean;
  readonly threshold?: number;
}

export interface UseLongPressReturn {
  readonly onPointerDown: (e: React.PointerEvent) => void;
  readonly onPointerUp: () => void;
  readonly onPointerMove: (e: React.PointerEvent) => void;
  readonly onPointerCancel: () => void;
}

export function useLongPress({
  onLongPress,
  enabled = true,
  threshold = LONG_PRESS_THRESHOLD_MS,
}: UseLongPressOptions): UseLongPressReturn {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<PlanarPoint | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabled || !e.isPrimary) return;
    const pos: PlanarPoint = { x: e.clientX, y: e.clientY };
    startPosRef.current = pos;
    timerRef.current = setTimeout(() => {
      onLongPress(pos);
      timerRef.current = null;
    }, threshold);
  }, [enabled, onLongPress, threshold]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!startPosRef.current || !timerRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE_PX) cancel();
  }, [cancel]);

  return { onPointerDown, onPointerUp: cancel, onPointerMove, onPointerCancel: cancel };
}
