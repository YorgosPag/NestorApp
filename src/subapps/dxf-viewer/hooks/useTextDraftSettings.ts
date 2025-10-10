/**
 * Text Draft/Preview Settings Hook
 *
 * @description
 * Provides mode-specific settings for text rendering in draft/preview mode.
 * Includes override toggle and effective settings computation.
 */

import React from 'react';
import { useEnterpriseDxfSettings } from '../settings-provider';
import type { TextSettings } from '../contexts/TextSettingsContext';

export function useTextDraftSettings() {
  const { getEffectiveTextSettings, updateSpecificTextSettings, settings } =
    useEnterpriseDxfSettings();
  const isOverrideEnabled = settings.specific?.text?.draft?.enabled ?? false;

  // ✅ ENTERPRISE: Stable dependency - depend on data, not functions
  const effectiveSettings = React.useMemo(
    () => getEffectiveTextSettings('preview'),
    [settings] // Stable dependency prevents infinite loops
  );

  return {
    settings: effectiveSettings,
    updateSettings: (updates: Partial<TextSettings>) => {
      updateSpecificTextSettings?.('draft', updates);
    },
    getEffectiveSettings: () => getEffectiveTextSettings('preview'),
    isOverrideEnabled,
    toggleOverride: (enabled: boolean) => {
      // ✅ ENTERPRISE: Type-safe - enabled is Partial<TextSettings>
      updateSpecificTextSettings?.('draft', { enabled } as Partial<TextSettings>);
    }
  };
}
