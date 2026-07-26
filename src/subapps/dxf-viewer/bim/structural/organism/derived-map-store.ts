/**
 * Generic transient DERIVED-map store — SSoT factory (N.0.2, ADR-486/489).
 *
 * ΕΝΑ μόνο boilerplate για όλα τα «transient DERIVED `Map<string, T>`» που γεμίζει ο
 * organism pass (`useStructuralOrganism`) και διαβάζει synchronous το render path —
 * αντί κάθε concern να ξαναγράφει το ίδιο `EMPTY`/`set`/`get`.
 *
 * ⚠️ **Όριο εφαρμογής (ADR-489 §7):** αυτό το transport είναι έγκυρο ΜΟΝΟ για DERIVED
 * τιμές που καταναλώνονται στο **ίδιο scope** με αυτό που τις παρήγαγε — δηλαδή τον
 * **ενεργό όροφο**. Ο 3Δ render path σχεδιάζει και ΑΛΛΟΥΣ ορόφους («Όλοι οι όροφοι»):
 * εκεί ένας χάρτης scoped στον ενεργό όροφο, καταναλωμένος καθολικά, δίνει σιωπηλά
 * λάθος αποτέλεσμα (βλ. το πρώην `column-base-continuity-store`, που μεταφέρθηκε σε
 * per-stack `SyncContext`). Πριν προσθέσεις νέο store εδώ: **ποιος το διαβάζει, και
 * για ποιον όροφο;**
 *
 * Συμβόλαιο (κοινό σε όλους τους consumers):
 *   · `set(next)` — αντικαθιστά τον χάρτη (κενός → shared EMPTY, μηδέν alloc).
 *   · `get(id)` — synchronous read· `undefined` αν δεν υπάρχει DERIVED τιμή (caller fallback).
 * Low-frequency (μόνο organism recompute) → ADR-040 safe. Zero React. DERIVED, ΠΟΤΕ persisted.
 *
 * @see ./beam-support-condition-store.ts — DERIVED τύπος στήριξης δοκαριού (ADR-486)
 */

/** Read/write façade ενός transient DERIVED-map store. */
export interface DerivedMapStore<T> {
  /** Αντικατάστησε τον χάρτη (κενός → shared EMPTY). */
  set(next: ReadonlyMap<string, T>): void;
  /** Synchronous read· `undefined` αν δεν έχει υπολογιστεί DERIVED τιμή. */
  get(id: string): T | undefined;
}

/** Φτιάχνει ένα transient DERIVED-map store με το κοινό SSoT συμβόλαιο. */
export function createDerivedMapStore<T>(): DerivedMapStore<T> {
  const EMPTY: ReadonlyMap<string, T> = new Map();
  let byId: ReadonlyMap<string, T> = EMPTY;
  return {
    set(next: ReadonlyMap<string, T>): void {
      byId = next.size === 0 ? EMPTY : next;
    },
    get(id: string): T | undefined {
      return byId.get(id);
    },
  };
}
