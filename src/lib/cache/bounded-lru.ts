/**
 * @fileoverview **ΚΡΥΦΗ ΜΝΗΜΗ LRU ΜΕ ΟΡΙΟ ΒΑΡΟΥΣ** — κρατά τα πιο πρόσφατα χρησιμοποιημένα, πετά τα παλαιότερα όταν το
 * άθροισμα βαρών (π.χ. bytes) ξεπεράσει το όριο (ADR-884 Φ2ε · §4.11). Γενικό· χωρίς DOM.
 * @related `components/spatial-tour/viewer/tile-panorama-source.ts` (πρώτος καταναλωτής: αποκωδικοποιημένα πλακίδια)
 * @module lib/cache/bounded-lru
 *
 * 🔑 **Σειρά χρήσης = σειρά εισαγωγής του `Map`**: κάθε `get` ξαναβάζει το κλειδί στο τέλος· έξωση από την αρχή.
 * 🔑 **`onEvict`**: ο κάτοχος αποδεσμεύει πόρους (υφή, `blob:` URL) — η κρυφή μνήμη δεν ξέρει τι κρατά.
 * 🔑 Τιμή βαρύτερη από όλο το όριο **δεν** μπαίνει (θα έδιωχνε τα πάντα για να μη χωρέσει ούτε η ίδια).
 */

export interface BoundedLru<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  has(key: string): boolean;
  /** Βγάζει ένα κλειδί (με `onEvict`) — π.χ. αποτυχημένη φόρτωση που δεν πρέπει να κρατηθεί (ADR-904 Κ9). */
  delete(key: string): void;
  clear(): void;
  /** Τρέχον άθροισμα βαρών. */
  weight(): number;
}

export interface BoundedLruOptions<V> {
  readonly maxWeight: number;
  readonly weigh: (value: V) => number;
  readonly onEvict?: (value: V, key: string) => void;
}

export function createBoundedLru<V>({ maxWeight, weigh, onEvict }: BoundedLruOptions<V>): BoundedLru<V> {
  const entries = new Map<string, { readonly value: V; readonly weight: number }>();
  let total = 0;

  function remove(key: string): void {
    const entry = entries.get(key);
    if (entry === undefined) return;
    entries.delete(key);
    total -= entry.weight;
    onEvict?.(entry.value, key);
  }

  return {
    get(key) {
      const entry = entries.get(key);
      if (entry === undefined) return undefined;
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    set(key, value) {
      const weight = weigh(value);
      remove(key);
      if (weight > maxWeight) return;
      entries.set(key, { value, weight });
      total += weight;
      for (const oldest of entries.keys()) {
        if (total <= maxWeight) break;
        remove(oldest);
      }
    },
    has: (key) => entries.has(key),
    delete: remove,
    clear() {
      for (const key of [...entries.keys()]) remove(key);
    },
    weight: () => total,
  };
}
