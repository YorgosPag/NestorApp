/**
 * 🔴 ADR-739 §63 — **ΠΟΙΟΝ ΡΩΤΑ Η ΘΥΡΑ ΓΙΑ ΤΟ «ΠΟΥ ΓΡΑΦΩ»: τον στόχο ή τον δρομέα;**
 *
 * ## Γιατί αυτή η σουίτα γεννήθηκε — υπήρχε ΜΗΔΕΝ άγκυρα
 * Το `use-table-format-actions.ts` δημοσιεύει τη θύρα που χρησιμοποιεί **κάθε** επιφάνεια
 * μορφοποίησης, και μέχρι το §63 **καμία** σουίτα δεν το μόνταρε: μετρημένο με
 * `grep -rln useTableFormatActions --include=*.test.*` ⇒ κανένα αποτέλεσμα. Το πλάνο δέσμευσης
 * (`table-format-commit-plan.test.ts`) κρίνει το **κριτήριο**· εδώ κρίνεται η **καλωδίωση** — και
 * τα δύο χρειάζονται, γιατί ένα σωστό κριτήριο που ρωτιέται για λάθος πίνακα είναι σωστή απάντηση
 * σε λάθος ερώτηση.
 *
 * ## 🔴 ΤΟ ΕΛΑΤΤΩΜΑ, ΜΕ ΑΡΙΘΜΟΥΣ
 * Το «ΟΚ» κατέληγε σε `applyFormat(() => model)`, δηλαδή `useLiveTableMutation` πάνω σε
 * `cursorTable` — τον πίνακα **του δρομέα**. Ο διάλογος όμως είναι **αιωρούμενος** (ADR-750 Φ6β):
 * ανάμεσα στο άνοιγμα και το «ΟΚ» ο δρομέας μπορεί να έχει πεθάνει ή να έχει μετακομίσει.
 *
 * ```
 *   δρομέας νεκρός       ⇒ if (!live) return          — σιωπηλό no-op, ο διάλογος έκλεινε
 *   δρομέας σε ΑΛΛΟΝ     ⇒ UpdateEntityCommand(Β.id, { model: προσχέδιο ΤΟΥ Α })
 *                          — ο πίνακας Β γινόταν ο πίνακας Α, χωρίς κανένα σφάλμα
 * ```
 *
 * Η δεύτερη είναι **αλλοίωση δεδομένων**: το `mutate` του `useLiveTableMutation` είναι
 * `() => model`, δηλαδή **αγνοεί εντελώς** το `activeTableModel(live)` και επιστρέφει ξένο μοντέλο· και ο
 * φύλακας `nextModel === activeTableModel(live)` δεν σώζει, γιατί πρόκειται για διαφορετικά αντικείμενα.
 *
 * @see bim/table/table-format-commit-plan.ts — το κριτήριο
 * @see ui/table-cell-editor/use-table-format-actions.ts — ο εκδότης που δοκιμάζεται εδώ
 */

import { renderHook } from '@testing-library/react';

/**
 * ⚠️ Ο εκδότης της θύρας σέρνει (μέσω του προχείρου, §57) το `useNotifications`, που **απαιτεί**
 * provider. Το mock είναι το υπάρχον idiom του έργου (`useFileListActions.test.tsx`) και ζει
 * **πριν** τα imports επίτηδες — ο `jest.mock` ανυψώνεται, αλλά η θέση δηλώνει την πρόθεση.
 *
 * Δηλώνονται μόνο τα δύο κανάλια που όντως υπάρχουν στο συμβόλαιο: μια «πλήρης» απομίμηση θα ήταν
 * δεύτερη δήλωση του provider, που θα αποκλίνει σιωπηλά.
 */
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ success: jest.fn(), error: jest.fn() }),
}));

import { useTableFormatActions } from '../use-table-format-actions';
import {
  __resetTableFormatPortForTests,
  getTableFormatPort,
} from '../table-format-port';
import {
  __resetTableCellCursorStoreForTests,
  setTableCellCursor,
} from '../../../state/table-cell-cursor-store';
import { resetGlobalCommandHistory } from '../../../core/commands';
import type { FormatTarget } from '../table-format-snapshot';
import type { PersistedTableModel } from '../../../types/table';
import type { SceneModel } from '../../../types/scene';
import type { TableEntity } from '../../../types/table-entity';
import type { LevelManagerLike } from '../../../hooks/canvas/canvas-click-types';
import { activeTableModel } from '../../../bim/table/table-worksheet-resolve';
import { setTableCellCursorById } from '../../../bim/table/__tests__/make-table-entity';

const LEVEL = 'level-1';

/**
 * Ένα ελάχιστο μοντέλο πίνακα με **αναγνωρίσιμη ταυτότητα**: μία στήλη, μία γραμμή, καμία τιμή.
 *
 * ⚠️ Το `tag` δεν είναι πεδίο του μοντέλου — είναι σημάδι του **test**, ώστε ο έλεγχος «τι
 * γράφτηκε πού» να διαβάζεται χωρίς σύγκριση βάθους. Ο κώδικας υπό δοκιμή δεν το κοιτάζει ποτέ.
 */
function model(tag: string): PersistedTableModel {
  return {
    tag,
    columns: [{ id: 'c1', widthMm: 10 }],
    rows: [{ id: 'r1', heightMm: 5 }],
    cells: [],
    merges: [],
  } as unknown as PersistedTableModel;
}

function tableEntity(id: string, tag: string): TableEntity {
  return { id, type: 'table', model: model(tag) } as unknown as TableEntity;
}

/**
 * Ένας διαχειριστής ορόφων που **καταγράφει τη σκηνή που γράφτηκε** — η μόνη παρατήρηση που
 * χρειάζεται: το `UpdateEntityCommand` καταλήγει σε `setLevelScene`, οπότε από εκεί διαβάζουμε
 * **σε ποια οντότητα** έγραψε η εντολή.
 */
function harness(entities: readonly TableEntity[]) {
  let scene = { entities: [...entities] } as unknown as SceneModel;
  const levelManager: LevelManagerLike = {
    currentLevelId: LEVEL,
    getLevelScene: (levelId: string) => (levelId === LEVEL ? scene : null),
    setLevelScene: (levelId: string, next: SceneModel) => {
      if (levelId === LEVEL) scene = next;
    },
  } as unknown as LevelManagerLike;

  /** Το `tag` του μοντέλου κάθε πίνακα **μετά** από ό,τι έτρεξε — «ποιος έγινε τι». */
  const tags = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const e of (scene as unknown as { entities: TableEntity[] }).entities) {
      out[e.id] = (activeTableModel(e) as unknown as { tag: string }).tag;
    }
    return out;
  };

  renderHook(() =>
    useTableFormatActions({ levelManager, getSelectedEntityIds: () => [] }),
  );

  return { tags };
}

/** Ο στόχος όπως τον γεννά ο διάλογος: **ποιος** πίνακας + **τι** μοντέλο διαβάστηκε. */
function targetFor(entity: TableEntity): FormatTarget {
  return {
    entityId: entity.id,
    model: activeTableModel(entity),
    style: {} as FormatTarget['style'],
    scope: { kind: 'range', bounds: { firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 } },
    layerColors: [],
  };
}

describe('§63 — η θύρα γράφει στον ΣΤΟΧΟ, ποτέ στον δρομέα', () => {
  beforeEach(() => {
    __resetTableFormatPortForTests();
    __resetTableCellCursorStoreForTests();
    resetGlobalCommandHistory();
  });
  afterEach(() => {
    __resetTableFormatPortForTests();
    __resetTableCellCursorStoreForTests();
  });

  it('🔴 Κ4 — δρομέας σε ΑΛΛΟΝ πίνακα: το προσχέδιο του Α ΔΕΝ πέφτει πάνω στον Β', () => {
    const tableA = tableEntity('A', 'Α-όπως-άνοιξε');
    const tableB = tableEntity('B', 'Β-ανέπαφος');
    const { tags } = harness([tableA, tableB]);

    // Ο χρήστης άνοιξε τον διάλογο στον Α και μετά μπήκε σε κελί του **Β** (ο διάλογος είναι
    // αιωρούμενος, άρα αυτό είναι απολύτως δυνατό).
    const target = targetFor(tableA);
    setTableCellCursorById('B', { rowId: 'r1', colId: 'c1' }, 'nav');

    const plan = getTableFormatPort()!.commitModel(target, model('Α-πειραγμένο'));

    expect(plan.status).toBe('accepted');
    // 🔴 Η ουσία: ο **Α** πήρε το προσχέδιο, ο **Β** έμεινε ανέπαφος.
    // Πριν το §63 το αποτέλεσμα ήταν `{ A: 'Α-όπως-άνοιξε', B: 'Α-πειραγμένο' }` — δηλαδή ο
    // πίνακας Β αντικαταστάθηκε από το μοντέλο του Α, χωρίς κανένα σφάλμα.
    expect(tags()).toEqual({ A: 'Α-πειραγμένο', B: 'Β-ανέπαφος' });
  });

  it('🔴 Κ5 — ΚΑΝΕΝΑΣ δρομέας (Escape έξω από την παλέτα): το «ΟΚ» γράφει, δεν σιωπά', () => {
    const tableA = tableEntity('A', 'Α-όπως-άνοιξε');
    const { tags } = harness([tableA]);
    const target = targetFor(tableA);

    // Καμία κλήση `setTableCellCursor`: η συνεδρία είναι νεκρή, όπως μετά από `Escape` με την
    // εστίαση έξω από την παλέτα (μετρημένο ζωντανά στο §62).
    const plan = getTableFormatPort()!.commitModel(target, model('Α-πειραγμένο'));

    // Πριν το §63: `if (!live) return` ⇒ **τίποτα**, και ο διάλογος έκλεινε σαν να έγραψε.
    expect(plan.status).toBe('accepted');
    expect(tags()).toEqual({ A: 'Α-πειραγμένο' });
  });

  it('🔴 Κ6 — ο πίνακας ΔΙΑΓΡΑΦΗΚΕ: άρνηση με λόγο, καμία γραφή', () => {
    const ghost = tableEntity('ghost', 'φάντασμα');
    const { tags } = harness([tableEntity('A', 'Α-ανέπαφος')]);

    const plan = getTableFormatPort()!.commitModel(targetFor(ghost), model('προσχέδιο'));

    expect(plan).toEqual({ status: 'refused', reason: 'target-missing' });
    expect(tags()).toEqual({ A: 'Α-ανέπαφος' });
  });

  it('🔴 Κ7 — ο πίνακας ΑΛΛΑΞΕ στο μεταξύ: άρνηση, και η ενδιάμεση αλλαγή ΕΠΙΖΕΙ', () => {
    const tableA = tableEntity('A', 'Α-όπως-άνοιξε');
    const { tags } = harness([tableA]);
    // Ο στόχος κρατά το μοντέλο **του ανοίγματος**…
    const target = targetFor(tableA);

    // …και κάποιος γράφει στο μεταξύ (πληκτρολόγηση κελιού / κουμπί κορδέλας / `Ctrl+Z`).
    getTableFormatPort()!.commitModel(target, model('Α-γράφτηκε-στο-μεταξύ'));

    // Το «ΟΚ» του διαλόγου φτάνει **μετά**, με μπαγιάτικη βάση.
    const plan = getTableFormatPort()!.commitModel(target, model('Α-από-τον-διάλογο'));

    expect(plan).toEqual({ status: 'refused', reason: 'target-changed' });
    // 🔴 Η ουσία: η ενδιάμεση γραφή **δεν σβήστηκε**. Πριν το §63 το αποτέλεσμα εδώ ήταν
    // `Α-από-τον-διάλογο`, δηλαδή lost update — και σιωπηλή.
    expect(tags()).toEqual({ A: 'Α-γράφτηκε-στο-μεταξύ' });
  });
});
