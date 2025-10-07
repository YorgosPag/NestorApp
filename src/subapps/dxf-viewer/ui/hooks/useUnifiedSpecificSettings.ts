/**
 * Unified Specific Settings Hooks
 *
 * @description
 * Κεντρικοποιημένα hooks για mode-based settings (Preview/Completion).
 * Χρησιμοποιούν το consolidated pattern για effective settings calculation.
 *
 * @hooks
 * - `useUnifiedLinePreview()` - Preview line settings
 * - `useUnifiedLineCompletion()` - Completion line settings
 * - `useUnifiedTextPreview()` - Preview text settings
 * - `useLineStyles(mode)` - Unified line settings για οποιοδήποτε mode
 * - `useTextStyles(mode)` - Unified text settings για οποιοδήποτε mode
 * - `useGripStyles(mode)` - Unified grip settings για οποιοδήποτε mode
 *
 * @architecture
 * ```
 * useLineStyles('preview')
 *   ↓
 * useConsolidatedSettings (pattern)
 *   ↓
 * DxfSettingsProvider (effective settings)
 *   ↓
 * General → Specific → Overrides (hierarchy)
 * ```
 *
 * @effective_settings_calculation
 * ```typescript
 * Effective = General Settings
 *           + Specific Settings (mode-based)
 *           + Overrides (if enabled)
 * ```
 *
 * @usage
 * ```tsx
 * // In drawing system
 * const linePreview = useLineStyles('preview');
 * previewEntity.color = linePreview.settings.color; // Yellow
 *
 * const lineCompletion = useLineStyles('completion');
 * finalEntity.color = lineCompletion.settings.color; // Green
 * ```
 *
 * @see {@link docs/settings-system/04-HOOKS_REFERENCE.md} - Complete hooks documentation
 * @see {@link docs/settings-system/08-LINE_DRAWING_INTEGRATION.md} - Hooks in action
 * @see {@link docs/settings-system/07-MODE_SYSTEM.md} - Mode-based settings
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-06
 * @version 1.0.0
 */

// ⚠️ DEPRECATED: useConsolidatedSettings removed in Phase 8 (Enterprise Refactoring)
// import { useConsolidatedSettings } from './useConsolidatedSettings';
import {
  useLineSettingsFromProvider,
  useTextSettingsFromProvider,
  useLineDraftSettings,
  useLineHoverSettings,
  useLineSelectionSettings,
  useLineCompletionSettings,
  useTextDraftSettings,
  useGripDraftSettings
} from '../../providers/DxfSettingsProvider';
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
 * ✅ MIGRATED: Uses useLineDraftSettings (Phase 7 - ColorPalettePanel compatibility)
 *
 * Note: This is a compatibility wrapper for ColorPalettePanel.tsx
 * It delegates to useLineDraftSettings() which uses the Provider Hook
 */
export function useUnifiedLinePreview() {
  // Delegate to the migrated hook
  return useUnifiedLineDraft();
}

/**
 * Unified Line Completion Settings Hook
 * ✅ MIGRATED: Uses Provider Hook (Phase 7)
 */
export function useUnifiedLineCompletion() {
  const providerHook = useLineCompletionSettings();
  const globalLineSettings = useLineSettingsFromProvider();

  // Backwards compatibility wrapper
  return {
    settings: {
      overrideGlobalSettings: providerHook.isOverrideEnabled,
      lineSettings: providerHook.getEffectiveSettings() // ✅ FIX: Use effective settings (General + Specific + Overrides)
    },
    updateSettings: (updates: { overrideGlobalSettings?: boolean; lineSettings?: Partial<LineSettings> }) => {
      if (updates.overrideGlobalSettings !== undefined) {
        providerHook.toggleOverride(updates.overrideGlobalSettings);
      }
      if (updates.lineSettings) {
        providerHook.updateSettings(updates.lineSettings);
      }
    },
    updateLineSettings: providerHook.updateSettings,
    getEffectiveLineSettings: providerHook.getEffectiveSettings,
    resetToDefaults: () => {
      providerHook.updateSettings(defaultLineCompletionSettings);
      providerHook.toggleOverride(false);
    },
    getCurrentDashPattern: globalLineSettings.getCurrentDashPattern
  };
}

/**
 * Unified Text Preview Settings Hook
 * ✅ MIGRATED: Uses Provider Hook (Phase 7)
 */
export function useUnifiedTextPreview() {
  const providerHook = useTextDraftSettings();

  // Backwards compatibility wrapper
  return {
    settings: {
      overrideGlobalSettings: providerHook.isOverrideEnabled,
      textSettings: providerHook.getEffectiveSettings() // ✅ FIX: Use effective settings (General + Specific + Overrides)
    },
    updateSettings: (updates: { overrideGlobalSettings?: boolean; textSettings?: Partial<TextSettings> }) => {
      if (updates.overrideGlobalSettings !== undefined) {
        providerHook.toggleOverride(updates.overrideGlobalSettings);
      }
      if (updates.textSettings) {
        providerHook.updateSettings(updates.textSettings);
      }
    },
    updateTextSettings: providerHook.updateSettings,
    getEffectiveTextSettings: providerHook.getEffectiveSettings,
    resetToDefaults: () => {
      providerHook.updateSettings(defaultTextPreviewSettings);
      providerHook.toggleOverride(false);
    }
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
 * Unified Grip Preview Settings Hook
 * ✅ MIGRATED: Uses useGripDraftSettings (Phase 7 - ColorPalettePanel compatibility)
 *
 * Note: This is a compatibility wrapper for ColorPalettePanel.tsx
 * Maps Provider Hook interface to legacy ColorPalettePanel interface
 */
export function useUnifiedGripPreview() {
  const providerHook = useGripDraftSettings();

  // Backwards compatibility interface (map GripSettings to MockGripSettings format)
  return {
    settings: {
      overrideGlobalSettings: providerHook.isOverrideEnabled,
      gripSettings: providerHook.getEffectiveSettings() // ✅ FIX: Use effective settings (General + Specific + Overrides)
    },
    updateSettings: (updates: { overrideGlobalSettings?: boolean; gripSettings?: Partial<MockGripSettings> }) => {
      if (updates.overrideGlobalSettings !== undefined) {
        providerHook.toggleOverride(updates.overrideGlobalSettings);
      }
      if (updates.gripSettings) {
        providerHook.updateSettings(updates.gripSettings as any);
      }
    },
    updateGripSettings: providerHook.updateSettings,
    getEffectiveGripSettings: providerHook.getEffectiveSettings,
    resetToDefaults: () => {
      providerHook.updateSettings(defaultGripPreviewSettings);
      providerHook.toggleOverride(false);
    }
  };
}

// ============================================================================
// ΞΕΧΩΡΙΣΤΑ HOOKS ΓΙΑ ΚΑΘΕ ΚΑΡΤΕΛΑ - ΚΑΜΙΑ ΚΟΙΝΟΠΟΙΗΣΗ SETTINGS
// ============================================================================

/**
 * Hook για Draft/Προσχεδίαση καρτέλα
 * ✅ MIGRATED: Uses Provider Hook (Phase 7)
 */
export function useUnifiedLineDraft() {
  const providerHook = useLineDraftSettings();
  const globalLineSettings = useLineSettingsFromProvider();

  // Backwards compatibility wrapper
  return {
    settings: {
      overrideGlobalSettings: providerHook.isOverrideEnabled,
      lineSettings: providerHook.getEffectiveSettings() // ✅ FIX: Use effective settings (General + Specific + Overrides)
    },
    updateSettings: (updates: { overrideGlobalSettings?: boolean; lineSettings?: Partial<LineSettings> }) => {
      if (updates.overrideGlobalSettings !== undefined) {
        providerHook.toggleOverride(updates.overrideGlobalSettings);
      }
      if (updates.lineSettings) {
        providerHook.updateSettings(updates.lineSettings);
      }
    },
    updateLineSettings: providerHook.updateSettings,
    getEffectiveLineSettings: providerHook.getEffectiveSettings,
    resetToDefaults: () => {
      // Reset to defaults by clearing specific settings
      providerHook.updateSettings(defaultLinePreviewSettings);
      providerHook.toggleOverride(false);
    },
    getCurrentDashPattern: globalLineSettings.getCurrentDashPattern
  };
}

/**
 * Hook για Hover καρτέλα
 * ✅ MIGRATED: Uses Provider Hook (Phase 7)
 */
export function useUnifiedLineHover() {
  const providerHook = useLineHoverSettings();
  const globalLineSettings = useLineSettingsFromProvider();

  // Default hover settings (orange)
  const defaultHoverSettings = { ...defaultLinePreviewSettings, color: '#ffaa00' };

  // Backwards compatibility wrapper
  return {
    settings: {
      overrideGlobalSettings: providerHook.isOverrideEnabled,
      lineSettings: providerHook.getEffectiveSettings() // ✅ FIX: Use effective settings (General + Specific + Overrides)
    },
    updateSettings: (updates: { overrideGlobalSettings?: boolean; lineSettings?: Partial<LineSettings> }) => {
      if (updates.overrideGlobalSettings !== undefined) {
        providerHook.toggleOverride(updates.overrideGlobalSettings);
      }
      if (updates.lineSettings) {
        providerHook.updateSettings(updates.lineSettings);
      }
    },
    updateLineSettings: providerHook.updateSettings,
    getEffectiveLineSettings: providerHook.getEffectiveSettings,
    resetToDefaults: () => {
      providerHook.updateSettings(defaultHoverSettings);
      providerHook.toggleOverride(false);
    },
    getCurrentDashPattern: globalLineSettings.getCurrentDashPattern
  };
}

/**
 * Hook για Selection/Επιλογή καρτέλα
 * ✅ MIGRATED: Uses Provider Hook (Phase 7)
 */
export function useUnifiedLineSelection() {
  const providerHook = useLineSelectionSettings();
  const globalLineSettings = useLineSettingsFromProvider();

  // Default selection settings (red)
  const defaultSelectionSettings = { ...defaultLinePreviewSettings, color: '#ff4444' };

  // Backwards compatibility wrapper
  return {
    settings: {
      overrideGlobalSettings: providerHook.isOverrideEnabled,
      lineSettings: providerHook.getEffectiveSettings() // ✅ FIX: Use effective settings (General + Specific + Overrides)
    },
    updateSettings: (updates: { overrideGlobalSettings?: boolean; lineSettings?: Partial<LineSettings> }) => {
      if (updates.overrideGlobalSettings !== undefined) {
        providerHook.toggleOverride(updates.overrideGlobalSettings);
      }
      if (updates.lineSettings) {
        providerHook.updateSettings(updates.lineSettings);
      }
    },
    updateLineSettings: providerHook.updateSettings,
    getEffectiveLineSettings: providerHook.getEffectiveSettings,
    resetToDefaults: () => {
      providerHook.updateSettings(defaultSelectionSettings);
      providerHook.toggleOverride(false);
    },
    getCurrentDashPattern: globalLineSettings.getCurrentDashPattern
  };
}