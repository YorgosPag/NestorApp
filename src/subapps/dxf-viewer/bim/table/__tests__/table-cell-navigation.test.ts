/**
 * ADR-739 Φ.Δ βήμα 2 — `moveTableCursor`: ο πυρήνας της πλοήγησης «σαν Excel».
 *
 * Κάθε προσδοκία παρακάτω είναι **προδιαγραφή συμπεριφοράς μεγάλου παίχτη**, όχι
 * αποτύπωμα της υλοποίησης: ο κανόνας της στήλης αγκύρωσης (Excel), η αναδίπλωση
 * γραμμής του `Tab` (AutoCAD/Word), τα Home/End/Ctrl+Home/Ctrl+End (WAI-ARIA APG), και
 * η ρητή **μη**-δημιουργία γραμμής στο τέλος.
 *
 * Το πλέγμα δοκιμής είναι 3×3 με μία συγχώνευση 2×2 στο (r2,c2), γιατί εκεί συγκεντρώνονται
 * όλα τα ρίσκα ταυτόχρονα: να προσγειωθεί ο δρομέας σε **καλυμμένο** κελί, να κολλήσει
 * μέσα στη συγχώνευση, ή να την προσπεράσει κατά ένα βήμα λιγότερο/περισσότερο.
 *
 *   c1   c2   c3
 * r1 ·    ·    ·
 * r2 ·   [M ── M]      M = άγκυρα (r2,c2), span 2×2
 * r3 ·   [M ── M]
 */

import { moveTableCursor, tableCursorAt } from '../table-cell-navigation';
import { createTableModel } from '../table-model-helpers';
import type { TableColumn, TableModel, TableRow } from '../../../types/table';

const COLUMNS: TableColumn[] = ['c1', 'c2', 'c3'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'text',
  align: 'left',
}));

const ROWS: TableRow[] = ['r1', 'r2', 'r3'].map((id) => ({
  id,
  rowClass: 'data',
  heightMm: 8,
}));

/** Απλό 3×3 χωρίς συγχωνεύσεις. */
const plain: TableModel = createTableModel({ columns: COLUMNS, rows: ROWS });

/** 3×3 με συγχώνευση 2×2 με άγκυρα το (r2,c2) — καλύπτει (r2,c3), (r3,c2), (r3,c3). */
const merged: TableModel = createTableModel({
  columns: COLUMNS,
  rows: ROWS,
  merges: [{ anchorRowId: 'r2', anchorColId: 'c2', rowSpan: 2, colSpan: 2 }],
});

/** Συντομογραφία: «πού καταλήγω;» ως `'row/col'`, ή `null` όταν δεν κινούμαι. */
function go(
  model: TableModel,
  from: { rowId: string; colId: string; anchorColId?: string },
  move: Parameters<typeof moveTableCursor>[2],
): string | null {
  const next = moveTableCursor(
    model,
    { rowId: from.rowId, colId: from.colId, anchorColId: from.anchorColId ?? from.colId },
    move,
  );
  return next ? `${next.rowId}/${next.colId}` : null;
}

// ── Βασικές κινήσεις ────────────────────────────────────────────────────────

describe('moveTableCursor — βέλη σε απλό πλέγμα', () => {
  it.each([
    ['right', 'r2/c3'],
    ['left', 'r2/c1'],
    ['up', 'r1/c2'],
    ['down', 'r3/c2'],
  ] as const)('%s από το κέντρο ⇒ %s', (move, expected) => {
    expect(go(plain, { rowId: 'r2', colId: 'c2' }, move)).toBe(expected);
  });

  it.each([
    ['right', { rowId: 'r1', colId: 'c3' }],
    ['left', { rowId: 'r1', colId: 'c1' }],
    ['up', { rowId: 'r1', colId: 'c1' }],
    ['down', { rowId: 'r3', colId: 'c1' }],
  ] as const)('%s στην άκρη ⇒ null (ο δρομέας ΜΕΝΕΙ, καμία αναδίπλωση)', (move, from) => {
    expect(go(plain, from, move)).toBeNull();
  });
});

// ── Tab: αναδίπλωση γραμμής ─────────────────────────────────────────────────

describe('moveTableCursor — Tab/Shift+Tab (AutoCAD/Word: αναδιπλώνουν γραμμή)', () => {
  it('next μέσα στη γραμμή ⇒ επόμενη στήλη', () => {
    expect(go(plain, { rowId: 'r1', colId: 'c1' }, 'next')).toBe('r1/c2');
  });

  it('next στο ΤΕΛΟΣ γραμμής ⇒ ΠΡΩΤΟ κελί της επόμενης γραμμής', () => {
    expect(go(plain, { rowId: 'r1', colId: 'c3' }, 'next')).toBe('r2/c1');
  });

  it('previous στην ΑΡΧΗ γραμμής ⇒ ΤΕΛΕΥΤΑΙΟ κελί της προηγούμενης', () => {
    expect(go(plain, { rowId: 'r2', colId: 'c1' }, 'previous')).toBe('r1/c3');
  });

  it('next στο ΤΕΛΕΥΤΑΙΟ κελί του πίνακα ⇒ null — ΔΕΝ δημιουργεί γραμμή', () => {
    expect(go(plain, { rowId: 'r3', colId: 'c3' }, 'next')).toBeNull();
  });

  it('previous στο ΠΡΩΤΟ κελί ⇒ null', () => {
    expect(go(plain, { rowId: 'r1', colId: 'c1' }, 'previous')).toBeNull();
  });
});

// ── Ο κανόνας της στήλης αγκύρωσης (Excel) ──────────────────────────────────

describe('moveTableCursor — στήλη αγκύρωσης: το χαρακτηριστικό του Excel', () => {
  it('το Tab ΔΙΑΤΗΡΕΙ τη στήλη αγκύρωσης', () => {
    const after = moveTableCursor(plain, tableCursorAt('r1', 'c1'), 'next');
    expect(after).toEqual({ rowId: 'r1', colId: 'c2', anchorColId: 'c1' });
  });

  it('Tab → Tab → Enter επιστρέφει στη ΣΤΗΛΗ ΕΚΚΙΝΗΣΗΣ, όχι στην τελευταία', () => {
    const a = moveTableCursor(plain, tableCursorAt('r1', 'c1'), 'next');
    const b = moveTableCursor(plain, a!, 'next');
    expect(`${b!.rowId}/${b!.colId}`).toBe('r1/c3');
    const c = moveTableCursor(plain, b!, 'commitDown');
    expect(`${c!.rowId}/${c!.colId}`).toBe('r2/c1');
  });

  it('διαδοχικά Enter ΜΕΝΟΥΝ στη στήλη αγκύρωσης (δεν ολισθαίνουν)', () => {
    const a = moveTableCursor(plain, tableCursorAt('r1', 'c1'), 'next');
    const b = moveTableCursor(plain, a!, 'commitDown');
    const c = moveTableCursor(plain, b!, 'commitDown');
    expect(`${c!.rowId}/${c!.colId}`).toBe('r3/c1');
    expect(c!.anchorColId).toBe('c1');
  });

  it('ένα ΒΕΛΟΣ μηδενίζει την αγκύρωση — νέα σειρά καταχώρισης', () => {
    const a = moveTableCursor(plain, tableCursorAt('r1', 'c1'), 'next');
    const b = moveTableCursor(plain, a!, 'right');
    expect(b).toEqual({ rowId: 'r1', colId: 'c3', anchorColId: 'c3' });
  });

  it('Enter χωρίς προηγούμενο Tab ⇒ απλή κάθοδος στην ίδια στήλη', () => {
    expect(go(plain, { rowId: 'r1', colId: 'c2' }, 'commitDown')).toBe('r2/c2');
  });
});

// ── Home / End / Ctrl+Home / Ctrl+End (WAI-ARIA APG) ────────────────────────

describe('moveTableCursor — άκρα γραμμής και πλέγματος', () => {
  it.each([
    ['rowStart', 'r2/c1'],
    ['rowEnd', 'r2/c3'],
    ['gridStart', 'r1/c1'],
    ['gridEnd', 'r3/c3'],
  ] as const)('%s ⇒ %s', (move, expected) => {
    expect(go(plain, { rowId: 'r2', colId: 'c2' }, move)).toBe(expected);
  });

  it('rowStart όταν είσαι ΗΔΗ στην αρχή ⇒ null (καμία περιττή εντολή)', () => {
    expect(go(plain, { rowId: 'r2', colId: 'c1' }, 'rowStart')).toBeNull();
  });
});

// ── Συγχωνεύσεις ────────────────────────────────────────────────────────────

describe('moveTableCursor — συγχωνεύσεις: ο δρομέας κάθεται ΠΑΝΤΑ στην άγκυρα', () => {
  it('right από (r2,c1) ⇒ η ΑΓΚΥΡΑ της συγχώνευσης, όχι καλυμμένο κελί', () => {
    expect(go(merged, { rowId: 'r2', colId: 'c1' }, 'right')).toBe('r2/c2');
  });

  it('right ΑΠΟ την άγκυρα προσπερνά ΟΛΟ το εύρος ⇒ null (η 2×2 φτάνει ως c3)', () => {
    expect(go(merged, { rowId: 'r2', colId: 'c2' }, 'right')).toBeNull();
  });

  it('down από την άγκυρα προσπερνά ΚΑΙ ΤΙΣ ΔΥΟ γραμμές της ⇒ null', () => {
    expect(go(merged, { rowId: 'r2', colId: 'c2' }, 'down')).toBeNull();
  });

  it('down από (r1,c3) προσγειώνεται στην άγκυρα (r2,c2), όχι στο καλυμμένο (r2,c3)', () => {
    expect(go(merged, { rowId: 'r1', colId: 'c3' }, 'down')).toBe('r2/c2');
  });

  it('up από (r3,c1) ⇒ (r2,c1) — η γειτονική στήλη δεν επηρεάζεται', () => {
    expect(go(merged, { rowId: 'r3', colId: 'c1' }, 'up')).toBe('r2/c1');
  });

  it('next από (r2,c1) μπαίνει στην άγκυρα· δεύτερο next αναδιπλώνει σε ΝΕΑ γραμμή', () => {
    const first = go(merged, { rowId: 'r2', colId: 'c1' }, 'next');
    expect(first).toBe('r2/c2');
    // Η συγχώνευση καλύπτει και τη r3, άρα «επόμενη γραμμή» μετά από αυτήν δεν υπάρχει.
    expect(go(merged, { rowId: 'r2', colId: 'c2' }, 'next')).toBeNull();
  });

  it('rowEnd στη r3 ⇒ η άγκυρα (r2,c2), γιατί το τελευταίο κελί της r3 είναι καλυμμένο', () => {
    expect(go(merged, { rowId: 'r3', colId: 'c1' }, 'rowEnd')).toBe('r2/c2');
  });
});

// ── Ανθεκτικότητα ───────────────────────────────────────────────────────────

describe('moveTableCursor — μπαγιάτικος δρομέας', () => {
  it('άγνωστο rowId ⇒ null (η γραμμή σβήστηκε από κάτω του)', () => {
    expect(go(plain, { rowId: 'ΔΕΝ_ΥΠΑΡΧΕΙ', colId: 'c1' }, 'down')).toBeNull();
  });

  it('άγνωστο colId ⇒ null', () => {
    expect(go(plain, { rowId: 'r1', colId: 'ΔΕΝ_ΥΠΑΡΧΕΙ' }, 'right')).toBeNull();
  });

  it('άγνωστη στήλη αγκύρωσης ⇒ το Enter πέφτει πίσω στην τρέχουσα στήλη', () => {
    expect(go(plain, { rowId: 'r1', colId: 'c2', anchorColId: 'χάθηκε' }, 'commitDown')).toBe('r2/c2');
  });

  it('πίνακας μίας στήλης: το next αναδιπλώνει κατακόρυφα', () => {
    const single = createTableModel({ columns: [COLUMNS[0]], rows: ROWS });
    expect(go(single, { rowId: 'r1', colId: 'c1' }, 'next')).toBe('r2/c1');
  });
});

describe('tableCursorAt', () => {
  it('ορίζει τη στήλη αγκύρωσης ΣΤΗ ΣΤΗΛΗ ΤΟΥ ΚΛΙΚ — νέα σειρά καταχώρισης', () => {
    expect(tableCursorAt('r2', 'c3')).toEqual({ rowId: 'r2', colId: 'c3', anchorColId: 'c3' });
  });
});
