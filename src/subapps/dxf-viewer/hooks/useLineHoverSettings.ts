/**
 * Line Hover Settings Hook
 *
 * @description
 * Provides mode-specific settings for line hover state.
 * Includes override toggle and effective settings computation.
 */

import React from 'react';
import { useEnterpriseDxfSettings } from '../settings-provider';
import type { LineSettings } from '../settings-core/types';

export function useLineHoverSettings() {
  const { getEffectiveLineSettings, updateSpecificLineSettings, settings } =
    useEnterpriseDxfSettings();
  const isOverrideEnabled = settings.specific?.line?.hover?.enabled ?? false;

  // ✅ ENTERPRISE: Stable dependency - depend on data, not functions
  const effectiveSettings = React.useMemo(
    () => getEffectiveLineSettings('normal'),
    [settings] // Stable dependency prevents infinite loops
  );

  return {
    settings: effectiveSettings, // Hover uses normal mode
    updateSettings: (updates: Partial<LineSettings>) => {
      updateSpecificLineSettings?.('hover', updates);
    },
    getEffectiveSettings: () => getEffectiveLineSettings('normal'),
    isOverrideEnabled,
    toggleOverride: (enabled: boolean) => {
      // ✅ ENTERPRISE: Type-safe - enabled is Partial<LineSettings>
      updateSpecificLineSettings?.('hover', { enabled } as Partial<LineSettings>);
    }
  };
}
