/**
 * @jest-environment jsdom
 *
 * ADR-920 Β4.8 Β3.5 — the «Ασυνέχειες επιφάνειας» list over the REAL stores, the REAL undoable command and the REAL
 * inventory. Only the view movement (`focusTopoReviewTarget`) and the translation are mocked: the questions are
 * «does a click reach the right SSoT, with the right arguments?» and «does Remove go through the ONE undoable door?».
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
import { clearTopo, getTopoBreaklines } from '../../../../systems/topography/TopoPointStore';
// eslint-disable-next-line import/first
import {
  getBreaklineDisplayState, restoreBreaklineDisplay,
} from '../../../../systems/topography/topo-breakline-display-store';
// eslint-disable-next-line import/first
import { focusTopoReviewTarget, TOPO_REVIEW_FOCUS_PAD_MM } from '../../../../systems/topography/topo-review-focus';
// eslint-disable-next-line import/first
import { seedBreakline } from '../../../../systems/topography/__tests__/topo-breakline-fixtures';
// eslint-disable-next-line import/first
import { getGlobalCommandHistory } from '../../../../core/commands/CommandHistory';

const focusMock = focusTopoReviewTarget as jest.MockedFunction<typeof focusTopoReviewTarget>;
const V1 = [{ x: 0, y: 0, z: 1_000 }, { x: 10_000, y: 0, z: 2_000 }];
const V2 = [{ x: 0, y: 5_000, z: 1_000 }, { x: 10_000, y: 5_000, z: 1_000 }];

function seedTwo(): void {
  act(() => {
    seedBreakline(V1, false, 'ent_1', 'existing', 'elevation');
    seedBreakline(V2, false, undefined, 'existing', 'surface');
  });
}

const rowButtons = (): HTMLElement[] =>
  screen.getAllByRole('button', { name: /topography\.breaklines\.focusHint/ });

describe('ADR-920 Β3.5 — TopoBreaklineListSection', () => {
  beforeEach(() => {
    act(() => { clearTopo(); restoreBreaklineDisplay({ visible: true }); });
    getGlobalCommandHistory().clear();
    focusMock.mockClear();
  });

  it('άδεια: πλήθος 0 + οδηγία, καμία γραμμή', () => {
    render(<TopoBreaklineListSection />);
    expect(screen.getByText('topography.breaklines.count(count=0)')).toBeTruthy();
    expect(screen.getByText('topography.breaklines.empty')).toBeTruthy();
  });

  it('μία γραμμή ανά ασυνέχεια, #n του QA, πηγή z σε λέξη', () => {
    seedTwo();
    render(<TopoBreaklineListSection />);
    expect(screen.getByText('topography.breaklines.count(count=2)')).toBeTruthy();
    expect(rowButtons()).toHaveLength(2);
    expect(screen.getByText(/source=topography\.breaklines\.source\.surface/)).toBeTruthy();
  });

  it('κλικ = εστίαση στη γραμμή (store) + Zoom To με ΟΛΕΣ τις κορυφές και το περιθώριο γραμμής', () => {
    seedTwo();
    render(<TopoBreaklineListSection />);
    fireEvent.click(rowButtons()[0]!);
    const [first] = getTopoBreaklines('existing');
    expect(getBreaklineDisplayState().focusedId).toBe(first?.id);
    expect(focusMock).toHaveBeenCalledWith(first?.vertices, TOPO_REVIEW_FOCUS_PAD_MM.line, expect.any(Function), false);
    fireEvent.click(rowButtons()[1]!);
    expect(focusMock.mock.calls[1]?.[3]).toBe(true); // δεύτερο άλμα: η κλίμακα του μηχανικού μένει
  });

  it('Αφαίρεση = η ΜΙΑ αναιρέσιμη εντολή: φεύγει, και το Ctrl+Z την επαναφέρει', () => {
    seedTwo();
    render(<TopoBreaklineListSection />);
    const [removeFirst] = screen.getAllByRole('button', { name: /topography\.breaklines\.remove/ });
    fireEvent.click(removeFirst!);
    expect(getTopoBreaklines('existing')).toHaveLength(1);
    act(() => { getGlobalCommandHistory().undo(); });
    expect(getTopoBreaklines('existing')).toHaveLength(2);
  });

  it('το μάτι γράφει τον ΙΔΙΟ store με το ribbon (και λέει ότι η επιφάνεια κόβεται ακόμα)', () => {
    seedTwo();
    render(<TopoBreaklineListSection />);
    fireEvent.click(screen.getByRole('button', { name: 'topography.breaklines.hide' }));
    expect(getBreaklineDisplayState().visible).toBe(false);
    expect(screen.getByText('topography.breaklines.hiddenNote')).toBeTruthy();
  });

  it('κλείσιμο του πάνελ ⇒ καμία γραμμή δεν μένει φωτισμένη στον καμβά', () => {
    seedTwo();
    const { unmount } = render(<TopoBreaklineListSection />);
    fireEvent.click(rowButtons()[0]!);
    expect(getBreaklineDisplayState().focusedId).not.toBeNull();
    unmount();
    expect(getBreaklineDisplayState().focusedId).toBeNull();
  });
});
