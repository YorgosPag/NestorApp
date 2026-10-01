/**
 * @fileoverview **Ο ΧΑΡΤΗΣ ΔΗΛΩΣΕΩΝ ΑΝΑ ΑΡΧΕΙΟ** — `FileRecord.id` → τιμή που δήλωσε ο άνθρωπος.
 * @related ADR-880 (σημεία εστίασης) · ADR-897 (σημεία λήψης) · lib/listings/declared-file-ids
 * @module lib/listings/declared-file-map
 *
 * 🔑 **Η μηχανή κοινή, η απόφαση όχι** (δόγμα του `useDeclaredFileIds`): κάθε δήλωση «ανά φωτογραφία» έχει τον
 * **ίδιο** σκελετό — ανάγνωση με πτώση της άκυρης γραμμής **μόνης της**, αντικατάσταση χωρίς μετάλλαξη, ισότητα
 * αδιάφορη στη σειρά. Ό,τι διαφέρει (πώς διαβάζεται και πότε δύο τιμές είναι ίδιες) δίνεται ως όρισμα.
 * Γεννήθηκε τη μέρα που ήρθε η **δεύτερη** τέτοια δήλωση (ADR-897), αντί για δίδυμο (N.0.2 / N.18).
 *
 * ⚠️ **Καθαρό module** — κανένα React, κανένα Firestore.
 */

/**
 * **Η μία ανάγνωση ωμού χάρτη** — ποτέ δεν πετά. Μη-αντικείμενο ⇒ κενός χάρτης· άκυρη γραμμή ή κενή ταυτότητα
 * ⇒ πέφτει **μόνη της**, χωρίς να ακυρώνει τις άλλες (η πόρτα είναι `.passthrough()`, το ιστορικό δεν είναι έμπιστο).
 */
export function readDeclaredFileMap<T>(
  value: unknown,
  readOne: (raw: unknown) => T | null,
): ReadonlyMap<string, T> {
  const declared = new Map<string, T>();
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return declared;

  for (const [id, raw] of Object.entries(value)) {
    const entry = readOne(raw);
    if (id.trim() !== '' && entry !== null) declared.set(id, entry);
  }
  return declared;
}

/** Ίδιες δηλώσεις; — ίδιο σύνολο αρχείων, ίδια τιμή το καθένα κατά `same` (η σειρά αδιάφορη). */
export function sameDeclaredFileMap<T>(
  a: ReadonlyMap<string, T>,
  b: ReadonlyMap<string, T>,
  same: (left: T, right: T) => boolean,
): boolean {
  if (a.size !== b.size) return false;
  for (const [id, entry] of a) {
    const other = b.get(id);
    if (other === undefined || !same(entry, other)) return false;
  }
  return true;
}

/** Μία γραμμή αλλαγμένη — νέος χάρτης, ποτέ μετάλλαξη. `null` ⇒ η γραμμή **φεύγει** (το έγγραφο δεν κρατά κενά). */
export function withDeclaredFileEntry<T>(
  declared: ReadonlyMap<string, T>,
  id: string,
  entry: T | null,
): ReadonlyMap<string, T> {
  const next = new Map(declared);
  if (entry === null) next.delete(id);
  else next.set(id, entry);
  return next;
}
