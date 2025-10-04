'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import type { GripSettings } from '../types/gripSettings';
import { validateGripSettings, DEFAULT_GRIP_SETTINGS } from '../types/gripSettings';
import { gripStyleStore } from '../stores/GripStyleStore';
// ===== ΝΕΑ UNIFIED PROVIDERS (για internal use) =====
import { useViewerConfig } from './ConfigurationProvider';
import { useDxfSettings, useGripSettingsFromProvider } from './DxfSettingsProvider';

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
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  
  return true;
}

// === STABLE GRIP PROVIDER ===
export function GripProvider({ children }: GripProviderProps) {
  // ===== ΠΡΟΣΠΑΘΕΙΑ ΚΕΝΤΡΙΚΗΣ ΣΥΝΔΕΣΗΣ =====
  let centralGripHook = null;
  try {
    // ✅ ΧΡΗΣΗ ΕΙΔΙΚΟΥ HOOK για grip settings από το κεντρικό σύστημα
    centralGripHook = useGripSettingsFromProvider();
  } catch (error) {
    // DxfSettingsProvider not available, continue with fallback
    centralGripHook = null;
  }

  // ===== LEGACY UNIFIED CONFIG (για backwards compatibility) =====
  let unifiedConfig = null;
  try {
    unifiedConfig = useViewerConfig();
  } catch (error) {
    // Fallback to old approach if unified providers not available
  }

  // Fallback state για backwards compatibility
  const [fallbackSettings, setFallbackSettings] = useState<GripSettings>(DEFAULT_GRIP_SETTINGS);

  // Smart settings: ΚΕΝΤΡΙΚΟ hook > Unified config > Fallback
  const gripSettings = useMemo(() => {
    // 1. ✅ ΠΡΩΤΗ προτεραιότητα στο κεντρικό hook
    if (centralGripHook?.settings) {
      return validateGripSettings(centralGripHook.settings);
    }

    // 2. Fallback στο unified config
    if (unifiedConfig) {
      const effectiveSettings = unifiedConfig.getEffectiveSettings();
      return effectiveSettings?.grip ? validateGripSettings(effectiveSettings.grip) : DEFAULT_GRIP_SETTINGS;
    }

    // 3. Local fallback
    return fallbackSettings;
  }, [centralGripHook?.settings, unifiedConfig, fallbackSettings]);
  const renderCount = useRef(0);
  renderCount.current++;

  // === STABLE UPDATE FUNCTION με Object Equality Guard ===
  const updateGripSettings = useCallback((updates: Partial<GripSettings>) => {
    // 1. ✅ ΠΡΩΤΗ προτεραιότητα στο κεντρικό hook
    if (centralGripHook?.updateSettings) {
      const currentSettings = centralGripHook.settings;
      const next = validateGripSettings({ ...currentSettings, ...updates });

      // === CRITICAL: Object stability check ===
      if (deepEqual(currentSettings, next)) {
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

    // 2. Fallback στο unified config
    if (unifiedConfig) {
      // Χρήση νέου unified system
      const currentSettings = unifiedConfig.config.entities.grip.general;
      const next = validateGripSettings({ ...currentSettings, ...updates });

      // === CRITICAL: Object stability check ===
      if (deepEqual(currentSettings, next)) {
        return;
      }

      unifiedConfig.updateEntityConfig('grip', {
        general: next
      });

      // ✅ ΝΕΟ: Ενημέρωση του GripStyleStore για συνεπή πρόσβαση χωρίς context
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

    // 3. Local fallback
    setFallbackSettings(prev => {
      const next = validateGripSettings({ ...prev, ...updates });

      if (deepEqual(prev, next)) {
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
  }, [centralGripHook, unifiedConfig]);

  // === RESET TO DEFAULTS FUNCTION ===
  const resetToDefaults = useCallback(() => {
    // 1. ✅ ΠΡΩΤΗ προτεραιότητα στο κεντρικό hook
    if (centralGripHook?.resetToDefaults) {
      // ✅ Κεντρική επαναφορά μέσω DxfSettingsProvider (με διεθνή πρότυπα)
      centralGripHook.resetToDefaults();
      return;
    }

    // 2. Fallback στο unified config
    if (unifiedConfig) {
      // Χρήση νέου unified system
      unifiedConfig.updateEntityConfig('grip', {
        general: DEFAULT_GRIP_SETTINGS
      });
    } else {
      // 3. Local fallback
      setFallbackSettings(DEFAULT_GRIP_SETTINGS);
    }
  }, [centralGripHook, unifiedConfig]);

  // === STABLE HELPER FUNCTIONS ===
  const getGripSize = useCallback((state: 'cold' | 'warm' | 'hot') => {
    const baseSize = gripSettings.gripSize * gripSettings.dpiScale;
    switch (state) {
      case 'warm': return Math.round(baseSize * 1.2);
      case 'hot': return Math.round(baseSize * 1.4);
      case 'cold':
      default: return Math.round(baseSize);
    }
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
