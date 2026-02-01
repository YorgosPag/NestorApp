/**
 * Line Completion Settings Hook
 *
 * @description
 * Provides mode-specific settings for completed/final line state.
 * This is a thin wrapper around useLineSettingsByMode for backward compatibility.
 *
 * @see useLineSettingsByMode for the centralized implementation
 * @enterprise ADR-044: Line Settings Centralization
 *
 * @example
 * ```tsx
 * const { settings, getEffectiveSettings } = useLineCompletionSettings();
 * ```
 */

import { useLineSettingsByMode, type UseLineSettingsReturn } from './useLineSettingsByMode';

/**
 * Hook for line completion settings
 * @returns UseLineSettingsReturn with settings and update functions
 */
export function useLineCompletionSettings(): UseLineSettingsReturn {
  return useLineSettingsByMode('completion');
}
