/**
 * ADR-651 §8 #9 — έξυπνη πρόταση χαρτιού: το bbox σε **mm μοντέλου** (units-aware) + το
 * μικρότερο φύλλο που το χωράει στην επιλεγμένη κλίμακα.
 */

import type { Entity } from '../../../types/entities';
import { drawingExtentMmOf, suggestPaperSpec, LARGEST_PAPER_SPEC } from '../suggest-paper';

/** Μια γραμμή από (0,0) ως (w,h) — ό,τι χρειάζεται για bbox. */
function line(w: number, h: number): Entity {
  return {
    id: 'e1',
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: w, y: h },
  } as unknown as Entity;
}

describe('drawingExtentMmOf — bbox σε mm, ανεξάρτητα από τις μονάδες του scene', () => {
  it('scene σε mm ⇒ οι τιμές περνούν αυτούσιες', () => {
    expect(drawingExtentMmOf([line(12000, 8000)], 'mm')).toEqual({
      widthMm: 12000,
      heightMm: 8000,
    });
  });

  it('scene σε ΜΕΤΡΑ (ελληνικά DXF — ADR-368) ⇒ ×1000 σε mm', () => {
    expect(drawingExtentMmOf([line(12, 8)], 'm')).toEqual({ widthMm: 12000, heightMm: 8000 });
  });

  it('κενό σχέδιο ⇒ null = «καμία πρόταση» (ποτέ ψεύτικο A0)', () => {
    expect(drawingExtentMmOf([], 'mm')).toBeNull();
  });
});

describe('suggestPaperSpec — το μικρότερο φύλλο που χωράει', () => {
  it('κτίριο 12m × 8m στο 1:50 ⇒ 240×160mm χαρτιού ⇒ πλαγιαστό φύλλο', () => {
    const spec = suggestPaperSpec({ widthMm: 12000, heightMm: 8000 }, 50);
    expect(spec.orientation).toBe('landscape');
    expect(['A3', 'A4']).toContain(spec.size);
  });

  it('ίδιο κτίριο σε ΜΕΓΑΛΥΤΕΡΗ κλίμακα (1:20) ⇒ μεγαλύτερο φύλλο', () => {
    const small = suggestPaperSpec({ widthMm: 12000, heightMm: 8000 }, 50);
    const large = suggestPaperSpec({ widthMm: 12000, heightMm: 8000 }, 20);
    expect(large.size).not.toBe(small.size);
  });

  it('ψηλό-στενό σχέδιο ⇒ όρθιο φύλλο (ο προσανατολισμός ακολουθεί την αναλογία)', () => {
    expect(suggestPaperSpec({ widthMm: 4000, heightMm: 20000 }, 100).orientation).toBe('portrait');
  });

  it('άκυρη κλίμακα ⇒ το μεγαλύτερο φύλλο (ποτέ crash, ποτέ «καμία απάντηση»)', () => {
    expect(suggestPaperSpec({ widthMm: 1000, heightMm: 1000 }, 0)).toEqual(LARGEST_PAPER_SPEC);
    expect(suggestPaperSpec({ widthMm: Number.NaN, heightMm: 1000 }, 50)).toEqual(LARGEST_PAPER_SPEC);
  });
});
