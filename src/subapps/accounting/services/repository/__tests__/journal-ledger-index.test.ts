/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΑ ΙΣΟΤΙΜΙΑΣ «ερώτημα ⇄ δείκτης» της σάρωσης καθολικού (ADR-870 §6 πρότυπο).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: το CHECK 3.91 εντοπίζει ερωτήματα από το τερματικό `.get()`· εδώ το `.get()` ζει μέσα στο
 * `processAdminBatch`, άρα η πύλη ΔΕΝ βλέπει τη σάρωση (μετρημένο 2026-10-14: ούτε στα ακάλυπτα ούτε στα
 * «μη αναλύσιμα»). Ο εξομοιωτής δεν επιβάλλει δείκτες. Χωρίς αυτή την άγκυρα ένας σβησμένος δείκτης θα
 * φαινόταν μόνο στην παραγωγή — όπως το `FAILED_PRECONDITION` του ΦΠΑ τριμήνου στις 14/10.
 *
 * Η άγκυρα ΕΚΤΕΛΕΙ την πραγματική `buildLedgerQuery` πάνω σε καταγραφέα και απαιτεί δείκτη για ό,τι κατέγραψε —
 * δεν ξαναγράφει τα σχήματα με το χέρι.
 */

import type { Query } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { indexesForShape, readCompositeIndexes, recordQueryShape } from '@/test-utils/firestore-indexes';

import type { JournalLedgerQuery } from '../../../types/journal';
import { buildLedgerQuery } from '../accounting-repo-journal-ledger';

const recordShape = (query: JournalLedgerQuery) =>
  recordQueryShape<Query>((recorder) => buildLedgerQuery(recorder, 'comp_a', query));

const PERIOD = { from: '2026-04-01', to: '2026-06-30' } as const;
const SHAPES: ReadonlyArray<readonly [string, JournalLedgerQuery]> = [
  ['περίοδος', { scope: { kind: 'period', period: PERIOD } }],
  ['περίοδος + τύπος', { scope: { kind: 'period', period: PERIOD }, type: 'income' }],
  ['χρήση', { scope: { kind: 'fiscalYear', fiscalYear: 2026 } }],
  ['χρήση + τύπος', { scope: { kind: 'fiscalYear', fiscalYear: 2026 }, type: 'expense' }],
  ['χρήση + τρίμηνο', { scope: { kind: 'fiscalYear', fiscalYear: 2026, quarter: 2 } }],
  ['χρήση + τρίμηνο + τύπος', { scope: { kind: 'fiscalYear', fiscalYear: 2026, quarter: 2 }, type: 'income' }],
];

const INDEXES = readCompositeIndexes();

describe('Ι — κάθε σχήμα της σάρωσης καθολικού έχει δείκτη', () => {
  it.each(SHAPES)('Ι-1 %s', (_label, query) => {
    const shape = recordShape(query);
    expect(shape.equality).toContain('companyId');
    expect(indexesForShape(INDEXES, COLLECTIONS.ACCOUNTING_JOURNAL_ENTRIES, shape).length).toBeGreaterThanOrEqual(1);
  });

  it('Ι-2 ο καταγραφέας ΟΝΤΩΣ βλέπει διαφορά ανάμεσα στους κλάδους (αλλιώς το Ι-1 θα περνούσε κενό)', () => {
    const distinct = new Set(SHAPES.map(([, q]) => {
      const s = recordShape(q);
      return `${[...s.equality].sort().join(',')}|${[...s.range].join(',')}`;
    }));
    expect(distinct.size).toBe(SHAPES.length);
  });
});
