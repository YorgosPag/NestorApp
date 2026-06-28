/**
 * @file enterprise-settings-hooks - Consumer hooks for the settings contexts
 * @module settings-provider/enterprise-settings-hooks
 *
 * ✅ ENTERPRISE: Single Responsibility — read-side hooks over the settings
 * contexts. Split out of `EnterpriseDxfSettingsProvider.tsx` 2026-06-28 (N.7.1
 * file-size). The provider re-exports everything here, so existing imports from
 * `EnterpriseDxfSettingsProvider` keep working unchanged.
 */

import { useContext } from 'react';

import { ENTERPRISE_CONSTANTS } from './constants';
import { derr } from '../debug/utils/devlog';

import type { ViewerMode } from '../settings/core/types';
import type { LineSettings, TextSettings } from '../settings-core/types';
import type { GripSettings } from '../types/gripSettings';

import {
  EnterpriseDxfSettingsContext,
  SettingsSaveStatusContext,
  type EnterpriseDxfSettingsContextType,
  type SettingsSaveStatusValue,
} from './enterprise-settings-context';

// ============================================================================
// CORE HOOKS
// ============================================================================

/**
 * Access enterprise settings context
 *
 * @throws Error if used outside EnterpriseDxfSettingsProvider
 */
export function useEnterpriseDxfSettings(): EnterpriseDxfSettingsContextType {
  const context = useContext(EnterpriseDxfSettingsContext);

  if (!context) {
    derr('[Enterprise] useEnterpriseDxfSettings called outside provider context!');
    console.trace('[Enterprise] Call stack:');
    throw new Error(
      'useEnterpriseDxfSettings must be used within EnterpriseDxfSettingsProvider'
    );
  }

  return context;
}

/**
 * Optional access - does not throw error if provider is missing
 */
export function useEnterpriseDxfSettingsOptional(): EnterpriseDxfSettingsContextType | null {
  return useContext(EnterpriseDxfSettingsContext);
}

/**
 * ADR-341 perf — access the volatile autosave status (split out of the main
 * settings context). Subscribing here re-renders ONLY on a save-status change,
 * not on every settings edit. Optional variant returns `null` when the provider
 * is absent/disabled (mirrors `useEnterpriseDxfSettingsOptional`).
 */
export function useSettingsSaveStatusOptional(): SettingsSaveStatusValue | null {
  return useContext(SettingsSaveStatusContext);
}

export function useSettingsSaveStatus(): SettingsSaveStatusValue {
  const context = useContext(SettingsSaveStatusContext);
  if (!context) {
    throw new Error(
      'useSettingsSaveStatus must be used within EnterpriseDxfSettingsProvider'
    );
  }
  return context;
}

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

/**
 * Convenience hooks for specific settings
 */
export function useEnterpriseLineSettings(mode: ViewerMode = ENTERPRISE_CONSTANTS.DEFAULT_VIEWER_MODE) {
  const { getEffectiveLineSettings } = useEnterpriseDxfSettings();
  return getEffectiveLineSettings(mode);
}

export function useEnterpriseTextSettings(mode: ViewerMode = ENTERPRISE_CONSTANTS.DEFAULT_VIEWER_MODE) {
  const { getEffectiveTextSettings } = useEnterpriseDxfSettings();
  return getEffectiveTextSettings(mode);
}

export function useEnterpriseGripSettings(mode: ViewerMode = ENTERPRISE_CONSTANTS.DEFAULT_VIEWER_MODE) {
  const { getEffectiveGripSettings } = useEnterpriseDxfSettings();
  return getEffectiveGripSettings(mode);
}

// ============================================================================
// BACKWARD COMPATIBLE EXPORTS
// ============================================================================

export const useDxfSettings = useEnterpriseDxfSettings;

/**
 * Backward compatible provider hooks
 */
export function useLineSettingsFromProvider(mode?: ViewerMode) {
  const { getEffectiveLineSettings, updateLineSettings, resetToDefaults, resetToFactory } = useEnterpriseDxfSettings();
  const effectiveSettings = getEffectiveLineSettings(mode);

  return {
    settings: effectiveSettings,
    updateSettings: updateLineSettings as (updates: Partial<LineSettings>) => void,
    resetToDefaults,
    resetToFactory, // ✅ ENTERPRISE FIX: Added missing resetToFactory για LineSettingsContext.tsx
    getCurrentDashPattern: () => {
      const { getDashArray } = require('../settings-core/defaults');
      return getDashArray(effectiveSettings.lineType, effectiveSettings.dashScale);
    },
    applyTemplate: () => {} // ✅ ENTERPRISE FIX: Added missing applyTemplate για LineSettingsContext.tsx
  };
}

export function useTextSettingsFromProvider(mode?: ViewerMode) {
  const { getEffectiveTextSettings, updateTextSettings, resetToDefaults } = useEnterpriseDxfSettings();
  return {
    settings: getEffectiveTextSettings(mode),
    updateSettings: updateTextSettings as (updates: Partial<TextSettings>) => void,
    resetToDefaults,
    resetToFactory: resetToDefaults
  };
}

export function useGripSettingsFromProvider() {
  const { getEffectiveGripSettings, updateGripSettings, resetToDefaults } = useEnterpriseDxfSettings();
  return {
    settings: getEffectiveGripSettings(),
    updateSettings: updateGripSettings as (updates: Partial<GripSettings>) => void,
    resetToDefaults
  };
}

/**
 * Style hooks (backward compatible)
 */
export function useLineStyles(mode?: ViewerMode) {
  const { getEffectiveLineSettings } = useEnterpriseDxfSettings();
  return getEffectiveLineSettings(mode);
}

export function useTextStyles(mode?: ViewerMode) {
  const { getEffectiveTextSettings } = useEnterpriseDxfSettings();
  return getEffectiveTextSettings(mode);
}

export function useGripStyles(mode?: ViewerMode) {
  const { getEffectiveGripSettings } = useEnterpriseDxfSettings();
  return getEffectiveGripSettings(mode);
}
