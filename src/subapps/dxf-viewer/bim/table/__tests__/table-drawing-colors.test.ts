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
import { hierarchicalTableStyle } from './hierarchical-table-style-fixture';
import type { TableStyle } from '../table-style';
import type { PlotColorRole } from '../../../config/print-color-policy';
import type { PersistedTableModel } from '../../../types/table';

// ── Εργαλεία ────────────────────────────────────────────────────────────────

/**
 * Το `standard` **με** την ιστορική ιεραρχία γραμμών (τίτλος 4mm έντονος · κεφαλίδα 3mm
 * έντονη με γέμισμα · δεδομένα 2,8mm κανονικά). Από την 2026-08-04 το ίδιο το preset είναι
 * ουδέτερο — κάθε κελί ισάξιο — οπότε δείγμα «μεικτής σειράς» δεν υπάρχει πια εκεί. Το
 * ερώτημα αυτής της ομάδας είναι η μηχανή, όχι το preset· με ομοιόμορφο δείγμα θα έμενε
 * πράσινη χωρίς να ρωτά τίποτα.
 */
const HIERARCHICAL = hierarchicalTableStyle();

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
  overrides: Partial<{
    model: PersistedTableModel;
    layerColors: readonly string[];
    role: PlotColorRole;
  }> = {},
): readonly string[] {
  return collectDrawingColors({
    style: HIERARCHICAL,
    model: overrides.model ?? model(),
    layerColors: overrides.layerColors ?? [],
    role: overrides.role,
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

/**
 * ADR-739 Φ.Ε/Φ4β — ο **δεύτερος ρόλος**.
 *
 * 🔴 Η ασυμμετρία δεν είναι λεπτομέρεια υλοποίησης, είναι η ουσία: ο ίδιος κανόνας που σώζει το
 * κείμενο («τίποτα σχεδόν λευκό») **καταστρέφει** το γέμισμα — το `print-color-policy` το λέει
 * ρητά, και το `#EDEDED` της κεφαλίδας είναι το ζωντανό παράδειγμα.
 */
describe('collectDrawingColors — ο ρόλος αλλάζει ΚΑΙ το πεδίο ΚΑΙ το φίλτρο', () => {
  it('`role: fill` διαβάζει `fillColorHex`, ΟΧΙ `textColorHex`', () => {
    // Το `standard` βάφει μόνο την κεφαλίδα (#EDEDED)· το κείμενό του είναι #111111. Αν το
    // πεδίο δεν άλλαζε, εδώ θα ερχόταν το #111111 — δηλαδή ο επιλογέας γεμίσματος θα πρότεινε
    // χρώματα μελανιού.
    expect(collect({ role: 'fill' })).toEqual(['#ededed']);
    expect(collect({ role: 'ink' })).toEqual(['#111111']);
  });

  it('🔴 `role: fill` ΔΕΝ κόβει το λευκό layer — εκεί το λευκό είναι αδιαφανές φόντο', () => {
    // Ίδιο ακριβώς input, αντίθετο αποτέλεσμα: αυτό είναι το test της ασυμμετρίας.
    expect(collect({ role: 'ink', layerColors: ['#ffffff'] })).not.toContain('#ffffff');
    expect(collect({ role: 'fill', layerColors: ['#ffffff'] })).toContain('#ffffff');
  });

  it('🔴 το ρητό «κανένα γέμισμα» (`null`) ΔΕΝ γίνεται δείγμα — δεν είναι χρώμα', () => {
    // Η άρνηση χρώματος έχει δική της γραμμή στο μενού. Ένα δείγμα γι' αυτήν εδώ θα ήταν
    // δεύτερος δρόμος προς την ίδια κατάσταση, μέσα σε ζώνη που λέει «χρώματα που υπάρχουν».
    const withNull: PersistedTableModel = {
      ...model(),
      columns: [
        { ...model().columns[0], styleOverride: { fillColorHex: null } },
        model().columns[1],
      ],
    };
    const out = collect({ role: 'fill', model: withNull });
    expect(out).toEqual(['#ededed']);
    expect(out).not.toContain(null);
  });

  it('μαζεύει ρητά γεμίσματα από στήλη, γραμμή και κελί — ίδιες τρεις πηγές', () => {
    const painted: PersistedTableModel = {
      ...model(),
      columns: [
        { ...model().columns[0], styleOverride: { fillColorHex: '#ff0000' } },
        model().columns[1],
      ],
      rows: [
        { ...model().rows[0], styleOverride: { fillColorHex: '#00ff00' } },
        model().rows[1],
      ],
      cells: [['r1', 'c1', { text: 'x', styleOverride: { fillColorHex: '#0000ff' } }]],
    };
    const out = collect({ role: 'fill', model: painted });
    // Στυλ πρώτα, μετά ο πίνακας — στήλη, γραμμή, κελί.
    expect(out).toEqual(['#ededed', '#ff0000', '#00ff00', '#0000ff']);
  });

  it('🔴 στυλ που δεν βάφει τίποτα ⇒ ΚΕΝΗ ζώνη — και ο καλών οφείλει να το χειριστεί', () => {
    // Για το κείμενο αυτό δεν συμβαίνει σχεδόν ποτέ (οι τρεις κλάσεις πάντα δηλώνουν χρώμα)·
    // για το γέμισμα είναι η κανονικότητα. Ένα στυλ χωρίς κανένα `fillColorHex` δεν είναι
    // παθολογία — είναι ένας καθαρός πίνακας πριν τον βάψει κανείς.
    const bare: TableStyle = {
      ...STANDARD,
      rowClasses: {
        title: { ...STANDARD.rowClasses.title, fillColorHex: undefined },
        header: { ...STANDARD.rowClasses.header, fillColorHex: undefined },
        data: { ...STANDARD.rowClasses.data, fillColorHex: undefined },
      },
    };
    expect(collectDrawingColors({ style: bare, model: model(), layerColors: [], role: 'fill' }))
      .toEqual([]);
  });

  it('η προεπιλογή είναι `ink` — ο υπάρχων καλών δεν αλλάζει συμπεριφορά', () => {
    expect(collect()).toEqual(collect({ role: 'ink' }));
  });
});
