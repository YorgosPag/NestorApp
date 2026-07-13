/**
 * ADR-652 M1.5 — Contract tests για τον Block Library contextual-tab bridge.
 *
 * Καλύπτει τις τρεις κλασικές πηγές σφάλματος σε ένα νέο contextual tab:
 *   1. **Bridge read/write** — το ribbon διαβάζει τα tool overrides και γράφει πίσω
 *      στον SSoT `setParamOverrides` του πυρήνα (ADR-600), με σωστά defaults (0° / 1:1).
 *   2. **Wiring tab ↔ bridge** — τα `commandKey` που ΔΗΛΩΝΕΙ το tab είναι ΑΚΡΙΒΩΣ αυτά που
 *      ΔΡΟΜΟΛΟΓΕΙ ο guard. Ένα typo εδώ δίνει σιωπηλά νεκρό combobox.
 *   3. **Trigger registration** — `activeTool === 'block-library'` ανοίγει όντως το tab.
 *
 * Καρφώνει επίσης το NUMERIC-ONLY invariant: το tab ΔΕΝ έχει asset picker — το «ποιο block»
 * ζει στο palette (`block-library-selection-store`), όχι στο ribbon (ADR-652).
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
} from '../bridge/block-library-command-keys';
import {
  CONTEXTUAL_BLOCK_LIBRARY_TAB,
  BLOCK_LIBRARY_CONTEXTUAL_TRIGGER,
} from '../../data/contextual-block-library-tab';
import { resolveToolActiveTrigger } from '../../../../app/resolve-tool-active-trigger';
import type { BlockLibraryParamOverrides } from '../../../../bim/block-library/block-library-types';

const { rotation: ROTATION_KEY, scale: SCALE_KEY } = BLOCK_LIBRARY_RIBBON_KEYS.params;

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

  it('δείχνει τα M1 defaults (0° / 1:1) όσο δεν έχει οριστεί override', () => {
    publishHandle({});
    const { result } = renderHook(() => useRibbonBlockLibraryBridge());

    expect(result.current.getComboboxState(ROTATION_KEY)?.value).toBe('0');
    expect(result.current.getComboboxState(SCALE_KEY)?.value).toBe('1');
  });

  it('διαβάζει τα τρέχοντα overrides του εργαλείου', () => {
    publishHandle({ rotation: 90, scale: 2.5 });
    const { result } = renderHook(() => useRibbonBlockLibraryBridge());

    expect(result.current.getComboboxState(ROTATION_KEY)?.value).toBe('90');
    expect(result.current.getComboboxState(SCALE_KEY)?.value).toBe('2.5');
  });

  it('γράφει rotation/scale πίσω στον SSoT setter του πυρήνα (ADR-600)', () => {
    const setParamOverrides = publishHandle({});
    const { result } = renderHook(() => useRibbonBlockLibraryBridge());

    act(() => result.current.onComboboxChange(ROTATION_KEY, '135'));
    expect(setParamOverrides).toHaveBeenCalledWith({ rotation: 135 });

    // Δεκαδικά + αρνητικές μοίρες: το tab τα επιτρέπει ρητά (numericInput override).
    act(() => result.current.onComboboxChange(ROTATION_KEY, '-22.5'));
    expect(setParamOverrides).toHaveBeenLastCalledWith({ rotation: -22.5 });

    act(() => result.current.onComboboxChange(SCALE_KEY, '0.25'));
    expect(setParamOverrides).toHaveBeenLastCalledWith({ scale: 0.25 });
  });

  it('αγνοεί μη-αριθμητική τιμή (καμία εγγραφή)', () => {
    const setParamOverrides = publishHandle({});
    const { result } = renderHook(() => useRibbonBlockLibraryBridge());

    act(() => result.current.onComboboxChange(ROTATION_KEY, 'abc'));
    expect(setParamOverrides).not.toHaveBeenCalled();
  });

  it('είναι αδρανής όταν το εργαλείο δεν είναι ενεργό ή δεν υπάρχει handle', () => {
    const { result: noHandle } = renderHook(() => useRibbonBlockLibraryBridge());
    expect(noHandle.current.getComboboxState(ROTATION_KEY)).toBeNull();

    const setParamOverrides = publishHandle({ rotation: 90 }, /* isActive */ false);
    const { result } = renderHook(() => useRibbonBlockLibraryBridge());
    expect(result.current.getComboboxState(ROTATION_KEY)).toBeNull();

    act(() => result.current.onComboboxChange(ROTATION_KEY, '45'));
    expect(setParamOverrides).not.toHaveBeenCalled();
  });

  it('συνθέτεται με τους άλλους bridges — no-op σε ξένο commandKey', () => {
    const setParamOverrides = publishHandle({});
    const { result } = renderHook(() => useRibbonBlockLibraryBridge());

    expect(result.current.getComboboxState('furniture.params.rotation')).toBeNull();
    act(() => result.current.onComboboxChange('furniture.params.rotation', '90'));
    expect(setParamOverrides).not.toHaveBeenCalled();
  });
});

describe('CONTEXTUAL_BLOCK_LIBRARY_TAB — wiring', () => {
  /** Κάθε combobox commandKey που δηλώνει το tab (όλα τα panels/rows). */
  const declaredKeys = CONTEXTUAL_BLOCK_LIBRARY_TAB.panels
    .flatMap((p) => p.rows)
    .flatMap((r) => r.buttons)
    .map((b) => b.command.commandKey)
    .filter((k): k is string => typeof k === 'string');

  it('κάθε commandKey του tab δρομολογείται όντως από τον guard του bridge', () => {
    expect(declaredKeys.length).toBeGreaterThan(0);
    for (const key of declaredKeys) {
      expect(isBlockLibraryRibbonKey(key)).toBe(true);
    }
  });

  it('εκθέτει ΑΚΡΙΒΩΣ rotation + scale — κανένα asset picker (numeric-only, ADR-652)', () => {
    expect(new Set(declaredKeys)).toEqual(new Set([ROTATION_KEY, SCALE_KEY]));
  });

  it('δεν δηλώνει δικό του κουμπί «Κλείσιμο» (το βάζει κεντρικά ο withStandardClose)', () => {
    expect(declaredKeys.some((k) => k.includes('close'))).toBe(false);
  });

  it('το ενεργό εργαλείο «block-library» ανοίγει το tab', () => {
    expect(resolveToolActiveTrigger('block-library', null)).toBe(BLOCK_LIBRARY_CONTEXTUAL_TRIGGER);
    expect(CONTEXTUAL_BLOCK_LIBRARY_TAB.contextualTrigger).toBe(BLOCK_LIBRARY_CONTEXTUAL_TRIGGER);
    expect(CONTEXTUAL_BLOCK_LIBRARY_TAB.isContextual).toBe(true);
  });
});
