/**
 * ADR-923 §5.10.4 Β2 — ένωση ζωντανών παραθύρων με **μέτωπο**: ποτέ λάθος σειρά, ποτέ «πήδημα» στη σελίδα 2.
 */
import { mergeLiveWindows } from '../merge-live-windows';

const byNumber = (a: number, b: number) => a - b;

describe('mergeLiveWindows', () => {
  it('και τα δύο πλήρη ⇒ όλα, ταξινομημένα, χωρίς «περισσότερα»', () => {
    expect(mergeLiveWindows([{ items: [1, 4], complete: true }, { items: [2, 3], complete: true }], byNumber))
      .toEqual({ items: [1, 2, 3, 4], hasMore: false, heldBack: 0 });
  });

  it('🔴 γεμάτο παράθυρο = μέτωπο: τα στοιχεία του άλλου ΜΕΤΑ από αυτό κρατιούνται πίσω', () => {
    // μοντέλα: όριο 3, γύρισαν 3 (μπορεί να έχει κι άλλα: 7, 8 …) · SKU: πλήρη
    const merged = mergeLiveWindows([{ items: [1, 2, 6], complete: false }, { items: [3, 9, 10], complete: true }], byNumber);
    expect(merged.items).toEqual([1, 2, 3, 6]);
    expect(merged).toMatchObject({ hasMore: true, heldBack: 2 });
  });

  it('η «σελίδα 2» ΔΕΝ βάζει στοιχεία ανάμεσα σε ήδη ορατά (η λίστα δεν πηδά)', () => {
    const page1 = mergeLiveWindows([{ items: [1, 2, 6], complete: false }, { items: [3, 9, 10], complete: true }], byNumber).items;
    const page2 = mergeLiveWindows([{ items: [1, 2, 6, 7, 8], complete: true }, { items: [3, 9, 10], complete: true }], byNumber).items;
    expect(page2.slice(0, page1.length)).toEqual(page1);
  });

  it('🔴 μέτωπο = το ΜΕΓΙΣΤΟ κατά τον συγκριτή, όχι το τελευταίο που ήρθε (άλλη σειρά ισοπαλίας στη βάση)', () => {
    const merged = mergeLiveWindows([{ items: [6, 2], complete: false }, { items: [3, 9], complete: true }], byNumber);
    expect(merged.items).toEqual([2, 3, 6]);
  });

  it('το αυστηρότερο από δύο μέτωπα νικά', () => {
    const merged = mergeLiveWindows([{ items: [1, 5], complete: false }, { items: [2, 3], complete: false }], byNumber);
    expect(merged.items).toEqual([1, 2, 3]);
  });

  it('ισοπαλία κλειδιού: σπάει με τον συγκριτή (σταθερή σειρά ανάμεσα σε στιγμιότυπα)', () => {
    type Row = { key: string; id: string };
    const cmp = (a: Row, b: Row) => a.key.localeCompare(b.key) || a.id.localeCompare(b.id);
    const merged = mergeLiveWindows<Row>([{ items: [{ key: 'a', id: 'm2' }], complete: true }, { items: [{ key: 'a', id: 'm1' }], complete: true }], cmp);
    expect(merged.items.map((row) => row.id)).toEqual(['m1', 'm2']);
  });
});
