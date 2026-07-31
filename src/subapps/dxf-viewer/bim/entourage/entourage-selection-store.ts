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
  /**
   * ADR-736 §6 — **ετικέτα της πηγής** (όνομα αρχείου), όταν υπάρχει αρχείο να ονομαστεί.
   * Οι catalog οικογένειες δεν έχουν: το sprite τους δεν είναι «αρχείο του χρήστη» αλλά είδος
   * καταλόγου, και το όνομά του το συνθέτει το i18n (`composeEntourageDisplayName`). Ζει εδώ
   * και όχι σε υπότυπο ώστε ο ΚΟΙΝΟΣ `createEntourageTool` να το προωθεί χωρίς να ξέρει ποια
   * οικογένεια τον κάλεσε — αλλιώς θα χρειαζόταν per-family παράκαμψη στο `buildParams`.
   */
  readonly sourceName?: string;
}

/**
 * Οι λειτουργίες ενός selection store — παράγονται από το {@link createEntourageSelectionStore}.
 *
 * Ο τύπος-παράμετρος υπάρχει για τις οικογένειες που ξέρουν **περισσότερα** από `{id, url}` τη
 * στιγμή της επιλογής. Ο catalog-based entourage δεν ξέρει: το μέγεθος το δίνει ο catalog μέσα
 * στον placer. Μια εικόνα που **μόλις ανέβασε ο χρήστης** δεν έχει catalog — το μέγεθος
 * υπολογίζεται τη στιγμή της επιλογής (κλάσμα της οθόνης, ADR-736 §6) και ταξιδεύει μαζί της.
 * Default `EntourageSelection` ⇒ οι 4 υπάρχουσες οικογένειες μένουν **γραμμή προς γραμμή** ίδιες.
 */
export interface EntourageSelectionStore<T extends EntourageSelection = EntourageSelection> {
  /** Θέτει το προς-τοποθέτηση item (η παλέτα, ΜΕΤΑ το resolve του url). */
  set(selection: T | null): void;
  /** Η τρέχουσα επιλογή, ή `null`. Event-time read για το tool. */
  get(): T | null;
  /** Reactive read (highlight της ενεργής κάρτας στην παλέτα). */
  use(): T | null;
  /** Test-only reset. */
  resetForTests(): void;
}

const getServerSnapshot = (): null => null;

/** Χτίζει έναν απομονωμένο selection store για μία οικογένεια entourage. */
export function createEntourageSelectionStore<
  T extends EntourageSelection = EntourageSelection,
>(): EntourageSelectionStore<T> {
  const selected = createExternalStore<T | null>(null);

  return {
    set: (selection) => selected.set(selection),
    get: () => selected.get(),
    use: () => useSyncExternalStore(selected.subscribe, selected.get, getServerSnapshot),
    resetForTests: () => selected.reset(null),
  };
}
