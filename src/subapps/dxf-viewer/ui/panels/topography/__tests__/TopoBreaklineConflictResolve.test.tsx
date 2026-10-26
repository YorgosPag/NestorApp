/**
 * @jest-environment jsdom
 *
 * ADR-920 Β4.8 Β3.6 — Resolve Crossing from the «Ασυνέχειες επιφάνειας» list, over the REAL stores, the REAL ONE
 * triangulation and the REAL undoable command. Only the view movement and the translation are mocked: the questions are
 * «does the preview say what Apply then does?», «does every write go through the ONE undoable door?», and «does a
 * survey-kept conflict refuse to pretend?».
 */

import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const args = params ? Object.entries(params).map(([k, v]) => `${k}=${String(v)}`).join(',') : '';
      return args ? `${key}(${args})` : key;
    },
  }),
}));
jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));
jest.mock('../../../../systems/topography/topo-review-focus', () => ({
  ...jest.requireActual('../../../../systems/topography/topo-review-focus'),
  focusTopoReviewTarget: jest.fn(() => true),
}));

// eslint-disable-next-line import/first -- mocks first
import { TopoBreaklineListSection } from '../TopoBreaklineListSection';
// eslint-disable-next-line import/first
import { clearTopo, getTopoBreaklines, setTopoBreaklines, setTopoPoints } from '../../../../systems/topography/TopoPointStore';
// eslint-disable-next-line import/first
import { restoreBreaklineDisplay } from '../../../../systems/topography/topo-breakline-display-store';
// eslint-disable-next-line import/first
import { getGlobalCommandHistory } from '../../../../core/commands/CommandHistory';
// eslint-disable-next-line import/first
import type { Breakline } from '../../../../systems/topography/topo-types';

const NS = 'topography.breaklines';
const line = (id: string, x0: number, y0: number, x1: number, y1: number, z: number, extra: Partial<Breakline> = {}): Breakline => ({
  id, vertices: [{ x: x0, y: y0, z }, { x: x1, y: y1, z }], ...extra,
});
/** ridge 1.00 m (earlier) × ditch 3.00 m, meeting at WORLD (5000, 5000). */
const PAIR = (): Breakline[] => [line('ridge', 0, 0, 10_000, 10_000, 1_000), line('ditch', 10_000, 0, 0, 10_000, 3_000)];

function seed(lines: readonly Breakline[]): void {
  act(() => { setTopoBreaklines(lines, 'existing'); });
}

const openConflict = (): void => {
  fireEvent.click(screen.getAllByRole('button', { name: `${NS}.conflictFocusHint` })[0]!);
};
const chooseRule = (rule: string): void => {
  fireEvent.click(screen.getAllByRole('radio', { name: `${NS}.resolve.rule.${rule}` }).at(-1)!);
};
const apply = (): void => { fireEvent.click(screen.getByRole('button', { name: `${NS}.resolve.apply` })); };

/** React reports invalid DOM nesting (a hydration error in the browser) only via console.error — never a failure. */
const DOM_NESTING = /cannot be a descendant of|cannot contain a nested/;

describe('ADR-920 Β3.6 — Resolve Crossing in the breakline list', () => {
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    act(() => { clearTopo(); restoreBreaklineDisplay({ visible: true }); });
    getGlobalCommandHistory().clear();
    consoleError = jest.spyOn(console, 'error');
  });
  afterEach(() => {
    const nesting = consoleError.mock.calls.filter((args) => DOM_NESTING.test(String(args[0])));
    consoleError.mockRestore();
    expect(nesting).toEqual([]);
  });

  it('preview → Apply: the point gets the previewed Z, the conflict moves to «resolved», Ctrl+Z undoes it', () => {
    seed(PAIR());
    render(<TopoBreaklineListSection />);
    openConflict();
    chooseRule('average');
    expect(screen.getByText(/resolve\.preview\(z=2\.00,keptLine=1,line=2,shiftKept=\+1\.00,shiftLine=-1\.00\)/)).toBeTruthy();
    apply();
    expect(getTopoBreaklines('existing')[1]?.crossingResolutions).toEqual([
      { withBreaklineId: 'ridge', x: 5_000, y: 5_000, rule: 'average' },
    ]);
    expect(screen.getByText(`${NS}.resolvedTitle(count=1)`)).toBeTruthy();
    act(() => { getGlobalCommandHistory().undo(); });
    expect(getTopoBreaklines('existing')).toEqual(PAIR());
    expect(screen.getByText(`${NS}.conflictsTitle(count=1)`)).toBeTruthy();
  });

  it('Specify: a typed value (comma decimal) is stored in canonical mm; nothing typed ⇒ no Apply', () => {
    seed(PAIR());
    render(<TopoBreaklineListSection />);
    openConflict();
    chooseRule('specify');
    const input = screen.getByLabelText(`${NS}.resolve.specifyLabel`);
    fireEvent.change(input, { target: { value: '' } });
    expect((screen.getByRole('button', { name: `${NS}.resolve.apply` }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: '2,5' } });
    apply();
    expect(getTopoBreaklines('existing')[1]?.crossingResolutions?.[0]).toMatchObject({ rule: 'specify', z: 2_500 });
  });

  it('a resolved conflict offers Revert — back to «the earlier wins», one undoable step', () => {
    seed([PAIR()[0]!, { ...PAIR()[1]!, crossingResolutions: [{ withBreaklineId: 'ridge', x: 5_000, y: 5_000, rule: 'lower' }] }]);
    render(<TopoBreaklineListSection />);
    openConflict();
    fireEvent.click(screen.getByRole('button', { name: `${NS}.resolve.revert` }));
    expect(getTopoBreaklines('existing')).toEqual(PAIR());
  });

  it('«Resolve all» = every open conflict with one rule, ONE undo', () => {
    seed([...PAIR(), line('path', 2_000, 0, 2_000, 10_000, 9_000)]);
    render(<TopoBreaklineListSection />);
    fireEvent.click(screen.getByRole('button', { name: /resolve\.all\(count=3\)/ }));
    expect(screen.queryByText(/conflictsTitle/)).toBeNull();
    expect(screen.getByText(`${NS}.resolvedTitle(count=3)`)).toBeTruthy();
    act(() => { getGlobalCommandHistory().undo(); });
    expect(getTopoBreaklines('existing').some((b) => b.crossingResolutions)).toBe(false);
  });

  it('a SURVEY point kept its Z: no rule is offered — the measurement wins, and the panel says so', () => {
    act(() => { setTopoPoints([{ x: 5_000, y: 5_000, z: 500 }, { x: 0, y: 9_000, z: 0 }, { x: 9_000, y: 0, z: 0 }]); });
    seed([line('ridge', 0, 0, 10_000, 10_000, 1_000)]);
    render(<TopoBreaklineListSection />);
    openConflict();
    expect(screen.getByText(`${NS}.resolve.surveyWins`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: `${NS}.resolve.apply` })).toBeNull();
  });

  it('a decision whose partner is gone is listed as no longer applying, and can be dropped', () => {
    seed([line('ditch', 10_000, 0, 0, 10_000, 3_000, {
      crossingResolutions: [{ withBreaklineId: 'gone', x: 5_000, y: 5_000, rule: 'higher' }],
    })]);
    render(<TopoBreaklineListSection />);
    expect(screen.getByText(`${NS}.unappliedTitle(count=1)`)).toBeTruthy();
    expect(screen.getByText(`${NS}.unappliedItem(owner=1,with=gone)`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `${NS}.unappliedDrop` }));
    expect(getTopoBreaklines('existing')[0]).not.toHaveProperty('crossingResolutions');
  });
});
