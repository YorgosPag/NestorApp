/**
 * Οι αποφάσεις γραμμής πάνω στην αντιστοίχιση του μοντέλου (ADR-923 §5.5.2 Β3 Γ1–Γ2). Καθαρό: καμία κλήση, καμία ανάγνωση.
 */

import type { ImportLineOverride, ImportPageUnmappedLine } from '../../types/catalog-import';
import { applyLineOverrides, lineDecisionOf, lineKeyOf, pendingUnmappedLines, priceLineOf, tableOverridesOf, withLineOverride } from '../page-line-overrides';
import type { RawTableMapping } from '../page-table-mapping';

const STAMP = { by: 'usr_1', at: '2026-11-08T10:00:00.000Z' } as const;
const ADDRESS = { page: 87, table: 't0', line: 9 } as const;

const answer: RawTableMapping = {
  table: 't0',
  role: 'variants',
  variantsIn: 'columns',
  imageCheck: [],
  lines: [
    { line: 3, attribute: 'airflow_h', confidence: 0.9 },
    { line: 9, attribute: 'weight', confidence: 0.4 },
    { line: 12, attribute: 'removed_code', confidence: 0.8 },
  ],
};

const codeById = new Map([['cattr_airflow_m', 'airflow_m'], ['cattr_airflow_h', 'airflow_h'], ['cattr_weight', 'weight']]);
const known = new Set(codeById.values());

const override = (line: number, decision: ImportLineOverride['decision']): ImportLineOverride => ({ page: 87, table: 't0', line, decision, ...STAMP });

describe('§5.5.2 Β3 — κλειδί και κατάσταση της απόφασης', () => {
  it('η ίδια θέση είναι το ίδιο κλειδί· άλλη σελίδα, πίνακας ή γραμμή είναι άλλο', () => {
    expect(lineKeyOf(ADDRESS)).toBe(lineKeyOf({ ...ADDRESS }));
    expect(new Set([lineKeyOf(ADDRESS), lineKeyOf({ ...ADDRESS, page: 88 }), lineKeyOf({ ...ADDRESS, table: 't1' }), lineKeyOf({ ...ADDRESS, line: 10 })]).size).toBe(4);
  });

  it('ιδεμπότητη: η ίδια απόφαση δύο φορές αφήνει μία εγγραφή', () => {
    const once = withLineOverride([], ADDRESS, { kind: 'ignore' }, STAMP);
    const twice = withLineOverride(once, ADDRESS, { kind: 'ignore' }, STAMP);
    expect(twice).toEqual(once);
    expect(lineDecisionOf(twice, ADDRESS)).toEqual({ kind: 'ignore' });
  });

  it('νέα απόφαση αντικαθιστά την παλιά· `null` = αναίρεση', () => {
    const ignored = withLineOverride([], ADDRESS, { kind: 'ignore' }, STAMP);
    const mapped = withLineOverride(ignored, ADDRESS, { kind: 'attribute', attributeId: 'cattr_airflow_m' }, STAMP);
    expect(mapped).toHaveLength(1);
    expect(lineDecisionOf(mapped, ADDRESS)).toEqual({ kind: 'attribute', attributeId: 'cattr_airflow_m' });
    expect(withLineOverride(mapped, ADDRESS, null, STAMP)).toEqual([]);
  });

  it('οι αποφάσεις ενός πίνακα δεν παίρνουν άλλου πίνακα ή σελίδας', () => {
    const all = [override(9, { kind: 'ignore' }), { ...override(9, { kind: 'ignore' }), table: 't1' }, { ...override(9, { kind: 'ignore' }), page: 88 }];
    expect(tableOverridesOf(all, 87, 't0')).toHaveLength(1);
    expect(tableOverridesOf(undefined, 87, 't0')).toEqual([]);
  });
});

describe('§5.5.2 Β3 — η απόφαση πάνω στην απάντηση του μοντέλου', () => {
  it('🔴 αντιστοίχιση ⇒ η γραμμή δείχνει την ιδιότητα με βεβαιότητα 1 και αντικαθιστά ό,τι είχε πει το μοντέλο', () => {
    const { mapping } = applyLineOverrides(answer, [override(9, { kind: 'attribute', attributeId: 'cattr_airflow_m' })], codeById, known);
    expect(mapping.lines.filter((entry) => entry.line === 9)).toEqual([{ line: 9, attribute: 'airflow_m', confidence: 1 }]);
    expect(mapping.lines.find((entry) => entry.line === 3)).toEqual({ line: 3, attribute: 'airflow_h', confidence: 0.9 });
  });

  it('γραμμή που το μοντέλο δεν ανέφερε προστίθεται', () => {
    const { mapping } = applyLineOverrides(answer, [override(15, { kind: 'attribute', attributeId: 'cattr_airflow_m' })], codeById, known);
    expect(mapping.lines).toContainEqual({ line: 15, attribute: 'airflow_m', confidence: 1 });
    expect(mapping.lines).toHaveLength(answer.lines.length + 1);
  });

  it('η αγνόηση δεν αλλάζει την αντιστοίχιση', () => {
    expect(applyLineOverrides(answer, [override(9, { kind: 'ignore' })], codeById, known).mapping.lines).toEqual(answer.lines);
  });

  it('🔴 ιδιότητα εκτός σχήματος δεν εφαρμόζεται σιωπηλά: δηλώνεται', () => {
    const result = applyLineOverrides(answer, [override(9, { kind: 'attribute', attributeId: 'cattr_ghost' })], codeById, known);
    expect(result.unknownAttributeIds).toEqual(['cattr_ghost']);
    expect(result.mapping.lines).toEqual(answer.lines);
  });

  it('🔴 Μ17: κωδικός της απάντησης που χάθηκε από το σχήμα δηλώνεται, δεν πέφτει σιωπηλά', () => {
    expect(applyLineOverrides(answer, [], codeById, known).staleCodes).toEqual(['removed_code']);
  });
});

describe('§5.5.2 Β3 — εκκρεμείς γραμμές', () => {
  const line = (entry: number): ImportPageUnmappedLine => ({ page: 87, table: 't0', line: entry, label: 'ΠΑΡΟΧΗ ΑΕΡΑ · Μ · m³/h', values: ['280'] });

  it('μόνο η ρητή αγνόηση βγάζει γραμμή από την εκκρεμότητα', () => {
    const lines = [line(9), line(10), line(11)];
    const overrides = [override(9, { kind: 'ignore' }), override(10, { kind: 'attribute', attributeId: 'cattr_airflow_m' })];
    expect(pendingUnmappedLines(lines, overrides).map((entry) => entry.line)).toEqual([10, 11]);
    expect(pendingUnmappedLines(lines, undefined)).toHaveLength(3);
  });
});

describe('§5.5.2 Β4 — η γραμμή τιμής', () => {
  const PRICE = { kind: 'price', unitCode: 'pcs' } as const;

  it('🔴 τιμή ⇒ η γραμμή φεύγει από την αντιστοίχιση ιδιοτήτων, ακόμη κι αν το μοντέλο της είχε δώσει ιδιότητα (ποτέ τιμή ως ιδιότητα, §5.4)', () => {
    const result = applyLineOverrides(answer, [override(9, PRICE)], codeById, known);
    expect(result.mapping.lines.some((entry) => entry.line === 9)).toBe(false);
    expect(result.priceLines).toEqual([{ line: 9, unitCode: 'pcs' }]);
    expect(result.mapping.lines.find((entry) => entry.line === 3)).toEqual({ line: 3, attribute: 'airflow_h', confidence: 0.9 });
  });

  it('η μονάδα της γραμμής τιμής είναι αυτή που δήλωσε ο άνθρωπος', () => {
    expect(applyLineOverrides(answer, [override(15, { kind: 'price', unitCode: 'm' })], codeById, known).priceLines).toEqual([{ line: 15, unitCode: 'm' }]);
  });

  it('χωρίς απόφαση τιμής ⇒ καμία γραμμή τιμής', () => {
    expect(applyLineOverrides(answer, [override(9, { kind: 'ignore' })], codeById, known).priceLines).toEqual([]);
  });

  it('`priceLineOf`: η γραμμή τιμής του πίνακα, ή `null`', () => {
    const priced = override(9, PRICE);
    expect(priceLineOf([override(3, { kind: 'ignore' }), priced])).toBe(priced);
    expect(priceLineOf([override(3, { kind: 'attribute', attributeId: 'cattr_airflow_m' })])).toBeNull();
    expect(priceLineOf([])).toBeNull();
  });
});
