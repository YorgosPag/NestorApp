/**
 * ADR-920 Β4.8 Β3.4 — the breakline «eye» + focus store, and its round-trip through the REAL
 * collect/apply seam (not a hand-built payload).
 */

import {
  getBreaklineDisplayState, getBreaklineDisplayPrefs, restoreBreaklineDisplay,
  setBreaklinesVisible, setFocusedBreakline, subscribeBreaklineDisplay,
} from '../topo-breakline-display-store';
import { applyTopoState, collectTopoState } from '../persistence/topo-state-io';
import { topoStateSignature } from '../persistence/topo-persistence-types';

describe('topo-breakline-display-store', () => {
  beforeEach(() => restoreBreaklineDisplay({ visible: true }));

  it('default: ορατές, χωρίς εστίαση', () => {
    expect(getBreaklineDisplayState()).toEqual({ visible: true, focusedId: null });
  });

  it('οι setters είναι no-op όταν η τιμή δεν αλλάζει (κανένα περιττό notify)', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeBreaklineDisplay(listener);
    setBreaklinesVisible(true);
    setFocusedBreakline(null);
    expect(listener).not.toHaveBeenCalled();
    setBreaklinesVisible(false);
    setFocusedBreakline('bl_1');
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('η εστίαση ΔΕΝ περσιστάρεται — μόνο το «μάτι»', () => {
    setFocusedBreakline('bl_1');
    expect(getBreaklineDisplayPrefs()).toEqual({ visible: true });
    const before = topoStateSignature(collectTopoState());
    setFocusedBreakline('bl_2');
    expect(topoStateSignature(collectTopoState())).toBe(before);
  });

  it('collect → apply: το «μάτι» επιστρέφει και η εστίαση του προηγούμενου ορόφου πέφτει', () => {
    setBreaklinesVisible(false);
    const saved = collectTopoState();
    expect(saved.breaklineDisplay).toEqual({ visible: false });

    setBreaklinesVisible(true);
    setFocusedBreakline('bl_old_floor');
    applyTopoState(saved);
    expect(getBreaklineDisplayState()).toEqual({ visible: false, focusedId: null });
  });
});
