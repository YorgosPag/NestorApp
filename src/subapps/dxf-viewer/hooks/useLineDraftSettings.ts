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
  const { getEffectiveLineSettings, updateSpecificLineSettings, settings } =
    useEnterpriseDxfSettings();
  const isOverrideEnabled = settings.specific?.line?.draft?.enabled ?? false;

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
      // ✅ ENTERPRISE: Type-safe - enabled is Partial<LineSettings>
      updateSpecificLineSettings?.('draft', { enabled } as Partial<LineSettings>);
    }
  };
}
