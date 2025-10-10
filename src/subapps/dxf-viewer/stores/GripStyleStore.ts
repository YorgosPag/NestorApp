/**
 * Grip Style Store
 * Single source of truth for grip styling in preview rendering
 * Following the same pattern as ToolStyleStore and TextStyleStore
 */

// ===== OVERRIDE GUARD SYSTEM =====
import { guardGlobalAccess } from '../../../utils/overrideGuard';

export interface GripStyle {
  enabled: boolean;
  colors: {
    cold: string;
    warm: string;
    hot: string;
    contour: string;
  };
  gripSize: number;
  pickBoxSize: number;
  apertureSize: number;
  showGrips: boolean;
  opacity: number;
  // ✅ ENTERPRISE: Additional grip settings (from GripSettings)
  showAperture: boolean;      // Show aperture box (AutoCAD APBOX)
  multiGripEdit: boolean;      // Enable multi-grip editing
  snapToGrips: boolean;        // Snap to grip points
  showGripTips: boolean;       // Show grip tooltips
  dpiScale: number;            // DPI scaling factor
  showMidpoints: boolean;      // Show midpoint grips
  showCenters: boolean;        // Show center grips
  showQuadrants: boolean;      // Show quadrant grips
  maxGripsPerEntity: number;   // Maximum grips per entity
}

import { useSyncExternalStore } from 'react';

type Listener = () => void;
let current: GripStyle = {
  enabled: true,
  colors: {
    cold: '#0000FF',   // ✅ AutoCAD standard: Blue (ACI 5) - unselected grips
    warm: '#FF69B4',   // ✅ AutoCAD standard: Hot Pink - hover grips
    hot: '#FF0000',    // ✅ AutoCAD standard: Red (ACI 1) - selected grips
    contour: '#000000' // ✅ AutoCAD standard: Black contour
  },
  gripSize: 10,
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
  maxGripsPerEntity: 50     // ✅ Maximum grips per entity
};

const listeners = new Set<Listener>();

export const gripStyleStore = {
  get(): GripStyle {
    // 🔥 GUARD: Προστασία πρόσβασης στις γενικές grip settings όταν override ενεργό
    guardGlobalAccess('GRIP_STYLE_READ');
    return current;
  },
  set(next: Partial<GripStyle>) {
    // 🔥 GUARD: Προστασία ενημέρωσης των γενικών grip settings όταν override ενεργό
    guardGlobalAccess('GRIP_STYLE_UPDATE');
    current = { ...current, ...next };
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