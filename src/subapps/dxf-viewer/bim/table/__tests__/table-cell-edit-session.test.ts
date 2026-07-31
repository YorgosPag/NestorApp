/**
 * ADR-739 Φάση Δ βήμα 2 — `resolveTableCellEditTarget` / `buildTableCellEditCommand`.
 *
 * Ίδιο δίχτυ με το `table-entity-interaction.test.ts`: κάθε αριθμός παρακάτω είναι
 * υπολογισμένος στο χέρι, όχι διαβασμένος από την υλοποίηση. Δύο ρίσκα συγκεκριμένα:
 *  1. Η αγκύρωση να δείχνει ΑΛΛΗ γωνία του κελιού από την πάνω-αριστερή (θα έδειχνε
 *     σωστά σε τετράγωνο κελί, λάθος παντού αλλού).
 *  2. Το «τίποτα δεν άλλαξε» να μην κόβεται πραγματικά, γεμίζοντας το undo stack με no-op.
 */

import { resolveTableCellEditTarget, buildTableCellEditCommand } from '../table-cell-edit-session';
import { computeTableEntityGeometry, tableFrameToWorld } from '../table-entity-geometry';
import { createTableModel, toPersistedTableModel } from '../table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import { useDrawingScaleStore } from '../../../state/drawing-scale-store';
import { createMockSceneManager } from '../../../core/commands/__tests__/mock-scene-manager';
import type { TableCell, TableColumn, TableRow } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';

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

const text = (value: string): TableCell => ({ kind: 'text', value });

const persistedModel = (input: Parameters<typeof createTableModel>[0]) =>
  toPersistedTableModel(createTableModel(input));

/** 60mm × 16mm στο (100, 200) — ίδια γεωμετρία με το `table-entity-interaction.test.ts`. */
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

// ── resolveTableCellEditTarget ─────────────────────────────────────────────

describe('resolveTableCellEditTarget — ποιο κελί χτυπήθηκε', () => {
  it('σημείο μέσα στο (r1,c1) ⇒ επιστρέφει τη σωστή ταυτότητα + κείμενο', () => {
    const e = makeEntity({
      model: persistedModel({ columns: COLUMNS, rows: ROWS, cells: [['r1', 'c1', text('Στοιχείο')]] }),
    });
    const target = resolveTableCellEditTarget(e, { x: 110, y: 195 });
    expect(target?.rowId).toBe('r1');
    expect(target?.colId).toBe('c1');
    expect(target?.text).toBe('Στοιχείο');
  });

  it('κενό κελί ⇒ κενό αλφαριθμητικό, όχι undefined', () => {
    const target = resolveTableCellEditTarget(makeEntity(), { x: 110, y: 195 });
    expect(target?.text).toBe('');
  });

  it('σημείο ΕΞΩ από το πλέγμα ⇒ null', () => {
    expect(resolveTableCellEditTarget(makeEntity(), { x: 500, y: 500 })).toBeNull();
  });

  it('άδειος πίνακας (καμία γραμμή/στήλη) ⇒ ποτέ target', () => {
    const empty = makeEntity({ model: persistedModel({ columns: [], rows: [] }) });
    expect(resolveTableCellEditTarget(empty, { x: 100, y: 200 })).toBeNull();
  });

  // ── Η γωνία αγκύρωσης — ΤΟ ΚΡΙΣΙΜΟ σημείο ─────────────────────────────────
  describe('anchorWorldPoint — ΠΑΝΤΑ η πάνω-αριστερή γωνία του κελιού', () => {
    it('(r2,c2): γωνία διαφορετική από ΚΑΘΕ άλλη γωνία του ίδιου κελιού (ασύμμετρες διαστάσεις)', () => {
      const e = makeEntity();
      const target = resolveTableCellEditTarget(e, { x: 145, y: 190 }); // μέσα στο (r2,c2)
      expect(target?.rowId).toBe('r2');
      expect(target?.colId).toBe('c2');
      // (r2,c2) τοπικά: u ∈ [40,60], v ∈ [8,16] — πάνω-αριστερά = (40, 8).
      const expected = tableFrameToWorld(e, 40, 8, 1);
      expect(target?.anchorWorldPoint).toEqual(expected);
      expect(target?.anchorWorldPoint).toEqual({ x: 140, y: 192 });
      // Οι άλλες τρεις γωνίες του ΙΔΙΟΥ κελιού — μια μετάλλαξη που διαλέγει άλλη γωνία
      // (π.χ. κάτω-δεξιά) θα ταίριαζε ΕΔΩ αντί στο πάνω-αριστερά.
      expect(target?.anchorWorldPoint).not.toEqual(tableFrameToWorld(e, 60, 16, 1)); // κάτω-δεξιά
      expect(target?.anchorWorldPoint).not.toEqual(tableFrameToWorld(e, 60, 8, 1));  // πάνω-δεξιά
      expect(target?.anchorWorldPoint).not.toEqual(tableFrameToWorld(e, 40, 16, 1)); // κάτω-αριστερά
    });

    it('στραμμένος πίνακας: η αγκύρωση ακολουθεί την περιστροφή, δεν μένει στο AABB', () => {
      const e = makeEntity({ angleRad: Math.PI / 2 });
      const geo = computeTableEntityGeometry(e, 1, 'mm');
      const target = resolveTableCellEditTarget(e, tableFrameToWorld(e, 45, 12, geo.mmToWorld));
      expect(target?.rowId).toBe('r2');
      expect(target?.colId).toBe('c2');
      expect(target?.anchorWorldPoint).toEqual(tableFrameToWorld(e, 40, 8, geo.mmToWorld));
    });

    it('ANNOTATIVE: η αγκύρωση κλιμακώνεται με την κλίμακα σχεδίασης, όχι σταθερή', () => {
      useDrawingScaleStore.setState({ drawingScale: 100 });
      const e = makeEntity();
      const geo = computeTableEntityGeometry(e, 100, 'mm');
      const target = resolveTableCellEditTarget(e, tableFrameToWorld(e, 45, 12, geo.mmToWorld));
      expect(target?.anchorWorldPoint).toEqual(tableFrameToWorld(e, 40, 8, geo.mmToWorld));
      expect(target?.anchorWorldPoint).not.toEqual({ x: 140, y: 192 }); // η 1:1 τιμή ΔΕΝ ισχύει πια
    });
  });
});

// ── buildTableCellEditCommand ──────────────────────────────────────────────

describe('buildTableCellEditCommand', () => {
  it('ίδιο κείμενο ⇒ null — ΚΑΜΙΑ εντολή, κανένα no-op στο undo stack', () => {
    const e = makeEntity({
      model: persistedModel({ columns: COLUMNS, rows: ROWS, cells: [['r1', 'c1', text('Στοιχείο')]] }),
    });
    const sceneManager = createMockSceneManager([e]);
    const command = buildTableCellEditCommand(e, 'r1', 'c1', 'Στοιχείο', sceneManager);
    expect(command).toBeNull();
  });

  it('διαφορετικό κείμενο ⇒ επιστρέφει command που, εκτελεσμένο, γράφει το νέο κείμενο', () => {
    const e = makeEntity({
      model: persistedModel({ columns: COLUMNS, rows: ROWS, cells: [['r1', 'c1', text('Παλιό')]] }),
    });
    const sceneManager = createMockSceneManager([e]);
    const command = buildTableCellEditCommand(e, 'r1', 'c1', 'Νέο', sceneManager);
    expect(command).not.toBeNull();

    command?.execute();
    const updated = sceneManager.store.get(e.id) as TableEntity;
    expect(updated.model.cells.find(([r, c]) => r === 'r1' && c === 'c1')?.[2].value).toBe('Νέο');
  });

  it('undo επαναφέρει το προηγούμενο κείμενο', () => {
    const e = makeEntity({
      model: persistedModel({ columns: COLUMNS, rows: ROWS, cells: [['r1', 'c1', text('Παλιό')]] }),
    });
    const sceneManager = createMockSceneManager([e]);
    const command = buildTableCellEditCommand(e, 'r1', 'c1', 'Νέο', sceneManager)!;
    command.execute();
    command.undo();
    const restored = sceneManager.store.get(e.id) as TableEntity;
    expect(restored.model.cells.find(([r, c]) => r === 'r1' && c === 'c1')?.[2].value).toBe('Παλιό');
  });

  it('νέο κελί (πριν κενό) ⇒ επιστρέφει command, ΟΧΙ null', () => {
    const e = makeEntity();
    const sceneManager = createMockSceneManager([e]);
    const command = buildTableCellEditCommand(e, 'r1', 'c1', 'Πρώτο', sceneManager);
    expect(command).not.toBeNull();
    command?.execute();
    const updated = sceneManager.store.get(e.id) as TableEntity;
    expect(updated.model.cells.find(([r, c]) => r === 'r1' && c === 'c1')?.[2].value).toBe('Πρώτο');
  });

  it('το `entity` εισόδου δεν μεταλλάσσεται ποτέ (η ίδια εγγύηση καθαρότητας του `setPersistedCellText`)', () => {
    const e = makeEntity({
      model: persistedModel({ columns: COLUMNS, rows: ROWS, cells: [['r1', 'c1', text('Παλιό')]] }),
    });
    const before = e.model;
    buildTableCellEditCommand(e, 'r1', 'c1', 'Νέο', createMockSceneManager([e]));
    expect(e.model).toBe(before);
  });
});
