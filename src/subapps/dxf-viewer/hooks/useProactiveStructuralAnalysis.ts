'use client';

/**
 * useProactiveStructuralAnalysis — ADR-481 (T3, explicit «Ανάλυση» trigger).
 *
 * Καθρεφτίζει το `useProactiveTieBeamTieForce`, αλλά με **explicit** trigger
 * (`bim:run-structural-analysis`) αντί για eager: ο στατικός FEM solver είναι
 * βαρύτερος από το tributary takedown (πυκνή LDLᵀ επίλυση K·u=F ανά συνδυασμό),
 * οπότε τρέχει **on-demand** (κουμπί «Ανάλυση») — ΟΧΙ σε κάθε geometry edit. ADR-040
 * safe: low-freq, coalesced ανά microtask, ο πυρήνας γράφει μόνο το `AnalysisResultsStore`.
 *
 * Διαβάζει τον έτοιμο αναλυτικό φορέα από το `AnalyticalModelStore` (ADR-480 — τον
 * χτίζει ήδη ο `useStructuralOrganism` σε κάθε structural αλλαγή) → ο solver δεν τον
 * ξαναχτίζει. Τα entities του ενεργού ορόφου τροφοδοτούν τους providers διατομής/φορτίου.
 *
 * @see hooks/structural-analysis-core.ts — runStructuralAnalysis (pure SSoT)
 * @see hooks/useProactiveTieBeamTieForce.ts — το proactive πρότυπο
 * @see docs/centralized-systems/reference/adrs/ADR-481-static-fem-solver.md
 */

import { useEffect } from 'react';
import { EventBus } from '../systems/events/EventBus';
import { AnalyticalModelStore } from '../bim/structural/analytical/analytical-model-store';
import { AnalysisDiagnosticsStore } from '../bim/structural/analytical/analysis-diagnostics-store';
import { runStructuralAnalysis } from './structural-analysis-core';
import type { Entity } from '../types/entities';
import type { LoadTakedownLevelManager } from './structural-load-takedown-core';

export function useProactiveStructuralAnalysis(props: { levelManager: LoadTakedownLevelManager }): void {
  const { levelManager } = props;

  useEffect(() => {
    let scheduled = false;

    const recompute = (): void => {
      scheduled = false;
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      if (!scene) return;
      const model = AnalyticalModelStore.get();
      if (model.members.length === 0) return; // κανένα φέρον μέλος → no-op
      // ADR-482: ο core γράφει το AnalysisResultsStore + emit `bim:analysis-solved`·
      // εδώ (single-writer) δημοσιεύουμε τα diagnostics ευστάθειας στο warnings panel.
      const { diagnostics } = runStructuralAnalysis({
        entities: scene.entities as unknown as readonly Entity[], model,
      });
      AnalysisDiagnosticsStore.set(diagnostics);
    };

    const schedule = (): void => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(recompute);
    };

    return EventBus.on('bim:run-structural-analysis', schedule);
  }, [levelManager]);
}
