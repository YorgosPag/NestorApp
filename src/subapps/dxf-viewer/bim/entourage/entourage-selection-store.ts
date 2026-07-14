/**
 * ADR-654 M6 — «ποιο entourage τοποθετώ» selection SSoT (κοινό factory).
 *
 * Γενίκευση του `furniture-plan-selection-store`: μία εργοστασιακή συνάρτηση παράγει έναν
 * απομονωμένο store ανά οικογένεια (άνθρωποι, οχήματα) — μηδέν React state στο high-freq path
 * (ADR-040), event-time read για το tool, reactive read για το highlight της κάρτας.
 *
 * Κρατάμε ΚΑΙ το `url` (όχι μόνο το id): το URL παράγεται σύγχρονα από το asset-pack registry
 * (ADR-655) ⇒ δεν υπάρχει race — το πεδίο μένει γιατί είναι ό,τι τελικά μπαίνει στο `ImageEntity.url`.
 *
 * @see ../../data/entourage-source.ts — sync URL builder
 * @see ./entourage-selection-stores.ts — τα per-pack instances (people, vehicles)
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '../../stores/createExternalStore';

/** Η ενεργή επιλογή: catalog id + ΗΔΗ resolved URL του sprite. */
export interface EntourageSelection {
  readonly id: string;
  readonly url: string;
}

/** Οι λειτουργίες ενός selection store — παράγονται από το {@link createEntourageSelectionStore}. */
export interface EntourageSelectionStore {
  /** Θέτει το προς-τοποθέτηση item (η παλέτα, ΜΕΤΑ το resolve του url). */
  set(selection: EntourageSelection | null): void;
  /** Η τρέχουσα επιλογή, ή `null`. Event-time read για το tool. */
  get(): EntourageSelection | null;
  /** Reactive read (highlight της ενεργής κάρτας στην παλέτα). */
  use(): EntourageSelection | null;
  /** Test-only reset. */
  resetForTests(): void;
}

const getServerSnapshot = (): EntourageSelection | null => null;

/** Χτίζει έναν απομονωμένο selection store για μία οικογένεια entourage. */
export function createEntourageSelectionStore(): EntourageSelectionStore {
  const selected = createExternalStore<EntourageSelection | null>(null);

  return {
    set: (selection) => selected.set(selection),
    get: () => selected.get(),
    use: () => useSyncExternalStore(selected.subscribe, selected.get, getServerSnapshot),
    resetForTests: () => selected.reset(null),
  };
}
