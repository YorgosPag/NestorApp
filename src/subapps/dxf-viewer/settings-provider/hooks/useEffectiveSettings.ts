/**
 * @file useEffectiveSettings - Effective Settings Computation Hook
 * @module settings-provider/hooks/useEffectiveSettings
 *
 * ✅ ENTERPRISE: Single Responsibility - Compute effective settings only
 *
 * Computes effective settings for each entity (line/text/grip) by merging:
 * - General settings (base)
 * - Mode-specific settings (layer 2)
 * - Mode overrides (layer 3, if enabled)
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-09
 */

import { useCallback, useMemo } from 'react';
import { computeEffective } from '../../settings/core/computeEffective';
import { ENTERPRISE_CONSTANTS } from '../constants';
import type { LineSettings, TextSettings } from '../../settings-core/types';
import type { GripSettings } from '../../types/gripSettings'; // Full GripSettings (with all properties)
import type { SettingsState, ViewerMode, StorageMode } from '../../settings/core/types';

/**
 * Effective settings hook return type
 */
export interface EffectiveSettings {
  getEffectiveLineSettings: (mode?: ViewerMode) => LineSettings;
  getEffectiveTextSettings: (mode?: ViewerMode) => TextSettings;
  getEffectiveGripSettings: (mode?: ViewerMode) => GripSettings;
}

/**
 * ✅ ENTERPRISE: Generic helper for computing effective settings (DRY principle)
 *
 * Eliminates code duplication across getEffectiveLine/Text/GripSettings.
 * Uses type-safe casts with intermediate 'unknown' (TypeScript requirement).
 *
 * @param settings - Current settings state
 * @param entity - Entity type ('line' | 'text' | 'grip')
 * @param mode - Viewer mode (defaults to 'normal')
 * @returns Effective settings for the entity and mode
 */
function getEffectiveSettingsForEntity<T extends LineSettings | TextSettings | GripSettings>(
  settings: SettingsState,
  entity: 'line' | 'text' | 'grip',
  mode?: ViewerMode
): T {
  const effectiveMode = mode || ENTERPRISE_CONSTANTS.DEFAULT_VIEWER_MODE;
  const entitySettings = settings[entity];

  // ✅ ENTERPRISE: Type-safe casts with intermediate 'unknown' (TypeScript requirement)
  // All Settings types are objects that can be safely represented as Record<string, unknown>
  return computeEffective<Record<string, unknown>>(
    entitySettings.general as unknown as Record<string, unknown>,
    entitySettings.specific as unknown as Record<StorageMode, Partial<Record<string, unknown>>>,
    entitySettings.overrides as unknown as Record<StorageMode, Partial<Record<string, unknown>>>,
    settings.overrideEnabled[entity],
    effectiveMode
  ) as T;
}

/**
 * Effective settings hook
 *
 * @param settings - Current settings state
 * @returns Getter functions for effective settings
 *
 * @example
 * ```tsx
 * const { getEffectiveLineSettings } = useEffectiveSettings(state.settings);
 * const lineSettings = getEffectiveLineSettings('draft');
 * ```
 */
export function useEffectiveSettings(settings: SettingsState): EffectiveSettings {
  // ✅ ENTERPRISE: Specialized wrappers using generic helper (DRY)
  // ✅ FIX INFINITE LOOP: Only depend on settings (not individual callbacks)
  const getEffectiveLineSettings = useCallback((mode?: ViewerMode): LineSettings => {
    return getEffectiveSettingsForEntity<LineSettings>(settings, 'line', mode);
  }, [settings]);

  const getEffectiveTextSettings = useCallback((mode?: ViewerMode): TextSettings => {
    return getEffectiveSettingsForEntity<TextSettings>(settings, 'text', mode);
  }, [settings]);

  const getEffectiveGripSettings = useCallback((mode?: ViewerMode): GripSettings => {
    return getEffectiveSettingsForEntity<GripSettings>(settings, 'grip', mode);
  }, [settings]);

  // 🏢 ENTERPRISE (2026-01-31): useMemo prevents new object creation on every render
  // This fixes infinite loop where contextValue changes → consumers re-render → provider re-renders
  return useMemo(() => ({
    getEffectiveLineSettings,
    getEffectiveTextSettings,
    getEffectiveGripSettings
  }), [
    getEffectiveLineSettings,
    getEffectiveTextSettings,
    getEffectiveGripSettings
  ]);
}
