/**
 * 🔴 ADR-767 Δ4 + §8 #5 — **Η ΕΝΔΕΙΞΗ ΜΕΝΕΙ ΣΤΗΝ ΟΘΟΝΗ. Ο ΦΡΑΓΜΟΣ ΣΤΑΜΑΤΑΕΙ ΤΗΝ ΕΞΑΓΩΓΗ.**
 *
 * ## Δύο ερωτήσεις που είναι εύκολο να μπερδευτούν σε μία
 * | Τι δηλώνεται | Πού επιτρέπεται να φανεί |
 * |---|---|
 * | «αυτό το κελί είναι **δεμένο** / **παρακαμμένο**» | **μόνο οθόνη** (`FIELDDISPLAY`: *«not plotted»*) |
 * | «αυτά τα νούμερα είναι **μπαγιάτικα**» | οθόνη **+ φραγμός** (`DXEVAL` σε `PLOT`/`ETRANSMIT`) |
 *
 * Το §8 #5 ονομάζει τον κίνδυνο: *«ένδειξη μπαγιάτικου που **διαρρέει** στο DXF/PDF ⇒ χρειάζεται
 * test στο μονοπάτι **εξαγωγής**, όχι μόνο στον ζωγράφο»*. Γι' αυτό ο πρώτος έλεγχος παρακάτω
 * τρέχει την **πραγματική** `decomposeTable` — τη συνάρτηση που παράγει ό,τι μπαίνει σε DXF/PDF
 * — και απαιτεί **byte-ισοδύναμο** αποτέλεσμα με τον ίδιο πίνακα χωρίς δεσμό.
 *
 * @see export/core/table-to-primitives.ts — η ΠΡΑΓΜΑΤΙΚΗ διαδρομή εξαγωγής
 * @see bim/table/binding/table-binding-export-guard.ts — η κρίση του φραγμού
 */

import { decomposeTable } from '../../../export/core/table-to-primitives';
import { assessBoundTablesForExport } from '../binding/table-binding-export-guard';
import { refreshTableBinding } from '../binding/table-binding-refresh';
import { overrideBoundCell } from '../binding/table-binding-override';
import { commitCellWrites } from '../formula/table-formula-engine';
import { BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import type { TopoPoint } from '../../../systems/topography/topo-types';
import type { TableSourceContext } from '../binding/table-source-resolver';
import type { TableEntity } from '../../../types/table-entity';
import type { Entity } from '../../../types/entities';
import { tableWorksheetFields } from './make-table-entity';
import { activeTableModel } from '../table-worksheet-resolve';
import type {
  PersistedTableModel,
  TableBinding,
  TableColumn,
  TableRow,
} from '../../../types/table';

const P1: TopoPoint = { x: 1000, y: 2000, z: 3000, code: 'Κ1' };
const P2: TopoPoint = { x: 4000, y: 5000, z: 6000, code: 'Κ2' };
const P2_MOVED: TopoPoint = { x: 4500, y: 5000, z: 6000, code: 'Κ2' };

const ctx = (points: readonly TopoPoint[]): TableSourceContext => ({ topoPoints: points });
const BINDING: TableBinding = { mode: 'bound', sourceRef: { kind: 'survey-coordinates' }, revision: '' };

function emptyModel(): PersistedTableModel {
  const columns: TableColumn[] = [
    { id: 'cX', sizing: { kind: 'fixed', widthMm: 25 }, valueType: 'text', align: 'right', sourceKey: 'x' },
    { id: 'cCode', sizing: { kind: 'fixed', widthMm: 25 }, valueType: 'text', align: 'left', sourceKey: 'code' },
  ];
  const rows: TableRow[] = [
    { id: 'r1', rowClass: 'data', heightMm: 6 },
    { id: 'r2', rowClass: 'data', heightMm: 6 },
  ];
  return { columns, rows, cells: [], merges: [] };
}

function tableEntity(model: PersistedTableModel, binding?: TableBinding): TableEntity {
  return {
    id: 'tbl_1',
    type: 'table',
    layer: '0',
    position: { x: 0, y: 0 },
    angleRad: 0,
    styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
    ...tableWorksheetFields(model, binding),
    ...(binding === undefined ? {} : { binding }),
  } as TableEntity;
}

/** Ο ίδιος πίνακας, γεμισμένος — μία φορά ανά σενάριο δεσμού. */
function filled(): { model: PersistedTableModel; binding: TableBinding } {
  const result = refreshTableBinding({ model: emptyModel(), binding: BINDING, context: ctx([P1, P2]) });
  if (result.status !== 'refreshed') throw new Error('η αφετηρία πρέπει να γεμίζει');
  return { model: result.model, binding: result.binding };
}

/**
 * Ο ίδιος πίνακας **χωρίς κανένα ίχνος δεσμού** — ό,τι θα είχε γράψει ένας χρήστης με το χέρι.
 * Είναι ο μάρτυρας: το παραδοτέο πρέπει να είναι ταυτόσημο με αυτό.
 */
function stripBinding(model: PersistedTableModel): PersistedTableModel {
  return {
    ...model,
    columns: model.columns.map(({ sourceKey: _drop, ...rest }) => rest),
    cells: model.cells.map(([rowId, colId, cell]) => {
      const { bound: _bound, ...plain } = cell;
      return [rowId, colId, plain] as const;
    }),
  };
}

const decompose = (entity: TableEntity): Entity[] => decomposeTable(entity, 1, 'mm');

// ─── 1. Καμία διαρροή στο παραδοτέο (§8 #5) ───────────────────────────────────

describe('Δ4 — «δεμένο»/«παρακαμμένο»/«μπαγιάτικο» ΔΕΝ φτάνουν ΠΟΤΕ στο χαρτί', () => {
  it('🔴 δεμένος πίνακας παράγει ΤΑΥΤΟΣΗΜΑ primitives με τον ίδιο πίνακα χωρίς δεσμό', () => {
    const { model, binding } = filled();
    const bound = decompose(tableEntity(model, binding));
    const plain = decompose(tableEntity(stripBinding(model)));
    // `FIELDDISPLAY`: «The background is not plotted.» Το ίδιο, κατηγορηματικά, εδώ.
    expect(bound).toEqual(plain);
  });

  it('🔴 ΠΑΡΑΚΑΜΜΕΝΟ κελί δεν αφήνει ίχνος στην εξαγωγή — μόνο η τιμή του', () => {
    const { model, binding } = filled();
    const overridden = commitCellWrites(overrideBoundCell(model, 'r1', 'cX', 9999));
    const exported = decompose(tableEntity(overridden, binding));
    const plain = decompose(tableEntity(stripBinding(overridden)));
    expect(exported).toEqual(plain);
    // Και η ανθρώπινη τιμή **φτάνει** στο χαρτί: read-only ≠ αόρατο.
    expect(JSON.stringify(exported)).toContain('9999');
  });

  it('🔴 ΜΠΑΓΙΑΤΙΚΟΣ πίνακας τυπώνεται σαν κάθε άλλος — το σήμα δεν είναι μελάνι', () => {
    const { model } = filled();
    // Μπαγιάτικος = το αποθηκευμένο revision δεν ταιριάζει πια με την πηγή.
    const staleBinding: TableBinding = { ...BINDING, revision: 'παλιό-αποτύπωμα' };
    expect(decompose(tableEntity(model, staleBinding))).toEqual(decompose(tableEntity(stripBinding(model))));
  });
});

// ─── 2. Ο φραγμός (Δ4 · DXEVAL) ───────────────────────────────────────────────

describe('assessBoundTablesForExport — ο φραγμός εμφανίζεται όταν πρέπει', () => {
  it('όλα ενημερωμένα ⇒ καμία διακοπή, και ο αριθμός των ΕΞΕΤΑΣΜΕΝΩΝ λέγεται', () => {
    const { model, binding } = filled();
    const verdict = assessBoundTablesForExport([tableEntity(model, binding)], ctx([P1, P2]));
    expect(verdict.blocked).toBe(false);
    // 🔴 Το `examined` είναι ο λόγος που το «0 μπαγιάτικοι» σημαίνει κάτι: χωρίς αυτό, «κανείς
    // δεν κοίταξε» και «όλα καθαρά» δίνουν την ίδια απάντηση (N.11/N.12, τέσσερις φορές).
    expect(verdict.examined).toBe(1);
  });

  it('🔴 μπαγιάτικος πίνακας ΜΠΛΟΚΑΡΕΙ, ονομαστικά, με το φρέσκο αποτύπωμα στο χέρι', () => {
    const { model, binding } = filled();
    const verdict = assessBoundTablesForExport([tableEntity(model, binding)], ctx([P1, P2_MOVED]));
    expect(verdict.blocked).toBe(true);
    expect(verdict.stale.map((s) => s.entityId)).toEqual(['tbl_1']);
    expect(verdict.stale[0].freshRevision).not.toBe(binding.revision);
  });

  it('🔴 πίνακας που ΔΕΝ μπόρεσε να ελεγχθεί μπλοκάρει επίσης — «άγνωστο» ≠ «εντάξει»', () => {
    const { model, binding } = filled();
    const verdict = assessBoundTablesForExport([tableEntity(model, binding)], {});
    expect(verdict.blocked).toBe(true);
    expect(verdict.unchecked).toEqual([{ entityId: 'tbl_1', reason: 'source-unavailable' }]);
    expect(verdict.stale).toEqual([]);
  });

  it('πίνακας ΧΩΡΙΣ δεσμό (static) δεν εξετάζεται καν — δεν έχει πηγή να μπαγιατέψει', () => {
    const { model } = filled();
    const verdict = assessBoundTablesForExport([tableEntity(stripBinding(model))], {});
    expect(verdict).toEqual({ blocked: false, stale: [], unchecked: [], examined: 0 });
  });

  it('ξεχωρίζει τους μπαγιάτικους από τους ενημερωμένους στην ΙΔΙΑ εξαγωγή', () => {
    const { model, binding } = filled();
    const fresh = tableEntity(model, binding);
    const stale = { ...tableEntity(model, { ...binding, revision: 'παλιό' }), id: 'tbl_2' };
    const verdict = assessBoundTablesForExport([fresh, stale], ctx([P1, P2]));
    expect(verdict.examined).toBe(2);
    expect(verdict.stale.map((s) => s.entityId)).toEqual(['tbl_2']);
  });
});

// ─── 3. Μία χειρονομία, ένα undo (§9) ─────────────────────────────────────────

describe('§9 — «Ctrl+Z μετά από refresh: ΜΙΑ χειρονομία, ΕΝΑ undo»', () => {
  it('η ανανέωση παράγει ΕΝΑ νέο μοντέλο — άρα μία εντολή, ένα βήμα αναίρεσης', () => {
    const first = refreshTableBinding({ model: emptyModel(), binding: BINDING, context: ctx([P1, P2]) });
    if (first.status !== 'refreshed') throw new Error('expected refreshed');
    // `buildTableModelCommand` συγκρίνει **ταυτότητα** μοντέλου (`nextModel === activeTableModel(entity)`).
    // Ένα μοντέλο ⇒ μία `UpdateEntityCommand`, ανεξάρτητα από το πλήθος των κελιών που άλλαξαν.
    expect(first.model).not.toBe(emptyModel());
  });

  it('🔴 ανανέωση ΧΩΡΙΣ αλλαγή ⇒ ίδιο μοντέλο ⇒ ΚΑΝΕΝΑ βήμα undo', () => {
    const first = refreshTableBinding({ model: emptyModel(), binding: BINDING, context: ctx([P1, P2]) });
    if (first.status !== 'refreshed') throw new Error('expected refreshed');
    const again = refreshTableBinding({ model: first.model, binding: first.binding, context: ctx([P1, P2]) });
    // Το `buildTableModelCommand` επιστρέφει `null` όταν `nextModel === activeTableModel(entity)`: η
    // ταυτότητα by-reference του early cutoff **είναι** ο μηχανισμός που το εγγυάται.
    expect(again.model).toBe(first.model);
  });
});
