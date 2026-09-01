/**
 * 🔴 ADR-833 Φάση 4 — **ΟΙ ΠΕΝΤΕ ΕΝΤΟΛΕΣ ΤΟΥ ΜΕΝΟΥ ΚΑΡΤΕΛΑΣ ΠΡΕΠΕΙ ΝΑ ΕΠΙΒΙΩΝΟΥΝ ΤΟΥ
 * ΑΝΟΙΓΜΑΤΟΣ ΤΟΥ ΙΔΙΟΥ ΤΟΥ ΜΕΝΟΥ.**
 *
 * ## Το περιστατικό (ζωντανή επαλήθευση, 2026-09-01)
 * Δεξί κλικ σε καρτέλα ⇒ το μενού **ανοίγει** και η καρτέλα **ενεργοποιείται** (η ενεργοποίηση
 * τρέχει μέσα στο `open`, όσο ο δείκτης στέκεται ακόμη πάνω στην καρτέλα). Μετά, **καμία** από
 * τις πέντε εντολές δεν κάνει τίποτα: ούτε «Νέο φύλλο», ούτε «Μετονομασία», ούτε οι δύο
 * μετακινήσεις, ούτε η διαγραφή. Σιωπηλά, χωρίς σφάλμα.
 *
 * ## Η αιτία — δύο **διαφορετικές** στιγμές για την ίδια ερώτηση
 * ```
 *   open()          → getTableIndicatorHover() → entityId  ✅ ο δείκτης είναι ΑΚΟΜΗ στην καρτέλα
 *   onRename(target)→ getTableIndicatorHover() → null      ❌ το μενού ΕΧΕΙ ΗΔΗ πάρει τον δείκτη
 * ```
 * Το άνοιγμα ενός μενού Radix βάζει `pointer-events: none` στο `body`, οπότε το δοχείο του
 * καμβά παίρνει `mouseleave` — και ο `use-table-indicator-hover` **σβήνει τον δείκτη** (είναι
 * ο σωστός του ρόλος: ο άνθρωπος πραγματικά δεν δείχνει πια την καρτέλα). Άρα κάθε εντολή που
 * ξαναρωτά τον δείκτη **τη στιγμή της εκτέλεσης** ρωτά κάτι που έχει ήδη, εξ ορισμού, σβήσει.
 *
 * 🔑 **Η ίδια η δήλωση του στόχου το έλεγε ήδη**: `TableWorksheetMenuTarget` = *«Η καρτέλα,
 * **παγωμένη στο άνοιγμα**»*, με τις σημαίες «μπορώ;» να ταξιδεύουν μαζί της ώστε να απαντούν
 * *«για τη στιγμή που άνοιξε το μενού»*. Το **μόνο** που είχε μείνει έξω από το πάγωμα ήταν η
 * ταυτότητα του πίνακα — δηλαδή ακριβώς το κομμάτι που διαβαζόταν από πτητική πηγή.
 *
 * ## Γιατί καμία υπάρχουσα δοκιμασία δεν το έβλεπε
 * Το `table-worksheet-strip-chain.test.ts` καρφώνει την αλυσίδα **ως το λεξιλόγιο του
 * πατήματος** (`'worksheet-tab'` / `'worksheet-add'`) και σταματά εκεί. Καμία άγκυρα δεν
 * περνούσε από τους **πέντε πράκτορες** του μενού — το ίδιο σχήμα με το μάθημα της Φ7
 * («καμία άγκυρα δεν περνούσε από τον πραγματικό γραφέα»), σε δεύτερη εμφάνιση.
 *
 * @see ../use-table-worksheet-menu.ts — ο ΕΝΑΣ ιδιοκτήτης του «ποιος πίνακας;» για το μενού
 * @see ../../components/TableWorksheetContextMenu.tsx — ο στόχος που παγώνει στο άνοιγμα
 */

import { renderHook } from '@testing-library/react';
import { createRef } from 'react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ success: jest.fn(), error: jest.fn() }),
}));

const execute = jest.fn();
jest.mock('../../../core/commands', () => ({
  useCommandHistory: () => ({ execute }),
}));

const applyWorksheet = jest.fn(() => true);
const addWorksheet = jest.fn(() => true);
jest.mock('../use-table-worksheet-apply', () => ({
  useTableWorksheetApply: () => applyWorksheet,
  useTableWorksheetAdd: () => addWorksheet,
}));

const scenePatch = jest.fn();
jest.mock('../table-scene-patch', () => ({
  applyTableScenePatch: (...args: unknown[]) => scenePatch(...args),
}));

const renameOpen = jest.fn(() => true);
jest.mock('../table-worksheet-rename-open', () => ({
  openWorksheetRenameById: (params: unknown) => renameOpen(params),
}));

import { useTableWorksheetMenu } from '../use-table-worksheet-menu';
import { getTableWorksheetMenuPort } from '../table-worksheet-menu-port';
import {
  __resetTableIndicatorHoverForTests,
  setTableIndicatorHover,
} from '../../../state/table-indicator-hover-store';
import { buildTableEntity } from '../../../bim/table/build-table-entity';
import { tableWorksheetId } from '../../../types/table-worksheet';
import type { TableWorksheetMenuTarget } from '../../components/TableWorksheetContextMenu';
import type { TableEntity } from '../../../types/table-entity';
import type { ViewTransform } from '../../../rendering/types/Types';

const ENTITY_ID = 'tbl_menu';
const SECOND_SHEET = tableWorksheetId('ws_second');

/** Πίνακας με **δύο** φύλλα: αλλιώς «μετακίνηση» και «διαγραφή» δεν έχουν αντικείμενο. */
function twoSheetTable(): TableEntity {
  const base = buildTableEntity({ x: 0, y: 0 }, { columnCount: 3 }, ENTITY_ID, 'lyr_test');
  return {
    ...base,
    worksheets: [base.worksheets[0], { id: SECOND_SHEET, model: base.worksheets[0].model }],
  };
}

const TABLE = twoSheetTable();

const levelManager = {
  currentLevelId: 'lvl_test',
  getLevelScene: () => ({ entities: [TABLE] }),
} as never;

const TRANSFORM = { scale: 1, offsetX: 0, offsetY: 0 } as unknown as ViewTransform;

/**
 * Στήνει το hook, ανοίγει το μενού **με τον δείκτη πάνω στην καρτέλα**, και μετά **σβήνει τον
 * δείκτη** — ακριβώς ό,τι κάνει το πραγματικό άνοιγμα του μενού (δες την κεφαλίδα).
 */
function openMenuThenLoseHover(worksheetId = SECOND_SHEET) {
  const container = document.createElement('div');
  const containerRef = createRef<HTMLDivElement>() as { current: HTMLDivElement | null };
  containerRef.current = container;
  const transformRef = { current: TRANSFORM };

  const rendered = renderHook(() =>
    useTableWorksheetMenu({ containerRef, transformRef, levelManager }),
  );

  let target: TableWorksheetMenuTarget | null = null;
  rendered.result.current.ref.current = {
    open: (_x, _y, next) => {
      target = next;
    },
    close: () => {},
  };

  setTableIndicatorHover({ entityId: ENTITY_ID, target: { kind: 'worksheet-tab', worksheetId } });
  const opened = getTableWorksheetMenuPort()?.open(10, 20) ?? false;

  // 🔴 Η στιγμή που σκοτώνει τις πέντε εντολές: το μενού πήρε τον δείκτη.
  setTableIndicatorHover(null);

  return { opened, target, props: rendered.result.current.props, rendered };
}

beforeEach(() => {
  __resetTableIndicatorHoverForTests();
  jest.clearAllMocks();
});

describe('ADR-833 Φ4 — το μενού ανοίγει με τον δείκτη ζωντανό (η προϋπόθεση του περιστατικού)', () => {
  it('🔑 ο στόχος παγώνει στο άνοιγμα, με το φύλλο που έδειξε ο άνθρωπος', () => {
    const { opened, target } = openMenuThenLoseHover();
    expect(opened).toBe(true);
    expect(target?.worksheetId).toBe(SECOND_SHEET);
  });

  it('🔴 ο στόχος κουβαλά και την ΤΑΥΤΟΤΗΤΑ ΤΟΥ ΠΙΝΑΚΑ — αλλιώς κάθε εντολή ξαναρωτά πτητική πηγή', () => {
    const { target } = openMenuThenLoseHover();
    expect(target?.entityId).toBe(ENTITY_ID);
  });

  it('χωρίς δείκτη σε καρτέλα, το μενού ΔΕΝ ανοίγει (το δεξί κλικ πέφτει παρακάτω)', () => {
    const container = document.createElement('div');
    const containerRef = { current: container };
    const transformRef = { current: TRANSFORM };
    renderHook(() => useTableWorksheetMenu({ containerRef, transformRef, levelManager }));
    setTableIndicatorHover(null);
    expect(getTableWorksheetMenuPort()?.open(10, 20)).toBe(false);
  });
});

describe('🔴 ADR-833 Φ4 — ΟΙ ΠΕΝΤΕ ΕΝΤΟΛΕΣ ΜΕΤΑ ΤΗΝ ΑΠΩΛΕΙΑ ΤΟΥ ΔΕΙΚΤΗ', () => {
  it('🔑 «Μετονομασία» ανοίγει τον επεξεργαστή ονόματος, για ΑΥΤΟΝ τον πίνακα και ΑΥΤΟ το φύλλο', () => {
    const { target, props } = openMenuThenLoseHover();
    props.onRename(target!);
    expect(renameOpen).toHaveBeenCalledTimes(1);
    expect(renameOpen.mock.calls[0][0]).toMatchObject({
      entity: expect.objectContaining({ id: ENTITY_ID }),
      worksheetId: SECOND_SHEET,
    });
  });

  it('🔑 «Νέο φύλλο» φτάνει στον γραφέα', () => {
    const { target, props } = openMenuThenLoseHover();
    props.onAdd(target!);
    expect(addWorksheet).toHaveBeenCalledTimes(1);
    expect(addWorksheet.mock.calls[0][0]).toMatchObject({ id: ENTITY_ID });
  });

  it('🔑 «Διαγραφή φύλλου» φτάνει στον γραφέα, με σχέδιο που αφαιρεί ΑΥΤΟ το φύλλο', () => {
    const { target, props } = openMenuThenLoseHover();
    props.onDelete(target!);
    expect(applyWorksheet).toHaveBeenCalledTimes(1);
    const [live, plan] = applyWorksheet.mock.calls[0] as [TableEntity, { worksheets: readonly { id: string }[] } | null];
    expect(live.id).toBe(ENTITY_ID);
    expect(plan?.worksheets.some((sheet) => sheet.id === SECOND_SHEET)).toBe(false);
  });

  it('🔑 «Μετακίνηση αριστερά» φτάνει στον γραφέα, με το φύλλο στη νέα θέση', () => {
    const { target, props } = openMenuThenLoseHover();
    props.onMoveLeft(target!);
    expect(applyWorksheet).toHaveBeenCalledTimes(1);
    const [, plan] = applyWorksheet.mock.calls[0] as [TableEntity, { worksheets: readonly { id: string }[] }];
    expect(plan.worksheets[0].id).toBe(SECOND_SHEET);
  });

  it('«Μετακίνηση δεξιά» στο τελευταίο φύλλο ΔΕΝ γράφει τίποτα (no-op, όχι σφάλμα)', () => {
    const { target, props } = openMenuThenLoseHover();
    props.onMoveRight(target!);
    // Ο σχεδιαστής επιστρέφει `null` για θέση εκτός ορίων· ο γραφέας το απορρίπτει.
    const plan = applyWorksheet.mock.calls[0]?.[1] ?? null;
    expect(plan).toBeNull();
  });
});
