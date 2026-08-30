/**
 * ADR-739 Φάση Δ βήμα 1 — το **δίχτυ** του εργοστασίου νέου πίνακα.
 *
 * Τρία πράγματα ελέγχονται εδώ και κανένα δεν είναι διακοσμητικό:
 *
 * 1. **Το ταξίδι.** Ο `Map` γίνεται `{}` στο `JSON.stringify` **σιωπηλά** — χωρίς
 *    εξαίρεση, χωρίς προειδοποίηση. Οι δύο πρώτες ομάδες περνούν τον πίνακα από τα
 *    ΠΡΑΓΜΑΤΙΚΑ μονοπάτια της εφαρμογής (`JSON.parse(JSON.stringify())` = αποθήκευση /
 *    πρόχειρο / λανθάνουσα μνήμη ζωγραφικής, `deepClone` = undo) και μετρούν **τα κελιά
 *    ένα προς ένα**. Ένα «δεν έσκασε» δεν αποδεικνύει τίποτα: ο άδειος πίνακας δεν σκάει.
 *
 * 2. **Η κλίμακα.** Η γεωμετρία ελέγχεται σε **1:100**, όχι σε 1:1. Το §18.6 του ADR
 *    καταγράφει μετάλλαξη που επέζησε ακριβώς επειδή όλα τα tests έτρεχαν σε ουδέτερη
 *    κλίμακα, όπου ο πολλαπλασιαστής είναι 1 και η απουσία του αόρατη.
 *
 * 3. **preview ≡ commit.** Οι δύο διαδρομές συγκρίνονται με τα **πραγματικά** entry
 *    points (`createEntityFromTool` / `generatePreviewEntity`). Αν κάποιος αντιγράψει το
 *    mapping σε δεύτερο σημείο (N.18), η ομάδα 4 σπάει.
 */

import {
  DEFAULT_TABLE_COLUMN_COUNT,
  DEFAULT_TABLE_COLUMN_WIDTH_MM,
  DEFAULT_TABLE_DATA_ROW_COUNT,
  MAX_TABLE_COLUMN_COUNT,
  MAX_TABLE_COLUMN_WIDTH_MM,
  MAX_TABLE_DATA_ROW_COUNT,
  buildTableEntity,
  buildTableModel,
} from '../build-table-entity';
import type { BuildTableOptions } from '../build-table-entity';
import { MIN_TABLE_COLUMN_WIDTH_MM } from '../../../types/table-entity';
import { resolveTableModel } from '../table-model-helpers';
import { computeTableEntityGeometry } from '../table-entity-geometry';
import { BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import { deepClone } from '@/lib/clone-utils';
import type { PersistedTableModel } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';
import {
  buildTableEntityFromLiveOptions,
  useTableOptionsStore,
} from '../../../state/table-options-store';
import { createEntityFromTool } from '../../../hooks/drawing/drawing-entity-builders';
import { generatePreviewEntity } from '../../../hooks/drawing/drawing-preview-generator';
import { activeTableModel } from '../table-worksheet-resolve';
import { worksheetsWithActiveModel } from '../table-worksheet-write';

const ORIGIN = { x: 1000, y: -250 };

function makeTable(): TableEntity {
  return buildTableEntity(ORIGIN, {}, 'tbl_test', 'lyr_test');
}

/**
 * Ο πίνακας **γράφεται** με κείμενο πριν ταξιδέψει.
 *
 * ⚠️ Χωρίς αυτό η ομάδα 2 θα ήταν **κενή τελετή**: από την 2026-08-04 ο νέος πίνακας
 * γεννιέται χωρίς κανένα κελί, και «0 κελιά πριν → 0 κελιά μετά» το επιβεβαιώνει εξίσου
 * καλά κι ένας `Map` που έγινε σιωπηλά `{}` στο `JSON.stringify` — δηλαδή ακριβώς το
 * σφάλμα που η ομάδα υπάρχει για να πιάσει. Το ταξίδι ρωτιέται μόνο με φορτίο.
 */
function withCells(entity: TableEntity): TableEntity {
  const cells: PersistedTableModel['cells'] = [
    ['r0', 'c0', { kind: 'text', value: 'ΠΙΝΑΚΑΣ' }],
    ['r1', 'c0', { kind: 'text', value: 'Α/Α' }],
    ['r1', 'c1', { kind: 'text', value: 'Περιγραφή' }],
    ['r1', 'c2', { kind: 'text', value: 'Ποσότητα' }],
  ];
  // ADR-833 Φάση 2 — τα κελιά μπαίνουν στο **ενεργό φύλλο**, μέσω του SSoT της γραφής.
  return {
    ...entity,
    worksheets: worksheetsWithActiveModel(entity, { ...activeTableModel(entity), cells }),
  };
}

/** Τα κελιά ως λεξικό «γραμμή/στήλη → κείμενο» — συγκρίσιμο πριν και μετά το ταξίδι. */
function cellTextMap(model: PersistedTableModel): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [rowId, colId, cell] of model.cells) {
    out[`${rowId}/${colId}`] = String(cell.value);
  }
  return out;
}

const EXPECTED_CELLS: Record<string, string> = {
  'r0/c0': 'ΠΙΝΑΚΑΣ',
  'r1/c0': 'Α/Α',
  'r1/c1': 'Περιγραφή',
  'r1/c2': 'Ποσότητα',
};

// ── 1. Το σχήμα του νέου πίνακα ─────────────────────────────────────────────

describe('ADR-739 Φ.Δ — σχήμα προεπιλεγμένου πίνακα', () => {
  it('5 γραμμές × 3 στήλες, ΚΑΝΕΝΑ σπαρμένο κελί', () => {
    const model = activeTableModel(makeTable());
    expect(model.rows).toHaveLength(1 + 1 + DEFAULT_TABLE_DATA_ROW_COUNT);
    expect(model.rows).toHaveLength(5);
    expect(model.columns).toHaveLength(DEFAULT_TABLE_COLUMN_COUNT);
    expect(model.cells).toHaveLength(0);
  });

  it('1 title + 1 header + 3 data — η σειρά της τεκμηρίωσης του ACAD_TABLE', () => {
    const model = activeTableModel(makeTable());
    expect(model.rows.map((r) => r.rowClass)).toEqual([
      'title', 'header', 'data', 'data', 'data',
    ]);
  });

  it('όλες οι στήλες fixed 40mm (sheet-mm — ποτέ hug σε κενό πίνακα)', () => {
    const model = activeTableModel(makeTable());
    for (const column of model.columns) {
      expect(column.sizing).toEqual({ kind: 'fixed', widthMm: DEFAULT_TABLE_COLUMN_WIDTH_MM });
    }
  });

  it('🔴 ΚΑΝΕΝΑ κείμενο — ο χρήστης γράφει τα δικά του δεδομένα, δεν σβήνει τα δικά μας', () => {
    // Ο πίνακας γεννιόταν με «ΠΙΝΑΚΑΣ» + «Α/Α · Περιγραφή · Ποσότητα». Σε σχεδιαστικό
    // καμβά αυτό δεν είναι διευκόλυνση: είναι εικασία για το τι πίνακα φτιάχνει ο χρήστης
    // (υπόμνημα; ποσότητες; καρτέλα έργου;) και δουλειά σβησίματος πριν την πρώτη εγγραφή.
    expect(cellTextMap(activeTableModel(makeTable()))).toEqual({});
  });

  it('🔴 ΚΑΜΙΑ συγχώνευση — η ζώνη τίτλου είναι πράξη του χρήστη, όχι δώρο', () => {
    expect(activeTableModel(makeTable()).merges).toEqual([]);
  });

  it('το κλικ είναι η πάνω-αριστερή γωνία, όρθιος, με το built-in standard στυλ', () => {
    const entity = makeTable();
    expect(entity.position).toEqual(ORIGIN);
    expect(entity.angleRad).toBe(0);
    expect(entity.styleId).toBe(BUILTIN_TABLE_STYLE_IDS.STANDARD);
    expect(entity.type).toBe('table');
  });

  it('το geometry ΔΕΝ γράφεται από τον builder (είναι παράγωγο)', () => {
    expect(makeTable().geometry).toBeUndefined();
  });

  it('τα κελιά είναι ακολουθία, ΟΧΙ Map (το θεμέλιο της Λύσης Α)', () => {
    const model = activeTableModel(makeTable());
    expect(Array.isArray(model.cells)).toBe(true);
    expect(model.cells instanceof Map).toBe(false);
  });
});

// ── 2. Το ταξίδι — τα πέντε γενικά μονοπάτια της εφαρμογής ──────────────────

describe('ADR-739 Φ.Δ — ο πίνακας επιβιώνει το ταξίδι', () => {
  it('JSON round-trip (αποθήκευση / πρόχειρο / λανθάνουσα μνήμη): ΟΛΑ τα κελιά', () => {
    const entity = withCells(makeTable());
    const revived: TableEntity = JSON.parse(JSON.stringify(entity));
    expect(activeTableModel(revived).cells).toHaveLength(4);
    expect(cellTextMap(activeTableModel(revived))).toEqual(EXPECTED_CELLS);
    expect(activeTableModel(revived).rows).toHaveLength(5);
    expect(activeTableModel(revived).columns).toHaveLength(3);
  });

  it('deepClone (το μονοπάτι του undo): ΟΛΑ τα κελιά', () => {
    const cloned = deepClone(withCells(makeTable()));
    expect(activeTableModel(cloned).cells).toHaveLength(4);
    expect(cellTextMap(activeTableModel(cloned))).toEqual(EXPECTED_CELLS);
  });

  it('μετά το ταξίδι το μοντέλο ξαναγίνεται δουλεύσιμος Map με τα ίδια κελιά', () => {
    const revived: TableEntity = JSON.parse(JSON.stringify(withCells(makeTable())));
    const resolved = resolveTableModel(activeTableModel(revived));
    // Ο αριθμός των κελιών του χάρτη είναι το σημείο όπου ένα `{}` θα φαινόταν ως 0.
    expect(resolved.cells.size).toBe(4);
    expect(resolved.rows).toHaveLength(5);
  });

  it('η γεωμετρία υπολογίζεται ΤΑ ΙΔΙΑ πριν και μετά το ταξίδι', () => {
    const before = computeTableEntityGeometry(makeTable(), 100, 'mm');
    const after = computeTableEntityGeometry(
      JSON.parse(JSON.stringify(makeTable())),
      100,
      'mm',
    );
    expect(after.worldWidth).toBeCloseTo(before.worldWidth, 9);
    expect(after.worldHeight).toBeCloseTo(before.worldHeight, 9);
  });
});

// ── 3. Η κλίμακα — 1:100, ΠΟΤΕ 1:1 (παγίδα §18.6) ──────────────────────────

describe('ADR-739 Φ.Δ — γεωμετρία σε κλίμακα 1:100', () => {
  it('120mm × 40mm χαρτί → 12000 × 4000 μονάδες σκηνής στο 1:100', () => {
    const geometry = computeTableEntityGeometry(makeTable(), 100, 'mm');
    // 3 στήλες × 40mm = 120mm· 5 γραμμές × 8mm (defaultRowHeightMm του `standard`) = 40mm.
    expect(geometry.layout.widthMm).toBeCloseTo(120, 9);
    expect(geometry.layout.heightMm).toBeCloseTo(40, 9);
    expect(geometry.mmToWorld).toBeCloseTo(100, 9);
    expect(geometry.worldWidth).toBeCloseTo(12000, 6);
    expect(geometry.worldHeight).toBeCloseTo(4000, 6);
  });

  it('η άγκυρα είναι η ΠΑΝΩ-αριστερή γωνία: το σώμα πέφτει προς τα κάτω-δεξιά', () => {
    const geometry = computeTableEntityGeometry(makeTable(), 100, 'mm');
    const [tl, tr, br, bl] = geometry.worldCorners;
    expect(tl).toEqual(ORIGIN);
    expect(tr.x).toBeCloseTo(ORIGIN.x + 12000, 6);
    expect(br.y).toBeCloseTo(ORIGIN.y - 4000, 6);
    expect(bl.x).toBeCloseTo(ORIGIN.x, 6);
    expect(geometry.bbox.maxY).toBeCloseTo(ORIGIN.y, 6);
  });

  it('1:50 δίνει ΤΟ ΜΙΣΟ από 1:100 — ο πίνακας είναι annotative', () => {
    const at100 = computeTableEntityGeometry(makeTable(), 100, 'mm');
    const at50 = computeTableEntityGeometry(makeTable(), 50, 'mm');
    expect(at50.worldWidth).toBeCloseTo(at100.worldWidth / 2, 6);
    expect(at50.layout.widthMm).toBeCloseTo(at100.layout.widthMm, 9); // το χαρτί δεν αλλάζει
  });
});

// ── 4. preview ≡ commit — ΕΝΑ mapping, όχι δύο ─────────────────────────────

describe('ADR-739 Φ.Δ — preview ≡ commit', () => {
  const commit = (): TableEntity =>
    createEntityFromTool('table', [{ ...ORIGIN }], 'tbl_commit', false) as TableEntity;

  const ghost = (): TableEntity =>
    generatePreviewEntity(
      'table',
      [],
      { ...ORIGIN },
      false,
      (tool, points) => createEntityFromTool(tool, points, 'unused', false),
    ) as unknown as TableEntity;

  it('και οι δύο διαδρομές παράγουν πίνακα στο ίδιο σημείο με το ίδιο στυλ', () => {
    const c = commit();
    const g = ghost();
    expect(c.type).toBe('table');
    expect(g.type).toBe('table');
    expect(g.position).toEqual(c.position);
    expect(g.angleRad).toBe(c.angleRad);
    expect(g.styleId).toBe(c.styleId);
  });

  it('ΤΟ ΙΔΙΟ αντικείμενο μοντέλου — απόδειξη ότι το mapping είναι ένα', () => {
    // Ταυτότητα, όχι ισότητα: είναι ΚΑΙ ο δείκτης ότι η μνήμη του μοντέλου κρατά, άρα η
    // διάταξη δεν ξαναϋπολογίζεται σε κάθε καρέ του φαντάσματος (§6 / ADR-735).
    expect(activeTableModel(ghost())).toBe(activeTableModel(commit()));
  });

  it('το φάντασμα είναι σημασμένο ως WYSIWYG preview, το commit όχι', () => {
    const g = ghost() as TableEntity & { preview?: boolean; wysiwygPreview?: boolean };
    expect(g.preview).toBe(true);
    expect(g.wysiwygPreview).toBe(true);
    expect((commit() as TableEntity & { preview?: boolean }).preview).toBeUndefined();
  });

  it('το εργαλείο ολοκληρώνεται με ΕΝΑ σημείο (κανένα σημείο ⇒ κανένας πίνακας)', () => {
    expect(createEntityFromTool('table', [], 'tbl_none', false)).toBeNull();
  });
});

// ── 5. Οι ζωντανές επιλογές ─────────────────────────────────────────────────

describe('ADR-739 Φ.Δ — ζωντανές επιλογές του εργαλείου', () => {
  const initial = useTableOptionsStore.getState();

  afterEach(() => {
    useTableOptionsStore.setState({
      columnCount: initial.columnCount,
      dataRowCount: initial.dataRowCount,
      columnWidthMm: initial.columnWidthMm,
    });
  });

  it('το store διαβάζεται τη στιγμή του κλικ (event-time, καμία συνδρομή)', () => {
    useTableOptionsStore.getState().setColumnCount(5);
    useTableOptionsStore.getState().setDataRowCount(10);
    const model = activeTableModel(buildTableEntityFromLiveOptions(ORIGIN, 'tbl_live', 'lyr_test'));
    expect(model.columns).toHaveLength(5);
    expect(model.rows).toHaveLength(12); // title + header + 10 data
  });

  it('πλατύτερος πίνακας μένει εξίσου κενός — το πλήθος στηλών δεν γεννά περιεχόμενο', () => {
    const model = activeTableModel(buildTableEntity(ORIGIN, { columnCount: 5 }, 'tbl_wide', 'lyr_test'));
    expect(model.columns).toHaveLength(5);
    expect(model.cells).toHaveLength(0);
    expect(model.merges).toHaveLength(0);
  });

  it('εκφυλισμένες επιλογές δεν παράγουν αόρατο πίνακα', () => {
    const model = activeTableModel(buildTableEntity(
      ORIGIN,
      { columnCount: 0, dataRowCount: -3, columnWidthMm: 0.001 },
      'tbl_degenerate',
      'lyr_test',
    ));
    expect(model.columns).toHaveLength(1);
    expect(model.rows).toHaveLength(2); // title + header, μηδέν δεδομένα
    expect(model.merges).toHaveLength(0);
    const width = model.columns[0].sizing;
    expect(width.kind === 'fixed' && width.widthMm >= 4).toBe(true);
  });

  it('ίδιο σχήμα ⇒ ΤΟ ΙΔΙΟ μοντέλο· άλλο σχήμα ⇒ άλλο (η μνήμη δεν κολλάει)', () => {
    expect(buildTableModel({})).toBe(buildTableModel({}));
    expect(buildTableModel({ columnCount: 4 })).not.toBe(buildTableModel({}));
  });
});

// ── 6. Το φράγμα — NaN, ±Infinity, άνω όρια ─────────────────────────────────
//
// Η ομάδα 5 δοκίμαζε 0 / -3 / 0.001 και περνούσε, δίνοντας ψεύτικη σιγουριά ότι το
// φράγμα ήταν πλήρες. Δεν ήταν: και τα τρία μεγέθη περνούσαν `NaN` και `±Infinity`
// άθικτα. Και το `NaN` δεν είναι εξωτικό — `parseFloat('')` **είναι** `NaN`, δηλαδή το
// κανονικό αποτέλεσμα ενός αριθμητικού πεδίου που ο χρήστης άδειασε με backspace.

describe('ADR-739 Φ.Δ — το φράγμα του σχήματος φράζει πραγματικά', () => {
  const initial = useTableOptionsStore.getState();

  afterEach(() => {
    useTableOptionsStore.setState({
      columnCount: initial.columnCount,
      dataRowCount: initial.dataRowCount,
      columnWidthMm: initial.columnWidthMm,
    });
  });

  const build = (opts: BuildTableOptions): TableEntity =>
    buildTableEntity(ORIGIN, opts, 'tbl_guard', 'lyr_test');

  const fixedWidth = (model: PersistedTableModel): number => {
    const sizing = model.columns[0].sizing;
    return sizing.kind === 'fixed' ? sizing.widthMm : Number.NaN;
  };

  it('NaN και στα τρία μεγέθη ⇒ ΠΡΟΕΠΙΛΟΓΗ (όχι μηδέν, ποτέ εξαίρεση)', () => {
    const model = activeTableModel(build({ columnCount: NaN, dataRowCount: NaN, columnWidthMm: NaN }));
    expect(model.columns).toHaveLength(DEFAULT_TABLE_COLUMN_COUNT);
    expect(model.rows).toHaveLength(2 + DEFAULT_TABLE_DATA_ROW_COUNT);
    expect(fixedWidth(model)).toBe(DEFAULT_TABLE_COLUMN_WIDTH_MM);
  });

  it('`columnCount: NaN` ΔΕΝ παράγει αόρατη οντότητα (`i < NaN` = ψευδές από την αρχή)', () => {
    expect(activeTableModel(build({ columnCount: NaN })).columns.length).toBeGreaterThan(0);
  });

  it('`columnCount: Infinity` ΔΕΝ γίνεται άπειρος βρόχος (πάγωμα καρτέλας + OOM)', () => {
    expect(activeTableModel(build({ columnCount: Number.POSITIVE_INFINITY })).columns)
      .toHaveLength(DEFAULT_TABLE_COLUMN_COUNT);
  }, 2000);

  it('`-Infinity` πέφτει κι αυτό στην προεπιλογή, όχι στο κάτω άκρο', () => {
    expect(activeTableModel(build({ dataRowCount: Number.NEGATIVE_INFINITY })).rows)
      .toHaveLength(2 + DEFAULT_TABLE_DATA_ROW_COUNT);
  });

  it('🔴 NaN πλάτος ΔΕΝ δηλητηριάζει τα όρια της σκηνής (το bounds-SSoT ΕΝΩΝΕΙ bboxes)', () => {
    // Ένα NaN bbox σε μία οντότητα μολύνει την ένωση, άρα zoom-extents και marquee
    // σπάνε ΚΑΘΟΛΙΚΑ — όχι μόνο πάνω στον πίνακα.
    const geometry = computeTableEntityGeometry(build({ columnWidthMm: NaN }), 100, 'mm');
    expect(Number.isFinite(geometry.layout.widthMm)).toBe(true);
    expect(Number.isFinite(geometry.worldWidth)).toBe(true);
    for (const corner of geometry.worldCorners) {
      expect(Number.isFinite(corner.x)).toBe(true);
      expect(Number.isFinite(corner.y)).toBe(true);
    }
    const { bbox } = geometry;
    for (const bound of [bbox.minX, bbox.minY, bbox.maxX, bbox.maxY]) {
      expect(Number.isFinite(bound)).toBe(true);
    }
  });

  it('τεράστια πλήθη κόβονται στο άνω όριο — «άπειρος βρόχος» και «500.000 στήλες» ταυτίζονται', () => {
    const model = activeTableModel(build({ columnCount: 500_000, dataRowCount: 999_999 }));
    expect(model.columns).toHaveLength(MAX_TABLE_COLUMN_COUNT);
    expect(model.rows).toHaveLength(2 + MAX_TABLE_DATA_ROW_COUNT);
  }, 10_000);

  it('τεράστιο πλάτος κόβεται στη μεγάλη πλευρά του A0', () => {
    expect(fixedWidth(activeTableModel(build({ columnWidthMm: 1e9 })))).toBe(MAX_TABLE_COLUMN_WIDTH_MM);
  });

  it('πεπερασμένες εκφυλισμένες τιμές ΚΟΒΟΝΤΑΙ στα άκρα (δεν πέφτουν σε προεπιλογή)', () => {
    const model = activeTableModel(build({ columnCount: 0, dataRowCount: -3, columnWidthMm: 0.001 }));
    expect(model.columns).toHaveLength(1);
    expect(model.rows).toHaveLength(2);
    expect(fixedWidth(model)).toBe(MIN_TABLE_COLUMN_WIDTH_MM);
  });

  it('🔴 το φράγμα ΔΕΝ παρακάμπτεται: οι setters του store καθαρίζουν κι αυτοί', () => {
    // Χωρίς αυτό, η ribbon θα έδειχνε `NaN` ενώ ο πίνακας θα γεννιόταν με 3 στήλες — UI
    // που λέει άλλα από όσα κάνει.
    const store = useTableOptionsStore.getState();
    store.setColumnCount(NaN);
    store.setColumnWidthMm(Number.POSITIVE_INFINITY);
    store.setDataRowCount(10_000);

    const state = useTableOptionsStore.getState();
    expect(state.columnCount).toBe(DEFAULT_TABLE_COLUMN_COUNT);
    expect(state.columnWidthMm).toBe(DEFAULT_TABLE_COLUMN_WIDTH_MM);
    expect(state.dataRowCount).toBe(MAX_TABLE_DATA_ROW_COUNT);
  });
});
