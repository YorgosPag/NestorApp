/**
 * ADR-652 M1.5 → M5 — Contract tests για τον Block Library contextual-tab bridge.
 *
 * Καλύπτει τις κλασικές πηγές σφάλματος ενός contextual tab + το M5 AutoCAD-INSERT μοντέλο:
 *   1. **Bridge read/write** — το ribbon διαβάζει τα tool overrides και γράφει πίσω στον SSoT
 *      `setParamOverrides` του πυρήνα (ADR-600), με σωστά defaults (0° / 1:1 στους δύο άξονες).
 *   2. **Uniform lock coupling** — όσο το «Ομοιόμορφη» toggle είναι ON (default), το γράψιμο ενός
 *      άξονα γράφει ΚΑΙ τους δύο· OFF → ανεξάρτητα. Αρνητικό = καθρέφτισμα (mirror).
 *   3. **Wiring tab ↔ bridge** — τα combobox `commandKey` δρομολογούνται από τον combo-guard, το
 *      toggle key από τον toggle-guard. Ένα typo εδώ δίνει σιωπηλά νεκρό control.
 *   4. **Trigger registration** — `activeTool === 'block-library'` ανοίγει όντως το tab.
 */

// Defensive: ο έλεγχος του trigger τραβά το `resolve-tool-active-trigger` → tab-barrel →
// contextual-stair-tab → stair bridge → useFloorMetadata → firestore, που αγγίζει firebase/auth
// στο import time (καλεί `fetch` υπό node). Ίδιο guard με το resolve-tool-active-trigger-coverage.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import { renderHook, act } from '@testing-library/react';
import { useRibbonBlockLibraryBridge } from '../useRibbonBlockLibraryBridge';
import { blockLibraryToolBridgeStore } from '../bridge/block-library-tool-bridge-store';
import {
  BLOCK_LIBRARY_RIBBON_KEYS,
  isBlockLibraryRibbonKey,
  isBlockLibraryToggleKey,
} from '../bridge/block-library-command-keys';
import {
  CONTEXTUAL_BLOCK_LIBRARY_TAB,
  BLOCK_LIBRARY_CONTEXTUAL_TRIGGER,
} from '../../data/contextual-block-library-tab';
import { resolveToolActiveTrigger } from '../../../../app/resolve-tool-active-trigger';
import type { BlockLibraryParamOverrides } from '../../../../bim/block-library/block-library-types';

const { rotation: ROTATION_KEY, scaleX: SCALE_X_KEY, scaleY: SCALE_Y_KEY } =
  BLOCK_LIBRARY_RIBBON_KEYS.params;
const { uniform: UNIFORM_KEY } = BLOCK_LIBRARY_RIBBON_KEYS.toggles;

/** Δημοσιεύει ένα tool handle στο bridge store (ό,τι κάνει το `useBlockLibraryTool.useExtension`). */
function publishHandle(
  overrides: BlockLibraryParamOverrides,
  isActive = true,
): jest.Mock<void, [BlockLibraryParamOverrides]> {
  const setParamOverrides = jest.fn<void, [BlockLibraryParamOverrides]>();
  blockLibraryToolBridgeStore.set({ isActive, overrides, setParamOverrides });
  return setParamOverrides;
}

describe('useRibbonBlockLibraryBridge', () => {
  afterEach(() => blockLibraryToolBridgeStore.set(null));

  it('δείχνει τα defaults (0° / X 1 / Y 1) όσο δεν έχει οριστεί override', () => {
    publishHandle({});
    const { result } = renderHook(() => useRibbonBlockLibraryBridge());

    expect(result.current.getComboboxState(ROTATION_KEY)?.value).toBe('0');
    expect(result.current.getComboboxState(SCALE_X_KEY)?.value).toBe('1');
    expect(result.current.getComboboxState(SCALE_Y_KEY)?.value).toBe('1');
  });

  it('διαβάζει τα τρέχοντα overrides του εργαλείου (ανά άξονα)', () => {
    publishHandle({ rotation: 90, scaleX: 2.5, scaleY: -3 });
    const { result } = renderHook(() => useRibbonBlockLibraryBridge());

    expect(result.current.getComboboxState(ROTATION_KEY)?.value).toBe('90');
    expect(result.current.getComboboxState(SCALE_X_KEY)?.value).toBe('2.5');
    expect(result.current.getComboboxState(SCALE_Y_KEY)?.value).toBe('-3');
  });

  it('γράφει rotation πίσω στον SSoT setter του πυρήνα (δεκαδικά + αρνητικές μοίρες)', () => {
    const setParamOverrides = publishHandle({});
    const { result } = renderHook(() => useRibbonBlockLibraryBridge());

    act(() => result.current.onComboboxChange(ROTATION_KEY, '135'));
    expect(setParamOverrides).toHaveBeenCalledWith({ rotation: 135 });

    act(() => result.current.onComboboxChange(ROTATION_KEY, '-22.5'));
    expect(setParamOverrides).toHaveBeenLastCalledWith({ rotation: -22.5 });
  });

  it('ΟΜΟΙΟΜΟΡΦΗ ON (default) → το γράψιμο ενός άξονα γράφει ΚΑΙ τους δύο', () => {
    const setParamOverrides = publishHandle({}); // uniform undefined ⇒ locked
    const { result } = renderHook(() => useRibbonBlockLibraryBridge());

    act(() => result.current.onComboboxChange(SCALE_X_KEY, '2'));
    expect(setParamOverrides).toHaveBeenCalledWith({ scaleX: 2, scaleY: 2 });

    act(() => result.current.onComboboxChange(SCALE_Y_KEY, '0.5'));
    expect(setParamOverrides).toHaveBeenLastCalledWith({ scaleX: 0.5, scaleY: 0.5 });
  });

  it('ΟΜΟΙΟΜΟΡΦΗ OFF → οι άξονες γράφονται ανεξάρτητα', () => {
    const setParamOverrides = publishHandle({ uniform: false });
    const { result } = renderHook(() => useRibbonBlockLibraryBridge());

    act(() => result.current.onComboboxChange(SCALE_X_KEY, '2'));
    expect(setParamOverrides).toHaveBeenCalledWith({ scaleX: 2 });

    act(() => result.current.onComboboxChange(SCALE_Y_KEY, '3'));
    expect(setParamOverrides).toHaveBeenLastCalledWith({ scaleY: 3 });
  });

  it('αρνητικό scale = καθρέφτισμα (mirror) — περνά αυτούσιο με uniform OFF', () => {
    const setParamOverrides = publishHandle({ uniform: false });
    const { result } = renderHook(() => useRibbonBlockLibraryBridge());

    act(() => result.current.onComboboxChange(SCALE_X_KEY, '-1'));
    expect(setParamOverrides).toHaveBeenCalledWith({ scaleX: -1 });
  });

  it('απορρίπτει μηδενική κλίμακα (degenerate INSERT) και μη-αριθμητική τιμή', () => {
    const setParamOverrides = publishHandle({});
    const { result } = renderHook(() => useRibbonBlockLibraryBridge());

    act(() => result.current.onComboboxChange(SCALE_X_KEY, '0'));
    act(() => result.current.onComboboxChange(ROTATION_KEY, 'abc'));
    expect(setParamOverrides).not.toHaveBeenCalled();
  });

  it('toggle «Ομοιόμορφη»: default ON· OFF → uniform:false· ON → κλειδώνει Y=X', () => {
    const setParamOverrides = publishHandle({ scaleX: 4, scaleY: 1, uniform: false });
    const { result } = renderHook(() => useRibbonBlockLibraryBridge());

    // default state: publishHandle({}) θα ήταν ON· εδώ ρητά OFF στο handle.
    expect(result.current.getToggleState(UNIFORM_KEY)).toBe(false);

    act(() => result.current.onToggle(UNIFORM_KEY, true));
    // Κλείδωμα → οι δύο άξονες συγκλίνουν στο X (4).
    expect(setParamOverrides).toHaveBeenCalledWith({ uniform: true, scaleX: 4, scaleY: 4 });

    act(() => result.current.onToggle(UNIFORM_KEY, false));
    expect(setParamOverrides).toHaveBeenLastCalledWith({ uniform: false });
  });

  it('getToggleState = ON όταν το uniform είναι undefined (AutoCAD «Uniform Scale» τσεκαρισμένο)', () => {
    publishHandle({});
    const { result } = renderHook(() => useRibbonBlockLibraryBridge());
    expect(result.current.getToggleState(UNIFORM_KEY)).toBe(true);
  });

  it('είναι αδρανής όταν το εργαλείο δεν είναι ενεργό ή δεν υπάρχει handle', () => {
    const { result: noHandle } = renderHook(() => useRibbonBlockLibraryBridge());
    expect(noHandle.current.getComboboxState(ROTATION_KEY)).toBeNull();

    const setParamOverrides = publishHandle({ rotation: 90 }, /* isActive */ false);
    const { result } = renderHook(() => useRibbonBlockLibraryBridge());
    expect(result.current.getComboboxState(ROTATION_KEY)).toBeNull();

    act(() => result.current.onComboboxChange(SCALE_X_KEY, '2'));
    act(() => result.current.onToggle(UNIFORM_KEY, false));
    expect(setParamOverrides).not.toHaveBeenCalled();
  });

  it('συνθέτεται με τους άλλους bridges — no-op σε ξένο commandKey', () => {
    const setParamOverrides = publishHandle({});
    const { result } = renderHook(() => useRibbonBlockLibraryBridge());

    expect(result.current.getComboboxState('furniture.params.rotation')).toBeNull();
    expect(result.current.getToggleState('scaleTool.nonUniform')).toBe(false);
    act(() => result.current.onComboboxChange('furniture.params.rotation', '90'));
    expect(setParamOverrides).not.toHaveBeenCalled();
  });
});

describe('CONTEXTUAL_BLOCK_LIBRARY_TAB — wiring', () => {
  const buttons = CONTEXTUAL_BLOCK_LIBRARY_TAB.panels
    .flatMap((p) => p.rows)
    .flatMap((r) => r.buttons);

  const comboboxKeys = buttons
    .filter((b) => b.type === 'combobox')
    .map((b) => b.command.commandKey)
    .filter((k): k is string => typeof k === 'string');

  const toggleKeys = buttons
    .filter((b) => b.type === 'toggle')
    .map((b) => b.command.commandKey)
    .filter((k): k is string => typeof k === 'string');

  it('κάθε combobox commandKey δρομολογείται όντως από τον combo-guard', () => {
    expect(comboboxKeys.length).toBeGreaterThan(0);
    for (const key of comboboxKeys) expect(isBlockLibraryRibbonKey(key)).toBe(true);
  });

  it('εκθέτει ΑΚΡΙΒΩΣ rotation + scaleX + scaleY — κανένα asset picker (numeric-only)', () => {
    expect(new Set(comboboxKeys)).toEqual(new Set([ROTATION_KEY, SCALE_X_KEY, SCALE_Y_KEY]));
  });

  it('έχει το toggle «Ομοιόμορφη» και δρομολογείται από τον toggle-guard', () => {
    expect(toggleKeys).toEqual([UNIFORM_KEY]);
    expect(isBlockLibraryToggleKey(UNIFORM_KEY)).toBe(true);
    // Ο combo-guard ΔΕΝ πιάνει το toggle key (και αντίστροφα) — αυστηρός διαχωρισμός.
    expect(isBlockLibraryRibbonKey(UNIFORM_KEY)).toBe(false);
  });

  it('δεν δηλώνει δικό του κουμπί «Κλείσιμο» (το βάζει κεντρικά ο withStandardLeadPanel)', () => {
    expect([...comboboxKeys, ...toggleKeys].some((k) => k.includes('close'))).toBe(false);
  });

  it('το ενεργό εργαλείο «block-library» ανοίγει το tab', () => {
    expect(resolveToolActiveTrigger('block-library', null)).toBe(BLOCK_LIBRARY_CONTEXTUAL_TRIGGER);
    expect(CONTEXTUAL_BLOCK_LIBRARY_TAB.contextualTrigger).toBe(BLOCK_LIBRARY_CONTEXTUAL_TRIGGER);
    expect(CONTEXTUAL_BLOCK_LIBRARY_TAB.isContextual).toBe(true);
  });
});
