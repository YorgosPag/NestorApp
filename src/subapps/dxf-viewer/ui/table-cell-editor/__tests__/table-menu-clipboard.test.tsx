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
import {
  createTableClipboardHarness,
  type TableClipboardHarness,
} from './table-clipboard-harness';
import {
  clipboardTextToTableGrid,
  pasteTsvIntoTable,
  tableRangeToClipboardText,
} from '../../../bim/table/table-range-clipboard';
import { getTableCopyMarquee } from '../../../state/table-copy-marquee-store';
import { __resetTableClipboardForTests } from '../../../state/table-clipboard-store';
import { cellText, getCell, resolveTableModel } from '../../../bim/table/table-model-helpers';
import type { TableCellRangeBounds } from '../../../bim/table/table-cell-range';
import type { PersistedTableModel } from '../../../types/table';

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

// 🔴 ADR-753 §29 — το στήσιμο της σκηνής **εξήχθη** στο `table-clipboard-harness.ts` όταν το
// ζήτησε και η διαδρομή του πληκτρολογίου. Δες την κεφαλίδα του για το γιατί δύο αντίγραφα θα
// μετρούσαν τις δύο διαδρομές σε **διαφορετικό κόσμο** ενώ θα ισχυρίζονταν ότι λένε τα ίδια.
const createHarness = (): TableClipboardHarness => createTableClipboardHarness(model());

/** Στήνει `navigator.clipboard` με ρητή συμπεριφορά ανά test — ποτέ σιωπηλό κενό. */
function stubClipboard(impl: Partial<Clipboard>): void {
  Object.defineProperty(navigator, 'clipboard', { value: impl, configurable: true });
}

function renderClipboard(harness: TableClipboardHarness) {
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
  // 🔴 ADR-739 §57 — **υποχρεωτικό**: το εσωτερικό πρόχειρο είναι store επιπέδου module, άρα
  // επιβιώνει μεταξύ tests. Χωρίς αυτό, η αντιγραφή του §2 άφηνε φορτίο που έκανε τα tests του
  // §3/§4 να περνούν από τον κλάδο «τυφλής» επικόλλησης — δηλαδή **δύο άγκυρες θα μετρούσαν
  // άλλη συμπεριφορά από αυτή που δηλώνει το όνομά τους**, ανάλογα με τη σειρά εκτέλεσης.
  __resetTableClipboardForTests();
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
// 3β. ADR-739 §57 — το ΕΣΩΤΕΡΙΚΟ πρόχειρο
// ──────────────────────────────────────────────────────────────────────────────

describe('§57 — το φορτίο της εφαρμογής και το αποτύπωμά του', () => {
  /** Αντιγράφει πραγματικά, ώστε να υπάρχει φορτίο **και** να ξέρουμε το αποτύπωμά του. */
  async function copyFirst(harness: TableClipboardHarness): Promise<string> {
    const writeText = jest.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    const { result } = renderClipboard(harness);
    await act(async () => { await result.current.copy(A1_B2); });
    return String(writeText.mock.calls[0][0]);
  }

  it('🔴 άρνηση ανάγνωσης ΜΕ φορτίο ⇒ επικολλά το δικό μας και ΤΟ ΛΕΕΙ (το Sheets παραιτείται εδώ)', async () => {
    const harness = createHarness();
    await copyFirst(harness);

    stubClipboard({ readText: jest.fn().mockRejectedValue(new Error('NotAllowedError')) });
    const { result } = renderClipboard(harness);
    await act(async () => { await result.current.paste(A1_B2); });

    expect(harness.commands).toHaveLength(1);
    // Ενημέρωση («επικολλήθηκε το τελευταίο αντίγραφο»), ΟΧΙ προειδοποίηση άρνησης.
    expect(info).toHaveBeenCalledTimes(1);
    expect(warning).not.toHaveBeenCalled();
  });

  it('🔴 ΞΕΝΟ κείμενο στο πρόχειρο ⇒ το φορτίο αγνοείται, νικά ο έξω κόσμος', async () => {
    const harness = createHarness();
    await copyFirst(harness);

    stubClipboard({ readText: jest.fn().mockResolvedValue('ΑΛΛΟ') });
    const { result } = renderClipboard(harness);
    await act(async () => { await result.current.paste(A1_B2); });

    expect(textAt(harness.currentModel(), 'r0', 'c0')).toBe('ΑΛΛΟ');
  });

  it('🔴 «Επικόλληση Μορφοποίησης» πάνω σε ΞΕΝΟ κείμενο αρνείται — ποτέ σβήσιμο δεδομένων', async () => {
    const harness = createHarness();
    await copyFirst(harness);

    stubClipboard({ readText: jest.fn().mockResolvedValue('ΑΛΛΟ') });
    const { result } = renderClipboard(harness);
    await act(async () => {
      await result.current.pasteAs(A1_B2, { content: 'none', facets: new Set(['fill']) });
    });

    expect(harness.commands).toHaveLength(0);
    expect(warning).toHaveBeenCalledTimes(1);
    // Το κρίσιμο: ο στόχος ΔΕΝ πήρε το ξένο κείμενο ως «τιμές».
    expect(textAt(harness.currentModel(), 'r0', 'c0')).toBe('a\tb');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. Η σημαία λέει την αλήθεια
// ──────────────────────────────────────────────────────────────────────────────

describe('canPaste — δηλώνει ΙΚΑΝΟΤΗΤΑ, όχι περιεχόμενο', () => {
  it('χωρίς `readText` στο περιβάλλον ΚΑΙ χωρίς φορτίο ⇒ `false` (το item μένει γκρίζο)', () => {
    stubClipboard({});
    const { result } = renderClipboard(createHarness());
    expect(result.current.canPaste()).toBe(false);
  });

  it('🔴 §57 — χωρίς `readText` αλλά ΜΕ δικό μας φορτίο ⇒ `true`: η εντολή μένει ζωντανή', async () => {
    const harness = createHarness();
    const writeText = jest.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    const first = renderClipboard(harness);
    await act(async () => { await first.result.current.copy(A1_B2); });

    // Firefox/Safari χωρίς χειρονομία επικόλλησης: `readText` ανύπαρκτο.
    stubClipboard({ writeText });
    const { result } = renderClipboard(harness);
    expect(result.current.canPaste()).toBe(true);
  });

  it('με `readText` ⇒ `true` — «μπορεί να επιχειρηθεί», και η αποτυχία λέγεται μετά', () => {
    stubClipboard({ readText: jest.fn() });
    const { result } = renderClipboard(createHarness());
    expect(result.current.canPaste()).toBe(true);
  });
});
