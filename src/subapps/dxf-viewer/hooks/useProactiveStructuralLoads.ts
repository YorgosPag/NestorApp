'use client';

/**
 * useProactiveStructuralLoads — ADR-459 Phase 9 (PROACTIVE real-time φορτία).
 *
 * Καθρεφτίζει το `useProactiveOrganismReinforce` (Φ8): μόλις ο στατικός οργανισμός
 * **δημιουργείται ή μεγαλώνει** (νέα/μετακινημένη/διαγραμμένη κολώνα/δοκάρι, from-grid),
 * ξανα-τρέχει αυτόματα — χωρίς κουμπί — τη διαδρομή φορτίων μέσω του SSoT πυρήνα
 * `runStructuralLoadTakedown`. Σενάριο-στόχος: ενώνεις 2 κολόνες με δοκάρι → το δοκάρι
 * μεταφέρει αντιδράσεις στις κολόνες → η αξονική τους ανανεώνεται → τα πέδιλα
 * ξανα-διαστασιολογούνται (`useAutoFoundationDesign` reagisce στο emit).
 *
 * **Το ΠΡΩΤΟ σκαλί της αλυσίδας** `φορτία → sizing πεδίλων → διαγνωστικά`: το
 * `bim:structural-loads-computed` ανήκει ήδη στα `AUTO_DESIGN_EVENTS` (Φ7) και
 * `ORGANISM_EVENTS` (Φ1), οπότε τα downstream στάδια αλυσιδώνονται μόνα τους.
 *
 * **Ντετερμινιστική σειρά (κρίσιμο):** mounted ΠΡΙΝ από το `useAutoFoundationDesign`
 * στο shell ⇒ ο load handler καλείται πρώτος, εκτελεί+emit-άρει **σύγχρονα** μέσα στο
 * microtask, και το ήδη-προγραμματισμένο foundation microtask διαβάζει το φρέσκο
 * `appliedLoad` → ΕΝΑ pass, σωστή σειρά (όχι 2-pass flicker).
 *
 * **Loop guard:** ΔΕΝ ακούει το δικό του `bim:structural-loads-computed`, ούτε τα
 * παράγωγα `bim:column-footing-attached` / `bim:structural-auto-reinforced` /
 * `bim:foundation-params-updated` (αλλιώς κύκλος φορτία→πέδιλο→φορτία). Ο πυρήνας/
 * command είναι ούτως ή άλλως idempotent (re-run ίδιας τοπολογίας → ίδια φορτία).
 *
 * **Σιωπηλός (Revit-grade):** καμία ειδοποίηση — αυτόματη background συμπεριφορά (το
 * ribbon path κρατά το ρητό «Υπολογισμός Φορτίων»).
 *
 * **Atomic undo:** geometry-edit triggers (έχουν δικό τους command στο stack) → τα
 * παράγωγα φορτία ομαδοποιούνται στο ΙΔΙΟ undo step (`executeGrouped`) μαζί με
 * πέδιλο+οπλισμό → ΕΝΑ Ctrl+Z· τα batch (from-grid) → standalone.
 *
 * ADR-040 safe: low-freq, coalesced ανά microtask (mirror `useStructuralOrganism`).
 *
 * @see hooks/structural-load-takedown-core.ts — runStructuralLoadTakedown (SSoT)
 * @see hooks/useProactiveOrganismReinforce.ts — το proactive πρότυπο (Φ8)
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 9
 */

import { type DrawingEventType } from '../systems/events/EventBus';
import { makeGuideOffsetLookup } from '../bim/hosting/guide-store-offset-lookup';
import { useStructuralSettingsStore } from '../state/structural-settings-store';
import { resolveEffectiveAreaLoads } from '../bim/structural/loads/occupancy-loads';
import { useBuildingStoreyCount } from './useBuildingStoreyCount';
import { useBuildingOccupancy } from './useBuildingOccupancy';
import { runStructuralLoadTakedown, type LoadTakedownLevelManager } from './structural-load-takedown-core';
import { useGroupedStructuralReaction } from './useGroupedStructuralReaction';

/** Στατικές μεταβολές που αλλάζουν τη διαδρομή φορτίων → recompute. */
const PROACTIVE_LOAD_EVENTS: readonly DrawingEventType[] = [
  // ADR-459 v19 — SINGLE-PATH: αντικαθιστά τα generic `drawing:entity-created` + `bim:entities-moved`
  // (move/create δομικού μέλους, gated ΜΙΑ φορά στον `useStructuralRelevanceRouter`).
  'bim:structural-geometry-changed',
  'bim:column-params-updated', // grip-resize / ribbon edit (διατομή → tributary)
  'bim:beam-params-updated',
  'bim:slab-params-updated', // ADR-476 — αλλαγή πλάκας → re-derive tributary/area load
  'bim:wall-params-updated', // ADR-478 — πάχος/υλικό/ύψος τοίχου → re-derive γραμμικό φορτίο δοκού
  'bim:column-delete-requested',
  'bim:beam-delete-requested',
  'bim:wall-delete-requested', // ADR-478 — αφαίρεση τοίχου → μειώνεται το φορτίο δοκού
  'bim:columns-from-grid',
  'bim:beams-from-grid',
  'bim:foundations-from-grid',
  'bim:walls-from-grid', // ADR-478 — batch τοίχοι από κάναβο
  'bim:walls-from-perimeter', // ADR-478 — batch τοίχοι από περίμετρο
];

export function useProactiveStructuralLoads(props: { levelManager: LoadTakedownLevelManager }): void {
  const { levelManager } = props;
  const storeyCount = useBuildingStoreyCount();
  // ADR-474 — structural occupancy κληρονομημένη από building.category (SSoT).
  const occupancy = useBuildingOccupancy();

  // SSoT wiring (coalescing + atomic-undo grouping) → `useGroupedStructuralReaction`·
  // εδώ μένει ΜΟΝΟ η μοναδική λογική recompute φορτίων.
  useGroupedStructuralReaction(PROACTIVE_LOAD_EVENTS, (exec) => {
    const settings = useStructuralSettingsStore.getState();
    // ADR-474 — explicit kPa κερδίζει· αλλιώς auto από occupancy + γεωμετρία πλάκας.
    const areaLoads = resolveEffectiveAreaLoads({
      explicitDeadKpa: settings.deadAreaLoadKpa,
      explicitLiveKpa: settings.liveAreaLoadKpa,
      occupancy: settings.occupancy ?? occupancy, // override → building category → default
    });
    runStructuralLoadTakedown(levelManager, { storeyCount, ...areaLoads }, makeGuideOffsetLookup(), exec);
  });
}
