"use client";

/**
 * Grip Style Store
 * Single source of truth for grip styling in preview rendering
 * Following the same pattern as ToolStyleStore and TextStyleStore
 */

// ===== OVERRIDE GUARD SYSTEM =====
import { guardGlobalAccess } from '../../../utils/overrideGuard';

// ADR-559 — the runtime grip STYLE is a projection of the canonical schema: the stored
// `GripSettingsBase` (incl. maxGripsPerEntity + gripObjLimit) + render extras
// (showGripTips / dpiScale) with RESOLVED colours (`cold` always concrete — resolveGripColors()
// runs at write time in set()). Add new grip fields to `GripSettingsBase`, not here.
import type { GripSettingsBase, GripStyleExtras, ResolvedGripColors } from '../types/grip-settings-schema';

export type GripStyle = GripSettingsBase & GripStyleExtras & {
  colors: ResolvedGripColors;
};

import { useSyncExternalStore } from 'react';
import { resolveGripColors } from '../config/color-config';
// 🏢 ADR-559 §3b — canonical grip default VALUES (aperture 20, warm ροζ, sentinel cold)
import { GRIP_FACTORY_DEFAULTS } from '../config/grip-factory-defaults';
import { createExternalStore } from './createExternalStore';

// 🏢 ADR-559 §3b — DERIVED from canonical GRIP_FACTORY_DEFAULTS (aperture 20, warm ροζ).
// Runtime store resolves the `cold` sentinel to a concrete colour at init and adds the
// render extras (showGripTips / dpiScale); the VALUES live once in grip-factory-defaults.ts.
const INITIAL: GripStyle = {
  ...GRIP_FACTORY_DEFAULTS,
  colors: resolveGripColors(GRIP_FACTORY_DEFAULTS.colors), // cold sentinel → concrete at init
  showGripTips: false,      // Grip tooltips disabled by default
  dpiScale: 1.0             // Default DPI scale
};

// SSoT pub/sub plumbing via createExternalStore (WAVE 2.6). Patch-merge (with a colour
// resolve step in `set`) — always-notify, no `equals`, byte-identical to the hand-rolled store.
const store = createExternalStore<GripStyle>(INITIAL);

export const gripStyleStore = {
  get(): GripStyle {
    // 🔥 GUARD: Προστασία πρόσβασης στις γενικές grip settings όταν override ενεργό
    guardGlobalAccess('GRIP_STYLE_READ');
    return store.get();
  },
  set(next: Omit<Partial<GripStyle>, 'colors'> & { colors?: { cold: string | null; warm: string; hot: string; contour: string } }) {
    // 🔥 GUARD: Προστασία ενημέρωσης των γενικών grip settings όταν override ενεργό
    guardGlobalAccess('GRIP_STYLE_UPDATE');
    const resolved: Partial<GripStyle> = next.colors
      ? { ...next, colors: resolveGripColors(next.colors) }
      : (next as Partial<GripStyle>);
    store.set({ ...store.get(), ...resolved });
  },
  subscribe(cb: () => void) {
    return store.subscribe(cb);
  },
};

export function useGripStyle(): GripStyle {
  return useSyncExternalStore(gripStyleStore.subscribe, gripStyleStore.get, gripStyleStore.get);
}
