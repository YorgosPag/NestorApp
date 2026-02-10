/**
 * @file Backward Compatibility Hooks
 * @module settings-provider/hooks/useBackwardCompatHooks
 *
 * ✅ ENTERPRISE: Backward compatible hooks for old API
 *
 * These hooks maintain compatibility with the old DxfSettingsProvider API.
 * They will be deprecated once all code migrates to the new enterprise API.
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-09
 */

import { useCallback } from 'react';
import { getDashArray } from '../../settings-core/defaults';
import type { LineSettings, TextSettings } from '../../settings-core/types';
import type { GripSettings } from '../../types/gripSettings';
import type { ViewerMode } from '../../settings/core/types';

/**
 * Line settings provider hook (backward compatible)
 *
 * @param getEffectiveLineSettings - Get effective line settings function
 * @param updateLineSettings - Update line settings function
 * @param resetToDefaults - Reset to defaults function
 * @param mode - Viewer mode (optional)
 * @returns Line settings provider interface
 */
export function useLineSettingsFromProvider(
  getEffectiveLineSettings: (mode?: ViewerMode) => LineSettings,
  updateLineSettings: (updates: Partial<LineSettings>) => void,
  resetToDefaults: () => void,
  mode?: ViewerMode
) {
  const effectiveSettings = getEffectiveLineSettings(mode);

  const getCurrentDashPattern = useCallback(() => {
    return getDashArray(effectiveSettings.lineType, effectiveSettings.dashScale);
  }, [effectiveSettings.lineType, effectiveSettings.dashScale]);

  return {
    settings: effectiveSettings,
    updateSettings: updateLineSettings,
    resetToDefaults,
    getCurrentDashPattern
  };
}

/**
 * Text settings provider hook (backward compatible)
 *
 * @param getEffectiveTextSettings - Get effective text settings function
 * @param updateTextSettings - Update text settings function
 * @param resetToDefaults - Reset to defaults function
 * @param mode - Viewer mode (optional)
 * @returns Text settings provider interface
 */
export function useTextSettingsFromProvider(
  getEffectiveTextSettings: (mode?: ViewerMode) => TextSettings,
  updateTextSettings: (updates: Partial<TextSettings>) => void,
  resetToDefaults: () => void,
  mode?: ViewerMode
) {
  return {
    settings: getEffectiveTextSettings(mode),
    updateSettings: updateTextSettings,
    resetToDefaults,
    resetToFactory: resetToDefaults // Alias
  };
}

/**
 * Grip settings provider hook (backward compatible)
 *
 * @param getEffectiveGripSettings - Get effective grip settings function
 * @param updateGripSettings - Update grip settings function
 * @param resetToDefaults - Reset to defaults function
 * @returns Grip settings provider interface
 */
export function useGripSettingsFromProvider(
  getEffectiveGripSettings: (mode?: ViewerMode) => GripSettings,
  updateGripSettings: (updates: Partial<GripSettings>) => void,
  resetToDefaults: () => void
) {
  return {
    settings: getEffectiveGripSettings(),
    updateSettings: updateGripSettings,
    resetToDefaults
  };
}

/**
 * Line styles hook (backward compatible)
 *
 * @param getEffectiveLineSettings - Get effective line settings function
 * @param mode - Viewer mode (optional)
 * @returns Line settings
 */
export function useLineStyles(
  getEffectiveLineSettings: (mode?: ViewerMode) => LineSettings,
  mode?: ViewerMode
) {
  return getEffectiveLineSettings(mode);
}

/**
 * Text styles hook (backward compatible)
 *
 * @param getEffectiveTextSettings - Get effective text settings function
 * @param mode - Viewer mode (optional)
 * @returns Text settings
 */
export function useTextStyles(
  getEffectiveTextSettings: (mode?: ViewerMode) => TextSettings,
  mode?: ViewerMode
) {
  return getEffectiveTextSettings(mode);
}

/**
 * Grip styles hook (backward compatible)
 *
 * @param getEffectiveGripSettings - Get effective grip settings function
 * @param mode - Viewer mode (optional)
 * @returns Grip settings
 */
export function useGripStyles(
  getEffectiveGripSettings: (mode?: ViewerMode) => GripSettings,
  mode?: ViewerMode
) {
  return getEffectiveGripSettings(mode);
}
