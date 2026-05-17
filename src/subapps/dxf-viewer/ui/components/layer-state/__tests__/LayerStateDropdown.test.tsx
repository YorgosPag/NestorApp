/**
 * LayerStateDropdown — RTL test (ADR-358 Phase 12).
 *
 * Two layers:
 *   1. Shell smoke — `LayerStateDropdown` mounts with the trigger button.
 *   2. Popover behavior — `LayerStateDropdownPopover` rendered directly,
 *      bypassing the Radix Popover wrapper. Verifies list rendering,
 *      save form, delete, rename, and Restore command dispatch.
 *
 * Behavioural coverage (store + persistence + command) lives in their own
 * unit suites; this file only checks the React glue.
 */

// Phase 13B.3 — `LayerStateDropdown.tsx` resolves auth via `useAuth` +
// `useCompanyId`; we stub the chain (incl. firebase) so the harness doesn't
// need a real AuthProvider. Mocks declared before any other imports so the
// swc-jest hoister keeps them ahead of the source-file resolution chain.
jest.mock('@/lib/firebase', () => ({
  db: {},
  auth: { onAuthStateChanged: jest.fn() },
  functions: {},
  storage: {},
  default: {},
}));
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ onAuthStateChanged: jest.fn() })),
  connectAuthEmulator: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  signInWithPopup: jest.fn(),
}));
jest.mock('@/auth/contexts/AuthContext', () => ({
  AuthContext: { Provider: ({ children }: { children: unknown }) => children },
  useAuth: () => ({ user: { uid: 'usr_test' } }),
}));
jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'usr_test' } }),
}));
jest.mock('@/contexts/SuperAdminCompanyContext', () => ({
  useSuperAdminCompany: () => ({ isSuperAdmin: false, activeCompanyId: null }),
}));
jest.mock('@/hooks/useCompanyId', () => ({
  useCompanyId: () => ({ companyId: 'comp_test', source: 'user' }),
}));
jest.mock('../useLayerStateTemplates', () => ({
  useLayerStateTemplates: () => ({
    isReady: true,
    categories: [],
    saveCurrentAsTemplate: jest.fn(),
    importTemplateAsState: jest.fn(),
    searchTemplateSummaries: jest.fn(async () => []),
    refreshCategories: jest.fn(async () => undefined),
  }),
}));
jest.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      // Mirror the previous baseline behaviour: interpolate `{name}` into the
      // returned string so existing selectors keying off `aria-label*="..."`
      // keep matching after we shut down the real i18n loader.
      if (opts && typeof opts.name === 'string') return `${key} ${opts.name}`;
      return key;
    },
  }),
}));

import React from 'react';
import { describe, it, expect, beforeEach } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LayerStateDropdown } from '../LayerStateDropdown';
import { LayerStateDropdownPopover } from '../LayerStateDropdownPopover';
import { useLayerStateDropdown } from '../useLayerStateDropdown';
import {
  __resetLayerStateStoreForTesting,
  saveCurrentLayerState,
  setProjectId,
} from '../../../../stores/LayerStateStore';
import { __resetLayerStoreForTesting, setLayers } from '../../../../stores/LayerStore';
import { __resetLayerStatePersistenceForTesting } from '../../../../services/layer-state-persistence';
import { createSceneLayer } from '../../../../types/entities';
import type { ICommand } from '../../../../core/commands/interfaces';

beforeEach(() => {
  __resetLayerStoreForTesting();
  __resetLayerStatePersistenceForTesting();
  __resetLayerStateStoreForTesting();
  try { window.localStorage.clear(); } catch { /* SSR */ }
});

function makeExecMock(): jest.Mock<void, [ICommand]> {
  return jest.fn<void, [ICommand]>();
}

function PopoverHarness({ executeCommand }: { executeCommand: (cmd: ICommand) => void }): React.ReactElement {
  const { state, actions } = useLayerStateDropdown(executeCommand);
  return <LayerStateDropdownPopover state={state} actions={actions} onClose={() => {}} />;
}

describe('LayerStateDropdown shell — smoke', () => {
  it('renders the status-bar trigger button', () => {
    const exec = makeExecMock();
    const { container } = render(
      <TooltipProvider>
        <LayerStateDropdown executeCommand={exec} />
      </TooltipProvider>,
    );
    expect(container.querySelector('[data-testid="layer-state-dropdown-trigger"]')).not.toBeNull();
  });
});

describe('LayerStateDropdownPopover — list rendering', () => {
  it('shows empty state when no saved states exist', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    const exec = makeExecMock();
    render(
      <TooltipProvider>
        <PopoverHarness executeCommand={exec} />
      </TooltipProvider>,
    );
    const list = screen.getByTestId('layer-state-list');
    // No row elements rendered; only the empty placeholder <li>.
    expect(list.querySelectorAll('[data-testid^="layer-state-row-"]').length).toBe(0);
    expect(list.querySelectorAll('li').length).toBe(1);
  });

  it('lists saved states after a save', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    saveCurrentLayerState({ name: 'baseline' });
    const exec = makeExecMock();
    render(
      <TooltipProvider>
        <PopoverHarness executeCommand={exec} />
      </TooltipProvider>,
    );
    expect(screen.getByTestId('layer-state-list').textContent).toContain('baseline');
  });
});

describe('LayerStateDropdownPopover — interactions', () => {
  it('clicking a state row dispatches RestoreLayerStateCommand', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    const saved = saveCurrentLayerState({ name: 's1' })!;
    const exec = makeExecMock();
    render(
      <TooltipProvider>
        <PopoverHarness executeCommand={exec} />
      </TooltipProvider>,
    );
    const row = screen.getByTestId(`layer-state-row-${saved.id}`);
    const restoreButton = row.querySelector('button[aria-label*="s1"]') as HTMLButtonElement;
    fireEvent.click(restoreButton);
    expect(exec).toHaveBeenCalledTimes(1);
    const dispatched = exec.mock.calls[0][0];
    expect(dispatched.type).toBe('layer-state-restore');
  });

  it('save form persists a state through the confirm button', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    const exec = makeExecMock();
    render(
      <TooltipProvider>
        <PopoverHarness executeCommand={exec} />
      </TooltipProvider>,
    );
    const input = screen.getByTestId('layer-state-save-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'fresh' } });
    fireEvent.click(screen.getByTestId('layer-state-save-confirm'));
    expect(screen.getByTestId('layer-state-list').textContent).toContain('fresh');
  });

  it('delete button removes the state row', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    const saved = saveCurrentLayerState({ name: 'gone' })!;
    const exec = makeExecMock();
    render(
      <TooltipProvider>
        <PopoverHarness executeCommand={exec} />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByTestId(`layer-state-delete-${saved.id}`));
    expect(screen.queryByTestId(`layer-state-row-${saved.id}`)).toBeNull();
  });

  it('rename inline edit commits via Enter', () => {
    setLayers([createSceneLayer({ name: 'A' })]);
    setProjectId('p1');
    const saved = saveCurrentLayerState({ name: 'old' })!;
    const exec = makeExecMock();
    render(
      <TooltipProvider>
        <PopoverHarness executeCommand={exec} />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByTestId(`layer-state-rename-${saved.id}`));
    const input = screen.getByTestId(`layer-state-rename-input-${saved.id}`) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'new' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('layer-state-list').textContent).toContain('new');
    expect(screen.getByTestId('layer-state-list').textContent).not.toContain('old');
  });
});
