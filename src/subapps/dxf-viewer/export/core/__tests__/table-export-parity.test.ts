/**
 * ADR-739 Φάση Ε · Φ1 — 🔴 **ΤΟ TEST ΤΗΣ ΦΑΣΗΣ: «Ο,ΤΙ ΒΛΕΠΕΙΣ, ΒΓΑΙΝΕΙ».**
 *
 * ## Τι αποδεικνύει, και γιατί δεν το έπιανε τίποτε άλλο
 * Το `table-cell-clipping.test.ts` κλείδωσε ότι και τα τέσσερα backends βλέπουν το **ίδιο
 * κείμενο**. Κανένα test δεν ρωτούσε αν βλέπουν το ίδιο **μελάνι**. Και δεν το έβλεπαν:
 * ο `mapTablePrimitive` κρατούσε μόνο γεωμετρία και πετούσε `stroke` / `colorHex` / `bold`,
 * ενώ η διάταξη τα παρήγαγε σωστά. Αποτέλεσμα στην οθόνη του χρήστη: γκρίζα κεφαλίδα με
 * έντονα γράμματα και δύο πάχη γραμμής· αποτέλεσμα στο αρχείο: **λευκό, κανονικό, ενιαίο**.
 *
 * Η ιδιότητα που κλειδώνεται εδώ είναι μία πρόταση: **ό,τι λέει το `TableCellLayout`, το λέει
 * και η εξαγόμενη οντότητα.** Το test διαβάζει τη διάταξη ως *αναμενόμενο* — δεν γράφει
 * σταθερές. Έτσι, αν αύριο αλλάξει το preset, το test παραμένει σωστό· αν αλλάξει ο
 * μεταφραστής, γίνεται κόκκινο.
 *
 * ## Οι τρεις παγίδες που δεν φαίνονται σε επιθεώρηση κώδικα
 * 1. **`colorAci` νικά το hex** στον `resolveAci` ⇒ ρητό χρώμα που δεν σβήνει το
 *    κληρονομημένο ACI αγνοείται σιωπηλά.
 * 2. **Η παλέτα ACI ισοπεδώνει το γκρι**: `#EDEDED` → ACI 255 = **λευκό**. Χωρίς
 *    `colorTrueColor` (group 420) η κεφαλίδα βγαίνει λευκή ακόμα κι όταν το γέμισμα υπάρχει.
 * 3. **Η γραμμή βάσης**: το έντονο ταξιδεύει σε `textNode`, και ένα λάθος `attachment` θα
 *    μετακινούσε **κάθε** κείμενο κελιού κατά ένα ύψος κεφαλαίου (DXF group 73).
 *
 * @see export/core/table-to-primitives.ts — ο μεταφραστής που ελέγχεται
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §28
 */

import { layoutTable } from '../../../bim/table/table-layout';
import { createTableModel, toPersistedTableModel } from '../../../bim/table/table-model-helpers';
import { BUILTIN_TABLE_STYLES, BUILTIN_TABLE_STYLE_IDS } from '../../../bim/table/table-style-presets';
import type { TableStyle } from '../../../bim/table/table-style';
import { decomposeTable } from '../table-to-primitives';
import { alignFromTextEntity } from '../dxf-ascii-text-writer';
import { hexToTrueColor } from '../../../utils/dxf-true-color';
import { tableUnderlineGeometry } from '../../../bim/table/table-text-decoration';
import type { TableCell, TableColumn, TableRow } from '../../../types/table';
import type { TableEdgeEntry } from '../../../types/table-edges';
import type { TableEntity } from '../../../types/table-entity';
import type { Entity, HatchEntity, LineEntity, TextEntity } from '../../../types/entities';

// ── Το σενάριο: ο ΣΗΜΕΡΙΝΟΣ πίνακας του χρήστη ──────────────────────────────
//
// Δύο γραμμές, τρεις στήλες: `Α/Α · Περιγραφή · Ποσότητα`. Η κεφαλίδα του preset `standard`
// έχει γέμισμα `#EDEDED` και έντονα· τα δεδομένα ούτε το ένα ούτε το άλλο. Είναι ακριβώς ο
// πίνακας που ο Giorgio ανοίγει για να ελέγξει τη φάση.

function styleById(id: string): TableStyle {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === id);
  if (!style) throw new Error(`missing preset: ${id}`);
  return style;
}

const STANDARD = styleById(BUILTIN_TABLE_STYLE_IDS.STANDARD);

const COLUMNS: TableColumn[] = [
  { id: 'c1', sizing: { kind: 'fixed', widthMm: 15 }, valueType: 'text', align: 'left' },
  { id: 'c2', sizing: { kind: 'fixed', widthMm: 60 }, valueType: 'text', align: 'left' },
  { id: 'c3', sizing: { kind: 'fixed', widthMm: 25 }, valueType: 'text', align: 'left' },
];
/**
 * ⚠️ Το γέμισμα και τα έντονα της κεφαλίδας είναι **παράκαμψη γραμμής**, όχι κληρονομιά του
 * preset. Ήταν κληρονομιά μέχρι την 2026-08-04, οπότε το `standard` έγινε **ουδέτερο**
 * (απόφαση Giorgio: κάθε κελί ισάξιο — ο χρήστης του καμβά φτιάχνει τον δικό του πίνακα).
 * Το σενάριο δεν εξασθένησε· έγινε **πιο κοντά στην πραγματικότητα**: σήμερα το γέμισμα
 * φτάνει στο DXF επειδή το **έβαψε ο χρήστης**, και ακριβώς αυτό το μονοπάτι πρέπει να
 * ελέγχεται. Χωρίς την παράκαμψη δεν θα γεννιόταν ΚΑΝΕΝΑ hatch και έξι έλεγχοι θα
 * «περνούσαν» χωρίς να ρωτούν τίποτα.
 */
export const HEADER_FILL_HEX = '#EDEDED';

const ROWS: TableRow[] = [
  {
    id: 'rh',
    rowClass: 'header',
    styleOverride: { fillColorHex: HEADER_FILL_HEX, bold: true },
  },
  { id: 'rd', rowClass: 'data' },
];

const text = (value: string): TableCell => ({ kind: 'text', value });

const CELLS: Array<[string, string, TableCell]> = [
  ['rh', 'c1', text('Α/Α')],
  ['rh', 'c2', text('Περιγραφή')],
  ['rh', 'c3', text('Ποσότητα')],
  ['rd', 'c1', text('1')],
  ['rd', 'c2', text('Εκσκαφή θεμελίων')],
  ['rd', 'c3', text('12,50')],
];

/**
 * Μια **ρητή παχιά ακμή** κάτω από την κεφαλίδα — ό,τι πατά ο χρήστης με «Παχιά κάτω γραμμή».
 *
 * ⚠️ Χωρίς αυτήν ο πίνακας έχει **ένα** πάχος παντού: από την 2026-08-04 το `standard` δίνει
 * την ίδια πένα σε κάθε ακμή (Giorgio: «κάθε περίγραμμα ίδιο πάχος»). Ο έλεγχος «το πάχος
 * κάθε γραμμής ταξιδεύει ως την εξαγωγή» θα περνούσε τότε ακόμη κι από μεταφραστή που πετά
 * το πάχος και γράφει σταθερά — γιατί όλα τα αναμενόμενα θα ήταν το ίδιο νούμερο.
 */
const THICK_EDGE_MM = 0.5;

const EDGES: readonly TableEdgeEntry[] = [
  ['H', 'rd', 'c1', { visible: true, colorHex: '#666666', widthMm: THICK_EDGE_MM }],
];

function model(): ReturnType<typeof createTableModel> {
  return createTableModel({ columns: COLUMNS, rows: ROWS, cells: CELLS, edges: EDGES });
}

const ENTITY: TableEntity = {
  id: 'ent_parity',
  type: 'table',
  layerId: 'lyr_test',
  position: { x: 0, y: 0 },
  angleRad: 0,
  styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
  model: toPersistedTableModel(model()),
  // Ένα ΚΛΗΡΟΝΟΜΗΜΕΝΟ χρώμα οντότητας, σκόπιμα διαφορετικό από κάθε χρώμα του στυλ: κάθε
  // primitive που «ξεχνά» να δηλώσει το δικό του θα το φορέσει και θα προδοθεί.
  color: '#FF00FF',
  colorAci: 6,
} as TableEntity;

const LAYOUT = layoutTable(model(), STANDARD);
const EXPORTED: Entity[] = decomposeTable(ENTITY, 100, 'mm');

const headerCell = () => {
  const cell = LAYOUT.cells.find((c) => c.rowId === 'rh' && c.colId === 'c1');
  if (!cell) throw new Error('η διάταξη δεν έβγαλε κελί κεφαλίδας');
  return cell;
};
const dataCell = () => {
  const cell = LAYOUT.cells.find((c) => c.rowId === 'rd' && c.colId === 'c1');
  if (!cell) throw new Error('η διάταξη δεν έβγαλε κελί δεδομένων');
  return cell;
};

const hatches = () => EXPORTED.filter((e): e is HatchEntity => e.type === 'hatch');
const lines = () => EXPORTED.filter((e): e is LineEntity => e.type === 'line');
const texts = () => EXPORTED.filter((e): e is TextEntity => e.type === 'text');

/** Το εξαγόμενο κείμενο ενός κελιού, βρεθέν από το περιεχόμενό του (η θέση είναι άλλη ερώτηση). */
function exportedText(content: string): TextEntity {
  const found = texts().find((e) => e.text === content);
  if (!found) throw new Error(`δεν εξήχθη κείμενο «${content}»`);
  return found;
}

// ── ΓΕΜΙΣΜΑ ─────────────────────────────────────────────────────────────────

describe('ADR-739 Φ1 — το γέμισμα του κελιού φτάνει στην εξαγωγή', () => {
  it('η διάταξη ΟΝΤΩΣ δηλώνει γέμισμα κεφαλίδας — αλλιώς το σενάριο δεν ελέγχει τίποτα', () => {
    expect(headerCell().style.fillColorHex).toBeTruthy();
    expect(dataCell().style.fillColorHex).toBeUndefined();
  });

  it('κάθε κελί κεφαλίδας γεννά γέμισμα· κανένα κελί δεδομένων δεν γεννά', () => {
    // 3 κελιά κεφαλίδας με `fillColorHex`, 3 δεδομένων χωρίς.
    expect(hatches()).toHaveLength(3);
  });

  it('το γέμισμα έχει το χρώμα ΤΟΥ ΚΕΛΙΟΥ, όχι το κληρονομημένο της οντότητας', () => {
    const fill = hatches()[0];
    const expected = headerCell().style.fillColorHex;
    expect(fill.color).toBe(expected);
    expect(fill.fillColor).toBe(expected);
    // 🔴 Η οντότητα-πηγή είναι ματζέντα. Ένα `makeSolidFill` χωρίς παράμετρο χρώματος θα
    // κληρονομούσε ΑΥΤΟ — η παγίδα που το §3.3 του handoff προειδοποιεί ρητά.
    expect(fill.color).not.toBe(ENTITY.color);
  });

  it('🔴 το ρητό χρώμα ΣΒΗΝΕΙ το κληρονομημένο colorAci — αλλιώς ο resolveAci το αγνοεί', () => {
    // `resolveAci` προτεραιότητα: colorTrueColor > colorAci > color. Με `colorAci: 6`
    // (ματζέντα) επιζών, το DXF θα έγραφε 62=6 και το hex δεν θα διαβαζόταν ΠΟΤΕ.
    expect(hatches()[0].colorAci).toBeUndefined();
    expect(exportedText('Α/Α').colorAci).toBeUndefined();
    expect(lines()[0].colorAci).toBeUndefined();
  });

  it('🔴 κουβαλά colorTrueColor — χωρίς group 420 το #EDEDED πέφτει στο ACI 7 = ΛΕΥΚΟ', () => {
    const expected = headerCell().style.fillColorHex as string;
    expect(hatches()[0].colorTrueColor).toBe(hexToTrueColor(expected));
  });

  it('🔴 τα γεμίσματα προηγούνται ΚΑΘΕ γραμμής και ΚΑΘΕ κειμένου (z-order)', () => {
    const lastFill = EXPORTED.map((e) => e.type).lastIndexOf('hatch');
    const firstInk = EXPORTED.findIndex((e) => e.type === 'line' || e.type === 'text');
    expect(lastFill).toBeGreaterThanOrEqual(0);
    expect(firstInk).toBeGreaterThan(lastFill);
  });
});

// ── ΜΟΛΥΒΙ ΠΕΡΙΓΡΑΜΜΑΤΟΣ ────────────────────────────────────────────────────

describe('ADR-739 Φ1 — το μολύβι του περιγράμματος φτάνει στην εξαγωγή', () => {
  it('το πάχος κάθε γραμμής ισούται με το πάχος του τμήματος που τη γέννησε', () => {
    // Δύο πάχη: η ομοιόμορφη πένα του `standard` και η ρητή παχιά ακμή του χρήστη. Αν ο
    // μεταφραστής πετούσε το πάχος, το σύνολο θα κατέρρεε σε ΕΝΑ (ή σε κανένα).
    const specWidths = new Set(
      LAYOUT.borders.filter((b) => b.spec.visible).map((b) => b.spec.widthMm),
    );
    const exportedWidths = new Set(lines().map((e) => e.lineweightMm));
    expect(specWidths.size).toBeGreaterThan(1);
    expect(exportedWidths).toEqual(specWidths);
  });

  it('το χρώμα κάθε γραμμής είναι του τμήματος, όχι της οντότητας', () => {
    const specColors = new Set(
      LAYOUT.borders.filter((b) => b.spec.visible).map((b) => b.spec.colorHex),
    );
    for (const line of lines()) {
      expect(specColors.has(line.color as string)).toBe(true);
      expect(line.color).not.toBe(ENTITY.color);
    }
  });
});

// ── ΚΕΙΜΕΝΟ: ΧΡΩΜΑ ΚΑΙ ΕΝΤΟΝΟ ───────────────────────────────────────────────

describe('ADR-739 Φ1 — τυπογραφία κελιού → οντότητα κειμένου', () => {
  it('το χρώμα του κειμένου είναι του κελιού, όχι της οντότητας', () => {
    const expected = headerCell().text?.colorHex;
    expect(expected).toBeTruthy();
    expect(exportedText('Α/Α').color).toBe(expected);
    expect(exportedText('Α/Α').color).not.toBe(ENTITY.color);
  });

  it('το ΕΝΤΟΝΟ της κεφαλίδας ταξιδεύει· τα δεδομένα μένουν κανονικά', () => {
    // Πρώτα η προϋπόθεση: η διάταξη ΟΝΤΩΣ διαφοροποιεί τις δύο γραμμές.
    expect(headerCell().text?.bold).toBe(true);
    expect(dataCell().text?.bold).toBe(false);

    const boldRun = exportedText('Α/Α').textNode?.paragraphs[0]?.runs[0];
    const plainRun = exportedText('1').textNode?.paragraphs[0]?.runs[0];
    expect(boldRun && 'text' in boldRun ? boldRun.style?.bold : undefined).toBe(true);
    expect(plainRun && 'text' in plainRun ? plainRun.style?.bold : undefined).toBe(false);
  });

  it('🔴 ο κόμβος ΔΕΝ μετακινεί τη γραμμή βάσης (DXF group 73 μένει 0)', () => {
    // Η προεπιλογή του `makeNode` είναι `TL` ⇒ 73 = 3 ⇒ ΚΑΘΕ κείμενο κελιού θα κρεμόταν
    // από την κορυφή του, δηλαδή θα μετακινούνταν κατά ένα ύψος κεφαλαίου. Η ερώτηση
    // τίθεται μέσω της ΙΔΙΑΣ συνάρτησης που ρωτά ο writer.
    for (const t of texts()) {
      expect(alignFromTextEntity(t)?.v ?? 0).toBe(0);
    }
  });

  it('το ύψος ζει ΚΑΙ στο run — αλλιώς ο resolveTextHeight δίνει την ISO προεπιλογή 2,5', () => {
    const run = exportedText('Α/Α').textNode?.paragraphs[0]?.runs[0];
    const height = run && 'text' in run ? run.style?.height : undefined;
    expect(height).toBe(exportedText('Α/Α').height);
    expect(height).not.toBe(2.5);
  });
});

// ── ΤΥΠΟΓΡΑΦΙΑ Φ2 ΒΗΜΑ 4: πλάγια · υπογράμμιση · γραμματοσειρά ────────────────

/**
 * 🔴 ADR-739 Φ.Ε/Φ2 βήμα 4 — **το ίδιο συμβόλαιο, για τα ΝΕΑ πεδία.**
 *
 * Τα βήματα 1-3 έκαναν τα `italic` / `underline` / `fontFamily` να επιλύονται και να
 * ζωγραφίζονται. Κανένα από τα τρία δεν έφτανε πουθενά στην εξαγωγή: ο `textPrimitive`
 * αντέγραφε **μόνο** το `bold` και το `NeutralTextOptions` δεν είχε καν πεδία. Δηλαδή
 * ακριβώς το σχήμα της Φ1, μια φάση αργότερα — γι' αυτό η απόφαση Α1 βάζει την εξαγωγή
 * **πριν** τα κουμπιά.
 *
 * Το σενάριο δηλώνει και τα τρία σε **παράκαμψη γραμμής** (το μοντέλο του βήματος 2), όχι σε
 * preset: έτσι ελέγχεται η ίδια διαδρομή που θα πατήσει ο χρήστης από το toolbar του βήματος 5.
 */
const TYPO_ROWS: TableRow[] = [
  { id: 'rh', rowClass: 'header', styleOverride: { italic: true, underline: true, fontFamily: 'Calibri' } },
  { id: 'rd', rowClass: 'data' },
];

function typoModel(): ReturnType<typeof createTableModel> {
  // Οι ΙΔΙΕΣ ακμές με το βασικό μοντέλο: η ομάδα της υπογράμμισης μετρά **διαφορά** γραμμών
  // ανάμεσα στα δύο, οπότε κάθε ακμή που υπάρχει μόνο στο ένα θα μετρούσε ως υπογράμμιση.
  return createTableModel({ columns: COLUMNS, rows: TYPO_ROWS, cells: CELLS, edges: EDGES });
}

const TYPO_ENTITY: TableEntity = {
  ...ENTITY, id: 'ent_typo', model: toPersistedTableModel(typoModel()),
} as TableEntity;

/** Ο συντελεστής sheet-mm → world του σεναρίου (κλίμακα σχεδίου — ένας αριθμός, δύο κλήσεις). */
const MM_TO_WORLD = 100;

const TYPO_LAYOUT = layoutTable(typoModel(), STANDARD);
const TYPO_EXPORTED: Entity[] = decomposeTable(TYPO_ENTITY, MM_TO_WORLD, 'mm');

const typoHeaderRun = () => {
  const cell = TYPO_LAYOUT.cells.find((c) => c.rowId === 'rh' && c.colId === 'c1');
  if (!cell?.text) throw new Error('η διάταξη δεν έβγαλε κείμενο κεφαλίδας');
  return cell.text;
};

function typoExportedText(content: string): TextEntity {
  const found = TYPO_EXPORTED.find(
    (e): e is TextEntity => e.type === 'text' && e.text === content,
  );
  if (!found) throw new Error(`δεν εξήχθη κείμενο «${content}»`);
  return found;
}

function firstRunStyle(e: TextEntity) {
  const run = e.textNode?.paragraphs[0]?.runs[0];
  return run && 'text' in run ? run.style : undefined;
}

describe('ADR-739 Φ2/4 — πλάγια και γραμματοσειρά κελιού → run της οντότητας', () => {
  it('η διάταξη ΟΝΤΩΣ διαφοροποιεί τις δύο γραμμές — αλλιώς το σενάριο δεν ελέγχει τίποτα', () => {
    expect(typoHeaderRun().italic).toBe(true);
    expect(typoHeaderRun().underline).toBe(true);
    expect(typoHeaderRun().fontFamily).toBe('Calibri');
  });

  it('τα ΠΛΑΓΙΑ ταξιδεύουν· τα δεδομένα μένουν όρθια', () => {
    expect(firstRunStyle(typoExportedText('Α/Α'))?.italic).toBe(true);
    expect(firstRunStyle(typoExportedText('1'))?.italic).toBe(false);
  });

  it('🔴 η ΓΡΑΜΜΑΤΟΣΕΙΡΑ ταξιδεύει — αλλιώς το χειριστήριο ρυθμίζει κάτι που δεν τυπώνεται', () => {
    expect(firstRunStyle(typoExportedText('Α/Α'))?.fontFamily).toBe('Calibri');
  });

  it('🔴 η υπογράμμιση ΔΕΝ διπλογράφεται στο run — έχει ήδη γίνει γεωμετρία', () => {
    // Ένα `underline: true` και στο AST θα ζωγραφιζόταν **δεύτερη φορά** από τον επόμενο
    // αναγνώστη του κόμβου, μισό χιλιοστό παραπέρα από τη γραμμή που μόλις παρήχθη.
    expect(firstRunStyle(typoExportedText('Α/Α'))?.underline).toBe(false);
  });
});

describe('ADR-739 Φ2/4 — η υπογράμμιση φτάνει ως ΓΡΑΜΜΗ, όχι ως κωδικός ελέγχου', () => {
  /** Οι γραμμές που ΔΕΝ υπάρχουν στον ίδιο πίνακα χωρίς υπογράμμιση = οι υπογραμμίσεις. */
  const underlines = () => {
    const plain = decomposeTable(
      { ...ENTITY, id: 'ent_typo' } as TableEntity, MM_TO_WORLD, 'mm',
    ).filter((e) => e.type === 'line').length;
    const all = TYPO_EXPORTED.filter((e): e is LineEntity => e.type === 'line');
    return { extra: all.length - plain, all };
  };

  it('γεννιούνται ΤΡΕΙΣ επιπλέον γραμμές — μία ανά υπογραμμισμένο κελί κεφαλίδας', () => {
    expect(underlines().extra).toBe(3);
  });

  it('🔴 ΚΑΝΕΝΑ %%u στο εξαγόμενο κείμενο — ο δικός μας importer δεν το αποκωδικοποιεί', () => {
    for (const e of TYPO_EXPORTED) {
      if (e.type === 'text') expect((e as TextEntity).text).not.toContain('%%');
    }
  });

  it('🔴 η γραμμή κάθεται ΚΑΤΩ από τη γραμμή βάσης, στο χρώμα του κειμένου', () => {
    const run = typoHeaderRun();
    const g = tableUnderlineGeometry(run.heightMm, run.advanceMm, run.hAlign);
    expect(g.y).toBeGreaterThan(0);
    // Στον κόσμο ο άξονας y δείχνει **πάνω** (το φύλλο είναι y-κάτω), οπότε «κάτω από τη
    // βάση» σημαίνει μικρότερο world y από το κείμενο του ίδιου κελιού.
    const textY = typoExportedText('Α/Α').position.y;
    // ⚠️ Η ανοχή είναι σε **world units**, όχι σε mm: το `decomposeTable` κλιμακώνει με το
    // `mmToWorld` της κλίμακας σχεδίου. Ένα κατώφλι σε mm θα ήταν 100× πολύ μικρό εδώ.
    const toleranceWorld = run.heightMm * MM_TO_WORLD;
    const underline = underlines().all.find((l) => Math.abs(l.start.y - l.end.y) < 1e-9
      && l.start.y < textY && Math.abs(l.start.y - textY) < toleranceWorld);
    expect(underline).toBeDefined();
    expect(underline?.color).toBe(run.colorHex);
  });

  it('η γραμμή είναι ΟΡΙΖΟΝΤΙΑ και έχει το μετρημένο πλάτος του κειμένου', () => {
    const run = typoHeaderRun();
    const g = tableUnderlineGeometry(run.heightMm, run.advanceMm, run.hAlign);
    const found = underlines().all.find(
      (l) => Math.abs(Math.abs(l.end.x - l.start.x) - g.width * MM_TO_WORLD) < 1e-6,
    );
    expect(found).toBeDefined();
    expect(found?.start.y).toBeCloseTo(found?.end.y ?? NaN, 9);
  });
});
