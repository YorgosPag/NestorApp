/**
 * @jest-environment jsdom
 *
 * ADR-652 M6 — CreateBlockDialog (pure UI) tests: το `canConfirm` gate (κενό όνομα / nameTaken)
 * + το `onSubmit` περνά το σωστό `replaceWithInstance` (default ON = AutoCAD BLOCK· toggle OFF =
 * WBLOCK) + το «Επιλογή σημείου βάσης» καλεί το callback και εμφανίζει το επιλεγμένο σημείο.
 *
 * i18n: mock ΚΑΙ `@/i18n` ΚΑΙ `@/i18n/hooks/useTranslation` (ο `<Dialog>` το τραβά από deep path).
 * ΟΧΙ import `jest` από `@jest/globals` (σπάει το hoisting των mocks). Το βαρύ `BlockMetadataFields`
 * μοκάρεται σε ένα απλό input (κρατά τα pure helpers μέσω `requireActual`) — απομονώνει τη λογική.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('@/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

jest.mock('../BlockMetadataFields', () => {
  const actual = jest.requireActual('../BlockMetadataFields');
  const R = require('react');
  return {
    ...actual,
    BlockMetadataFormFields: ({
      value,
      onChange,
    }: {
      value: { name: string };
      onChange: (v: unknown) => void;
    }) =>
      R.createElement('input', {
        'aria-label': 'name',
        value: value.name,
        onChange: (e: { target: { value: string } }) => onChange({ ...value, name: e.target.value }),
      }),
  };
});

import { CreateBlockDialog, type CreateBlockDialogProps } from '../CreateBlockDialog';

function setup(over: Partial<CreateBlockDialogProps> = {}) {
  const onSubmit = jest.fn();
  const onCancel = jest.fn();
  const onPickBasePoint = jest.fn();
  const onClearBasePoint = jest.fn();
  render(
    <CreateBlockDialog
      open
      saving={false}
      isNameTaken={() => false}
      basePoint={null}
      onPickBasePoint={onPickBasePoint}
      onClearBasePoint={onClearBasePoint}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...over}
    />,
  );
  return { onSubmit, onCancel, onPickBasePoint, onClearBasePoint };
}

const confirmBtn = () => screen.getByRole('button', { name: 'blockLibrary.create.confirm' });
const nameInput = () => screen.getByLabelText('name');

describe('ADR-652 M6 — CreateBlockDialog', () => {
  it('confirm is disabled while the name is empty', () => {
    setup();
    expect(confirmBtn()).toBeDisabled();
  });

  it('typing a name enables confirm and submits with replaceWithInstance=true by default', () => {
    const { onSubmit } = setup();
    fireEvent.change(nameInput(), { target: { value: 'Sofa' } });
    expect(confirmBtn()).not.toBeDisabled();
    fireEvent.click(confirmBtn());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Sofa', replaceWithInstance: true }),
    );
  });

  it('confirm stays disabled when the name is already taken', () => {
    setup({ isNameTaken: () => true });
    fireEvent.change(nameInput(), { target: { value: 'Sofa' } });
    expect(confirmBtn()).toBeDisabled();
  });

  it('unchecking «replace with instance» submits replaceWithInstance=false (WBLOCK)', () => {
    const { onSubmit } = setup();
    fireEvent.change(nameInput(), { target: { value: 'Sofa' } });
    fireEvent.click(screen.getByRole('checkbox')); // default checked → uncheck
    fireEvent.click(confirmBtn());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Sofa', replaceWithInstance: false }),
    );
  });

  it('«Pick base point» calls the callback; a null base shows the automatic label', () => {
    const { onPickBasePoint } = setup();
    expect(screen.getByText('blockLibrary.create.basePointAuto')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'blockLibrary.create.pickBasePoint' }));
    expect(onPickBasePoint).toHaveBeenCalledTimes(1);
  });

  it('a picked base point is shown as coordinates and offers a reset', () => {
    const { onClearBasePoint } = setup({ basePoint: { x: 12.34, y: 56.78 } });
    expect(screen.getByText('12.3, 56.8')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'blockLibrary.create.basePointClear' }));
    expect(onClearBasePoint).toHaveBeenCalledTimes(1);
  });
});
