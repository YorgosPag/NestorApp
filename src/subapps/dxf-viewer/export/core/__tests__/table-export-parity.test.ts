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
import type { TableCell, TableColumn, TableRow } from '../../../types/table';
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
const ROWS: TableRow[] = [
  { id: 'rh', rowClass: 'header' },
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

function model(): ReturnType<typeof createTableModel> {
  return createTableModel({ columns: COLUMNS, rows: ROWS, cells: CELLS });
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
    // Το `standard` έχει ΔΥΟ πάχη: πλαίσιο 0,5mm και εσωτερικοί διαχωριστές 0,25mm. Αν ο
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
