'use client';

/**
 * useProactiveOrganismReinforce — ADR-459 Phase 8 (PROACTIVE αυτόματος οπλισμός).
 *
 * Καθρεφτίζει το `useAutoFoundationDesign` (Φ7): μόλις ο στατικός οργανισμός
 * **δημιουργείται ή μεγαλώνει** (νέα κολόνα/δοκάρι, from-grid, geometry edit),
 * ξανα-τρέχει αυτόματα — χωρίς κουμπί — τον level-wide αυτόματο οπλισμό μέσω του
 * SSoT πυρήνα `runOrganismAutoReinforce`. Σενάριο-στόχος: ενώνεις 2 κολόνες με
 * δοκάρι → ο ενιαίος οργανισμός οπλίζεται μόνος του.
 *
 * **Idempotent:** ο πυρήνας/command αγγίζει ΜΟΝΟ μη-οπλισμένα μέλη → re-run = no-op.
 * **Loop guard (κρίσιμο):** ΔΕΝ ακούει `bim:structural-auto-reinforced` (αλλιώς
 * κύκλος)· ΔΕΝ ακούει `bim:column-footing-attached` (ανήκει στο cross-level path του
 * `useStructuralOrganismNotification` — αποφυγή διπλού trigger).
 * **Σιωπηλός (Revit-grade):** καμία ειδοποίηση — αυτόματη background συμπεριφορά
 * (το ribbon path δεν κάνει toast ούτε αυτό).
 *
 * **Atomic undo:** γεγονότα geometry-edit (έχουν δικό τους command στο stack) →
 * ο οπλισμός ομαδοποιείται στο ΙΔΙΟ undo step (`executeGrouped`) → ΕΝΑ Ctrl+Z
 * αναιρεί δοκάρι+οπλισμό μαζί· τα υπόλοιπα (π.χ. from-grid batch) → standalone.
 *
 * ADR-040 safe: low-freq, coalesced ανά microtask (mirror `useStructuralOrganism`).
 *
 * @see hooks/structural-auto-reinforce-core.ts — runOrganismAutoReinforce (SSoT)
 * @see hooks/useAutoFoundationDesign.tsx — το proactive πρότυπο (Φ7)
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 8
 */

import { useEffect } from 'react';
import { EventBus, type DrawingEventType } from '../systems/events/EventBus';
import { useCommandHistory } from '../core/commands/useCommandHistory';
import { resolveStructuralCode } from '../bim/structural/codes';
import { useStructuralSettingsStore } from '../state/structural-settings-store';
import { runOrganismAutoReinforce, type ReinforceLevelManager } from './structural-auto-reinforce-core';

/** Στατικές μεταβολές που δημιουργούν/μεγαλώνουν τον οργανισμό → re-reinforce. */
const PROACTIVE_REINFORCE_EVENTS: readonly DrawingEventType[] = [
  'drawing:entity-created', // νέα κολόνα/δοκάρι/πέδιλο/εδαφόπλακα
  'bim:column-params-updated',
  'bim:beam-params-updated',
  'bim:foundation-params-updated',
  'bim:entities-moved',
  'bim:columns-from-grid',
  'bim:beams-from-grid',
  'bim:foundations-from-grid',
];

/**
 * Triggers που είναι **άμεσες geometry edits** του χρήστη (έχουν δικό τους command
 * στο undo stack) → ο παράγωγος οπλισμός ομαδοποιείται στο **ίδιο** atomic undo step
 * (Revit transaction group). Τα batch/from-grid πάνε standalone — δεν αντιστοιχούν
 * σε ένα μοναδικό προηγούμενο user command.
 */
const GEOMETRY_EDIT_TRIGGERS: ReadonlySet<DrawingEventType> = new Set([
  'drawing:entity-created',
  'bim:column-params-updated',
  'bim:beam-params-updated',
  'bim:foundation-params-updated',
  'bim:entities-moved',
]);

export function useProactiveOrganismReinforce(props: { levelManager: ReinforceLevelManager }): void {
  const { levelManager } = props;
  const { execute, executeGrouped } = useCommandHistory();

  useEffect(() => {
    let scheduled = false;
    // Αν το batch περιέχει geometry-edit trigger, ομαδοποίησε τον οπλισμό στο ίδιο
    // undo step με το user command (atomic, Revit-grade).
    let groupable = false;

    const recompute = (): void => {
      scheduled = false;
      const shouldGroup = groupable;
      groupable = false;
      const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
      runOrganismAutoReinforce(levelManager, [], provider, shouldGroup ? executeGrouped : execute);
    };

    const schedule = (ev: DrawingEventType): void => {
      if (GEOMETRY_EDIT_TRIGGERS.has(ev)) groupable = true;
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(recompute);
    };

    const unsubs = PROACTIVE_REINFORCE_EVENTS.map((ev) => EventBus.on(ev, () => schedule(ev)));
    return () => unsubs.forEach((u) => u());
  }, [levelManager, execute, executeGrouped]);
}
