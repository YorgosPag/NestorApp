/**
 * 🔴 **ADR-753 §29 — Η ΠΡΑΓΜΑΤΙΚΗ ΑΛΥΣΙΔΑ `Ctrl+C` → `Ctrl+V`, ΜΕ ΤΟΥΣ ΠΡΑΓΜΑΤΙΚΟΥΣ ΧΕΙΡΙΣΤΕΣ.**
 *
 * Το ελάττωμα του §29 (η μορφοποίηση **ανά χαρακτήρα** δεν επιβίωνε της επικόλλησης) είναι
 * πλέον καρφωμένο στο **καθαρό** επίπεδο, στο `table-clipboard-paste.test.ts`. Αυτό εδώ φυλάει
 * κάτι που εκείνο **δομικά δεν μπορεί**: ότι η αλυσίδα από το πάτημα ως το μοντέλο είναι
 * συνδεδεμένη — μάθημα #1 του §28, *«ένας χειριστής που ΥΠΑΡΧΕΙ δεν είναι χειριστής που
 * ΔΟΥΛΕΥΕΙ»* (η εφαρμογή είχε σκάσει στο πρώτο πλήκτρο με **608/608** πράσινα).
 *
 * ## 🔑 ΤΙ ΜΕΤΡΙΕΤΑΙ ΕΔΩ ΚΑΙ ΠΟΥΘΕΝΑ ΑΛΛΟΥ — **Ο ΦΡΟΥΡΟΣ ΤΟΥ ΑΠΟΤΥΠΩΜΑΤΟΣ**
 * Το εσωτερικό φορτίο ισχύει **μόνο** όταν `getData('text/plain') === payload.text` (δες
 * `table-clipboard-resolve.ts`). Είναι μια σύγκριση αλφαριθμητικών ανάμεσα σε **δύο** παραγωγούς
 * που τυχαίνει να είναι ο ίδιος — και αν πάψουν να είναι, η επικόλληση πέφτει σιωπηλά στον
 * **εξωτερικό** δρόμο και δίνει γυμνό κείμενο. Δηλαδή **ακριβώς το σύμπτωμα που ανέφερε ο
 * ιδιοκτήτης**, αλλά από άλλη αιτία. Καμία άγκυρα δεν το φύλαγε.
 *
 * ⚠️ Ο **εξωτερικός** δρόμος ελέγχεται κι αυτός, στο ίδιο αρχείο: μια διόρθωση που θα έκανε τα
 * runs να ταξιδεύουν σπάζοντας την επικόλληση από Excel/σημειωματάριο δεν είναι διόρθωση.
 *
 * @see ../use-table-range-actions.ts — οι χειριστές που εκτελούνται
 * @see ../../../bim/table/table-clipboard-resolve.ts — ο κανόνας των πέντε καταστάσεων
 */

import { renderHook } from '@testing-library/react';

// ⚠️ **Σφάλμα ΠΕΡΙΒΑΛΛΟΝΤΟΣ, όχι της πύλης** (μάθημα CHECK 3.46): ο εφαρμοστής επικόλλησης
// ζητά `useNotifications`, που πετά εκτός provider. Χωρίς αυτούς τους δύο mocks η σουίτα
// αποτυγχάνει με μήνυμα που διαβάζεται ως «η επικόλληση είναι σπασμένη».
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({
    success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn(),
    notify: jest.fn(), loading: jest.fn(), showConfirmDialog: jest.fn(),
  }),
}));

import { useTableRangeActions } from '../use-table-range-actions';
import { __resetTableClipboardForTests } from '../../../state/table-clipboard-store';
import { setTableCellSelection } from '../../../state/table-cell-cursor-store';
import { createTableClipboardHarness, type TableClipboardHarness } from './table-clipboard-harness';
import { cellText, getCell, resolveTableModel } from '../../../bim/table/table-model-helpers';
import type { PersistedTableModel, TableCellTextRun } from '../../../types/table';
import type { TableCellCursorState } from '../../../state/table-cell-cursor-store';

const RED = '#ff0000';

const RUNS: readonly TableCellTextRun[] = [
  { start: 0, end: 3, style: { textColorHex: RED, bold: true } },
];

/** r0 = «ΝΕΣΤΩΡ» με τα τρία πρώτα γράμματα κόκκινα· r1 κενό, ο στόχος. */
function model(): PersistedTableModel {
  return {
    columns: [{ id: 'c0', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' }],
    rows: [{ id: 'r0', rowClass: 'data' }, { id: 'r1', rowClass: 'data' }],
    cells: [['r0', 'c0', { kind: 'text', value: 'ΝΕΣΤΩΡ', runs: RUNS }]],
    merges: [],
  };
}

/**
 * 🔑 **ΕΝΑ ΠΡΟΧΕΙΡΟ ΣΥΣΤΗΜΑΤΟΣ ΠΟΥ ΘΥΜΑΤΑΙ** — ό,τι γράφτηκε με `setData` διαβάζεται με
 * `getData`, όπως ακριβώς κάνει ο browser ανάμεσα σε δύο συμβάντα.
 *
 * ⚠️ Ένα διπλό stub (άλλο για γράψιμο, άλλο για διάβασμα) θα έκανε τον φρουρό του αποτυπώματος
 * **αδύνατο να αποτύχει** — δηλαδή θα ήταν πράσινο ακριβώς στο πράγμα που μετράει.
 */
function systemClipboard() {
  const data = new Map<string, string>();
  return {
    store: data,
    event: () => ({
      preventDefault: jest.fn(),
      clipboardData: {
        setData: (type: string, value: string) => { data.set(type, value); },
        getData: (type: string) => data.get(type) ?? '',
      },
    }),
  };
}

function navCursor(): TableCellCursorState {
  return {
    entityId: 'table-1',
    position: { rowId: 'r0', colId: 'c0' },
    selection: null,
    mode: 'nav',
  } as unknown as TableCellCursorState;
}

function renderActions(harness: TableClipboardHarness, cursor: TableCellCursorState) {
  return renderHook(() => useTableRangeActions({
    cursor,
    entity: harness.liveTable(),
    levelManager: harness.levelManager,
    execute: harness.execute,
  }));
}

/** Τα runs του κελιού **στη ζωντανή σκηνή**, όχι σε στιγμιότυπο. */
function liveRuns(harness: TableClipboardHarness, rowId: string) {
  const resolved = resolveTableModel(harness.currentModel());
  return getCell(resolved, rowId, 'c0')?.runs;
}

function liveText(harness: TableClipboardHarness, rowId: string): string {
  const resolved = resolveTableModel(harness.currentModel());
  const cell = getCell(resolved, rowId, 'c0');
  return cell ? cellText(cell) : '';
}

beforeEach(() => {
  __resetTableClipboardForTests();
  setTableCellSelection(null);
});

describe('🔴 ADR-753 §29 — το `Ctrl+V` μεταφέρει τη μορφοποίηση ΧΑΡΑΚΤΗΡΩΝ', () => {
  it('βάση: το `Ctrl+C` γράφει ΚΑΙ το TSV ΚΑΙ το εσωτερικό φορτίο', () => {
    const harness = createTableClipboardHarness(model());
    const clipboard = systemClipboard();
    const { result } = renderActions(harness, navCursor());

    result.current.onCopy(clipboard.event() as never);

    expect(clipboard.store.get('text/plain')).toBe('ΝΕΣΤΩΡ');
  });

  it('🔴 Η ΑΛΥΣΙΔΑ: αντιγραφή r0 → επικόλληση r1 ⇒ τα κόκκινα γράμματα ΤΑΞΙΔΕΥΟΥΝ', () => {
    const harness = createTableClipboardHarness(model());
    const clipboard = systemClipboard();

    renderActions(harness, navCursor()).result.current.onCopy(clipboard.event() as never);

    // Ο δρομέας μετακινείται στο r1 — η **αφετηρία** της επικόλλησης.
    const target = { ...navCursor(), position: { rowId: 'r1', colId: 'c0' } };
    renderActions(harness, target as TableCellCursorState)
      .result.current.onPaste(clipboard.event() as never);

    expect(liveText(harness, 'r1')).toBe('ΝΕΣΤΩΡ');
    expect(liveRuns(harness, 'r1')?.[0]?.style.textColorHex).toBe(RED);
    expect(liveRuns(harness, 'r1')?.[0]?.style.bold).toBe(true);
  });

  it('🔑 Ο ΦΡΟΥΡΟΣ ΤΟΥ ΑΠΟΤΥΠΩΜΑΤΟΣ: ξένο κείμενο ⇒ ΜΟΝΟ τιμές, καμία μορφή', () => {
    const harness = createTableClipboardHarness(model());
    const clipboard = systemClipboard();

    renderActions(harness, navCursor()).result.current.onCopy(clipboard.event() as never);
    // Ο χρήστης αντέγραψε αλλού στο μεταξύ: το πρόχειρο του συστήματος δεν λέει πια το δικό μας.
    clipboard.store.set('text/plain', 'ΞΕΝΟ');

    const target = { ...navCursor(), position: { rowId: 'r1', colId: 'c0' } };
    renderActions(harness, target as TableCellCursorState)
      .result.current.onPaste(clipboard.event() as never);

    expect(liveText(harness, 'r1')).toBe('ΞΕΝΟ');
    expect(liveRuns(harness, 'r1')).toBeUndefined();
  });
});
