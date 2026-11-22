/**
 * @fileoverview ⏱️ **Ο ΡΥΘΜΟΣ ΤΟΥ ΞΑΝΑΨΗΣΙΜΑΤΟΣ** — ADR-920 §14.9 Γ.
 * @related lib/listings/listing-recipe-backfill.ts
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**: (1) ποτέ πάνω από το όριο ανά πέρασμα· (2) το παράθυρο **κυλά**, άρα υποψήφιες που αποτυγχάνουν
 * μόνιμα δεν κρατούν τις ίδιες θέσεις για πάντα· (3) σε πεπερασμένα περάσματα **κάθε** υποψήφια περνά.
 */

import {
  LISTING_RECIPE_BACKFILL_PER_RUN,
  recipeBackfillRunIndex,
  recipeBackfillWindow,
} from '../listing-recipe-backfill';

const ids = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

describe('recipeBackfillWindow', () => {
  it('λιγότερες από το όριο ⇒ όλες, με τη σειρά τους', () => {
    expect(recipeBackfillWindow(ids(3), 5, 7)).toEqual([0, 1, 2]);
  });

  it('🔴 ποτέ πάνω από το όριο · καμία διπλή', () => {
    const out = recipeBackfillWindow(ids(30), 25, 0);
    expect(out).toHaveLength(25);
    expect(new Set(out).size).toBe(25);
  });

  it('🏆 το παράθυρο ΚΥΛΑ: διαδοχικά περάσματα ξεκινούν αλλού (κυκλικά)', () => {
    expect(recipeBackfillWindow(ids(10), 4, 0)).toEqual([0, 1, 2, 3]);
    expect(recipeBackfillWindow(ids(10), 4, 1)).toEqual([4, 5, 6, 7]);
    expect(recipeBackfillWindow(ids(10), 4, 2)).toEqual([8, 9, 0, 1]);
  });

  it('🔑 σε ⌈n / όριο⌉ διαδοχικά περάσματα, ΚΑΘΕ υποψήφια περνά — ακόμη κι αν όλες αποτυγχάνουν', () => {
    const n = 23;
    const limit = 5;
    const seen = new Set<number>();
    for (let run = 100; run < 100 + Math.ceil(n / limit); run++) for (const id of recipeBackfillWindow(ids(n), limit, run)) seen.add(id);
    expect(seen.size).toBe(n);
  });

  it('ντετερμινιστικό · όριο 0 ⇒ τίποτα', () => {
    expect(recipeBackfillWindow(ids(30), 25, 9)).toEqual(recipeBackfillWindow(ids(30), 25, 9));
    expect(recipeBackfillWindow(ids(30), 0, 9)).toEqual([]);
  });
});

describe('recipeBackfillRunIndex', () => {
  it('ένας αριθμός ανά μέρα (UTC)', () => {
    expect(recipeBackfillRunIndex(0)).toBe(0);
    expect(recipeBackfillRunIndex(86_399_999)).toBe(0);
    expect(recipeBackfillRunIndex(86_400_000)).toBe(1);
  });

  it('το όριο είναι θετικό', () => {
    expect(LISTING_RECIPE_BACKFILL_PER_RUN).toBeGreaterThan(0);
  });
});
