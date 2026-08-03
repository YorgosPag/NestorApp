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
  TABLE_ROW_KIND,
  TABLE_MOVE_KIND,
  TABLE_ROTATION_KIND,
} from '../table-entity-grips';
import {
  computeTableEntityGeometry,
  tableFrameToWorld,
  tableWorldToFrame,
} from '../table-entity-geometry';
import { createTableModel, toPersistedTableModel } from '../table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import {
  MIN_TABLE_COLUMN_WIDTH_MM,
  MIN_TABLE_ROW_HEIGHT_MM,
} from '../../../types/table-entity';
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
  /** Πίνακας 60×16 στο (100,200): οι θέσεις παρακάτω είναι υπολογισμένες στο χέρι. */
  it('MOVE λίγο μέσα από την ΠΑ γωνία, ROTATION από την ΠΔ, 8 περιμετρικές, μία ανά όριο', () => {
    const grips = getTableGrips(makeEntity());
    // 2 (move+rotation) + 8 περιμετρικές + 1 όριο στηλών + 1 όριο γραμμών (Giorgio 2026-08-04).
    expect(grips).toHaveLength(12);
    expect(grips[0]).toMatchObject({
      position: { x: 106, y: 200 }, // εσοχή 6mm από την άγκυρα (x=100), ΠΑΝΩ στην ακμή
      movesEntity: true,
      gripKind: { on: 'table', kind: TABLE_MOVE_KIND },
    });
    expect(grips[1]).toMatchObject({
      position: { x: 154, y: 200 }, // εσοχή 6mm από τη δεξιά ακμή (x=160)
      gripKind: { on: 'table', kind: TABLE_ROTATION_KIND },
    });
    expect(grips[10]).toMatchObject({
      position: { x: 140, y: 200 }, // το όριο c1|c2 στα 40mm
      gripKind: { on: 'table', kind: TABLE_COLUMN_KIND },
    });
    expect(grips[11]).toMatchObject({
      // Το όριο r1|r2 στα 8mm κάτω από την πάνω ακμή, πάνω στην ΑΡΙΣΤΕΡΗ ακμή (u = 0).
      position: { x: 100, y: 192 },
      gripKind: { on: 'table', kind: TABLE_ROW_KIND },
    });
  });

  it('οι 4 γωνίες και τα 4 μέσα ακμών στις σωστές θέσεις, με τον σωστό τύπο λαβής', () => {
    const byKind = new Map(
      getTableGrips(makeEntity()).map((g) => [g.gripKind?.kind, g]),
    );
    // Ο πίνακας απλώνεται από (100,200) δεξιά 60mm και ΚΑΤΩ 16mm ⇒ y: 200 → 184.
    expect(byKind.get('table-corner-nw')?.position).toEqual({ x: 100, y: 200 }); // η ΑΓΚΥΡΑ
    expect(byKind.get('table-corner-ne')?.position).toEqual({ x: 160, y: 200 });
    expect(byKind.get('table-corner-se')?.position).toEqual({ x: 160, y: 184 });
    expect(byKind.get('table-corner-sw')?.position).toEqual({ x: 100, y: 184 });
    expect(byKind.get('table-edge-n')?.position).toEqual({ x: 130, y: 200 });
    expect(byKind.get('table-edge-e')?.position).toEqual({ x: 160, y: 192 });
    expect(byKind.get('table-edge-s')?.position).toEqual({ x: 130, y: 184 });
    expect(byKind.get('table-edge-w')?.position).toEqual({ x: 100, y: 192 });
    // Γωνίες = δομικές (επιβιώνουν τα grip-type toggles)· ακμές = midpoints (gated).
    expect(byKind.get('table-corner-ne')?.type).toBe('corner');
    expect(byKind.get('table-edge-n')?.type).toBe('midpoint');
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
    // 500 γραμμές ⇒ ΑΚΟΜΑ 11 λαβές. Με λαβές γραμμής θα ήταν 511, ζωγραφισμένες και
    // hit-tested σε ΚΑΘΕ καρέ — το σχήμα «δουλειά ανάλογη των δεδομένων» του ADR-735.
    // Οι 8 περιμετρικές είναι ΣΤΑΘΕΡΕΣ: κλιμακώνουν όλα τα ύψη, δεν τα απαριθμούν.
    expect(getTableGrips(manyRows)).toHaveLength(11);
  });

  it('άδειος πίνακας ⇒ ΜΟΝΟ η λαβή μετακίνησης (τίποτα να περιστραφεί ή να διασταλεί)', () => {
    const empty = makeEntity({ model: persistedModel({ columns: [], rows: [] }) });
    const grips = getTableGrips(empty);
    expect(grips).toHaveLength(1);
    // Χωρίς κουτί, ο σταυρός επιστρέφει στην ΑΓΚΥΡΑ — δεν υπάρχει «¼ του μηδενός».
    expect(grips[0]).toMatchObject({ position: { x: 100, y: 200 }, movesEntity: true });
  });

  /**
   * 🔴 Η ΥΠΟΘΕΣΗ ΠΟΥ ΠΡΟΣΤΑΤΕΥΕΙ ΤΟ §27.11.
   *
   * Οι ζώνες του δείκτη ζουν σε **αρνητικά** mm (`v < 0` τα γράμματα, `u < 0` οι αριθμοί) και
   * η οπή που τις κρατά μακριά από τις λαβές είναι σχεδιασμένη γι' αυτό ακριβώς. Λαβή που θα
   * γεννιόταν σε αρνητικό `u`/`v` θα ζωγραφιζόταν **μέσα** στη ζώνη και το ίδιο pixel θα
   * απαντούσε σε δύο ερωτήσεις — το ελάττωμα που το §27.11 έκλεισε με κόπο.
   */
  it('🔴 ΚΑΜΙΑ λαβή δεν μπαίνει στον χώρο των ζωνών του δείκτη (u ≥ 0 και v ≥ 0)', () => {
    const entity = makeEntity();
    const geo = computeTableEntityGeometry(entity, 1, 'mm');
    const frames = getTableGrips(entity).map((g) =>
      tableWorldToFrame(entity, g.position, geo.mmToWorld),
    );
    expect(frames).toHaveLength(12);
    for (const { u, v } of frames) {
      expect(u).toBeGreaterThanOrEqual(-1e-9);
      expect(v).toBeGreaterThanOrEqual(-1e-9);
    }
  });

  /**
   * 🔴 Η ΠΕΡΙΠΤΩΣΗ ΠΟΥ ΟΔΗΓΗΣΕ ΣΤΗ ΣΗΜΕΡΙΝΗ ΤΟΠΟΘΕΤΗΣΗ.
   *
   * Οι λαβές ορίων στηλών μοιράζονται την πάνω ακμή με τον σταυρό, το τόξο και τη
   * μεσοπλευρική — αλλά κάθονται όπου λένε τα **δεδομένα**. Όσο ο σταυρός/τόξο ήταν
   * **κλάσματα** του πλάτους (¼ και ¾), 4 ισοπλατείς στήλες τα έριχναν και τα τρία πάνω σε
   * όριο ταυτόχρονα. Η **σταθερή εσοχή από τις γωνίες** το λύνει: η εσοχή δεν ακολουθεί τα
   * δεδομένα, άρα δεν μπορεί να τα «κυνηγήσει».
   *
   * Ό,τι **μένει** γνωστό: η `table-edge-n` κάθεται εξ ορισμού στο μέσο, άρα σε **ζυγό**
   * πλήθος ισοπλατών στηλών συμπίπτει με το μεσαίο όριο. Καρφώνεται εδώ ρητά, ώστε να είναι
   * ορατό αντί για έκπληξη.
   */
  it('🔴 με 4 ισοπλατείς στήλες σταυρός/τόξο ΔΕΝ συμπίπτουν με όριο — μόνο το μέσο', () => {
    const four = makeEntity({
      model: persistedModel({
        columns: Array.from({ length: 4 }, (_, i) => ({
          id: `c${i}`, sizing: { kind: 'fixed' as const, widthMm: 15 },
          valueType: 'text' as const, align: 'left' as const,
        })),
        rows: ROWS,
      }),
    });
    const grips = getTableGrips(four);
    const at = (kind: string) => grips.find((g) => g.gripKind?.kind === kind)!.position.x;
    const edges = grips.filter((g) => g.gripKind?.kind === TABLE_COLUMN_KIND).map((g) => g.position.x);

    expect(edges).toEqual([115, 130, 145]); // 15 / 30 / 45 mm από την άγκυρα στο x=100
    expect(at(TABLE_MOVE_KIND)).toBe(106);     // εσοχή 6mm — ΜΑΚΡΙΑ από το όριο στο 115
    expect(at(TABLE_ROTATION_KIND)).toBe(154); // εσοχή 6mm — ΜΑΚΡΙΑ από το όριο στο 145
    expect(at('table-edge-n')).toBe(130);      // ΓΝΩΣΤΗ σύμπτωση: το μέσο ΕΙΝΑΙ όριο εδώ
  });

  it('ΣΤΕΝΟΣ πίνακας: η εσοχή φράσσεται ώστε σταυρός και τόξο να μη διασταυρωθούν', () => {
    // Πλάτος 16mm ⇒ η εσοχή των 6mm θα έβαζε τον σταυρό στο 6 και το τόξο στο 10, δηλαδή
    // ΚΑΙ ΤΑ ΔΥΟ πέρα από το μέσο (8) όπου κάθεται η μεσοπλευρική. Το φράγμα στο ¼ τα
    // κρατά στο 4 και στο 12 — ένα σε κάθε μισό, όπως ορίζει η γεωμετρία τους.
    const narrow = makeEntity({
      model: persistedModel({
        columns: [{ id: 'c1', sizing: { kind: 'fixed', widthMm: 16 }, valueType: 'text', align: 'left' }],
        rows: ROWS,
      }),
    });
    const grips = getTableGrips(narrow);
    const at = (kind: string) => grips.find((g) => g.gripKind?.kind === kind)!.position.x;

    expect(at(TABLE_MOVE_KIND)).toBe(104);     // 100 + 16/4
    expect(at(TABLE_ROTATION_KIND)).toBe(112); // 116 − 16/4
    expect(at('table-edge-n')).toBe(108);      // το μέσο, ανάμεσά τους
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

// ── Οι 8 περιμετρικές λαβές (ADR-739 Φ.Γ, Giorgio 2026-08-03) ────────────────

describe('applyTableGripDrag — λαβές κουτιού (γωνίες + μέσα ακμών)', () => {
  /** Το σύνολο πλάτους/ύψους που προκύπτει από ένα patch — ό,τι θα ζωγραφιστεί πραγματικά. */
  const sizeOf = (e: TableEntity, patch: Partial<TableEntity>) => {
    const next = { ...e, ...patch };
    const { layout } = computeTableEntityGeometry(next, 1, 'mm');
    return { widthMm: layout.widthMm, heightMm: layout.heightMm };
  };

  /**
   * 🔴 Η ΙΔΙΟΤΗΤΑ ΠΟΥ ΟΡΙΖΕΙ ΤΗ ΓΩΝΙΑΚΗ ΛΑΒΗ — όλα τα υπόλοιπα είναι αριθμητική γύρω της.
   * Αν η αντίθετη γωνία κουνιέται, ο πίνακας «γλιστράει» κάτω από τον κέρσορα και η λαβή
   * γίνεται αδύνατο να στοχευτεί.
   */
  it('🔴 γωνία: η ΑΝΤΙΘΕΤΗ γωνία μένει ακίνητη — και οι ΔΥΟ διαστάσεις αλλάζουν', () => {
    const e = makeEntity(); // 60 × 16 στο (100,200)· nw (η άγκυρα) = (100,200)
    const patch = applyTableGripDrag('table-corner-se', e, { x: 160, y: 184 }, { x: 12, y: -8 });

    expect(patch.position).toEqual({ x: 100, y: 200 }); // η αντίθετη γωνία ΔΕΝ κουνήθηκε
    expect(sizeOf(e, patch)).toEqual({ widthMm: 72, heightMm: 24 }); // ×1.2 και ×1.5
    // Η κλιμάκωση είναι ΑΝΑΛΟΓΙΚΗ, όχι «όλο στην τελευταία στήλη».
    expect(patch.model?.columns.map((c) => c.sizing)).toEqual([
      { kind: 'fixed', widthMm: 48 }, // 40 × 1.2
      { kind: 'fixed', widthMm: 24 }, // 20 × 1.2
    ]);
    expect(patch.model?.rows.map((r) => r.heightMm)).toEqual([12, 12]); // 8 × 1.5
  });

  it('γωνία ΠΑΝΩ-ΑΡΙΣΤΕΡΑ: μετακινεί την άγκυρα, κρατώντας ακίνητη την κάτω-δεξιά', () => {
    const e = makeEntity();
    const patch = applyTableGripDrag('table-corner-nw', e, { x: 100, y: 200 }, { x: -10, y: 4 });
    // Το κάτω-δεξιά (160, 184) πρέπει να μείνει: το νέο πλάτος 70 και ύψος 20 το επιβεβαιώνουν
    // μαζί με τη νέα άγκυρα (90, 204).
    expect(patch.position).toEqual({ x: 90, y: 204 });
    expect(sizeOf(e, patch)).toEqual({ widthMm: 70, heightMm: 20 });
  });

  it('🔴 μεσοπλευρική: ΜΟΝΟ μία διάσταση — η κάθετη συνιστώσα αγνοείται εντελώς', () => {
    const e = makeEntity();
    const patch = applyTableGripDrag('table-edge-e', e, { x: 160, y: 192 }, { x: 12, y: 999 });

    expect(patch.position).toEqual({ x: 100, y: 200 }); // η αντίθετη (δυτική) ακμή κρατά
    expect(sizeOf(e, patch)).toEqual({ widthMm: 72, heightMm: 16 }); // ύψος ΑΘΙΚΤΟ
    // ΚΑΙ, κρίσιμο: οι γραμμές δεν αποκτούν καν ρητό ύψος — δεν τις άγγιξε κανείς.
    expect(patch.model?.rows).toEqual(e.model.rows);
  });

  it('μεσοπλευρική κάτω: αλλάζει μόνο το ύψος, οι στήλες μένουν ως έχουν', () => {
    const e = makeEntity();
    const patch = applyTableGripDrag('table-edge-s', e, { x: 130, y: 184 }, { x: 999, y: -8 });

    expect(sizeOf(e, patch)).toEqual({ widthMm: 60, heightMm: 24 });
    expect(patch.model?.columns).toEqual(e.model.columns);
  });

  /**
   * 🔴 Ο ΛΟΓΟΣ ΠΛΕΥΡΩΝ ΕΙΝΑΙ ΑΝΤΙΣΤΡΟΦΑ ΑΠΟ ΤΗΝ ΕΙΚΟΝΑ — και είναι απόφαση, όχι λάθος:
   * ο πίνακας είναι Excel/AutoCAD (ελεύθερος), η εικόνα φωτογραφία (κλειδωμένη).
   */
  it('🔴 Shift ΚΛΕΙΔΩΝΕΙ τον λόγο πλευρών· χωρίς Shift είναι ελεύθερος', () => {
    const e = makeEntity();
    const drag = { x: 12, y: 0 }; // καθαρά οριζόντιο σύρσιμο γωνίας

    const free = applyTableGripDrag('table-corner-se', e, { x: 160, y: 184 }, drag);
    expect(sizeOf(e, free)).toEqual({ widthMm: 72, heightMm: 16 }); // ύψος ΑΜΕΤΑΒΛΗΤΟ

    const locked = applyTableGripDrag('table-corner-se', e, { x: 160, y: 184 }, drag, undefined, true);
    const size = sizeOf(e, locked);
    expect(size.widthMm).toBeCloseTo(72);
    expect(size.heightMm).toBeCloseTo(19.2); // 16 × 1.2 — ο λόγος 60:16 διατηρήθηκε
  });

  it('συρρίκνωση: ΚΑΜΙΑ στήλη/γραμμή δεν πέφτει κάτω από το ελάχιστό της', () => {
    const e = makeEntity();
    const patch = applyTableGripDrag('table-corner-se', e, { x: 160, y: 184 }, { x: -500, y: 500 });

    for (const col of patch.model!.columns) {
      expect(col.sizing).toMatchObject({ kind: 'fixed' });
      expect((col.sizing as { widthMm: number }).widthMm)
        .toBeGreaterThanOrEqual(MIN_TABLE_COLUMN_WIDTH_MM);
    }
    for (const row of patch.model!.rows) {
      expect(row.heightMm).toBeGreaterThanOrEqual(MIN_TABLE_ROW_HEIGHT_MM);
    }
  });

  it('ΣΤΡΑΜΜΕΝΟΣ πίνακας: το σύρσιμο μετριέται στο πλαίσιο, όχι στην οθόνη', () => {
    const e = makeEntity({ angleRad: Math.PI / 2 });
    // Στις 90° ο άξονας +u της σελίδας δείχνει +y στη σκηνή ⇒ «12mm δεξιά στο χαρτί» = (0, 12).
    const patch = applyTableGripDrag('table-edge-e', e, { x: 100, y: 260 }, { x: 0, y: 12 });
    expect(sizeOf(e, patch)).toEqual({ widthMm: 72, heightMm: 16 });
  });

  it('η κλιμάκωση δίνει ΡΗΤΟ ύψος και σε γραμμή που το κληρονομούσε από την κλάση της', () => {
    // `heightMm` απόν ⇒ το ύψος έρχεται από το στυλ· η κλιμάκωση πρέπει να ξεκινά από την
    // ΕΠΙΛΥΜΕΝΗ τιμή της διάταξης, αλλιώς θα πολλαπλασίαζε το `undefined`.
    const e = makeEntity({
      model: persistedModel({
        columns: COLUMNS,
        rows: [{ id: 'r1', rowClass: 'data' }, { id: 'r2', rowClass: 'data' }],
      }),
    });
    const before = computeTableEntityGeometry(e, 1, 'mm').layout.heightMm;
    const patch = applyTableGripDrag('table-edge-s', e, { x: 130, y: 200 - before }, { x: 0, y: -before });

    expect(e.model.rows[0].heightMm).toBeUndefined(); // η αφετηρία ήταν όντως κληρονομημένη
    for (const row of patch.model!.rows) expect(row.heightMm).toBeGreaterThan(0);
    expect(sizeOf(e, patch).heightMm).toBeCloseTo(before * 2);
  });
});
