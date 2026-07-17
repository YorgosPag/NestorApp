/**
 * ADR-189 — Παράλληλος οδηγός: η πλευρά ακολουθεί τον κέρσορα.
 *
 * ΓΙΑΤΙ round-trip και όχι σκέτο πρόσημο: το πρόσημο μόνο του δεν σημαίνει τίποτα —
 * νόημα έχει ΜΟΝΟ σε συνδυασμό με το τι κάνει η `CreateParallelGuideCommand` μαζί του.
 * Ένα test που κλείδωνε το πρόσημο απομονωμένο θα «πέρναγε» και με ανεστραμμένη
 * σύμβαση. Εδώ εκτελούμε την πραγματική εντολή και ελέγχουμε ΠΟΥ κατέληξε ο οδηγός.
 */

import { GuideStore } from '../guide-store';
import { CreateParallelGuideCommand } from '../commands';
import { resolveParallelSide } from '../guide-parallel-side';
import type { Guide, Point2D } from '../guide-types';

const DIST = 5;

/** Δημιουργεί τον παράλληλο όπως ακριβώς το κάνει το UI: sign × θετική απόσταση. */
function createParallelAt(store: GuideStore, ref: Guide, cursor: Point2D): Guide {
  const sign = resolveParallelSide(ref, cursor);
  const cmd = new CreateParallelGuideCommand(store, ref.id, DIST * sign);
  cmd.execute();
  const created = store.getGuides().find(g => g.id !== ref.id);
  if (!created) throw new Error('parallel guide not created');
  return created;
}

describe('resolveParallelSide → CreateParallelGuideCommand (round-trip)', () => {
  describe('άξονας Y (οριζόντιος οδηγός) — το σενάριο του bug', () => {
    it.each([
      ['κέρσορας πιο πάνω σε offset (y=18)', 18, 15],
      ['κέρσορας πιο κάτω σε offset (y=2)', 2, 5],
    ])('%s → ο παράλληλος πέφτει στην ίδια πλευρά', (_label, cursorY, expectedOffset) => {
      const store = new GuideStore();
      const ref = store.addGuideRaw('Y', 10)!;
      const created = createParallelAt(store, ref, { x: 0, y: cursorY });
      expect(created.offset).toBe(expectedOffset);
    });

    it('η πλευρά ΔΕΝ εξαρτάται από το πόσο μακριά είναι ο κέρσορας', () => {
      const store = new GuideStore();
      const ref = store.addGuideRaw('Y', 10)!;
      // Οριακά πάνω από τη γραμμή (μέσα στην ανοχή 30px) → ίδια πλευρά με μακριά.
      const created = createParallelAt(store, ref, { x: 0, y: 10.01 });
      expect(created.offset).toBe(15);
    });
  });

  describe('άξονας X (κατακόρυφος οδηγός) — δεν πρέπει να παλινδρομήσει', () => {
    it.each([
      ['κέρσορας δεξιά (x=18)', 18, 15],
      ['κέρσορας αριστερά (x=2)', 2, 5],
    ])('%s → ο παράλληλος πέφτει στην ίδια πλευρά', (_label, cursorX, expectedOffset) => {
      const store = new GuideStore();
      const ref = store.addGuideRaw('X', 10)!;
      const created = createParallelAt(store, ref, { x: cursorX, y: 0 });
      expect(created.offset).toBe(expectedOffset);
    });
  });

  describe('άξονας XZ (διαγώνιος οδηγός)', () => {
    // Διαγώνιος από (0,0) → (10,10). Το κάθετο n = (-dy,dx)/len δείχνει πάνω-αριστερά.
    const start: Point2D = { x: 0, y: 0 };
    const end: Point2D = { x: 10, y: 10 };

    it('κέρσορας πάνω-αριστερά από τη διαγώνιο → ο παράλληλος πάει πάνω-αριστερά', () => {
      const store = new GuideStore();
      const ref = store.addDiagonalGuideRaw(start, end)!;
      const created = createParallelAt(store, ref, { x: 0, y: 10 });
      // Ίδια πλευρά = το midpoint μετακινήθηκε προς τα πάνω-αριστερά.
      expect(created.startPoint!.x).toBeLessThan(start.x);
      expect(created.startPoint!.y).toBeGreaterThan(start.y);
    });

    it('κέρσορας κάτω-δεξιά από τη διαγώνιο → ο παράλληλος πάει κάτω-δεξιά', () => {
      const store = new GuideStore();
      const ref = store.addDiagonalGuideRaw(start, end)!;
      const created = createParallelAt(store, ref, { x: 10, y: 0 });
      expect(created.startPoint!.x).toBeGreaterThan(start.x);
      expect(created.startPoint!.y).toBeLessThan(start.y);
    });

    it('η απόσταση του παράλληλου από τη διαγώνιο ισούται με τη ζητούμενη', () => {
      const store = new GuideStore();
      const ref = store.addDiagonalGuideRaw(start, end)!;
      const created = createParallelAt(store, ref, { x: 0, y: 10 });
      const dx = created.startPoint!.x - start.x;
      const dy = created.startPoint!.y - start.y;
      expect(Math.sqrt(dx * dx + dy * dy)).toBeCloseTo(DIST, 6);
    });
  });
});
