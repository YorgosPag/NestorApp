/**
 * @fileoverview **Μνήμη ΕΤΥΜΗΓΟΡΙΩΝ εξωτερικής πηγής** — «δεν μπόρεσα να ρωτήσω» δεν αποθηκεύεται ποτέ.
 * @module lib/cache/verdict-cache
 * @related app/api/geocoding/geocoding-cache.ts · services/company-registry/gemi-opendata.client.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΞΑΓΩΓΗ, ΟΧΙ ΔΕΥΤΕΡΗ ΜΝΗΜΗ (ADR-841 §7 Α23 · N.0.2)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο μηχανισμός ζούσε **ιδιωτικά** στο `geocoding-cache.ts` (ADR-332 D27 Ζ5). Όταν η επαλήθευση
 * ΓΕΜΗ χρειάστηκε **την ίδια** πολιτική, οι δρόμοι ήταν δύο: αντίγραφο (δεύτερο `inFlight`,
 * δεύτερος κανόνας «ποτέ `unavailable`») ή εξαγωγή. Το αντίγραφο θα σήμαινε ότι μια διόρθωση
 * — π.χ. η απελευθέρωση κράτησης σε αποτυχία — φτάνει **στο ένα** από τα δύο.
 *
 * 🔑 **Ό,τι είναι ΠΟΛΙΤΙΚΗ ζει στον καλούντα** (πόσο ζει κάθε ετυμηγορία, πώς χτίζεται το
 * κλειδί)· **ό,τι είναι ΜΗΧΑΝΙΣΜΟΣ ζει εδώ** (αναζήτηση → κοινή υπόσχεση → αποθήκευση ή όχι).
 *
 * | Κανόνας | Γιατί |
 * |---|---|
 * | `ttlFor` επιστρέφει `null` ⇒ **δεν αποθηκεύεται** | η άγνοια δεν είναι γνώση· ένα παροδικό 429 δεν γίνεται μόνιμη αλήθεια |
 * | ταυτόχρονα ίδια κλειδιά μοιράζονται **μία** υπόσχεση | δύο ταυτόσημα αιτήματα στον ίδιο πάροχο είναι ακριβώς ό,τι οι όροι χρήσης λένε *faulty* |
 * | η κράτηση φεύγει **και σε αποτυχία** | μια κολλημένη υπόσχεση θα νέκρωνε το κλειδί για όλη τη ζωή της διεργασίας |
 *
 * ⚠️ **Το κλειδί ΠΡΕΠΕΙ να περιέχει το `prefix`**: το `clear()` σβήνει ό,τι το περιέχει
 * (`apiCache.invalidatePattern` = `includes`). Κλειδί χωρίς πρόθεμα δεν καθαρίζεται ποτέ.
 */

import { apiCache } from './enterprise-api-cache';

/** Η πολιτική μιας πηγής. */
export interface VerdictCachePolicy<V> {
  /** Πρόθεμα κλειδιών — και η εμβέλεια του `clear()`. Να φέρει έκδοση (π.χ. `…:v1`). */
  readonly prefix: string;
  /** Πόσο ζει μια ετυμηγορία σε ms· `null` ⇒ δεν αποθηκεύεται καθόλου. */
  readonly ttlFor: (verdict: V) => number | null;
  /** Τι γίνεται όταν μια ετυμηγορία **δεν** αποθηκεύεται (καταγραφή). */
  readonly onUnstored?: (key: string) => void;
}

export interface VerdictCache<V> {
  /** Ρωτά τον `fetcher` **μόνο αν χρειάζεται**. */
  readonly lookup: (key: string, fetcher: () => Promise<V>) => Promise<V>;
  /** Αδειάζει **αυτή** τη μνήμη (και τις εκκρεμείς κρατήσεις) — επιστρέφει πόσες εγγραφές έφυγαν. */
  readonly clear: () => number;
}

export function createVerdictCache<V>(policy: VerdictCachePolicy<V>): VerdictCache<V> {
  const inFlight = new Map<string, Promise<V>>();

  const lookup = async (key: string, fetcher: () => Promise<V>): Promise<V> => {
    const cached = apiCache.get<V>(key);
    if (cached !== null) return cached;

    const running = inFlight.get(key);
    if (running) return running;

    const promise = fetcher()
      .then((verdict) => {
        const ttl = policy.ttlFor(verdict);
        if (ttl !== null) apiCache.set(key, verdict, ttl);
        else policy.onUnstored?.(key);
        return verdict;
      })
      .finally(() => {
        inFlight.delete(key);
      });

    inFlight.set(key, promise);
    return promise;
  };

  const clear = (): number => {
    inFlight.clear();
    return apiCache.invalidatePattern(policy.prefix);
  };

  return { lookup, clear };
}
