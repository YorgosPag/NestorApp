'use client';

/**
 * ADR-483/484 — Static-analysis diagram + utilization overlay view-state
 * (TRANSIENT, non-persisted).
 *
 * Master switches για τα δύο read-only canvas overlays:
 *   · `showAnalysisDiagrams` (ADR-483) — «Διαγράμματα M/V/N» (Revit/Robot moment-shear
 *     diagrams πάνω στο μοντέλο): ON → κάθε φέρον δοκάρι δείχνει το διάγραμμα του
 *     επιλεγμένου εντατικού μεγέθους (`diagramComponent`)· OFF → κανονικό σχέδιο.
 *   · `diagramComponent` (ADR-483 Slice 4b) — ποιο εντατικό μέγεθος σχεδιάζεται
 *     (Μ/V/N, ένα κάθε φορά όπως στο Robot)· default 'moment'.
 *   · `showUtilization` (ADR-484 Slice 4c) — overlay επάρκειας (As_req/As_prov)
 *     που βάφει το footprint κάθε μέλους πράσινο/πορτοκαλί/κόκκινο· default OFF.
 *
 * Όπως το `pipe-sizing-view-store` (ADR-422 L3) — **transient analysis mode**: δεν
 * αποθηκεύεται, μηδενίζεται στο reload (όπως ένα Robot results-view tab). Ξεχωριστό
 * store ώστε να μην αγγίζει το shared persisted `bim-render-settings-store` schema
 * (μηδέν Firestore migration για ένα read-only results overlay).
 *
 * @see ../components/dxf-layout/StructuralDiagramOverlay (ADR-483 consumer)
 * @see ../components/dxf-layout/StructuralUtilizationOverlay (ADR-484 consumer)
 * @see ../ui/ribbon/components/ShowAnalysisDiagramsToggle (writer)
 * @see docs/centralized-systems/reference/adrs/ADR-483-static-analysis-canvas-diagrams.md
 */

import { create } from 'zustand';
import type { DiagramComponent } from '../bim/structural/analytical/diagrams/member-diagram-geometry';

interface AnalysisDiagramViewState {
  /** true ⇒ overlay διαγραμμάτων του `diagramComponent` ανά δοκάρι ορατό. */
  readonly showAnalysisDiagrams: boolean;
  setShowAnalysisDiagrams: (showAnalysisDiagrams: boolean) => void;
  /** Ποιο εντατικό μέγεθος σχεδιάζεται (Μ/V/N) — ADR-483 Slice 4b. */
  readonly diagramComponent: DiagramComponent;
  setDiagramComponent: (diagramComponent: DiagramComponent) => void;
  /** true ⇒ overlay επάρκειας (utilization fill ανά μέλος) ορατό — ADR-484 Slice 4c. */
  readonly showUtilization: boolean;
  setShowUtilization: (showUtilization: boolean) => void;
}

export const useAnalysisDiagramViewStore = create<AnalysisDiagramViewState>((set) => ({
  showAnalysisDiagrams: false,
  setShowAnalysisDiagrams(showAnalysisDiagrams) {
    set({ showAnalysisDiagrams });
  },
  diagramComponent: 'moment',
  setDiagramComponent(diagramComponent) {
    set({ diagramComponent });
  },
  showUtilization: false,
  setShowUtilization(showUtilization) {
    set({ showUtilization });
  },
}));
