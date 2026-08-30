/**
 * ADR-751 — **ο σύνδεσμος κάτω από τον δείκτη.**
 *
 * Το κρίσιμο εδώ δεν είναι «βρίσκει τον σύνδεσμο» — είναι ότι το εύρος που **πιάνεται**
 * ταυτίζεται με το εύρος που **ζωγραφίστηκε**. Αν αποκλίνουν, ο χρήστης πατά εκεί που του
 * λέει το χεράκι και δεν ανοίγει τίποτα· το σφάλμα μοιάζει με «δεν δουλεύει» ενώ δουλεύει
 * λίγο πιο δίπλα. Γι' αυτό τα tests ρωτούν τον επιλυτή σε σημεία που **παράγονται από το
 * ίδιο το span** της διάταξης, όχι από καρφωμένες συντεταγμένες.
 *
 * @see bim/table/table-cell-link-hit.ts
 */

import { resolveTableCellLinkAtWorld } from '../table-cell-link-hit';
import { layoutTable } from '../table-layout';
import { createTableModel, toPersistedTableModel } from '../table-model-helpers';
import { BUILTIN_TABLE_STYLES, BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import { computeTableEntityGeometryLive, tableFrameToWorld } from '../table-entity-geometry';
import type { TableStyle } from '../table-style';
import type { TableCell, TableColumn, TableRow } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';
import { tableWorksheetFields } from './make-table-entity';

const STYLE: TableStyle = BUILTIN_TABLE_STYLES.find(
  (s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD,
)!;

const COLUMN: TableColumn = {
  id: 'c1',
  sizing: { kind: 'fixed', widthMm: 120 },
  valueType: 'text',
  align: 'left',
};
const ROW: TableRow = { id: 'r1', rowClass: 'data' };

function modelWith(value: TableCell['value']) {
  return createTableModel({
    columns: [COLUMN],
    rows: [ROW],
    cells: [['r1', 'c1', { kind: 'text', value }]],
  });
}

function entityWith(value: TableCell['value']): TableEntity {
  return {
    id: 'ent_link_test',
    type: 'table',
    layerId: 'lyr_test',
    position: { x: 0, y: 0 },
    angleRad: 0,
    styleId: BUILTIN_TABLE_STYLE_IDS.STANDARD,
    ...tableWorksheetFields(toPersistedTableModel(modelWith(value))),
  };
}

/** Το run της διάταξης — η αναφορά από την οποία παράγονται όλα τα σημεία δοκιμής. */
function runOf(value: TableCell['value']) {
  const run = layoutTable(modelWith(value), STYLE).cells[0]?.texts[0];
  if (!run) throw new Error('κανένα run');
  return run;
}

/**
 * Σημείο **σκηνής** από συντεταγμένες **πλαισίου** (mm) — η ίδια γέφυρα που χρησιμοποιεί ο
 * επιλυτής, αντίστροφα. Έτσι το test δεν μαντεύει κλίμακα ούτε θέση.
 */
function worldAt(entity: TableEntity, uMm: number, vMm: number) {
  const { mmToWorld } = computeTableEntityGeometryLive(entity);
  return tableFrameToWorld(entity, uMm, vMm, mmToWorld);
}

describe('βρίσκει τον σύνδεσμο ακριβώς εκεί που ζωγραφίστηκε', () => {
  const VALUE = 'georgios.pagonis@gmail.com';
  const entity = entityWith(VALUE);
  const run = runOf(VALUE);
  const span = run.links![0];

  it('στο ΜΕΣΟ του τμήματος', () => {
    const u = run.position.x + span.offsetMm + span.advanceMm / 2;
    const hit = resolveTableCellLinkAtWorld(entity, worldAt(entity, u, run.position.y));
    expect(hit?.span.href).toBe('mailto:georgios.pagonis@gmail.com');
    expect(hit?.rowId).toBe('r1');
    expect(hit?.colId).toBe('c1');
  });

  it('και στις δύο ΑΚΡΕΣ του — τα όρια ανήκουν στον σύνδεσμο', () => {
    const left = run.position.x + span.offsetMm;
    const right = left + span.advanceMm;
    expect(resolveTableCellLinkAtWorld(entity, worldAt(entity, left, run.position.y))).not.toBeNull();
    expect(resolveTableCellLinkAtWorld(entity, worldAt(entity, right, run.position.y))).not.toBeNull();
  });

  it('🔴 ΟΧΙ λίγο πιο δεξιά από το τέλος — το κενό του κελιού δεν είναι σύνδεσμος', () => {
    const past = run.position.x + span.offsetMm + span.advanceMm + 2;
    expect(resolveTableCellLinkAtWorld(entity, worldAt(entity, past, run.position.y))).toBeNull();
  });
});

describe('η κάθετη ζώνη είναι τα ΓΡΑΜΜΑΤΑ, όχι όλο το κελί', () => {
  const VALUE = 'info@nestorconstruct.gr';
  const entity = entityWith(VALUE);
  const run = runOf(VALUE);
  const midX = run.position.x + run.links![0].offsetMm + run.links![0].advanceMm / 2;

  it('πάνω στη γραμμή βάσης — ναι', () => {
    expect(resolveTableCellLinkAtWorld(entity, worldAt(entity, midX, run.position.y))).not.toBeNull();
  });

  it('λίγο πάνω από τη βάση (μέσα στην ανιούσα) — ναι', () => {
    const y = run.position.y - run.heightMm * 0.5;
    expect(resolveTableCellLinkAtWorld(entity, worldAt(entity, midX, y))).not.toBeNull();
  });

  it('🔴 ψηλά μέσα στο κελί, πάνω από τα γράμματα — ΟΧΙ', () => {
    const y = run.position.y - run.heightMm * 3;
    expect(resolveTableCellLinkAtWorld(entity, worldAt(entity, midX, y))).toBeNull();
  });

  it('🔴 χαμηλά, κάτω από την κατιούσα — ΟΧΙ', () => {
    const y = run.position.y + run.heightMm * 3;
    expect(resolveTableCellLinkAtWorld(entity, worldAt(entity, midX, y))).toBeNull();
  });
});

describe('μικτό κείμενο — πιάνεται ΜΟΝΟ το τμήμα', () => {
  const VALUE = 'Τηλ: 2310788493';
  const entity = entityWith(VALUE);
  const run = runOf(VALUE);
  const span = run.links![0];

  it('πάνω στον αριθμό — ναι, με καθαρισμένο προορισμό', () => {
    const u = run.position.x + span.offsetMm + span.advanceMm / 2;
    expect(resolveTableCellLinkAtWorld(entity, worldAt(entity, u, run.position.y))?.span.href).toBe(
      'tel:2310788493',
    );
  });

  it('🔴 πάνω στο «Τηλ: » — ΟΧΙ', () => {
    const u = run.position.x + span.offsetMm / 2;
    expect(resolveTableCellLinkAtWorld(entity, worldAt(entity, u, run.position.y))).toBeNull();
  });
});

describe('τίποτα να πιαστεί', () => {
  it('κελί χωρίς διεύθυνση', () => {
    const entity = entityWith('ΠΕΡΙΓΡΑΦΗ ΕΡΓΑΣΙΑΣ');
    const run = runOf('ΠΕΡΙΓΡΑΦΗ ΕΡΓΑΣΙΑΣ');
    const u = run.position.x + 5;
    expect(resolveTableCellLinkAtWorld(entity, worldAt(entity, u, run.position.y))).toBeNull();
  });

  it('αριθμητικό κελί με δεκαψήφια τιμή', () => {
    const entity = entityWith(2000000000);
    const run = runOf(2000000000);
    const u = run.position.x + 5;
    expect(resolveTableCellLinkAtWorld(entity, worldAt(entity, u, run.position.y))).toBeNull();
  });

  it('σημείο εντελώς έξω από τον πίνακα', () => {
    const entity = entityWith('info@a.gr');
    expect(resolveTableCellLinkAtWorld(entity, worldAt(entity, -500, -500))).toBeNull();
  });
});

describe('🔴 hover και κλικ ΔΕΝ ΜΠΟΡΟΥΝ να διαφωνήσουν', () => {
  // Ο επιλυτής είναι ΕΝΑΣ και τον καλούν και οι δύο διαδρομές. Το test το κλειδώνει ως
  // ιδιότητα: σε ένα πυκνό δείγμα σημείων κατά μήκος του κελιού, δύο διαδοχικές κλήσεις
  // δίνουν πάντα τον ίδιο προορισμό — καμία κρυφή κατάσταση, καμία εξάρτηση από σειρά.
  const VALUE = 'Επικοινωνία: info@a.gr · 6949727121';
  const entity = entityWith(VALUE);
  const run = runOf(VALUE);

  it('ίδια απάντηση σε κάθε σημείο, όσες φορές κι αν ρωτηθεί', () => {
    for (let i = 0; i <= 40; i++) {
      const u = run.position.x + (i / 40) * 60;
      const world = worldAt(entity, u, run.position.y);
      const a = resolveTableCellLinkAtWorld(entity, world);
      const b = resolveTableCellLinkAtWorld(entity, world);
      expect(a?.span.href ?? null).toBe(b?.span.href ?? null);
    }
  });

  it('βρίσκει και τους δύο συνδέσμους, τον καθένα στο δικό του εύρος', () => {
    const found = new Set<string>();
    for (const span of run.links!) {
      const u = run.position.x + span.offsetMm + span.advanceMm / 2;
      const hit = resolveTableCellLinkAtWorld(entity, worldAt(entity, u, run.position.y));
      if (hit) found.add(hit.span.href);
    }
    expect([...found].sort()).toEqual(['mailto:info@a.gr', 'tel:6949727121']);
  });
});
