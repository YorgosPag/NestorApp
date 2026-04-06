/**
 * LAYER UI SETTINGS — Factory for creating UI element settings map
 * ADR-065: Extracted from LayerRenderer.ts for SRP compliance
 */

import type { CrosshairSettings } from '../../rendering/ui/crosshair/CrosshairTypes';
import type { CursorSettings } from '../../systems/cursor/config';
import type { SnapSettings, GridSettings, RulerSettings, SelectionSettings, LayerRenderOptions } from './layer-types';
import type { UIElementSettings } from '../../rendering/ui/core/UIRenderer';

/** Parameters for UI settings creation */
interface UISettingsParams {
  crosshairSettings: CrosshairSettings;
  cursorSettings: CursorSettings;
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
    crosshairSettings,
    cursorSettings,
    snapSettings,
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

  // Crosshair settings
  if (options.showCrosshair && crosshairSettings.enabled && options.crosshairPosition) {
    settings.set('crosshair', {
      ...crosshairSettings,
      enabled: true,
      visible: true,
      opacity: 1.0
    } as UIElementSettings);
  }

  // Cursor settings
  if (options.showCursor && cursorSettings.cursor.enabled && options.cursorPosition) {
    settings.set('cursor', {
      ...cursorSettings,
      enabled: true,
      visible: true,
      opacity: 1.0
    } as UIElementSettings);
  }

  // Snap settings
  if (options.showSnapIndicators && snapSettings.enabled && options.snapResults?.length) {
    settings.set('snap', {
      ...snapSettings,
      enabled: true,
      visible: true,
      opacity: 1.0
    } as UIElementSettings);
  }

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
