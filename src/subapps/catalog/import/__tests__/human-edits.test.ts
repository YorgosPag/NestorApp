/**
 * Άγκυρες του καταλόγου ανθρώπινων διορθώσεων (ADR-923 §5.5.2 Β6). Η πηγή ξαναχτίζεται· η διόρθωση **επιβιώνει**, και όταν η πηγή
 * αλλάξει κάτω της **δεν** την καλύπτει σιωπηλά.
 */

import type { ExtractedCell, ExtractedGroup, ImportTarget } from '../../types/catalog-import';
import { applyHumanEdits, recordEdits, recordModelCodeEdit, sharedRowKey } from '../human-edits';
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
