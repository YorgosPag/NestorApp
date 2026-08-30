/**
 * ADR-833 Φάση 4 — **ΑΓΚΥΡΕΣ ΤΟΥ ΕΝΟΣ ΕΚΤΕΛΕΣΤΗ.**
 *
 * Τρία πράγματα καρφώνονται εδώ, και τα δύο πρώτα είναι το νόημα της Φάσης 4:
 *  1. οι πράξεις φύλλου **αναιρούνται** (σε αντίθεση με την αλλαγή καρτέλας)·
 *  2. τα φύλλα **και** το ενεργό γράφονται σε **μία** εντολή — ένα `Ctrl+Z`, ποτέ μισή
 *     επαναφορά που αφήνει το ενεργό σε ανύπαρκτη ταυτότητα·
 *  3. ο φύλακας no-op δεν γεμίζει τη στοίβα αναίρεσης με το τίποτα.
 *
 * @see ../table-worksheet-command.ts
 */

import { buildTableWorksheetCommand } from '../table-worksheet-command';
import {
  planWorksheetAdd,
  planWorksheetDelete,
  planWorksheetRename,
} from '../table-worksheet-ops';
import { buildTableModel } from '../build-table-entity';
import { activeWorksheet, resolveWorksheets } from '../table-worksheet-resolve';
import { createMockSceneManager } from '../../../core/commands/__tests__/mock-scene-manager';
import { makeTableEntity, makePreWorksheetsTableEntity, tableWorksheetsFields } from './make-table-entity';
import { tableWorksheetId } from '../../../types/table-worksheet';
import type { TableEntity } from '../../../types/table-entity';

const EMPTY = buildTableModel({});

function book(count: number, activeIndex = 0): TableEntity {
  const models = Array.from({ length: count }, () => buildTableModel({ columnCount: 2, dataRowCount: 1 }));
  return { ...makeTableEntity(), ...tableWorksheetsFields(models, activeIndex) };
}

describe('buildTableWorksheetCommand — μία εντολή, ένα undo', () => {
  it('η προσθήκη φύλλου ΓΡΑΦΕΤΑΙ και ΑΝΑΙΡΕΙΤΑΙ', () => {
    const entity = book(2);
    const sceneManager = createMockSceneManager([entity]);
    const command = buildTableWorksheetCommand(entity, planWorksheetAdd(entity, EMPTY), sceneManager)!;

    command.execute();
    expect(resolveWorksheets(sceneManager.store.get(entity.id) as TableEntity)).toHaveLength(3);

    command.undo();
    expect(resolveWorksheets(sceneManager.store.get(entity.id) as TableEntity)).toHaveLength(2);
  });

  it('🔴 ΤΑ ΔΥΟ ΠΕΔΙΑ ΜΑΖΙ: η διαγραφή ενεργού μετακινεί το `activeWorksheetId` στην ΙΔΙΑ εντολή', () => {
    const entity = book(3, 1);
    const sceneManager = createMockSceneManager([entity]);
    const plan = planWorksheetDelete(entity, tableWorksheetId('ws1'), null);
    const command = buildTableWorksheetCommand(entity, plan, sceneManager)!;

    command.execute();
    const after = sceneManager.store.get(entity.id) as TableEntity;
    // Το ενεργό δείχνει σε φύλλο που **υπάρχει** — και είναι εκείνο που διάλεξε ο σχεδιαστής,
    // όχι η σιωπηλή πτώση του `activeWorksheet` στο πρώτο.
    expect(after.activeWorksheetId).toBe('ws2');
    expect(activeWorksheet(after).id).toBe('ws2');

    command.undo();
    const back = sceneManager.store.get(entity.id) as TableEntity;
    expect(resolveWorksheets(back)).toHaveLength(3);
    expect(back.activeWorksheetId).toBe('ws1');
  });

  it('η μετονομασία ΔΕΝ γράφει `activeWorksheetId` που δεν ζήτησε κανείς', () => {
    const entity = book(2, 1);
    const sceneManager = createMockSceneManager([entity]);
    const plan = planWorksheetRename(entity, tableWorksheetId('ws0'), 'Κόστη');
    buildTableWorksheetCommand(entity, plan, sceneManager)!.execute();
    expect((sceneManager.store.get(entity.id) as TableEntity).activeWorksheetId).toBe('ws1');
  });

  /**
   * 🔴 **Η ΑΝΟΧΗ ΤΗΣ ΑΝΑΓΝΩΣΗΣ ΔΕΝ ΓΙΝΕΤΑΙ ΠΟΤΕ ΕΓΓΡΑΦΗ.**
   *
   * Ένα `activeWorksheetId` που δεν δείχνει πουθενά είναι **φυσιολογικό ενδιάμεσο** (undo μιας
   * διαγραφής, χειροποίητο JSON) και το `activeWorksheet()` πέφτει σιωπηλά στο πρώτο φύλλο —
   * ρητή ανοχή, για **ανάγνωση**. Αν ο εκτελεστής έγραφε άνευ όρων το λυμένο ενεργό, μια απλή
   * μετονομασία θα «διόρθωνε» μόνιμα τον δείκτη: το επόμενο `Ctrl+Z` θα επανέφερε το φύλλο και
   * το ενεργό θα είχε ήδη χαθεί. Άρα το πεδίο μπαίνει **μόνο** όταν η πράξη το μετακινεί.
   */
  it('🔴 πράξη που ΔΕΝ μετακινεί το ενεργό αφήνει ανέγγιχτο ακόμη και ΚΡΕΜΑΜΕΝΟ δείκτη', () => {
    const dangling: TableEntity = { ...book(2), activeWorksheetId: tableWorksheetId('ws9') };
    const sceneManager = createMockSceneManager([dangling]);
    const plan = planWorksheetRename(dangling, tableWorksheetId('ws0'), 'Κόστη');
    buildTableWorksheetCommand(dangling, plan, sceneManager)!.execute();
    expect((sceneManager.store.get(dangling.id) as TableEntity).activeWorksheetId).toBe('ws9');
  });

  it('`null` σχέδιο ⇒ καμία εντολή', () => {
    const entity = book(1);
    expect(buildTableWorksheetCommand(entity, null, createMockSceneManager([entity]))).toBeNull();
  });

  it('🔴 σχέδιο χωρίς αλλαγή ⇒ καμία εντολή (η στοίβα αναίρεσης δεν «γεμίζει»)', () => {
    const entity = book(2, 1);
    const sceneManager = createMockSceneManager([entity]);
    const unchanged = {
      worksheets: resolveWorksheets(entity),
      activeWorksheetId: activeWorksheet(entity).id,
    };
    expect(buildTableWorksheetCommand(entity, unchanged, sceneManager)).toBeNull();
  });

  it('🔴 ο φύλακας «ίδιο ενεργό» ρωτά τον ΕΝΑ επιλυτή — ζωντανός και σε ΠΑΛΙΑ οντότητα', () => {
    // Οντότητα παλιάς μορφής: **δεν έχει καθόλου** `activeWorksheetId`. Μια ωμή σύγκριση με το
    // πεδίο θα έλεγε «άλλαξε» και θα γεννούσε εντολή για το τίποτα.
    const legacy = makePreWorksheetsTableEntity(EMPTY);
    const sceneManager = createMockSceneManager([legacy]);
    const unchanged = {
      worksheets: resolveWorksheets(legacy),
      activeWorksheetId: activeWorksheet(legacy).id,
    };
    expect(buildTableWorksheetCommand(legacy, unchanged, sceneManager)).toBeNull();
  });

  it('η εντολή καθαρίζει την ΠΑΛΙΑ μορφή στο ίδιο μπάλωμα (κανένα πεδίο-καθρέφτης)', () => {
    const legacy = makePreWorksheetsTableEntity(EMPTY);
    const sceneManager = createMockSceneManager([legacy]);
    buildTableWorksheetCommand(legacy, planWorksheetAdd(legacy, EMPTY), sceneManager)!.execute();
    const after = sceneManager.store.get(legacy.id) as TableEntity & { model?: unknown };
    expect(after.model).toBeUndefined();
    expect(resolveWorksheets(after)).toHaveLength(2);
  });
});
