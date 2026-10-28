/**
 * @fileoverview Κάλυψη κενού του PM (ADR-327 §8.5) — ο κανόνας μεταβολής.
 *
 * Κ1 μία ανά γραμμή RFQ: νέα τιμή αντικαθιστά, οι άλλες γραμμές μένουν ·
 * Κ2 ιδεμποτικό: ίδιο ποσό + ίδια σημείωση ⇒ `changed: false` · κενή σημείωση ≡ καμία ·
 * Κ3 `amount: null` = αφαίρεση· αφαίρεση ανύπαρκτης ⇒ `changed: false` ·
 * Κ4 στρογγύλευση σε λεπτά.
 */

import type { QuoteLevelingPlug } from '../../types/quote';
import { describePlugValue, upsertLevelingPlug } from '../leveling-plugs';

const STAMP = { setBy: 'u1', setAt: null as unknown as QuoteLevelingPlug['setAt'] };
const plug = (rfqLineId: string, amount: number, note: string | null = null): QuoteLevelingPlug => ({ rfqLineId, amount, note, ...STAMP });

describe('upsertLevelingPlug', () => {
  it('Κ1 — αντικαθιστά μόνο τη γραμμή της', () => {
    const r = upsertLevelingPlug([plug('L1', 10), plug('L2', 20)], { rfqLineId: 'L1', amount: 15, note: 'x' }, STAMP);
    expect(r.changed).toBe(true);
    expect(r.previous?.amount).toBe(10);
    expect(r.plugs.map((p) => [p.rfqLineId, p.amount, p.note])).toEqual([['L2', 20, null], ['L1', 15, 'x']]);
  });

  it('Κ2 — ίδια τιμή ⇒ καμία αλλαγή · κενή σημείωση ≡ null', () => {
    expect(upsertLevelingPlug([plug('L1', 10)], { rfqLineId: 'L1', amount: 10, note: '   ' }, STAMP).changed).toBe(false);
  });

  it('Κ3 — αφαίρεση', () => {
    const r = upsertLevelingPlug([plug('L1', 10)], { rfqLineId: 'L1', amount: null, note: null }, STAMP);
    expect(r).toMatchObject({ changed: true, plugs: [] });
    expect(upsertLevelingPlug([], { rfqLineId: 'L1', amount: null, note: null }, STAMP).changed).toBe(false);
  });

  it('Κ4 — λεπτά · ιστορικό', () => {
    expect(upsertLevelingPlug([], { rfqLineId: 'L1', amount: 10.005, note: null }, STAMP).plugs[0].amount).toBe(10.01);
    expect(describePlugValue(null)).toBe('—');
    expect(describePlugValue({ amount: 950 })).toBe('950');
  });
});
