/**
 * ADR-920 Β4.9 — οι γραμμές που δεν έγιναν σημεία, με αριθμό: οι πρώτες με αύξουσα σειρά, και «και άλλες Ν».
 */

import { skippedRowsSummaryOf, SKIPPED_ROWS_SHOWN } from '../skipped-rows-summary';

describe('skippedRowsSummaryOf', () => {
  it('λίγες γραμμές ⇒ όλες, ταξινομημένες, κανένα «και άλλες»', () => {
    expect(skippedRowsSummaryOf([9, 4, 12])).toStrictEqual({ shown: [4, 9, 12], more: 0 });
  });

  it('πολλές ⇒ οι πρώτες + πόσες ακόμη', () => {
    const rows = Array.from({ length: SKIPPED_ROWS_SHOWN + 5 }, (_, i) => 100 - i);
    const summary = skippedRowsSummaryOf(rows);
    expect(summary.shown).toHaveLength(SKIPPED_ROWS_SHOWN);
    expect(summary.shown[0]).toBe(86);
    expect(summary.more).toBe(5);
  });

  it('καμία ⇒ τίποτα· η είσοδος δεν αλλάζει', () => {
    const rows = [3, 1];
    expect(skippedRowsSummaryOf([])).toStrictEqual({ shown: [], more: 0 });
    skippedRowsSummaryOf(rows);
    expect(rows).toStrictEqual([3, 1]);
  });
});
