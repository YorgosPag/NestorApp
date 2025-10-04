import { useState, useCallback, useEffect } from 'react';

export interface OverrideSettings<T> {
  overrideGlobalSettings: boolean;
  specificSettings: T;
}

export interface ConsolidatedSettingsConfig<T> {
  defaultSpecificSettings: T;
  globalSettingsHook: () => { settings: T; updateSettings: (updates: Partial<T>) => void };
  settingsKey: string; // For debugging/logging
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
 */
export function useConsolidatedSettings<T>(
  config: ConsolidatedSettingsConfig<T>
): ConsolidatedSettingsResult<T> {

  const { defaultSpecificSettings, globalSettingsHook, settingsKey } = config;

  // Global settings από το hook
  const globalSettings = globalSettingsHook();

  // Local state για τις override settings
  const [overrideSettings, setOverrideSettings] = useState<OverrideSettings<T>>({
    overrideGlobalSettings: false,
    specificSettings: defaultSpecificSettings
  });

  // Debug logging - commented out for performance
  // useEffect(() => {
  //   console.log(`🔧 [useConsolidatedSettings:${settingsKey}] Override Mode:`,
  //               overrideSettings.overrideGlobalSettings,
  //               'Specific Settings:', overrideSettings.specificSettings);
  // }, [overrideSettings, settingsKey]);

  // Update override settings (κυρίως για το checkbox)
  const updateSettings = useCallback((updates: Partial<OverrideSettings<T>>) => {
    setOverrideSettings(prev => {
      const updated = { ...prev, ...updates };

      // Αν ενεργοποιήθηκε το override, αρχικοποιούμε με τις τρέχουσες global settings
      if (updates.overrideGlobalSettings === true && !prev.overrideGlobalSettings) {
        updated.specificSettings = { ...globalSettings.settings };
        console.log(`✅ [useConsolidatedSettings:${settingsKey}] Override enabled, initialized with global settings`);
      }

      return updated;
    });
  }, [globalSettings.settings, settingsKey]);

  // Update μόνο τα specific settings (ΠΑΝΤΑ ανεξάρτητα από το override)
  const updateSpecificSettings = useCallback((updates: Partial<T>) => {
    // ✅ ΔΙΟΡΘΩΣΗ: Οι ειδικές ρυθμίσεις ενημερώνονται ΠΑΝΤΑ, ανεξάρτητα από το checkbox
    setOverrideSettings(prev => ({
      ...prev,
      specificSettings: { ...prev.specificSettings, ...updates }
    }));
    console.log(`🔧 [useConsolidatedSettings:${settingsKey}] Updated specific settings (always independent)`);
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
    console.log(`🔄 [useConsolidatedSettings:${settingsKey}] Reset to defaults`);
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
export type LineConsolidatedSettings = ConsolidatedSettingsResult<any>; // Θα γίνει τύπος όταν έχουμε τα τύπους
export type TextConsolidatedSettings = ConsolidatedSettingsResult<any>;
export type GripConsolidatedSettings = ConsolidatedSettingsResult<any>;

// Factory functions για κοινά patterns
export const createLineConsolidatedSettings = (
  settingsKey: string,
  defaultSpecificSettings: any,
  globalSettingsHook: () => any
) => {
  return useConsolidatedSettings({
    defaultSpecificSettings,
    globalSettingsHook,
    settingsKey
  });
};

export const createTextConsolidatedSettings = (
  settingsKey: string,
  defaultSpecificSettings: any,
  globalSettingsHook: () => any
) => {
  return useConsolidatedSettings({
    defaultSpecificSettings,
    globalSettingsHook,
    settingsKey
  });
};

export const createGripConsolidatedSettings = (
  settingsKey: string,
  defaultSpecificSettings: any,
  globalSettingsHook: () => any
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
    settings: { overrideGlobalSettings: boolean; [key: string]: any };
    updateSettings: (updates: any) => void;
    [key: string]: any;
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