/**
 * 🔴 ADR-739 §54 — **ΤΟ ΠΡΟΧΕΙΡΟ ΑΠΟ ΤΟ ΜΕΝΟΥ ΔΕΞΙΟΥ ΚΛΙΚ**, εκεί που δεν υπάρχει
 * `ClipboardEvent` να ρωτηθεί.
 *
 * Οι καθαρές πράξεις (`table-range-clipboard`) και η σειριοποίηση (`lib/spreadsheet/tsv`) έχουν
 * δικές τους σουίτες. Εδώ μετριέται ό,τι **μόνο** η γέφυρα μπορεί να σπάσει, και είναι τρία:
 *
 *  1. **ΜΙΑ σειριοποίηση, δύο δρόμοι.** Το κείμενο που παράγει το μενού πρέπει να επιστρέφει
 *     ακέραιο μέσα από τον parser — αλλιώς ένα κελί με **στηλοθέτη** μετατοπίζει όλη τη γραμμή,
 *     και ο μόνος που θα το δει είναι ο χρήστης.
 *  2. **Η ΑΡΝΗΣΗ του προχείρου δεν γίνεται ΑΠΩΛΕΙΑ.** Η «Αποκοπή» αδειάζει **μόνο** αν η
 *     αντιγραφή πέτυχε: με αντεστραμμένη σειρά (ή χωρίς έλεγχο) μια άρνηση άδειας σβήνει
 *     δεδομένα που δεν μπήκαν πουθενά.
 *  3. **Καμία εξαίρεση δεν ανεβαίνει.** Το `navigator.clipboard` απορρίπτει· μια `Promise` που
 *     σκάει μέσα σε χειριστή μενού καταλήγει σε `unhandledrejection`, δηλαδή «πάτησα και δεν
 *     έγινε τίποτα».
 *
 * @see ui/table-cell-editor/use-table-menu-clipboard.ts
 */

import { act, renderHook } from '@testing-library/react';

const warning = jest.fn();
const info = jest.fn();

// Το κλειδί **είναι** το μήνυμα εδώ: αυτή η σουίτα μετρά «ειπώθηκε;», όχι «με ποια λέξη».
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({
    success: jest.fn(), error: jest.fn(), info, warning,
    notify: jest.fn(), loading: jest.fn(), showConfirmDialog: jest.fn(),
  }),
}));

import { useTableMenuClipboard } from '../use-table-menu-clipboard';
import { buildTableEntity } from '../../../bim/table/build-table-entity';
import {
  clipboardTextToTableGrid,
  pasteTsvIntoTable,
  tableRangeToClipboardText,
} from '../../../bim/table/table-range-clipboard';
import { getTableCopyMarquee } from '../../../state/table-copy-marquee-store';
import { cellText, getCell, resolveTableModel } from '../../../bim/table/table-model-helpers';
import type { ICommand } from '../../../core/commands';
import type { TableCellRangeBounds } from '../../../bim/table/table-cell-range';
import type { PersistedTableModel } from '../../../types/table';
import type { TableEntity } from '../../../types/table-entity';
import type { LevelManagerLike } from '../../../hooks/canvas/canvas-click-types';

const LEVEL_ID = 'level-1';
const A1_B2: TableCellRangeBounds = { firstRow: 0, lastRow: 1, firstCol: 0, lastCol: 1 };

/** Δύο × δύο κελιά, με **στηλοθέτη μέσα** στο ένα — ο λόγος ύπαρξης του quoting. */
function model(): PersistedTableModel {
  return {
    columns: [
      { id: 'c0', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
      { id: 'c1', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
    ],
    rows: [{ id: 'r0', rowClass: 'data' }, { id: 'r1', rowClass: 'data' }],
    cells: [
      ['r0', 'c0', { kind: 'text', value: 'a\tb' }],
      ['r0', 'c1', { kind: 'text', value: 'B' }],
      ['r1', 'c0', { kind: 'text', value: 'C' }],
      ['r1', 'c1', { kind: 'text', value: 'D' }],
    ],
    merges: [],
  };
}

interface Harness {
  readonly levelManager: LevelManagerLike;
  readonly liveTable: () => TableEntity | null;
  readonly execute: (command: ICommand) => void;
  readonly commands: ICommand[];
  readonly currentModel: () => PersistedTableModel;
}

function createHarness(): Harness {
  const table: TableEntity = {
    ...buildTableEntity({ x: 0, y: 0 }, {}, 'table-1', 'layer-0'),
    model: model(),
  };
  let scene = { entities: [table] } as unknown as ReturnType<LevelManagerLike['getLevelScene']>;

  const levelManager = {
    currentLevelId: LEVEL_ID,
    getLevelScene: () => scene,
    setLevelScene: (_id: string, next: typeof scene) => { scene = next; },
  } as unknown as LevelManagerLike;

  const liveTable = (): TableEntity | null => {
    const found = scene?.entities.find((e) => e.id === 'table-1');
    return (found as unknown as TableEntity) ?? null;
  };

  const commands: ICommand[] = [];
  // Η εντολή εκτελείται **στ' αλήθεια**: η σκηνή γράφεται από την κανονική διαδρομή, αλλιώς
  // το test θα μετρούσε προθέσεις αντί για αποτέλεσμα (ADR-587).
  const execute = (command: ICommand): void => { commands.push(command); command.execute(); };

  return { levelManager, liveTable, execute, commands, currentModel: () => liveTable()!.model };
}

/** Στήνει `navigator.clipboard` με ρητή συμπεριφορά ανά test — ποτέ σιωπηλό κενό. */
function stubClipboard(impl: Partial<Clipboard>): void {
  Object.defineProperty(navigator, 'clipboard', { value: impl, configurable: true });
}

function renderClipboard(harness: Harness) {
  return renderHook(() => useTableMenuClipboard({
    levelManager: harness.levelManager,
    execute: harness.execute,
    liveTable: harness.liveTable,
  }));
}

const textAt = (m: PersistedTableModel, rowId: string, colId: string): string =>
  cellText(getCell(resolveTableModel(m), rowId, colId));

beforeEach(() => {
  warning.mockClear();
  info.mockClear();
});

// ──────────────────────────────────────────────────────────────────────────────
// 1. ΜΙΑ σειριοποίηση — το κείμενο του μενού είναι το κείμενο του πληκτρολογίου
// ──────────────────────────────────────────────────────────────────────────────

describe('η καθαρή γέφυρα TSV — ΕΝΑΣ σειριοποιητής για τους δύο δρόμους', () => {
  it('🔴 κελί με ΣΤΗΛΟΘΕΤΗ επιβιώνει του κύκλου κείμενο → πλέγμα → επικόλληση', () => {
    // Με αφελές `split('\t')` το `a\tb` θα γινόταν δύο κελιά και ολόκληρη η γραμμή θα
    // ολίσθαινε — το ακριβές σφάλμα που το quoting του RFC 4180 υπάρχει για να αποκλείσει.
    const text = tableRangeToClipboardText(model(), A1_B2);
    expect(text).not.toBeNull();

    const grid = clipboardTextToTableGrid(text as string);
    expect(grid).toEqual([['a\tb', 'B'], ['C', 'D']]);

    const target = pasteTsvIntoTable(model(), { rowId: 'r0', colId: 'c0' }, grid);
    expect(textAt(target.model, 'r0', 'c0')).toBe('a\tb');
    expect(textAt(target.model, 'r1', 'c1')).toBe('D');
  });

  it('κενή περιοχή (όρια εκτός πλέγματος) ⇒ `null`, ποτέ κενό αλφαριθμητικό', () => {
    expect(tableRangeToClipboardText(model(), {
      firstRow: 0, lastRow: 0, firstCol: 9, lastCol: 9,
    })).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. Αντιγραφή / αποκοπή
// ──────────────────────────────────────────────────────────────────────────────

describe('αντιγραφή & αποκοπή — το πρόχειρο γράφεται ΠΡΙΝ αδειάσει οτιδήποτε', () => {
  it('η αντιγραφή γράφει TSV και ανάβει τα μυρμήγκια, χωρίς να αγγίξει το μοντέλο', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    const harness = createHarness();
    const { result } = renderClipboard(harness);

    await act(async () => { await result.current.copy(A1_B2); });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(String(writeText.mock.calls[0][0])).toContain('"a\tb"');
    expect(harness.commands).toHaveLength(0);
    expect(getTableCopyMarquee()?.entityId).toBe('table-1');
  });

  it('🔴 η αποκοπή αδειάζει με ΜΙΑ εντολή — και μόνο αφού το πρόχειρο γράφτηκε', async () => {
    stubClipboard({ writeText: jest.fn().mockResolvedValue(undefined) });
    const harness = createHarness();
    const { result } = renderClipboard(harness);

    await act(async () => { await result.current.cut(A1_B2); });

    expect(harness.commands).toHaveLength(1);
    expect(textAt(harness.currentModel(), 'r0', 'c0')).toBe('');
    expect(textAt(harness.currentModel(), 'r1', 'c1')).toBe('');
  });

  it('🔴 ΑΡΝΗΣΗ του προχείρου ⇒ ΚΑΜΙΑ απώλεια: το μοντέλο μένει, ο χρήστης μαθαίνει', async () => {
    stubClipboard({ writeText: jest.fn().mockRejectedValue(new Error('denied')) });
    const harness = createHarness();
    const { result } = renderClipboard(harness);

    await act(async () => { await result.current.cut(A1_B2); });

    expect(harness.commands).toHaveLength(0);
    expect(textAt(harness.currentModel(), 'r0', 'c0')).toBe('a\tb');
    expect(warning).toHaveBeenCalledTimes(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. Επικόλληση
// ──────────────────────────────────────────────────────────────────────────────

describe('επικόλληση — ασύγχρονη ανάγνωση, ρητή αποτυχία', () => {
  it('γράφει το πλέγμα με γωνία το πάνω-αριστερά κελί του στόχου, με μία εντολή', async () => {
    stubClipboard({ readText: jest.fn().mockResolvedValue('X\tY') });
    const harness = createHarness();
    const { result } = renderClipboard(harness);

    await act(async () => { await result.current.paste(A1_B2); });

    expect(harness.commands).toHaveLength(1);
    expect(textAt(harness.currentModel(), 'r0', 'c0')).toBe('X');
    expect(textAt(harness.currentModel(), 'r0', 'c1')).toBe('Y');
    // Ό,τι δεν προσφέρθηκε δεν σβήνεται: η δεύτερη γραμμή μένει ανέπαφη.
    expect(textAt(harness.currentModel(), 'r1', 'c0')).toBe('C');
  });

  it('🔴 απόρριψη ανάγνωσης ⇒ προειδοποίηση, καμία εντολή, καμία εξαίρεση προς τα έξω', async () => {
    stubClipboard({ readText: jest.fn().mockRejectedValue(new Error('NotAllowedError')) });
    const harness = createHarness();
    const { result } = renderClipboard(harness);

    await act(async () => { await result.current.paste(A1_B2); });

    expect(harness.commands).toHaveLength(0);
    expect(warning).toHaveBeenCalledTimes(1);
  });

  it('πρόχειρο με κενό κείμενο ⇒ ενημέρωση, ΠΟΤΕ σβήσιμο των κελιών', async () => {
    stubClipboard({ readText: jest.fn().mockResolvedValue('') });
    const harness = createHarness();
    const { result } = renderClipboard(harness);

    await act(async () => { await result.current.paste(A1_B2); });

    expect(harness.commands).toHaveLength(0);
    expect(info).toHaveBeenCalledTimes(1);
    expect(textAt(harness.currentModel(), 'r0', 'c0')).toBe('a\tb');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. Η σημαία λέει την αλήθεια
// ──────────────────────────────────────────────────────────────────────────────

describe('canPaste — δηλώνει ΙΚΑΝΟΤΗΤΑ, όχι περιεχόμενο', () => {
  it('χωρίς `readText` στο περιβάλλον ⇒ `false` (το item μένει γκρίζο)', () => {
    stubClipboard({});
    const { result } = renderClipboard(createHarness());
    expect(result.current.canPaste()).toBe(false);
  });

  it('με `readText` ⇒ `true` — «μπορεί να επιχειρηθεί», και η αποτυχία λέγεται μετά', () => {
    stubClipboard({ readText: jest.fn() });
    const { result } = renderClipboard(createHarness());
    expect(result.current.canPaste()).toBe(true);
  });
});
