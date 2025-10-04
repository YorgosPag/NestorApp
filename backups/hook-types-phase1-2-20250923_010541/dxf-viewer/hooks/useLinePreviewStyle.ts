/**
 * Hook για να διαβάζει τις ρυθμίσεις προσχεδίασης γραμμής
 * χωρίς να χρειάζεται React context στο PhaseManager
 */

import { toolStyleStore } from '../stores/ToolStyleStore';

// Αφαιρώ το direct import της συνάρτησης για να αποφύγω circular dependency
// θα την κάλεσω μέσω require εντός της συνάρτησης
// import { useUnifiedLineDraft } from '../ui/hooks/useUnifiedSpecificSettings';

export interface LinePreviewStyle {
  enabled: boolean;          // ΝΕΟ! Ενεργοποίηση/απενεργοποίηση γραμμών
  strokeColor: string;
  lineWidth: number;
  lineDash: number[];
  opacity: number;
  lineType: string;
}

// Line dash patterns based on line type - synced with EntitiesSettings.tsx
const LINE_DASH_PATTERNS: Record<string, number[]> = {
  solid: [],
  dotted: [2, 3],
  dashed: [10, 5],
  'dash-dot': [10, 3, 2, 3],
  'dash-dot-dot': [10, 3, 2, 3, 2, 3],
  'long-dash': [20, 5],
  'short-dash': [5, 3],
  'double-dot': [2, 3, 2, 8],
  custom: [5, 5] // Default for custom
};

// Global function που μπορεί να κληθεί από οπουδήποτε (ΓΕΝΙΚΕΣ ΡΥΘΜΙΣΕΙΣ)
export function getLinePreviewStyle(): LinePreviewStyle {
  const toolStyle = toolStyleStore.get();

  // Get line type from ToolStyleStore (updated by LinePreviewSettingsContext)
  const lineType = toolStyle.lineType || 'dashed';
  const lineDash = LINE_DASH_PATTERNS[lineType] || [5, 5];

  const result = {
    enabled: toolStyle.enabled !== undefined ? toolStyle.enabled : true, // Default: enabled
    strokeColor: toolStyle.strokeColor, // Παίρνει απευθείας από γενικές ρυθμίσεις (DxfSettingsProvider)
    lineWidth: toolStyle.lineWidth,     // Παίρνει απευθείας από γενικές ρυθμίσεις (DxfSettingsProvider)
    lineDash,
    opacity: toolStyle.opacity,         // Παίρνει απευθείας από γενικές ρυθμίσεις (DxfSettingsProvider)
    lineType,
  };

  return result;
}

// Global state store για draft settings (εκτός React context)
let draftSettingsStore: {
  overrideGlobalSettings: boolean;
  settings: any;
} | null = null;

// Συνάρτηση για να ενημερώσει το store από το React context
export function updateDraftSettingsStore(settings: { overrideGlobalSettings: boolean; settings: any }) {
  draftSettingsStore = settings;
  console.log('📝 [updateDraftSettingsStore] Updated store:', settings);
}

// ✅ ΝΕΑ ΣΥΝΑΡΤΗΣΗ: Ελέγχει το checkbox και επιστρέφει τις σωστές ρυθμίσεις
export function getLinePreviewStyleWithOverride(): LinePreviewStyle {
  // 🔍 DEBUG: Έλεγχος κατάστασης store
  console.log('🔍 [getLinePreviewStyleWithOverride] Store state:', {
    storeExists: !!draftSettingsStore,
    overrideEnabled: draftSettingsStore?.overrideGlobalSettings,
    settingsExist: !!draftSettingsStore?.settings,
    fullStore: draftSettingsStore
  });

  // Αν έχω ειδικές ρυθμίσεις και το checkbox είναι checked
  if (draftSettingsStore?.overrideGlobalSettings && draftSettingsStore.settings) {
    const specificSettings = draftSettingsStore.settings;
    const lineType = specificSettings.lineType || 'dashed';
    const lineDash = LINE_DASH_PATTERNS[lineType] || [5, 5];

    console.log('✅ [getLinePreviewStyleWithOverride] Using SPECIFIC settings from store:', specificSettings);

    return {
      enabled: specificSettings.enabled !== undefined ? specificSettings.enabled : true,
      strokeColor: specificSettings.color || '#FF0000', // ✅ AutoCAD standard: Red for preview
      lineWidth: specificSettings.lineWidth || 1,        // ✅ AutoCAD standard: 1 pixel default
      lineDash,
      opacity: specificSettings.opacity || 1.0,
      lineType,
    };
  }

  // Fallback στις γενικές ρυθμίσεις
  console.log('🔄 [getLinePreviewStyleWithOverride] Using GENERAL settings (checkbox unchecked or no store)');
  return getLinePreviewStyle();
}

// Function για να εφαρμόσει το στυλ σε canvas context
export function applyLinePreviewStyle(ctx: CanvasRenderingContext2D): void {
  const style = getLinePreviewStyleWithOverride();

  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = style.lineWidth;
  ctx.setLineDash(style.lineDash);
  ctx.globalAlpha = style.opacity;
}