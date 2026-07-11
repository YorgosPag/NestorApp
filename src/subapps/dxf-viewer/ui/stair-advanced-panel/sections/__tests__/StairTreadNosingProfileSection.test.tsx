/**
 * ADR-358 Q19 Φ6 — Nosing Profile picker: reactive click-into + preset writer.
 *
 * Guards: (1) no tread clicked-into → hint only; (2) clicked-into tread shows the
 * picker reflecting the stored profile; (3) picking a preset dispatches a 0-based
 * `customProfile` patch (merge-preserving material/nosing); (4) square clears the
 * profile; (5) a fresh tread left square dispatches nothing (no empty row).
 */

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
  }),
}));

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { StairTreadNosingProfileSection } from '../StairTreadNosingProfileSection';
import { useStairSubElementSelectionStore } from '../../../../bim/stairs/stair-sub-element-selection-store';
import { buildNosingProfile, classifyNosingProfile } from '../../../../bim/geometry/stairs/nosing-profile-presets';
import type { StairEntity } from '../../../../types/entities';
import type { StairPerTreadOverride } from '../../../../bim/types/stair-types';

beforeEach(() => {
  act(() => useStairSubElementSelectionStore.getState().clear());
});

function makeStair(perTreadOverrides: Record<number, StairPerTreadOverride> = {}): StairEntity {
  return {
    id: 'stair_1',
    type: 'stair',
    params: { stepCount: 5, nosing: 10, perTreadOverrides },
  } as unknown as StairEntity;
}

function selectTread(index: number, stairId = 'stair_1'): void {
  act(() =>
    useStairSubElementSelectionStore.getState().selectSub({ stairId, part: 'tread', index }),
  );
}

describe('StairTreadNosingProfileSection — Q19 Φ6', () => {
  it('shows only the hint when no tread is clicked-into', () => {
    render(<StairTreadNosingProfileSection stair={makeStair()} dispatchPatch={jest.fn()} />);
    expect(screen.getByText('stairAdvancedPanel.sections.nosingProfile.hint')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('ignores a riser / other-stair sub-selection (hint stays)', () => {
    render(<StairTreadNosingProfileSection stair={makeStair()} dispatchPatch={jest.fn()} />);
    act(() =>
      useStairSubElementSelectionStore.getState().selectSub({ stairId: 'stair_1', part: 'riser', index: 1 }),
    );
    expect(screen.getByText('stairAdvancedPanel.sections.nosingProfile.hint')).toBeInTheDocument();
    selectTread(0, 'other_stair');
    expect(screen.getByText('stairAdvancedPanel.sections.nosingProfile.hint')).toBeInTheDocument();
  });

  it('clicked-into tread reflects the stored bullnose profile', () => {
    const profile = buildNosingProfile('bullnose', 22)!;
    render(
      <StairTreadNosingProfileSection stair={makeStair({ 2: { customProfile: profile } })} dispatchPatch={jest.fn()} />,
    );
    selectTread(2);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('bullnose');
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('22');
  });

  it('picking a preset dispatches a 0-based patch preserving material', () => {
    const dispatchPatch = jest.fn();
    const stair = makeStair({ 2: { material: 'oak' } });
    render(<StairTreadNosingProfileSection stair={stair} dispatchPatch={dispatchPatch} />);
    selectTread(2);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'chamfer' } });
    expect(dispatchPatch).toHaveBeenCalledTimes(1);
    const patch = dispatchPatch.mock.calls[0][1];
    const override = patch.perTreadOverrides[2];
    expect(override.material).toBe('oak'); // merge-preserved
    expect(classifyNosingProfile(override.customProfile)).toEqual({ kind: 'chamfer', size: 25 });
  });

  it('square clears customProfile but keeps material', () => {
    const dispatchPatch = jest.fn();
    const profile = buildNosingProfile('chamfer', 20)!;
    const stair = makeStair({ 1: { material: 'oak', customProfile: profile } });
    render(<StairTreadNosingProfileSection stair={stair} dispatchPatch={dispatchPatch} />);
    selectTread(1);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'square' } });
    expect(dispatchPatch).toHaveBeenCalledWith(stair, { perTreadOverrides: { 1: { material: 'oak' } } });
    expect(dispatchPatch.mock.calls[0][1].perTreadOverrides[1].customProfile).toBeUndefined();
  });

  it('a fresh tread left square dispatches nothing (no empty row)', () => {
    const dispatchPatch = jest.fn();
    render(<StairTreadNosingProfileSection stair={makeStair()} dispatchPatch={dispatchPatch} />);
    selectTread(3);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'square' } });
    expect(dispatchPatch).not.toHaveBeenCalled();
  });
});
