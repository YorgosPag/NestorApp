/**
 * useFamilyTypeEditor — the rename + edit-type behaviour shared by the wall/opening
 * Family Type Properties widgets (ADR-412 Φ4 / ADR-421 SLICE C).
 *
 * Added with the extraction that removed the sibling clones CHECK 3.28 flagged across
 * `RibbonWallTypePropertiesWidget` ↔ `RibbonOpeningTypePropertiesWidget` (ADR-584 / N.18).
 * The guards asserted here — built-in read-only, no-op on unchanged/blank rename, and the
 * clone-then-open flow for built-ins — previously lived (untested) in duplicate; now one
 * copy serves both widgets, so a regression here breaks every category at once.
 */
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { useFamilyTypeEditor, type FamilyTypeEditorController } from '../useFamilyTypeEditor';
import type { BimFamilyType } from '../../../../bim/types/bim-family-type';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function makeType(overrides: Partial<BimFamilyType> = {}): BimFamilyType {
  return {
    id: 't1',
    category: 'wall',
    name: 'My Type',
    scope: 'company',
    origin: 'user',
    typeParams: { thickness: 200 },
    companyId: 'c1',
    ownerId: 'u1',
    ...overrides,
  } as unknown as BimFamilyType;
}

function makeCtrl(overrides: Partial<FamilyTypeEditorController> = {}): FamilyTypeEditorController {
  return {
    currentType: makeType(),
    overriddenKeys: [],
    canWrite: true,
    resetOverrides: jest.fn(),
    duplicateCurrent: jest.fn(async () => 'clone-1'),
    renameType: jest.fn(async () => undefined),
    deleteType: jest.fn(async () => undefined),
    ...overrides,
  };
}

/** A keydown event stub — only `key` + `currentTarget.blur` are read. */
function keyEvent(key: string): { event: React.KeyboardEvent<HTMLInputElement>; blur: jest.Mock } {
  const blur = jest.fn();
  return {
    event: { key, currentTarget: { blur } } as unknown as React.KeyboardEvent<HTMLInputElement>,
    blur,
  };
}

describe('useFamilyTypeEditor — editability', () => {
  it('a user type with write access is editable', () => {
    const { result } = renderHook(() => useFamilyTypeEditor(makeCtrl(), jest.fn()));
    expect(result.current.editable).toBe(true);
    expect(result.current.isBuiltIn).toBe(false);
  });

  it('a built-in type is never editable, even with write access', () => {
    const ctrl = makeCtrl({ currentType: makeType({ origin: 'built-in' }) });
    const { result } = renderHook(() => useFamilyTypeEditor(ctrl, jest.fn()));

    expect(result.current.isBuiltIn).toBe(true);
    expect(result.current.editable).toBe(false);
  });

  it('a user type without write access is not editable', () => {
    const { result } = renderHook(() => useFamilyTypeEditor(makeCtrl({ canWrite: false }), jest.fn()));
    expect(result.current.editable).toBe(false);
  });

  it('is not editable when there is no type at all', () => {
    const { result } = renderHook(() => useFamilyTypeEditor(makeCtrl({ currentType: null }), jest.fn()));
    expect(result.current.editable).toBe(false);
    expect(result.current.typeName).toBe('');
  });
});

describe('useFamilyTypeEditor — rename draft', () => {
  it('seeds the draft from the resolved type name', () => {
    const { result } = renderHook(() => useFamilyTypeEditor(makeCtrl(), jest.fn()));
    expect(result.current.draft).toBe('My Type');
  });

  it('re-syncs the draft when the selected type changes', () => {
    const { result, rerender } = renderHook(
      ({ ctrl }: { ctrl: FamilyTypeEditorController }) => useFamilyTypeEditor(ctrl, jest.fn()),
      { initialProps: { ctrl: makeCtrl() } },
    );

    act(() => result.current.setDraft('half-typed'));
    rerender({ ctrl: makeCtrl({ currentType: makeType({ id: 't2', name: 'Other Type' }) }) });

    expect(result.current.draft).toBe('Other Type');
  });

  it('commits a changed draft through the controller', () => {
    const ctrl = makeCtrl();
    const { result } = renderHook(() => useFamilyTypeEditor(ctrl, jest.fn()));

    act(() => result.current.setDraft('Renamed'));
    act(() => result.current.commitRename());

    expect(ctrl.renameType).toHaveBeenCalledWith('t1', 'Renamed');
  });

  it('trims the draft before committing', () => {
    const ctrl = makeCtrl();
    const { result } = renderHook(() => useFamilyTypeEditor(ctrl, jest.fn()));

    act(() => result.current.setDraft('  Padded  '));
    act(() => result.current.commitRename());

    expect(ctrl.renameType).toHaveBeenCalledWith('t1', 'Padded');
  });

  it('does not commit an unchanged name', () => {
    const ctrl = makeCtrl();
    const { result } = renderHook(() => useFamilyTypeEditor(ctrl, jest.fn()));

    act(() => result.current.commitRename());

    expect(ctrl.renameType).not.toHaveBeenCalled();
  });

  it('does not commit a blank draft', () => {
    const ctrl = makeCtrl();
    const { result } = renderHook(() => useFamilyTypeEditor(ctrl, jest.fn()));

    act(() => result.current.setDraft('   '));
    act(() => result.current.commitRename());

    expect(ctrl.renameType).not.toHaveBeenCalled();
  });

  it('never renames a built-in type', () => {
    const ctrl = makeCtrl({ currentType: makeType({ origin: 'built-in' }) });
    const { result } = renderHook(() => useFamilyTypeEditor(ctrl, jest.fn()));

    act(() => result.current.setDraft('Renamed'));
    act(() => result.current.commitRename());

    expect(ctrl.renameType).not.toHaveBeenCalled();
  });
});

describe('useFamilyTypeEditor — keyboard', () => {
  it('Enter blurs, letting the blur handler commit', () => {
    const { result } = renderHook(() => useFamilyTypeEditor(makeCtrl(), jest.fn()));
    const { event, blur } = keyEvent('Enter');

    act(() => result.current.onNameKeyDown(event));

    expect(blur).toHaveBeenCalledTimes(1);
    expect(result.current.draft).toBe('My Type');
  });

  it('Escape reverts the draft, then blurs', () => {
    const { result } = renderHook(() => useFamilyTypeEditor(makeCtrl(), jest.fn()));
    const { event, blur } = keyEvent('Escape');

    act(() => result.current.setDraft('abandoned'));
    act(() => result.current.onNameKeyDown(event));

    expect(result.current.draft).toBe('My Type');
    expect(blur).toHaveBeenCalledTimes(1);
  });

  it('other keys are left to the input', () => {
    const { result } = renderHook(() => useFamilyTypeEditor(makeCtrl(), jest.fn()));
    const { event, blur } = keyEvent('a');

    act(() => result.current.onNameKeyDown(event));

    expect(blur).not.toHaveBeenCalled();
  });
});

describe('useFamilyTypeEditor — onEditType', () => {
  it('opens the editor directly on a user type', async () => {
    const ctrl = makeCtrl();
    const openEditor = jest.fn();
    const { result } = renderHook(() => useFamilyTypeEditor(ctrl, openEditor));

    await act(async () => await result.current.onEditType());

    expect(ctrl.duplicateCurrent).not.toHaveBeenCalled();
    expect(openEditor).toHaveBeenCalledWith('t1');
  });

  it('clones a built-in first, then opens the editor on the clone', async () => {
    const ctrl = makeCtrl({ currentType: makeType({ origin: 'built-in' }) });
    const openEditor = jest.fn();
    const { result } = renderHook(() => useFamilyTypeEditor(ctrl, openEditor));

    await act(async () => await result.current.onEditType());

    expect(ctrl.duplicateCurrent).toHaveBeenCalledTimes(1);
    expect(openEditor).toHaveBeenCalledWith('clone-1');
    // The built-in itself must never be opened for editing.
    expect(openEditor).not.toHaveBeenCalledWith('t1');
  });

  it('does not open an editor when the clone fails', async () => {
    const ctrl = makeCtrl({
      currentType: makeType({ origin: 'built-in' }),
      duplicateCurrent: jest.fn(async () => null),
    });
    const openEditor = jest.fn();
    const { result } = renderHook(() => useFamilyTypeEditor(ctrl, openEditor));

    await act(async () => await result.current.onEditType());

    expect(openEditor).not.toHaveBeenCalled();
  });

  it('is a no-op without a type', async () => {
    const ctrl = makeCtrl({ currentType: null });
    const openEditor = jest.fn();
    const { result } = renderHook(() => useFamilyTypeEditor(ctrl, openEditor));

    await act(async () => await result.current.onEditType());

    expect(ctrl.duplicateCurrent).not.toHaveBeenCalled();
    expect(openEditor).not.toHaveBeenCalled();
  });
});
