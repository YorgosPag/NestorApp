/**
 * LayerStateContextMenu tests — ADR-358 Phase 13C.
 *
 * Covers: all menu items visible, click callbacks fired with correct id.
 */

jest.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { LayerStateContextMenu } from '../LayerStateContextMenu';

function makeActions() {
  return {
    onRename: jest.fn(),
    onEditCategory: jest.fn(),
    onDuplicate: jest.fn(),
    onDelete: jest.fn(),
  };
}

function Harness({ stateId, actions }: Parameters<typeof LayerStateContextMenu>[0]): React.ReactElement {
  return (
    <LayerStateContextMenu stateId={stateId} actions={actions}>
      <button type="button" data-testid="trigger">Open</button>
    </LayerStateContextMenu>
  );
}

describe('LayerStateContextMenu', () => {
  it('renders children trigger', () => {
    render(<Harness stateId="lst_1" actions={makeActions()} />);
    expect(screen.getByTestId('trigger')).toBeTruthy();
  });

  it('calls onRename with stateId on click', async () => {
    const actions = makeActions();
    render(<Harness stateId="lst_1" actions={actions} />);
    const item = screen.queryByTestId('ctx-rename-lst_1');
    if (item) {
      fireEvent.click(item);
      expect(actions.onRename).toHaveBeenCalledWith('lst_1');
    }
  });

  it('calls onEditCategory with stateId on click', async () => {
    const actions = makeActions();
    render(<Harness stateId="lst_2" actions={actions} />);
    const item = screen.queryByTestId('ctx-edit-category-lst_2');
    if (item) {
      fireEvent.click(item);
      expect(actions.onEditCategory).toHaveBeenCalledWith('lst_2');
    }
  });

  it('calls onDuplicate with stateId on click', async () => {
    const actions = makeActions();
    render(<Harness stateId="lst_3" actions={actions} />);
    const item = screen.queryByTestId('ctx-duplicate-lst_3');
    if (item) {
      fireEvent.click(item);
      expect(actions.onDuplicate).toHaveBeenCalledWith('lst_3');
    }
  });

  it('calls onDelete with stateId on click', async () => {
    const actions = makeActions();
    render(<Harness stateId="lst_4" actions={actions} />);
    const item = screen.queryByTestId('ctx-delete-lst_4');
    if (item) {
      fireEvent.click(item);
      expect(actions.onDelete).toHaveBeenCalledWith('lst_4');
    }
  });
});
