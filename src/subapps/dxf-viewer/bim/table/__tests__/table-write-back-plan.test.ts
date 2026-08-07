/**
 * ADR-769 §6 — tests **πριν** τον κώδικα.
 *
 * Ο σχεδιασμός του πλάνου write-back: ο πίνακας **ζητάει**, δεν γράφει (ADR-766 Α2). Κάθε
 * άρνηση έχει **ρητό λόγο** — καμία σιωπηλή απόρριψη (πρότυπο CHECK 3.35/3.36).
 */

import type { TableCell } from '../../../types/table';
import {
  planTableWriteBack,
  type TableColumnWriteBack,
  type TableWriteBackInput,
} from '../write-back/table-write-back-plan';

// ─── Βοηθοί ──────────────────────────────────────────────────────────────────

const WRITABLE_X: TableColumnWriteBack = { kind: 'writable', field: 'x' };
const ORDINAL: TableColumnWriteBack = { kind: 'unwritable', reason: 'ordinal' };
const NO_OWNER: TableColumnWriteBack = { kind: 'unwritable', reason: 'no-owner' };

/** Δεμένο κελί με τη δοσμένη βάση σύγκρισης (merge base, ADR-767 Δ2). */
function boundCell(sourceValue: number | string | null, locked?: true): TableCell {
  return { value: sourceValue, bound: { sourceValue }, ...(locked ? { locked } : {}) } as TableCell;
}

/**
 * Η γραμμή 14 του πίνακα συντεταγμένων: x=391698400mm, y=4204500000mm, code='ΣΤ3'.
 * Ο χρήστης γράφει στη στήλη `x`· οι υπόλοιπες στήλες είναι η **βάση** του CAS.
 */
function input(overrides: Partial<TableWriteBackInput> = {}): TableWriteBackInput {
  return {
    column: WRITABLE_X,
    valueType: 'dimension-mm-to-m',
    cell: boundCell(391698400),
    nextDisplayValue: 391698.5,
    rowBasis: [
      { sourceKey: 'y', sourceValue: 4204500000 },
      { sourceKey: 'code', sourceValue: 'ΣΤ3' },
    ],
    liveRow: { x: 391698400, y: 4204500000, code: 'ΣΤ3' },
    sourceKey: 'x',
    ...overrides,
  };
}

// ─── 1. Γραψιμότητα στήλης (Δ2 · πρότυπο Revit) ──────────────────────────────

describe('ADR-769 Δ2 — η γραψιμότητα είναι ιδιότητα ΣΤΗΛΗΣ', () => {
  it('παράγωγη στήλη (αύξων αριθμός) ΔΕΝ γράφεται ποτέ — με ρητό λόγο', () => {
    const plan = planTableWriteBack(input({ column: ORDINAL, sourceKey: 'index' }));
    expect(plan.status).toBe('rejected');
    expect(plan).toMatchObject({ reason: { kind: 'column-unwritable', reason: 'ordinal' } });
  });

  it('στήλη ΧΩΡΙΣ ιδιοκτήτη δηλώνεται ρητά — δεν σιωπά και δεν γράφει', () => {
    const plan = planTableWriteBack(input({ column: NO_OWNER, sourceKey: 'z' }));
    expect(plan).toMatchObject({
      status: 'rejected',
      reason: { kind: 'column-unwritable', reason: 'no-owner' },
    });
  });

  it('γράψιμη στήλη περνά και δηλώνει ΠΟΙΟ πεδίο του ιδιοκτήτη αγγίζει', () => {
    const plan = planTableWriteBack(input());
    expect(plan).toMatchObject({ status: 'accepted', field: 'x' });
  });
});

// ─── 2. Μονάδες (Δ4 · ADR-716 «λύση = ΑΠΟΔΕΙΞΗ») ─────────────────────────────

describe('ADR-769 Δ4 — μέτρα στην οθόνη, χιλιοστά στην αποθήκη', () => {
  it('ο χρήστης γράφει ΜΕΤΡΑ· ο ιδιοκτήτης παίρνει ΧΙΛΙΟΣΤΑ', () => {
    const plan = planTableWriteBack(input({ nextDisplayValue: 391698.5 }));
    expect(plan).toMatchObject({ status: 'accepted', storeValue: 391698500 });
  });

  it('η μετατροπή είναι ΑΚΡΙΒΩΣ η αντίστροφη του εμπρός formatter', () => {
    // 1.250 m στην οθόνη ⇔ 1250 mm στην αποθήκη
    const plan = planTableWriteBack(input({ nextDisplayValue: 1.25 }));
    expect(plan).toMatchObject({ storeValue: 1250 });
  });

  it('μη αριθμητική τιμή σε αριθμητική στήλη ⇒ ρητή άρνηση, ποτέ NaN', () => {
    const plan = planTableWriteBack(input({ nextDisplayValue: 'εξήντα' }));
    expect(plan).toMatchObject({ status: 'rejected', reason: { kind: 'invalid-value' } });
  });

  it('κενό ⇒ άρνηση, ΠΟΤΕ 0 (ADR-720: κατασκευασμένο νούμερο = μέτρηση που κανείς δεν πήρε)', () => {
    const plan = planTableWriteBack(input({ nextDisplayValue: null }));
    expect(plan).toMatchObject({ status: 'rejected', reason: { kind: 'invalid-value' } });
  });
});

// ─── 3. Compare-and-swap (Δ3 · optimistic concurrency) ───────────────────────

describe('ADR-769 Δ3 — καμία γραφή χωρίς ισχύουσα βάση σύγκρισης', () => {
  it('η πηγή ΔΕΝ κουνήθηκε ⇒ η γραφή περνά', () => {
    expect(planTableWriteBack(input()).status).toBe('accepted');
  });

  it('🔴 η πηγή ΚΟΥΝΗΘΗΚΕ σε ΑΛΛΗ στήλη ⇒ source-moved, ΚΑΜΙΑ γραφή', () => {
    const plan = planTableWriteBack(
      input({ liveRow: { x: 391698400, y: 4204599999, code: 'ΣΤ3' } }),
    );
    expect(plan).toMatchObject({
      status: 'rejected',
      reason: { kind: 'source-moved', sourceKey: 'y' },
    });
  });

  it('🔴 αλλαγή σε ΚΕΙΜΕΝΙΚΗ στήλη μετράει το ίδιο — ο κωδικός είναι ταυτότητα', () => {
    const plan = planTableWriteBack(
      input({ liveRow: { x: 391698400, y: 4204500000, code: 'ΣΤ7' } }),
    );
    expect(plan).toMatchObject({
      status: 'rejected',
      reason: { kind: 'source-moved', sourceKey: 'code' },
    });
  });

  it('κανείς δεν ρώτησε την πηγή (undefined ≠ κενό) ⇒ ξεχωριστή ρητή άρνηση', () => {
    const plan = planTableWriteBack(input({ liveRow: undefined }));
    expect(plan).toMatchObject({
      status: 'rejected',
      reason: { kind: 'source-unavailable' },
    });
  });

  it('ο έλεγχος ΠΡΟΗΓΕΙΤΑΙ του «τίποτα δεν άλλαξε» — μπαγιάτικη ισότητα δεν είναι ησυχία', () => {
    const plan = planTableWriteBack(
      input({ nextDisplayValue: 391698.4, liveRow: { x: 391698400, y: 9, code: 'ΣΤ3' } }),
    );
    expect(plan).toMatchObject({ status: 'rejected', reason: { kind: 'source-moved' } });
  });
});

// ─── 4. Βέτο ανθρώπου + δεσμός (Δ5 · Δ1) ─────────────────────────────────────

describe('ADR-769 Δ5 — το locked είναι ΑΝΘΡΩΠΙΝΟ βέτο στο περιεχόμενο', () => {
  it('κλειδωμένο κελί ⇒ άρνηση με δικό της λόγο (όχι «unwritable column»)', () => {
    const plan = planTableWriteBack(input({ cell: boundCell(391698400, true) }));
    expect(plan).toMatchObject({ status: 'rejected', reason: { kind: 'cell-locked' } });
  });

  it('ΑΔΕΤΟ κελί δεν έχει ιδιοκτήτη να ρωτήσει ⇒ ρητή άρνηση', () => {
    const plan = planTableWriteBack(input({ cell: { value: 1 } as TableCell }));
    expect(plan).toMatchObject({ status: 'rejected', reason: { kind: 'not-bound' } });
  });
});

// ─── 5. Ταυτοδυναμία (N.7.2 #3) ──────────────────────────────────────────────

describe('ADR-769 — ίδια τιμή ⇒ καμία εντολή, καμία εγγραφή στο ιστορικό', () => {
  it('γραφή της ΙΔΙΑΣ τιμής δεν παράγει πλάνο εκτέλεσης', () => {
    const plan = planTableWriteBack(input({ nextDisplayValue: 391698.4 }));
    expect(plan.status).toBe('unchanged');
  });

  it('διαφορά ΚΑΤΩ από το χιλιοστό δεν γεννά εντολή για το τίποτα', () => {
    // 391698.4000001 m → 391698400.0001 mm → στρογγυλεύει στο ίδιο χιλιοστό
    const plan = planTableWriteBack(input({ nextDisplayValue: 391698.4000001 }));
    expect(plan.status).toBe('unchanged');
  });
});

// ─── 6. Σειρά φρουρών — η σειρά ΕΙΝΑΙ το συμβόλαιο ───────────────────────────

describe('ADR-769 — η σειρά των φρουρών είναι δεσμευτική', () => {
  it('παράγωγη στήλη νικά το κλείδωμα: ο λόγος που δείχνεται είναι ο ΔΟΜΙΚΟΣ', () => {
    const plan = planTableWriteBack(
      input({ column: ORDINAL, cell: boundCell(1, true), sourceKey: 'index' }),
    );
    expect(plan).toMatchObject({ reason: { kind: 'column-unwritable' } });
  });

  it('το βέτο του ανθρώπου νικά την άκυρη τιμή — δεν τον διορθώνουμε, τον σεβόμαστε', () => {
    const plan = planTableWriteBack(
      input({ cell: boundCell(391698400, true), nextDisplayValue: 'σκουπίδι' }),
    );
    expect(plan).toMatchObject({ reason: { kind: 'cell-locked' } });
  });
});
