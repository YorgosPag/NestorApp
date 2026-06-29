'use client';

/**
 * useCrosshairCursor — drive a CSS hardware-cursor crosshair on a target element (ADR-549 Phase 8).
 *
 * Sets `targetEl.style.cursor` to a crosshair SVG (see `crosshair-cursor-image`), so the OS draws
 * the crosshair on its hardware cursor plane → perfect 1:1 tracking with the mouse (like the
 * ViewCube «hand»), with NONE of the compositor-present latency a canvas/DOM crosshair has.
 *
 * The cursor IMAGE is rebuilt only on cursor-settings / aperture change (low-frequency); the OS
 * owns the per-move POSITION. Inline `style.cursor` overrides any `cursor-none` class on the target.
 * Restores the original cursor on unmount / when disabled.
 *
 * @module systems/cursor/useCrosshairCursor
 */

import { useEffect, type RefObject } from 'react';
import { getCursorSettings, subscribeToCursorSettings } from './config';
import { useGripContext } from '../../providers/GripProvider';
import { buildCrosshairCursorValue } from './crosshair-cursor-image';

export interface UseCrosshairCursorOptions {
  /** When false, the hook is inert (leaves the element's cursor untouched). Default true. */
  enabled?: boolean;
  /** Total cursor image side (CSS px, ≤128). */
  size?: number;
  /** Colour override (A/B testing). Default: the cursor-settings colour. */
  color?: string;
  /** Line-width override (A/B testing). Default: the cursor-settings line width. */
  lineWidth?: number;
}

/**
 * Apply the hardware-cursor crosshair to `targetRef`. The crosshair colour / line width / centre
 * gap come from the shared cursor settings; the centre pickbox from the grip context (aperture).
 */
export function useCrosshairCursor(
  targetRef: RefObject<HTMLElement | null>,
  { enabled = true, size, color, lineWidth }: UseCrosshairCursorOptions = {},
): void {
  const { gripSettings } = useGripContext();
  const { showAperture, apertureSize } = gripSettings;

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    if (!enabled) return;

    const apply = (): void => {
      const cross = getCursorSettings().crosshair;
      if (!cross?.enabled) {
        el.style.cursor = 'none';
        return;
      }
      el.style.cursor = buildCrosshairCursorValue({
        color: color ?? cross.color,
        lineWidth: lineWidth ?? cross.line_width || 1,
        gap: cross.use_cursor_gap ? cross.center_gap_px ?? 6 : (showAperture && apertureSize > 0 ? apertureSize / 2 + 2 : 6),
        pickbox: showAperture && apertureSize > 0 ? apertureSize : 0,
        opacity: cross.opacity ?? 1,
        size,
      });
    };

    apply();
    const unsub = subscribeToCursorSettings(apply);
    return () => {
      unsub();
      el.style.cursor = ''; // restore (class-defined cursor takes over again)
    };
  }, [targetRef, enabled, size, color, lineWidth, showAperture, apertureSize]);
}
