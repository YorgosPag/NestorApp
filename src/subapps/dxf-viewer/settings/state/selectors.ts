/**
 * @file Settings Selectors
 * @module settings/state/selectors
 *
 * ENTERPRISE STANDARD - Memoized selectors for minimal re-renders
 *
 *  - State Management
 */

import type { SettingsState, ViewerMode, EntityType, LineSettings, TextSettings, GripSettings } from '../core/types';
import { computeEffective } from '../core/computeEffective';

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Select effective line settings for mode
 */
export function selectLineSettings(state: SettingsState, mode: ViewerMode): LineSettings {
  return computeEffective<LineSettings>(
    state.line.general,
    state.line.specific,
    state.line.overrides,
    state.overrideEnabled.line,
    mode
  );
}

/**
 * Select effective text settings for mode
 */
export function selectTextSettings(state: SettingsState, mode: ViewerMode): TextSettings {
  return computeEffective<TextSettings>(
    state.text.general,
    state.text.specific,
    state.text.overrides,
    state.overrideEnabled.text,
    mode
  );
}

/**
 * Select effective grip settings for mode
 */
export function selectGripSettings(state: SettingsState, mode: ViewerMode): GripSettings {
  return computeEffective<GripSettings>(
    state.grip.general,
    state.grip.specific,
    state.grip.overrides,
    state.overrideEnabled.grip,
    mode
  );
}

/**
 * Select if override is enabled for entity/mode
 */
export function selectIsOverrideEnabled(
  state: SettingsState,
  entity: EntityType,
  mode: ViewerMode
): boolean {
  return state.overrideEnabled[entity][mode];
}

/**
 * Select version
 */
export function selectVersion(state: SettingsState): number {
  return state.__standards_version;
}
