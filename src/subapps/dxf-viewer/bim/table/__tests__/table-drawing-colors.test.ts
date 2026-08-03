/**
 * ADR-739 Φ.Ε/Φ4 — «Χρώματα του σχεδίου», η ζώνη εγγράφου του επιλογέα.
 *
 * Το test που έχει σημασία είναι ότι **το λευκό layer δεν φτάνει ποτέ στη ζώνη**: το
 * προεπιλεγμένο layer `0` κάθε DXF είναι λευκό, άρα χωρίς αυτόν τον κανόνα το πρώτο κιόλας
 * σχέδιο θα πρόσφερε λευκό κείμενο σε λευκό φύλλο. Τα υπόλοιπα φυλάνε σειρά και όριο.
 *
 * @see bim/table/table-drawing-colors.ts
 */

import { collectDrawingColors, DRAWING_COLORS_LIMIT } from '../table-drawing-colors';
import { BUILTIN_TABLE_STYLE_IDS, BUILTIN_TABLE_STYLES } from '../table-style-presets';
import type { TableStyle } from '../table-style';
import type { PersistedTableModel } from '../../../types/table';

// ── Εργαλεία ────────────────────────────────────────────────────────────────

function styleById(id: string): TableStyle {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === id);
  if (!style) throw new Error(`missing preset: ${id}`);
  return style;
}
const STANDARD = styleById(BUILTIN_TABLE_STYLE_IDS.STANDARD);

function model(): PersistedTableModel {
  return {
    columns: [
      { id: 'c0', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
      { id: 'c1', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
    ],
    rows: [
      { id: 'r0', rowClass: 'header' },
      { id: 'r1', rowClass: 'data' },
    ],
    cells: [],
    merges: [],
  };
}

function collect(
  overrides: Partial<{ model: PersistedTableModel; layerColors: readonly string[] }> = {},
): readonly string[] {
  return collectDrawingColors({
    style: STANDARD,
    model: overrides.model ?? model(),
    layerColors: overrides.layerColors ?? [],
  });
}

// ── Οι πηγές ────────────────────────────────────────────────────────────────

describe('collectDrawingColors — οι τρεις πηγές', () => {
  it('περιέχει πάντα το χρώμα κειμένου του στυλ, ακόμη και σε γυμνό πίνακα', () => {
    // Το `standard` preset βάφει και τις τρεις κλάσεις με το ίδιο `#111111` ⇒ ένα δείγμα.
    expect(collect()).toEqual(['#111111']);
  });

  it('μαζεύει τα ρητά χρώματα του ίδιου του πίνακα — στήλη, γραμμή, κελί', () => {
    const withOverrides: PersistedTableModel = {
      ...model(),
      columns: [
        { id: 'c0', sizing: { kind: 'hug' }, valueType: 'text', align: 'left',
          styleOverride: { textColorHex: '#cc0000' } },
        { id: 'c1', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
      ],
      rows: [
        { id: 'r0', rowClass: 'header', styleOverride: { textColorHex: '#0000ff' } },
        { id: 'r1', rowClass: 'data' },
      ],
      cells: [['r1', 'c1', { text: 'x', styleOverride: { textColorHex: '#008000' } }]],
    };
    expect(collect({ model: withOverrides })).toEqual(
      ['#111111', '#cc0000', '#0000ff', '#008000'],
    );
  });

  it('μαζεύει τα χρώματα των layers — το λεξιλόγιο του σχεδίου', () => {
    expect(collect({ layerColors: ['#ff0000', '#00ff00'] })).toEqual(
      ['#111111', '#ff0000', '#00ff00'],
    );
  });

  it('η σειρά είναι στυλ → πίνακας → layers, από το στενότερο συμφραζόμενο προς το ευρύτερο', () => {
    const withColumn: PersistedTableModel = {
      ...model(),
      columns: [
        { id: 'c0', sizing: { kind: 'hug' }, valueType: 'text', align: 'left',
          styleOverride: { textColorHex: '#abcdef' } },
        { id: 'c1', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
      ],
    };
    expect(collect({ model: withColumn, layerColors: ['#123456'] })).toEqual(
      ['#111111', '#abcdef', '#123456'],
    );
  });
});

// ── Οι δύο κανόνες ──────────────────────────────────────────────────────────

describe('collectDrawingColors — τίποτα αόρατο σε λευκό χαρτί', () => {
  it('🔴 το λευκό layer `0` κάθε DXF ΔΕΝ φτάνει στη ζώνη', () => {
    expect(collect({ layerColors: ['#ffffff', '#0000ff'] })).toEqual(['#111111', '#0000ff']);
  });

  it('κόβει και τα σχεδόν λευκά, με το κατώφλι του εκτυπωτή — όχι δικό του', () => {
    // `#f8f8f8` = 0,973 ανά κανάλι, πάνω από το 0,92 του `print-color-policy`.
    expect(collect({ layerColors: ['#f8f8f8'] })).toEqual(['#111111']);
  });
});

describe('collectDrawingColors — διπλότυπα και όριο', () => {
  it('το ίδιο χρώμα σε δύο πηγές εμφανίζεται μία φορά', () => {
    expect(collect({ layerColors: ['#111111', '#111111'] })).toEqual(['#111111']);
  });

  it('συγκρίνει κανονικοποιημένα: `#FF0000` και `#ff0000` είναι ΕΝΑ χρώμα', () => {
    // Χωρίς αυτό, ένα εισαγόμενο layer με κεφαλαία θα εμφανιζόταν δεύτερη φορά δίπλα στο ίδιο
    // του το χρώμα — και το «τρέχον» δεν θα φαινόταν επιλεγμένο.
    expect(collect({ layerColors: ['#FF0000', '#ff0000'] })).toEqual(['#111111', '#ff0000']);
  });

  it('δεν ξεπερνά ποτέ το όριο, όσα layers κι αν έχει το σχέδιο', () => {
    const many = Array.from({ length: 200 }, (_, i) => `#${(i + 1).toString(16).padStart(6, '0')}`);
    expect(collect({ layerColors: many })).toHaveLength(DRAWING_COLORS_LIMIT);
  });
});
