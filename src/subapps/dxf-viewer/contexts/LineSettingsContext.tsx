'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { LINE_TYPE_LABELS, LINE_CAP_LABELS, LINE_JOIN_LABELS } from './LineConstants';
import { getDashArray } from '../settings-core/defaults';
// ===== ΝΕΑ UNIFIED PROVIDERS (για internal use) =====
import { useViewerConfig } from '../providers/ConfigurationProvider';
// ===== ΚΕΝΤΡΙΚΟ AUTO-SAVE ΣΎΣΤΗΜΑ =====
import { useLineSettingsFromProvider } from '../settings-provider';
// ===== OVERRIDE GUARD SYSTEM =====
import { guardGlobalAccess } from '../../../utils/overrideGuard';
// ===== CENTRALIZED COLORS =====
import { UI_COLORS } from '../config/color-config';

// ✅ ΔΙΟΡΑΘΩΣΗ ΔΙΠΛΟΤΥΠΩΝ: Use unified types από settings-core
import type { LineType, LineCapStyle, LineJoinStyle, LineSettings } from '../settings-core/types';

export interface LineTemplate {
  name: string;
  category: TemplateCategory;
  description: string;
  settings: LineSettings;
}

export type TemplateCategory = 'engineering' | 'architectural' | 'electrical' | 'custom';

export interface LineSettingsContextType {
  settings: LineSettings;
  updateSettings: (updates: Partial<LineSettings>) => void;
  resetToDefaults: () => void;
  applyTemplate: (template: LineTemplate) => void;
  getCurrentDashPattern: () => number[];
}

// Default settings
const defaultSettings: LineSettings = {
  enabled: true,               // Default: γραμμές ενεργοποιημένες
  lineType: 'solid',           // ✅ ISO 128: Continuous line as default
  lineWidth: 0.25,             // ✅ ISO 128: Standard 0.25mm line weight
  color: UI_COLORS.WHITE,            // ✅ AutoCAD ACI 7: White for main lines
  opacity: 1.0,                // ✅ Full opacity standard
  dashScale: 1.0,              // ✅ Standard dash scale
  dashOffset: 0,               // ✅ No offset standard
  lineCap: 'round',            // ✅ Round caps standard
  lineJoin: 'round',           // ✅ Round joins standard
  breakAtCenter: false,        // ✅ No break at center default
  hoverColor: UI_COLORS.SNAP_DEFAULT,       // ✅ AutoCAD ACI 2: Yellow for hover
  hoverType: 'solid',          // ✅ Solid hover type
  hoverWidth: 0.35,            // ✅ ISO 128: Next standard width
  hoverOpacity: 0.8,           // ✅ Reduced opacity for hover
  finalColor: UI_COLORS.MEASUREMENT_TEXT,       // ✅ AutoCAD ACI 3: Green for final state
  finalType: 'solid',          // ✅ Solid final type
  finalWidth: 0.35,            // ✅ ISO 128: Slightly thicker for final
  finalOpacity: 1.0,           // ✅ Full opacity for final
  activeTemplate: null,        // ✅ No active template default
};


const LineSettingsContext = createContext<LineSettingsContextType | null>(null);

/**
 * Line Settings Provider - Refactored για Enterprise-Grade Architecture
 *
 * ΠΡΟΗΓΟΥΜΕΝΗ ΚΑΤΑΣΤΑΣΗ: Isolated context με δικό του state management
 * ΝΕΑ ΚΑΤΑΣΤΑΣΗ: Hybrid approach - χρησιμοποιεί unified ConfigurationProvider εσωτερικά
 *
 * BACKWARD COMPATIBILITY: Διατηρεί το ίδιο external API για μηδενικά breaking changes
 * PERFORMANCE: Fallback mechanism για smooth transition και stability
 *
 * @see ConfigurationProvider για την unified configuration logic
 * @see StyleManagerProvider για store synchronization
 */
export function LineSettingsProvider({ children }: { children: React.ReactNode }) {
  // ===== ΠΡΟΣΠΑΘΕΙΑ ΚΕΝΤΡΙΚΗΣ ΣΥΝΔΕΣΗΣ =====
  let centralLineHook = null;
  try {
    // ✅ ΧΡΗΣΗ ΕΙΔΙΚΟΥ HOOK για line settings από το κεντρικό σύστημα
    centralLineHook = useLineSettingsFromProvider();
  } catch (error) {
    // DxfSettingsProvider not available, continue with fallback
    centralLineHook = null;
  }

  // ===== LEGACY UNIFIED CONFIG (για backwards compatibility) =====
  let unifiedConfig = null;
  try {
    unifiedConfig = useViewerConfig();
  } catch (error) {
    // Fallback to old approach if unified providers not available
  }

  // Fallback state για backwards compatibility
  const [fallbackSettings, setFallbackSettings] = useState<LineSettings>(defaultSettings);

  // Smart settings: ΚΕΝΤΡΙΚΟ hook > Unified config > Fallback
  const settings = useMemo(() => {
    // 1. ✅ ΠΡΩΤΗ προτεραιότητα στο κεντρικό hook
    if (centralLineHook?.settings) {
      return centralLineHook.settings;
    }

    // 2. Fallback στο unified config
    if (unifiedConfig) {
      return unifiedConfig.config.entities.line.general;
    }

    // 3. Local fallback
    return fallbackSettings;
  }, [centralLineHook?.settings, unifiedConfig, fallbackSettings]);

  // ===== AUTO-SAVE FUNCTIONALITY DISABLED =====
  // const autoSaveStatus = useAutoSaveSettings({
  //   storageKey: 'dxf-line-general-settings',
  //   data: settings,
  //   enabled: true,
  //   debounceMs: 500,
  //   onSaved: (data) => {
  //   },
  //   onError: (error) => {
  //     console.error('❌ [LineSettings] Σφάλμα αποθήκευσης:', error);
  //   }
  // });

  const updateSettings = useCallback((updates: Partial<LineSettings>) => {
    // 1. ✅ ΠΡΩΤΗ προτεραιότητα στο κεντρικό hook
    if (centralLineHook?.updateSettings) {
      // ✅ Κεντρική αποθήκευση μέσω DxfSettingsProvider (περιλαμβάνει auto-save)
      centralLineHook.updateSettings(updates);
      return;
    }

    // 2. Fallback στο unified config
    if (unifiedConfig) {
      unifiedConfig.updateEntityConfig('line', {
        general: { ...unifiedConfig.config.entities.line.general, ...updates }
      });
      return;
    }

    // 3. Local fallback
    setFallbackSettings(prev => ({
      ...prev,
      ...updates,
      activeTemplate: updates.activeTemplate !== undefined ? updates.activeTemplate : null
    }));
  }, [centralLineHook, unifiedConfig]);

  const resetToDefaults = useCallback(() => {
    // 1. ✅ ΠΡΩΤΗ προτεραιότητα στο κεντρικό hook
    if (centralLineHook?.resetToDefaults) {
      // ✅ Κεντρική επαναφορά μέσω DxfSettingsProvider (με διεθνή πρότυπα)
      centralLineHook.resetToDefaults();
      return;
    }

    // 2. Fallback στο unified config
    if (unifiedConfig) {
      // Χρήση νέου unified system
      unifiedConfig.updateEntityConfig('line', {
        general: defaultSettings
      });
    } else {
      // 3. Local fallback
      setFallbackSettings(defaultSettings);
    }
  }, [centralLineHook, unifiedConfig]);

  const applyTemplate = useCallback((template: LineTemplate) => {
    const newSettings = {
      ...settings,
      ...template.settings,
      activeTemplate: template.name
    };
    updateSettings(newSettings);
  }, [settings, updateSettings]);

  const getCurrentDashPattern = useCallback((): number[] => {
    return getDashArray(settings.lineType, settings.dashScale);
  }, [settings.lineType, settings.dashScale]);

  const value: LineSettingsContextType = {
    settings,
    updateSettings,
    resetToDefaults,
    applyTemplate,
    getCurrentDashPattern,
  };

  return (
    <LineSettingsContext.Provider value={value}>
      {children}
    </LineSettingsContext.Provider>
  );
}

export function useLineSettings(): LineSettingsContextType {
  const context = useContext(LineSettingsContext);
  if (!context) {
    throw new Error('useLineSettings must be used within a LineSettingsProvider');
  }

  // 🔥 GUARD: Προστασία πρόσβασης στις γενικές line settings όταν override ενεργό
  return {
    ...context,
    get settings() {
      guardGlobalAccess('LINE_SETTINGS_READ');
      return context.settings;
    },
    updateSettings: (updates: Partial<LineSettings>) => {
      guardGlobalAccess('LINE_SETTINGS_UPDATE');
      return context.updateSettings(updates);
    },
    resetToDefaults: () => {
      guardGlobalAccess('LINE_SETTINGS_RESET');
      return context.resetToDefaults();
    }
  };
}