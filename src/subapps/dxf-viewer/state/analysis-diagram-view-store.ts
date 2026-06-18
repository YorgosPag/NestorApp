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
 *   · `showUtilization` (ADR-485 Slice 4c) — overlay επάρκειας (As_req/As_prov)
 *     που βάφει το footprint κάθε μέλους πράσινο/πορτοκαλί/κόκκινο· default OFF.
 *   · `analysisLive` (ADR-488) — latch «η στατική ανάλυση είναι ενεργή». Οπλίζεται
 *     από το ρητό κουμπί «Ανάλυση»· όσο true, ο FEM solver ξανα-τρέχει proactive σε
 *     κάθε στατική κίνηση (ζωντανός οργανισμός, ADR-487 §4). default OFF.
 *
 * Όπως το `pipe-sizing-view-store` (ADR-422 L3) — **transient analysis mode**: δεν
 * αποθηκεύεται, μηδενίζεται στο reload (όπως ένα Robot results-view tab). Ξεχωριστό
 * store ώστε να μην αγγίζει το shared persisted `bim-render-settings-store` schema
 * (μηδέν Firestore migration για ένα read-only results overlay).
 *
 * @see ../components/dxf-layout/StructuralDiagramOverlay (ADR-483 consumer)
 * @see ../components/dxf-layout/StructuralUtilizationOverlay (ADR-485 consumer)
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
  /** true ⇒ overlay επάρκειας (utilization fill ανά μέλος) ορατό — ADR-485 Slice 4c. */
  readonly showUtilization: boolean;
  setShowUtilization: (showUtilization: boolean) => void;
  /** true ⇒ latch ζωντανής ανάλυσης ενεργό (ADR-488) — proactive re-solve σε κάθε κίνηση. */
  readonly analysisLive: boolean;
  setAnalysisLive: (analysisLive: boolean) => void;
}

/** Τα πεδία που καθορίζουν αν ο μηχανικός «κοιτά» στατικά (ADR-488 engaged predicate). */
export interface AnalysisEngagedState {
  readonly analysisLive: boolean;
  readonly showAnalysisDiagrams: boolean;
  readonly showUtilization: boolean;
}

/**
 * ADR-488 SSoT predicate — ο FEM solver είναι «ζωντανός» (proactive re-solve σε κάθε
 * κίνηση) όταν ο μηχανικός παρατηρεί αποτελέσματα: ρητό latch «Ανάλυση» ή οποιοδήποτε
 * results overlay (διαγράμματα / utilization) ορατό. Αλλιώς dormant → μηδέν κόστος
 * solver (διατηρεί την απόφαση ADR-481). ΕΝΑ predicate → ομοιόμορφο gating όλων των
 * consumers του `AnalysisResultsStore` (diagram + readouts + utilization).
 */
export function isAnalysisEngaged(state: AnalysisEngagedState): boolean {
  return state.analysisLive || state.showAnalysisDiagrams || state.showUtilization;
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
  analysisLive: false,
  setAnalysisLive(analysisLive) {
    set({ analysisLive });
  },
}));
