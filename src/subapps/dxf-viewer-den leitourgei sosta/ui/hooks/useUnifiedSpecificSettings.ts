import { useConsolidatedSettings } from './useConsolidatedSettings';
import { useLineSettingsFromProvider, useTextSettingsFromProvider } from '../../providers/DxfSettingsProvider';
import type { LineSettings } from '../../settings-core/types';
import type { TextSettings } from '../../contexts/TextSettingsContext';

// Default settings για διαφορετικούς τύπους

// Line Preview defaults - με το enabled!
const defaultLinePreviewSettings: LineSettings = {
  enabled: true,  // ✅ Διατηρούμε το enabled στις ειδικές ρυθμίσεις
  lineType: 'dashed',
  lineWidth: 2,
  color: '#ffffff',
  opacity: 1.0,
  dashScale: 1.0,
  dashOffset: 0,
  lineCap: 'butt',
  lineJoin: 'miter',
  breakAtCenter: false,
  hoverColor: '#ffff00',
  hoverType: 'solid',
  hoverWidth: 3,
  hoverOpacity: 0.8,
  finalColor: '#00ff00',
  finalType: 'solid',
  finalWidth: 2,
  finalOpacity: 1.0,
  activeTemplate: null,
};

// Line Completion defaults
const defaultLineCompletionSettings: LineSettings = {
  enabled: true,
  lineType: 'solid',               // ✅ ISO 128: Continuous line as default
  lineWidth: 0.25,                 // ✅ ISO 128: Standard 0.25mm line weight
  color: '#FFFFFF',                // ✅ AutoCAD ACI 7: White for main lines
  opacity: 1.0,                    // ✅ Full opacity standard
  dashScale: 1.0,                  // ✅ Standard dash scale
  dashOffset: 0,                   // ✅ No offset standard
  lineCap: 'round',                // ✅ Round caps standard
  lineJoin: 'round',               // ✅ Round joins standard
  breakAtCenter: false,            // ✅ No break at center default
  hoverColor: '#FFFF00',           // ✅ AutoCAD ACI 2: Yellow for hover
  hoverType: 'solid',              // ✅ Solid hover type
  hoverWidth: 0.35,                // ✅ ISO 128: Next standard width
  hoverOpacity: 0.8,               // ✅ Reduced opacity for hover
  finalColor: '#00FF00',           // ✅ AutoCAD ACI 3: Green for final state
  finalType: 'solid',              // ✅ Solid final type
  finalWidth: 0.35,                // ✅ ISO 128: Slightly thicker for final
  finalOpacity: 1.0,               // ✅ Full opacity for final
  activeTemplate: null,
};

// Text Preview defaults - ✅ Updated to ISO 3098 standards
const defaultTextPreviewSettings: TextSettings = {
  enabled: true,
  fontFamily: 'Arial, sans-serif',    // ✅ ISO 3098: Sans-serif font recommended
  fontSize: 2.5,                      // ✅ ISO 3098: Standard 2.5mm text height
  color: '#FFFFFF',                   // ✅ AutoCAD ACI 7: White for text
  isBold: false,                      // ✅ ISO 3098: Normal weight default
  isItalic: false,                    // ✅ ISO 3098: Upright text default
  isUnderline: false,                 // ✅ ISO 3098: No underline default
  isStrikethrough: false,             // ✅ ISO 3098: No strikethrough default
  isSuperscript: false,               // ✅ ISO 3098: Normal script default
  isSubscript: false,                 // ✅ ISO 3098: Normal script default
};

// Unified hooks που χρησιμοποιούν το consolidated pattern

/**
 * Unified Line Preview Settings Hook
 * ⚠️ LEGACY: Χρησιμοποιείται μόνο από το DxfSettingsProvider.tsx
 * ΓΙΑ ΝΕΕΣ ΚΑΡΤΕΛΕΣ: Χρησιμοποιήστε τα ξεχωριστά hooks παρακάτω
 */
export function useUnifiedLinePreview() {
  const globalLineSettings = useLineSettingsFromProvider();

  const consolidated = useConsolidatedSettings({
    defaultSpecificSettings: defaultLinePreviewSettings,
    globalSettingsHook: () => globalLineSettings,
    settingsKey: 'LinePreview'
  });

  // Backwards compatibility interface
  return {
    settings: {
      overrideGlobalSettings: consolidated.settings.overrideGlobalSettings,
      lineSettings: consolidated.settings.specificSettings
    },
    updateSettings: (updates: { overrideGlobalSettings?: boolean; lineSettings?: Partial<LineSettings> }) => {
      if (updates.overrideGlobalSettings !== undefined) {
        consolidated.updateSettings({ overrideGlobalSettings: updates.overrideGlobalSettings });
      }
      if (updates.lineSettings) {
        consolidated.updateSpecificSettings(updates.lineSettings);
      }
    },
    updateLineSettings: consolidated.updateSpecificSettings,
    getEffectiveLineSettings: consolidated.getEffectiveSettings,
    resetToDefaults: consolidated.resetToDefaults,
    getCurrentDashPattern: globalLineSettings.getCurrentDashPattern
  };
}

/**
 * Unified Line Completion Settings Hook
 * ✅ ΕΝΕΡΓΟ: Χρησιμοποιείται για Completion tab στο EntitiesSettings.tsx
 */
export function useUnifiedLineCompletion() {
  const globalLineSettings = useLineSettingsFromProvider();

  const consolidated = useConsolidatedSettings({
    defaultSpecificSettings: defaultLineCompletionSettings,
    globalSettingsHook: () => globalLineSettings,
    settingsKey: 'LineCompletion'
  });

  // Backwards compatibility interface
  return {
    settings: {
      overrideGlobalSettings: consolidated.settings.overrideGlobalSettings,
      lineSettings: consolidated.settings.specificSettings
    },
    updateSettings: (updates: { overrideGlobalSettings?: boolean; lineSettings?: Partial<LineSettings> }) => {
      if (updates.overrideGlobalSettings !== undefined) {
        consolidated.updateSettings({ overrideGlobalSettings: updates.overrideGlobalSettings });
      }
      if (updates.lineSettings) {
        consolidated.updateSpecificSettings(updates.lineSettings);
      }
    },
    updateLineSettings: consolidated.updateSpecificSettings,
    getEffectiveLineSettings: consolidated.getEffectiveSettings,
    resetToDefaults: consolidated.resetToDefaults,
    getCurrentDashPattern: globalLineSettings.getCurrentDashPattern
  };
}

/**
 * Unified Text Preview Settings Hook
 * ✅ ΕΝΕΡΓΟ: Χρησιμοποιείται για Text settings στο EntitiesSettings.tsx
 */
export function useUnifiedTextPreview() {
  const globalTextSettings = useTextSettingsFromProvider();

  const consolidated = useConsolidatedSettings({
    defaultSpecificSettings: defaultTextPreviewSettings,
    globalSettingsHook: () => globalTextSettings,
    settingsKey: 'TextPreview'
  });

  // Backwards compatibility interface
  return {
    settings: {
      overrideGlobalSettings: consolidated.settings.overrideGlobalSettings,
      textSettings: consolidated.settings.specificSettings
    },
    updateSettings: (updates: { overrideGlobalSettings?: boolean; textSettings?: Partial<TextSettings> }) => {
      if (updates.overrideGlobalSettings !== undefined) {
        consolidated.updateSettings({ overrideGlobalSettings: updates.overrideGlobalSettings });
      }
      if (updates.textSettings) {
        consolidated.updateSpecificSettings(updates.textSettings);
      }
    },
    updateTextSettings: consolidated.updateSpecificSettings,
    getEffectiveTextSettings: consolidated.getEffectiveSettings,
    resetToDefaults: consolidated.resetToDefaults
  };
}

// Grip settings (placeholder - θα χρειαστεί το actual GripSettings type)
interface MockGripSettings {
  enabled: boolean;
  gripSize: number;
  pickBoxSize: number;
  apertureSize: number;
  opacity: number;
  colors: {
    cold: string;
    warm: string;
    hot: string;
    contour: string;
  };
  showAperture: boolean;
  multiGripEdit: boolean;
  snapToGrips: boolean;
  showMidpoints: boolean;
  showCenters: boolean;
  showQuadrants: boolean;
  maxGripsPerEntity: number;
}

const defaultGripPreviewSettings: MockGripSettings = {
  enabled: true,
  gripSize: 5,              // ✅ AutoCAD GRIPSIZE default: 5 DIP
  pickBoxSize: 3,           // ✅ AutoCAD PICKBOX default: 3 DIP
  apertureSize: 10,         // ✅ AutoCAD APERTURE default: 10 pixels
  opacity: 1.0,             // ✅ Full opacity by default
  colors: {
    cold: '#0000FF',        // ✅ AutoCAD standard: Blue (ACI 5) - unselected grips
    warm: '#FF69B4',        // ✅ AutoCAD standard: Hot Pink - hover grips
    hot: '#FF0000',         // ✅ AutoCAD standard: Red (ACI 1) - selected grips
    contour: '#000000'      // ✅ AutoCAD standard: Black contour
  },
  showAperture: true,       // ✅ AutoCAD APBOX default: enabled
  multiGripEdit: true,      // ✅ ΑΠΟΚΑΤΑΣΤΑΣΗ: Ενεργοποίηση multi grips
  snapToGrips: true,        // ✅ ΑΠΟΚΑΤΑΣΤΑΣΗ: Ενεργοποίηση snap to grips
  showMidpoints: true,      // ✅ Show midpoint grips
  showCenters: true,        // ✅ Show center grips
  showQuadrants: true,      // ✅ Show quadrant grips
  maxGripsPerEntity: 50     // ✅ Default maximum grips per entity
};

/**
 * Unified Grip Preview Settings Hook (Mock implementation)
 */
export function useUnifiedGripPreview() {
  // Mock global grip settings hook
  const mockGlobalGripSettings = () => ({
    settings: defaultGripPreviewSettings,
    updateSettings: (updates: Partial<MockGripSettings>) => {

    }
  });

  const consolidated = useConsolidatedSettings({
    defaultSpecificSettings: defaultGripPreviewSettings,
    globalSettingsHook: mockGlobalGripSettings,
    settingsKey: 'GripPreview'
  });

  // Backwards compatibility interface
  return {
    settings: {
      overrideGlobalSettings: consolidated.settings.overrideGlobalSettings,
      gripSettings: consolidated.settings.specificSettings
    },
    updateSettings: (updates: { overrideGlobalSettings?: boolean; gripSettings?: Partial<MockGripSettings> }) => {
      if (updates.overrideGlobalSettings !== undefined) {
        consolidated.updateSettings({ overrideGlobalSettings: updates.overrideGlobalSettings });
      }
      if (updates.gripSettings) {
        consolidated.updateSpecificSettings(updates.gripSettings);
      }
    },
    updateGripSettings: consolidated.updateSpecificSettings,
    getEffectiveGripSettings: consolidated.getEffectiveSettings,
    resetToDefaults: consolidated.resetToDefaults
  };
}

// ============================================================================
// ΞΕΧΩΡΙΣΤΑ HOOKS ΓΙΑ ΚΑΘΕ ΚΑΡΤΕΛΑ - ΚΑΜΙΑ ΚΟΙΝΟΠΟΙΗΣΗ SETTINGS
// ============================================================================

/**
 * Hook για Draft/Προσχεδίαση καρτέλα
 * ✅ ΕΝΕΡΓΟ: Νέο ξεχωριστό hook για απομόνωση settings
 */
export function useUnifiedLineDraft() {
  const globalLineSettings = useLineSettingsFromProvider();

  const consolidated = useConsolidatedSettings({
    defaultSpecificSettings: defaultLinePreviewSettings,
    globalSettingsHook: () => globalLineSettings,
    settingsKey: 'LineDraft'  // 🔥 ΞΕΧΩΡΙΣΤΟ KEY!
  });

  return {
    settings: {
      overrideGlobalSettings: consolidated.settings.overrideGlobalSettings,
      lineSettings: consolidated.settings.specificSettings
    },
    updateSettings: (updates: { overrideGlobalSettings?: boolean; lineSettings?: Partial<LineSettings> }) => {
      if (updates.overrideGlobalSettings !== undefined) {
        consolidated.updateSettings({ overrideGlobalSettings: updates.overrideGlobalSettings });
      }
      if (updates.lineSettings) {
        consolidated.updateSpecificSettings(updates.lineSettings);
      }
    },
    updateLineSettings: consolidated.updateSpecificSettings,
    getEffectiveLineSettings: consolidated.getEffectiveSettings,
    resetToDefaults: consolidated.resetToDefaults,
    getCurrentDashPattern: globalLineSettings.getCurrentDashPattern
  };
}

/**
 * Hook για Hover καρτέλα
 * ✅ ΕΝΕΡΓΟ: Νέο ξεχωριστό hook για απομόνωση settings
 */
export function useUnifiedLineHover() {
  const globalLineSettings = useLineSettingsFromProvider();

  const consolidated = useConsolidatedSettings({
    defaultSpecificSettings: { ...defaultLinePreviewSettings, color: '#ffaa00' }, // Κίτρινο για hover
    globalSettingsHook: () => globalLineSettings,
    settingsKey: 'LineHover'  // 🔥 ΞΕΧΩΡΙΣΤΟ KEY!
  });

  return {
    settings: {
      overrideGlobalSettings: consolidated.settings.overrideGlobalSettings,
      lineSettings: consolidated.settings.specificSettings
    },
    updateSettings: (updates: { overrideGlobalSettings?: boolean; lineSettings?: Partial<LineSettings> }) => {
      if (updates.overrideGlobalSettings !== undefined) {
        consolidated.updateSettings({ overrideGlobalSettings: updates.overrideGlobalSettings });
      }
      if (updates.lineSettings) {
        consolidated.updateSpecificSettings(updates.lineSettings);
      }
    },
    updateLineSettings: consolidated.updateSpecificSettings,
    getEffectiveLineSettings: consolidated.getEffectiveSettings,
    resetToDefaults: consolidated.resetToDefaults,
    getCurrentDashPattern: globalLineSettings.getCurrentDashPattern
  };
}

/**
 * Hook για Selection/Επιλογή καρτέλα
 * ✅ ΕΝΕΡΓΟ: Νέο ξεχωριστό hook για απομόνωση settings
 */
export function useUnifiedLineSelection() {
  const globalLineSettings = useLineSettingsFromProvider();

  const consolidated = useConsolidatedSettings({
    defaultSpecificSettings: { ...defaultLinePreviewSettings, color: '#ff4444' }, // Κόκκινο για selection
    globalSettingsHook: () => globalLineSettings,
    settingsKey: 'LineSelection'  // 🔥 ΞΕΧΩΡΙΣΤΟ KEY!
  });

  return {
    settings: {
      overrideGlobalSettings: consolidated.settings.overrideGlobalSettings,
      lineSettings: consolidated.settings.specificSettings
    },
    updateSettings: (updates: { overrideGlobalSettings?: boolean; lineSettings?: Partial<LineSettings> }) => {
      if (updates.overrideGlobalSettings !== undefined) {
        consolidated.updateSettings({ overrideGlobalSettings: updates.overrideGlobalSettings });
      }
      if (updates.lineSettings) {
        consolidated.updateSpecificSettings(updates.lineSettings);
      }
    },
    updateLineSettings: consolidated.updateSpecificSettings,
    getEffectiveLineSettings: consolidated.getEffectiveSettings,
    resetToDefaults: consolidated.resetToDefaults,
    getCurrentDashPattern: globalLineSettings.getCurrentDashPattern
  };
}