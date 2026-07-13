/**
 * Block Library — «ποιο block τοποθετώ» selection SSoT (Milestone 1).
 *
 * Το palette («Τα Blocks μου») ζει σε ξεχωριστό subtree από το `useBlockLibraryTool` (μέσα στο
 * `CanvasSection`), οπότε η επιλογή περνά μέσα από ένα module-level signal — ίδιο μοτίβο με τα
 * `*-tool-bridge-store`, αλλά ΑΝΤΙΣΤΡΟΦΗ φορά (palette → tool). Το placement tool διαβάζει το
 * επιλεγμένο block name σε event-time (κλικ / ghost), όχι σε React state (ADR-040).
 *
 * SRP: κρατιέται χωριστά από το `block-library-registry` (defs store) — εδώ ζει ΜΟΝΟ η ενεργή
 * επιλογή. `null` = καμία επιλογή.
 *
 * @see ./block-library-registry.ts — οι διαθέσιμοι ορισμοί
 * @see ../../hooks/drawing/useBlockLibraryTool.ts — event-time reader
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '../../stores/createExternalStore';

const selected = createExternalStore<string | null>(null);

/** Θέτει το προς-τοποθέτηση block name (το palette card onClick). */
export function setSelectedBlockName(name: string | null): void {
  selected.set(name);
}

/** Το τρέχον επιλεγμένο block name, ή `null`. Event-time read για το tool. */
export function getSelectedBlockName(): string | null {
  return selected.get();
}

const getServerSnapshot = (): string | null => null;

/** Reactive read (palette highlight του active card). */
export function useSelectedBlockName(): string | null {
  return useSyncExternalStore(selected.subscribe, selected.get, getServerSnapshot);
}

/** Subscribe σε αλλαγές επιλογής· επιστρέφει unsubscribe. */
export function subscribeSelectedBlockName(listener: () => void): () => void {
  return selected.subscribe(listener);
}

/** Test-only reset. */
export function __resetBlockLibrarySelectionForTests(): void {
  selected.reset(null);
}
