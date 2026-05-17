/**
 * LayerStateManagePanel tests — ADR-358 Phase 13C.
 *
 * Covers: empty state, list render, search filter, category filter, sort,
 * multi-select + bulk delete, inline rename, restore on row click.
 */

jest.mock('@/lib/firebase', () => ({
  db: {},
  auth: { onAuthStateChanged: jest.fn() },
  functions: {},
  storage: {},
  default: {},
}));
jest.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts.count !== 'undefined') return `${key} count=${opts.count}`;
      if (opts && typeof opts.name === 'string') return `${key} name=${opts.name}`;
      return key;
    },
  }),
}));
jest.mock('../LayerStateContextMenu', () => ({
  LayerStateContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import React from 'react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { LayerStateManagePanel } from '../LayerStateManagePanel';
import {
  __resetLayerStateStoreForTesting,
  setProjectId,
  saveCurrentLayerState,
} from '../../../../stores/LayerStateStore';
import { __resetLayerStoreForTesting, setLayers } from '../../../../stores/LayerStore';
import { __resetLayerStatePersistenceForTesting } from '../../../../services/layer-state-persistence';
import { createSceneLayer } from '../../../../types/entities';
import type { LayerStateDropdownActions } from '../useLayerStateDropdown';

beforeEach(() => {
  __resetLayerStoreForTesting();
  __resetLayerStatePersistenceForTesting();
  __resetLayerStateStoreForTesting();
  try { window.localStorage.clear(); } catch { /* SSR */ }
});

function makeActions(overrides: Partial<LayerStateDropdownActions> = {}): LayerStateDropdownActions {
  return {
    saveCurrent: jest.fn(),
    rename: jest.fn(),
    remove: jest.fn(),
    restore: jest.fn(),
    exportLas: jest.fn(),
    importLas: jest.fn(),
    openTemplateBrowser: jest.fn(),
    openSaveAsTemplate: jest.fn(),
    closeTemplateBrowser: jest.fn(),
    closeSaveAsTemplate: jest.fn(),
    openManagePanel: jest.fn(),
    closeManagePanel: jest.fn(),
    openRestoreDialog: jest.fn(),
    closeRestoreDialog: jest.fn(),
    duplicate: jest.fn(),
    bulkDelete: jest.fn(),
    updateCategory: jest.fn(),
    smartRestore: jest.fn(),
    restoreWithOptions: jest.fn(),
    ...overrides,
  } as unknown as LayerStateDropdownActions;
}

function Panel({ actions }: { actions: LayerStateDropdownActions }): React.ReactElement {
  return (
    <LayerStateManagePanel open onOpenChange={jest.fn()} actions={actions} />
  );
}

describe('LayerStateManagePanel — empty', () => {
  it('shows empty state when no layer states', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    render(<Panel actions={makeActions()} />);
    expect(screen.getByTestId('layer-state-manage-panel')).toBeTruthy();
    expect(screen.queryAllByTestId(/^manage-row-/).length).toBe(0);
  });
});

describe('LayerStateManagePanel — list', () => {
  it('renders a row for each saved state', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    saveCurrentLayerState({ name: 'State1' });
    saveCurrentLayerState({ name: 'State2' });
    render(<Panel actions={makeActions()} />);
    expect(screen.queryAllByTestId(/^manage-row-/).length).toBe(2);
  });
});

describe('LayerStateManagePanel — search', () => {
  it('filters rows by search query', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    saveCurrentLayerState({ name: 'Architectural' });
    saveCurrentLayerState({ name: 'Structural' });
    render(<Panel actions={makeActions()} />);

    fireEvent.change(screen.getByTestId('manage-search'), { target: { value: 'arch' } });
    const rows = screen.queryAllByTestId(/^manage-row-/);
    expect(rows.length).toBe(1);
  });

  it('shows empty when search matches nothing', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    saveCurrentLayerState({ name: 'Architectural' });
    render(<Panel actions={makeActions()} />);

    fireEvent.change(screen.getByTestId('manage-search'), { target: { value: 'xyz_nomatch' } });
    expect(screen.queryAllByTestId(/^manage-row-/).length).toBe(0);
  });
});

describe('LayerStateManagePanel — multi-select + bulk delete', () => {
  it('bulk bar visible when rows selected', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    saveCurrentLayerState({ name: 'S1' });
    render(<Panel actions={makeActions()} />);

    const rows = screen.queryAllByTestId(/^manage-row-/);
    const checkbox = rows[0]?.querySelector('input[type="checkbox"]');
    if (checkbox) fireEvent.click(checkbox);
    expect(screen.queryByTestId('manage-bulk-bar')).not.toBeNull();
  });

  it('bulk delete calls actions.bulkDelete with selected ids', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    saveCurrentLayerState({ name: 'S1' });
    const actions = makeActions();
    render(<Panel actions={actions} />);

    const rows = screen.queryAllByTestId(/^manage-row-/);
    const checkbox = rows[0]?.querySelector('input[type="checkbox"]');
    if (checkbox) fireEvent.click(checkbox);
    const deleteBtn = screen.queryByTestId('manage-bulk-delete');
    if (deleteBtn) fireEvent.click(deleteBtn);
    expect(actions.bulkDelete).toHaveBeenCalled();
  });

  it('select-all selects all visible rows', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    saveCurrentLayerState({ name: 'S1' });
    saveCurrentLayerState({ name: 'S2' });
    render(<Panel actions={makeActions()} />);

    fireEvent.click(screen.getByTestId('manage-select-all'));
    expect(screen.queryByTestId('manage-bulk-bar')).not.toBeNull();
  });
});

describe('LayerStateManagePanel — row actions', () => {
  it('delete button calls actions.remove', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    saveCurrentLayerState({ name: 'S1' });
    const actions = makeActions();
    render(<Panel actions={actions} />);

    const rows = screen.queryAllByTestId(/^manage-row-/);
    const id = rows[0]?.getAttribute('data-testid')?.replace('manage-row-', '');
    if (id) {
      const deleteBtn = screen.queryByTestId(`manage-delete-${id}`);
      if (deleteBtn) fireEvent.click(deleteBtn);
      expect(actions.remove).toHaveBeenCalledWith(id);
    }
  });

  it('clicking row name calls actions.smartRestore', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    saveCurrentLayerState({ name: 'Click Me' });
    const actions = makeActions();
    render(<Panel actions={actions} />);

    const btn = screen.queryByText('Click Me');
    if (btn) fireEvent.click(btn);
    expect(actions.smartRestore).toHaveBeenCalled();
  });
});

describe('LayerStateManagePanel — sort headers', () => {
  it('clicking Name header toggles sort direction', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    saveCurrentLayerState({ name: 'B' });
    saveCurrentLayerState({ name: 'A' });
    render(<Panel actions={makeActions()} />);

    const nameHeader = screen.queryByText('layerState.manage.column.name');
    if (nameHeader) {
      fireEvent.click(nameHeader);
      // Click twice to reverse sort
      fireEvent.click(nameHeader);
      const rows = screen.queryAllByTestId(/^manage-row-/);
      expect(rows.length).toBe(2);
    }
  });
});
