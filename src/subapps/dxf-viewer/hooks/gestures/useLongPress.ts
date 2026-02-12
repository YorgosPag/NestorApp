/**
 * ADR-176: Long Press Detection Hook
 *
 * Detects a long press (500ms threshold) on a target element.
 * Used as touch equivalent of right-click for context menus.
 *
 * @since 2026-02-12
 */

import { useRef, useCallback } from 'react';
import type { Point2D } from '../../rendering/types/Types';

/** Long press threshold in ms */
const LONG_PRESS_THRESHOLD_MS = 500;

/** Maximum movement allowed during long press (pixels) */
const LONG_PRESS_MOVE_TOLERANCE = 10;

interface UseLongPressOptions {
  /** Callback when long press is detected */
  onLongPress: (position: Point2D) => void;
  /** Whether long press detection is enabled */
  enabled?: boolean;
  /** Threshold in ms (default: 500) */
  threshold?: number;
}

interface UseLongPressReturn {
  /** Attach to onPointerDown */
  onPointerDown: (e: React.PointerEvent) => void;
  /** Attach to onPointerUp */
  onPointerUp: () => void;
  /** Attach to onPointerMove */
  onPointerMove: (e: React.PointerEvent) => void;
  /** Attach to onPointerCancel */
  onPointerCancel: () => void;
}

export function useLongPress({
  onLongPress,
  enabled = true,
  threshold = LONG_PRESS_THRESHOLD_MS,
}: UseLongPressOptions): UseLongPressReturn {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<Point2D | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabled) return;
    // Only track primary pointer (single finger)
    if (!e.isPrimary) return;

    const pos: Point2D = { x: e.clientX, y: e.clientY };
    startPosRef.current = pos;

    timerRef.current = setTimeout(() => {
      onLongPress(pos);
      timerRef.current = null;
    }, threshold);
  }, [enabled, onLongPress, threshold]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!startPosRef.current || !timerRef.current) return;

    // Cancel if finger moved too far
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_MOVE_TOLERANCE) {
      cancel();
    }
  }, [cancel]);

  return {
    onPointerDown,
    onPointerUp: cancel,
    onPointerMove,
    onPointerCancel: cancel,
  };
}
