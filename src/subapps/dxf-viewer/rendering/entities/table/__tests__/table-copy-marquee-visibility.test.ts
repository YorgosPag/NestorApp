/**
 * 🔴 ADR-739 §48 — **ΠΟΤΕ ΦΑΙΝΟΝΤΑΙ ΤΑ ΜΥΡΜΗΓΚΙΑ**: η προδιαγραφή, χωρίς καμβά.
 *
 * Ο ζωγράφος είναι ο **δεύτερος** φρουρός του marquee (ο πρώτος είναι ο παλμός), και ο μόνος
 * που μπορεί να απαντήσει «άλλαξε ο πίνακας;» — γιατί μόνο αυτός κρατά τη ζωντανή οντότητα σε
 * κάθε καρέ. Όλη η απόφαση ζει σε καθαρή συνάρτηση ώστε να ελέγχεται εδώ, χωρίς `ctx`.
 *
 * Το κρίσιμο test είναι το **δεύτερο**: «γράψιμο σε κελί σβήνει τα μυρμήγκια» (Excel parity)
 * υλοποιείται ως **σύγκριση αναφοράς μοντέλου**, δηλαδή στηρίζεται στο δόγμα του έργου ότι *η
 * ταυτότητα του μοντέλου ΕΙΝΑΙ η έκδοσή του*. Αν κάποτε κάποιος «βελτιώσει» τη σύγκριση σε
 * deep equality, η προδιαγραφή σπάει σιωπηλά — και μόνο αυτό εδώ θα το πει.
 */

import { resolveTableCopyMarqueeRect } from '../stamp-table-copy-marquee';
import { computeTableEntityGeometryLive } from '../../../../bim/table/table-entity-geometry';
import { createTableModel, toPersistedTableModel } from '../../../../bim/table/table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../../../../bim/table/table-style-presets';
import { useDrawingScaleStore } from '../../../../state/drawing-scale-store';
import type { TableCellRangeBounds } from '../../../../bim/table/table-cell-range';
import type { TableCopyMarqueeState } from '../../../../state/table-copy-marquee-store';
import type { TableColumn, TableRow } from '../../../../types/table';
import type { TableEntity } from '../../../../types/table-entity';
import { tableWorksheetFields } from '../../../../bim/table/__tests__/make-table-entity';
import { activeTableModel } from '../../../../bim/table/table-worksheet-resolve';

const COLUMNS: TableColumn[] = [
  { id: 'c1', sizing: { kind: 'fixed', widthMm: 30 }, valueType: 'text', align: 'left' },
  { id: 'c2', sizing: { kind: 'fixed', widthMm: 30 }, valueType: 'text', align: 'left' },
];
const ROWS: TableRow[] = [
  { id: 'r1', rowClass: 'header', heightMm: 8 },
  { id: 'r2', rowClass: 'data', heightMm: 8 },
];

const ENTITY: TableEntity = {
  id: 'tbl_marquee',
  type: 'table',
  layerId: 'lyr_test',
  position: { x: 0, y: 0 },
  angleRad: 0,
  styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
  ...tableWorksheetFields(toPersistedTableModel(createTableModel({ columns: COLUMNS, rows: ROWS }))),
};

const BOUNDS: TableCellRangeBounds = { firstRow: 0, lastRow: 1, firstCol: 0, lastCol: 1 };

const marqueeFor = (entity: TableEntity, entityId = entity.id): TableCopyMarqueeState => ({
  entityId,
  bounds: BOUNDS,
  modelRef: activeTableModel(entity),
  startedAtMs: 0,
});

const layoutOf = (entity: TableEntity) => computeTableEntityGeometryLive(entity).layout;

beforeEach(() => {
  useDrawingScaleStore.setState({ drawingScale: 1 });
});

describe('🔴 ADR-739 §48 — πότε φαίνονται τα μυρμήγκια', () => {
  it('ΒΑΣΗ — φρέσκο marquee στον ίδιο πίνακα ⇒ ορθογώνιο', () => {
    // Χωρίς αυτό, ένα «πάντα null» θα ήταν πράσινο σε όλα τα υπόλοιπα.
    const rect = resolveTableCopyMarqueeRect(ENTITY, layoutOf(ENTITY), marqueeFor(ENTITY));
    expect(rect).not.toBeNull();
    expect(rect?.w).toBeGreaterThan(0);
    expect(rect?.h).toBeGreaterThan(0);
  });

  it('🔴 ΑΛΛΑΞΕ ΤΟ ΜΟΝΤΕΛΟ (γράψιμο σε κελί) ⇒ σιωπή — Excel parity, χωρίς κανέναν ακυρωτή', () => {
    // Νέα αναφορά μοντέλου = νέα έκδοση. Το `buildTableModelCommand` επιστρέφει `null` όταν
    // τίποτα δεν άλλαξε, άρα «νέα αναφορά» σημαίνει **πραγματική** αλλαγή — και το marquee
    // σβήνει χωρίς καμία γραμμή σε καμία διαδρομή εγγραφής, ούτε σημερινή ούτε μελλοντική.
    const edited: TableEntity = {
      ...ENTITY,
      ...tableWorksheetFields(toPersistedTableModel(createTableModel({ columns: COLUMNS, rows: ROWS }))),
    };
    expect(resolveTableCopyMarqueeRect(edited, layoutOf(edited), marqueeFor(ENTITY))).toBeNull();
  });

  it('🔴 ΑΛΛΟΣ πίνακας ⇒ σιωπή — δύο πίνακες δεν μοιράζονται πρόχειρο', () => {
    const marquee = marqueeFor(ENTITY, 'tbl_other');
    expect(resolveTableCopyMarqueeRect(ENTITY, layoutOf(ENTITY), marquee)).toBeNull();
  });

  it('όρια εκτός διάταξης (σβήστηκαν οι γραμμές) ⇒ σιωπή, όχι ορθογώνιο στην άκρη', () => {
    const marquee: TableCopyMarqueeState = {
      ...marqueeFor(ENTITY),
      bounds: { firstRow: 40, lastRow: 41, firstCol: 40, lastCol: 41 },
    };
    expect(resolveTableCopyMarqueeRect(ENTITY, layoutOf(ENTITY), marquee)).toBeNull();
  });

  it('κανένα marquee ⇒ σιωπή', () => {
    expect(resolveTableCopyMarqueeRect(ENTITY, layoutOf(ENTITY), null)).toBeNull();
  });
});
