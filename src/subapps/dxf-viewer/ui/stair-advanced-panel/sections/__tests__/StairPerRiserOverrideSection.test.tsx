/**
 * ADR-358 Q19 Φ7 — Per-riser override section: click-into riser + material writer.
 *
 * Guards: (1) 0-based key ↔ 1-based display; (2) clicking-into a RISER of this stair
 * opens a transient active row (no − button); (3) editing dispatches a 0-based
 * `perRiserOverrides` patch; (4) a persisted row shows − remove; (5) tread / other-
 * stair sub-selections are ignored (riser table reacts only to `part:'riser'`).
 */

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { StairPerRiserOverrideSection } from '../StairPerRiserOverrideSection';
import { useStairSubElementSelectionStore } from '../../../../bim/stairs/stair-sub-element-selection-store';
import type { StairEntity } from '../../../../types/entities';
import type { StairPerRiserOverride } from '../../../../bim/types/stair-types';

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  act(() => useStairSubElementSelectionStore.getState().clear());
});

function makeStair(perRiserOverrides: Record<number, StairPerRiserOverride> = {}): StairEntity {
  return {
    id: 'stair_1',
    type: 'stair',
    params: { stepCount: 5, perRiserOverrides },
    geometry: { risers: [{}, {}, {}, {}, {}] },
  } as unknown as StairEntity;
}

function activeRow(): HTMLElement {
  const row = document.querySelector('tr[aria-current="true"]');
  if (!row) throw new Error('no active row');
  return row as HTMLElement;
}

describe('StairPerRiserOverrideSection — Q19 Φ7', () => {
  it('displays 1-based number for a 0-based override key', () => {
    render(<StairPerRiserOverrideSection stair={makeStair({ 0: { material: 'oak' } })} dispatchPatch={jest.fn()} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('click-into a riser opens a transient active row (display +1, no − button)', () => {
    render(<StairPerRiserOverrideSection stair={makeStair()} dispatchPatch={jest.fn()} />);
    act(() =>
      useStairSubElementSelectionStore.getState().selectSub({ stairId: 'stair_1', part: 'riser', index: 2 }),
    );
    const row = activeRow();
    expect(within(row).getByText('3')).toBeInTheDocument();
    expect(within(row).queryByRole('button')).toBeNull();
  });

  it('editing the transient active row dispatches a 0-based material patch', () => {
    const dispatchPatch = jest.fn();
    const stair = makeStair();
    render(<StairPerRiserOverrideSection stair={stair} dispatchPatch={dispatchPatch} />);
    act(() =>
      useStairSubElementSelectionStore.getState().selectSub({ stairId: 'stair_1', part: 'riser', index: 2 }),
    );
    fireEvent.change(within(activeRow()).getByRole('combobox'), { target: { value: 'oak' } });
    expect(dispatchPatch).toHaveBeenCalledWith(stair, { perRiserOverrides: { 2: { material: 'oak' } } });
  });

  it('a persisted override row shows a − remove button', () => {
    const dispatchPatch = jest.fn();
    render(<StairPerRiserOverrideSection stair={makeStair({ 1: { material: 'steel' } })} dispatchPatch={dispatchPatch} />);
    fireEvent.click(screen.getByRole('button', { name: 'stairAdvancedPanel.sections.perRiser.removeOverride' }));
    expect(dispatchPatch).toHaveBeenCalledWith(expect.anything(), { perRiserOverrides: {} });
  });

  it('ignores a TREAD sub-selection (riser table reacts only to part:riser)', () => {
    render(<StairPerRiserOverrideSection stair={makeStair()} dispatchPatch={jest.fn()} />);
    act(() =>
      useStairSubElementSelectionStore.getState().selectSub({ stairId: 'stair_1', part: 'tread', index: 2 }),
    );
    expect(document.querySelector('tr[aria-current="true"]')).toBeNull();
    expect(screen.getByText('stairAdvancedPanel.sections.perRiser.empty')).toBeInTheDocument();
  });

  it('ignores a sub-selection that targets a different stair', () => {
    render(<StairPerRiserOverrideSection stair={makeStair()} dispatchPatch={jest.fn()} />);
    act(() =>
      useStairSubElementSelectionStore.getState().selectSub({ stairId: 'other_stair', part: 'riser', index: 0 }),
    );
    expect(document.querySelector('tr[aria-current="true"]')).toBeNull();
  });

  it('the + button picks the first free 0-based index', () => {
    const dispatchPatch = jest.fn();
    render(<StairPerRiserOverrideSection stair={makeStair({ 0: {} })} dispatchPatch={dispatchPatch} />);
    fireEvent.click(screen.getByText('stairAdvancedPanel.sections.perRiser.addOverride'));
    expect(dispatchPatch).toHaveBeenCalledWith(expect.anything(), { perRiserOverrides: { 0: {}, 1: {} } });
  });
});
