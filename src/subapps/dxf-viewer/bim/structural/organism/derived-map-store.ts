/**
 * Generic transient DERIVED-map store — SSoT factory (N.0.2, ADR-486/489).
 *
 * ΕΝΑ μόνο boilerplate για όλα τα «transient DERIVED `Map<string, T>`» που γεμίζει ο
 * organism pass (`useStructuralOrganism`) και διαβάζει synchronous το render path —
 * αντί κάθε concern να ξαναγράφει το ίδιο `EMPTY`/`set`/`get` (πρώην duplicate:
 * `beam-support-condition-store` + `column-base-continuity-store`).
 *
 * Συμβόλαιο (κοινό σε όλους τους consumers):
 *   · `set(next)` — αντικαθιστά τον χάρτη (κενός → shared EMPTY, μηδέν alloc).
 *   · `get(id)` — synchronous read· `undefined` αν δεν υπάρχει DERIVED τιμή (caller fallback).
 * Low-frequency (μόνο organism recompute) → ADR-040 safe. Zero React. DERIVED, ΠΟΤΕ persisted.
 *
 * @see ./beam-support-condition-store.ts — DERIVED τύπος στήριξης δοκαριού (ADR-486)
 * @see ./column-base-continuity-store.ts — DERIVED effective βάση κολώνας (ADR-489)
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
