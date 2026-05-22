/**
 * @file Grip Cold Color Migrations
 * @module settings/io/grip-cold-color-migrations
 *
 * Extracted from migrationRegistry.ts (SRP / 500-line ratchet).
 * Versions 4→5 and 5→6 — grip cold color SSoT alignment.
 */

import { deepClone } from '../../utils/clone-utils';
import { GRIP_COLD_COLOR } from '../../config/color-config';
import type { Migration } from './migrationRegistry';

type GripColdState = {
  __standards_version: number;
  grip?: {
    general?: { colors?: { cold?: string | null } };
    specific?: Record<string, { colors?: { cold?: string | null } }>;
    overrides?: Record<string, { colors?: { cold?: string | null } }>;
  };
};

function applyToAllGripScopes(
  state: GripColdState,
  apply: (obj: { colors?: { cold?: string | null } } | undefined) => void,
): void {
  if (!state.grip) return;
  apply(state.grip.general);
  if (state.grip.specific) Object.values(state.grip.specific).forEach(apply);
  if (state.grip.overrides) Object.values(state.grip.overrides).forEach(apply);
}

// Version 4 → 5: Update grip cold color to centralized GRIP_COLD_COLOR SSoT value
export const migration_v4_to_v5: Migration = {
  version: 5,
  description: 'Update grip cold color to centralized GRIP_COLD_COLOR SSoT value',
  migrate: (data: unknown) => {
    const state = deepClone(data) as GripColdState;
    applyToAllGripScopes(state, (obj) => {
      if (obj?.colors) obj.colors.cold = GRIP_COLD_COLOR;
    });
    return { ...state, __standards_version: 5 };
  },
  rollback: (data: unknown) => {
    const state = deepClone(data) as { __standards_version: number };
    return { ...state, __standards_version: 4 };
  },
};

// Version 5 → 6: Revit-style null sentinel — cold = null means
// "use GRIP_COLD_COLOR SSoT at render time" — null-ify all stored defaults
export const migration_v5_to_v6: Migration = {
  version: 6,
  description: 'Grip cold color null sentinel: stored null means use GRIP_COLD_COLOR SSoT at render time',
  migrate: (data: unknown) => {
    const state = deepClone(data) as GripColdState;
    applyToAllGripScopes(state, (obj) => {
      if (obj?.colors) obj.colors.cold = null;
    });
    return { ...state, __standards_version: 6 };
  },
  rollback: (data: unknown) => {
    const state = deepClone(data) as { __standards_version: number };
    return { ...state, __standards_version: 5 };
  },
};
