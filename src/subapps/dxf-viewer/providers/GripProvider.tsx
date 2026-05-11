'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { GripSettings } from '../types/gripSettings';
import { validateGripSettings, DEFAULT_GRIP_SETTINGS } from '../types/gripSettings';
import { gripStyleStore } from '../stores/GripStyleStore';
// 🏢 ADR-075: Centralized Grip Size Multipliers
import { GRIP_SIZE_MULTIPLIERS } from '../rendering/grips/constants';
// ===== ΝΕΑ UNIFIED PROVIDERS (για internal use) =====
// 🗑️ REMOVED (2025-10-06): ConfigurationProvider - MERGED into DxfSettingsProvider
// import { useViewerConfig } from './ConfigurationProvider';
// 🔄 MIGRATED (2025-10-09): Phase 3.2 - Direct Enterprise (no adapter)
// ✅ FIX (ChatGPT-5): Use optional hook to avoid errors when provider is missing
import { useEnterpriseDxfSettingsOptional } from '../settings-provider';

// === CONTEXT TYPE ===
interface GripContextType {
  gripSettings: GripSettings;
  updateGripSettings: (updates: Partial<GripSettings>) => void;
  resetToDefaults: () => void;
  getGripSize: (state: 'cold' | 'warm' | 'hot') => number;
  getGripColor: (state: 'cold' | 'warm' | 'hot') => string;
}

// === CONTEXT CREATION ===
const GripContext = createContext<GripContextType | null>(null);

interface GripProviderProps {
  children: React.ReactNode;
}

// === DEEP EQUALITY CHECK για Object Stability ===
// ✅ ENTERPRISE: Type-safe deep equality without 'as any'
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  // ✅ ENTERPRISE: Type guard - narrow to Record<string, unknown>
  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    // ✅ ENTERPRISE: Recursive call with proper types
    if (!deepEqual(objA[key], objB[key])) return false;
  }

  return true;
}

// === STABLE GRIP PROVIDER ===
export function GripProvider({ children }: GripProviderProps) {
  // ✅ FIX (ChatGPT-5): Optional enterprise context. No error thrown when missing.
  const enterpriseCtx = useEnterpriseDxfSettingsOptional();

  const centralGripHook = useMemo(() => {
    if (!enterpriseCtx) return null;
    return {
      settings: enterpriseCtx.getEffectiveGripSettings(),
      updateSettings: enterpriseCtx.updateGripSettings as (u: Partial<GripSettings>) => void,
      resetToDefaults: enterpriseCtx.resetToDefaults
    };
  }, [enterpriseCtx]);

  // Fallback state για backwards compatibility
  const [fallbackSettings, setFallbackSettings] = useState<GripSettings>(DEFAULT_GRIP_SETTINGS);

  // Smart settings: ΚΕΝΤΡΙΚΟ hook > Fallback
  const gripSettings = useMemo(() => {
    // 1. ✅ ΠΡΩΤΗ προτεραιότητα στο κεντρικό hook
    if (centralGripHook?.settings) {
      return validateGripSettings(centralGripHook.settings);
    }

    // 2. Local fallback
    return fallbackSettings;
  }, [centralGripHook?.settings, fallbackSettings]);
  const renderCount = useRef(0);
  renderCount.current++;

  // Sync persisted gripSettings → GripStyleStore on mount and on every settings change.
  // Without this, GripStyleStore keeps its module-level default and ignores user/persisted settings.
  useEffect(() => {
    gripStyleStore.set({
      enabled: gripSettings.showGrips,
      colors: gripSettings.colors,
      gripSize: gripSettings.gripSize,
      pickBoxSize: gripSettings.pickBoxSize,
      apertureSize: gripSettings.apertureSize,
      showGrips: gripSettings.showGrips,
      opacity: gripSettings.opacity || 1.0
    });
  }, [gripSettings]);

  // ✅ FIX (ChatGPT-5): JSON-based deep equal guard
  const isEqual = useCallback((a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b), []);

  // === STABLE UPDATE FUNCTION με Object Equality Guard ===
  const updateGripSettings = useCallback((updates: Partial<GripSettings>) => {
    // 1. ✅ ΠΡΩΤΗ προτεραιότητα στο κεντρικό hook
    if (centralGripHook?.updateSettings) {
      const currentSettings = centralGripHook.settings;
      const next = validateGripSettings({ ...currentSettings, ...updates });

      // ✅ FIX (ChatGPT-5): Guard - cut no-op updates
      if (isEqual(currentSettings, next)) {
        return;
      }

      // ✅ Κεντρική αποθήκευση μέσω DxfSettingsProvider (περιλαμβάνει auto-save)
      centralGripHook.updateSettings(updates);

      // ✅ Ενημέρωση του GripStyleStore για συνεπή πρόσβαση χωρίς context
      gripStyleStore.set({
        enabled: next.showGrips,
        colors: next.colors,
        gripSize: next.gripSize,
        pickBoxSize: next.pickBoxSize,
        apertureSize: next.apertureSize,
        showGrips: next.showGrips,
        opacity: next.opacity || 1.0
      });
      return;
    }

    // 2. Local fallback
    setFallbackSettings(prev => {
      const next = validateGripSettings({ ...prev, ...updates });

      // ✅ FIX (ChatGPT-5): Guard - cut no-op updates
      if (isEqual(prev, next)) {
        return prev;
      }

      gripStyleStore.set({
        enabled: next.showGrips,
        colors: next.colors,
        gripSize: next.gripSize,
        pickBoxSize: next.pickBoxSize,
        apertureSize: next.apertureSize,
        showGrips: next.showGrips,
        opacity: next.opacity || 1.0
      });

      return next;
    });
  }, [centralGripHook, isEqual]);

  // === RESET TO DEFAULTS FUNCTION ===
  const resetToDefaults = useCallback(() => {
    // 1. ✅ ΠΡΩΤΗ προτεραιότητα στο κεντρικό hook
    if (centralGripHook?.resetToDefaults) {
      // ✅ Κεντρική επαναφορά μέσω DxfSettingsProvider (με διεθνή πρότυπα)
      centralGripHook.resetToDefaults();
      return;
    }

    // 2. Local fallback
    setFallbackSettings(DEFAULT_GRIP_SETTINGS);
  }, [centralGripHook]);

  // === STABLE HELPER FUNCTIONS ===
  // 🏢 ADR-075: Use centralized grip size multipliers
  const getGripSize = useCallback((state: 'cold' | 'warm' | 'hot') => {
    const baseSize = gripSettings.gripSize * gripSettings.dpiScale;
    const multiplier = GRIP_SIZE_MULTIPLIERS[state.toUpperCase() as keyof typeof GRIP_SIZE_MULTIPLIERS];
    return Math.round(baseSize * multiplier);
  }, [gripSettings.gripSize, gripSettings.dpiScale]);

  const getGripColor = useCallback((state: 'cold' | 'warm' | 'hot') => {
    return gripSettings.colors[state];
  }, [gripSettings.colors]);

  // === STABLE CONTEXT VALUE με useMemo ===
  const contextValue = useMemo<GripContextType>(() => ({
    gripSettings,
    updateGripSettings,
    resetToDefaults,
    getGripSize,
    getGripColor
  }), [gripSettings, updateGripSettings, resetToDefaults, getGripSize, getGripColor]);

  return (
    <GripContext.Provider value={contextValue}>
      {children}
    </GripContext.Provider>
  );
}

// === HOOK για Context Access ===
export function useGripContext(): GripContextType {
  const context = useContext(GripContext);
  
  if (!context) {
    throw new Error('useGripContext must be used within a GripProvider');
  }
  
  
  return context;
}

// === EXPORTS ===
export default GripProvider;
export type { GripContextType };
