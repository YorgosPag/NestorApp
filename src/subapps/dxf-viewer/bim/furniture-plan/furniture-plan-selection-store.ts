/**
 * ADR-654 — «ποιο έπιπλο τοποθετώ» selection SSoT.
 *
 * Ίδιο μοτίβο με το `block-library-selection-store` (palette → tool, event-time read,
 * μηδέν React state στο high-freq path — ADR-040).
 *
 * Κρατάμε ΚΑΙ το `url`, όχι μόνο το id, ώστε το tool να το διαβάζει σύγχρονα σε event-time.
 *
 * ℹ️ ΙΣΤΟΡΙΚΟ (ADR-655): παλιότερα το URL ήταν **async** (`getDownloadURL`) και η παλέτα έκανε
 * proactive prefetch ΠΡΙΝ γράψει εδώ, για να μην υπάρχει race στον click handler. Πλέον το URL
 * παράγεται σύγχρονα από το asset-pack registry ⇒ **δεν υπάρχει race να αποφύγεις**. Το πεδίο
 * `url` παραμένει γιατί είναι το ίδιο πράγμα που τελικά μπαίνει στο `ImageEntity.url`.
 *
 * @see ../../data/furniture-plan-source.ts — sync URL builder
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
