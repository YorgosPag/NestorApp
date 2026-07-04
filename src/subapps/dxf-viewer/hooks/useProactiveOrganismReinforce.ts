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

import { type DrawingEventType } from '../systems/events/EventBus';
import { resolveStructuralCode } from '../bim/structural/codes';
import { useStructuralSettingsStore } from '../state/structural-settings-store';
import { runOrganismAutoReinforce, type ReinforceLevelManager } from './structural-auto-reinforce-core';
import { useGroupedStructuralReaction } from './useGroupedStructuralReaction';

/** Στατικές μεταβολές που δημιουργούν/μεγαλώνουν τον οργανισμό → re-reinforce. */
const PROACTIVE_REINFORCE_EVENTS: readonly DrawingEventType[] = [
  // ADR-459 v19 — SINGLE-PATH: αντικαθιστά τα generic `drawing:entity-created` + `bim:entities-moved`.
  'bim:structural-geometry-changed',
  'bim:column-params-updated',
  'bim:beam-params-updated',
  'bim:foundation-params-updated',
  'bim:slab-params-updated', // ADR-476 — αλλαγή πάχους/outline πλάκας → re-study σχάρας
  'bim:columns-from-grid',
  'bim:beams-from-grid',
  'bim:foundations-from-grid',
  // ADR-472 S3 — φρέσκα tributary φορτία (από useProactiveStructuralLoads/Φ9) → re-study
  // του strength-driven οπλισμού των `auto:true` μελών. Loop-safe: ο reinforce εκπέμπει
  // `bim:structural-auto-reinforced` + (persist) `bim:entities-attached`, που το load
  // takedown ΔΕΝ ακούει → η αλυσίδα loads→reinforce είναι terminal (μηδέν oscillation).
  // Διπλό δίχτυ: `buildReinforcePatch` convergence guard (ίδιο φορτίο → μηδέν patch).
  'bim:structural-loads-computed',
];

// ADR-491 (διόρθωση infinite loop) — ΣΚΟΠΙΜΑ ΔΕΝ ακούμε `bim:analysis-solved` εδώ. Θα έκλεινε
// κύκλο: analysis-solved → reinforce → `bim:structural-auto-reinforced` → useStructuralOrganism
// rebuild → `bim:structural-organism-updated` → FEM solve (engaged) → analysis-solved → … (ο
// no-op reinforce εκπέμπει event ακόμη και με count:0, άρα ο κύκλος αυτοσυντηρείται σε steady
// state). Η ΖΩΝΤΑΝΗ ενημέρωση του οπλισμού κολόνας με τη FEM ροπή γίνεται **read-only** μέσω των
// active resolvers (`resolveActiveColumnReinforcementForEntity`, engaged-gated) → render/utilization
// δείχνουν τη FEM-aware τιμή ΧΩΡΙΣ persisted mutation/Firestore churn/βρόχο. Ο persisted M-N
// οπλισμός βάφεται μόνο στο ΡΗΤΟ κουμπί «Αυτόματος Οπλισμός» (one-shot· το `columnFemMomentById`
// threading στο command/core παραμένει γι' αυτό).

export function useProactiveOrganismReinforce(props: { levelManager: ReinforceLevelManager }): void {
  const { levelManager } = props;

  // SSoT wiring (coalescing + atomic-undo grouping) → `useGroupedStructuralReaction`.
  useGroupedStructuralReaction(PROACTIVE_REINFORCE_EVENTS, (exec) => {
    const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);
    runOrganismAutoReinforce(levelManager, [], provider, exec);
  });
}
