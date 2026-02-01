/**
 * Line Draft/Preview Settings Hook
 *
 * @description
 * Provides mode-specific settings for line drawing in draft/preview mode.
 * This is a thin wrapper around useLineSettingsByMode for backward compatibility.
 *
 * @see useLineSettingsByMode for the centralized implementation
 * @enterprise ADR-044: Line Settings Centralization
 *
 * @example
 * ```tsx
 * const { settings, updateSettings } = useLineDraftSettings();
 * ```
 */

import { useLineSettingsByMode, type UseLineSettingsReturn } from './useLineSettingsByMode';

/**
 * Hook for draft/preview line settings
 * @returns UseLineSettingsReturn with settings and update functions
 */
export function useLineDraftSettings(): UseLineSettingsReturn {
  return useLineSettingsByMode('draft');
}
