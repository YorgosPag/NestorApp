/**
 * @fileoverview Άγκυρες ADR-896 §7Α.5 — **πού πάει η λωρίδα** όταν πατηθεί ◀/▶ ή όταν κάτι πρέπει να φανεί.
 *
 * Ο browser δίνει τους αριθμούς (το jsdom δεν έχει διάταξη)· εδώ κλειδώνεται η **κρίση**:
 * ποτέ μισό τσιπ, ποτέ προσπερασμένο τσιπ, ποτέ κίνηση για κάτι που ήδη φαίνεται.
 */

import { revealInlineTargetOf, type InlineSpan, type InlineView } from '@/lib/a11y/reveal-in-scroll';
import { pageTargetOf } from '../scroll-rail-geometry';

/** Πέντε τσιπ των 100px, κενό 10px: [0,100] [110,210] [220,320] [330,430] [440,540]. */
const SPANS: readonly InlineSpan[] = [0, 1, 2, 3, 4].map((i) => ({ start: i * 110, end: i * 110 + 100 }));
const view = (scrollLeft: number, clientWidth = 250): InlineView => ({ scrollLeft, clientWidth, scrollWidth: 540 });

describe('pageTargetOf — ▶/◀ διαλέγουν ΤΣΙΠ, όχι ποσοστό', () => {
  it('Σ1: ▶ — το κομμένο τσιπ της δεξιάς άκρης γίνεται το πρώτο ορατό', () => {
    // Στο 0 με κάδρο 250, το [220,320] κόβεται ⇒ στόχος 220.
    expect(pageTargetOf('next', view(0), SPANS)).toBe(220);
  });

  it('Σ2: ▶ με ζώνη σβησίματος — το τσιπ κάτω από τη μάσκα μετρά ως κρυμμένο', () => {
    // inset 40: ορατό ως 210 ⇒ το [110,210] μόλις χωρά, το [220,320] κρυμμένο ⇒ 220 − 40.
    expect(pageTargetOf('next', view(0), SPANS, 40)).toBe(180);
  });

  it('Σ3: ◀ — το κομμένο αριστερά φαίνεται ολόκληρο ΚΑΙ η λωρίδα ξεκινά σε αρχή τσιπ (σημείο snap)', () => {
    // Στο 290 (τέλος), κομμένο αριστερά το [220,320] ⇒ ελάχιστο 320−250 = 70 ⇒ στρογγύλεμα στο 110.
    const target = pageTargetOf('prev', view(290), SPANS);
    expect(target).toBe(110);
    expect(SPANS.some((span) => span.start === target)).toBe(true);
    expect(target).toBeLessThanOrEqual(220);
  });

  it('Σ4: όρια — ποτέ πέρα από την αρχή ή το τέλος', () => {
    expect(pageTargetOf('prev', view(50), SPANS)).toBe(0);
    expect(pageTargetOf('next', view(200), SPANS)).toBe(290);
  });

  it('Σ5: τσιπ φαρδύτερο από το κάδρο ⇒ δίχτυ 80%, ποτέ ακινησία', () => {
    const wide: InlineSpan[] = [{ start: 0, end: 600 }, { start: 610, end: 700 }];
    const frame: InlineView = { scrollLeft: 0, clientWidth: 250, scrollWidth: 700 };
    expect(pageTargetOf('next', frame, wide)).toBe(200);
  });

  it('Σ6: τίποτα πέρα ⇒ ο στόχος είναι η τρέχουσα θέση (το βελάκι δεν θα έπρεπε καν να φαίνεται)', () => {
    expect(pageTargetOf('next', view(290), SPANS)).toBe(290);
    expect(pageTargetOf('prev', view(0), SPANS)).toBe(0);
  });
});

describe('revealInlineTargetOf — «φέρε το σε θέα», με τη σημασία του `nearest`', () => {
  it('Ρ1: ήδη ορατό ⇒ null (καμία κίνηση)', () => {
    expect(revealInlineTargetOf(SPANS[1], view(0))).toBeNull();
  });

  it('Ρ2: δεξιά, κρυμμένο ⇒ η δεξιά του άκρη στο κάδρο, έξω από τη μάσκα', () => {
    expect(revealInlineTargetOf(SPANS[3], view(0), 40)).toBe(430 + 40 - 250);
  });

  it('Ρ3: αριστερά, κάτω από τη μάσκα ⇒ η αρχή του μετά τη μάσκα', () => {
    expect(revealInlineTargetOf(SPANS[2], view(200), 40)).toBe(180);
  });

  it('Ρ4: το πρώτο τσιπ στην αρχή δεν «κυνηγά» μάσκα που δεν υπάρχει (όριο 0 ⇒ null)', () => {
    expect(revealInlineTargetOf(SPANS[0], view(0), 40)).toBeNull();
  });

  it('Ρ5: κάδρο πλάτους 0 (jsdom, display:none) ⇒ null — ό,τι δεν μετρήθηκε δεν κινεί τίποτα', () => {
    expect(revealInlineTargetOf(SPANS[4], view(0, 0))).toBeNull();
  });
});
