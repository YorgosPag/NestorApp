/**
 * ADR-751 Φ8.γ — **η ανακοίνωση «αυτός ο πίνακας έχει διευθύνσεις».**
 *
 * Το κρίσιμο είναι η **σιωπή**: η σημείωση μπαίνει στην `aria-live` περιοχή της εστίασης, που
 * διαβάζεται δυνατά σε **κάθε** `Tab`. Ένα `0` που γινόταν «0 σύνδεσμοι» θα έκανε κάθε τοίχο
 * και κάθε γραμμή του σχεδίου να ανακοινώνει κάτι άσχετο — δηλαδή θα υποβάθμιζε την
 * προσβασιμότητα με το πρόσχημα της προσβασιμότητας.
 *
 * @see accessibility/focus-2d-link-note.ts
 */

import { focusedEntityLinkCount } from '../focus-2d-link-note';
import { createTableModel, toPersistedTableModel } from '../../bim/table/table-model-helpers';
import { BUILTIN_TABLE_STYLE_IDS } from '../../bim/table/table-style-presets';
import type { Entity } from '../../types/entities';
import type { TableCell, TableColumn, TableRow } from '../../types/table';
import type { TableEntity } from '../../types/table-entity';

const COLUMN: TableColumn = {
  id: 'cA',
  sizing: { kind: 'fixed', widthMm: 120 },
  valueType: 'text',
  align: 'left',
};
const ROWS: TableRow[] = [{ id: 'r1', rowClass: 'data' }, { id: 'r2', rowClass: 'data' }];

function tableWith(values: readonly (readonly [string, TableCell])[]): TableEntity {
  return {
    id: 'ent_table',
    type: 'table',
    layerId: 'lyr',
    position: { x: 0, y: 0 },
    angleRad: 0,
    styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
    model: toPersistedTableModel(
      createTableModel({
        columns: [COLUMN],
        rows: ROWS,
        cells: values.map(([rowId, cell]) => [rowId, 'cA', cell] as const).slice(),
      }),
    ),
  };
}

const text = (value: string): TableCell => ({ kind: 'text', value });

const LINE_ENTITY = { id: 'ent_line', type: 'line', layerId: 'lyr' } as unknown as Entity;

describe('μετράει μόνο ό,τι πρέπει', () => {
  it('πίνακας με διευθύνσεις ⇒ το πλήθος τους', () => {
    const table = tableWith([['r1', text('a@nestor.gr')], ['r2', text('b@nestor.gr')]]);
    expect(focusedEntityLinkCount([table as unknown as Entity], 'ent_table')).toBe(2);
  });

  it('🔴 πίνακας ΧΩΡΙΣ διευθύνσεις ⇒ 0, δηλαδή σιωπή', () => {
    const table = tableWith([['r1', text('Απλό κείμενο')]]);
    expect(focusedEntityLinkCount([table as unknown as Entity], 'ent_table')).toBe(0);
  });

  it('🔴 οντότητα που ΔΕΝ είναι πίνακας ⇒ 0 — καμία γραμμή δεν ανακοινώνει συνδέσμους', () => {
    expect(focusedEntityLinkCount([LINE_ENTITY], 'ent_line')).toBe(0);
  });
});

describe('δεν σκάει σε τίποτα', () => {
  it('χωρίς εστίαση', () => {
    expect(focusedEntityLinkCount([LINE_ENTITY], null)).toBe(0);
  });

  it('χωρίς σκηνή', () => {
    expect(focusedEntityLinkCount(undefined, 'ent_table')).toBe(0);
  });

  it('μπαγιάτικη ταυτότητα — η οντότητα σβήστηκε ανάμεσα σε Tab και ανακοίνωση', () => {
    expect(focusedEntityLinkCount([LINE_ENTITY], 'ent_deleted')).toBe(0);
  });
});
