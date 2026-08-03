/**
 * ADR-750 Φάση 3, απόφαση **Α20** — από πού έρχεται το μολύβι μιας εντολής περιγράμματος.
 *
 * Η ουσία που ελέγχεται δεν είναι «επιστρέφει αντικείμενο»: είναι ότι το αποτέλεσμα **ταιριάζει
 * με τις γραμμές που ο πίνακας έχει ήδη**, σε κάθε built-in στυλ — και ότι δεν είναι ποτέ
 * αόρατο, γιατί ένα αόρατο μολύβι θα έκανε το «Όλα τα περιγράμματα» σιωπηλό no-op.
 */

import { resolveTableBorderPencil } from '../table-border-pencil';
import { applyTableBorderCommand } from '../table-range-border-ops';
import { BUILTIN_TABLE_STYLE_IDS, BUILTIN_TABLE_STYLES } from '../table-style-presets';
import { LINEWEIGHT_CONCRETE_MM_VALUES } from '../../../config/lineweight-iso-catalog';
import type { TableStyle } from '../table-style';
import type { PersistedTableModel, TableColumn, TableRow } from '../../../types/table';

function styleById(id: string): TableStyle {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === id);
  if (!style) throw new Error(`missing preset: ${id}`);
  return style;
}

const STANDARD = styleById(BUILTIN_TABLE_STYLE_IDS.STANDARD);

function persisted(rowCount: number, colCount: number): PersistedTableModel {
  const columns: TableColumn[] = Array.from({ length: colCount }, (_, c) => ({
    id: `c${c + 1}`,
    sizing: { kind: 'fixed', widthMm: 10 },
    valueType: 'text',
    align: 'left',
  }));
  const rows: TableRow[] = Array.from({ length: rowCount }, (_, r) => ({
    id: `r${r + 1}`,
    rowClass: 'data',
    heightMm: 6,
  }));
  return { columns, rows, cells: [], merges: [] };
}

describe('Α20 — το μολύβι παράγεται από το στυλ, δεν είναι σταθερά', () => {
  it('παίρνει την ΕΣΩΤΕΡΙΚΗ γραμμή της κλάσης «data» — τη γραμμή πλέγματος του πίνακα', () => {
    const pencil = resolveTableBorderPencil(STANDARD);
    const grid = STANDARD.rowClasses.data.borders.insideH;
    expect(pencil.colorHex).toBe(grid.colorHex);
    expect(pencil.widthMm).toBe(grid.widthMm);
  });

  it('🔑 το «παχύ» του βγαίνει ΑΚΡΙΒΩΣ ίσο με το πλαίσιο που ορίζει το ίδιο στυλ', () => {
    // Η μετρημένη επικύρωση της Α20: `insideH` = 0,25 και πλαίσιο = 0,50 στο `standard`. Το
    // `thick` του μητρώου είναι η επόμενη πένα ISO (λόγος 1:2), άρα «Παχιά εξωτερικά» αναπαράγει
    // το πλαίσιο του στυλ χωρίς να το ξέρει. Με βάση το ήδη παχύ πλαίσιο θα έβγαινε διπλάσιο.
    const pencil = resolveTableBorderPencil(STANDARD);
    const model = applyTableBorderCommand(
      persisted(2, 2),
      { firstRow: 0, lastRow: 1, firstCol: 0, lastCol: 1 },
      'thickOutside',
      pencil,
    );
    const widths = new Set((model.edges ?? []).map(([, , , spec]) => spec.widthMm));
    expect(widths.size).toBe(1);
    expect([...widths][0]).toBe(STANDARD.rowClasses.data.borders.top.widthMm);
  });

  it('είναι ΠΑΝΤΑ ορατό, σε κάθε built-in στυλ — αλλιώς το «Όλα» δεν θα ζωγράφιζε τίποτα', () => {
    for (const style of BUILTIN_TABLE_STYLES) {
      expect(resolveTableBorderPencil(style).visible).toBe(true);
    }
  });

  it('το πάχος του είναι ΠΑΝΤΑ πένα του καταλόγου ISO — ποτέ ελεύθερος αριθμός', () => {
    for (const style of BUILTIN_TABLE_STYLES) {
      const { widthMm } = resolveTableBorderPencil(style);
      expect(LINEWEIGHT_CONCRETE_MM_VALUES).toContain(widthMm);
    }
  });

  it('🔴 στυλ ΧΩΡΙΣ καμία ορατή γραμμή: παίρνει το μελάνι του κειμένου, όχι μαύρο', () => {
    // Το `detailSheet` (ADR-622) έχει και τις έξι ακμές αόρατες. Ένα σταθερό `#000000` εδώ θα
    // ήταν εφεύρεση σε στυλ που δηλώνει ρητά άλλο χρώμα κειμένου.
    const blank = styleById(BUILTIN_TABLE_STYLE_IDS.DETAIL_SHEET);
    const pencil = resolveTableBorderPencil(blank);
    expect(pencil.visible).toBe(true);
    expect(pencil.colorHex).toBe(blank.rowClasses.data.textColorHex);
    expect(pencil.widthMm).toBeGreaterThan(0);
  });

  it('είναι ντετερμινιστικό — δύο κλήσεις, ίδια τιμή (καμία κρυφή κατάσταση, Α15)', () => {
    for (const style of BUILTIN_TABLE_STYLES) {
      expect(resolveTableBorderPencil(style)).toEqual(resolveTableBorderPencil(style));
    }
  });
});
