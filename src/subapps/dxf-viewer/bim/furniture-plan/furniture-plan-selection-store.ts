/**
 * ADR-654 — «ποιο έπιπλο τοποθετώ» selection SSoT.
 *
 * Ίδιο μοτίβο με το `block-library-selection-store` (palette → tool, event-time read,
 * μηδέν React state στο high-freq path — ADR-040), με ΜΙΑ ουσιώδη διαφορά:
 *
 * ⚠️ Κρατάμε ΚΑΙ το resolved `url`, όχι μόνο το id. Ο `resolveFurniturePlanUrl` είναι
 * **async** (storage mode → `getDownloadURL`), ενώ το placement γίνεται σε **event-time**
 * μέσα στον click handler, όπου δεν υπάρχει περιθώριο για `await`. Άρα η παλέτα κάνει
 * resolve ΜΙΑ φορά τη στιγμή της επιλογής (proactive) και εδώ αποθηκεύεται έτοιμο· το
 * tool το διαβάζει σύγχρονα. Όσο δεν έχει γίνει resolve, η επιλογή είναι `null` ⇒ το
 * tool απλά δεν τοποθετεί (μηδέν race, μηδέν entity με άδειο url).
 *
 * @see ../../data/furniture-plan-source.ts — ο async resolver
 * @see ../../hooks/drawing/useFurniturePlanTool.ts — event-time reader
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '../../stores/createExternalStore';

/** Η ενεργή επιλογή: catalog id + ΗΔΗ resolved URL του sprite. */
export interface FurniturePlanSelection {
  readonly id: string;
  readonly url: string;
}

const selected = createExternalStore<FurniturePlanSelection | null>(null);

/** Θέτει το προς-τοποθέτηση έπιπλο (η παλέτα, ΜΕΤΑ το resolve του url). */
export function setSelectedFurniturePlan(selection: FurniturePlanSelection | null): void {
  selected.set(selection);
}

/** Η τρέχουσα επιλογή, ή `null`. Event-time read για το tool. */
export function getSelectedFurniturePlan(): FurniturePlanSelection | null {
  return selected.get();
}

const getServerSnapshot = (): FurniturePlanSelection | null => null;

/** Reactive read (highlight της ενεργής κάρτας στην παλέτα). */
export function useSelectedFurniturePlan(): FurniturePlanSelection | null {
  return useSyncExternalStore(selected.subscribe, selected.get, getServerSnapshot);
}

/** Test-only reset. */
export function __resetFurniturePlanSelectionForTests(): void {
  selected.reset(null);
}
