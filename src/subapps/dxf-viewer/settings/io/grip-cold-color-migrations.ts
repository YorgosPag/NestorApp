/**
 * @file Grip Value Migrations
 * @module settings/io/grip-cold-color-migrations
 *
 * Extracted from migrationRegistry.ts (SRP / 500-line ratchet).
 * Versions 4→5 and 5→6 — grip COLD color SSoT alignment.
 * Version 6→7 — grip WARM (hover) color SSoT alignment (Giorgio 2026-06-17).
 * Version 7→8 — grip SIZE SSoT alignment: stale pre-ADR-107 default 14 → 7.
 */

import { deepClone } from '../../utils/clone-utils';
import { GRIP_COLD_COLOR, GRIP_WARM_COLOR } from '../../config/color-config';
import { GRIP_SIZE_DEFAULT } from '../../config/grip-size-default';
import type { Migration } from './migrationRegistry';

type GripColorScope = { colors?: { cold?: string | null; warm?: string } };

type GripColdState = {
  __standards_version: number;
  grip?: {
    general?: GripColorScope;
    specific?: Record<string, GripColorScope>;
    overrides?: Record<string, GripColorScope>;
  };
};

function applyToAllGripScopes(
  state: GripColdState,
  apply: (obj: GripColorScope | undefined) => void,
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

// Version 6 → 7: Update grip WARM (hover) color to GRIP_WARM_COLOR SSoT (orange).
// Pre-v7 factory defaults baked Cyan (ACI 4) / Hot-Pink into the stored warm value
// (no null sentinel — warm is non-nullable in GripColorsSchema), so a value migration
// is required to flip existing stored settings to the orange SSoT (Giorgio 2026-06-17).
export const migration_v6_to_v7: Migration = {
  version: 7,
  description: 'Update grip warm (hover) color to GRIP_WARM_COLOR SSoT (orange)',
  migrate: (data: unknown) => {
    const state = deepClone(data) as GripColdState;
    applyToAllGripScopes(state, (obj) => {
      if (obj?.colors) obj.colors.warm = GRIP_WARM_COLOR;
    });
    return { ...state, __standards_version: 7 };
  },
  rollback: (data: unknown) => {
    const state = deepClone(data) as { __standards_version: number };
    return { ...state, __standards_version: 6 };
  },
};

// ============================================================================
// Version 7 → 8: Grip SIZE SSoT alignment (ADR-107)
// ============================================================================
// Before ADR-107 the grip base size default was 14; users who saved settings
// while that was the default have `gripSize: 14` (and the backward-compat
// `size: 14`) baked into persisted storage, so the effective grip size resolves
// to 14 and renders large — regardless of the (now unified) code default of 7.
// Heal ONLY the exact stale legacy default (14) → SSoT GRIP_SIZE_DEFAULT (7).
// Deliberately conditional: the mode-variant sizes (draft 8, hover/selection 12)
// are a separate, intentional domain and must NOT be touched.
const LEGACY_GRIP_SIZE_DEFAULT = 14;

type GripSizeScope = { gripSize?: number; size?: number };

type GripSizeState = {
  __standards_version: number;
  grip?: {
    general?: GripSizeScope;
    specific?: Record<string, GripSizeScope>;
    overrides?: Record<string, GripSizeScope>;
  };
};

function applyToAllGripSizeScopes(
  state: GripSizeState,
  apply: (obj: GripSizeScope | undefined) => void,
): void {
  if (!state.grip) return;
  apply(state.grip.general);
  if (state.grip.specific) Object.values(state.grip.specific).forEach(apply);
  if (state.grip.overrides) Object.values(state.grip.overrides).forEach(apply);
}

export const migration_v7_to_v8: Migration = {
  version: 8,
  description: 'Grip size: heal stale pre-ADR-107 default (14) → SSoT GRIP_SIZE_DEFAULT (7)',
  migrate: (data: unknown) => {
    const state = deepClone(data) as GripSizeState;
    applyToAllGripSizeScopes(state, (obj) => {
      if (!obj) return;
      if (obj.gripSize === LEGACY_GRIP_SIZE_DEFAULT) obj.gripSize = GRIP_SIZE_DEFAULT;
      if (obj.size === LEGACY_GRIP_SIZE_DEFAULT) obj.size = GRIP_SIZE_DEFAULT;
    });
    return { ...state, __standards_version: 8 };
  },
  rollback: (data: unknown) => {
    const state = deepClone(data) as { __standards_version: number };
    return { ...state, __standards_version: 7 };
  },
};
