/**
 * Factory Hook για Line Settings by Mode
 *
 * @description
 * Κεντρικοποιημένο hook που παρέχει mode-specific line settings.
 * Αντικαθιστά τα 4 διάσπαρτα hooks (Draft/Hover/Selection/Completion).
 *
 * @example
 * ```tsx
 * // Direct usage
 * const { settings, updateSettings } = useLineSettingsByMode('draft');
 *
 * // Or via legacy wrappers (backward compatible)
 * const { settings } = useLineDraftSettings();
 * ```
 *
 * @enterprise ADR-044: Line Settings Centralization
 * @since 2026-02-01
 */

import * as React from 'react';
import { useEnterpriseDxfSettings } from '../settings-provider';
import type { LineSettings, ViewerMode } from '../settings-core/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Available line settings modes
 */
export type LineSettingsMode = 'draft' | 'hover' | 'selection' | 'completion';

/**
 * Return type for useLineSettingsByMode hook
 */
export interface UseLineSettingsReturn {
  /** Current effective settings for the mode */
  settings: LineSettings;
  /** Update settings for the specific mode */
  updateSettings: (updates: Partial<LineSettings>) => void;
  /** Get current effective settings (useful for callbacks) */
  getEffectiveSettings: () => LineSettings;
  /** Whether override is enabled for this mode */
  isOverrideEnabled: boolean;
  /** Toggle override for this mode */
  toggleOverride: (enabled: boolean) => void;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Maps each mode to its effective settings mode for getEffectiveLineSettings
 *
 * - draft → preview (draft lines use preview appearance)
 * - hover → normal (hover uses normal appearance as base)
 * - selection → normal (selection uses normal appearance as base)
 * - completion → completion (completed lines use completion appearance)
 */
const EFFECTIVE_MODE_MAP: Record<LineSettingsMode, ViewerMode> = {
  draft: 'preview',
  hover: 'normal',
  selection: 'normal',
  completion: 'completion',
} as const;

// ============================================================================
// FACTORY HOOK
// ============================================================================

/**
 * Factory hook for mode-specific line settings
 *
 * @param mode - The line settings mode ('draft' | 'hover' | 'selection' | 'completion')
 * @returns UseLineSettingsReturn with settings and update functions
 *
 * @example
 * ```tsx
 * function LinePreview() {
 *   const { settings, isOverrideEnabled, toggleOverride } = useLineSettingsByMode('draft');
 *
 *   return (
 *     <line
 *       stroke={settings.color}
 *       strokeWidth={settings.thickness}
 *     />
 *   );
 * }
 * ```
 */
export function useLineSettingsByMode(mode: LineSettingsMode): UseLineSettingsReturn {
  const {
    getEffectiveLineSettings,
    updateSpecificLineSettings,
    toggleLineOverride,
    settings,
  } = useEnterpriseDxfSettings();

  // Get override status for this specific mode
  const isOverrideEnabled = settings.overrideEnabled?.line?.[mode] ?? false;

  // Get the effective mode for settings lookup
  const effectiveMode = EFFECTIVE_MODE_MAP[mode];

  // ✅ ENTERPRISE: Stable dependency - depend on data, not functions
  // This prevents infinite loops by depending ONLY on settings object
  // DO NOT add getEffectiveLineSettings to dependencies - it causes infinite loops!
  const effectiveSettings = React.useMemo(
    () => getEffectiveLineSettings(effectiveMode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings] // Stable dependency prevents infinite loops
  );

  // Return object - not memoized to match original hook behavior
  return {
    settings: effectiveSettings,
    updateSettings: (updates: Partial<LineSettings>) => {
      updateSpecificLineSettings?.(mode, updates);
    },
    getEffectiveSettings: () => getEffectiveLineSettings(effectiveMode),
    isOverrideEnabled,
    toggleOverride: (enabled: boolean) => {
      toggleLineOverride(mode, enabled);
    },
  };
}
