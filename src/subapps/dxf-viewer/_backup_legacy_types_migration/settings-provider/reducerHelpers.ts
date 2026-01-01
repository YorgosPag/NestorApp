/**
 * @file Reducer Helpers - Generic Entity Update Functions
 * @module settings-provider/reducerHelpers
 *
 * ✅ ENTERPRISE: DRY principle - Eliminates duplicate reducer code
 *
 * Generic helpers for entity updates and override toggles.
 * Used by the enterprise reducer to avoid code duplication.
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-09
 */

import { settingsReducer } from '../settings/state/reducer';
import type { SettingsAction } from '../settings/state/actions';
import type { SettingsState, StorageMode } from '../settings/core/types';

/**
 * Enterprise state (includes provider metadata)
 */
export interface EnterpriseState {
  settings: SettingsState;
  isLoaded: boolean;
  isSaving: boolean;
  lastError: string | null;
}

/**
 * ✅ ENTERPRISE: Generic helper for entity updates (DRY principle)
 *
 * Eliminates code duplication across UPDATE_LINE, UPDATE_TEXT, UPDATE_GRIP.
 * Uses generics for type safety while maintaining single implementation.
 *
 * @param state - Current enterprise state
 * @param entity - Entity type ('line' | 'text' | 'grip')
 * @param mode - Storage mode
 * @param updates - Partial updates to apply
 * @param layer - Target layer (general/specific/overrides)
 * @returns Updated state
 */
export function handleEntityUpdate(
  state: EnterpriseState,
  entity: 'line' | 'text' | 'grip',
  mode: StorageMode,
  updates: Record<string, unknown>,
  layer: 'general' | 'specific' | 'overrides'
): EnterpriseState {
  let settingsAction: SettingsAction;

  if (layer === 'general') {
    settingsAction = { type: 'SET_GENERAL', payload: { entity, updates } };
  } else if (layer === 'specific') {
    settingsAction = { type: 'SET_SPECIFIC', payload: { entity, mode, updates } };
  } else {
    settingsAction = { type: 'SET_OVERRIDE', payload: { entity, mode, updates } };
  }

  return {
    ...state,
    settings: settingsReducer(state.settings, settingsAction)
  };
}

/**
 * ✅ ENTERPRISE: Generic helper for override toggles (DRY principle)
 *
 * Eliminates code duplication across TOGGLE_LINE_OVERRIDE, TOGGLE_TEXT_OVERRIDE, TOGGLE_GRIP_OVERRIDE.
 * Supports both explicit boolean setting and toggle behavior.
 *
 * @param state - Current enterprise state
 * @param entity - Entity type ('line' | 'text' | 'grip')
 * @param mode - Storage mode
 * @param enabled - Explicit boolean (set) or undefined (toggle)
 * @returns Updated state
 */
export function handleToggleOverride(
  state: EnterpriseState,
  entity: 'line' | 'text' | 'grip',
  mode: StorageMode,
  enabled?: boolean
): EnterpriseState {
  // Explicit boolean: Set directly
  if (typeof enabled === 'boolean') {
    return {
      ...state,
      settings: {
        ...state.settings,
        overrideEnabled: {
          ...state.settings.overrideEnabled,
          [entity]: {
            ...state.settings.overrideEnabled[entity],
            [mode]: enabled
          }
        }
      }
    };
  }

  // Undefined: Toggle via settingsReducer
  const settingsAction: SettingsAction = {
    type: 'TOGGLE_OVERRIDE',
    payload: { entity, mode }
  };

  return {
    ...state,
    settings: settingsReducer(state.settings, settingsAction)
  };
}
