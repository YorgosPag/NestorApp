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
});
