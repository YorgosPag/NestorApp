/**
 * @jest-environment jsdom
 */

/**
 * ADR-917 Φ3γ — the budget tab: cells commit on Enter and restore on Esc, archive offers «Undo» instead of a
 * modal, land exchange is shown in kind outside the totals, a conflict shows both versions.
 */

import { fireEvent, render, screen } from '@testing-library/react';

const setLine = jest.fn(async () => 'saved');
const archiveLine = jest.fn(async () => 'saved');
const resolveConflict = jest.fn();
const notify = jest.fn();
let budgetState: Record<string, unknown> = {};
let ledgerState: Record<string, unknown> | null = null;

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => ({ notify, error: jest.fn() }) }));
jest.mock('@/hooks/useProjectCostLedger', () => ({ useProjectCostLedger: () => ({ ledger: ledgerState }) }));
jest.mock('@/hooks/useProjectBudgetLines', () => ({
  useProjectBudgetLines: () => ({ setLine, archiveLine, resolveConflict, reload: jest.fn(), ...budgetState }),
}));

import { ProjectBudgetTab } from '../ProjectBudgetTab';

const line = (costCode: string, amount: number) => ({ costCode, amount, note: null, pending: false });

beforeEach(() => {
  jest.clearAllMocks();
  budgetState = {
    lines: [line('OIK-2', 1000), line('SOFT-LAND', 500)],
    conflicts: [],
    usedCodes: new Set(['OIK-2', 'SOFT-LAND']),
    loading: false,
    loadError: false,
    readOnly: false,
  };
  ledgerState = { rows: [{ costCode: 'OIK-2', budgetSource: 'allowance', estimateDelta: null }], landExchange: null };
});

/** Rows are in taxonomy order (ΑΤΟΕ → soft); the mocked `t` returns the key, so every amount cell shares it */
function amountCell(index: number): HTMLInputElement {
  return screen.getAllByLabelText('budgetEditor.row.amountAria')[index] as HTMLInputElement;
}

it('two families, each with its total; the allowance says it counts', () => {
  render(<ProjectBudgetTab project={{ id: 'proj_1' }} />);
  expect(screen.getByText('budgetEditor.groups.allowance')).toBeTruthy();
  expect(screen.getByText('budgetEditor.groups.soft')).toBeTruthy();
  expect(screen.getAllByText('budgetEditor.total')).toHaveLength(2);
  expect(screen.getByText('budgetEditor.effect.allowanceActive')).toBeTruthy();
  expect(screen.getByText('budgetEditor.effect.soft')).toBeTruthy();
});

it('🔴 Enter commits the typed amount; Esc restores and sends nothing', () => {
  render(<ProjectBudgetTab project={{ id: 'proj_1' }} />);
  const cell = amountCell(0);
  fireEvent.focus(cell);
  fireEvent.change(cell, { target: { value: '1.250,5' } });
  fireEvent.keyDown(cell, { key: 'Enter' });
  fireEvent.blur(cell);
  expect(setLine).toHaveBeenCalledWith('OIK-2', { amount: 1250.5, note: null });

  setLine.mockClear();
  fireEvent.focus(cell);
  fireEvent.change(cell, { target: { value: '9' } });
  fireEvent.keyDown(cell, { key: 'Escape' });
  fireEvent.blur(cell);
  expect(setLine).not.toHaveBeenCalled();
});

it('🔴 an invalid amount is never sent — the cell restores', () => {
  render(<ProjectBudgetTab project={{ id: 'proj_1' }} />);
  const cell = amountCell(0);
  fireEvent.focus(cell);
  fireEvent.change(cell, { target: { value: '-3' } });
  fireEvent.blur(cell);
  expect(setLine).not.toHaveBeenCalled();
  expect(cell.value).not.toBe('-3');
});

it('🔴 archive ⇒ «Undo» toast that revives the SAME values (no modal)', async () => {
  render(<ProjectBudgetTab project={{ id: 'proj_1' }} />);
  fireEvent.click(screen.getAllByLabelText('budgetEditor.row.archiveAria')[1]);
  await Promise.resolve();
  await Promise.resolve();
  expect(archiveLine).toHaveBeenCalledWith('SOFT-LAND');
  const [, options] = notify.mock.calls[0];
  options.actions[0].onClick();
  expect(setLine).toHaveBeenCalledWith('SOFT-LAND', { amount: 500, note: null });
});

it('land exchange is shown in kind, apart from the tables', () => {
  ledgerState = { rows: [], landExchange: { bartexPercentage: 35, inKindValue: 350000, basis: 'current-hard-budget' } };
  render(<ProjectBudgetTab project={{ id: 'proj_1' }} />);
  expect(screen.getByText('budgetEditor.landExchange.label')).toBeTruthy();
});

it('a conflict shows both versions and resolves by the human\'s choice', () => {
  budgetState.conflicts = [{ costCode: 'SOFT-LAND', mine: { amount: 900, note: null }, theirs: { costCode: 'SOFT-LAND', amount: 300, note: null, revision: 4 } }];
  render(<ProjectBudgetTab project={{ id: 'proj_1' }} />);
  fireEvent.click(screen.getByText('budgetEditor.conflict.keepMine'));
  expect(resolveConflict).toHaveBeenCalledWith('SOFT-LAND', 'mine');
});

it('read-only: no add form, no archive', () => {
  budgetState.readOnly = true;
  render(<ProjectBudgetTab project={{ id: 'proj_1' }} />);
  expect(screen.queryByText('budgetEditor.add.submit')).toBeNull();
  expect(screen.queryAllByLabelText('budgetEditor.row.archiveAria')).toHaveLength(0);
});
