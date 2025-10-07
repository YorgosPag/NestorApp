import { useState, useCallback, useEffect } from 'react';
import { useDxfSettingsStore } from '../../stores/DxfSettingsStore';

export interface OverrideSettings<T> {
  overrideGlobalSettings: boolean;
  specificSettings: T;
}

export interface ConsolidatedSettingsConfig<T> {
  defaultSpecificSettings: T;
  globalSettingsHook: () => { settings: T; updateSettings: (updates: Partial<T>) => void };
  settingsKey: string; // For debugging/logging
  entityId?: string; // Optional entity ID για entity-specific overrides
  useZustand?: boolean; // Flag για χρήση Zustand store
}

export interface ConsolidatedSettingsResult<T> {
  settings: OverrideSettings<T>;
  updateSettings: (updates: Partial<OverrideSettings<T>>) => void;
  updateSpecificSettings: (updates: Partial<T>) => void;
  getEffectiveSettings: () => T;
  resetToDefaults: () => void;
}

/**
 * Unified hook για consolidation των Preview/Completion context patterns
 *
 * Παρέχει κοινή λογική για:
 * - Override checkbox management
 * - Fallback στις global settings όταν override είναι disabled
 * - Specific settings management όταν override είναι enabled
 * - Effective settings calculation
 * - Reset functionality
 * - Integration με Zustand store (όταν useZustand = true)
 */
export function useConsolidatedSettings<T>(
  config: ConsolidatedSettingsConfig<T>
): ConsolidatedSettingsResult<T> {

  const { defaultSpecificSettings, globalSettingsHook, settingsKey, entityId, useZustand = false } = config;

  // Zustand store για νέα implementation
  const zustandStore = useZustand ? useDxfSettingsStore() : null;

  // Global settings από το hook
  const globalSettings = globalSettingsHook();

  // Local state για τις override settings
  const [overrideSettings, setOverrideSettings] = useState<OverrideSettings<T>>({
    overrideGlobalSettings: false,
    specificSettings: defaultSpecificSettings
  });

  // Debug logging - commented out for performance
  // useEffect(() => {

  // }, [overrideSettings, settingsKey]);

  // Update override settings (κυρίως για το checkbox)
  const updateSettings = useCallback((updates: Partial<OverrideSettings<T>>) => {
    setOverrideSettings(prev => {
      const updated = { ...prev, ...updates };

      // 🔥 FIX (2025-10-06): ΔΕΝ αντιγράφουμε global settings όταν γίνεται enable το override!
      // Τα specific settings πρέπει να κρατούν τις δικές τους τιμές (διαφορετικές από τα general)
      // BEFORE: Όταν override ON → specificSettings = globalSettings (λάθος!)
      // AFTER: Όταν override ON → specificSettings μένουν όπως ήταν (σωστό!)

      // Removed: if (updates.overrideGlobalSettings === true && !prev.overrideGlobalSettings) {
      //   updated.specificSettings = { ...globalSettings.settings };
      // }

      return updated;
    });
  }, [settingsKey]);

  // Update μόνο τα specific settings (ΠΑΝΤΑ ανεξάρτητα από το override)
  const updateSpecificSettings = useCallback((updates: Partial<T>) => {
    // ✅ ΔΙΟΡΘΩΣΗ: Οι ειδικές ρυθμίσεις ενημερώνονται ΠΑΝΤΑ, ανεξάρτητα από το checkbox
    setOverrideSettings(prev => ({
      ...prev,
      specificSettings: { ...prev.specificSettings, ...updates }
    }));

  }, [settingsKey]);

  // Υπολογισμός των effective settings
  const getEffectiveSettings = useCallback((): T => {
    if (overrideSettings.overrideGlobalSettings) {
      // Χρησιμοποιούμε τις specific settings
      return overrideSettings.specificSettings;
    } else {
      // Fallback στις global settings
      return globalSettings.settings;
    }
  }, [overrideSettings, globalSettings.settings]);

  // Reset στις default specific settings
  const resetToDefaults = useCallback(() => {
    setOverrideSettings({
      overrideGlobalSettings: false,
      specificSettings: defaultSpecificSettings
    });

  }, [defaultSpecificSettings, settingsKey]);

  return {
    settings: overrideSettings,
    updateSettings,
    updateSpecificSettings,
    getEffectiveSettings,
    resetToDefaults
  };
}

// Utility types για specific implementations
import type { LineSettings } from '../../settings-core/types';
import type { TextSettings } from '../../contexts/TextSettingsContext';

// Basic GripSettings interface for now
export interface GripSettings {
  enabled: boolean;
  size: number;
  color: string;
  hoverColor: string;
  selectedColor: string;
}

export type LineConsolidatedSettings = ConsolidatedSettingsResult<LineSettings>;
export type TextConsolidatedSettings = ConsolidatedSettingsResult<TextSettings>;
export type GripConsolidatedSettings = ConsolidatedSettingsResult<GripSettings>;

// Factory functions για κοινά patterns
export const createLineConsolidatedSettings = (
  settingsKey: string,
  defaultSpecificSettings: LineSettings,
  globalSettingsHook: () => { settings: LineSettings; updateSettings: (updates: Partial<LineSettings>) => void }
) => {
  return useConsolidatedSettings({
    defaultSpecificSettings,
    globalSettingsHook,
    settingsKey
  });
};

export const createTextConsolidatedSettings = (
  settingsKey: string,
  defaultSpecificSettings: TextSettings,
  globalSettingsHook: () => { settings: TextSettings; updateSettings: (updates: Partial<TextSettings>) => void }
) => {
  return useConsolidatedSettings({
    defaultSpecificSettings,
    globalSettingsHook,
    settingsKey
  });
};

export const createGripConsolidatedSettings = (
  settingsKey: string,
  defaultSpecificSettings: GripSettings,
  globalSettingsHook: () => { settings: GripSettings; updateSettings: (updates: Partial<GripSettings>) => void }
) => {
  return useConsolidatedSettings({
    defaultSpecificSettings,
    globalSettingsHook,
    settingsKey
  });
};

// Utility για migration από παλιά contexts
export const migrateFromLegacyContext = <T>(
  legacyContextResult: {
    settings: { overrideGlobalSettings: boolean; [key: string]: T };
    updateSettings: (updates: Partial<{ overrideGlobalSettings: boolean; [key: string]: Partial<T> }>) => void;
    getEffectiveLineSettings?: () => T;
    getEffectiveTextSettings?: () => T;
    getEffectiveGripSettings?: () => T;
    resetToDefaults?: () => void;
  },
  settingsPropertyName: string
): ConsolidatedSettingsResult<T> => {
  // Helper για migration χωρίς breaking changes
  const migratedSettings: OverrideSettings<T> = {
    overrideGlobalSettings: legacyContextResult.settings.overrideGlobalSettings,
    specificSettings: legacyContextResult.settings[settingsPropertyName]
  };

  return {
    settings: migratedSettings,
    updateSettings: (updates) => {
      // Map το νέο format στο παλιό για backwards compatibility
      legacyContextResult.updateSettings(updates);
    },
    updateSpecificSettings: (updates) => {
      // Map στο specific property του παλιού context
      const legacyUpdates = { [settingsPropertyName]: updates };
      legacyContextResult.updateSettings(legacyUpdates);
    },
    getEffectiveSettings: legacyContextResult.getEffectiveLineSettings ||
                         legacyContextResult.getEffectiveTextSettings ||
                         legacyContextResult.getEffectiveGripSettings ||
                         (() => legacyContextResult.settings[settingsPropertyName]),
    resetToDefaults: legacyContextResult.resetToDefaults || (() => {})
  };
};