/**
 * ADR-833 Φάση 4 — **ΑΓΚΥΡΕΣ ΤΩΝ ΠΡΑΞΕΩΝ ΦΥΛΛΟΥ.**
 *
 * Καρφώνουν τις τρεις αποφάσεις της κεφαλίδας του `table-worksheet-ops.ts` (τέλος / διάδοχος
 * δεξιά / κενό όνομα σβήνει), τη **μη εκφράσιμη** διαγραφή του μοναδικού φύλλου, και τις δύο
 * εγγυήσεις που κρατούν το σύστημα: **ταυτότητα** στο no-op και **φρέσκες, μη συγκρουόμενες**
 * ταυτότητες στην πολυφυλλική εισαγωγή.
 *
 * @see ../table-worksheet-ops.ts
 */

import {
  buildWorksheets,
  planWorksheetAdd,
  planWorksheetDelete,
  planWorksheetMove,
  planWorksheetRename,
  planWorksheetsAppend,
  planWorksheetsReplace,
} from '../table-worksheet-ops';
import { buildTableModel } from '../build-table-entity';
import { worksheetDisplayName } from '../table-worksheet-name';
import { activeWorksheet, resolveWorksheets } from '../table-worksheet-resolve';
import { tableCursorAt } from '../table-cell-navigation';
import { makeTableEntity, tableWorksheetsFields } from './make-table-entity';
import { tableWorksheetId } from '../../../types/table-worksheet';
import type { TableEntity } from '../../../types/table-entity';
import type { TableBinding } from '../../../types/table';

const EMPTY = buildTableModel({});

/** Πίνακας με `count` φύλλα (`ws0…`), ενεργό το `activeIndex`. */
function book(count: number, activeIndex = 0): TableEntity {
  const models = Array.from({ length: count }, () => buildTableModel({ columnCount: 2, dataRowCount: 1 }));
  return { ...makeTableEntity(), ...tableWorksheetsFields(models, activeIndex) };
}

const ID = (index: number) => tableWorksheetId(`ws${index}`);

describe('planWorksheetAdd — το νέο φύλλο πάει ΣΤΟ ΤΕΛΟΣ, και γίνεται ενεργό', () => {
  it('προσαρτά ένα φύλλο στο τέλος με φρέσκια ταυτότητα', () => {
    const plan = planWorksheetAdd(book(2), EMPTY);
    expect(plan?.worksheets.map((sheet) => sheet.id)).toEqual(['ws0', 'ws1', 'ws2']);
  });

  it('το νέο φύλλο γίνεται το ενεργό — αλλιώς η πράξη μοιάζει να μην έκανε τίποτα', () => {
    const plan = planWorksheetAdd(book(3, 1), EMPTY);
    expect(plan.activeWorksheetId).toBe('ws3');
  });

  it('🔴 ΣΤΟ ΤΕΛΟΣ ⇒ κανένα ανώνυμο φύλλο δεν μετονομάζεται', () => {
    const before = resolveWorksheets(book(3)).map((sheet, index) => worksheetDisplayName(sheet, index));
    const after = planWorksheetAdd(book(3), EMPTY)?.worksheets.map((sheet, index) =>
      worksheetDisplayName(sheet, index),
    );
    expect(after.slice(0, before.length)).toEqual(before);
  });

  it('δεν αγγίζει τα υπάρχοντα φύλλα — ίδιες αναφορές (η αλυσίδα WeakMap επιβιώνει)', () => {
    const entity = book(2);
    const existing = resolveWorksheets(entity);
    const plan = planWorksheetAdd(entity, EMPTY);
    expect(plan.worksheets[0]).toBe(existing[0]);
    expect(plan.worksheets[1]).toBe(existing[1]);
  });

  it('η ταυτότητα του νέου ΔΕΝ συγκρούεται με χειροποίητο κενό στη σειρά', () => {
    const entity: TableEntity = {
      ...makeTableEntity(),
      worksheets: [
        { id: tableWorksheetId('ws0'), model: EMPTY },
        { id: tableWorksheetId('ws7'), model: EMPTY },
      ],
      activeWorksheetId: tableWorksheetId('ws0'),
    };
    expect(planWorksheetAdd(entity, EMPTY)?.worksheets[2].id).toBe('ws8');
  });
});

describe('planWorksheetDelete — τι φεύγει, και ποιος παίρνει τη σειρά του', () => {
  it('🔴 ΤΟ ΜΟΝΑΔΙΚΟ ΦΥΛΛΟ ΔΕΝ ΔΙΑΓΡΑΦΕΤΑΙ — η πράξη δεν είναι εκφράσιμη', () => {
    expect(planWorksheetDelete(book(1), ID(0), null)).toBeNull();
  });

  it('άγνωστος στόχος ⇒ τίποτα (ποτέ πτώση στο πρώτο φύλλο)', () => {
    expect(planWorksheetDelete(book(3), tableWorksheetId('ws9'), null)).toBeNull();
  });

  it('διαγραφή ΑΝΕΝΕΡΓΟΥ φύλλου δεν αγγίζει το ενεργό', () => {
    const plan = planWorksheetDelete(book(3, 0), ID(2), null);
    expect(plan?.worksheets.map((sheet) => sheet.id)).toEqual(['ws0', 'ws1']);
    expect(plan?.activeWorksheetId).toBeUndefined();
  });

  it('🔴 διαγραφή ΕΝΕΡΓΟΥ ⇒ διάδοχος το ΔΕΞΙΑ, στην ΙΔΙΑ εντολή', () => {
    const plan = planWorksheetDelete(book(3, 1), ID(1), null);
    expect(plan?.activeWorksheetId).toBe('ws2');
  });

  it('🔴 διαγραφή του ΤΕΛΕΥΤΑΙΟΥ ενεργού ⇒ διάδοχος το αριστερά', () => {
    const plan = planWorksheetDelete(book(3, 2), ID(2), null);
    expect(plan?.activeWorksheetId).toBe('ws1');
  });

  it('ο δρομέας επαναφέρεται ΜΟΝΟ όταν υπήρχε', () => {
    const entity = book(3, 1);
    expect(planWorksheetDelete(entity, ID(1), null)?.restoreCursor).toBeNull();
    const live = resolveWorksheets(entity)[1];
    const first = live.model.rows[0];
    const cursor = tableCursorAt(first.id, live.model.columns[0].id);
    expect(planWorksheetDelete(entity, ID(1), cursor)?.restoreCursor).not.toBeNull();
  });

  it('η μνήμη δρομέα του διαδόχου ΤΙΜΑΤΑΙ — και επικυρώνεται', () => {
    const model = buildTableModel({ columnCount: 2, dataRowCount: 2 });
    const remembered = { rowId: model.rows[2].id, colId: model.columns[1].id };
    const entity: TableEntity = {
      ...makeTableEntity(),
      worksheets: [
        { id: ID(0), model },
        { id: ID(1), model, cursor: remembered },
      ],
      activeWorksheetId: ID(0),
    };
    const cursor = tableCursorAt(model.rows[0].id, model.columns[0].id);
    const plan = planWorksheetDelete(entity, ID(0), cursor);
    expect(plan?.restoreCursor).toMatchObject(remembered);
  });
});

describe('planWorksheetRename — και η ΤΡΙΤΗ κατάσταση που το Excel δεν έχει', () => {
  it('γράφει ρητό όνομα, trimmed', () => {
    const plan = planWorksheetRename(book(2), ID(0), '  Πωλήσεις  ');
    expect(plan?.worksheets[0].name).toBe('Πωλήσεις');
  });

  it('🔴 ΚΕΝΟ ⇒ ΣΒΗΝΕΙ το όνομα, δεν απορρίπτεται (επιστροφή στην προεπιλογή)', () => {
    const named: TableEntity = {
      ...makeTableEntity(),
      worksheets: [{ id: ID(0), name: 'Κόστη', model: EMPTY }, { id: ID(1), model: EMPTY }],
      activeWorksheetId: ID(0),
    };
    const plan = planWorksheetRename(named, ID(0), '   ');
    expect(plan).not.toBeNull();
    expect(plan?.worksheets[0]).not.toHaveProperty('name');
    // Και η οθόνη επιστρέφει στη ζωντανή γλώσσα — αυτό είναι το νόημα της πράξης.
    expect(worksheetDisplayName(plan!.worksheets[0], 0)).toBe(worksheetDisplayName({ id: ID(0), model: EMPTY }, 0));
  });

  it('ίδιο όνομα ⇒ null (κανένα βήμα αναίρεσης για το τίποτα)', () => {
    const named: TableEntity = {
      ...makeTableEntity(),
      worksheets: [{ id: ID(0), name: 'Κόστη', model: EMPTY }],
      activeWorksheetId: ID(0),
    };
    expect(planWorksheetRename(named, ID(0), 'Κόστη')).toBeNull();
    expect(planWorksheetRename(named, ID(0), '  Κόστη ')).toBeNull();
  });

  it('κενό πάνω σε ΗΔΗ ανώνυμο ⇒ null', () => {
    expect(planWorksheetRename(book(2), ID(0), '')).toBeNull();
  });

  it('κρατά μοντέλο, δεσμό και μνήμη δρομέα — καμία χειρόγραφη απαρίθμηση', () => {
    const binding = { mode: 'static' } as unknown as TableBinding;
    const cursor = { rowId: EMPTY.rows[0].id, colId: EMPTY.columns[0].id };
    const entity: TableEntity = {
      ...makeTableEntity(),
      worksheets: [{ id: ID(0), model: EMPTY, binding, cursor }],
      activeWorksheetId: ID(0),
    };
    const renamed = planWorksheetRename(entity, ID(0), 'Α')?.worksheets[0];
    expect(renamed?.model).toBe(EMPTY);
    expect(renamed?.binding).toBe(binding);
    expect(renamed?.cursor).toBe(cursor);
  });

  it('δεν αγγίζει τα άλλα φύλλα — ίδιες αναφορές', () => {
    const entity = book(3);
    const existing = resolveWorksheets(entity);
    const plan = planWorksheetRename(entity, ID(1), 'Β');
    expect(plan?.worksheets[0]).toBe(existing[0]);
    expect(plan?.worksheets[2]).toBe(existing[2]);
  });
});

describe('planWorksheetMove — αναδιάταξη, με ΡΗΤΗ επιβεβαίωση της μετονομασίας', () => {
  it('μετακινεί στη ζητούμενη θέση', () => {
    const plan = planWorksheetMove(book(3), ID(0), 2);
    expect(plan?.worksheets.map((sheet) => sheet.id)).toEqual(['ws1', 'ws2', 'ws0']);
  });

  it('μετακίνηση προς τα αριστερά', () => {
    const plan = planWorksheetMove(book(3), ID(2), 1);
    expect(plan?.worksheets.map((sheet) => sheet.id)).toEqual(['ws0', 'ws2', 'ws1']);
  });

  it('εκτός ορίων ή ίδια θέση ⇒ null, ποτέ σιωπηλό clamp', () => {
    expect(planWorksheetMove(book(3), ID(0), -1)).toBeNull();
    expect(planWorksheetMove(book(3), ID(2), 3)).toBeNull();
    expect(planWorksheetMove(book(3), ID(1), 1)).toBeNull();
    expect(planWorksheetMove(book(3), tableWorksheetId('ws9'), 0)).toBeNull();
  });

  it('🔴 Η ΑΝΑΔΙΑΤΑΞΗ ΜΕΤΟΝΟΜΑΖΕΙ ΤΑ ΑΝΩΝΥΜΑ — επιβεβαιωμένο, όχι ανεκτό σιωπηλά', () => {
    const moved = planWorksheetMove(book(3), ID(0), 2)!.worksheets;
    // Το φύλλο `ws0` λεγόταν «Φύλλο1»· στην τρίτη θέση λέγεται «Φύλλο3».
    expect(worksheetDisplayName(moved[2], 2)).not.toBe(worksheetDisplayName(moved[2], 0));
    // Και **κανένα** `name` δεν υλοποιήθηκε στα δεδομένα — ο παραβάτης του §5.2 δεν επέστρεψε.
    expect(moved.every((sheet) => sheet.name === undefined)).toBe(true);
  });

  it('το ΡΗΤΟ όνομα δεν το αγγίζει καμία μετακίνηση', () => {
    const entity: TableEntity = {
      ...makeTableEntity(),
      worksheets: [{ id: ID(0), name: 'Κόστη', model: EMPTY }, { id: ID(1), model: EMPTY }],
      activeWorksheetId: ID(0),
    };
    const moved = planWorksheetMove(entity, ID(0), 1)!.worksheets;
    expect(worksheetDisplayName(moved[1], 1)).toBe('Κόστη');
  });
});

describe('πολυφυλλική εισαγωγή — προορισμός και ταυτότητες', () => {
  const drafts = [
    { name: 'Πωλήσεις', model: EMPTY },
    { name: 'Κόστη', model: EMPTY },
    { model: EMPTY },
  ];

  it('η ΠΡΟΣΘΗΚΗ βάζει τα φύλλα στο τέλος και κρατά τα υπάρχοντα', () => {
    const plan = planWorksheetsAppend(book(2), drafts);
    expect(plan?.worksheets.map((sheet) => sheet.id)).toEqual(['ws0', 'ws1', 'ws2', 'ws3', 'ws4']);
    expect(plan?.activeWorksheetId).toBe('ws2');
  });

  it('🔴 ΚΑΘΕ εισαγόμενο φύλλο παίρνει ΔΙΚΗ του ταυτότητα', () => {
    const ids = planWorksheetsAppend(book(1), drafts)!.worksheets.map((sheet) => sheet.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('το όνομα του Excel επιβιώνει αυτούσιο — ΚΑΜΙΑ προσθήκη «(2)»', () => {
    const existing: TableEntity = {
      ...makeTableEntity(),
      worksheets: [{ id: ID(0), name: 'Πωλήσεις', model: EMPTY }],
      activeWorksheetId: ID(0),
    };
    const plan = planWorksheetsAppend(existing, [{ name: 'Πωλήσεις', model: EMPTY }]);
    expect(plan?.worksheets[1].name).toBe('Πωλήσεις');
  });

  it('φύλλο χωρίς όνομα ΔΕΝ αποκτά κλειδί `name` (Firestore-safe)', () => {
    const plan = planWorksheetsAppend(book(1), [{ model: EMPTY }]);
    expect(plan?.worksheets[1]).not.toHaveProperty('name');
  });

  it('η ΑΝΤΙΚΑΤΑΣΤΑΣΗ σβήνει ΟΛΑ τα φύλλα και ξεκινά από το `ws0`', () => {
    const plan = planWorksheetsReplace(book(4, 3), drafts);
    expect(plan?.worksheets.map((sheet) => sheet.id)).toEqual(['ws0', 'ws1', 'ws2']);
    expect(plan?.activeWorksheetId).toBe('ws0');
  });

  it('κενό βιβλίο ⇒ null, από τις δύο πόρτες', () => {
    expect(planWorksheetsAppend(book(2), [])).toBeNull();
    expect(planWorksheetsReplace(book(2), [])).toBeNull();
  });

  it('`buildWorksheets` δίνει ντετερμινιστικές ταυτότητες για ολοκαίνουργιο πίνακα', () => {
    expect(buildWorksheets(drafts).map((sheet) => sheet.id)).toEqual(['ws0', 'ws1', 'ws2']);
  });
});

describe('η οντότητα ΠΑΛΙΑΣ μορφής περνά από την ΙΔΙΑ πύλη', () => {
  it('η προσθήκη σε αναβαθμιζόμενη οντότητα δίνει `ws1`, όχι διπλότυπο `ws0`', () => {
    const legacy = { ...makeTableEntity() } as TableEntity;
    // Η οντότητα έχει ήδη φύλλα (νέα μορφή) — αλλά ο έλεγχος είναι ότι ο γεννήτορας ρωτά τον
    // ΕΝΑ αναγνώστη, ποτέ το ωμό `entity.worksheets`.
    expect(activeWorksheet(legacy).id).toBe('ws0');
    expect(planWorksheetAdd(legacy, EMPTY)?.worksheets[1].id).toBe('ws1');
  });
});
