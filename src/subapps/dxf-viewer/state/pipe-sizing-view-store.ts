'use client';

/**
 * ADR-422 L3 — Pipe-sizing preview view-state (TRANSIENT, non-persisted).
 *
 * Master switch για το analytical overlay «Διαστασιολόγηση Σωληνώσεων» (Revit «Pipe
 * Sizing» preview): ON → κάθε σωλήνας θέρμανσης δείχνει badge με προτεινόμενη DN +
 * ταχύτητα· OFF → κανονικό σχέδιο. Σε αντίθεση με το persisted `showHeatLoad`
 * (`bim-render-settings-store`), η διαστασιολόγηση είναι **transient analysis mode**
 * — δεν αποθηκεύεται, μηδενίζεται στο reload (όπως ένα Revit system-inspector tab).
 * Ξεχωριστό store ώστε να μην αγγίζει το shared persisted settings store.
 *
 * @see ../components/dxf-layout/PipeSizingOverlay (consumer)
 * @see ../ui/ribbon/components/ShowPipeSizingToggle (writer)
 */

import { create } from 'zustand';

interface PipeSizingViewState {
  /** true ⇒ overlay προτεινόμενης DN ανά σωλήνα ορατό. */
  readonly showPipeSizing: boolean;
  setShowPipeSizing: (showPipeSizing: boolean) => void;
}

export const usePipeSizingViewStore = create<PipeSizingViewState>((set) => ({
  showPipeSizing: false,
  setShowPipeSizing(showPipeSizing) {
    set({ showPipeSizing });
  },
}));
