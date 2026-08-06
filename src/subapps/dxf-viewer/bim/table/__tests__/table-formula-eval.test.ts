/**
 * ADR-739 Φ.Ζ — **η αξιολόγηση**: αριθμητική, αναφορές, συναρτήσεις, σφάλματα.
 *
 * Το πρώτο test είναι το αίτημα του ιδιοκτήτη αυτούσιο (`=(2*5)/2` → `5`). Τα υπόλοιπα
 * υπάρχουν επειδή ένας πίνακας ποσοτήτων είναι **νομικό παραδοτέο**: ένα σιωπηλά λάθος
 * άθροισμα δεν είναι σφάλμα εμφάνισης (ADR-720).
 */

import { createTableModel, getCell } from '../table-model-helpers';
import type { TableCellEntry, TableColumn, TableModel, TableRow } from '../../../types/table';
import { parseTableFormula } from '../formula/table-formula-parse';
import { CANONICAL_FORMULA_GRAMMAR } from '../../../types/table-formula-grammar';
import { evaluateTableFormula, type TableFormulaScope } from '../formula/table-formula-eval';
import { toCellValue } from '../formula/table-formula-value';

const COLUMNS: TableColumn[] = ['c1', 'c2'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'number',
  align: 'right',
}));

const ROWS: TableRow[] = ['r1', 'r2', 'r3'].map((id) => ({ id, rowClass: 'data', heightMm: 8 }));

/** `A1=10`, `A2=20`, `A3` κενό, `B1` κείμενο, `B2=«2,4»` (ελληνικό δεκαδικό). */
const CELLS: readonly TableCellEntry[] = [
  ['r1', 'c1', { kind: 'text', value: '10' }],
  ['r2', 'c1', { kind: 'text', value: '20' }],
  ['r1', 'c2', { kind: 'text', value: 'Δοκός Δ1' }],
  ['r2', 'c2', { kind: 'text', value: '2,4' }],
];

const MODEL: TableModel = createTableModel({ columns: COLUMNS, rows: ROWS, cells: CELLS });

/** Ο ίδιος αναγνώστης που δίνει ο επαναϋπολογισμός: κελί που λείπει **είναι** κενό. */
const SCOPE: TableFormulaScope = {
  model: MODEL,
  valueAt: (ref) => getCell(MODEL, ref.rowId, ref.colId)?.value ?? '',
};

/**
 * Ό,τι θα αποθηκευόταν στο κελί για αυτό το κείμενο τύπου.
 *
 * 🔑 **Ρητά η κανονική γραμματική** (ADR-761), και είναι απόφαση: αυτό το αρχείο ρωτά «τι
 * **υπολογίζει** ο αξιολογητής», όχι «πώς **γράφεται** ένας τύπος». Αν τα δείγματα
 * ακολουθούσαν τη γραμματική του σχεδίου, κάθε αλλαγή της θα έβαφε κόκκινη μια σουίτα που
 * δεν έχει άποψη γι' αυτήν — δηλαδή η σουίτα θα έλεγχε **δύο** πράγματα και θα απαντούσε
 * για ένα. Η γραμματική έχει δική της σουίτα (`table-formula-grammar.test.ts`), που ελέγχει
 * ρητά ότι η **σημασιολογία είναι η ίδια** και στις δύο γραφές.
 */
function evaluate(text: string): string | number | null {
  const formula = parseTableFormula(MODEL, text, CANONICAL_FORMULA_GRAMMAR);
  if (formula === null) throw new Error(`Δεν αναλύθηκε: ${text}`);
  return toCellValue(evaluateTableFormula(SCOPE, formula));
}

describe('αριθμητική', () => {
  it('🎯 το αίτημα: `=(2*5)/2` δίνει 5', () => {
    expect(evaluate('=(2*5)/2')).toBe(5);
  });

  it.each([
    ['=1+2*3', 7],
    ['=(1+2)*3', 9],
    ['=2^10', 1024],
    ['=-2^2', 4], // ιδιαιτερότητα Excel: το πρόσημο δένει πιο σφιχτά από τη δύναμη
    ['=2^3^2', 512], // δεξιά προσεταιριστική
    ['=10-3-2', 5], // αριστερά προσεταιριστική
    ['=10/(2*5)', 1],
    ['=--5', 5],
  ])('«%s» = %s', (text, expected) => {
    expect(evaluate(text)).toBe(expected);
  });

  it('η ακρίβεια κόβεται στα 15 σημαντικά ψηφία, όπως στο Excel', () => {
    // Χωρίς αυτό θα αποθηκευόταν 0.30000000000000004 — και θα τυπωνόταν σε σχέδιο.
    expect(evaluate('=0.1+0.2')).toBe(0.3);
  });
});

describe('αναφορές κελιών', () => {
  it.each([
    ['=A1', 10],
    ['=A1+A2', 30],
    ['=A1*2', 20],
    ['=A3', 0], // κενό κελί σε αριθμητική πράξη είναι μηδέν — σύμβαση κάθε φύλλου
    ['=B2*10', 24], // «2,4» = ελληνικό δεκαδικό (ADR-576), όχι δύο ορίσματα
  ])('«%s» = %s', (text, expected) => {
    expect(evaluate(text)).toBe(expected);
  });

  it('κείμενο σε αριθμητική πράξη δίνει `#VALUE!`, δεν αγνοείται', () => {
    expect(evaluate('=B1*2')).toBe('#VALUE!');
  });

  it('αναφορά εκτός πλέγματος δίνει `#REF!`', () => {
    expect(evaluate('=A99+1')).toBe('#REF!');
  });
});

describe('συναρτήσεις', () => {
  it.each([
    ['=SUM(A1:A3)', 30],
    ['=SUM(A1:A3,100)', 130],
    ['=AVERAGE(A1:A3)', 15], // το κενό `A3` ΔΕΝ μετρά ως μηδέν
    ['=COUNT(A1:A3)', 2],
    ['=COUNT(B1:B2)', 1], // η περιγραφή δεν είναι αριθμός
    ['=MIN(A1:A2)', 10],
    ['=MAX(A1:A2)', 20],
    ['=ABS(0-7)', 7],
    ['=ROUND(2.567,2)', 2.57],
    ['=ROUND(2.567)', 3],
    ['=SUM(B1:B2)', 2.4], // το κείμενο μέσα σε ΕΥΡΟΣ αγνοείται (τεκμηρίωση AutoCAD)
  ])('«%s» = %s', (text, expected) => {
    expect(evaluate(text)).toBe(expected);
  });

  it('ρητό όρισμα που δεν είναι αριθμός δίνει `#VALUE!` (σε αντίθεση με το εύρος)', () => {
    expect(evaluate('=SUM("άλφα")')).toBe('#VALUE!');
  });

  it('άγνωστη συνάρτηση δίνει `#NAME?`', () => {
    expect(evaluate('=FOO(A1:A2)')).toBe('#NAME?');
  });

  it('`AVERAGE` χωρίς κανέναν αριθμό δίνει `#DIV/0!`, όχι κατασκευασμένο μηδέν', () => {
    expect(evaluate('=AVERAGE(B1:B1)')).toBe('#DIV/0!');
  });
});

describe('σφάλματα', () => {
  it.each([
    ['=1/0', '#DIV/0!'],
    ['=A1/(A1-A1)', '#DIV/0!'],
    ['=10^999', '#NUM!'],
  ])('«%s» = %s', (text, expected) => {
    expect(evaluate(text)).toBe(expected);
  });

  it('το σφάλμα ΔΙΑΔΙΔΕΤΑΙ μέσα από άθροισμα — δεν εξαφανίζεται σε σύνολο', () => {
    expect(evaluate('=SUM(1/0,5)')).toBe('#DIV/0!');
  });
});

describe('IF — ειδική μορφή, ο φύλακας διαίρεσης', () => {
  it('🔑 ο κλάδος που ΔΕΝ ισχύει δεν αξιολογείται ποτέ', () => {
    // Με κανονική συνάρτηση αυτό θα έδινε `#DIV/0!` και ο φύλακας θα ήταν διακοσμητικός.
    expect(evaluate('=IF(A3=0,0,1/A3)')).toBe(0);
  });

  it.each([
    ['=IF(A1>5,"μεγάλο","μικρό")', 'μεγάλο'],
    ['=IF(A1>50,"μεγάλο","μικρό")', 'μικρό'],
    ['=IF(B1="Δοκός Δ1",1,2)', 1],
    ['=IF(A1>50,1)', 'FALSE'],
  ])('«%s» = %s', (text, expected) => {
    expect(evaluate(text)).toBe(expected);
  });
});

describe('κείμενο', () => {
  it('η συνένωση δίνει κείμενο', () => {
    expect(evaluate('=A1&" τεμ."')).toBe('10 τεμ.');
  });

  it('ένα εύρος εκτός συνάρτησης δεν είναι τιμή', () => {
    expect(evaluate('=A1:A2+1')).toBe('#VALUE!');
  });
});
