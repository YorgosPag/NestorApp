/**
 * ADR-408 Φ6 — mep-circuit-editor-store tests.
 */

import { useMepCircuitEditorStore } from '../mep-circuit-editor-store';

describe('useMepCircuitEditorStore', () => {
  beforeEach(() => useMepCircuitEditorStore.getState().setActiveSystemId(null));

  it('sets and reads the active circuit id', () => {
    useMepCircuitEditorStore.getState().setActiveSystemId('mepsys_A');
    expect(useMepCircuitEditorStore.getState().getActiveSystemId()).toBe('mepsys_A');
  });

  it('is a referential-stable no-op when the id is unchanged', () => {
    useMepCircuitEditorStore.getState().setActiveSystemId('mepsys_A');
    const before = useMepCircuitEditorStore.getState();
    useMepCircuitEditorStore.getState().setActiveSystemId('mepsys_A');
    expect(useMepCircuitEditorStore.getState()).toBe(before);
  });

  it('clears the active circuit with null', () => {
    useMepCircuitEditorStore.getState().setActiveSystemId('mepsys_A');
    useMepCircuitEditorStore.getState().setActiveSystemId(null);
    expect(useMepCircuitEditorStore.getState().getActiveSystemId()).toBeNull();
  });

  describe('multi-select (selectedSystemIds)', () => {
    it('single-select keeps the highlight set as {id}', () => {
      useMepCircuitEditorStore.getState().setActiveSystemId('mepsys_A');
      const s = useMepCircuitEditorStore.getState();
      expect([...s.selectedSystemIds]).toEqual(['mepsys_A']);
      expect(s.activeSystemId).toBe('mepsys_A');
    });

    it('clearing empties the highlight set', () => {
      useMepCircuitEditorStore.getState().setActiveSystemId('mepsys_A');
      useMepCircuitEditorStore.getState().setActiveSystemId(null);
      expect(useMepCircuitEditorStore.getState().selectedSystemIds.size).toBe(0);
    });

    it('setSelectedCircuits highlights all and makes the last the primary', () => {
      useMepCircuitEditorStore.getState().setSelectedCircuits(['mepsys_A', 'mepsys_B']);
      const s = useMepCircuitEditorStore.getState();
      expect([...s.selectedSystemIds].sort()).toEqual(['mepsys_A', 'mepsys_B']);
      expect(s.activeSystemId).toBe('mepsys_B'); // last = top-most paint order
    });

    it('setSelectedCircuits([]) clears both primary and set', () => {
      useMepCircuitEditorStore.getState().setSelectedCircuits(['mepsys_A', 'mepsys_B']);
      useMepCircuitEditorStore.getState().setSelectedCircuits([]);
      const s = useMepCircuitEditorStore.getState();
      expect(s.activeSystemId).toBeNull();
      expect(s.selectedSystemIds.size).toBe(0);
    });

    it('a later single-select collapses a multi-selection to one', () => {
      useMepCircuitEditorStore.getState().setSelectedCircuits(['mepsys_A', 'mepsys_B']);
      useMepCircuitEditorStore.getState().setActiveSystemId('mepsys_A');
      expect([...useMepCircuitEditorStore.getState().selectedSystemIds]).toEqual(['mepsys_A']);
    });

    it('empty-set clear is a referential-stable no-op', () => {
      useMepCircuitEditorStore.getState().setActiveSystemId(null);
      const before = useMepCircuitEditorStore.getState();
      useMepCircuitEditorStore.getState().setSelectedCircuits([]);
      expect(useMepCircuitEditorStore.getState()).toBe(before);
    });
  });
});
