/**
 * 🔴 ADR-833 Φάση 2 — **ΟΙ ΑΓΚΥΡΕΣ ΤΩΝ ΦΥΛΛΩΝ ΕΡΓΑΣΙΑΣ.**
 *
 * Η Φάση 2 είναι **αόρατη**: στο τέλος της, όλα δουλεύουν ακριβώς όπως πριν, με ένα φύλλο. Αυτό
 * την κάνει ταυτόχρονα την πιο **επικίνδυνη** φάση της αλυσίδας — μια σιωπηλή απώλεια εδώ δεν
 * έχει τίποτα ορατό να την προδώσει. Ό,τι ακολουθεί είναι τα σημεία όπου η σιωπή θα ήταν δυνατή.
 *
 * ## Τι φυλά κάθε ομάδα
 * ```
 *   1. παλιά οντότητα   →  σχέδιο γραμμένο ΠΡΙΝ τα φύλλα διαβάζεται ταυτόσημα
 *   2. byte-identity    →  σχέδιο που μόνο ΔΙΑΒΑΣΤΗΚΕ δεν αλλάζει ούτε ένα byte
 *   3. ταυτότητα        →  ίδια αναφορά σε κάθε κλήση (το συμβόλαιο του WeakMap)
 *   4. αλυσίδα μνήμης   →  επεξεργασία στο φύλλο Α ΔΕΝ ακυρώνει τη διάταξη του Β
 *   5. φύλακες no-op    →  «τίποτα δεν άλλαξε» εξακολουθεί να απαντά ΤΑΥΤΟΤΗΤΑ
 *   6. μπάλωμα          →  η μετανάστευση γίνεται ΜΑΖΙ με τη γραφή, ποτέ χωριστά
 * ```
 *
 * 🔬 Κάθε μία **επαληθεύτηκε με μετάλλαξη** (ADR-587 §6.1): ο κώδικας σπάστηκε σκόπιμα, το test
 * κοκκίνισε, ο κώδικας επανήλθε. Πράσινο test που δεν αποδείχθηκε ικανό να κοκκινίσει δεν είναι
 * άγκυρα, είναι σχόλιο. Οι μεταλλάξεις καταγράφονται στο ADR-833 §5.2.
 *
 * @see ../table-worksheet-resolve.ts
 * @see ../table-worksheet-write.ts
 */

import {
  activeTableBinding,
  activeTableModel,
  activeWorksheet,
  resolveWorksheetFields,
  resolveWorksheets,
} from '../table-worksheet-resolve';
import {
  tableWorksheetsPatch,
  worksheetsWithActiveModel,
  worksheetsWithActiveModelAndBinding,
} from '../table-worksheet-write';
import { resolveTableLayout, resolveTableStyle } from '../table-entity-geometry';
import { createTableModel, resolveTableModel, toPersistedTableModel } from '../table-model-helpers';
import { buildTableModel } from '../build-table-entity';
import {
  FIRST_WORKSHEET_ID,
  makePreWorksheetsTableEntity,
  makeTableEntity,
  tableWorksheetsFields,
} from './make-table-entity';
import { FIRST_TABLE_WORKSHEET_ID, tableWorksheetId } from '../../../types/table-worksheet';
import type { PersistedTableModel, TableBinding } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';

const BINDING: TableBinding = {
  mode: 'bound',
  sourceRef: { kind: 'survey-coordinates' },
  revision: 'rev_anchor',
};

/** Μοντέλο με **γεμάτα** κελιά — αλλιώς «ίδιο πριν / ίδιο μετά» δεν αποδεικνύει τίποτα. */
function modelWithCells(value: string): PersistedTableModel {
  return toPersistedTableModel(createTableModel({
    columns: [{ id: 'c0', sizing: { kind: 'fixed', widthMm: 40 }, valueType: 'text', align: 'left' }],
    rows: [{ id: 'r0', rowClass: 'data', heightMm: 8 }],
    cells: [['r0', 'c0', { kind: 'text', value }]],
  }));
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. Η παλιά οντότητα — αυτή που είναι ΗΔΗ γραμμένη στον δίσκο
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 ΠΑΛΙΑ ΟΝΤΟΤΗΤΑ (πριν τα φύλλα) — διαβάζεται ΤΑΥΤΟΣΗΜΑ', () => {
  it('τα κελιά της φτάνουν αυτούσια μέσω του `activeTableModel`', () => {
    const model = modelWithCells('Δοκός Δ1');
    const legacy = makePreWorksheetsTableEntity(model);
    // **Ταυτότητα**, όχι ισότητα βάθους: η αναβάθμιση δεν επιτρέπεται να αντιγράψει το μοντέλο —
    // ένα αντίγραφο θα έσπαγε κάθε φύλακα `===` πιο πάνω και θα ξανάχτιζε κάθε διάταξη.
    expect(activeTableModel(legacy)).toBe(model);
  });

  it('ο δεσμός της **μετακομίζει μέσα στο φύλλο** και διαβάζεται από εκεί', () => {
    const legacy = makePreWorksheetsTableEntity(modelWithCells('x'), BINDING);
    expect(activeTableBinding(legacy)).toBe(BINDING);
    expect(activeWorksheet(legacy).binding).toBe(BINDING);
  });

  it('χωρίς δεσμό ⇒ **απόν κλειδί**, ποτέ `binding: undefined` (Firestore-safe)', () => {
    const legacy = makePreWorksheetsTableEntity(modelWithCells('x'));
    expect('binding' in activeWorksheet(legacy)).toBe(false);
  });

  it('το φύλλο παίρνει ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΗ ταυτότητα — δύο αναγνώσεις, ίδιο id', () => {
    const model = modelWithCells('x');
    // Δύο **χωριστά** αντικείμενα, όπως δύο ανοίγματα του ίδιου αρχείου.
    expect(activeWorksheet(makePreWorksheetsTableEntity(model)).id)
      .toBe(activeWorksheet(makePreWorksheetsTableEntity(model)).id);
    expect(activeWorksheet(makePreWorksheetsTableEntity(model)).id).toBe(FIRST_TABLE_WORKSHEET_ID);
  });

  it('η αναβάθμιση **δεν εφευρίσκει όνομα** — δεδομένο χρήστη που δεν γράφτηκε ποτέ', () => {
    const legacy = makePreWorksheetsTableEntity(modelWithCells('x'));
    expect(activeWorksheet(legacy).name).toBeUndefined();
  });

  it('οντότητα ΧΩΡΙΣ καμία από τις δύο μορφές ⇒ ένα κενό φύλλο, ΠΟΤΕ εξαίρεση', () => {
    const broken = { id: 'tbl_broken', type: 'table' } as unknown as TableEntity;
    const worksheets = resolveWorksheets(broken);
    expect(worksheets).toHaveLength(1);
    expect(worksheets[0].model.rows).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. Byte-identity — το τίμημα που ΔΕΝ πληρώνει ένα σχέδιο που μόνο διαβάστηκε
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 BYTE-IDENTITY — σχέδιο που μόνο ΔΙΑΒΑΣΤΗΚΕ παράγει ταυτόσημο JSON', () => {
  it('η ανάγνωση δεν γράφει τίποτα πάνω στην παλιά οντότητα', () => {
    const legacy = makePreWorksheetsTableEntity(modelWithCells('Δοκός Δ1'), BINDING);
    const before = JSON.stringify(legacy);

    // ΟΛΟΚΛΗΡΗ η διαδρομή ανάγνωσης — αυτή που τρέχει σε κάθε καρέ και σε κάθε χειρισμό.
    resolveWorksheets(legacy);
    activeWorksheet(legacy);
    activeTableModel(legacy);
    activeTableBinding(legacy);
    resolveWorksheetFields(legacy);
    resolveTableLayout(
      resolveTableModel(activeTableModel(legacy)),
      resolveTableStyle(legacy),
      '#ffffff',
    );

    expect(JSON.stringify(legacy)).toBe(before);
  });

  it('…και το ίδιο ισχύει για οντότητα ΝΕΑΣ μορφής', () => {
    const entity = makeTableEntity({ model: modelWithCells('x') });
    const before = JSON.stringify(entity);
    resolveWorksheetFields(entity);
    activeTableModel(entity);
    expect(JSON.stringify(entity)).toBe(before);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. Ταυτότητα — το συμβόλαιο του WeakMap
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 ΤΑΥΤΟΤΗΤΑ — ίδια αναφορά σε επαναλαμβανόμενες κλήσεις', () => {
  it('παλιά οντότητα: το `resolveWorksheets` επιστρέφει ΤΟ ΙΔΙΟ αντικείμενο', () => {
    const legacy = makePreWorksheetsTableEntity(modelWithCells('x'), BINDING);
    const first = resolveWorksheets(legacy);
    // 🔴 Χωρίς τη μνήμη, κάθε κλήση θα έφτιαχνε νέο πίνακα φύλλων — και **κάθε** φύλακας
    // ταυτότητας πιο πάνω (οι οκτώ γραφείς, το `previewPatch`, οι δύο εντολές) θα έλεγε
    // «άλλαξε» χωρίς να έχει αλλάξει τίποτα: βήματα undo για το τίποτα, σε κάθε καρέ.
    expect(resolveWorksheets(legacy)).toBe(first);
    expect(resolveWorksheets(legacy)[0]).toBe(first[0]);
    expect(activeWorksheet(legacy)).toBe(first[0]);
  });

  it('νέα οντότητα: επιστρέφεται το **ίδιο το πεδίο**, χωρίς καμία δέσμευση', () => {
    const entity = makeTableEntity({ model: modelWithCells('x') });
    expect(resolveWorksheets(entity)).toBe(entity.worksheets);
  });

  it('`activeWorksheetId` που δεν δείχνει πουθενά ⇒ πτώση στο ΠΡΩΤΟ φύλλο, όχι κατάρρευση', () => {
    const entity: TableEntity = {
      ...makeTableEntity({ model: modelWithCells('x') }),
      activeWorksheetId: tableWorksheetId('ws_deleted'),
    };
    expect(activeWorksheet(entity).id).toBe(FIRST_WORKSHEET_ID);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. Η αλυσίδα μνήμης — ο ισχυρισμός απόδοσης, αποδεδειγμένος
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 ΑΛΥΣΙΔΑ ΜΝΗΜΗΣ — επεξεργασία στο φύλλο Α ΔΕΝ ακυρώνει τη διάταξη του Β', () => {
  it('η διάταξη του Β είναι ΤΟ ΙΔΙΟ αντικείμενο πριν και μετά την επεξεργασία του Α', () => {
    const a = modelWithCells('Α');
    const b = modelWithCells('Β');
    const entity: TableEntity = { ...makeTableEntity(), ...tableWorksheetsFields([a, b], 0) };
    const style = resolveTableStyle(entity);

    const layoutB = resolveTableLayout(resolveTableModel(b), style, '#ffffff');

    // Επεξεργασία στο **ενεργό** φύλλο (το Α) μέσω του SSoT της γραφής.
    const edited: TableEntity = {
      ...entity,
      worksheets: worksheetsWithActiveModel(entity, modelWithCells('Α — αλλαγμένο')),
    };
    expect(activeTableModel(edited)).not.toBe(a);

    // 🔴 Το Β **δεν** άγγιξε κανείς: ίδιο `PersistedTableModel` ⇒ ίδιο `TableModel` ⇒ ίδια
    // διάταξη. Αναπόδεικτος ισχυρισμός απόδοσης είναι άχρηστος — αυτό είναι η απόδειξη.
    expect(edited.worksheets[1].model).toBe(b);
    expect(resolveTableLayout(resolveTableModel(edited.worksheets[1].model), style, '#ffffff'))
      .toBe(layoutB);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. Οι φύλακες no-op — η εγγύηση που ανέβηκε ένα επίπεδο
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 ΦΥΛΑΚΕΣ NO-OP — «τίποτα δεν άλλαξε» απαντά ΤΑΥΤΟΤΗΤΑ', () => {
  it('ίδιο μοντέλο ⇒ ΤΟ ΙΔΙΟ `worksheets` by-reference', () => {
    const entity = makeTableEntity({ model: modelWithCells('x') });
    expect(worksheetsWithActiveModel(entity, activeTableModel(entity))).toBe(entity.worksheets);
  });

  it('ίδιο μοντέλο ΚΑΙ ίδιος δεσμός ⇒ ΤΟ ΙΔΙΟ `worksheets` by-reference', () => {
    const entity = makeTableEntity({ model: modelWithCells('x'), binding: BINDING });
    expect(worksheetsWithActiveModelAndBinding(entity, activeTableModel(entity), BINDING))
      .toBe(entity.worksheets);
  });

  it('άλλο μοντέλο ⇒ νέο `worksheets`, με τα ΥΠΟΛΟΙΠΑ φύλλα αυτούσια', () => {
    const a = modelWithCells('Α');
    const b = modelWithCells('Β');
    const entity: TableEntity = { ...makeTableEntity(), ...tableWorksheetsFields([a, b], 0) };
    const next = worksheetsWithActiveModel(entity, modelWithCells('Α2'));
    expect(next).not.toBe(entity.worksheets);
    expect(next[1]).toBe(entity.worksheets[1]);
  });

  it('αφαίρεση δεσμού ⇒ **απόν κλειδί**, ποτέ `binding: undefined`', () => {
    const entity = makeTableEntity({ model: modelWithCells('x'), binding: BINDING });
    const next = worksheetsWithActiveModelAndBinding(entity, modelWithCells('y'), undefined);
    expect('binding' in next[0]).toBe(false);
  });

  it('η αλλαγή δεσμού διατηρεί **κάθε άλλο** πεδίο του φύλλου (π.χ. το όνομα)', () => {
    const base = makeTableEntity({ model: modelWithCells('x') });
    const entity: TableEntity = {
      ...base,
      worksheets: [{ ...base.worksheets[0], name: 'Κουφώματα' }],
    };
    const next = worksheetsWithActiveModelAndBinding(entity, modelWithCells('y'), BINDING);
    expect(next[0].name).toBe('Κουφώματα');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 6. Το μπάλωμα — η μετανάστευση γίνεται ΜΑΖΙ με τη γραφή, ποτέ χωριστά
// ──────────────────────────────────────────────────────────────────────────────

describe('🔴 ΜΠΑΛΩΜΑ — η παλιά μορφή σβήνεται στην ΙΔΙΑ πράξη με τη γραφή', () => {
  it('παλιά οντότητα: το μπάλωμα σβήνει `model` ΚΑΙ `binding`', () => {
    const legacy = makePreWorksheetsTableEntity(modelWithCells('x'), BINDING);
    const patch = tableWorksheetsPatch(legacy, resolveWorksheets(legacy));
    // 🔴 Χωρίς αυτά τα δύο κλειδιά, το μερικό μπάλωμα του `UpdateEntityCommand` θα άφηνε το
    // παλιό `model` δίπλα στα φύλλα — δηλαδή θα γεννούσε το **πεδίο-καθρέφτης** που το §5.2
    // απαγορεύει, σε **μπαγιάτικη** εκδοχή.
    expect('model' in patch).toBe(true);
    expect(patch.model).toBeUndefined();
    expect('binding' in patch).toBe(true);
    expect(patch.binding).toBeUndefined();
  });

  it('νέα οντότητα: **κανένα** κλειδί καθαρισμού (ποτέ `undefined` σε υγιή πίνακα)', () => {
    const entity = makeTableEntity({ model: modelWithCells('x') });
    const patch = tableWorksheetsPatch(entity, entity.worksheets);
    expect(Object.keys(patch)).toEqual(['worksheets']);
  });

  it('παλιά οντότητα ΧΩΡΙΣ δεσμό: σβήνεται μόνο το `model`', () => {
    const legacy = makePreWorksheetsTableEntity(modelWithCells('x'));
    const patch = tableWorksheetsPatch(legacy, resolveWorksheets(legacy));
    expect(Object.keys(patch).sort()).toEqual(['model', 'worksheets']);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 7. Ο κατασκευαστής
// ──────────────────────────────────────────────────────────────────────────────

describe('ο νέος πίνακας γεννιέται με ΕΝΑ φύλλο, ενεργό', () => {
  it('ένα φύλλο, χωρίς όνομα, ενεργό', () => {
    const entity = makeTableEntity({ model: buildTableModel({}) });
    expect(entity.worksheets).toHaveLength(1);
    expect(entity.activeWorksheetId).toBe(entity.worksheets[0].id);
    expect(entity.worksheets[0].name).toBeUndefined();
  });
});
