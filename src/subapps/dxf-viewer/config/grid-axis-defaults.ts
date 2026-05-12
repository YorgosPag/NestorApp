/**
 * GRID AXIS DEFAULTS — Single Source of Truth
 *
 * Every layer that needs axis/origin defaults imports from here.
 * Layers: rendering (GridTypes), state (rulers-grid/config), canvas settings, adapters.
 *
 * @module config/grid-axis-defaults
 */

import { UI_COLORS } from './color-config';

/**
 * Canonical defaults for X/Y axis lines and origin marker.
 * Axes OFF by default — infinite lines across canvas are distracting in a CAD viewer.
 * Origin crosshair ON — user always needs to know where (0,0) is.
 */
export const GRID_AXES_DEFAULTS = {
  showAxes: false,
  showOrigin: true,
  axesColor: UI_COLORS.RULER_DARK_GRAY,
  axesWeight: 2,
} as const;
