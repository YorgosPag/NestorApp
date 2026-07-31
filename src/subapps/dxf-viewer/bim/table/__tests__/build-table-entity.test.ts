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

// i18n: ο πίνακας γεννιέται με **παγωμένο** κείμενο σχεδίου — ο builder το επιλύει μία
// φορά. `language` υπάρχει γιατί μπαίνει στο κλειδί της μνήμης του μοντέλου.
jest.mock('@/i18n', () => ({
  i18n: {
    t: (key: string): string => {
      const map: Record<string, string> = {
        'table.defaults.title': 'ΠΙΝΑΚΑΣ',
        'table.defaults.columnNo': 'Α/Α',
        'table.defaults.columnDesc': 'Περιγραφή',
        'table.defaults.columnQty': 'Ποσότητα',
      };
      return map[key] ?? key;
    },
    language: 'el',
  },
}));

import {
  DEFAULT_TABLE_COLUMN_COUNT,
  DEFAULT_TABLE_COLUMN_WIDTH_MM,
  DEFAULT_TABLE_DATA_ROW_COUNT,
  buildTableEntity,
  buildTableModel,
} from '../build-table-entity';
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

const ORIGIN = { x: 1000, y: -250 };

function makeTable(): TableEntity {
  return buildTableEntity(ORIGIN, {}, 'tbl_test', 'lyr_test');
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
  it('5 γραμμές × 3 στήλες με 4 σπαρμένα κελιά', () => {
    const { model } = makeTable();
    expect(model.rows).toHaveLength(1 + 1 + DEFAULT_TABLE_DATA_ROW_COUNT);
    expect(model.rows).toHaveLength(5);
    expect(model.columns).toHaveLength(DEFAULT_TABLE_COLUMN_COUNT);
    expect(model.cells).toHaveLength(4);
  });

  it('1 title + 1 header + 3 data — η σειρά της τεκμηρίωσης του ACAD_TABLE', () => {
    const { model } = makeTable();
    expect(model.rows.map((r) => r.rowClass)).toEqual([
      'title', 'header', 'data', 'data', 'data',
    ]);
  });

  it('όλες οι στήλες fixed 40mm (sheet-mm — ποτέ hug σε κενό πίνακα)', () => {
    const { model } = makeTable();
    for (const column of model.columns) {
      expect(column.sizing).toEqual({ kind: 'fixed', widthMm: DEFAULT_TABLE_COLUMN_WIDTH_MM });
    }
  });

  it('τα σπαρμένα κελιά είναι ο τίτλος + οι 3 κεφαλίδες, στα σωστά κελιά', () => {
    expect(cellTextMap(makeTable().model)).toEqual(EXPECTED_CELLS);
  });

  it('ο τίτλος απλώνεται σε όλο το πλάτος (μία συγχώνευση)', () => {
    const { model } = makeTable();
    expect(model.merges).toEqual([
      { anchorRowId: 'r0', anchorColId: 'c0', rowSpan: 1, colSpan: 3 },
    ]);
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
    const { model } = makeTable();
    expect(Array.isArray(model.cells)).toBe(true);
    expect(model.cells instanceof Map).toBe(false);
  });
});

// ── 2. Το ταξίδι — τα πέντε γενικά μονοπάτια της εφαρμογής ──────────────────

describe('ADR-739 Φ.Δ — ο πίνακας επιβιώνει το ταξίδι', () => {
  it('JSON round-trip (αποθήκευση / πρόχειρο / λανθάνουσα μνήμη): ΟΛΑ τα κελιά', () => {
    const entity = makeTable();
    const revived: TableEntity = JSON.parse(JSON.stringify(entity));
    expect(revived.model.cells).toHaveLength(4);
    expect(cellTextMap(revived.model)).toEqual(EXPECTED_CELLS);
    expect(revived.model.rows).toHaveLength(5);
    expect(revived.model.columns).toHaveLength(3);
    expect(revived.model.merges).toHaveLength(1);
  });

  it('deepClone (το μονοπάτι του undo): ΟΛΑ τα κελιά', () => {
    const entity = makeTable();
    const cloned = deepClone(entity);
    expect(cloned.model.cells).toHaveLength(4);
    expect(cellTextMap(cloned.model)).toEqual(EXPECTED_CELLS);
  });

  it('μετά το ταξίδι το μοντέλο ξαναγίνεται δουλεύσιμος Map με τα ίδια κελιά', () => {
    const revived: TableEntity = JSON.parse(JSON.stringify(makeTable()));
    const resolved = resolveTableModel(revived.model);
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
    expect(ghost().model).toBe(commit().model);
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
    const { model } = buildTableEntityFromLiveOptions(ORIGIN, 'tbl_live', 'lyr_test');
    expect(model.columns).toHaveLength(5);
    expect(model.rows).toHaveLength(12); // title + header + 10 data
  });

  it('επιπλέον στήλες μένουν χωρίς κεφαλίδα (καμία εφευρετική «Στήλη 4»)', () => {
    const { model } = buildTableEntity(ORIGIN, { columnCount: 5 }, 'tbl_wide', 'lyr_test');
    expect(model.cells).toHaveLength(4);
    expect(model.merges[0].colSpan).toBe(5);
  });

  it('εκφυλισμένες επιλογές δεν παράγουν αόρατο πίνακα', () => {
    const { model } = buildTableEntity(
      ORIGIN,
      { columnCount: 0, dataRowCount: -3, columnWidthMm: 0.001 },
      'tbl_degenerate',
      'lyr_test',
    );
    expect(model.columns).toHaveLength(1);
    expect(model.rows).toHaveLength(2); // title + header, μηδέν δεδομένα
    expect(model.merges).toHaveLength(0); // μονόστηλος ⇒ καμία συγχώνευση
    const width = model.columns[0].sizing;
    expect(width.kind === 'fixed' && width.widthMm >= 4).toBe(true);
  });

  it('ίδιο σχήμα ⇒ ΤΟ ΙΔΙΟ μοντέλο· άλλο σχήμα ⇒ άλλο (η μνήμη δεν κολλάει)', () => {
    expect(buildTableModel({})).toBe(buildTableModel({}));
    expect(buildTableModel({ columnCount: 4 })).not.toBe(buildTableModel({}));
  });
});
