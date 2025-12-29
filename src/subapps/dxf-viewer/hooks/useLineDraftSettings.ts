/**
 * Line Draft/Preview Settings Hook
 *
 * @description
 * Provides mode-specific settings for line drawing in draft/preview mode.
 * Includes override toggle and effective settings computation.
 *
 * @example
 * ```tsx
 * const { settings, updateSettings } = useLineDraftSettings();
 * ```
 */

import React from 'react';
import { useEnterpriseDxfSettings } from '../settings-provider';
import type { LineSettings } from '../settings-core/types';

export function useLineDraftSettings() {
  const { getEffectiveLineSettings, updateSpecificLineSettings, toggleLineOverride, settings } =
    useEnterpriseDxfSettings();
  const isOverrideEnabled = settings.overrideEnabled?.line?.draft ?? false;

  // ✅ ENTERPRISE: Stable dependency - depend on data, not functions
  const effectiveSettings = React.useMemo(
    () => getEffectiveLineSettings('preview'),
    [settings] // Stable dependency prevents infinite loops
  );

  return {
    settings: effectiveSettings,
    updateSettings: (updates: Partial<LineSettings>) => {
      updateSpecificLineSettings?.('draft', updates);
    },
    getEffectiveSettings: () => getEffectiveLineSettings('preview'),
    isOverrideEnabled,
    toggleOverride: (enabled: boolean) => {
      toggleLineOverride('draft', enabled);
    }
  };
}
