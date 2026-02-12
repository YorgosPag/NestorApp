/**
 * ADR-176: Touch Pan Gesture
 *
 * - Single-finger drag → pan (when Pan tool is active)
 * - Two-finger drag → pan (always, regardless of tool)
 *
 * Updates canvas transform via the existing transform change handler.
 *
 * @since 2026-02-12
 */

import { useEffect, useRef, useCallback } from 'react';
import type { Point2D } from '../../rendering/types/Types';

interface TouchPanOptions {
  /** Ref to the target element (canvas container) */
  targetRef: React.RefObject<HTMLElement | null>;
  /** Whether touch pan is enabled (false on desktop) */
  enabled: boolean;
  /** Current active tool name */
  activeTool: string;
  /** Callback to apply pan delta to the transform */
  onPan: (deltaX: number, deltaY: number) => void;
}

export function useTouchPan({ targetRef, enabled, activeTool, onPan }: TouchPanOptions): void {
  const lastTouchRef = useRef<Point2D | null>(null);
  const pointerCountRef = useRef(0);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    pointerCountRef.current++;

    // Start tracking pan when:
    // - Two fingers (always)
    // - Single finger + Pan tool active
    const shouldPan = pointerCountRef.current >= 2 || activeTool === 'pan';

    if (shouldPan && pointerCountRef.current <= 2) {
      lastTouchRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [activeTool]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!lastTouchRef.current) return;

    // Only pan with single finger when Pan tool active, or always with 2+ fingers
    if (pointerCountRef.current === 1 && activeTool !== 'pan') return;

    const deltaX = e.clientX - lastTouchRef.current.x;
    const deltaY = e.clientY - lastTouchRef.current.y;

    // Only fire if meaningful movement (>1px)
    if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
      onPan(deltaX, deltaY);
      lastTouchRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [activeTool, onPan]);

  const handlePointerUp = useCallback(() => {
    pointerCountRef.current = Math.max(0, pointerCountRef.current - 1);
    if (pointerCountRef.current === 0) {
      lastTouchRef.current = null;
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
