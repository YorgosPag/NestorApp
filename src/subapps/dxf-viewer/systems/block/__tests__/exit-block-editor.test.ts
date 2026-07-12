/**
 * ADR-641 Φ3 — exitBlockEditAndReselect: the SSoT exit gesture shared by the Esc handler and the
 * status-bar «Κλείσιμο» button. Proves it closes the editor AND re-selects the exited block (so the
 * whole block is highlighted again for a second-Esc deselect), and is a safe no-op at the top level.
 */

import { exitBlockEditAndReselect } from '../exit-block-editor';
import { enterBlockEdit, exitBlockEdit, isBlockEditActive } from '../ActiveBlockEditStore';
import { SelectedEntitiesStore } from '../../selection/SelectedEntitiesStore';

describe('exitBlockEditAndReselect', () => {
  beforeEach(() => {
    exitBlockEdit();
    SelectedEntitiesStore._resetForTests();
  });
  afterAll(() => exitBlockEdit());

  it('closes the editor and re-selects the exited block', () => {
    enterBlockEdit('blk1', '*U2');
    expect(isBlockEditActive()).toBe(true);

    exitBlockEditAndReselect();

    expect(isBlockEditActive()).toBe(false);
    expect(SelectedEntitiesStore.getSelectedEntityIds()).toEqual(['blk1']);
  });

  it('is a no-op at the top level (selection untouched)', () => {
    SelectedEntitiesStore.replaceEntitySelection(['other']);
    exitBlockEditAndReselect();
    expect(isBlockEditActive()).toBe(false);
    expect(SelectedEntitiesStore.getSelectedEntityIds()).toEqual(['other']);
  });
});
