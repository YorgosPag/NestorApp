/**
 * LAYER UI SETTINGS — Factory for creating UI element settings map
 * ADR-065: Extracted from LayerRenderer.ts for SRP compliance
 */

import type { SnapSettings, GridSettings, RulerSettings, SelectionSettings, LayerRenderOptions } from './layer-types';
import type { UIElementSettings } from '../../rendering/ui/core/UIRenderer';

/** Parameters for UI settings creation */
// ADR-040 Φ10: crosshairSettings/cursorSettings removed — the canvas crosshair/cursor
// are gone (compositor <CrosshairOverlay> owns them).
interface UISettingsParams {
  // ADR-137 §Step 2: accepted for caller signature compat but no longer read here —
  // the canvas snap branch is gone (live glyph = SnapIndicatorOverlay/SVG).
  snapSettings: SnapSettings;
  gridSettings: GridSettings;
  rulerSettings: RulerSettings;
  selectionSettings: SelectionSettings;
  options: LayerRenderOptions;
}

/**
 * Create UI settings map for centralized rendering system.
 * Maps each UI element to its visibility/opacity configuration.
 */
export function createLayerUISettings(params: UISettingsParams): Map<string, UIElementSettings> {
  const {
    gridSettings,
    rulerSettings,
    selectionSettings,
    options
  } = params;

  const settings = new Map<string, UIElementSettings>();

  // Grid settings
  if (options.showGrid && gridSettings.enabled) {
    settings.set('grid', {
      ...gridSettings,
      enabled: true,
      visible: true,
      opacity: 1.0
    } as UIElementSettings);
  }

  // Ruler settings
  if (options.showRulers && rulerSettings.enabled) {
    settings.set('rulers', {
      ...rulerSettings,
      enabled: true,
      visible: true,
      opacity: 1.0
    } as UIElementSettings);
  }

  // ADR-040 Φ10: dead canvas crosshair + cursor branches removed (compositor owns them).
  // ADR-137 §Step 2: dead canvas snap branch removed (the SnapRenderer it fed is gone;
  // the live snap glyph is SnapIndicatorOverlay/SVG). `snapSettings` is no longer read here.

  // Selection settings
  if (options.showSelectionBox && options.selectionBox) {
    settings.set('selection', {
      enabled: true,
      visible: true,
      opacity: 1.0,
      ...selectionSettings
    } as UIElementSettings);
  }

  // 🏢 ADR-102: Origin Markers REMOVED from LayerRenderer
  // Origin markers are now rendered ONLY by DxfRenderer (single source of truth)

  return settings;
}
