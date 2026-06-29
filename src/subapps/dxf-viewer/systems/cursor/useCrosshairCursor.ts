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
import { isCrosshairSuppressed, subscribeCrosshairSuppression } from './CrosshairSuppressionStore';
import { buildCrosshairCursorValue } from './crosshair-cursor-image';

/**
 * Σταθερή διάσταση (CSS px) του κεντρικού τετραγωνιδίου (pickbox) στο σταυρόνημα — αίτημα Giorgio.
 * Αποσυνδεδεμένο από το osnap `apertureSize` (ανοχή έλξης, ρυθμιζόμενη ≥8): το οπτικό κουτί του
 * κέρσορα είναι πάντα 7×7. Ο toggle `showAperture` εξακολουθεί να το δείχνει/κρύβει.
 */
const CURSOR_PICKBOX_PX = 7;

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
  // Default 32px: browser-verified to render in Chrome (larger images can be silently rejected →
  // the whole `cursor` declaration drops and the `cursor-none` class wins ⇒ no cursor at all).
  { enabled = true, size = 32, color, lineWidth }: UseCrosshairCursorOptions = {},
): void {
  const { gripSettings } = useGripContext();
  const { showAperture } = gripSettings;

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let el: HTMLElement | null = null;
    let unsubSettings: () => void = () => {};
    let unsubSuppress: () => void = () => {};

    const apply = (): void => {
      if (!el) return;
      const cross = getCursorSettings().crosshair;
      // ADR-513 — πάνω στα πλήκτρα του «Δαχτυλιδιού Εντολών» (NavWheel) δείξε κανονικό δείκτη
      // ώστε ο χρήστης να μπορεί να κλικάρει τα πλήκτρα (το σταυρόνημα «εξαφανίζεται»).
      if (isCrosshairSuppressed()) {
        el.style.cursor = 'default';
        return;
      }
      if (!cross?.enabled) {
        el.style.cursor = 'none';
        return;
      }
      // Κεντρικό τετραγωνάκι σταθερά 7×7 px· κρύβεται όταν `showAperture` = false.
      const pickbox = showAperture ? CURSOR_PICKBOX_PX : 0;
      el.style.cursor = buildCrosshairCursorValue({
        color: color ?? cross.color ?? '#ffffff',
        lineWidth: lineWidth ?? (cross.line_width || 1),
        // Κενό γύρω από το κέντρο = μισό κουτί + 2px, ώστε οι βραχίονες να μην ακουμπούν το κουτί.
        gap: cross.use_cursor_gap ? (cross.center_gap_px ?? 6) : (pickbox > 0 ? pickbox / 2 + 2 : 6),
        pickbox,
        opacity: cross.opacity ?? 1,
        size,
      });
    };

    // The target element may not exist yet: the host returns null until its viewport becomes visible
    // (e.g. BimViewport3D `if (!effectiveVisible) return null`), and a ref assignment does NOT re-fire
    // this effect. So poll until the element mounts, then attach + subscribe ONCE.
    const attach = (): void => {
      el = targetRef.current;
      if (!el) {
        timer = setTimeout(attach, 120);
        return;
      }
      apply();
      unsubSettings = subscribeToCursorSettings(apply);
      unsubSuppress = subscribeCrosshairSuppression(apply); // ADR-513
    };
    attach();

    return () => {
      if (timer) clearTimeout(timer);
      unsubSettings();
      unsubSuppress();
      if (el) el.style.cursor = ''; // restore (class-defined cursor takes over again)
    };
  }, [targetRef, enabled, size, color, lineWidth, showAperture]);
}
