/**
 * Hook για στυλ grips προσχεδίασης
 * Ακολουθεί την ίδια αρχιτεκτονική με useLinePreviewStyle και getTextPreviewStyle
 */

import { useGripContext } from '../providers/GripProvider';
import { gripStyleStore } from '../stores/GripStyleStore';
// ===== OVERRIDE GUARD SYSTEM =====
import { guardGlobalAccess } from '../../../utils/overrideGuard';

export interface GripPreviewStyle {
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
}

/**
 * Hook για λήψη grip settings με την ίδια λογική όπως τα άλλα styling hooks
 */
export function useGripPreviewStyle(): GripPreviewStyle {
  const { gripSettings } = useGripContext();

  return {
    enabled: gripSettings.showGrips,
    colors: gripSettings.colors,
    gripSize: gripSettings.gripSize,
    pickBoxSize: gripSettings.pickBoxSize,
    apertureSize: gripSettings.apertureSize,
    showGrips: gripSettings.showGrips,
    opacity: 1.0 // Default opacity για grips
  };
}

/**
 * Συνάρτηση για λήψη grip style (παρόμοια με getLinePreviewStyle)
 * Χρησιμοποιεί το GripStyleStore για συνεπή πρόσβαση στις ρυθμίσεις
 */
export function getGripPreviewStyle(): GripPreviewStyle {
  // 🔥 GUARD: Προστασία πρόσβασης στις γενικές grip settings όταν override ενεργό
  // ΣΗΜΕΙΩΣΗ: Θα σκάσει εδώ αν καλεστεί από getGripPreviewStyleWithOverride
  // ενώ override είναι ενεργό - αυτό είναι το ζητούμενο για διάγνωση!
  guardGlobalAccess('GRIP_PREVIEW_STYLE_READ');

  // ✅ ΔΙΟΡΘΩΣΗ: Χρησιμοποιούμε το gripStyleStore όπως το toolStyleStore
  // για να πάρουμε τις πραγματικές ρυθμίσεις χωρίς React context
  const gripStyle = gripStyleStore.get();

  return {
    enabled: gripStyle.enabled,
    colors: gripStyle.colors,
    gripSize: gripStyle.gripSize,
    pickBoxSize: gripStyle.pickBoxSize,
    apertureSize: gripStyle.apertureSize,
    showGrips: gripStyle.showGrips,
    opacity: gripStyle.opacity
  };
}

// Global state store για draft grip settings (εκτός React context)
let draftGripSettingsStore: {
  overrideGlobalSettings: boolean;
  settings: Partial<GripPreviewStyle>;
} | null = null;

// Συνάρτηση για να ενημερώσει το store από το React context
export function updateDraftGripSettingsStore(settings: { overrideGlobalSettings: boolean; settings: Partial<GripPreviewStyle> }) {
  draftGripSettingsStore = settings;

}

// ✅ ΝΕΑ ΣΥΝΑΡΤΗΣΗ: Ελέγχει το checkbox και επιστρέφει τις σωστές ρυθμίσεις grips
export function getGripPreviewStyleWithOverride(): GripPreviewStyle {
  // Αν έχω ειδικές ρυθμίσεις και το checkbox είναι checked
  if (draftGripSettingsStore?.overrideGlobalSettings && draftGripSettingsStore.settings) {
    const specificSettings = draftGripSettingsStore.settings;

    return {
      enabled: specificSettings.enabled !== undefined ? specificSettings.enabled : true,
      colors: {
        cold: specificSettings.colors?.cold || '#0000FF',  // ✅ AutoCAD standard: Blue for cold grips
        warm: specificSettings.colors?.warm || '#FFFF00',  // ✅ AutoCAD standard: Yellow for warm grips
        hot: specificSettings.colors?.hot || '#FF0000',    // ✅ AutoCAD standard: Red for hot grips
        contour: specificSettings.colors?.contour || '#000000' // ✅ AutoCAD standard: Black contour
      },
      gripSize: specificSettings.gripSize || 8,
      pickBoxSize: specificSettings.pickBoxSize || 3,
      apertureSize: specificSettings.apertureSize || 10,
      showGrips: specificSettings.showGrips !== undefined ? specificSettings.showGrips : true,
      opacity: specificSettings.opacity || 1
    };
  }

  // Fallback στις γενικές ρυθμίσεις

  return getGripPreviewStyle();
}