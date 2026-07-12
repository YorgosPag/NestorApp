/**
 * ADR-641 §3 — useBlockEditorExitEscape: ESC closes the active Block Editor via the escape bus.
 * Proves the handler only claims ESC while a block is entered (BLOCK_EDITOR_EXIT 274), and on claim
 * closes the editor + re-selects the block — the step-out ladder (a second ESC then deselects).
 */

import { renderHook } from '@testing-library/react';
import { useBlockEditorExitEscape } from '../useBlockEditorExitEscape';
import { escapeBus } from '../../escape-bus';
import { enterBlockEdit, exitBlockEdit, isBlockEditActive } from '../ActiveBlockEditStore';
import { SelectedEntitiesStore } from '../../selection/SelectedEntitiesStore';

const pressEscape = () =>
  escapeBus.__dispatchForTests(new KeyboardEvent('keydown', { key: 'Escape' }));

describe('useBlockEditorExitEscape', () => {
  beforeEach(() => {
    escapeBus.__resetForTests();
    exitBlockEdit();
    SelectedEntitiesStore._resetForTests();
  });
  afterAll(() => {
    escapeBus.__resetForTests();
    exitBlockEdit();
  });

  it('does not claim ESC at the top level (no editor open)', () => {
    renderHook(() => useBlockEditorExitEscape());
    expect(pressEscape().consumed).toBe(false);
  });

  it('claims ESC inside a block editor → closes it and re-selects the block', () => {
    renderHook(() => useBlockEditorExitEscape());
    enterBlockEdit('blk1', '*U2');

    const result = pressEscape();

    expect(result.consumed).toBe(true);
    expect(result.consumedBy).toBe('block/exit-block-editor');
    expect(isBlockEditActive()).toBe(false);
    expect(SelectedEntitiesStore.getSelectedEntityIds()).toEqual(['blk1']);
  });
});
