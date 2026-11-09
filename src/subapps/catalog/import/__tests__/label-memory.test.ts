/**
 * Η καθαρή μηχανή της μνήμης ετικετών γραμμής (ADR-923 §5.5.2 Β5): ετυμηγορία, μάθηση, εφαρμογή, κλειδί.
 */

import type { ImportLineDecision, ImportLineIdentity, ImportLineOverride } from '../../types/catalog-import';
import { IMPORT_LABEL_MEMORY_MAX_DECISIONS } from '../../vocabulary/catalog-import';
import { labelMemoryKey, pageTableAddressOf, pageTableGroupKey, priceGroupKeyOf } from '../import-keys';
import {
  isMemorable,
  learnableOverrides,
  learnedDecisions,
  memoryKeyOf,
  memoryOverridesFor,
  memoryVerdict,
  sameLineDecision,
  type LabelMemoryBook,
  type MemoryApplication,
} from '../label-memory';
import { withLineOverride } from '../page-line-overrides';

const SCOPE = { supplierContactId: 'cont_aries', familyId: 'cfam_fancoil' };
const STAMP = { by: 'usr_1', at: '2026-11-09T10:00:00.000Z' };
const LEARN = { batchId: 'cibat_1', ...STAMP };
const identity = (label: string, unitCode: string | null = null): ImportLineIdentity => ({ label, unitCode, printed: label.toUpperCase() });
const AIRFLOW: ImportLineDecision = { kind: 'attribute', attributeId: 'airflow_m' };
const PRICE: ImportLineDecision = { kind: 'price', unitCode: 'pce' };

function bookOf(entries: readonly (readonly [ImportLineIdentity, readonly ImportLineDecision[]])[]): LabelMemoryBook {
  return new Map(entries.map(([id, decisions], index) => [
    memoryKeyOf(SCOPE, id),
    { id: `cilm_${index}`, decisions: decisions.reduce((acc, decision) => learnedDecisions(acc, decision, LEARN), [] as ReturnType<typeof learnedDecisions>) },
  ]));
}

const applicationOf = (book: LabelMemoryBook, overrides: Partial<MemoryApplication> = {}): MemoryApplication =>
  ({ scope: SCOPE, book, knownAttributeIds: new Set(['airflow_m']), pricesEnabled: true, stamp: STAMP, ...overrides });

const table = (lines: readonly (readonly [number, ImportLineIdentity])[]) => ({ page: 85, table: 't0', identities: new Map(lines) });

describe('ετυμηγορία', () => {
  it('καμία απόφαση ⇒ τίποτα · μία ⇒ εφαρμογή με τον μετρητή · δύο ⇒ σύγκρουση', () => {
    expect(memoryVerdict(null)).toEqual({ kind: 'none' });
    const once = learnedDecisions(learnedDecisions([], AIRFLOW, LEARN), AIRFLOW, { ...LEARN, batchId: 'cibat_2' });
    expect(memoryVerdict({ decisions: once })).toEqual({ kind: 'apply', decision: AIRFLOW, count: 2, sourceBatchId: 'cibat_2' });
    expect(memoryVerdict({ decisions: learnedDecisions(once, { kind: 'ignore' }, LEARN) })).toEqual({ kind: 'conflict' });
  });

  it('ίδια απόφαση = ίδιο είδος ΚΑΙ ίδιος στόχος', () => {
    expect(sameLineDecision(AIRFLOW, { kind: 'attribute', attributeId: 'airflow_m' })).toBe(true);
    expect(sameLineDecision(AIRFLOW, { kind: 'attribute', attributeId: 'airflow_h' })).toBe(false);
    expect(sameLineDecision(PRICE, { kind: 'price', unitCode: 'm' })).toBe(false);
    expect(sameLineDecision({ kind: 'ignore' }, { kind: 'ignore' })).toBe(true);
  });
});

describe('μάθηση', () => {
  it('🔴 η διόρθωση ΔΕΝ σβήνει την παλιά απόφαση: προστίθεται δίπλα της (Akeneo)', () => {
    const corrected = learnedDecisions(learnedDecisions([], AIRFLOW, LEARN), { kind: 'ignore' }, LEARN);
    expect(corrected.map((entry) => entry.decision.kind).sort()).toEqual(['attribute', 'ignore']);
  });

  it('φραγμένο ιστορικό: φεύγει η λιγότερο στηριγμένη απόφαση', () => {
    let decisions = learnedDecisions(learnedDecisions([], AIRFLOW, LEARN), AIRFLOW, LEARN);
    for (let index = 0; index < IMPORT_LABEL_MEMORY_MAX_DECISIONS + 2; index += 1) {
      decisions = learnedDecisions(decisions, { kind: 'attribute', attributeId: `other_${index}` }, LEARN);
    }
    expect(decisions).toHaveLength(IMPORT_LABEL_MEMORY_MAX_DECISIONS);
    expect(decisions[0]).toMatchObject({ decision: AIRFLOW, count: 2 });
  });

  it('μαθαίνονται μόνο οι αποφάσεις του πίνακα με ταυτότητα που έχει κείμενο', () => {
    const base: ImportLineOverride[] = [];
    const withId = withLineOverride(base, { page: 85, table: 't0', line: 3 }, AIRFLOW, STAMP, { identity: identity('παρ.αερα m', 'm3_h') });
    const blank = withLineOverride(withId, { page: 85, table: 't0', line: 4 }, AIRFLOW, STAMP, { identity: identity('', 'm3_h') });
    const bare = withLineOverride(blank, { page: 85, table: 't0', line: 5 }, AIRFLOW, STAMP);
    const elsewhere = withLineOverride(bare, { page: 86, table: 't0', line: 3 }, AIRFLOW, STAMP, { identity: identity('x') });
    expect(learnableOverrides(elsewhere, 85, 't0').map((override) => override.line)).toEqual([3]);
    expect(isMemorable(identity(''))).toBe(false);
  });
});

describe('κλειδί', () => {
  it('🔴 ίδια ετικέτα σε άλλη μονάδα είναι ΑΛΛΗ γραμμή (W ≠ Btu/h)', () => {
    expect(memoryKeyOf(SCOPE, identity('ψυκτ.ισχυς h', 'W'))).not.toBe(memoryKeyOf(SCOPE, identity('ψυκτ.ισχυς h', 'btu_h')));
  });

  it('🔴 ο διαχωριστής στο κείμενο δεν προκαλεί σύγκρουση κλειδιών («a|W» χωρίς μονάδα ≠ «a» σε W)', () => {
    expect(labelMemoryKey('c', 'f', { label: 'a|W', unitCode: null })).not.toBe(labelMemoryKey('c', 'f', { label: 'a', unitCode: 'W' }));
  });

  it('η εμφάνιση (`printed`) δεν μετρά στην ταυτότητα· ο προμηθευτής και η οικογένεια μετρούν', () => {
    expect(memoryKeyOf(SCOPE, { label: 'x', unitCode: null, printed: 'X' })).toBe(memoryKeyOf(SCOPE, { label: 'x', unitCode: null, printed: 'x ' }));
    expect(memoryKeyOf({ ...SCOPE, supplierContactId: 'cont_other' }, identity('x'))).not.toBe(memoryKeyOf(SCOPE, identity('x')));
  });

  it('το αντίστροφο του κλειδιού πίνακα: σελίδα + πίνακας· η πρόταση τιμών δεν είναι πίνακας ιδιοτήτων', () => {
    expect(pageTableAddressOf(pageTableGroupKey(85, 't0'))).toEqual({ page: 85, table: 't0' });
    expect(pageTableAddressOf(pageTableGroupKey(85, 'a:b'))).toEqual({ page: 85, table: 'a:b' });
    expect(pageTableAddressOf(priceGroupKeyOf(pageTableGroupKey(85, 't0')))).toBeNull();
    expect(pageTableAddressOf('model:X')).toBeNull();
  });
});

describe('εφαρμογή', () => {
  const air = identity('παρ.αερα m', 'm3_h');
  const priceLine = identity('τιμη €');

  it('εφαρμόζεται ορατά: απόφαση με προέλευση μνήμης, ταυτότητα και σφραγίδα', () => {
    const found = memoryOverridesFor(table([[3, air]]), [], applicationOf(bookOf([[air, [AIRFLOW]]])));
    expect(found).toEqual([{ page: 85, table: 't0', line: 3, decision: AIRFLOW, ...STAMP, identity: air, origin: { kind: 'memory', memoryId: 'cilm_0', count: 1, sourceBatchId: 'cibat_1' } }]);
  });

  it('🔴 τιμή χωρίς τιμοκατάλογο ⇒ όχι εφαρμογή', () => {
    expect(memoryOverridesFor(table([[9, priceLine]]), [], applicationOf(bookOf([[priceLine, [PRICE]]]), { pricesEnabled: false }))).toEqual([]);
  });

  it('🔴 δύο γραμμές τιμής από μνήμη, ή τιμή όταν ο πίνακας έχει ήδη ⇒ καμία τιμή από μνήμη (οι υπόλοιπες μένουν)', () => {
    const other = identity('τιμη λιανικης €');
    const book = bookOf([[priceLine, [PRICE]], [other, [PRICE]], [air, [AIRFLOW]]]);
    const twice = memoryOverridesFor(table([[9, priceLine], [10, other], [3, air]]), [], applicationOf(book));
    expect(twice.map((override) => override.decision.kind)).toEqual(['attribute']);
    const taken: ImportLineOverride = { page: 85, table: 't0', line: 11, decision: PRICE, ...STAMP };
    expect(memoryOverridesFor(table([[9, priceLine]]), [taken], applicationOf(book))).toEqual([]);
  });

  it('απόφαση σε άλλον πίνακα ή σελίδα δεν μπλοκάρει τη γραμμή', () => {
    const elsewhere: ImportLineOverride = { page: 86, table: 't0', line: 3, decision: { kind: 'ignore' }, ...STAMP };
    expect(memoryOverridesFor(table([[3, air]]), [elsewhere], applicationOf(bookOf([[air, [AIRFLOW]]])))).toHaveLength(1);
  });

  it('η ανθρώπινη απόφαση πάνω σε απόφαση μνήμης την αντικαθιστά ολόκληρη (χωρίς προέλευση)', () => {
    const [memory] = memoryOverridesFor(table([[3, air]]), [], applicationOf(bookOf([[air, [AIRFLOW]]])));
    const [human] = withLineOverride([memory], memory, { kind: 'ignore' }, STAMP);
    expect(human.origin).toBeUndefined();
    expect(withLineOverride([memory], memory, null, STAMP)).toEqual([]);
  });
});
