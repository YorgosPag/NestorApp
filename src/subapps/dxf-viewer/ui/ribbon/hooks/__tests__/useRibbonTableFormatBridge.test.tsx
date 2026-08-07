/**
 * 🔴 ADR-739 §52 — **ο bridge των δύο καρτελών πίνακα**: τι απαντά, και τι ΔΕΝ αποφασίζει.
 *
 * Δύο ερωτήσεις, και η δεύτερη είναι η επικίνδυνη:
 *
 *  1. **Μεικτή επιλογή ⇒ `null`.** Το `RibbonToggleState` έχει ήδη `null = indeterminate`
 *     (ADR-345 §4.4). Ένα `false` εκεί θα ήταν **ψέμα**: το κουμπί θα δήλωνε «κανένα κελί δεν
 *     είναι έντονο» ενώ τα μισά είναι — και κανένα test κατάστασης δεν θα το έδειχνε, γιατί
 *     το boolean είναι απολύτως έγκυρο.
 *  2. **Ο κανόνας «μεικτό ⇒ όλα ναι» ΔΕΝ ζει εδώ.** Η κορδέλα περνά `nextValue = !current`,
 *     που σε μεικτή επιλογή είναι `!null === true` **κατά τύχη**. Ο bridge οφείλει να το
 *     αγνοήσει και να ζητήσει από τη θύρα «άλλαξε αυτό» — αλλιώς η κορδέλα και το mini
 *     toolbar θα είχαν δύο κανόνες για το ίδιο πάτημα.
 *
 * Η θύρα στήνεται **χειροκίνητα** (διπλό, όχι το πραγματικό hook): αυτό που ελέγχεται εδώ
 * είναι η **μετάφραση** κλειδιού → ερώτηση θύρας, όχι ο εκδότης.
 *
 * @see ui/ribbon/hooks/useRibbonTableFormatBridge.ts
 */

import { renderHook, act } from '@testing-library/react';
import { useRibbonTableFormatBridge } from '../useRibbonTableFormatBridge';
import {
  TABLE_FORMAT_RIBBON_KEYS,
  TABLE_PROPERTIES_RIBBON_KEYS,
} from '../bridge/table-format-command-keys';
import {
  __resetTableFormatPortForTests,
  setTableFormatPort,
  type TableFormatPort,
} from '../../../table-cell-editor/table-format-port';
import type { TableFormatState } from '../../../../bim/table/table-cell-style-scan';
import type { TableCellAlign } from '../../../../types/table';
import { getTableStyleSnapshot } from '../../../../bim/table/table-style-registry';
import { resolveStyleNameLabel } from '../../../../systems/style-naming/style-name-label';

type Recorded = readonly [string, ...unknown[]];

/**
 * Η ελάχιστη θύρα που χρειάζεται ο bridge, με καταγραφή κλήσεων.
 *
 * Ό,τι δεν ρωτιέται από αυτά τα tests πετά ρητά: ένα σιωπηλό `undefined` θα έκρυβε μια
 * μελλοντική κλήση σε λάθος μέθοδο πίσω από ένα πράσινο test.
 */
function fakePort(
  overrides: Partial<TableFormatPort> = {},
  structureOverrides: Partial<TableFormatPort['structure']> = {},
  bindingOverrides: Partial<TableFormatPort['binding']> = {},
): { port: TableFormatPort; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const record = (name: string) => (...args: unknown[]): void => { calls.push([name, ...args]); };
  const unused = (name: string) => (): never => {
    throw new Error(`Η θύρα δεν έπρεπε να ρωτηθεί για «${name}»`);
  };

  const port = {
    table: () => null,
    scope: () => null,
    bounds: () => null,
    state: () => null,
    colorState: unused('colorState'),
    toggle: record('toggle'),
    setField: record('setField'),
    stepTextHeight: record('stepTextHeight'),
    textHeightMm: () => null,
    // 🔴 ADR-739 §56 — τα δύο νέα μέλη με **ουδέτερες** προεπιλογές, όχι `undefined`. Το
    // `as TableFormatPort` παρακάτω θα δεχόταν και την απουσία τους· τότε όμως μια κλήση σε
    // αυτά θα έσκαγε ως `TypeError` αντί να απαντήσει, δηλαδή ακριβώς το «σιωπηλό undefined»
    // που η κεφαλίδα αυτού του fake υπόσχεται ότι δεν επιτρέπει.
    numberFormat: () => ({ current: null, explicit: false }),
    fontNames: () => [],
    reset: record('reset'),
    canReset: () => false,
    borders: {} as TableFormatPort['borders'],
    merge: {} as TableFormatPort['merge'],
    structure: {
      styleId: () => null,
      setStyleId: record('setStyleId'),
      insertAxis: record('insertAxis'),
      deleteAxis: record('deleteAxis'),
      canDeleteAxis: () => true,
      selectAll: record('selectAll'),
      ...structureOverrides,
    },
    // 🔴 ADR-767 Δ3 — προεπιλογή «στατικός πίνακας»: το panel «Δεδομένα» οφείλει να είναι
    // κρυφό όταν κανείς δεν το ζήτησε ρητά, όχι να κρασάρει.
    binding: {
      isBound: () => false,
      refresh: record('refresh'),
      check: record('check'),
      ...bindingOverrides,
    },
    // 🔴 ADR-739 §57 — το πρόχειρο, με **καταγραφή** και όχι ουδέτερο no-op: το κρίσιμο test
    // εδώ είναι ότι η «Αντιγραφή» καλεί `copy` και **όχι** `stepTextHeight` (η παγίδα των
    // `actions`), και μια σιωπηλή προεπιλογή θα έκανε τη διαφορά αόρατη.
    clipboard: {
      canPaste: () => true,
      copy: async (...args: unknown[]) => { record('copy')(...args); },
      cut: async (...args: unknown[]) => { record('cut')(...args); },
      paste: async (...args: unknown[]) => { record('paste')(...args); },
      pasteAs: async (...args: unknown[]) => { record('pasteAs')(...args); },
    } as unknown as TableFormatPort['clipboard'],
    ...overrides,
  } as TableFormatPort;

  return { port, calls };
}

const boldState = (value: boolean | undefined, mixed: boolean): TableFormatState<boolean> => ({
  value, mixed, overridden: true,
});

function bridge() {
  return renderHook(() => useRibbonTableFormatBridge()).result;
}

describe('useRibbonTableFormatBridge — χωρίς θύρα', () => {
  beforeEach(() => { __resetTableFormatPortForTests(); });

  it('🔴 ΑΔΡΑΝΗΣ σε κάθε ερώτηση — ποτέ σφάλμα, ποτέ μαντεψιά', () => {
    const { current } = bridge();
    expect(current.getToggleState(TABLE_FORMAT_RIBBON_KEYS.toggles.bold)).toBe(false);
    expect(current.getComboboxState(TABLE_FORMAT_RIBBON_KEYS.textHeight))
      .toEqual({ value: null, options: [] });
    expect(() => current.onToggle(TABLE_FORMAT_RIBBON_KEYS.toggles.bold, true)).not.toThrow();
    expect(() => current.onAction(TABLE_FORMAT_RIBBON_KEYS.actions.reset)).not.toThrow();
  });

  it('τα δύο panels που θέλουν δρομέα είναι ΚΡΥΦΑ· κάθε άλλο panel μένει ορατό', () => {
    const { current } = bridge();
    expect(current.getPanelVisibility(TABLE_PROPERTIES_RIBBON_KEYS.panels.rowsColumns)).toBe(false);
    expect(current.getPanelVisibility(TABLE_PROPERTIES_RIBBON_KEYS.panels.selection)).toBe(false);
    // Ξένο κλειδί ⇒ `true`: ο bridge δεν διεκδικεί panels που δεν του ανήκουν.
    expect(current.getPanelVisibility('someone.else.panel')).toBe(true);
  });

  it('ξένα κλειδιά ⇒ `null` / `false`, ώστε να συνθέτει με κάθε άλλον bridge', () => {
    const { current } = bridge();
    expect(current.getComboboxState('wall.thickness')).toBeNull();
    expect(current.getToggleState('wall.someToggle')).toBe(false);
  });
});

describe('useRibbonTableFormatBridge — μορφοποίηση', () => {
  afterEach(() => { __resetTableFormatPortForTests(); });

  it('🔴 μεικτή επιλογή ⇒ `null` (indeterminate), ΠΟΤΕ `false`', () => {
    const { port } = fakePort({ state: (() => boldState(undefined, true)) as TableFormatPort['state'] });
    setTableFormatPort(port);
    expect(bridge().current.getToggleState(TABLE_FORMAT_RIBBON_KEYS.toggles.bold)).toBeNull();
  });

  it('ομοιόμορφα έντονα ⇒ `true`· ομοιόμορφα όχι ⇒ `false`', () => {
    setTableFormatPort(fakePort({ state: (() => boldState(true, false)) as TableFormatPort['state'] }).port);
    expect(bridge().current.getToggleState(TABLE_FORMAT_RIBBON_KEYS.toggles.italic)).toBe(true);

    setTableFormatPort(fakePort({ state: (() => boldState(false, false)) as TableFormatPort['state'] }).port);
    expect(bridge().current.getToggleState(TABLE_FORMAT_RIBBON_KEYS.toggles.underline)).toBe(false);
  });

  it('🔴 το `nextValue` της κορδέλας ΑΓΝΟΕΙΤΑΙ — η απόφαση ανήκει στη θύρα', () => {
    const { port, calls } = fakePort();
    setTableFormatPort(port);
    // Η κορδέλα στέλνει `false` (π.χ. από `!true`). Αν ο bridge το προωθούσε, το «μεικτό ⇒
    // όλα ναι» θα είχε δεύτερη, αντίθετη υλοποίηση στην κορδέλα.
    const api = bridge().current;
    act(() => { api.onToggle(TABLE_FORMAT_RIBBON_KEYS.toggles.bold, false); });
    expect(calls).toEqual([['toggle', 'bold']]);
  });

  it('ύψος κειμένου: κοινή τιμή ⇒ κείμενο· μεικτό ⇒ `null` (ποτέ αυθαίρετη επιλογή)', () => {
    setTableFormatPort(fakePort({ textHeightMm: () => 2.5 }).port);
    expect(bridge().current.getComboboxState(TABLE_FORMAT_RIBBON_KEYS.textHeight)?.value).toBe('2.5');

    setTableFormatPort(fakePort({ textHeightMm: () => null }).port);
    expect(bridge().current.getComboboxState(TABLE_FORMAT_RIBBON_KEYS.textHeight)?.value).toBeNull();
  });

  it('🔴 μη-θετικό ύψος ⇒ ΚΑΜΙΑ εγγραφή (μηδέν = αόρατο κείμενο, όχι μικρό)', () => {
    const { port, calls } = fakePort();
    setTableFormatPort(port);
    const api = bridge().current;
    act(() => {
      api.onComboboxChange(TABLE_FORMAT_RIBBON_KEYS.textHeight, '0');
      api.onComboboxChange(TABLE_FORMAT_RIBBON_KEYS.textHeight, '-3');
      api.onComboboxChange(TABLE_FORMAT_RIBBON_KEYS.textHeight, 'abc');
    });
    expect(calls).toEqual([]);

    act(() => { api.onComboboxChange(TABLE_FORMAT_RIBBON_KEYS.textHeight, '3.5'); });
    expect(calls).toEqual([['setField', 'textHeightMm', 3.5]]);
  });

  it('οι τρεις ενέργειες μορφοποίησης δρομολογούνται ξεχωριστά', () => {
    const { port, calls } = fakePort();
    setTableFormatPort(port);
    const api = bridge().current;
    act(() => {
      api.onAction(TABLE_FORMAT_RIBBON_KEYS.actions.sizeUp);
      api.onAction(TABLE_FORMAT_RIBBON_KEYS.actions.sizeDown);
      api.onAction(TABLE_FORMAT_RIBBON_KEYS.actions.reset);
    });
    expect(calls).toEqual([['stepTextHeight', 1], ['stepTextHeight', -1], ['reset']]);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 🔴 ADR-739 §56 — στοίχιση · μορφή αριθμού · οικογένεια γραμματοσειράς
// ──────────────────────────────────────────────────────────────────────────────

const alignState = (
  value: TableCellAlign | undefined,
  mixed: boolean,
): TableFormatState<TableCellAlign> => ({ value, mixed, overridden: true });

/** Θύρα με **στόχο** — ο φύλακας `scope()` της μορφής αριθμού απαιτεί να μην είναι `null`. */
function portWithScope(overrides: Partial<TableFormatPort> = {}) {
  return fakePort({ scope: () => ({}) as never, ...overrides });
}

describe('useRibbonTableFormatBridge §56 — στοίχιση', () => {
  afterEach(() => { __resetTableFormatPortForTests(); });

  it('🔴 ΤΟ ΠΑΤΗΜΑ ΑΛΛΑΖΕΙ ΜΟΝΟ ΤΟ ΜΙΣΟ — η κάθετη θέση ΕΠΙΒΙΩΝΕΙ', () => {
    // Κελί στοιχισμένο **πάνω-δεξιά**. Το «αριστερά» οφείλει να δώσει `TL`, όχι `ML`: ο χρήστης
    // ζήτησε οριζόντια αλλαγή και δεν είπε τίποτα για την κάθετη. Είναι όλος ο λόγος που ο
    // κανόνας ζει στο `table-align-ops.ts` αντί για έξι σταθερές στην κορδέλα.
    const { port, calls } = fakePort({ state: (() => alignState('TR', false)) as TableFormatPort['state'] });
    setTableFormatPort(port);
    const api = bridge().current;
    act(() => { api.onToggle(TABLE_FORMAT_RIBBON_KEYS.align.left, true); });
    expect(calls).toEqual([['setField', 'align', 'TL']]);
  });

  it('🔴 και αντίστροφα: η κάθετη αλλαγή κρατά την ΟΡΙΖΟΝΤΙΑ θέση', () => {
    const { port, calls } = fakePort({ state: (() => alignState('TR', false)) as TableFormatPort['state'] });
    setTableFormatPort(port);
    const api = bridge().current;
    act(() => { api.onToggle(TABLE_FORMAT_RIBBON_KEYS.align.bottom, true); });
    expect(calls).toEqual([['setField', 'align', 'BR']]);
  });

  it('μεικτός στόχος ⇒ ΚΑΝΕΝΑ κουμπί πατημένο (`null`), και η εγγραφή ξεκινά από τη βάση', () => {
    const { port, calls } = fakePort({ state: (() => alignState(undefined, true)) as TableFormatPort['state'] });
    setTableFormatPort(port);
    const api = bridge().current;
    expect(api.getToggleState(TABLE_FORMAT_RIBBON_KEYS.align.left)).toBeNull();
    expect(api.getToggleState(TABLE_FORMAT_RIBBON_KEYS.align.top)).toBeNull();
    // Δεν υπάρχει «άλλο μισό» να κρατηθεί ⇒ βάση `ML` (η δηλωμένη, αποδεκτή ισοπέδωση).
    act(() => { api.onToggle(TABLE_FORMAT_RIBBON_KEYS.align.center, true); });
    expect(calls).toEqual([['setField', 'align', 'MC']]);
  });

  it('πατημένο είναι ΜΟΝΟ το κουμπί που ισχύει — σε καθέναν από τους δύο άξονες', () => {
    setTableFormatPort(fakePort({ state: (() => alignState('BC', false)) as TableFormatPort['state'] }).port);
    const api = bridge().current;
    expect(api.getToggleState(TABLE_FORMAT_RIBBON_KEYS.align.center)).toBe(true);
    expect(api.getToggleState(TABLE_FORMAT_RIBBON_KEYS.align.left)).toBe(false);
    expect(api.getToggleState(TABLE_FORMAT_RIBBON_KEYS.align.bottom)).toBe(true);
    expect(api.getToggleState(TABLE_FORMAT_RIBBON_KEYS.align.top)).toBe(false);
  });
});

describe('useRibbonTableFormatBridge §57 — πρόχειρο', () => {
  afterEach(() => { __resetTableFormatPortForTests(); });

  const TARGET = { firstRow: 0, lastRow: 1, firstCol: 0, lastCol: 1 };

  /**
   * 🔴 **Η ΙΔΙΑ ΠΑΓΙΔΑ, ΔΕΥΤΕΡΗ ΦΟΡΑ** — γι' αυτό η άγκυρα είναι ρητή και όχι «καλύπτεται».
   *
   * Τα `cut`/`copy` ζουν κι αυτά μέσα στο `TABLE_FORMAT_RIBBON_KEYS.actions`, ακριβώς όπως τα
   * δεκαδικά του §56. Χωρίς την προτεραιότητα του `writeTableClipboardCommand`, η **«Αντιγραφή»
   * θα μεγάλωνε τη γραμματοσειρά** (`STEP_DIRECTION['…copy']` = `undefined` ⇒ βήμα προς το
   * πουθενά) — χωρίς κανένα σφάλμα, με το κουμπί να φαίνεται ότι δουλεύει.
   */
  it('🔴 Η ΑΝΤΙΓΡΑΦΗ ΔΕΝ ΠΕΦΤΕΙ ΣΤΟ `stepTextHeight` — η σειρά των κλάδων είναι ο μηχανισμός', () => {
    const { port, calls } = fakePort({ bounds: () => TARGET });
    setTableFormatPort(port);
    const api = bridge().current;
    act(() => { api.onAction(TABLE_FORMAT_RIBBON_KEYS.actions.copy); });
    expect(calls).toEqual([['copy', TARGET]]);
    expect(calls.some(([name]) => name === 'stepTextHeight')).toBe(false);
  });

  it('🔴 και η ΑΠΟΚΟΠΗ — δεύτερο κλειδί, ίδιος κίνδυνος', () => {
    const { port, calls } = fakePort({ bounds: () => TARGET });
    setTableFormatPort(port);
    const api = bridge().current;
    act(() => { api.onAction(TABLE_FORMAT_RIBBON_KEYS.actions.cut); });
    expect(calls).toEqual([['cut', TARGET]]);
    expect(calls.some(([name]) => name === 'stepTextHeight')).toBe(false);
  });

  it('χωρίς στόχο ⇒ ΚΑΜΙΑ πράξη (και καμία εξαίρεση) — η καρτέλα ζει ένα καρέ μετά τον δρομέα', () => {
    const { port, calls } = fakePort({ bounds: () => null });
    setTableFormatPort(port);
    const api = bridge().current;
    act(() => { api.onAction(TABLE_FORMAT_RIBBON_KEYS.actions.copy); });
    expect(calls).toEqual([]);
  });
});

describe('useRibbonTableFormatBridge §56 — μορφή αριθμού', () => {
  afterEach(() => { __resetTableFormatPortForTests(); });

  it('🔴 ΤΑ ΔΕΚΑΔΙΚΑ ΔΕΝ ΠΕΦΤΟΥΝ ΣΤΟ `stepTextHeight` — η σειρά των κλάδων είναι ο μηχανισμός', () => {
    // Τα δύο κλειδιά ζουν μέσα στο `actions`, άρα ο φύλακας `isTableFormatActionKey` τα δέχεται.
    // Χωρίς την προτεραιότητα του §56, το «.00→» θα καλούσε `stepTextHeight(undefined)` —
    // δηλαδή θα **μεγάλωνε τη γραμματοσειρά** αντί να προσθέσει δεκαδικό, χωρίς κανένα σφάλμα.
    const { port, calls } = portWithScope();
    setTableFormatPort(port);
    const api = bridge().current;
    act(() => { api.onAction(TABLE_FORMAT_RIBBON_KEYS.actions.decimalUp); });
    expect(calls).toEqual([['setField', 'numberFormat', { kind: 'decimal', decimals: 1 }]]);
    expect(calls.some(([name]) => name === 'stepTextHeight')).toBe(false);
  });

  it('«%» σε κελί χωρίς μορφή ⇒ ποσοστό· ξαναπάτημα ⇒ ΞΕΠΑΤΗΜΑ (`undefined` = κληρονομιά)', () => {
    const percent = { kind: 'percent', decimals: 0 } as const;
    const { port, calls } = portWithScope({ numberFormat: () => ({ current: null, explicit: false }) });
    setTableFormatPort(port);
    const api = bridge().current;
    act(() => { api.onToggle(TABLE_FORMAT_RIBBON_KEYS.numberFormat.percent, true); });
    expect(calls).toEqual([['setField', 'numberFormat', percent]]);

    const active = portWithScope({ numberFormat: () => ({ current: percent, explicit: true }) });
    setTableFormatPort(active.port);
    const activeApi = bridge().current;
    act(() => { activeApi.onToggle(TABLE_FORMAT_RIBBON_KEYS.numberFormat.percent, false); });
    expect(active.calls).toEqual([['setField', 'numberFormat', undefined]]);
  });

  it('🔴 ΧΩΡΙΣ ΣΤΟΧΟ ⇒ `false`, ΠΟΤΕ `null` — η κορδέλα ζει και μετά το κλείσιμο του δρομέα', () => {
    // Το `EMPTY_TABLE_NUMBER_FORMAT_STATE` κωδικοποιεί το «χωρίς στόχο» ως `current: null`,
    // δηλαδή την ΙΔΙΑ τιμή με το «ανάμεικτο». Στο mini toolbar είναι ακίνδυνο (δεν αποδίδεται
    // καθόλου χωρίς στόχο)· εδώ, χωρίς τον φύλακα `scope()`, τα τρία κουμπιά θα δήλωναν
    // «τα κελιά διαφωνούν» για επιλογή που δεν υπάρχει.
    setTableFormatPort(fakePort({ scope: () => null }).port);
    const api = bridge().current;
    expect(api.getToggleState(TABLE_FORMAT_RIBBON_KEYS.numberFormat.percent)).toBe(false);
    expect(api.getToggleState(TABLE_FORMAT_RIBBON_KEYS.numberFormat.accounting)).toBe(false);

    // Με στόχο, το ίδιο `current: null` σημαίνει πλέον πραγματικά «ανάμεικτο».
    setTableFormatPort(portWithScope().port);
    expect(bridge().current.getToggleState(TABLE_FORMAT_RIBBON_KEYS.numberFormat.percent)).toBeNull();
  });

  it('πατημένο δείχνει το είδος που ΙΣΧΥΕΙ, ακόμη κι αν το κληρονομεί από τη στήλη', () => {
    setTableFormatPort(portWithScope({
      numberFormat: () => ({ current: { kind: 'currency', decimals: 2 }, explicit: false }),
    }).port);
    const api = bridge().current;
    expect(api.getToggleState(TABLE_FORMAT_RIBBON_KEYS.numberFormat.accounting)).toBe(true);
    expect(api.getToggleState(TABLE_FORMAT_RIBBON_KEYS.numberFormat.percent)).toBe(false);
    // Το νόμισμα ομαδοποιεί εξ ορισμού (`grouping !== false`) — το κουμπί λέει τι ΒΛΕΠΕΙ ο χρήστης.
    expect(api.getToggleState(TABLE_FORMAT_RIBBON_KEYS.numberFormat.grouping)).toBe(true);
  });
});

describe('useRibbonTableFormatBridge §56 — οικογένεια γραμματοσειράς', () => {
  afterEach(() => { __resetTableFormatPortForTests(); });

  it('«Αυτόματη» πρώτη στη λίστα· τα ονόματα περνούν ΩΜΑ (`isLiteralLabel`)', () => {
    setTableFormatPort(fakePort({
      fontNames: () => ['Arial', 'ISOCPEUR'],
      state: (() => ({ value: 'Arial', mixed: false, overridden: true })) as TableFormatPort['state'],
    }).port);
    const state = bridge().current.getComboboxState(TABLE_FORMAT_RIBBON_KEYS.fontFamily);
    expect(state?.value).toBe('Arial');
    expect(state?.options).toEqual([
      { value: '', labelKey: 'ribbon.commands.tableFormat.automaticFont' },
      { value: 'Arial', labelKey: 'Arial', isLiteralLabel: true },
      { value: 'ISOCPEUR', labelKey: 'ISOCPEUR', isLiteralLabel: true },
    ]);
  });

  it('κληρονομεί ⇒ η τιμή είναι `\'\'` (η «Αυτόματη» επιλεγμένη)· μεικτό ⇒ `null` (κενό πεδίο)', () => {
    setTableFormatPort(fakePort({
      state: (() => ({ value: undefined, mixed: false, overridden: false })) as TableFormatPort['state'],
    }).port);
    expect(bridge().current.getComboboxState(TABLE_FORMAT_RIBBON_KEYS.fontFamily)?.value).toBe('');

    setTableFormatPort(fakePort({
      state: (() => ({ value: undefined, mixed: true, overridden: false })) as TableFormatPort['state'],
    }).port);
    expect(bridge().current.getComboboxState(TABLE_FORMAT_RIBBON_KEYS.fontFamily)?.value).toBeNull();
  });

  it('🔴 η «Αυτόματη» ΣΒΗΝΕΙ το πεδίο (`undefined`), δεν γράφει κενό όνομα', () => {
    const { port, calls } = fakePort();
    setTableFormatPort(port);
    const api = bridge().current;
    act(() => { api.onComboboxChange(TABLE_FORMAT_RIBBON_KEYS.fontFamily, ''); });
    expect(calls).toEqual([['setField', 'fontFamily', undefined]]);

    act(() => { api.onComboboxChange(TABLE_FORMAT_RIBBON_KEYS.fontFamily, 'ISOCPEUR'); });
    expect(calls).toEqual([
      ['setField', 'fontFamily', undefined],
      ['setField', 'fontFamily', 'ISOCPEUR'],
    ]);
  });

  it('🔴 το ύψος κειμένου ΔΕΝ παρασύρεται από τον νέο κλάδο της οικογένειας', () => {
    // Τα δύο combobox μοιράζονται πλέον τον ίδιο φύλακα (`isTableFormatComboboxKey`). Αν ο
    // εσωτερικός διαχωρισμός έσπαγε, το «2.5» θα γραφόταν ως **όνομα γραμματοσειράς**.
    const { port, calls } = fakePort();
    setTableFormatPort(port);
    const api = bridge().current;
    act(() => { api.onComboboxChange(TABLE_FORMAT_RIBBON_KEYS.textHeight, '2.5'); });
    expect(calls).toEqual([['setField', 'textHeightMm', 2.5]]);
  });
});

describe('useRibbonTableFormatBridge — ιδιότητες πίνακα', () => {
  afterEach(() => { __resetTableFormatPortForTests(); });

  it('οι τέσσερις εισαγωγές λένε ρητά άξονα ΚΑΙ πλευρά', () => {
    const { port, calls } = fakePort();
    setTableFormatPort(port);
    const api = bridge().current;
    act(() => {
      api.onAction(TABLE_PROPERTIES_RIBBON_KEYS.actions.insertRowAbove);
      api.onAction(TABLE_PROPERTIES_RIBBON_KEYS.actions.insertRowBelow);
      api.onAction(TABLE_PROPERTIES_RIBBON_KEYS.actions.insertColumnLeft);
      api.onAction(TABLE_PROPERTIES_RIBBON_KEYS.actions.insertColumnRight);
    });
    expect(calls).toEqual([
      ['insertAxis', 'row', 'before'],
      ['insertAxis', 'row', 'after'],
      ['insertAxis', 'column', 'before'],
      ['insertAxis', 'column', 'after'],
    ]);
  });

  it('🔴 η διαγραφή περνά από το φράγμα πλήθους — ο πίνακας δεν μένει ποτέ χωρίς στήλη', () => {
    const { port, calls } = fakePort({}, { canDeleteAxis: () => false });
    setTableFormatPort(port);
    const api = bridge().current;
    act(() => { api.onAction(TABLE_PROPERTIES_RIBBON_KEYS.actions.deleteColumn); });
    expect(calls).toEqual([]);
  });

  it('το στυλ διαβάζεται από τη θύρα και γράφεται μέσω αυτής', () => {
    const { port, calls } = fakePort({}, { styleId: () => 'standard' });
    setTableFormatPort(port);
    const api = bridge().current;
    const state = api.getComboboxState(TABLE_PROPERTIES_RIBBON_KEYS.style);
    expect(state?.value).toBe('standard');
    // 🔴 §52.2 — αυτή η προσδοκία έλεγε **το αντίθετο** («κάθε επιλογή είναι κυριολεκτική
    // ετικέτα») και ήταν πράσινη ενώ η οθόνη έδειχνε `ribbon.commands.tableStyleNames.standard`:
    // το test κωδικοποιούσε το ίδιο λάθος με τον κώδικα. Ο κανόνας είναι της προέλευσης —
    // built-in ⇒ ΚΛΕΙΔΙ που περνά από `t()`, custom ⇒ κυριολεξία του χρήστη.
    expect(state?.options.length).toBeGreaterThan(0);
    expect(state?.options.every((o) => o.isLiteralLabel === false)).toBe(true);
    // Και η ίδια η ταυτότητα του κανόνα: ό,τι λέει ο SSoT για κάθε στυλ του μητρώου.
    const { styles } = getTableStyleSnapshot();
    expect(state?.options).toEqual(
      styles.map((style) => ({ value: style.id, ...resolveStyleNameLabel(style) })),
    );

    act(() => { api.onComboboxChange(TABLE_PROPERTIES_RIBBON_KEYS.style, 'minimal'); });
    expect(calls).toEqual([['setStyleId', 'minimal']]);
  });

  it('με ενεργό στόχο, τα δύο panels γίνονται ορατά', () => {
    setTableFormatPort(fakePort({
      scope: () => ({ kind: 'range', bounds: { firstRow: 0, lastRow: 0, firstCol: 0, lastCol: 0 } }),
    }).port);
    expect(bridge().current.getPanelVisibility(TABLE_PROPERTIES_RIBBON_KEYS.panels.rowsColumns)).toBe(true);
  });
});

// ─── 🔴 ADR-767 Δ3 — το panel «Δεδομένα» και η ρητή ανανέωση ──────────────────

/**
 * Τρία πράγματα που σπάνε σιωπηλά αν κανείς δεν τα φυλάει:
 *
 * 1. Το «Δεδομένα» να μοιραστεί τον φύλακα των άλλων δύο panels (`scope() != null`) ⇒ θα
 *    εξαφανιζόταν σε **σκέτη επιλογή** δεμένου πίνακα, δηλαδή ακριβώς στη συνηθέστερη στιγμή
 *    που ο χρήστης θέλει να πατήσει «Ανανέωση».
 * 2. Το «Ανανέωση» να πέσει στην αλυσίδα `STRUCTURE_INSERT` / `STRUCTURE_DELETE` ⇒ θα
 *    **έσβηνε γραμμή** αντί να ανανεώσει, χωρίς κανένα σφάλμα.
 * 3. Ο bridge να διεκδικήσει το κλειδί ενός ξένου panel.
 */
describe('🔴 ADR-767 Δ3 — «Δεδομένα»: ορατό μόνο σε δεμένο πίνακα, μία ρητή ενέργεια', () => {
  beforeEach(() => { __resetTableFormatPortForTests(); });

  it('χωρίς θύρα το panel είναι κρυφό — ποτέ σφάλμα', () => {
    expect(bridge().current.getPanelVisibility(TABLE_PROPERTIES_RIBBON_KEYS.panels.data)).toBe(false);
  });

  it('🔴 ΣΤΑΤΙΚΟΣ ΠΙΝΑΚΑΣ ⇒ ΚΡΥΦΟ — καμία υπόσχεση που δεν τηρείται', () => {
    setTableFormatPort(fakePort({}, {}, { isBound: () => false }).port);

    expect(bridge().current.getPanelVisibility(TABLE_PROPERTIES_RIBBON_KEYS.panels.data)).toBe(false);
  });

  it('🔴 ΔΕΜΕΝΟΣ ΠΙΝΑΚΑΣ ΧΩΡΙΣ ΔΡΟΜΕΑ ⇒ ΟΡΑΤΟ (δεν μοιράζεται τον φύλακα των άλλων δύο)', () => {
    const { port } = fakePort({ scope: () => null }, {}, { isBound: () => true });
    setTableFormatPort(port);
    const api = bridge().current;

    expect(api.getPanelVisibility(TABLE_PROPERTIES_RIBBON_KEYS.panels.data)).toBe(true);
    // …ενώ τα δύο που ΟΝΤΩΣ θέλουν δρομέα μένουν κρυφά. Η αντίθεση είναι η απόδειξη.
    expect(api.getPanelVisibility(TABLE_PROPERTIES_RIBBON_KEYS.panels.rowsColumns)).toBe(false);
    expect(api.getPanelVisibility(TABLE_PROPERTIES_RIBBON_KEYS.panels.selection)).toBe(false);
  });

  it('🔴 ΤΟ «ΑΝΑΝΕΩΣΗ» ΚΑΛΕΙ `binding.refresh()` — και ΤΙΠΟΤΑ ΑΛΛΟ', () => {
    const { port, calls } = fakePort({}, {}, { isBound: () => true });
    setTableFormatPort(port);

    const api = bridge().current;
    act(() => { api.onAction(TABLE_PROPERTIES_RIBBON_KEYS.actions.refreshBinding); });

    expect(calls).toEqual([['refresh']]);
  });

  it('🔴 ΔΕΝ ΠΕΦΤΕΙ ΣΤΗ ΔΙΑΓΡΑΦΗ ΑΞΟΝΑ — «Ανανέωση» δεν σβήνει γραμμή', () => {
    const { port, calls } = fakePort({}, {}, { isBound: () => true });
    setTableFormatPort(port);

    const api = bridge().current;
    act(() => { api.onAction(TABLE_PROPERTIES_RIBBON_KEYS.actions.refreshBinding); });

    expect(calls.map(([name]) => name)).not.toContain('deleteAxis');
    expect(calls.map(([name]) => name)).not.toContain('insertAxis');
  });

  it('ο φύλακας «έχει δεσμό;» ζει στη ΘΥΡΑ — ο bridge δεν τον αντιγράφει', () => {
    // Ακόμη και με `isBound() === false`, ο bridge προωθεί: μία απόφαση, ένα σημείο. Ένας
    // δεύτερος έλεγχος εδώ θα ήταν δεύτερη ευκαιρία να αποκλίνει από τον πρώτο.
    const { port, calls } = fakePort({}, {}, { isBound: () => false });
    setTableFormatPort(port);

    const api = bridge().current;
    act(() => { api.onAction(TABLE_PROPERTIES_RIBBON_KEYS.actions.refreshBinding); });

    expect(calls).toEqual([['refresh']]);
  });
});
