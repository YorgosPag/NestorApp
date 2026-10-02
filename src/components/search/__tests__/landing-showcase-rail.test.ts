/**
 * @fileoverview **Η ΣΕΙΡΑ ΤΗΣ ΒΙΤΡΙΝΑΣ ΕΙΝΑΙ ΠΑΝΤΑ ΓΕΜΑΤΗ** — φρουρός της σκάλας στηλών (ADR-777 §8.49).
 * @related components/search/landing-showcase-rail.module.css · lib/listings/listing-coverage
 *          · components/search-results/listing-card-frame
 *
 * 🔴 **ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΦΥΛΑΕΙ (2026-10-02, στιγμιότυπο)**: πλέγμα `auto-fill` + 6 κάρτες ⇒ 7 στήλες
 * στο zoom 90%, 8 στο 80% ⇒ άδειες θέσεις. Ο προηγούμενος φρουρός *ρωτούσε λάθος ερώτηση*
 * («διαιρείται το 6 με 1 · 2 · 3;») και ήταν πράσινος ενώ η οθόνη είχε τρύπες.
 *
 * Εδώ ρωτάμε τη σωστή, πάνω στο **ίδιο το CSS** που εκτελεί ο browser:
 *  1. κάθε κατώφλι της σκάλας = `k·MIN + (k−1)·GAP` — ξαναϋπολογισμένο από τους αριθμούς της TS·
 *  2. οι βαθμίδες είναι συνεχείς 2…N (καμία τρύπα, καμία διπλή)·
 *  3. η τελευταία βαθμίδα N **=** `LANDING_SHOWCASE_LIMIT` ⇒ όσο υπάρχει απόθεμα, σε κάθε πλάτος
 *     που η λωρίδα δείχνει k κάρτες, υπάρχουν τουλάχιστον k να δείξει.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { LANDING_SHOWCASE_LIMIT } from '@/lib/listings/listing-coverage';
import {
  LISTING_CARD_GAP_REM,
  LISTING_CARD_GRID_CLASS,
  LISTING_CARD_MIN_REM,
} from '@/components/search-results/listing-card-frame';

const CSS = readFileSync(join(__dirname, '..', 'landing-showcase-rail.module.css'), 'utf8');

const POINTER_MEDIA = '@media (hover: hover) and (pointer: fine) {';
const TOUCH_MEDIA = '@media not all and (hover: hover) and (pointer: fine) {';

/** Η προεξοχή σε αφή, όπως τη δηλώνει το CSS (`--showcase-peek-touch`) — ο αριθμός ζει ΕΚΕΙ. */
const TOUCH_PEEK_REM = Number(/--showcase-peek-touch:\s*([\d.]+)rem/.exec(CSS)?.[1]);

/** Το σώμα ενός media block — από την κεφαλίδα του ως το επόμενο `@media` (ή το τέλος). */
function mediaBlock(header: string): string {
  const start = CSS.indexOf(header);
  if (start < 0) return '';
  const next = CSS.indexOf('@media', start + header.length);
  return CSS.slice(start, next < 0 ? undefined : next);
}

/** `@container showcase (min-width: Xrem) { .frame .track { --showcase-cols: k; } }` ⇒ [{ k, minRem }]. */
function ladder(block: string): ReadonlyArray<{ readonly cols: number; readonly minRem: number }> {
  const pattern = /@container\s+showcase\s*\(min-width:\s*([\d.]+)rem\)\s*\{\s*\.frame \.track\s*\{\s*--showcase-cols:\s*(\d+);/g;
  return Array.from(block.matchAll(pattern), (m) => ({ cols: Number(m[2]), minRem: Number(m[1]) }));
}

const LADDERS = [
  { name: 'ποντίκι — k ολόκληρες κάρτες', block: mediaBlock(POINTER_MEDIA), peek: 0 },
  { name: 'αφή — k κάρτες + προεξοχή της επόμενης', block: mediaBlock(TOUCH_MEDIA), peek: TOUCH_PEEK_REM },
] as const;

describe.each(LADDERS)('Σ1 — Η ΣΚΑΛΑ ΣΤΗΛΩΝ ($name)', ({ block, peek }) => {
  it('🔴 κάθε κατώφλι είναι ΑΚΡΙΒΩΣ το πλάτος που χωρά k κάρτες ≥ 17rem (+ προεξοχή)', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: άλλαξε ένα κατώφλι στο CSS (π.χ. 88rem → 80rem) ⇒ κοκκινίζει.
    const steps = ladder(block);
    expect(Number.isFinite(peek)).toBe(true);
    expect(steps.length).toBeGreaterThan(0);
    for (const { cols, minRem } of steps) {
      const fits = cols * LISTING_CARD_MIN_REM + (cols - 1) * LISTING_CARD_GAP_REM + peek;
      expect(minRem).toBeCloseTo(fits, 5);
    }
  });

  it('🔴 οι βαθμίδες είναι συνεχείς από 2 ως την τελευταία — καμία τρύπα', () => {
    const cols = ladder(block).map((step) => step.cols);
    expect(cols).toEqual(Array.from({ length: cols.length }, (_, i) => i + 2));
  });

  it('🔴 Η ΤΕΛΕΥΤΑΙΑ ΒΑΘΜΙΔΑ ΕΙΝΑΙ ΤΟ ΟΡΙΟ — η σειρά γεμίζει σε κάθε πλάτος', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάνε το `LANDING_SHOWCASE_LIMIT` 6 ⇒ κοκκινίζει (το ελάττωμα του zoom 80%).
    const steps = ladder(block);
    expect(steps[steps.length - 1]?.cols).toBe(LANDING_SHOWCASE_LIMIT);
  });
});

describe('Σ2 — ΑΦΗ: Η ΠΡΟΕΞΟΧΗ ΕΙΝΑΙ Η ΟΔΗΓΙΑ', () => {
  it('🔴 σε αφή η επόμενη κάρτα προεξέχει και το σύρσιμο κουμπώνει σε ολόκληρη κάρτα', () => {
    // 🔴 **Το ελάττωμα του στιγμιοτύπου iPhone**: κάρτα 100%, κύλιση αόρατη. Σβήσε την προεξοχή ⇒ κοκκινίζει.
    const touch = mediaBlock(TOUCH_MEDIA);
    expect(TOUCH_PEEK_REM).toBeGreaterThan(0);
    expect(touch).toMatch(/--showcase-peek:\s*var\(--showcase-peek-touch\)/);
    expect(touch).toMatch(/scroll-snap-type:\s*x mandatory/);
  });

  it('🔴 οι δύο σκάλες ζουν σε ΞΕΝΑ μεταξύ τους blocks — καμία εξάρτηση από σειρά κανόνων', () => {
    expect(CSS.split(POINTER_MEDIA)).toHaveLength(2);
    expect(CSS.split(TOUCH_MEDIA)).toHaveLength(2);
    // Καμία βαθμίδα έξω από τα δύο blocks.
    const outside = CSS.slice(0, CSS.indexOf(POINTER_MEDIA));
    expect(ladder(outside)).toHaveLength(0);
  });
});

describe('Σ3 — ΤΟ ΚΕΝΟ', () => {
  it('🔴 το κενό της λωρίδας είναι το κενό του πλέγματος', () => {
    // Ένα κενό, δύο γλώσσες: `gap-3` (Tailwind, πλέγμα) · `--showcase-gap` (CSS, λωρίδα).
    expect(LISTING_CARD_GRID_CLASS).toContain('gap-3');
    expect(LISTING_CARD_GAP_REM).toBe(0.75);
    expect(CSS).toMatch(new RegExp(`--showcase-gap:\\s*${LISTING_CARD_GAP_REM}rem`));
  });
});
