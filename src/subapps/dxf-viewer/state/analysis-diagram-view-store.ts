'use client';

/**
 * ADR-483 — Static-analysis diagram overlay view-state (TRANSIENT, non-persisted).
 *
 * Master switch για το canvas overlay «Διαγράμματα M/V/N» (Revit/Robot moment-shear
 * diagrams πάνω στο μοντέλο): ON → κάθε φέρον δοκάρι του ενεργού ορόφου δείχνει το
 * διάγραμμα ροπών (offset κάθετα στον άξονα, auto-fit κλίμακα)· OFF → κανονικό σχέδιο.
 *
 * Όπως το `pipe-sizing-view-store` (ADR-422 L3) — **transient analysis mode**: δεν
 * αποθηκεύεται, μηδενίζεται στο reload (όπως ένα Robot results-view tab). Ξεχωριστό
 * store ώστε να μην αγγίζει το shared persisted `bim-render-settings-store` schema
 * (μηδέν Firestore migration για ένα read-only results overlay).
 *
 * @see ../components/dxf-layout/StructuralDiagramOverlay (consumer)
 * @see ../ui/ribbon/components/ShowAnalysisDiagramsToggle (writer)
 * @see docs/centralized-systems/reference/adrs/ADR-483-static-analysis-canvas-diagrams.md
 */

import { create } from 'zustand';

interface AnalysisDiagramViewState {
  /** true ⇒ overlay διαγραμμάτων ροπής ανά δοκάρι ορατό. */
  readonly showAnalysisDiagrams: boolean;
  setShowAnalysisDiagrams: (showAnalysisDiagrams: boolean) => void;
}

export const useAnalysisDiagramViewStore = create<AnalysisDiagramViewState>((set) => ({
  showAnalysisDiagrams: false,
  setShowAnalysisDiagrams(showAnalysisDiagrams) {
    set({ showAnalysisDiagrams });
  },
}));
