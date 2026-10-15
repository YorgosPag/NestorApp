/**
 * @fileoverview **«Η διεύθυνση χωρίς χώρο φτάνει ΑΚΕΡΑΙΗ»** — ό,τι κουβαλά το δίχτυ από το αίτημα στον προορισμό.
 * @module lib/workspace/arrival-address
 * @see ADR-787 §5.3 ιβ (το δίχτυ `[...unprefixed]`) · ADR-840 §7.7
 *
 * 🔑 Ένα deep link είναι **τρία** μέρη: διαδρομή · ερώτημα · fragment. Το δίχτυ ξαναχτίζει **μόνο** τη διαδρομή
 *    (πρόθεμα χώρου)· τα άλλα δύο οφείλουν να περάσουν αυτούσια — αλλιώς ο άνθρωπος προσγειώνεται σε λάθος οθόνη
 *    και δεν έχει τρόπο να καταλάβει γιατί.
 *
 * 🔴 **ΓΙΑΤΙ ΤΟ FRAGMENT ΘΕΛΕΙ ΔΙΚΗ ΤΟΥ ΣΥΝΑΡΤΗΣΗ (μετρημένο 2026-10-15).** Ο server δεν βλέπει **ποτέ** το `#…`.
 *    Ένα πραγματικό HTTP 307 χωρίς fragment στο `Location` το κληρονομεί από τον browser (RFC 9110 §10.2.2) — αλλά
 *    κάτω από το `(app)/loading.tsx` το streaming έχει ήδη ξεκινήσει, η απάντηση είναι **200**, και το `redirect()`
 *    εκτελείται από τον **πελάτη** με URL που δεν έχει fragment. Το `/properties?view=floorplan#frag` κατέληγε σε
 *    `/o/<χώρος>/properties?view=floorplan` — χωρίς `#frag`. Άρα το fragment το προσθέτει ο πελάτης, εδώ.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, κανένα `window`.
 */

/** Τα search params όπως τα δίνει ο App Router σε μια σελίδα. */
export type ArrivalSearchParams = Readonly<Record<string, string | string[] | undefined>>;

/**
 * Το ερώτημα του αιτήματος, ξαναγραμμένο ως `?…` — ή κενό.
 *
 * ⚠️ Οι πολλαπλές τιμές (`?a=1&a=2`) περνούν **όλες**, με τη σειρά τους: το `Record` του Next τις δίνει ως πίνακα.
 */
export function arrivalQuery(searchParams: ArrivalSearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) for (const v of value) query.append(key, v);
    else if (value !== undefined) query.append(key, value);
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

/**
 * Ο προορισμός **με** το fragment του αιτήματος.
 *
 * 🔑 Αν ο προορισμός ορίζει ήδη δικό του fragment, **αυτό** κερδίζει — ίδιος κανόνας με τον browser σε 3xx
 *    (RFC 9110 §10.2.2: το fragment του `Location` υπερισχύει). Κενό ή σκέτο `#` ⇒ ο προορισμός αυτούσιος.
 */
export function withFragment(target: string, hash: string): string {
  if (target.includes('#')) return target;
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
  return fragment ? `${target}#${fragment}` : target;
}
