/**
 * Line Completion Settings Hook
 *
 * @description
 * Provides mode-specific settings for completed/final line state.
 * Includes override toggle and effective settings computation.
 */

import React from 'react';
import { useEnterpriseDxfSettings } from '../settings-provider';
import type { LineSettings } from '../settings-core/types';

export function useLineCompletionSettings() {
  const { getEffectiveLineSettings, updateSpecificLineSettings, settings } =
    useEnterpriseDxfSettings();
  const isOverrideEnabled = settings.specific?.line?.completion?.enabled ?? false;

  // ✅ ENTERPRISE: Stable dependency - depend on data, not functions
  const effectiveSettings = React.useMemo(
    () => getEffectiveLineSettings('completion'),
    [settings] // Stable dependency prevents infinite loops
  );

  return {
    settings: effectiveSettings,
    updateSettings: (updates: Partial<LineSettings>) => {
      updateSpecificLineSettings?.('completion', updates);
    },
    getEffectiveSettings: () => getEffectiveLineSettings('completion'),
    isOverrideEnabled,
    toggleOverride: (enabled: boolean) => {
      // ✅ ENTERPRISE: Type-safe - enabled is Partial<LineSettings>
      updateSpecificLineSettings?.('completion', { enabled } as Partial<LineSettings>);
    }
  };
}
