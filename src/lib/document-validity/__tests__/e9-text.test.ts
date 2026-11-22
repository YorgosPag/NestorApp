/**
 * Αναγνώστης Ε9 (ADR-949 Α-2) — πάνω σε **ανωνυμοποιημένα** πραγματικά δείγματα (`e9-text.fixture.ts`), ένα με
 * `/Rotate 90` και ένα χωρίς: η ανάγνωση με θέση πρέπει να δίνει τις ίδιες στήλες και στα δύο.
 */

import { E9_A_PAGES, E9_B_PAGES, ENFIA_BROKEN_FONT_PAGES } from './e9-text.fixture';
import { parseE9Floor, parseGreekNumber, readE9Text, type E9BuildingRow } from '../e9-text';

function rowsOf(pages: Parameters<typeof readE9Text>[0]): readonly E9BuildingRow[] {
  const result = readE9Text(pages);
  if (result.kind !== 'read') throw new Error(`expected read, got ${result.kind}`);
  return result.rows;
}

describe('readE9Text — δείγμα Α (σελίδα με /Rotate 90)', () => {
  const rows = rowsOf(E9_A_PAGES);

  it('διαβάζει μόνο τα κτίσματα του Πίνακα 1 — όχι το οικόπεδο, όχι τον Πίνακα 2', () => {
    expect(rows.map((row) => row.category)).toEqual([1, 5]);
  });

  it('κατοικία: όροφος 1 · 93,51 τ.μ. · έτος 2003 · σελίδα 2', () => {
    expect(rows[0]).toMatchObject({
      page: 2,
      category: 1,
      floor: { kind: 'level', number: 1 },
      mainArea: 93.51,
      auxArea: null,
      constructionYear: 2003,
      specialCondition: null,
      rightKind: 1,
    });
  });

  it('ποσοστό σπασμένο σε τρεις γραμμές (`100,` + `0000` + `0`) ⇒ 100', () => {
    expect(rows.map((row) => row.ownershipPct)).toEqual([100, 100]);
  });

  it('αποθήκη: υπόγειο · 8,61 τ.μ.', () => {
    expect(rows[1]).toMatchObject({ category: 5, floor: { kind: 'basement' }, mainArea: 8.61 });
  });

  it('η διεύθυνση της γραμμής βγαίνει από τη στήλη «ΟΔΟΣ - ΑΡΙΘΜΟΣ»', () => {
    expect(rows[0].address).toContain('ΑΚΑΚΙΩΝ 2');
  });

  it('κανένα πεδίο για ΑΦΜ / ονόματα / ΚΑΕΚ (ελαχιστοποίηση από κατασκευής)', () => {
    expect(Object.keys(rows[0]).sort()).toEqual(
      ['address', 'auxArea', 'category', 'constructionYear', 'floor', 'mainArea', 'ownershipPct', 'page', 'rightKind', 'specialCondition'].sort(),
    );
  });
});

describe('readE9Text — δείγμα Β (σελίδα χωρίς περιστροφή, πολλές γραμμές)', () => {
  const rows = rowsOf(E9_B_PAGES);

  it('δώδεκα γραμμές κτισμάτων στη σελίδα 2: έξι αποθήκες υπογείου και έξι κατοικίες', () => {
    expect(rows).toHaveLength(12);
    expect(rows.every((row) => row.page === 2)).toBe(true);
    expect(rows.slice(0, 6).every((row) => row.category === 5 && row.floor?.kind === 'basement')).toBe(true);
    expect(rows.slice(6).map((row) => row.floor)).toEqual([1, 2, 3, 3, 5, 5].map((number) => ({ kind: 'level', number })));
  });

  it('κύριοι και βοηθητικοί χώροι σε χωριστές στήλες', () => {
    expect(rows[6]).toMatchObject({ category: 1, mainArea: 62.56, auxArea: 12, constructionYear: 2005, rightKind: 1, ownershipPct: 100 });
    expect(rows[11]).toMatchObject({ mainArea: 68.38, auxArea: 12 });
  });

  it('ο Πίνακας 2 (γήπεδα) δεν διαβάζεται ως Πίνακας 1: χωρίς σελίδα Πίνακα 1 ⇒ not-recognized', () => {
    expect(readE9Text(E9_B_PAGES.filter((page) => page.page !== 2))).toEqual({ kind: 'not-recognized' });
  });
});

describe('readE9Text — άλλο έγγραφο', () => {
  it('ΕΝΦΙΑ με σπασμένη γραμματοσειρά ⇒ not-recognized', () => {
    expect(readE9Text(ENFIA_BROKEN_FONT_PAGES)).toEqual({ kind: 'not-recognized' });
  });

  it('Ε9 χωρίς Πίνακα 1 ⇒ not-recognized', () => {
    expect(readE9Text(E9_A_PAGES.filter((page) => page.page === 1))).toEqual({ kind: 'not-recognized' });
  });
});

describe('κελιά', () => {
  it.each([
    ['93,51', 93.51],
    ['4.522,00', 4522],
    ['65', 65],
    ['100,', null],
    ['Ο.Τ.2', null],
    [null, null],
  ])('parseGreekNumber(%p) = %p', (cell, expected) => {
    expect(parseGreekNumber(cell)).toBe(expected);
  });

  it.each([
    ['Υ', { kind: 'basement' }],
    ['0', { kind: 'level', number: 0 }],
    ['3', { kind: 'level', number: 3 }],
    ['Ι', null],
    [null, null],
  ])('parseE9Floor(%p)', (cell, expected) => {
    expect(parseE9Floor(cell)).toEqual(expected);
  });
});
