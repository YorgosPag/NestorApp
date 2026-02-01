/**
 * Line Hover Settings Hook
 *
 * @description
 * Provides mode-specific settings for line hover state.
 * This is a thin wrapper around useLineSettingsByMode for backward compatibility.
 *
 * @see useLineSettingsByMode for the centralized implementation
 * @enterprise ADR-044: Line Settings Centralization
 *
 * @example
 * ```tsx
 * const { settings, isOverrideEnabled } = useLineHoverSettings();
 * ```
 */

import { useLineSettingsByMode, type UseLineSettingsReturn } from './useLineSettingsByMode';

/**
 * Hook for line hover settings
 * @returns UseLineSettingsReturn with settings and update functions
 */
export function useLineHoverSettings(): UseLineSettingsReturn {
  return useLineSettingsByMode('hover');
}
