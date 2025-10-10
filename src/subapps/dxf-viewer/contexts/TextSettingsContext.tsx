'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
// ===== ΝΕΑ UNIFIED PROVIDERS (για internal use) =====
import { useViewerConfig } from '../providers/ConfigurationProvider';
// ===== ΚΕΝΤΡΙΚΟ AUTO-SAVE ΣΎΣΤΗΜΑ =====
import { useTextSettingsFromProvider } from '../settings-provider';
// ===== OVERRIDE GUARD SYSTEM =====
import { guardGlobalAccess } from '../../../utils/overrideGuard';

// Text Settings Interface
export interface TextSettings {
  enabled: boolean;          // ΝΕΟ! Ενεργοποίηση/απενεργοποίηση εμφάνισης κειμένου
  fontFamily: string;
  fontSize: number;
  color: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  isSuperscript: boolean;
  isSubscript: boolean;
}

export interface TextTemplate {
  name: string;
  category: 'heading' | 'body' | 'technical' | 'artistic' | 'custom';
  description: string;
  settings: TextSettings;
}

// Context Interface
interface TextSettingsContextType {
  settings: TextSettings;
  updateSettings: (updates: Partial<TextSettings>) => void;
  resetToDefaults: () => void;
  applyTemplate: (template: TextTemplate) => void;
}

// Default settings (ISO 3098 International Standards)
const defaultTextSettings: TextSettings = {
  enabled: true,               // Default: κείμενο ενεργοποιημένο
  fontFamily: 'Arial, sans-serif', // ✅ ISO 3098: Sans-serif font recommended
  fontSize: 2.5,               // ✅ ISO 3098: Standard 2.5mm text height
  color: '#FFFFFF',            // ✅ AutoCAD ACI 7: White for text
  isBold: false,               // ✅ ISO 3098: Normal weight default
  isItalic: false,             // ✅ ISO 3098: Upright text default
  isUnderline: false,          // ✅ ISO 3098: No underline default
  isStrikethrough: false,      // ✅ ISO 3098: No strikethrough default
  isSuperscript: false,        // ✅ ISO 3098: Normal script default
  isSubscript: false           // ✅ ISO 3098: Normal script default
};

// Default templates
export const TEXT_TEMPLATES: TextTemplate[] = [
  {
    name: 'Κανονικό Κείμενο',
    category: 'body',
    description: 'Βασικό κείμενο για γενική χρήση (ISO 3098)',
    settings: {
      enabled: true,
      fontFamily: 'Arial, sans-serif',    // ✅ ISO 3098: Sans-serif font recommended
      fontSize: 2.5,                      // ✅ ISO 3098: Standard 2.5mm text height
      color: '#FFFFFF',                   // ✅ AutoCAD ACI 7: White for text
      isBold: false,
      isItalic: false,
      isUnderline: false,
      isStrikethrough: false,
      isSuperscript: false,
      isSubscript: false
    }
  },
  {
    name: 'Τίτλος',
    category: 'heading',
    description: 'Μεγάλος τίτλος (ISO 3098)',
    settings: {
      enabled: true,
      fontFamily: 'Arial, sans-serif',    // ✅ ISO 3098: Sans-serif font recommended
      fontSize: 3.5,                      // ✅ ISO 3098: Larger text for headings
      color: '#FFFFFF',                   // ✅ AutoCAD ACI 7: White for text
      isBold: true,
      isItalic: false,
      isUnderline: false,
      isStrikethrough: false,
      isSuperscript: false,
      isSubscript: false
    }
  },
  {
    name: 'Τεχνικό Κείμενο',
    category: 'technical',
    description: 'Κείμενο για τεχνικά σχέδια (ISO 3098)',
    settings: {
      enabled: true,
      fontFamily: 'Arial, sans-serif',    // ✅ ISO 3098: Sans-serif font recommended
      fontSize: 2.0,                      // ✅ ISO 3098: Smaller text for technical notes
      color: '#FFFFFF',                   // ✅ AutoCAD ACI 7: White for text
      isBold: false,
      isItalic: false,
      isUnderline: false,
      isStrikethrough: false,
      isSuperscript: false,
      isSubscript: false
    }
  }
];

// Create Context
const TextSettingsContext = createContext<TextSettingsContextType | null>(null);

// Provider Component
export function TextSettingsProvider({ children }: { children: React.ReactNode }) {
  // ===== ΠΡΟΣΠΑΘΕΙΑ ΚΕΝΤΡΙΚΗΣ ΣΥΝΔΕΣΗΣ =====
  let centralTextHook = null;
  try {
    // ✅ ΧΡΗΣΗ ΕΙΔΙΚΟΥ HOOK για text settings από το κεντρικό σύστημα
    centralTextHook = useTextSettingsFromProvider();
  } catch (error) {
    // DxfSettingsProvider not available, continue with fallback
    centralTextHook = null;
  }

  // ===== LEGACY UNIFIED CONFIG (για backwards compatibility) =====
  let unifiedConfig = null;
  try {
    unifiedConfig = useViewerConfig();
  } catch (error) {
    // Fallback to old approach if unified providers not available
  }

  // Fallback state για backwards compatibility
  const [fallbackSettings, setFallbackSettings] = useState<TextSettings>(defaultTextSettings);

  // Smart settings: ΚΕΝΤΡΙΚΟ hook > Unified config > Fallback
  const settings = useMemo(() => {
    // 1. ✅ ΠΡΩΤΗ προτεραιότητα στο κεντρικό hook
    if (centralTextHook?.settings) {
      return centralTextHook.settings;
    }

    // 2. Fallback στο unified config
    if (unifiedConfig) {
      return unifiedConfig.config.entities.text.general;
    }

    // 3. Local fallback
    return fallbackSettings;
  }, [centralTextHook?.settings, unifiedConfig, fallbackSettings]);

  // ===== AUTO-SAVE FUNCTIONALITY DISABLED =====
  // const autoSaveStatus = useAutoSaveSettings({
  //   storageKey: 'dxf-text-general-settings',
  //   data: settings,
  //   enabled: true,
  //   debounceMs: 500,
  //   onSaved: (data) => {
  //   },
  //   onError: (error) => {
  //     console.error('❌ [TextSettings] Σφάλμα αποθήκευσης:', error);
  //   }
  // });

  const updateSettings = useCallback((updates: Partial<TextSettings>) => {
    // 1. ✅ ΠΡΩΤΗ προτεραιότητα στο κεντρικό hook
    if (centralTextHook?.updateSettings) {
      // ✅ Κεντρική αποθήκευση μέσω DxfSettingsProvider (περιλαμβάνει auto-save)
      centralTextHook.updateSettings(updates);
      return;
    }

    // 2. Fallback στο unified config
    if (unifiedConfig) {
      unifiedConfig.updateEntityConfig('text', {
        general: { ...unifiedConfig.config.entities.text.general, ...updates }
      });
      return;
    }

    // 3. Local fallback
    setFallbackSettings(prev => ({ ...prev, ...updates }));
  }, [centralTextHook, unifiedConfig]);

  const resetToDefaults = useCallback(() => {
    // 1. ✅ ΠΡΩΤΗ προτεραιότητα στο κεντρικό hook
    if (centralTextHook?.resetToDefaults) {
      // ✅ Κεντρική επαναφορά μέσω DxfSettingsProvider (με διεθνή πρότυπα)
      centralTextHook.resetToDefaults();
      return;
    }

    // 2. Fallback στο unified config
    if (unifiedConfig) {
      // Χρήση νέου unified system
      unifiedConfig.updateEntityConfig('text', {
        general: defaultTextSettings
      });
    } else {
      // 3. Local fallback
      setFallbackSettings(defaultTextSettings);
    }
  }, [centralTextHook, unifiedConfig]);

  const applyTemplate = useCallback((template: TextTemplate) => {
    const newSettings = {
      ...settings,
      ...template.settings
    };
    updateSettings(newSettings);
  }, [settings, updateSettings]);

  const value: TextSettingsContextType = {
    settings,
    updateSettings,
    resetToDefaults,
    applyTemplate
  };

  return (
    <TextSettingsContext.Provider value={value}>
      {children}
    </TextSettingsContext.Provider>
  );
}

// Hook
export function useTextSettings(): TextSettingsContextType {
  const context = useContext(TextSettingsContext);
  if (!context) {
    throw new Error('useTextSettings must be used within a TextSettingsProvider');
  }

  // 🔥 GUARD: Προστασία πρόσβασης στις γενικές text settings όταν override ενεργό
  return {
    ...context,
    get settings() {
      guardGlobalAccess('TEXT_SETTINGS_READ');
      return context.settings;
    },
    updateSettings: (updates: Partial<TextSettings>) => {
      guardGlobalAccess('TEXT_SETTINGS_UPDATE');
      return context.updateSettings(updates);
    },
    resetToDefaults: () => {
      guardGlobalAccess('TEXT_SETTINGS_RESET');
      return context.resetToDefaults();
    },
    applyTemplate: (template: TextTemplate) => {
      guardGlobalAccess('TEXT_SETTINGS_TEMPLATE');
      return context.applyTemplate(template);
    }
  };
}