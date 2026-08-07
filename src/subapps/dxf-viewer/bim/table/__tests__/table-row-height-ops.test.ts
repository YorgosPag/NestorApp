/**
 * 🔴 ADR-739 §58 Γ2 — **ΠΟΙΟΣ ΚΑΤΕΧΕΙ ΤΟ ΥΨΟΣ**: οι άγκυρες του «Αυτόματο ύψος γραμμής».
 *
 * Δύο ερωτήσεις, δύο ανεξάρτητες αποτυχίες:
 *  1. **«Υπάρχει τι να επαναφερθεί;»** — αν απαντήσει `every` αντί για `some`, το κουμπί μένει
 *     σβηστό πάνω σε στόχο που έχει σαφώς κλειδωμένη γραμμή.
 *  2. **«Η αφαίρεση σβήνει το πεδίο;»** — αν γράψει `heightMm: undefined` αντί να το διαγράψει,
 *     το κλειδί επιβιώνει στο `'heightMm' in row` και η γραμμή μένει «καρφωμένη σε τίποτα».
 *
 * ⚠️ Η **εγγύηση by-reference** ελέγχεται ρητά: χωρίς αυτήν, κάθε πάτημα σε ήδη αυτόματη γραμμή
 * θα γεννούσε βήμα `Ctrl+Z` που δεν αναιρεί τίποτα ορατό.
 *
 * @see ../table-row-height-ops.ts
 */

import { clearTableRowHeights, hasFixedTableRowHeight } from '../table-row-height-ops';
import type { PersistedTableModel } from '../../../types/table';

/** r0 αυτόματη · r1 καρφωμένη (12mm) · r2 καρφωμένη (20mm). */
function model(): PersistedTableModel {
  return {
    columns: [{ id: 'c0', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' }],
    rows: [
      { id: 'r0', rowClass: 'header' },
      { id: 'r1', rowClass: 'data', heightMm: 12 },
      { id: 'r2', rowClass: 'data', heightMm: 20 },
    ],
    cells: [],
    merges: [],
  };
}

const rowAt = (m: PersistedTableModel, id: string) => m.rows.find((row) => row.id === id);

describe('hasFixedTableRowHeight — «υπάρχει τι να επαναφερθεί;»', () => {
  it('γραμμή χωρίς `heightMm` ⇒ όχι', () => {
    expect(hasFixedTableRowHeight(model(), ['r0'])).toBe(false);
  });

  it('γραμμή με `heightMm` ⇒ ναι', () => {
    expect(hasFixedTableRowHeight(model(), ['r1'])).toBe(true);
  });

  /**
   * 🔴 `some`, ΠΟΤΕ `every` — η ερώτηση είναι «υπάρχει τι να επαναφερθεί;».
   *
   * Με `every` το κουμπί θα ήταν σβηστό πάνω σε επιλογή που περιέχει κλειδωμένη γραμμή, δηλαδή
   * θα έκρυβε τη μόνη διέξοδο ακριβώς όταν χρειάζεται.
   */
  it('🔴 μεικτή επιλογή (μία αυτόματη + μία καρφωμένη) ⇒ ΝΑΙ', () => {
    expect(hasFixedTableRowHeight(model(), ['r0', 'r1'])).toBe(true);
  });

  it('άγνωστη ταυτότητα ⇒ όχι, ποτέ σφάλμα (ανοχή σε μπαγιάτικη επιλογή)', () => {
    expect(hasFixedTableRowHeight(model(), ['r99'])).toBe(false);
  });

  it('κενή λίστα ⇒ όχι', () => {
    expect(hasFixedTableRowHeight(model(), [])).toBe(false);
  });
});

describe('clearTableRowHeights — η αφαίρεση', () => {
  /**
   * 🔴 Το πεδίο **φεύγει**, δεν γίνεται `undefined`.
   *
   * Χωρίς αυτό, το `'heightMm' in row` θα έβλεπε ακόμη το κλειδί — δηλαδή η «τρίτη κατάσταση»
   * που το §58.1 απέρριψε ρητά θα ξαναγεννιόταν από την πίσω πόρτα.
   */
  it('🔴 σβήνει το κλειδί ΟΛΟΚΛΗΡΟ, όχι σε `undefined`', () => {
    const next = clearTableRowHeights(model(), ['r1']);
    const row = rowAt(next, 'r1');

    expect(row?.heightMm).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(row ?? {}, 'heightMm')).toBe(false);
  });

  it('αγγίζει ΜΟΝΟ τις γραμμές του στόχου', () => {
    const next = clearTableRowHeights(model(), ['r1']);
    expect(rowAt(next, 'r2')?.heightMm).toBe(20);
  });

  it('πολλαπλός στόχος ⇒ όλες ελευθερώνονται με μία μεταβολή', () => {
    const next = clearTableRowHeights(model(), ['r1', 'r2']);
    expect(next.rows.every((row) => row.heightMm === undefined)).toBe(true);
  });

  it('κρατά την κλάση γραμμής και κάθε άλλο πεδίο', () => {
    const next = clearTableRowHeights(model(), ['r1']);
    expect(rowAt(next, 'r1')?.rowClass).toBe('data');
  });

  /**
   * 🔴 **Η εγγύηση που κρατά καθαρό το ιστορικό αναιρέσεων.**
   *
   * Το `buildTableModelCommand` δεν γεννά εντολή όταν το μοντέλο γυρίζει ταυτοτικό. Χωρίς
   * αυτήν, κάθε πάτημα σε ήδη αυτόματη γραμμή θα άφηνε βήμα `Ctrl+Z` που δεν αναιρεί τίποτα.
   */
  it('🔴 τίποτα να σβηστεί ⇒ ΤΟ ΙΔΙΟ αντικείμενο by-reference', () => {
    const before = model();
    expect(clearTableRowHeights(before, ['r0'])).toBe(before);
    expect(clearTableRowHeights(before, [])).toBe(before);
    expect(clearTableRowHeights(before, ['r99'])).toBe(before);
  });
});
