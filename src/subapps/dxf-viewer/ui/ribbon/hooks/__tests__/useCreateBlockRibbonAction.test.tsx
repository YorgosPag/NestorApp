/**
 * ADR-652 M6 — useCreateBlockRibbonAction (interceptor: opens the create dialog for the selection).
 * Επιβεβαιώνει: fall-through σε άλλες actions· άνοιγμα αιτήματος με την τρέχουσα επιλογή σε
 * `create-block`· hint + ΚΑΝΕΝΑ αίτημα όταν η επιλογή είναι κενή.
 */

import { renderHook } from '@testing-library/react';
import { useCreateBlockRibbonAction } from '../useCreateBlockRibbonAction';
import {
  getCreateBlockRequest,
  __resetCreateBlockRequestForTests,
} from '../../../../systems/block/create-block-request-store';
import { toolHintOverrideStore } from '../../../../hooks/toolHintOverrideStore';

type Sel = { getSelectedEntityIds: () => string[] };

function setup(selectedIds: string[]) {
  const fallback = jest.fn();
  const universalSelection: Sel = { getSelectedEntityIds: () => selectedIds };
  const { result } = renderHook(() =>
    useCreateBlockRibbonAction({ universalSelection, fallback }),
  );
  return { run: result.current, fallback };
}

describe('ADR-652 M6 — useCreateBlockRibbonAction', () => {
  afterEach(() => __resetCreateBlockRequestForTests());

  it('falls through actions other than create-block', () => {
    const { run, fallback } = setup(['a']);
    run('group', undefined);
    expect(fallback).toHaveBeenCalledWith('group', undefined);
    expect(getCreateBlockRequest()).toBeNull();
  });

  it('opens the request with the current selection on create-block', () => {
    const { run, fallback } = setup(['a', 'b']);
    run('create-block');
    expect(getCreateBlockRequest()).toEqual(['a', 'b']);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('shows a hint and does NOT open when the selection is empty', () => {
    const spy = jest.spyOn(toolHintOverrideStore, 'setOverride');
    const { run } = setup([]);
    run('create-block');
    expect(getCreateBlockRequest()).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
