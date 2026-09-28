/**
 * ADR-889 Φ2 — το συμβόλαιο των αρχείων τιμών συμβολαίων: αναγνώστες σχήματος (`null` = «δεν είναι αυτό το
 * αρχείο», ποτέ «κενό»), όροφος της πηγής, και ότι τα ΠΡΑΓΜΑΤΙΚΑ αρχεία του `public/` περνούν τον αναγνώστη.
 *
 * @jest-environment node
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  MARKET_TRANSACTIONS_FORMAT_VERSION,
  MARKET_TRANSACTIONS_INDEX_PUBLIC_PATH,
  ROW,
  ROW_FIELDS,
  mamaFloorLevel,
  marketTransactionsPublicPath,
  readAreaRowsFile,
  readAreaSummaryFile,
  readMarketTransactionsIndex,
} from '../market-transactions-file';

const V = MARKET_TRANSACTIONS_FORMAT_VERSION;
const SEGMENT = { quarters: { '2026-Q1': { n: 2 } }, last12: { n: 5, median: 1500, p25: 1200, p75: 1800 }, yearBuilt: {}, zone: null, priceToZonePct: null };

function publicJson(parts: readonly string[]): unknown {
  return JSON.parse(readFileSync(path.join(process.cwd(), 'public', ...parts), 'utf8'));
}

describe('όροφος της πηγής', () => {
  it("'Υ' = υπόγειο (−1)· αριθμός = όροφος· κενό ή άγνωστος κωδικός = null", () => {
    expect([mamaFloorLevel('Υ'), mamaFloorLevel('0'), mamaFloorLevel('12'), mamaFloorLevel(null), mamaFloorLevel('Ι')]).toEqual([-1, 0, 12, null, null]);
  });

  it('ROW = θέσεις του ROW_FIELDS (κανένας μαγικός αριθμός)', () => {
    expect(ROW.date).toBe(0);
    expect(ROW.unitPrice).toBe(ROW_FIELDS.length - 1);
  });
});

describe('αναγνώστες σχήματος', () => {
  it('στατιστικά: δέχεται το σχήμα, αρνείται άλλη ταυτότητα / έκδοση / άγνωστο τμήμα / χαλασμένο κελί', () => {
    const file = { v: V, id: 'municipality:4501', asOf: '2026-09-01', segments: { apartment: SEGMENT } };
    expect(readAreaSummaryFile(file, 'municipality:4501')?.segments.apartment?.last12).toEqual(SEGMENT.last12);
    expect(readAreaSummaryFile(file, 'municipality:0701')).toBeNull();
    expect(readAreaSummaryFile({ ...file, v: 1 }, 'municipality:4501')).toBeNull();
    expect(readAreaSummaryFile({ ...file, segments: { castle: SEGMENT } }, 'municipality:4501')).toBeNull();
    expect(readAreaSummaryFile({ ...file, segments: { apartment: { ...SEGMENT, last12: { n: 5, median: 'x' } } } }, 'municipality:4501')).toBeNull();
  });

  it('γραμμές: κάθε πλειάδα ελέγχεται σε μήκος', () => {
    const good = { v: V, id: 'x:1', districts: ['Α'], rows: [ROW_FIELDS.map(() => null)] };
    expect(readAreaRowsFile(good, 'x:1')?.rows).toHaveLength(1);
    expect(readAreaRowsFile({ ...good, rows: [[1, 2]] }, 'x:1')).toBeNull();
    expect(readAreaRowsFile('<html>', 'x:1')).toBeNull();
  });
});

const INDEX_ON_DISK = path.join(process.cwd(), 'public', ...MARKET_TRANSACTIONS_INDEX_PUBLIC_PATH);

(existsSync(INDEX_ON_DISK) ? describe : describe.skip)('τα ΠΡΑΓΜΑΤΙΚΑ αρχεία του public/ (γεννήτορας ↔ αναγνώστης)', () => {
  it('ευρετήριο, στατιστικά ΚΑΙ γραμμές της Αθήνας περνούν τον αναγνώστη', () => {
    const index = readMarketTransactionsIndex(publicJson(MARKET_TRANSACTIONS_INDEX_PUBLIC_PATH));
    expect(index?.areas.has('municipality:4501')).toBe(true);
    // Ο Δήμος Θεσσαλονίκης έχει Δ.Ε. ⇒ υπάρχει μόνο επειδή ο γεννήτορας ΑΘΡΟΙΖΕΙ τις Δ.Ε. του.
    expect(index?.areas.has('municipality:0701')).toBe(true);
    expect(index?.categorySegments[0]).toBe('apartment');
    const summary = readAreaSummaryFile(publicJson(marketTransactionsPublicPath('summary', 'municipality:4501')), 'municipality:4501');
    expect(summary?.segments.apartment?.last12.n).toBeGreaterThan(1000);
    expect(readAreaRowsFile(publicJson(marketTransactionsPublicPath('rows', 'municipality:4501')), 'municipality:4501')).not.toBeNull();
  });
});
