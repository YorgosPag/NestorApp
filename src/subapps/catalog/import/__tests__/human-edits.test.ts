/**
 * Άγκυρες του καταλόγου ανθρώπινων διορθώσεων (ADR-923 §5.5.2 Β6). Η πηγή ξαναχτίζεται· η διόρθωση **επιβιώνει**, και όταν η πηγή
 * αλλάξει κάτω της **δεν** την καλύπτει σιωπηλά.
 */

import type { ExtractedCell, ExtractedGroup, ImportTarget } from '../../types/catalog-import';
import { applyHumanEdits, fieldSourcesOf, missingEditTargets, recordEdits, recordModelCodeEdit, sharedRowKey } from '../human-edits';
import { importTargetKey } from '../proposal-values';

const STAMP = { by: 'user_1', at: '2026-11-09T10:00:00.000Z' };
/** Ο κωδικός SKU της στήλης: το κελί που ο PDF τύπωσε διπλό. */
const CODE: ImportTarget = { kind: 'skuIdentifier' };
const CODE_KEY = importTargetKey(CODE);

const cell = (text: string | null): ExtractedCell => ({ target: CODE, text, confidence: 0.9, anchor: null, unitCode: null, flags: [] });

/** Η σελίδα 87: η 4η στήλη τυπώνει τον κωδικό της 3ης (λάθος του PDF). */
const reading = (fourth: string): ExtractedGroup => ({
  groupKey: 'p87:t0',
  modelCode: null,
  sharedCells: [],
  pages: [87],
  rows: [
    { rowKey: 'c3', cells: [cell('MFP-68K1M-Q1AA1')] },
    { rowKey: 'c4', cells: [cell(fourth)] },
  ],
});

const textOf = (group: ExtractedGroup, rowKey: string): string | null => group.rows.find((row) => row.rowKey === rowKey)?.cells[0]?.text ?? null;

describe('human-edits — §5.5.2 Β6', () => {
  const pdf = reading('MFP-68K1M-Q1AA1');
  const edits = recordEdits([], [{ rowKey: 'c4', targetKey: CODE_KEY, text: 'MFP-85K1M-Q1AA1' }], pdf, STAMP);

  it('η διόρθωση θυμάται τι έλεγε η πηγή και εφαρμόζεται με βεβαιότητα 1', () => {
    expect(edits).toEqual([{ rowKey: 'c4', targetKey: CODE_KEY, text: 'MFP-85K1M-Q1AA1', sourceText: 'MFP-68K1M-Q1AA1', ...STAMP }]);
    const applied = applyHumanEdits(pdf, edits, null);
    expect(textOf(applied, 'c4')).toBe('MFP-85K1M-Q1AA1');
    expect(applied.rows[1].cells[0].confidence).toBe(1);
    expect(textOf(applied, 'c3')).toBe('MFP-68K1M-Q1AA1');
  });

  it('το ξαναχτίσιμο (ίδια ανάγνωση) δεν σβήνει τη διόρθωση — η ρίζα του σφάλματος της αναίρεσης', () => {
    expect(textOf(applyHumanEdits(reading('MFP-68K1M-Q1AA1'), edits, null), 'c4')).toBe('MFP-85K1M-Q1AA1');
  });

  it('η πηγή άλλαξε κάτω από τη διόρθωση ⇒ καμία σιωπηλή εφαρμογή, εύρημα editSourceChanged', () => {
    const applied = applyHumanEdits(reading('MFP-102K1M-Q1AA1'), edits, null);
    expect(textOf(applied, 'c4')).toBe('MFP-102K1M-Q1AA1');
    expect(applied.rows[1].cells[0].flags).toEqual([
      { code: 'editSourceChanged', path: CODE_KEY, params: { edited: 'MFP-85K1M-Q1AA1', was: 'MFP-68K1M-Q1AA1', now: 'MFP-102K1M-Q1AA1' } },
    ]);
  });

  it('ιδεμπότητο: ίδια διεύθυνση ⇒ αντικατάσταση, όχι δεύτερη εγγραφή', () => {
    const again = recordEdits(edits, [{ rowKey: 'c4', targetKey: CODE_KEY, text: 'MFP-85K1M-Q1AA2' }], pdf, STAMP);
    expect(again).toHaveLength(1);
    expect(again[0].text).toBe('MFP-85K1M-Q1AA2');
  });

  it('επαναφορά και κείμενο ίσο με της πηγής αφαιρούν τη διόρθωση', () => {
    expect(recordEdits(edits, [{ rowKey: 'c4', targetKey: CODE_KEY, text: '', revert: true }], pdf, STAMP)).toEqual([]);
    expect(recordEdits(edits, [{ rowKey: 'c4', targetKey: CODE_KEY, text: 'MFP-68K1M-Q1AA1' }], pdf, STAMP)).toEqual([]);
  });

  it('διεύθυνση που η πηγή δεν έχει αγνοείται', () => {
    expect(recordEdits([], [{ rowKey: 'c9', targetKey: CODE_KEY, text: 'X' }], pdf, STAMP)).toEqual([]);
  });

  it('κοινά κελιά μοντέλου: δική τους γραμμή', () => {
    const shared: ExtractedGroup = { ...pdf, sharedCells: [cell('230V')] };
    const own = recordEdits([], [{ rowKey: sharedRowKey(shared.groupKey), targetKey: CODE_KEY, text: '230 V' }], shared, STAMP);
    expect(applyHumanEdits(shared, own, null).sharedCells[0].text).toBe('230 V');
  });

  it('κωδικός μοντέλου: επιβιώνει το ξαναχτίσιμο, null = καμία αλλαγή, κενό = αφαίρεση', () => {
    const code = recordModelCodeEdit(null, ' mfp_k1m_q1aa1 ', pdf, STAMP);
    expect(code).toEqual({ modelCode: 'mfp_k1m_q1aa1', sourceModelCode: null, ...STAMP });
    expect(applyHumanEdits(reading('MFP-68K1M-Q1AA1'), [], code).modelCode).toBe('mfp_k1m_q1aa1');
    expect(recordModelCodeEdit(code, null, pdf, STAMP)).toBe(code);
    expect(recordModelCodeEdit(code, '', pdf, STAMP)).toBeNull();
  });

  it('χωρίς διορθώσεις επιστρέφει την ίδια ομάδα (καμία αντιγραφή)', () => {
    expect(applyHumanEdits(pdf, [], null)).toBe(pdf);
  });
});

/** Η Aries τυπώνει δύο γραμμές «ΚΩΔΙΚΟΣ» στην ίδια στήλη: δύο κελιά, **μία** διεύθυνση (§5.5.2 Β8 «Κράτα …»). */
describe('human-edits — διεύθυνση με δύο κελιά', () => {
  const FIRST_ANCHOR = { kind: 'cell', row: 5, column: 2 } as const;
  const twin = (first: string, second: string): ExtractedGroup => ({
    groupKey: 'p87:t0',
    modelCode: null,
    sharedCells: [],
    pages: [87],
    rows: [{ rowKey: 'c1', cells: [{ ...cell(first), anchor: FIRST_ANCHOR }, cell(second)] }],
  });
  const pdf = twin('MFP-34K1M-Q1AA1', '099-03-001');
  const keepOf = (text: string) => recordEdits([], [{ rowKey: 'c1', targetKey: CODE_KEY, text }], pdf, STAMP);
  const keep = keepOf('099-03-001');

  it('η διόρθωση θυμάται ΟΛΑ τα κείμενα της πηγής, και ένα ενωμένο για τον άνθρωπο', () => {
    expect(keep).toEqual([
      { rowKey: 'c1', targetKey: CODE_KEY, text: '099-03-001', sourceText: 'MFP-34K1M-Q1AA1 · 099-03-001', sourceTexts: ['MFP-34K1M-Q1AA1', '099-03-001'], ...STAMP },
    ]);
  });

  it('«Κράτα» ⇒ ένα κελί, αυτό που την τύπωσε (με τη δική του άγκυρα), χωρίς εύρημα — η σειρά της πηγής δεν αποφασίζει', () => {
    expect(applyHumanEdits(pdf, keep, null).rows[0].cells).toEqual([{ ...cell('099-03-001'), confidence: 1 }]);
    const first = applyHumanEdits(pdf, keepOf('MFP-34K1M-Q1AA1'), null).rows[0].cells;
    expect(first).toEqual([{ ...cell('MFP-34K1M-Q1AA1'), anchor: FIRST_ANCHOR, confidence: 1 }]);
  });

  it('τιμή που δεν τύπωσε κανένα κελί ⇒ ένα κελί με την τιμή του ανθρώπου', () => {
    expect(applyHumanEdits(pdf, keepOf('MFP-34K1M-Q1AA2'), null).rows[0].cells.map((each) => each.text)).toEqual(['MFP-34K1M-Q1AA2']);
  });

  it('η επιλογή μιας από τις δύο τιμές ΔΕΝ είναι «ίδιο με την πηγή»: η διόρθωση μένει', () => {
    expect(keep).toHaveLength(1);
  });

  it('άλλαξε ΟΠΟΙΟΔΗΠΟΤΕ κελί της πηγής ⇒ όλα μένουν, με editSourceChanged', () => {
    const cells = applyHumanEdits(twin('MFP-34K1M-Q1AA1', '099-03-002'), keep, null).rows[0].cells;
    expect(cells.map((each) => each.text)).toEqual(['MFP-34K1M-Q1AA1', '099-03-002']);
    const params = { edited: '099-03-001', was: 'MFP-34K1M-Q1AA1 · 099-03-001', now: 'MFP-34K1M-Q1AA1 · 099-03-002' };
    for (const each of cells) expect(each.flags).toEqual([{ code: 'editSourceChanged', path: CODE_KEY, params }]);
  });

  it('η πηγή έγινε ένα κελί κάτω από διόρθωση δύο κελιών ⇒ εύρημα, όχι σιωπηλή εφαρμογή', () => {
    const single: ExtractedGroup = { ...pdf, rows: [{ rowKey: 'c1', cells: [cell('099-03-001')] }] };
    expect(applyHumanEdits(single, keep, null).rows[0].cells[0].flags[0]?.code).toBe('editSourceChanged');
  });
});

/**
 * Σελ. 85 (live 2026-11-14): οι Φάσεις «1Ph» τυπώνονται σε ΚΑΘΕ στήλη· η πρόταση τις δείχνει μία φορά, στη γραμμή του μοντέλου. Η
 * διόρθωση εκεί **πετιόταν σιωπηλά** (PUT 200, αναθεώρηση +1, τίποτα γραμμένο), γιατί ο κατάλογος έβλεπε στη γραμμή μοντέλου μόνο τα
 * `sharedCells` της πηγής. Τώρα ρωτά τον **ίδιο** κανόνα με τον σχεδιαστή (`modelLevel`).
 */
describe('human-edits — κοινό πεδίο τυπωμένο ανά στήλη (γραμμή μοντέλου)', () => {
  const PHASES: ImportTarget = { kind: 'attribute', attributeId: 'cattr_phases', channel: '*', locale: '*' };
  const PHASES_KEY = importTargetKey(PHASES);
  const phases = (text: string): ExtractedCell => ({ target: PHASES, text, confidence: 0.9, anchor: null, unitCode: null, flags: [] });
  const modelLevel = (each: ExtractedCell): boolean => importTargetKey(each.target) === PHASES_KEY;
  const page85 = (second = '1Ph'): ExtractedGroup => ({
    groupKey: 'page:85:t0',
    modelCode: null,
    sharedCells: [],
    pages: [85],
    rows: [
      { rowKey: 'v0', cells: [cell('099-01-001'), phases('1Ph')] },
      { rowKey: 'v1', cells: [cell('099-01-002'), phases(second)] },
    ],
  });
  const model = sharedRowKey('page:85:t0');
  const input = { rowKey: model, targetKey: PHASES_KEY, text: '1' };
  const phaseCells = (group: ExtractedGroup): ExtractedCell[] =>
    group.rows.flatMap((row) => row.cells).filter((each) => importTargetKey(each.target) === PHASES_KEY);

  it('η διόρθωση στη γραμμή μοντέλου ΚΑΤΑΓΡΑΦΕΤΑΙ, με όλα τα κείμενα της πηγής', () => {
    const edits = recordEdits([], [input], page85(), STAMP, modelLevel);
    expect(edits).toEqual([{ ...input, sourceText: '1Ph · 1Ph', sourceTexts: ['1Ph', '1Ph'], ...STAMP }]);
  });

  it('και ΕΦΑΡΜΟΖΕΤΑΙ: ένα κελί με την τιμή του ανθρώπου· τα κελιά SKU μένουν ανέγγιχτα', () => {
    const applied = applyHumanEdits(page85(), recordEdits([], [input], page85(), STAMP, modelLevel), null, modelLevel);
    expect(phaseCells(applied).map((each) => [each.text, each.confidence])).toEqual([['1', 1]]);
    expect(applied.rows.map((row) => row.cells[0].text)).toEqual(['099-01-001', '099-01-002']);
  });

  it('στήλη που άλλαξε κάτω από τη διόρθωση ⇒ καμία σιωπηλή εφαρμογή, εύρημα σε κάθε κελί', () => {
    const edits = recordEdits([], [input], page85(), STAMP, modelLevel);
    const applied = applyHumanEdits(page85('3Ph'), edits, null, modelLevel);
    expect(phaseCells(applied).map((each) => [each.text, each.flags[0]?.code])).toEqual([['1Ph', 'editSourceChanged'], ['3Ph', 'editSourceChanged']]);
  });

  it('χωρίς τον κανόνα (το σφάλμα) η διεύθυνση είναι άγνωστη — και η πόρτα το λέει, δεν το καταπίνει', () => {
    expect(recordEdits([], [input], page85(), STAMP)).toEqual([]);
    expect(missingEditTargets([input], page85())).toEqual([input]);
    expect(missingEditTargets([input], page85(), modelLevel)).toEqual([]);
  });

  it('η επαναφορά δεν αρνείται ποτέ', () => {
    expect(missingEditTargets([{ ...input, rowKey: 'gone', text: '', revert: true }], page85(), modelLevel)).toEqual([]);
  });

  it('η μνήμη τιμών βλέπει ΜΙΑ πηγή στη γραμμή μοντέλου, με τα δύο κελιά', () => {
    const sources = fieldSourcesOf(page85(), modelLevel).filter((source) => source.targetKey === PHASES_KEY);
    expect(sources.map((source) => [source.rowKey, source.cells.length])).toEqual([[model, 2]]);
    expect(fieldSourcesOf(page85()).filter((source) => source.targetKey === PHASES_KEY).map((source) => source.rowKey)).toEqual(['v0', 'v1']);
  });
});
