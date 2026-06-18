'use client';

/**
 * useProactiveStructuralAnalysis — ADR-481 (T3 FEM solver) + ADR-488 (ζωντανός solver).
 *
 * **ADR-481 (αρχική απόφαση):** ο στατικός FEM solver είναι βαρύτερος από το tributary
 * takedown (πυκνή LDLᵀ επίλυση K·u=F ανά συνδυασμό), οπότε ήταν **dormant** — έτρεχε
 * ΜΟΝΟ με ρητό κουμπί «Ανάλυση» (`bim:run-structural-analysis`), ΟΧΙ σε κάθε edit.
 *
 * **ADR-488 (ζωντανός οργανισμός, ΟΡΑΜΑ §4):** το διάγραμμα M/V/N έμενε stale όταν ο
 * μηχανικός μετακινούσε/αποσύνδεε κολώνα (πρόβολος) — ο solver δεν ξανα-έτρεχε. Λύση
 * **engaged latch** (Revit «analytical results enabled»): μόλις ο μηχανικός
 * «παρατηρεί» στατικά (πάτησε «Ανάλυση» **ή** άναψε results overlay — `isAnalysisEngaged`),
 * ο solver γίνεται **proactive** — ξανα-τρέχει σε **κάθε** στατική κίνηση, coalesced.
 * Εκτός engaged → dormant, μηδέν κόστος (διατηρεί την απόφαση κόστους ADR-481).
 *
 * **Triggers (DERIVED, ΟΧΙ raw geometry — αποφυγή intra-tick ordering race):**
 *   · `bim:run-structural-analysis` — ρητό κουμπί → **πάντα** solve, **loud** (toast).
 *   · `bim:structural-organism-updated` — ο αναλυτικός φορέας (ADR-480) ξαναχτίστηκε
 *     (φρέσκια τοπολογία: πρόβολος vs αμφιέρειστο) → engaged-gated, **silent**.
 *   · `bim:structural-loads-computed` — φρέσκα tributary φορτία (slab/wall/occupancy)
 *     → engaged-gated, **silent**.
 *   · flip του engaged predicate σε true (π.χ. άναψε το diagram μετά από move) →
 *     άμεσο silent solve ώστε τα overlays να μην δείχνουν stale/κενό.
 * Και τα δύο derived events εκπέμπονται **αφού** το μοντέλο/φορτία settle (ήδη
 * coalesced upstream) → ο solver βλέπει φρέσκα δεδομένα χωρίς να εξαρτάται από σειρά
 * microtask μεταξύ των proactive hooks.
 *
 * Διαβάζει τον έτοιμο αναλυτικό φορέα από το `AnalyticalModelStore` (ADR-480 — τον
 * χτίζει ήδη ο `useStructuralOrganism`). Coalesced ανά microtask, low-freq → ADR-040
 * safe (ο πυρήνας γράφει μόνο `AnalysisResultsStore`/`AnalysisDiagnosticsStore`).
 *
 * @see hooks/structural-analysis-core.ts — runStructuralAnalysis (pure SSoT)
 * @see state/analysis-diagram-view-store.ts — isAnalysisEngaged (SSoT predicate)
 * @see hooks/useProactiveStructuralLoads.ts — το proactive πρότυπο (queueMicrotask coalesce)
 * @see docs/centralized-systems/reference/adrs/ADR-488-living-structural-organism-proactive-fem.md
 */

import { useEffect } from 'react';
import { EventBus } from '../systems/events/EventBus';
import { AnalyticalModelStore } from '../bim/structural/analytical/analytical-model-store';
import { AnalysisDiagnosticsStore } from '../bim/structural/analytical/analysis-diagnostics-store';
import {
  useAnalysisDiagramViewStore,
  isAnalysisEngaged,
} from '../state/analysis-diagram-view-store';
import { runStructuralAnalysis } from './structural-analysis-core';
import type { Entity } from '../types/entities';
import type { LoadTakedownLevelManager } from './structural-load-takedown-core';

export function useProactiveStructuralAnalysis(props: { levelManager: LoadTakedownLevelManager }): void {
  const { levelManager } = props;

  useEffect(() => {
    let scheduled = false;
    // Αν το coalesced batch περιέχει τη ρητή «Ανάλυση» → loud (toast)· αλλιώς proactive
    // re-solve = silent (μηδέν toast spam, mirror reinforce/loads).
    let loud = false;

    const recompute = (): void => {
      scheduled = false;
      const runLoud = loud;
      loud = false;
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      const model = AnalyticalModelStore.get();
      if (model.members.length === 0) return; // κανένα φέρον μέλος → no-op
      // ADR-482: ο core γράφει το AnalysisResultsStore + emit `bim:analysis-solved`·
      // εδώ (single-writer) δημοσιεύουμε τα diagnostics ευστάθειας στο warnings panel.
      const { diagnostics } = runStructuralAnalysis(
        { entities: scene.entities as unknown as readonly Entity[], model },
        { silent: !runLoud },
      );
      AnalysisDiagnosticsStore.set(diagnostics);
    };

    const schedule = (): void => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(recompute);
    };

    // Ρητή «Ανάλυση» → πάντα solve, loud (ανεξάρτητα engaged).
    const onExplicit = (): void => {
      loud = true;
      schedule();
    };
    // Derived proactive trigger → solve μόνο όταν ο μηχανικός παρατηρεί στατικά.
    const onProactive = (): void => {
      if (!isAnalysisEngaged(useAnalysisDiagramViewStore.getState())) return;
      schedule();
    };

    const unsubs = [
      EventBus.on('bim:run-structural-analysis', onExplicit),
      EventBus.on('bim:structural-organism-updated', onProactive),
      EventBus.on('bim:structural-loads-computed', onProactive),
    ];
    // Flip του engaged predicate σε true (π.χ. άναψε diagram/utilization μετά από move)
    // → άμεσο silent solve ώστε τα overlays να μη δείχνουν stale/κενό.
    let prevEngaged = isAnalysisEngaged(useAnalysisDiagramViewStore.getState());
    const unsubView = useAnalysisDiagramViewStore.subscribe((s) => {
      const nowEngaged = isAnalysisEngaged(s);
      if (nowEngaged && !prevEngaged) schedule();
      prevEngaged = nowEngaged;
    });

    return () => {
      unsubs.forEach((u) => u());
      unsubView();
    };
  }, [levelManager]);
}
