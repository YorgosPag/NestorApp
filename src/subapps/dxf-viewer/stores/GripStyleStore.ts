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
import { GRIP_COLD_COLOR, GRIP_WARM_COLOR, GRIP_HOT_COLOR, GRIP_CONTOUR_COLOR, resolveGripColors } from '../config/color-config';
// 🏢 SSoT base grip size
import { GRIP_SIZE_DEFAULT } from '../config/grip-size-default';

type Listener = () => void;
let current: GripStyle = {
  enabled: true,
  colors: {
    cold: GRIP_COLD_COLOR,               // Resolved at init — resolveGripColors() applied on write
    warm: GRIP_WARM_COLOR,               // SSOT → color-config.ts (orange hover) — was SNAP_INTERSECTION hot-pink
    hot: GRIP_HOT_COLOR,                 // SSOT → color-config.ts (red selected) — was SNAP_ENDPOINT
    contour: GRIP_CONTOUR_COLOR // SSOT → color-config.ts (black) — was UI_COLORS.BLACK
  },
  gripSize: GRIP_SIZE_DEFAULT, // 🏢 SSoT base grip size
  pickBoxSize: 3,
  apertureSize: 20,
  showGrips: true,
  opacity: 1.0,
  // ✅ ENTERPRISE: Additional grip settings defaults
  showAperture: true,       // ✅ AutoCAD APBOX default: enabled
  multiGripEdit: true,      // ✅ ΑΠΟΚΑΤΑΣΤΑΣΗ: Ενεργοποίηση multi grips
  snapToGrips: true,        // ✅ ΑΠΟΚΑΤΑΣΤΑΣΗ: Ενεργοποίηση snap to grips
  showGripTips: false,      // ✅ Grip tooltips disabled by default
  dpiScale: 1.0,            // ✅ Default DPI scale
  showMidpoints: true,      // ✅ Show midpoint grips
  showCenters: true,        // ✅ Show center grips
  showQuadrants: true,      // ✅ Show quadrant grips
  maxGripsPerEntity: 50,    // ✅ Maximum grips per entity
  gripObjLimit: 100         // ✅ AutoCAD GRIPOBJLIMIT — hide all grips above 100 selected objects (0 = no limit)
};

const listeners = new Set<Listener>();

export const gripStyleStore = {
  get(): GripStyle {
    // 🔥 GUARD: Προστασία πρόσβασης στις γενικές grip settings όταν override ενεργό
    guardGlobalAccess('GRIP_STYLE_READ');
    return current;
  },
  set(next: Omit<Partial<GripStyle>, 'colors'> & { colors?: { cold: string | null; warm: string; hot: string; contour: string } }) {
    // 🔥 GUARD: Προστασία ενημέρωσης των γενικών grip settings όταν override ενεργό
    guardGlobalAccess('GRIP_STYLE_UPDATE');
    const resolved: Partial<GripStyle> = next.colors
      ? { ...next, colors: resolveGripColors(next.colors) }
      : (next as Partial<GripStyle>);
    current = { ...current, ...resolved };
    listeners.forEach(l => l());
  },
  subscribe(cb: Listener) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

export function useGripStyle(): GripStyle {
  return useSyncExternalStore(gripStyleStore.subscribe, gripStyleStore.get, gripStyleStore.get);
}