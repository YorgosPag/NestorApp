/**
 * @file useEnterpriseSettingsState - Settings State Management Hook
 * @module settings-provider/hooks/useEnterpriseSettingsState
 *
 * ✅ ENTERPRISE: Single Responsibility - State management only
 *
 * Manages:
 * - Reducer state (settings, isLoaded, isSaving, lastError)
 * - Current viewer mode (backward compatibility)
 * - Save status (derived state)
 * - Last saved timestamp
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-09
 */

import { useReducer, useState, useMemo, useEffect } from 'react';
import { settingsReducer } from '../../settings/state/reducer';
import { handleEntityUpdate, handleToggleOverride } from '../reducerHelpers';
import { FACTORY_DEFAULTS } from '../../settings/FACTORY_DEFAULTS';
import type { SettingsAction } from '../../settings/state/actions';
import type { SettingsState, ViewerMode, StorageMode } from '../../settings/core/types';
import type { LineSettings, TextSettings } from '../../settings-core/types';
import type { GripSettings } from '../../types/gripSettings'; // Full GripSettings (with all properties)
import type { EnterpriseState } from '../reducerHelpers';

/**
 * Enterprise action types
 */
export type EnterpriseAction =
  | { type: 'LOAD_SUCCESS'; payload: SettingsState }
  | { type: 'LOAD_ERROR'; payload: string }
  | { type: 'UPDATE_LINE'; payload: { mode: StorageMode; updates: Partial<LineSettings>; layer: 'general' | 'specific' | 'overrides' } }
  | { type: 'UPDATE_TEXT'; payload: { mode: StorageMode; updates: Partial<TextSettings>; layer: 'general' | 'specific' | 'overrides' } }
  | { type: 'UPDATE_GRIP'; payload: { mode: StorageMode; updates: Partial<GripSettings>; layer: 'general' | 'specific' | 'overrides' } }
  | { type: 'TOGGLE_LINE_OVERRIDE'; payload: { mode: StorageMode; enabled: boolean } }
  | { type: 'TOGGLE_TEXT_OVERRIDE'; payload: { mode: StorageMode; enabled: boolean } }
  | { type: 'TOGGLE_GRIP_OVERRIDE'; payload: { mode: StorageMode; enabled: boolean } }
  | { type: 'RESET_TO_DEFAULTS' }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_ERROR'; payload: string };

/**
 * ✅ ENTERPRISE: Wrapper reducer that delegates to settingsReducer
 *
 * Architecture:
 * - Handles provider-specific actions (LOAD_SUCCESS, SAVE_START, etc.)
 * - Delegates entity updates to handleEntityUpdate (DRY)
 * - Delegates toggle overrides to handleToggleOverride (DRY)
 * - Uses settingsReducer as single source of truth
 */
function enterpriseReducer(state: EnterpriseState, action: EnterpriseAction): EnterpriseState {
  switch (action.type) {
    // ===== PROVIDER-SPECIFIC ACTIONS =====
    case 'LOAD_SUCCESS':
      return {
        ...state,
        settings: action.payload,
        isLoaded: true,
        lastError: null
      };

    case 'LOAD_ERROR':
      return {
        ...state,
        isLoaded: true,
        lastError: action.payload
      };

    case 'SAVE_START':
      return { ...state, isSaving: true };

    case 'SAVE_SUCCESS':
      return { ...state, isSaving: false, lastError: null };

    case 'SAVE_ERROR':
      // ✅ ENTERPRISE: ChatGPT5 solution - Handle storage offline gracefully
      const errorPayload = action.payload;
      if (errorPayload === 'STORAGE_OFFLINE') {
        // Don't set error state for storage issues - keep controls enabled
        return { ...state, isSaving: false, lastError: null };
      }
      return { ...state, isSaving: false, lastError: action.payload };

    // ===== SETTINGS UPDATES (Delegated to handleEntityUpdate - DRY) =====
    case 'UPDATE_LINE': {
      const { mode, updates, layer } = action.payload;
      return handleEntityUpdate(state, 'line', mode, updates as Record<string, unknown>, layer);
    }

    case 'UPDATE_TEXT': {
      const { mode, updates, layer } = action.payload;
      return handleEntityUpdate(state, 'text', mode, updates as Record<string, unknown>, layer);
    }

    case 'UPDATE_GRIP': {
      const { mode, updates, layer } = action.payload;
      return handleEntityUpdate(state, 'grip', mode, updates as Record<string, unknown>, layer);
    }

    // ===== OVERRIDE TOGGLES (Delegated to handleToggleOverride - DRY) =====
    case 'TOGGLE_LINE_OVERRIDE': {
      const { mode, enabled } = action.payload;
      return handleToggleOverride(state, 'line', mode, enabled);
    }

    case 'TOGGLE_TEXT_OVERRIDE': {
      const { mode, enabled } = action.payload;
      return handleToggleOverride(state, 'text', mode, enabled);
    }

    case 'TOGGLE_GRIP_OVERRIDE': {
      const { mode, enabled } = action.payload;
      return handleToggleOverride(state, 'grip', mode, enabled);
    }

    case 'RESET_TO_DEFAULTS': {
      const settingsAction: SettingsAction = { type: 'RESET_TO_FACTORY', payload: {} };
      return {
        ...state,
        settings: settingsReducer(state.settings, settingsAction)
      };
    }

    default:
      return state;
  }
}

/**
 * Settings state hook return type
 */
export interface EnterpriseSettingsStateHook {
  // State
  state: EnterpriseState;
  dispatch: React.Dispatch<EnterpriseAction>;

  // Backward compatibility
  currentMode: ViewerMode;
  setCurrentMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved: Date | null;
}

/**
 * Enterprise settings state hook
 *
 * @returns State management objects and functions
 *
 * @example
 * ```tsx
 * const { state, dispatch, currentMode, saveStatus } = useEnterpriseSettingsState();
 * ```
 */
export function useEnterpriseSettingsState(): EnterpriseSettingsStateHook {
  // ===== REDUCER STATE =====
  const [state, dispatch] = useReducer(enterpriseReducer, {
    settings: FACTORY_DEFAULTS,
    isLoaded: false,
    isSaving: false,
    lastError: null
  });

  // ===== BACKWARD COMPATIBLE STATE =====
  const [currentMode, setCurrentMode] = useState<ViewerMode>('normal');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Derived save status
  const saveStatus = useMemo<'idle' | 'saving' | 'saved' | 'error'>(() => {
    if (state.isSaving) return 'saving';
    if (state.lastError) return 'error';
    if (state.isLoaded) return 'saved';
    return 'idle';
  }, [state.isSaving, state.lastError, state.isLoaded]);

  // Update lastSaved when save completes
  useEffect(() => {
    if (saveStatus === 'saved' && !state.isSaving) {
      setLastSaved(new Date());
    }
  }, [saveStatus, state.isSaving]);

  return {
    state,
    dispatch,
    currentMode,
    setCurrentMode,
    saveStatus,
    lastSaved
  };
}
