/**
 * Grip Draft/Preview Settings Hook
 *
 * @description
 * Provides mode-specific settings for grip rendering in draft/preview mode.
 * Includes override toggle and effective settings computation.
 */

import React from 'react';
import { useEnterpriseDxfSettings } from '../settings-provider';
import type { GripSettings } from '../types/gripSettings';

export function useGripDraftSettings() {
  const { getEffectiveGripSettings, updateSpecificGripSettings, settings } =
    useEnterpriseDxfSettings();
  const isOverrideEnabled = settings.specific?.grip?.draft?.enabled ?? false;

  // ✅ ENTERPRISE: Stable dependency - depend on data, not functions
  const effectiveSettings = React.useMemo(
    () => getEffectiveGripSettings('preview'),
    [settings] // Stable dependency prevents infinite loops
  );

  return {
    settings: effectiveSettings,
    updateSettings: (updates: Partial<GripSettings>) => {
      updateSpecificGripSettings?.('draft', updates);
    },
    getEffectiveSettings: () => getEffectiveGripSettings('preview'),
    isOverrideEnabled,
    toggleOverride: (enabled: boolean) => {
      // ✅ ENTERPRISE: Type-safe - enabled is Partial<GripSettings>
      updateSpecificGripSettings?.('draft', { enabled } as Partial<GripSettings>);
    }
  };
}
