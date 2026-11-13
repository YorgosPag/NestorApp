/**
 * Η **μνήμη τιμών ανά προμηθευτή** (ADR-923 §5.5.2 Β10) — η καθαρή μηχανή, χωρίς Firestore: τι μαθαίνει, τι εφαρμόζει, πότε σωπαίνει.
 * Το σενάριο είναι το «1Ph» της σελ. 85 ARIES: οι φάσεις δεν διαβάζονται, ο άνθρωπος γράφει «1» μία φορά, η μνήμη το ξαναβρίσκει.
 */

import { MFP_ATTRIBUTE_MAP } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import type { ExtractedCell, ExtractedGroup, ImportValueEdit } from '../../types/catalog-import';
import { applyHumanEdits, recordEdits } from '../human-edits';
import { importTargetKey, importTextContextOf } from '../proposal-values';
import { learnableValues, learnedValueEntry, memoryEditCount, valueMemoryEditsFor, valueMemoryHintsFor, valueMemoryKeysOf } from '../value-memory';
import { suggestedOptionIndex } from '../supplier-memory-core';

const weight = [...MFP_ATTRIBUTE_MAP].map(([id, attribute]) => ({ ...attribute, id })).find((attribute) => attribute.code === 'weight');
if (!weight) throw new Error('το fixture δεν έχει `weight`');
const phases = { ...weight, id: 'cattr_phases', code: 'phases', type: 'number' as const, config: { min: 1, max: 3, decimals: 0, negativeAllowed: false } };
const attributes = new Map([[weight.id, weight], [phases.id, phases]]);
const context = importTextContextOf(PLATFORM_MEASUREMENT_REGISTRY);
const schema = { attributes, context };
const SUPPLIER = 'cont_aries';
const STAMP = { by: 'usr_1', at: '2026-11-13T10:00:00.000Z' };

const cellOf = (attributeId: string, text: string | null): ExtractedCell => ({
  target: { kind: 'attribute', attributeId, channel: '*', locale: '*' },
  text,
  confidence: 0.9,
  anchor: null,
  unitCode: null,
  flags: [],
});

const groupOf = (...rows: (readonly ExtractedCell[])[]): ExtractedGroup => ({
  groupKey: 'p85:t0',
  modelCode: 'MFP',
  sharedCells: [],
  rows: rows.map((cells, index) => ({ rowKey: `v${index}`, cells })),
  pages: [85],
});

const PHASES_KEY = importTargetKey(cellOf(phases.id, null).target);
const accepted = (group: ExtractedGroup) => group.rows.map((row) => ({ rowKey: row.rowKey, fields: row.cells.map((cell) => ({ target: cell.target, decision: 'accept' as const })) }));
const humanEdit = (rowKey: string, text: string, sourceText: string): ImportValueEdit => ({ rowKey, targetKey: PHASES_KEY, text, sourceText, ...STAMP });

/** Η μνήμη μετά από εγκρίσεις: κάθε έγκριση περνά από τον ίδιο κανόνα μάθησης με τον διακομιστή. */
function bookAfter(...approvals: { readonly group: ExtractedGroup; readonly edits: readonly ImportValueEdit[] }[]) {
  let entries = new Map<string, ReturnType<typeof learnedValueEntry>>();
  approvals.forEach(({ group, edits }, index) => {
    for (const value of learnableValues({ extracted: group, edits, rows: accepted(group) }, SUPPLIER, schema)) {
      entries = new Map(entries).set(value.key, learnedValueEntry(entries.get(value.key) ?? null, SUPPLIER, value, { ...STAMP, batchId: `cibat_${index}` }));
    }
  });
  return new Map([...entries].map(([key, entry]) => [key, { id: `cilm_${key.length}`, decisions: entry.decisions }]));
}

const applicationOf = (book: ReturnType<typeof bookAfter>) => ({ ...schema, supplierContactId: SUPPLIER, book, stamp: STAMP });

describe('§5.5.2 Β10 — μνήμη τιμών: «1Ph» → 1', () => {
  const taught = groupOf([cellOf(phases.id, '1Ph')]);
  const book = bookAfter({ group: taught, edits: [humanEdit('v0', '1', '1Ph')] });

  it('🔑 μαθαίνει την αδιάβαστη πηγή, και την ξαναβρίσκει σε νέα ανάγνωση με διόρθωση ΜΕ προέλευση', () => {
    const fresh = groupOf([cellOf(phases.id, '1Ph')], [cellOf(phases.id, '1PH')]);
    const edits = valueMemoryEditsFor(fresh, undefined, applicationOf(book));
    expect(edits).toHaveLength(2);
    expect(edits.every((edit) => edit.text === '1' && edit.origin?.kind === 'memory' && edit.origin.count === 1)).toBe(true);
    // Περνά από τον ΕΝΑ δρόμο των διορθώσεων: το κελί γράφει πια «1».
    expect(applyHumanEdits(fresh, edits, null).rows.map((row) => row.cells[0].text)).toEqual(['1', '1']);
  });

  it('🔑 ΔΕΝ μαθαίνει διόρθωση πάνω σε τιμή που διαβάζεται («2» → «3» είναι λάθος ενός PDF, όχι κανόνας)', () => {
    const readable = groupOf([cellOf(phases.id, '2')]);
    expect(learnableValues({ extracted: readable, edits: [humanEdit('v0', '3', '2')], rows: accepted(readable) }, SUPPLIER, schema)).toEqual([]);
  });

  it('δεν μαθαίνει απορριμμένο πεδίο, ούτε απάντηση που δεν διαβάζεται', () => {
    const rejected = [{ rowKey: 'v0', fields: [{ target: cellOf(phases.id, null).target, decision: 'reject' as const }] }];
    expect(learnableValues({ extracted: taught, edits: [humanEdit('v0', '1', '1Ph')], rows: rejected }, SUPPLIER, schema)).toEqual([]);
    expect(learnableValues({ extracted: taught, edits: [humanEdit('v0', 'μία', '1Ph')], rows: accepted(taught) }, SUPPLIER, schema)).toEqual([]);
  });

  it('🔑 ο άνθρωπος πρώτος: πεδίο με διόρθωση δεν το αγγίζει η μνήμη· η εφαρμογή είναι ιδεμπότητη', () => {
    const fresh = groupOf([cellOf(phases.id, '1Ph')]);
    expect(valueMemoryEditsFor(fresh, [humanEdit('v0', '3', '1Ph')], applicationOf(book))).toEqual([]);
    const first = valueMemoryEditsFor(fresh, undefined, applicationOf(book));
    expect(valueMemoryEditsFor(fresh, first, applicationOf(book))).toEqual([]);
  });

  it('🔑 σύγκρουση (1 και 3) ⇒ καμία εφαρμογή, αλλά υπόδειξη με τις δύο επιλογές', () => {
    const conflicted = bookAfter({ group: taught, edits: [humanEdit('v0', '1', '1Ph')] }, { group: taught, edits: [humanEdit('v0', '3', '1Ph')] });
    expect(valueMemoryEditsFor(taught, undefined, applicationOf(conflicted))).toEqual([]);
    const [hint] = valueMemoryHintsFor(taught, undefined, applicationOf(conflicted));
    expect(hint.verdict).toBe('conflict');
    expect(hint.options.map((option) => option.text).sort()).toEqual(['1', '3']);
    // Ισοπαλία (1 έγκριση η καθεμία) ⇒ καμία προτεινόμενη.
    expect(hint.options.filter((option) => option.suggested)).toEqual([]);
  });

  it('🔑 Akeneo SDM: η ΣΥΧΝΟΤΕΡΗ ξεχωρίζει ως προτεινόμενη — αλλά ΔΕΝ εφαρμόζεται· η μη εφαρμόσιμη δεν προτείνεται ποτέ', () => {
    const one = { group: taught, edits: [humanEdit('v0', '1', '1Ph')] };
    const majority = bookAfter(one, one, { group: taught, edits: [humanEdit('v0', '3', '1Ph')] });
    expect(valueMemoryEditsFor(taught, undefined, applicationOf(majority))).toEqual([]);
    const [hint] = valueMemoryHintsFor(taught, undefined, applicationOf(majority));
    expect(hint.options.filter((option) => option.suggested).map((option) => option.text)).toEqual(['1']);
    // Η συχνότερη δεν διαβάζεται πια (η ιδιότητα έγινε μέτρηση) ⇒ καμία προτεινόμενη, ούτε η λιγότερο στηριγμένη που επίσης δεν διαβάζεται.
    const narrowed = { attributes: new Map([[phases.id, { ...weight, id: phases.id, code: 'phases' }]]), context };
    const [stale] = valueMemoryHintsFor(taught, undefined, { ...applicationOf(majority), ...narrowed });
    expect(stale.options.filter((option) => option.suggested)).toEqual([]);
  });

  it('suggestedOptionIndex: η μόνη εφαρμόσιμη με τις περισσότερες εγκρίσεις· ισοπαλία ή καμία εφαρμόσιμη ⇒ null', () => {
    expect(suggestedOptionIndex([{ count: 1, usable: true }, { count: 3, usable: true }])).toBe(1);
    expect(suggestedOptionIndex([{ count: 5, usable: false }, { count: 2, usable: true }])).toBe(1);
    expect(suggestedOptionIndex([{ count: 2, usable: true }, { count: 2, usable: true }])).toBeNull();
    expect(suggestedOptionIndex([{ count: 2, usable: false }])).toBeNull();
    expect(suggestedOptionIndex([])).toBeNull();
  });

  it('🔑 θυμάται κείμενο, όχι τιμή: η ιδιότητα έγινε μέτρηση, το «1» δεν διαβάζεται ΠΙΑ ⇒ καμία εφαρμογή — «δεν ισχύει πλέον»', () => {
    // Γυμνός αριθμός σε μέτρηση χωρίς μονάδα στήλης = `measurementUnitMissing`: η μνήμη δεν παρακάμπτει τον κωδικοποιητή.
    const narrowed = { attributes: new Map([[phases.id, { ...weight, id: phases.id, code: 'phases' }]]), context };
    const application = { ...applicationOf(book), ...narrowed };
    expect(valueMemoryEditsFor(taught, undefined, application)).toEqual([]);
    expect(valueMemoryHintsFor(taught, undefined, application)[0].options).toEqual([expect.objectContaining({ text: '1', usable: false })]);
  });

  it('η εγκεκριμένη εφαρμογή μνήμης μετρά ως έγκριση («N εγκρίσεις»)', () => {
    const applied = valueMemoryEditsFor(taught, undefined, applicationOf(book));
    const twice = bookAfter({ group: taught, edits: [humanEdit('v0', '1', '1Ph')] }, { group: taught, edits: applied });
    expect([...twice.values()][0].decisions).toEqual([expect.objectContaining({ decision: { kind: 'value', text: '1' }, count: 2 })]);
  });

  it('κλειδί ανά προμηθευτή: άλλος προμηθευτής δεν βλέπει τη μνήμη· κείμενο ιδιότητας δεν κρίνεται ποτέ', () => {
    expect(valueMemoryEditsFor(taught, undefined, { ...applicationOf(book), supplierContactId: 'cont_other' })).toEqual([]);
    expect(valueMemoryKeysOf(groupOf([cellOf(weight.id, '1Ph')]), undefined, SUPPLIER, { attributes: new Map([[weight.id, { ...weight, type: 'text' as const, config: { maxLength: null, pattern: null } }]]), context })).toEqual([]);
  });

  it('η αναίρεση της εφαρμογής μνήμης την αφαιρεί, και ο μετρητής «από μνήμη» τη βλέπει', () => {
    const applied = valueMemoryEditsFor(taught, undefined, applicationOf(book));
    expect(memoryEditCount([{ status: 'pending', purpose: 'attributes', edits: applied }])).toBe(1);
    const reverted = recordEdits(applied, [{ rowKey: 'v0', targetKey: PHASES_KEY, text: '', revert: true }], taught, STAMP);
    expect(reverted).toEqual([]);
  });
});
