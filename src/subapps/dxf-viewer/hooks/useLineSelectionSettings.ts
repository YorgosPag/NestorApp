/**
 * Line Selection Settings Hook
 *
 * @description
 * Provides mode-specific settings for selected line state.
 * This is a thin wrapper around useLineSettingsByMode for backward compatibility.
 *
 * @see useLineSettingsByMode for the centralized implementation
 * @enterprise ADR-044: Line Settings Centralization
 *
 * @example
 * ```tsx
 * const { settings, toggleOverride } = useLineSelectionSettings();
 * ```
 */

import { useLineSettingsByMode, type UseLineSettingsReturn } from './useLineSettingsByMode';

/**
 * Hook for line selection settings
 * @returns UseLineSettingsReturn with settings and update functions
 */
export function useLineSelectionSettings(): UseLineSettingsReturn {
  return useLineSettingsByMode('selection');
}
