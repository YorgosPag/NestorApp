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
