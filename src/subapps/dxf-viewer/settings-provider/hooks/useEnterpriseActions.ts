/**
 * @file useEnterpriseActions - Settings Actions Hook
 * @module settings-provider/hooks/useEnterpriseActions
 *
 * ✅ ENTERPRISE: Single Responsibility - Action creators only
 *
 * Provides all action functions for updating settings:
 * - update*Settings (backward compatible - OLD + NEW API)
 * - toggle*Override
 * - resetToDefaults
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-09
 */

import { useCallback } from 'react';
import { ENTERPRISE_CONSTANTS } from '../constants';
import type { LineSettings, TextSettings } from '../../settings-core/types';
import type { GripSettings } from '../../types/gripSettings'; // Full GripSettings (with all properties)
import type { StorageMode } from '../../settings/core/types';

/**
 * Action types for reducer dispatch
 */
type EnterpriseAction =
  | { type: 'UPDATE_LINE'; payload: { mode: StorageMode; updates: Partial<LineSettings>; layer: 'general' | 'specific' | 'overrides' } }
  | { type: 'UPDATE_TEXT'; payload: { mode: StorageMode; updates: Partial<TextSettings>; layer: 'general' | 'specific' | 'overrides' } }
  | { type: 'UPDATE_GRIP'; payload: { mode: StorageMode; updates: Partial<GripSettings>; layer: 'general' | 'specific' | 'overrides' } }
  | { type: 'TOGGLE_LINE_OVERRIDE'; payload: { mode: StorageMode; enabled: boolean } }
  | { type: 'TOGGLE_TEXT_OVERRIDE'; payload: { mode: StorageMode; enabled: boolean } }
  | { type: 'TOGGLE_GRIP_OVERRIDE'; payload: { mode: StorageMode; enabled: boolean } }
  | { type: 'RESET_TO_DEFAULTS' };

/**
 * Actions hook return type
 */
export interface EnterpriseActions {
  // Core update actions (backward compatible)
  updateLineSettings: {
    (updates: Partial<LineSettings>): void; // OLD API
    (mode: StorageMode, updates: Partial<LineSettings>, layer?: 'general' | 'specific' | 'overrides'): void; // NEW API
  };
  updateTextSettings: {
    (updates: Partial<TextSettings>): void; // OLD API
    (mode: StorageMode, updates: Partial<TextSettings>, layer?: 'general' | 'specific' | 'overrides'): void; // NEW API
  };
  updateGripSettings: {
    (updates: Partial<GripSettings>): void; // OLD API
    (mode: StorageMode, updates: Partial<GripSettings>, layer?: 'general' | 'specific' | 'overrides'): void; // NEW API
  };

  // ✅ ENTERPRISE FIX: Missing specific update methods used by hooks
  updateSpecificLineSettings: (mode: StorageMode, updates: Partial<LineSettings>) => void;
  updateSpecificTextSettings: (mode: StorageMode, updates: Partial<TextSettings>) => void;
  updateSpecificGripSettings: (mode: StorageMode, updates: Partial<GripSettings>) => void;

  // Override toggles
  toggleLineOverride: (mode: StorageMode, enabled: boolean) => void;
  toggleTextOverride: (mode: StorageMode, enabled: boolean) => void;
  toggleGripOverride: (mode: StorageMode, enabled: boolean) => void;

  // Reset
  resetToDefaults: () => void;
}

/**
 * ✅ ENTERPRISE: Generic factory for update*Settings functions (DRY principle)
 *
 * Creates a backward-compatible update function that supports:
 * - OLD API: updateSettings(updates) → applies to 'normal' mode, 'general' layer
 * - NEW API: updateSettings(mode, updates, layer?) → full control
 *
 * @param dispatch - Reducer dispatch function
 * @param actionType - Redux action type to dispatch
 * @param entityName - Entity name for logging
 * @returns Update function with dual API support
 */
function createUpdateSettings<T extends Partial<LineSettings | TextSettings | GripSettings>>(
  dispatch: React.Dispatch<EnterpriseAction>,
  actionType: 'UPDATE_LINE' | 'UPDATE_TEXT' | 'UPDATE_GRIP',
  entityName: string
) {
  // ✅ FIX INFINITE LOOP: Don't include dispatch/actionType/entityName in dependencies
  // These are stable references that never change
  return (
    modeOrUpdates: StorageMode | T,
    updatesParam?: T,
    layerParam?: 'general' | 'specific' | 'overrides'
  ) => {
    // Detect OLD API: updateSettings(updates)
    if (typeof modeOrUpdates === 'object' && updatesParam === undefined) {
      const mode = ENTERPRISE_CONSTANTS.DEFAULT_VIEWER_MODE as StorageMode;
      const updates = modeOrUpdates as T;
      const layer = ENTERPRISE_CONSTANTS.DEFAULT_LAYER;
      dispatch({ type: actionType, payload: { mode, updates, layer } } as EnterpriseAction);
    } else {
      // NEW API: updateSettings(mode, updates, layer)
      const mode = modeOrUpdates as StorageMode;
      const updates = updatesParam!;
      const layer = layerParam || ENTERPRISE_CONSTANTS.DEFAULT_LAYER;
      dispatch({ type: actionType, payload: { mode, updates, layer } } as EnterpriseAction);
    }
  };
}

/**
 * Enterprise actions hook
 *
 * @param dispatch - Reducer dispatch function
 * @returns Action functions for updating settings
 *
 * @example
 * ```tsx
 * const actions = useEnterpriseActions(dispatch);
 *
 * // OLD API
 * actions.updateLineSettings({ color: '#FF0000' });
 *
 * // NEW API
 * actions.updateLineSettings('draft', { color: '#00FF00' }, 'specific');
 * ```
 */
export function useEnterpriseActions(
  dispatch: React.Dispatch<EnterpriseAction>
): EnterpriseActions {
  // ✅ ENTERPRISE: Create all three update functions using factory (DRY)
  // ✅ FIX INFINITE LOOP: Wrap in useCallback with EMPTY deps (dispatch is stable)
  const updateLineSettings = useCallback(
    createUpdateSettings<Partial<LineSettings>>(dispatch, 'UPDATE_LINE', 'updateLineSettings'),
    [] // ✅ EMPTY - dispatch is stable, factory args are constants
  );

  const updateTextSettings = useCallback(
    createUpdateSettings<Partial<TextSettings>>(dispatch, 'UPDATE_TEXT', 'updateTextSettings'),
    []
  );

  const updateGripSettings = useCallback(
    createUpdateSettings<Partial<GripSettings>>(dispatch, 'UPDATE_GRIP', 'updateGripSettings'),
    []
  );

  // Toggle overrides
  const toggleLineOverride = useCallback((mode: StorageMode, enabled: boolean) => {
    dispatch({ type: 'TOGGLE_LINE_OVERRIDE', payload: { mode, enabled } });
  }, [dispatch]);

  const toggleTextOverride = useCallback((mode: StorageMode, enabled: boolean) => {
    dispatch({ type: 'TOGGLE_TEXT_OVERRIDE', payload: { mode, enabled } });
  }, [dispatch]);

  const toggleGripOverride = useCallback((mode: StorageMode, enabled: boolean) => {
    dispatch({ type: 'TOGGLE_GRIP_OVERRIDE', payload: { mode, enabled } });
  }, [dispatch]);

  // Reset
  const resetToDefaults = useCallback(() => {
    dispatch({ type: 'RESET_TO_DEFAULTS' });
  }, [dispatch]);

  // ✅ ENTERPRISE FIX: Missing specific update methods
  const updateSpecificLineSettings = useCallback((mode: StorageMode, updates: Partial<LineSettings>) => {
    dispatch({ type: 'UPDATE_LINE', payload: { mode, updates, layer: 'specific' } });
  }, [dispatch]);

  const updateSpecificTextSettings = useCallback((mode: StorageMode, updates: Partial<TextSettings>) => {
    dispatch({ type: 'UPDATE_TEXT', payload: { mode, updates, layer: 'specific' } });
  }, [dispatch]);

  const updateSpecificGripSettings = useCallback((mode: StorageMode, updates: Partial<GripSettings>) => {
    dispatch({ type: 'UPDATE_GRIP', payload: { mode, updates, layer: 'specific' } });
  }, [dispatch]);

  return {
    updateLineSettings,
    updateTextSettings,
    updateGripSettings,
    updateSpecificLineSettings,
    updateSpecificTextSettings,
    updateSpecificGripSettings,
    toggleLineOverride,
    toggleTextOverride,
    toggleGripOverride,
    resetToDefaults
  };
}
