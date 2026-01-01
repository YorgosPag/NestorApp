/**
 * @file Settings Actions
 * @module settings/state/actions
 *
 * ENTERPRISE STANDARD - Type-safe action creators
 *
 *  - State Management
 */

import type { ViewerMode, EntityType, SettingsState } from '../core/types';

// ============================================================================
// ACTION TYPES
// ============================================================================

export type SettingsAction =
  | { type: 'SET_GENERAL'; payload: { entity: EntityType; updates: Record<string, unknown> } }
  | { type: 'SET_SPECIFIC'; payload: { entity: EntityType; mode: ViewerMode; updates: Record<string, unknown> } }
  | { type: 'SET_OVERRIDE'; payload: { entity: EntityType; mode: ViewerMode; updates: Record<string, unknown> } }
  | { type: 'TOGGLE_OVERRIDE'; payload: { entity: EntityType; mode: ViewerMode } }
  | { type: 'APPLY_TEMPLATE'; payload: { entity: EntityType; templateId: string } }
  | { type: 'RESET_TO_FACTORY'; payload: { entity?: EntityType } }
  | { type: 'LOAD_STATE'; payload: { state: SettingsState } }
  | { type: 'MERGE_STATE'; payload: { changes: Partial<SettingsState> } };

// ============================================================================
// ACTION CREATORS
// ============================================================================

export const settingsActions = {
  setGeneral(entity: EntityType, updates: Record<string, unknown>): SettingsAction {
    return { type: 'SET_GENERAL', payload: { entity, updates } };
  },

  setSpecific(entity: EntityType, mode: ViewerMode, updates: Record<string, unknown>): SettingsAction {
    return { type: 'SET_SPECIFIC', payload: { entity, mode, updates } };
  },

  setOverride(entity: EntityType, mode: ViewerMode, updates: Record<string, unknown>): SettingsAction {
    return { type: 'SET_OVERRIDE', payload: { entity, mode, updates } };
  },

  toggleOverride(entity: EntityType, mode: ViewerMode): SettingsAction {
    return { type: 'TOGGLE_OVERRIDE', payload: { entity, mode } };
  },

  applyTemplate(entity: EntityType, templateId: string): SettingsAction {
    return { type: 'APPLY_TEMPLATE', payload: { entity, templateId } };
  },

  resetToFactory(entity?: EntityType): SettingsAction {
    return { type: 'RESET_TO_FACTORY', payload: { entity } };
  },

  loadState(state: SettingsState): SettingsAction {
    return { type: 'LOAD_STATE', payload: { state } };
  },

  mergeState(changes: Partial<SettingsState>): SettingsAction {
    return { type: 'MERGE_STATE', payload: { changes } };
  }
};
