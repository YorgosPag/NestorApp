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
    cold: string | null;
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