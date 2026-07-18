/**
 * @jest-environment jsdom
 *
 * ADR-652 M6 — CreateBlockDialogHost (ενορχήστρωση) tests:
 *  - replace path (AutoCAD BLOCK) → undoable command executed + reselect του created instance +
 *    persist στη βιβλιοθήκη + κλείσιμο αιτήματος.
 *  - WBLOCK path (replaceWithInstance=false) → ΚΑΝΕΝΑ command, κανένα reselect, αλλά persist + close.
 *  - cancel → κλείσιμο αιτήματος χωρίς build/persist.
 *
 * Ο pure διάλογος μοκάρεται σε buttons που καλούν `onSubmit`/`onCancel` — έτσι οδηγούμε το path
 * ντετερμινιστικά χωρίς να εξαρτόμαστε από το UI της φόρμας (καλύπτεται στο CreateBlockDialog.test).
 * ΟΧΙ import `jest` από `@jest/globals` (hoisting).
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../CreateBlockDialog', () => {
  const R = require('react');
  const values = (replaceWithInstance: boolean) => ({
    name: 'Sofa',
    category: 'furniture',
    license: 'MIT',
    replaceWithInstance,
  });
  return {
    CreateBlockDialog: ({
      onSubmit,
      onCancel,
    }: {
      onSubmit: (v: unknown) => void;
      onCancel: () => void;
    }) =>
      R.createElement(
        'div',
        null,
        R.createElement(
          'button',
          { 'data-testid': 'submit-replace', onClick: () => onSubmit(values(true)) },
          'replace',
        ),
        R.createElement(
          'button',
          { 'data-testid': 'submit-wblock', onClick: () => onSubmit(values(false)) },
          'wblock',
        ),
        R.createElement('button', { 'data-testid': 'cancel', onClick: onCancel }, 'cancel'),
      ),
  };
});

jest.mock('../../../../systems/block/create-block-request-store', () => ({
  useCreateBlockRequest: () => ['e1', 'e2'],
  clearCreateBlockRequest: jest.fn(),
}));

jest.mock('../../../../systems/block/build-block-def-from-selection', () => ({
  buildBlockDefFromSelection: jest.fn(() => ({
    def: { name: 'Sofa', localMembers: [], boundsMm: { minX: 0, minY: 0, maxX: 1, maxY: 1 } },
    base: { x: 0, y: 0 },
  })),
}));

jest.mock('../../../../core/commands/entity-commands/CreateBlockFromSelectionCommand', () => ({
  CreateBlockFromSelectionCommand: jest.fn().mockImplementation((_ids: unknown, name: string) => ({
    getCreatedDef: () => ({ name, localMembers: [], boundsMm: { minX: 0, minY: 0, maxX: 1, maxY: 1 } }),
    getCreatedEntityId: () => 'blk_new',
  })),
}));

jest.mock('../../../../core/commands', () => {
  const execute = jest.fn();
  return { useCommandHistory: () => ({ execute }) };
});

jest.mock('../../../../systems/entity-creation/LevelSceneManagerAdapter', () => ({
  createLevelSceneManagerAdapter: () => ({}),
}));

jest.mock('../../../../systems/selection', () => ({
  SelectedEntitiesStore: { replaceEntitySelection: jest.fn() },
}));

jest.mock('../../../../bim/block-library/block-palette-entries', () => ({
  isBlockNameTaken: () => false,
}));

jest.mock('../hooks/useBlockLibraryPalette', () => {
  const saveNewBlockFromDef = jest.fn(() => Promise.resolve());
  return { useBlockLibraryPalette: () => ({ entries: [], saveNewBlockFromDef }) };
});

import { CreateBlockDialogHost, type CreateBlockDialogHostProps } from '../CreateBlockDialogHost';
import { CreateBlockFromSelectionCommand } from '../../../../core/commands/entity-commands/CreateBlockFromSelectionCommand';
import { useCommandHistory } from '../../../../core/commands';
import { SelectedEntitiesStore } from '../../../../systems/selection';
import { clearCreateBlockRequest } from '../../../../systems/block/create-block-request-store';
import { useBlockLibraryPalette } from '../hooks/useBlockLibraryPalette';

const CmdMock = CreateBlockFromSelectionCommand as unknown as jest.Mock;
const executeCommand = useCommandHistory().execute as jest.Mock;
const replaceSelection = SelectedEntitiesStore.replaceEntitySelection as jest.Mock;
const clearReq = clearCreateBlockRequest as jest.Mock;
const saveNewBlockFromDef = useBlockLibraryPalette(undefined).saveNewBlockFromDef as jest.Mock;

const levelManager = {
  currentLevelId: 'L1',
  getLevelScene: jest.fn(() => ({ entities: [{ id: 'e1' }, { id: 'e2' }] })),
  setLevelScene: jest.fn(),
} as unknown as CreateBlockDialogHostProps['levelManager'];

const renderHost = () => render(<CreateBlockDialogHost levelManager={levelManager} />);

describe('ADR-652 M6 — CreateBlockDialogHost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('replace path: executes the command, reselects the instance, persists, and closes', async () => {
    renderHost();
    fireEvent.click(screen.getByTestId('submit-replace'));
    await waitFor(() => expect(clearReq).toHaveBeenCalled());

    expect(CmdMock).toHaveBeenCalledWith(['e1', 'e2'], 'Sofa', {}, undefined);
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(replaceSelection).toHaveBeenCalledWith(['blk_new']);
    expect(saveNewBlockFromDef).toHaveBeenCalledTimes(1);
  });

  it('WBLOCK path: no command, no reselect, still persists and closes', async () => {
    renderHost();
    fireEvent.click(screen.getByTestId('submit-wblock'));
    await waitFor(() => expect(clearReq).toHaveBeenCalled());

    expect(CmdMock).not.toHaveBeenCalled();
    expect(executeCommand).not.toHaveBeenCalled();
    expect(replaceSelection).not.toHaveBeenCalled();
    expect(saveNewBlockFromDef).toHaveBeenCalledTimes(1);
  });

  it('cancel closes the request without building or persisting', () => {
    renderHost();
    fireEvent.click(screen.getByTestId('cancel'));

    expect(clearReq).toHaveBeenCalledTimes(1);
    expect(CmdMock).not.toHaveBeenCalled();
    expect(saveNewBlockFromDef).not.toHaveBeenCalled();
  });
});
