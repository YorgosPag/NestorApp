// src/subapps/dxf-viewer/ui/components/layers/hooks/selection.ts
import { publishHighlight } from '../../../../events/selection-bus';

type Deps = {
  onEntitySelectionChange?: (ids: string[]) => void;
  setSelectedEntitiesForMerge?: (s: Set<string>) => void;
};

type Opts = {
  /** Αν true, γεμίζει και το merge state (ώστε να εμφανιστεί το Merge panel) */
  forMerge?: boolean;
  /** Προαιρετικό: αν κάνεις highlight ανά layer */
  layerName?: string;
};

/**
 * Ενιαία ρουτίνα επιλογής:
 * - ενημερώνει το React selection
 * - εκπέμπει HILITE_EVENT για grips σε ΟΛΑ τα ids
 * - (προαιρετικά) ενημερώνει το merge state
 */
export function setSelection(ids: string[], deps: Deps, opts: Opts = {}) {
  deps.onEntitySelectionChange?.(ids);
  publishHighlight({ ids, layerName: opts.layerName });

  if (opts.forMerge) {
    // Αν θες το Merge panel να ανάβει μόνο όταν έχει νόημα
    deps.setSelectedEntitiesForMerge?.(ids.length > 1 ? new Set(ids) : new Set());
  } else {
    // Single-mode: καθάρισε τυχόν παλιό merge state
    deps.setSelectedEntitiesForMerge?.(new Set());
  }
}

/** Βολικά helpers */
export const selectSingle = (id: string | null, deps: Deps) =>
  setSelection(id ? [id] : [], deps, { forMerge: false });

export const selectRangeForMerge = (ids: string[], deps: Deps) =>
  setSelection(ids, deps, { forMerge: true });