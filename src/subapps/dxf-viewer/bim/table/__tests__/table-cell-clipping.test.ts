/**
 * ADR-739 Φ.Δ βήμα 5 — 🔴 **ΤΟ TEST ΤΟΥ ΒΗΜΑΤΟΣ: ένας κανόνας, τέσσερα backends.**
 *
 * ## Τι αποδεικνύει και γιατί δεν αρκεί το unit test
 * Το `table-cell-overflow.test.ts` αποδεικνύει ότι ο **κανόνας** είναι σωστός. Δεν αποδεικνύει
 * ότι τον **βλέπουν όλοι**. Το επικίνδυνο σενάριο του βήματος δεν είναι «κόβει λάθος» — είναι
 * «κόβει στην οθόνη και **δεν** κόβει στο PDF»: μια απόκλιση που φαίνεται μόνο σε **τυπωμένο
 * χαρτί**, δηλαδή αφού φύγει το παραδοτέο.
 *
 * Εδώ τρέχουν και οι **τέσσερις** πραγματικοί δρόμοι, με τον **πραγματικό** μετρητή
 * (`measureTextAdvanceWorld` — καμία ένεση), και συγκρίνεται το ορατό κείμενο:
 * ```
 *   1. Οθόνη            stampTableText           → ctx.fillText
 *   2. Πρωτογενή σχήματα tableLayoutToPrimitives → DetailPrimitive('text')
 *   3. Εξαγωγή DXF/PDF   decomposeTable          → Entity('text')
 *   4. Φύλλο λεπτομερειών buildScheduleTable     → DetailPrimitive('text')
 * ```
 *
 * ## Η αρχιτεκτονική που κάνει την ισοτιμία ΔΟΜΗ και όχι σύμπτωση
 * Κανένα από τα τέσσερα δεν καλεί τον κανόνα. Και τα τέσσερα διαβάζουν το **ίδιο**
 * `TableCellLayout.text`, που γεννιέται μία φορά στο `placeText`. Αν κάποιος αύριο προσθέσει
 * πέμπτο backend, το κληρονομεί χωρίς να το ξέρει. Αυτό το αρχείο κλειδώνει την ιδιότητα:
 * αν κάποιος μετακινήσει την περικοπή **μέσα** σε έναν ζωγράφο, οι υπόλοιποι τρεις γίνονται
 * κόκκινοι αμέσως.
 *
 * @see bim/table/table-cell-overflow.ts — ο κανόνας
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §23
 */

import { layoutTable } from '../table-layout';
import { tableLayoutToPrimitives } from '../table-layout-to-primitives';
import {
  createTableModel,
  getPersistedCellText,
  toPersistedTableModel,
} from '../table-model-helpers';
import { CELL_CLIP_ELLIPSIS, CELL_CLIP_NUMERIC_FILL } from '../table-cell-overflow';
import { BUILTIN_TABLE_STYLES, BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import type { TableStyle } from '../table-style';
import { decomposeTable } from '../../../export/core/table-to-primitives';
import { buildScheduleTable } from '../../structural/detail-sheet/detail-sheet-schedule-table';
import {
  createPaintLog,
  createRc,
} from '../../../rendering/entities/table/__tests__/table-paint-recorder';
import { stampTableText } from '../../../rendering/entities/table/stamp-table-layout';
import type { TableCell, TableColumn, TableRow } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';

// ── Το σενάριο ──────────────────────────────────────────────────────────────

/** Πολύ μακρύ για στήλη 20mm σε **κάθε** βαθμίδα μέτρησης — το σενάριο πρέπει να κόβει πάντα. */
const LONG_TEXT = 'ΠΕΡΙΓΡΑΦΗ ΕΡΓΑΣΙΑΣ ΠΟΛΥ ΜΑΚΡΙΑ ΓΙΑ ΤΟ ΚΕΛΙ ΤΗΣ';
const NARROW_COLUMN_MM = 20;

function styleById(id: string): TableStyle {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === id);
  if (!style) throw new Error(`missing preset: ${id}`);
  return style;
}

const STANDARD = styleById(BUILTIN_TABLE_STYLE_IDS.STANDARD);

const COLUMN: TableColumn = {
  id: 'c1',
  sizing: { kind: 'fixed', widthMm: NARROW_COLUMN_MM },
  valueType: 'text',
  align: 'left',
};
const ROW: TableRow = { id: 'r1', rowClass: 'data' };

function modelWith(cell: TableCell): ReturnType<typeof createTableModel> {
  return createTableModel({ columns: [COLUMN], rows: [ROW], cells: [['r1', 'c1', cell]] });
}

/** Οντότητα σκηνής με το ίδιο μοντέλο — η είσοδος του backend #3. */
function entityWith(cell: TableCell): TableEntity {
  return {
    id: 'ent_clip_test',
    type: 'table',
    layerId: 'lyr_test',
    position: { x: 0, y: 0 },
    angleRad: 0,
    styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
    model: toPersistedTableModel(modelWith(cell)),
  };
}

// ── Οι τέσσερις αναγνώσεις ──────────────────────────────────────────────────

/** #1 — ό,τι έφτασε πραγματικά στο `ctx.fillText`. */
function screenText(cell: TableCell): string {
  const log = createPaintLog();
  stampTableText(createRc(log), layoutTable(modelWith(cell), STANDARD).cells);
  return log.texts.map((t) => t.text).join('');
}

/** #2 — το πρωτογενές σχήμα κειμένου (σκηνή / PDF preview). */
function primitiveText(cell: TableCell): string {
  return tableLayoutToPrimitives(layoutTable(modelWith(cell), STANDARD))
    .filter((p) => p.kind === 'text')
    .map((p) => (p.kind === 'text' ? p.text : ''))
    .join('');
}

/** #3 — η οντότητα κειμένου που θα γραφτεί σε DXF/PDF. */
function exportedText(cell: TableCell): string {
  return decomposeTable(entityWith(cell), 100, 'mm')
    .filter((e) => e.type === 'text')
    .map((e) => (e.type === 'text' ? e.text : ''))
    .join('');
}

// ── Η ισοτιμία ──────────────────────────────────────────────────────────────

describe('ADR-739 Φ.Δ βήμα 5 — ένας κανόνας, τέσσερα backends', () => {
  const cell: TableCell = { kind: 'text', value: LONG_TEXT };

  it('🔴 οθόνη === πρωτογενή === εξαγωγή: ΤΟ ΙΔΙΟ ορατό κείμενο', () => {
    const screen = screenText(cell);
    expect(screen).toBe(primitiveText(cell));
    expect(screen).toBe(exportedText(cell));
  });

  it('🔴 και τα τρία ΟΝΤΩΣ κόβουν — η ισοτιμία δεν πρέπει να είναι «κανένα δεν κόβει»', () => {
    // Χωρίς αυτό, ο προηγούμενος έλεγχος θα ήταν πράσινος και ΠΡΙΝ το βήμα 5: τρία
    // πανομοιότυπα ξεχειλισμένα κείμενα είναι επίσης «ίδια».
    for (const read of [screenText, primitiveText, exportedText]) {
      const got = read(cell);
      expect(got).not.toBe(LONG_TEXT);
      expect(got.endsWith(CELL_CLIP_ELLIPSIS)).toBe(true);
      expect(LONG_TEXT.startsWith(got.slice(0, -1))).toBe(true);
    }
  });

  it('#4 φύλλο λεπτομερειών: το ίδιο περνά και από τον adapter του ADR-622', () => {
    // Ο τέταρτος δρόμος έχει δικό του στυλ και δικά του πλάτη — η κοινή απόδειξη είναι ότι
    // περνά από την ΙΔΙΑ μηχανή (`layoutTable`), άρα κόβει κι αυτός.
    const primitives = buildScheduleTable({
      region: { x: 0, y: 0, w: 30, h: 60 },
      columns: [{ frac: 0, align: 'left' }],
      header: [LONG_TEXT],
      rows: [],
      total: [],
    });
    const texts = primitives.filter((p) => p.kind === 'text').map((p) => (p.kind === 'text' ? p.text : ''));

    expect(texts).toHaveLength(1);
    expect(texts[0]).not.toBe(LONG_TEXT);
    expect(texts[0].endsWith(CELL_CLIP_ELLIPSIS)).toBe(true);
  });

  it('κείμενο που ΧΩΡΑΕΙ φτάνει ανέγγιχτο και στους τρεις — μηδέν παλινδρόμηση', () => {
    const short: TableCell = { kind: 'text', value: 'ΟΚ' };
    expect(screenText(short)).toBe('ΟΚ');
    expect(primitiveText(short)).toBe('ΟΚ');
    expect(exportedText(short)).toBe('ΟΚ');
  });

  it('αριθμός που δεν χωρά γίνεται «###» και στους τρεις — καμία διαδρομή δεν δείχνει ψηφία', () => {
    const big: TableCell = { kind: 'text', value: 123456789012345 };
    for (const read of [screenText, primitiveText, exportedText]) {
      const got = read(big);
      expect(got).toBe(CELL_CLIP_NUMERIC_FILL.repeat(got.length));
      expect(got.length).toBeGreaterThan(0);
    }
  });
});

// ── Το μοντέλο ─────────────────────────────────────────────────────────────

describe('ADR-739 Φ.Δ βήμα 5 — η περικοπή ΔΕΝ αγγίζει το μοντέλο', () => {
  const cell: TableCell = { kind: 'text', value: LONG_TEXT };

  it('🔴 το `TableCell.value` μένει ακέραιο μετά τη διάταξη', () => {
    const model = modelWith(cell);
    layoutTable(model, STANDARD);
    expect(model.cells.get([...model.cells.keys()][0])?.value).toBe(LONG_TEXT);
  });

  it('🔴 ο in-cell επεξεργαστής (`getPersistedCellText`) δείχνει το ΠΛΗΡΕΣ κείμενο', () => {
    // Η διαδρομή που θα σήμαινε **απώλεια δεδομένων του χρήστη** αν έσπαγε: `F2` πάνω σε
    // περικομμένο κελί, μετά `Tab` ⇒ θα αποθηκευόταν το κομμένο. Ο επεξεργαστής διαβάζει από
    // το μοντέλο και ΟΧΙ από τη διάταξη (`table-cell-edit-session.ts`) — εδώ κλειδώνεται.
    const entity = entityWith(cell);
    expect(getPersistedCellText(entity.model, 'r1', 'c1')).toBe(LONG_TEXT);
    // Και μετά από round-trip JSON (αποθήκευση σκηνής / undo), που είναι όπου θα φαινόταν.
    const reloaded: TableEntity = JSON.parse(JSON.stringify(entity));
    expect(getPersistedCellText(reloaded.model, 'r1', 'c1')).toBe(LONG_TEXT);
  });

  it('η εξαγωγή σε DXF περιέχει το ΚΟΜΜΕΝΟ κείμενο — αυτό ΕΙΝΑΙ το ζητούμενο', () => {
    // Ρητό, ώστε να μη «διορθωθεί» κάποτε: το DXF είναι **σχέδιο**, όχι βάση δεδομένων. Ό,τι
    // βλέπει ο μηχανικός στην οθόνη πρέπει να τυπωθεί· τα πλήρη δεδομένα ζουν στη σκηνή.
    expect(exportedText(cell)).not.toBe(LONG_TEXT);
  });
});
