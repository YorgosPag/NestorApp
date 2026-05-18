/**
 * TRACKING COLORS — ADR-357 §5.3 (Object Snap Tracking visual feedback)
 *
 * Adaptive theme-aware palette for acquired markers, alignment paths, and
 * intersection highlights. Dark theme = AutoCAD-style neon; light theme =
 * design-system deep contrast (WCAG AA ≥ 4.5:1 against canvas background).
 *
 * SSoT for ALL Phase 4 tracking visuals (PreviewRenderer + future leaves).
 * No CanvasThemeContext exists yet — theme is detected via the Tailwind
 * `dark` class on the document root (consistent with the rest of the app).
 */

export type TrackingTheme = 'dark' | 'light';

export interface TrackingPalette {
  /** Alignment path stroke (dashed) — H/V/polar from acquired points. */
  readonly alignmentPath: string;
  /** Acquired marker `+` color (≥1000ms hover or Shift+click). */
  readonly acquiredMarker: string;
  /** Intersection circle stroke (path × path = priority 1 snap candidate). */
  readonly intersectionStroke: string;
  /** Intersection circle fill (translucent halo). */
  readonly intersectionFill: string;
  /** Tooltip text color (label "@45° / 125.0"). */
  readonly tooltipText: string;
  /** Tooltip background backdrop (semi-transparent). */
  readonly tooltipBackground: string;
}

const DARK_PALETTE: TrackingPalette = {
  alignmentPath: '#00FF00',
  acquiredMarker: '#FFFF00',
  intersectionStroke: '#00FF00',
  intersectionFill: 'rgba(0, 255, 0, 0.18)',
  tooltipText: '#FFFF00',
  tooltipBackground: 'rgba(0, 0, 0, 0.65)',
};

const LIGHT_PALETTE: TrackingPalette = {
  alignmentPath: '#15803D',
  acquiredMarker: '#EA580C',
  intersectionStroke: '#15803D',
  intersectionFill: 'rgba(21, 128, 61, 0.18)',
  tooltipText: '#15803D',
  tooltipBackground: 'rgba(255, 255, 255, 0.85)',
};

/** Detect the active canvas theme from the document root (Tailwind convention). */
export function detectTrackingTheme(): TrackingTheme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function getTrackingPalette(theme: TrackingTheme): TrackingPalette {
  return theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
}

/** Convenience: palette resolved from the current document theme. */
export function getCurrentTrackingPalette(): TrackingPalette {
  return getTrackingPalette(detectTrackingTheme());
}
