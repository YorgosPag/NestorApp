/**
 * @file Settings Reducer
 * @module settings/state/reducer
 *
 * ENTERPRISE STANDARD - Immutable state updates
 *
 *  - State Management
 */

import type { SettingsState } from '../core/types';
import type { SettingsAction } from './actions';
import { modeMap } from '../core/modeMap';
import { getFactoryDefaults, getEntityFactoryDefaults } from '../FACTORY_DEFAULTS';

// ============================================================================
// REDUCER
// ============================================================================

export function settingsReducer(
  state: SettingsState,
  action: SettingsAction
): SettingsState {
  switch (action.type) {
    case 'SET_GENERAL': {
      const { entity, updates } = action.payload;
      return {
        ...state,
        [entity]: {
          ...state[entity],
          general: { ...state[entity].general, ...updates }
        }
      };
    }

    case 'SET_SPECIFIC': {
      const { entity, mode, updates } = action.payload;
      const mappedMode = modeMap(mode);

      return {
        ...state,
        [entity]: {
          ...state[entity],
          specific: {
            ...state[entity].specific,
            [mappedMode]: { ...state[entity].specific[mappedMode], ...updates }
          }
        }
      };
    }

    case 'SET_OVERRIDE': {
      const { entity, mode, updates } = action.payload;
      const mappedMode = modeMap(mode);

      return {
        ...state,
        [entity]: {
          ...state[entity],
          overrides: {
            ...state[entity].overrides,
            [mappedMode]: { ...state[entity].overrides[mappedMode], ...updates }
          }
        }
      };
    }

    case 'TOGGLE_OVERRIDE': {
      const { entity, mode } = action.payload;
      const mappedMode = modeMap(mode);
      const current = state.overrideEnabled[entity][mappedMode];

      return {
        ...state,
        overrideEnabled: {
          ...state.overrideEnabled,
          [entity]: {
            ...state.overrideEnabled[entity],
            [mappedMode]: !current
          }
        }
      };
    }

    case 'APPLY_TEMPLATE': {
      // TODO: Implement template application when TemplateEngine is ready
      return state;
    }

    case 'RESET_TO_FACTORY': {
      const { entity } = action.payload;

      if (entity) {
        // Reset specific entity
        return {
          ...state,
          [entity]: getEntityFactoryDefaults(entity)
        };
      }

      // Reset everything
      return getFactoryDefaults();
    }

    case 'LOAD_STATE': {
      return action.payload.state;
    }

    case 'MERGE_STATE': {
      const { changes } = action.payload;
      return { ...state, ...changes };
    }

    default:
      return state;
  }
}
