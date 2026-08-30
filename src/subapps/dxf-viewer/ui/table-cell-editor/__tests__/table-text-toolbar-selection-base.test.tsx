/**
 * 🔴 ADR-753 §25 — **ΠΑΝΩ ΣΕ ΠΟΙΟ ΚΕΙΜΕΝΟ ΔΕΙΧΝΟΥΝ ΟΙ ΔΕΙΚΤΕΣ ΠΟΥ ΜΟΛΙΣ ΕΓΡΑΨΕ ΤΟ «Β»;**
 *
 * ## Τι κρίνεται εδώ, και γιατί δεν το έκρινε καμία υπάρχουσα σουίτα
 * Το `table-chars-format-scope.test.ts` κρίνει τις **πράξεις** πάνω σε έναν στόχο που του
 * δίνεται έτοιμος· το `table-text-draft-sync.test.ts` κρίνει τη **γραφή του προχείρου**
 * μεμονωμένα. Ανάμεσά τους έμενε αδοκίμαστο ακριβώς το σημείο όπου τα δύο **ζευγαρώνουν**: ο
 * `use-table-text-toolbar` διαβάζει τους δείκτες από το **πεδίο του DOM** και έστελνε το
 * κείμενο από το **πρόχειρο του δρομέα**. Δύο πηγές για ένα πράγμα, χωρίς καμία σύγκριση.
 *
 * ## 🔴 Η ΒΛΑΒΗ, ΜΕ ΑΡΙΘΜΟΥΣ (ADR-753 §24.3 → §25)
 * ```
 *   πεδίο:    «ΝΕΣΤΩΡ»   επιλογή [2,4) = «ΣΤ»
 *   πρόχειρο: «ΝΕΣΤ»     ⇒ το μοντέλο παίρνει 4 χαρακτήρες, το run γράφεται [2,4)
 *   δέσμευση: «ΝΕΣΤΩΡ»   ⇒ remapCellTextRuns: το «Ω» και το «Ρ» ΚΛΗΡΟΝΟΜΟΥΝ από αριστερά
 *                          ⇒ [2,6) = «ΣΤΩΡ» — ΤΕΣΣΕΡΑ έντονα αντί για δύο
 * ```
 * Και η **ζωντανή**, χειρότερη μορφή της: σε κατάσταση **πλοήγησης** το πρόχειρο είναι `''` ενώ
 * η γραμμή τύπων δείχνει το δεσμευμένο κείμενο ⇒ το πάτημα «Β» **άδειαζε το κελί**.
 *
 * ⚠️ Οι άγκυρες κλειδώνουν **το εύρος**, ποτέ το πλήθος των runs: ένα «ένα run» θα ήταν εξίσου
 * αληθές για το `[2,4)` και για το `[2,6)`, δηλαδή θα έμενε πράσινο πάνω στη βλάβη.
 *
 * @see ui/table-cell-editor/use-table-text-toolbar.ts — ο ιδιοκτήτης που ζευγαρώνει τα δύο
 * @see bim/table/table-cell-run-ops.ts — `TableTextAnchoredRange`, `remapCellTextRuns`
 * @see docs/centralized-systems/reference/adrs/ADR-753-table-cell-rich-text.md §25
 */

import { renderHook, act } from '@testing-library/react';

import { useTableTextToolbar } from '../use-table-text-toolbar';
import {
  __resetTableTextMenuPortForTests,
  getTableTextMenuPort,
} from '../table-text-menu-port';
import {
  __resetTableCellCursorStoreForTests,
  setTableCellCursorDraft,
} from '../../../state/table-cell-cursor-store';
import { setTableCellCursorById } from '../../../bim/table/__tests__/make-table-entity';
import { resetGlobalCommandHistory } from '../../../core/commands';
import { buildTableCellEditCommand } from '../../../bim/table/table-cell-edit-session';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import type { PersistedTableModel, TableCell, TableCellTextRun } from '../../../types/table';
import type { SceneModel } from '../../../types/scene';
import type { TableEntity } from '../../../types/table-entity';
import type { LevelManagerLike } from '../../../hooks/canvas/canvas-click-types';
import type { TableTextToolbarHandle } from '../../components/table-text-menu/table-text-toolbar-types';
import { activeTableModel } from '../../../bim/table/table-worksheet-resolve';

const LEVEL = 'level-1';
const ENTITY = 'table-1';
const AT = { rowId: 'r1', colId: 'c0' } as const;
/** `ΝΕΣΤΩΡ` — έξι χαρακτήρες, το ίδιο κείμενο με το ζωντανό εύρημα του §24.3. */
const TEXT = 'ΝΕΣΤΩΡ';

function tableModel(cell?: TableCell): PersistedTableModel {
  return {
    columns: [{ id: 'c0', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' }],
    rows: [{ id: 'r1', rowClass: 'data' }],
    cells: cell === undefined ? [] : [['r1', 'c0', cell]],
    merges: [],
  } as unknown as PersistedTableModel;
}

/**
 * Σκηνή + ο **ΕΝΑΣ** δεσμευτής κελιού, αυτούσιος.
 *
 * Η δέσμευση **δεν** απομιμείται: καλείται το ίδιο `buildTableCellEditCommand` που καλεί το
 * `Enter` και το «Καταχώριση» (§24.3 απέκλεισε με ανάγνωση ότι υπάρχει δεύτερη διαδρομή). Χωρίς
 * αυτό, η άγκυρα δεν θα έβλεπε ποτέ το `remapCellTextRuns` — δηλαδή θα έχανε ακριβώς τον
 * ενισχυτή που κάνει τα δύο έντονα τέσσερα.
 */
function harness(model: PersistedTableModel) {
  let scene = {
    entities: [{ id: ENTITY, type: 'table', model } as unknown as TableEntity],
  } as unknown as SceneModel;

  const levelManager: LevelManagerLike = {
    currentLevelId: LEVEL,
    getLevelScene: (levelId: string) => (levelId === LEVEL ? scene : null),
    setLevelScene: (levelId: string, next: SceneModel) => {
      if (levelId === LEVEL) scene = next;
    },
  } as unknown as LevelManagerLike;

  const entity = (): TableEntity =>
    (scene as unknown as { entities: TableEntity[] }).entities[0];

  const cellOf = (): TableCell | undefined => {
    const cells = activeTableModel(entity()).cells as unknown as [string, string, TableCell][];
    return cells.find(([r, c]) => r === AT.rowId && c === AT.colId)?.[2];
  };

  return {
    levelManager,
    runs: (): readonly TableCellTextRun[] | undefined => cellOf()?.runs,
    text: (): unknown => cellOf()?.value,
    commit: (nextText: string): void => {
      buildTableCellEditCommand(
        entity(), AT.rowId, AT.colId, nextText,
        createLevelSceneManagerAdapter(
          levelManager.getLevelScene, levelManager.setLevelScene!, LEVEL,
        ),
      )?.execute();
    },
  };
}

function mountToolbar(levelManager: LevelManagerLike) {
  const handle: TableTextToolbarHandle = { open: () => {}, close: () => {} };
  const view = renderHook(() => useTableTextToolbar({ levelManager }));
  view.result.current.ref.current = handle;
  return view;
}

/** Ένα **πραγματικό** πεδίο κειμένου με επιλογή — η πηγή των δεικτών, όχι απομίμησή της. */
function fieldWithSelection(value: string, start: number, end: number): HTMLTextAreaElement {
  const node = document.createElement('textarea');
  node.value = value;
  document.body.appendChild(node);
  node.focus();
  node.setSelectionRange(start, end);
  return node;
}

/** Τα άκρα κάθε run — η μόνη μορφή που ξεχωρίζει το `[2,4)` από το `[2,6)`. */
const spans = (runs: readonly TableCellTextRun[] | undefined): [number, number][] =>
  (runs ?? []).map((run) => [run.start, run.end]);

describe('🔴 ADR-753 §25 — η βάση των δεικτών ταξιδεύει με τον στόχο', () => {
  beforeEach(() => {
    __resetTableTextMenuPortForTests();
    __resetTableCellCursorStoreForTests();
    resetGlobalCommandHistory();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    __resetTableTextMenuPortForTests();
    __resetTableCellCursorStoreForTests();
  });

  it('Μ0 — καθαρή ροή: γράφω σε άδειο κελί, μαρκάρω `[2,4)`, «Β», δεσμεύω', () => {
    const h = harness(tableModel());
    const view = mountToolbar(h.levelManager);

    setTableCellCursorById(ENTITY, AT, 'edit');
    act(() => { setTableCellCursorDraft(TEXT); });
    expect(getTableTextMenuPort()!.open(0, 0, fieldWithSelection(TEXT, 2, 4))).toBe(true);

    act(() => { view.result.current.props.formatActions.onToggle('bold'); });
    h.commit(TEXT);

    expect(h.text()).toBe(TEXT);
    expect(spans(h.runs())).toEqual([[2, 4]]);
  });

  it('🔴 Α1 — πρόχειρο ΠΡΟΘΕΜΑ του πεδίου: το εύρος μένει `[2,4)`, δεν απλώνεται ως το τέλος', () => {
    const h = harness(tableModel());
    const view = mountToolbar(h.levelManager);

    setTableCellCursorById(ENTITY, AT, 'edit');
    // Η απόκλιση: το store κρατά «ΝΕΣΤ», το πεδίο δείχνει «ΝΕΣΤΩΡ». Οι δείκτες μετρήθηκαν στο
    // **πεδίο** — άρα το κείμενο που φτάνει στο μοντέλο οφείλει να είναι εκείνο.
    act(() => { setTableCellCursorDraft('ΝΕΣΤ'); });
    expect(getTableTextMenuPort()!.open(0, 0, fieldWithSelection(TEXT, 2, 4))).toBe(true);

    act(() => { view.result.current.props.formatActions.onToggle('bold'); });
    h.commit(TEXT);

    // 🔴 Πριν το §25: `[[2, 6]]` — «ΣΤΩΡ», τέσσερα έντονα αντί για δύο.
    expect(spans(h.runs())).toEqual([[2, 4]]);
    expect(h.text()).toBe(TEXT);
  });

  it('🔴 Α2 — γραμμή τύπων σε ΠΛΟΗΓΗΣΗ: το κελί ΔΕΝ αδειάζει', () => {
    const h = harness(tableModel({ kind: 'text', value: TEXT } as TableCell));
    const view = mountToolbar(h.levelManager);

    // Σε πλοήγηση το πρόχειρο του δρομέα είναι `''` **εξ ορισμού** (δες το store), ενώ η γραμμή
    // τύπων δείχνει το **δεσμευμένο** κείμενο. Μαρκάρω εκεί δύο γράμματα και πατάω «Β».
    setTableCellCursorById(ENTITY, AT, 'nav');
    const bar = document.createElement('input');
    bar.type = 'text';
    bar.value = TEXT;
    document.body.appendChild(bar);
    bar.focus();
    bar.setSelectionRange(2, 4);

    expect(getTableTextMenuPort()!.open(0, 0, bar)).toBe(true);
    act(() => { view.result.current.props.formatActions.onToggle('bold'); });

    // 🔴 Πριν το §25: `''` — το κελί άδειαζε, σιωπηλά, με ένα πάτημα μορφοποίησης.
    expect(h.text()).toBe(TEXT);
    expect(spans(h.runs())).toEqual([[2, 4]]);
  });

  it('Α3 — `Enter` πάνω σε κουμπί (εστίαση ΕΚΤΟΣ πεδίου) δεν μετακινεί το εύρος', () => {
    // 🔬 Η υπόθεση του §24.3 («ο φρουρός *εστιασμένο ⇒ σιωπή* δεν σιωπά, άρα η επαναφορά
    // τρέχει πάνω σε πεδίο που μόλις ξαναγράφτηκε») **μετρήθηκε και είναι ψευδής**: το
    // `prepare` γράφει στο **μοντέλο**, ποτέ στο πεδίο — και το `restoreTableTextSelection`
    // κάνει `setSelectionRange`, που δεν μπορεί να μετακινήσει εύρος που δεν άλλαξε.
    // Η άγκυρα μένει ώστε η επόμενη αλλαγή του φρουρού να το ξαναποδείξει.
    const h = harness(tableModel());
    const view = mountToolbar(h.levelManager);

    setTableCellCursorById(ENTITY, AT, 'edit');
    act(() => { setTableCellCursorDraft(TEXT); });
    expect(getTableTextMenuPort()!.open(0, 0, fieldWithSelection(TEXT, 2, 4))).toBe(true);

    // Το πραγματικό κλικ σε κουμπί της γραμμής **μεταφέρει την εστίαση** (δεν υπάρχει
    // `preventDefault` στο `mousedown` του `ToolbarButton`), άρα το `Enter` που ακολουθεί
    // ξαναπατά το ίδιο κουμπί: on → off → on.
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();

    act(() => { view.result.current.props.formatActions.onToggle('bold'); });
    act(() => { view.result.current.props.formatActions.onToggle('bold'); });
    act(() => { view.result.current.props.formatActions.onToggle('bold'); });
    h.commit(TEXT);

    expect(spans(h.runs())).toEqual([[2, 4]]);
  });
});
