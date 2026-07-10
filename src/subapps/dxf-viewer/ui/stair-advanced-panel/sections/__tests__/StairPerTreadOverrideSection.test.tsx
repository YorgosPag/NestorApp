/**
 * ADR-358 Q19 Φ5 — Per-tread override section: 0-based reconcile + click-into active row.
 *
 * Guards: (1) keys are 0-based but DISPLAY is 1-based; (2) clicking-into a tread of THIS
 * stair opens a TRANSIENT active row (highlighted, no − button, not yet dispatched);
 * (3) editing that row dispatches a patch keyed 0-based; (4) risers / other stairs are ignored.
 */

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { StairPerTreadOverrideSection } from '../StairPerTreadOverrideSection';
import { useStairSubElementSelectionStore } from '../../../../bim/stairs/stair-sub-element-selection-store';
import type { StairEntity } from '../../../../types/entities';
import type { StairPerTreadOverride } from '../../../../bim/types/stair-types';

beforeAll(() => {
  // jsdom lacks scrollIntoView; the component optional-chains it, but stub for safety.
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  act(() => useStairSubElementSelectionStore.getState().clear());
});

function makeStair(perTreadOverrides: Record<number, StairPerTreadOverride> = {}): StairEntity {
  return {
    id: 'stair_1',
    type: 'stair',
    params: { stepCount: 5, perTreadOverrides },
  } as unknown as StairEntity;
}

function activeRow(): HTMLElement {
  const row = document.querySelector('tr[aria-current="true"]');
  if (!row) throw new Error('no active row');
  return row as HTMLElement;
}

describe('StairPerTreadOverrideSection — Q19 Φ5', () => {
  it('displays 1-based number for a 0-based override key', () => {
    render(<StairPerTreadOverrideSection stair={makeStair({ 0: { material: 'oak' } })} dispatchPatch={jest.fn()} />);
    // Key 0 → the user sees tread «1».
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('click-into a tread opens a transient active row (display +1, no − button)', () => {
    render(<StairPerTreadOverrideSection stair={makeStair()} dispatchPatch={jest.fn()} />);
    act(() =>
      useStairSubElementSelectionStore.getState().selectSub({ stairId: 'stair_1', part: 'tread', index: 2 }),
    );
    const row = activeRow();
    expect(within(row).getByText('3')).toBeInTheDocument(); // index 2 → «3»
    // Transient (not yet an override) → nothing to remove.
    expect(within(row).queryByRole('button')).toBeNull();
  });

  it('editing the transient active row dispatches a 0-based patch', () => {
    const dispatchPatch = jest.fn();
    const stair = makeStair();
    render(<StairPerTreadOverrideSection stair={stair} dispatchPatch={dispatchPatch} />);
    act(() =>
      useStairSubElementSelectionStore.getState().selectSub({ stairId: 'stair_1', part: 'tread', index: 2 }),
    );
    const nosing = within(activeRow()).getByRole('spinbutton');
    fireEvent.change(nosing, { target: { value: '40' } });
    expect(dispatchPatch).toHaveBeenCalledWith(stair, { perTreadOverrides: { 2: { nosing: 40 } } });
  });

  it('a persisted override row shows a − remove button', () => {
    const dispatchPatch = jest.fn();
    render(<StairPerTreadOverrideSection stair={makeStair({ 1: { material: 'oak' } })} dispatchPatch={dispatchPatch} />);
    const btn = screen.getByRole('button', { name: 'stairAdvancedPanel.sections.perTread.removeOverride' });
    fireEvent.click(btn);
    // omitIndex(0-based key 1) → empties the record.
    expect(dispatchPatch).toHaveBeenCalledWith(expect.anything(), { perTreadOverrides: {} });
  });

  it('ignores a riser sub-selection (no per-riser override model)', () => {
    render(<StairPerTreadOverrideSection stair={makeStair()} dispatchPatch={jest.fn()} />);
    act(() =>
      useStairSubElementSelectionStore.getState().selectSub({ stairId: 'stair_1', part: 'riser', index: 2 }),
    );
    expect(document.querySelector('tr[aria-current="true"]')).toBeNull();
    expect(screen.getByText('stairAdvancedPanel.sections.perTread.empty')).toBeInTheDocument();
  });

  it('ignores a sub-selection that targets a different stair', () => {
    render(<StairPerTreadOverrideSection stair={makeStair()} dispatchPatch={jest.fn()} />);
    act(() =>
      useStairSubElementSelectionStore.getState().selectSub({ stairId: 'other_stair', part: 'tread', index: 0 }),
    );
    expect(document.querySelector('tr[aria-current="true"]')).toBeNull();
  });

  it('the + button picks the first free 0-based index', () => {
    const dispatchPatch = jest.fn();
    render(<StairPerTreadOverrideSection stair={makeStair({ 0: {} })} dispatchPatch={dispatchPatch} />);
    fireEvent.click(screen.getByText('stairAdvancedPanel.sections.perTread.addOverride'));
    // 0 taken → next free is 1 (0-based).
    expect(dispatchPatch).toHaveBeenCalledWith(expect.anything(), { perTreadOverrides: { 0: {}, 1: {} } });
  });
});
