'use client';

/**
 * ADR-651 — γενικός keyed cache για **εικόνες κελιού πινακίδας** (module singleton, zero React).
 *
 * Η πινακίδα χτίζεται σε καθαρές συναρτήσεις (ghost === commit === PDF): κανένα `await` στο
 * μονοπάτι σχεδίασης. Άρα κάθε εικόνα φορτώνεται **μία φορά, εκ των προτέρων** και το layout τη
 * διαβάζει **σύγχρονα** με getter — το μοτίβο του `placeholder-scope-client` (§5.1).
 *
 * SSoT μηχανισμός (N.18 — μηδέν sibling clone): ένας cache + in-flight dedupe + getter, **δύο**
 * καταναλωτές που διαφέρουν **μόνο** στο πώς παράγεται η εικόνα:
 *  - **σφραγίδα** (`stamp-image-client`) — fetch remote URL → canvas → data URL,
 *  - **QR** (`qr-image-client`) — τοπική γέννηση με `QRCode.toDataURL`.
 *
 * Ο `decode` (η μόνη διαφορά) δίνεται από τον καταναλωτή· ο cache/dedupe/getter μένει εδώ, μία
 * φορά. Αποτυχία `decode` ⇒ `null` (κενό κελί), **ποτέ** μπλοκαρισμένη εισαγωγή.
 */

/** Φόρτωσε-μία-φορά / διάβασε-σύγχρονα, keyed by string (URL για σφραγίδα, payload για QR). */
export interface KeyedImageCache<T> {
  /** Idempotent φόρτωση (in-flight dedupe). `undefined`/κενό key ⇒ `null`. */
  load(key: string | undefined): Promise<T | null>;
  /** Event-time read (κλικ / ghost / PDF). `null` όσο δεν έχει φορτώσει ή αν απέτυχε. */
  get(key: string | undefined): T | null;
  /** Test seam — καθαρίζει το singleton μεταξύ των specs. */
  reset(): void;
}

/**
 * Φτιάχνει έναν keyed cache πάνω στον δοσμένο `decode`. Ο `onError` αναφέρει την αποτυχία (ο
 * καταναλωτής ξέρει το σωστό μήνυμα/logger) — ο cache απλώς επιστρέφει `null` και προχωρά.
 */
export function createKeyedImageCache<T>(
  decode: (key: string) => Promise<T>,
  onError: (error: unknown) => void,
): KeyedImageCache<T> {
  const cache = new Map<string, T>();
  const pending = new Map<string, Promise<T | null>>();

  function load(key: string | undefined): Promise<T | null> {
    if (!key) return Promise.resolve(null);
    const hit = cache.get(key);
    if (hit) return Promise.resolve(hit);
    const inFlight = pending.get(key);
    if (inFlight) return inFlight;

    const promise = decode(key)
      .then((value) => {
        cache.set(key, value);
        pending.delete(key);
        return value;
      })
      .catch((error: unknown) => {
        pending.delete(key);
        onError(error);
        return null;
      });

    pending.set(key, promise);
    return promise;
  }

  function get(key: string | undefined): T | null {
    return key ? cache.get(key) ?? null : null;
  }

  function reset(): void {
    cache.clear();
    pending.clear();
  }

  return { load, get, reset };
}
