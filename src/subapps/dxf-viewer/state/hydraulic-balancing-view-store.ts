'use client';

/**
 * ADR-422 L4 — Hydraulic-balancing preview view-state (TRANSIENT, non-persisted).
 *
 * Master switch για το analytical overlay «Υδραυλική Εξισορρόπηση» (Revit «System
 * Inspector» / 4M «balancing schedule»): ON → κάθε καλοριφέρ δείχνει badge με ΔP
 * κυκλώματος + απαιτ. προρρύθμιση kv balancing valve, με το index circuit
 * highlighted· OFF → κανονικό σχέδιο. Σε αντίθεση με τα persisted render settings, η
 * εξισορρόπηση είναι **transient analysis mode** — δεν αποθηκεύεται, μηδενίζεται στο
 * reload (όπως ένα Revit system-inspector tab). Ξεχωριστό store ώστε να μην αγγίζει το
 * shared persisted settings store. Mirror του {@link usePipeSizingViewStore} (L3).
 *
 * @see ../components/dxf-layout/HydraulicBalancingOverlay (consumer)
 * @see ../ui/ribbon/components/ShowBalancingToggle (writer)
 */

import { create } from 'zustand';

interface HydraulicBalancingViewState {
  /** true ⇒ overlay ΔP κυκλώματος + kv ανά σώμα ορατό. */
  readonly showBalancing: boolean;
  setShowBalancing: (showBalancing: boolean) => void;
}

export const useHydraulicBalancingViewStore = create<HydraulicBalancingViewState>((set) => ({
  showBalancing: false,
  setShowBalancing(showBalancing) {
    set({ showBalancing });
  },
}));
