// ⚠️ ADR-040 helper — pure DXF-canvas ruler-settings builder extracted from
// CanvasLayerStack.tsx to keep the shell under the 500-line Google SRP limit
// (N.7.1). No subscriptions, no React — a straight mapping from the global
// ruler settings to the DxfCanvas ruler config. Memoized by the caller.
import { RULERS_GRID_CONFIG } from '../../systems/rulers-grid/config';
import { UI_COLORS } from '../../config/color-config';
import type { RulerSettings as GlobalRulerSettings } from '../../systems/rulers-grid/config';

/**
 * Build the DxfCanvas ruler settings object from the global ruler settings.
 *
 * @param g            The global ruler settings (settings.globalRuler).
 * @param tickInterval The major-tick interval in world units (gridSize × majorInterval).
 */
export function buildDxfRulerSettings(g: GlobalRulerSettings, tickInterval: number) {
  return {
    enabled: (g?.horizontal?.enabled && g?.vertical?.enabled) ?? true,
    visible: true,
    opacity: 1.0,
    unit: g.units as 'mm' | 'cm' | 'm',
    color: g.horizontal.color,
    backgroundColor: g.horizontal.backgroundColor,
    fontSize: g.horizontal.fontSize,
    textColor: g.horizontal.textColor,
    height: g.horizontal.height ?? RULERS_GRID_CONFIG.DEFAULT_RULER_HEIGHT,
    width: g.vertical.width ?? RULERS_GRID_CONFIG.DEFAULT_RULER_WIDTH,
    showLabels: g.horizontal.showLabels,
    showUnits: g.horizontal.showUnits,
    showBackground: g.horizontal.showBackground,
    showMajorTicks: g.horizontal.showMajorTicks,
    showMinorTicks: true,
    majorTickColor: g.horizontal.color,
    minorTickColor: UI_COLORS.BUTTON_SECONDARY,
    majorTickLength: 10,
    minorTickLength: 5,
    tickInterval,
    unitsFontSize: 10,
    unitsColor: g.horizontal.textColor,
    labelPrecision: 1,
    borderColor: g.horizontal.borderColor,
    borderWidth: g.horizontal.borderWidth,
  };
}
