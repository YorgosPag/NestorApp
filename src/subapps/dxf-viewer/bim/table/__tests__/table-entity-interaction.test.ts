/**
 * ADR-739 Φάση Γ — hit-test, λαβές και σύρσιμο λαβών του `TableEntity`.
 *
 * Το ίδιο δίχτυ που έπιασε το σφάλμα των 1,5mm στη Φ.Β, στραμμένο εκεί όπου η Φ.Γ έχει το
 * ίδιο ρίσκο: **μια μετατοπισμένη γεωμετρία δείχνει σωστή και πιάνεται λάθος**. Κάθε
 * αριθμός παρακάτω είναι υπολογισμένος στο χέρι, όχι διαβασμένος από την υλοποίηση.
 *
 * Οι στήλες είναι `fixed` και τα κελιά κενά ώστε η διάταξη να μην καλεί τον πραγματικό
 * μετρητή κειμένου (βλ. `table-entity-geometry.test.ts`).
 */

import { hitTestTable, calculateTableBounds } from '../table-entity-hit';
import {
  applyTableGripDrag,
  getTableGrips,
  TABLE_COLUMN_KIND,
  TABLE_MOVE_KIND,
  TABLE_ROTATION_KIND,
} from '../table-entity-grips';
import { computeTableEntityGeometry, tableFrameToWorld } from '../table-entity-geometry';
import { createTableModel, toPersistedTableModel } from '../table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import { MIN_TABLE_COLUMN_WIDTH_MM } from '../../../types/table-entity';
import { useDrawingScaleStore } from '../../../state/drawing-scale-store';
import type { TableColumn, TableRow } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';

/**
 * ⚠️ Ο πίνακας είναι **annotative**: hit-test, όρια και λαβές διαβάζουν τη ΖΩΝΤΑΝΗ κλίμακα
 * σχεδίασης, της οποίας η προεπιλογή είναι **1:100** (`DEFAULT_DRAWING_SCALE`). Καρφώνουμε
 * το 1:1 εδώ ώστε τα νούμερα να είναι αναγνώσιμα· ότι η κλίμακα **πράγματι** διαπερνά τη
 * γεωμετρία το αποδεικνύει ξεχωριστό test παρακάτω, όχι η σιωπή.
 */
beforeEach(() => {
  useDrawingScaleStore.setState({ drawingScale: 1 });
});

const COLUMNS: TableColumn[] = [
  { id: 'c1', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' },
  { id: 'c2', sizing: { kind: 'fixed', widthMm: 20 }, valueType: 'text', align: 'left' },
];
const ROWS: TableRow[] = [
  { id: 'r1', rowClass: 'header', heightMm: 8 },
  { id: 'r2', rowClass: 'data', heightMm: 8 },
];

/**
 * Το `model` της οντότητας ταξιδεύει ως **απλό JSON** (Φ.Δ Λύση Α) — εδώ περνά από την
 * πραγματική μετάφραση, ώστε τα tests να μιλούν την ίδια γλώσσα με το save/undo.
 */
const persistedModel = (input: Parameters<typeof createTableModel>[0]) =>
  toPersistedTableModel(createTableModel(input));

/** 60mm × 16mm στο (100, 200)· ο πίνακας απλώνεται δεξιά και **κάτω** (y: 200 → 184). */
function makeEntity(overrides: Partial<TableEntity> = {}): TableEntity {
  return {
    id: 'tbl_1',
    type: 'table',
    layerId: 'lyr_test',
    position: { x: 100, y: 200 },
    angleRad: 0,
    styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
    model: persistedModel({ columns: COLUMNS, rows: ROWS }),
    ...overrides,
  };
}

// ── Hit-test ────────────────────────────────────────────────────────────────

describe('hitTestTable — ΟΛΟ το ορθογώνιο πιάνει, όχι μόνο οι γραμμές', () => {
  it('σημείο στο κέντρο ⇒ hit (πίνακας χωρίς πλέγμα πρέπει να επιλέγεται)', () => {
    expect(hitTestTable(makeEntity(), { x: 130, y: 192 }, 0)).toBe(true);
  });

  it('η άγκυρα και η απέναντι γωνία είναι ΜΕΣΑ (κλειστό ορθογώνιο)', () => {
    const e = makeEntity();
    expect(hitTestTable(e, { x: 100, y: 200 }, 0)).toBe(true);
    expect(hitTestTable(e, { x: 160, y: 184 }, 0)).toBe(true);
  });

  it('έξω από κάθε πλευρά ⇒ miss', () => {
    const e = makeEntity();
    expect(hitTestTable(e, { x: 99, y: 192 }, 0)).toBe(false);   // αριστερά
    expect(hitTestTable(e, { x: 161, y: 192 }, 0)).toBe(false);  // δεξιά
    expect(hitTestTable(e, { x: 130, y: 201 }, 0)).toBe(false);  // πάνω
    expect(hitTestTable(e, { x: 130, y: 183 }, 0)).toBe(false);  // κάτω
  });

  it('η ανοχή διευρύνει το ορθογώνιο κατά ΑΚΡΙΒΩΣ όσο δηλώνεται', () => {
    const e = makeEntity();
    expect(hitTestTable(e, { x: 98, y: 192 }, 1.5)).toBe(false);
    expect(hitTestTable(e, { x: 98, y: 192 }, 2)).toBe(true);
  });

  it('η ανοχή είναι σε ΜΟΝΑΔΕΣ ΣΚΗΝΗΣ και μετατρέπεται σε sheet-mm (φαίνεται μόνο εκτός 1:1)', () => {
    // Σε 1:1 η μετατροπή είναι ταυτοτική, άρα το test από πάνω είναι **τυφλό** σε αυτήν —
    // μια μετάλλαξη που την αφαιρεί επιβίωνε. Σε 1:100, 1 sheet-mm = 100 μονάδες σκηνής:
    // ανοχή 100 δέχεται 100 μονάδες έξω, όχι 100 **χιλιοστά χαρτιού** (= 10.000 μονάδες).
    useDrawingScaleStore.setState({ drawingScale: 100 });
    const e = makeEntity();
    const outsideBy150 = { x: 100 - 150, y: 0 };
    expect(hitTestTable(e, outsideBy150, 100)).toBe(false);
    expect(hitTestTable(e, outsideBy150, 200)).toBe(true);
  });

  it('στραμμένος πίνακας: πιάνεται ΕΚΕΙ που ζωγραφίζεται, όχι στο κουτί του', () => {
    const e = makeEntity({ angleRad: Math.PI / 4 });
    const geo = computeTableEntityGeometry(e, 1, 'mm');
    // Κέντρο του πίνακα στο πλαίσιο = (30, 8) — μέσα, όποια κι αν είναι η γωνία.
    expect(hitTestTable(e, tableFrameToWorld(e, 30, 8, geo.mmToWorld), 0)).toBe(true);
    // Η πάνω-δεξιά γωνία του AABB είναι ΚΕΝΟ χαρτί όταν ο πίνακας είναι στραμμένος 45°.
    expect(hitTestTable(e, { x: geo.bbox.maxX, y: geo.bbox.maxY }, 0)).toBe(false);
  });

  it('άδειος πίνακας ⇒ ποτέ hit (καμία γραμμή, καμία στήλη)', () => {
    const empty = makeEntity({ model: persistedModel({ columns: [], rows: [] }) });
    expect(hitTestTable(empty, { x: 100, y: 200 }, 5)).toBe(false);
  });
});

describe('calculateTableBounds', () => {
  it('χωρίς περιστροφή = το ορθογώνιο, με το padding να προστίθεται και στις 4 πλευρές', () => {
    expect(calculateTableBounds(makeEntity(), 2)).toEqual({
      minX: 98, minY: 182, maxX: 162, maxY: 202,
    });
  });

  it('ANNOTATIVE: η κλίμακα σχεδίασης αλλάζει ΤΟ ΜΕΓΕΘΟΣ στη σκηνή, όχι μόνο τη ζωγραφική', () => {
    // Ο πίνακας είναι σημείωση: σε 1:100 καταλαμβάνει 100× τον χώρο που καταλαμβάνει σε 1:1.
    // Αν αυτό δεν διαπερνούσε τα όρια, το marquee θα «έπιανε» κενό χαρτί σε κάθε κλίμακα
    // εκτός της 1:1 — και το hover θα διαφωνούσε με ό,τι βλέπει ο χρήστης.
    useDrawingScaleStore.setState({ drawingScale: 100 });
    expect(calculateTableBounds(makeEntity(), 0)).toEqual({
      minX: 100, minY: -1400, maxX: 6100, maxY: 200,
    });
  });

  it('άδειος πίνακας ⇒ εκφυλισμένο κουτί ΣΤΗΝ ΑΓΚΥΡΑ, ποτέ null: μια οντότητα χωρίς', () => {
    // …γραμμές εξακολουθεί να υπάρχει και πρέπει να μπορεί να επιλεγεί και να σβηστεί.
    const empty = makeEntity({ model: persistedModel({ columns: [], rows: [] }) });
    expect(calculateTableBounds(empty, 0)).toEqual({
      minX: 100, minY: 200, maxX: 100, maxY: 200,
    });
  });
});

// ── Λαβές ───────────────────────────────────────────────────────────────────

describe('getTableGrips', () => {
  it('MOVE στην άγκυρα, ROTATION στο μέσο της πάνω ακμής, μία λαβή ανά ΕΣΩΤΕΡΙΚΟ όριο', () => {
    const grips = getTableGrips(makeEntity());
    expect(grips).toHaveLength(3); // move + rotation + 1 εσωτερικό όριο (2 στήλες)
    expect(grips[0]).toMatchObject({
      position: { x: 100, y: 200 },
      movesEntity: true,
      gripKind: { on: 'table', kind: TABLE_MOVE_KIND },
    });
    expect(grips[1]).toMatchObject({
      position: { x: 130, y: 200 }, // μέσο του πλάτους 60mm
      gripKind: { on: 'table', kind: TABLE_ROTATION_KIND },
    });
    expect(grips[2]).toMatchObject({
      position: { x: 140, y: 200 }, // το όριο c1|c2 στα 40mm
      gripKind: { on: 'table', kind: TABLE_COLUMN_KIND },
    });
  });

  it('ΤΟ ΚΡΙΣΙΜΟ: το πλήθος λαβών ΔΕΝ μεγαλώνει με τις γραμμές — μόνο με τις στήλες', () => {
    const manyRows = makeEntity({
      model: persistedModel({
        columns: COLUMNS,
        rows: Array.from({ length: 500 }, (_, i) => ({
          id: `r${i}`, rowClass: 'data' as const, heightMm: 8,
        })),
      }),
    });
    // 500 γραμμές ⇒ ΑΚΟΜΑ 3 λαβές. Με λαβές γραμμής θα ήταν 503, ζωγραφισμένες και
    // hit-tested σε ΚΑΘΕ καρέ — το σχήμα «δουλειά ανάλογη των δεδομένων» του ADR-735.
    expect(getTableGrips(manyRows)).toHaveLength(3);
  });

  it('άδειος πίνακας ⇒ ΜΟΝΟ η λαβή μετακίνησης (τίποτα να περιστραφεί ή να διασταλεί)', () => {
    const empty = makeEntity({ model: persistedModel({ columns: [], rows: [] }) });
    expect(getTableGrips(empty)).toHaveLength(1);
  });
});

// ── Σύρσιμο λαβών ───────────────────────────────────────────────────────────

describe('applyTableGripDrag', () => {
  it('move: μεταφέρει την άγκυρα, τίποτα άλλο', () => {
    const patch = applyTableGripDrag(
      TABLE_MOVE_KIND, makeEntity(), { x: 100, y: 200 }, { x: 5, y: -3 },
    );
    expect(patch).toEqual({ position: { x: 105, y: 197 } });
  });

  it('rotation: γράφει ΜΟΝΟ γωνία όταν δεν έχει επιλεγεί κέντρο', () => {
    const e = makeEntity();
    const patch = applyTableGripDrag(
      TABLE_ROTATION_KIND, e, { x: 130, y: 200 }, { x: 0, y: 30 },
    );
    expect(patch.position).toBeUndefined();
    expect(patch.angleRad).toBeGreaterThan(0);
  });

  it('όριο στήλης: η στήλη ΑΡΙΣΤΕΡΑ παίρνει ρητό πλάτος· οι υπόλοιπες μένουν άθικτες', () => {
    const e = makeEntity();
    const patch = applyTableGripDrag(
      TABLE_COLUMN_KIND, e, { x: 140, y: 200 }, { x: 10, y: 0 },
    );
    expect(patch.model?.columns[0].sizing).toEqual({ kind: 'fixed', widthMm: 50 });
    expect(patch.model?.columns[1].sizing).toEqual({ kind: 'fixed', widthMm: 20 });
  });

  it('όριο στήλης σε ΣΤΡΑΜΜΕΝΟ πίνακα: μετριέται στο πλαίσιο, όχι στην οθόνη', () => {
    const e = makeEntity({ angleRad: Math.PI / 2 });
    const geo = computeTableEntityGeometry(e, 1, 'mm');
    const edge = tableFrameToWorld(e, 40, 0, geo.mmToWorld);
    // Στις 90° ο άξονας +u της σελίδας δείχνει +y στη σκηνή, άρα «10mm δεξιά στο χαρτί»
    // = delta (0, +10) στη σκηνή. Ένας αφελής υπολογισμός σε x θα έδινε 40, όχι 50.
    const patch = applyTableGripDrag(TABLE_COLUMN_KIND, e, edge, { x: 0, y: 10 });
    expect(patch.model?.columns[0].sizing).toEqual({ kind: 'fixed', widthMm: 50 });
  });

  it('όριο στήλης: το σύρσιμο κάτω από το ελάχιστο κόβεται (στήλη μηδενικού πλάτους δεν είναι στήλη)', () => {
    const patch = applyTableGripDrag(
      TABLE_COLUMN_KIND, makeEntity(), { x: 140, y: 200 }, { x: -100, y: 0 },
    );
    expect(patch.model?.columns[0].sizing).toEqual({
      kind: 'fixed', widthMm: MIN_TABLE_COLUMN_WIDTH_MM,
    });
  });

  it('το σύρσιμο επιστρέφει ΝΕΟ αντικείμενο μοντέλου (η ταυτότητα ακυρώνει τη μνήμη διάταξης)', () => {
    const e = makeEntity();
    const patch = applyTableGripDrag(
      TABLE_COLUMN_KIND, e, { x: 140, y: 200 }, { x: 10, y: 0 },
    );
    expect(patch.model).not.toBe(e.model);
    expect(e.model.columns[0].sizing).toEqual({ kind: 'fixed', widthMm: 40 }); // αμετάβλητο
  });
});
