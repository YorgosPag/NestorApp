/**
 * ADR-637 Phase 4-B — Rest Landings section: add / remove / length+depth edits.
 *
 * Guards: (1) unsupported kind (no geometry consumer) shows a hint, no Add
 * button, no table; (2) supported kind + no landings shows the empty state +
 * Add button; (3) Add dispatches an appended `restLandings` patch with a fresh
 * `stln_N` id; (4) a persisted row shows a remove button that dispatches the
 * filtered array; (5) unchecking "auto" on length dispatches the stair width
 * as the numeric value; (6) typing a numeric length dispatches that value.
 */

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { StairRestLandingsSection } from '../StairRestLandingsSection';
import type { StairEntity } from '../../../../types/entities';
import type { StairRestLanding } from '../../../../bim/types/stair-types';

function makeStair(
  kind: string,
  restLandings: readonly StairRestLanding[] = [],
  width = 1000,
): StairEntity {
  return {
    id: 'stair_1',
    type: 'stair',
    params: { width, restLandings, variant: { kind } },
  } as unknown as StairEntity;
}

describe('StairRestLandingsSection — ADR-637 Phase 4-B', () => {
  it('shows the unsupported hint and no Add button for a kind without a consumer', () => {
    // `winder` + `triangular-outline` are the only kinds whose geometry generator
    // still ignores `restLandings` (l-shape/u-shape/gamma gained support in Φ2b,
    // triangular-fan in Φ3/Φ4-C). Use `winder` as the genuinely-unsupported example.
    render(<StairRestLandingsSection stair={makeStair('winder')} dispatchPatch={jest.fn()} />);
    expect(
      screen.getByText('stairAdvancedPanel.sections.restLandings.unsupportedHint'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('stairAdvancedPanel.sections.restLandings.addLanding'),
    ).toBeNull();
  });

  it('shows the empty state and an Add button for a supported kind with no landings', () => {
    render(<StairRestLandingsSection stair={makeStair('straight')} dispatchPatch={jest.fn()} />);
    expect(
      screen.getByText('stairAdvancedPanel.sections.restLandings.empty'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('stairAdvancedPanel.sections.restLandings.addLanding'),
    ).toBeInTheDocument();
  });

  it('Add dispatches an appended landing with a fresh stln_N id', () => {
    const dispatchPatch = jest.fn();
    const stair = makeStair('straight');
    render(<StairRestLandingsSection stair={stair} dispatchPatch={dispatchPatch} />);
    fireEvent.click(screen.getByText('stairAdvancedPanel.sections.restLandings.addLanding'));
    expect(dispatchPatch).toHaveBeenCalledWith(stair, {
      restLandings: [{ id: 'stln_1', at: 0.5, length: 'auto' }],
    });
  });

  it('a persisted row remove button dispatches the filtered array', () => {
    const dispatchPatch = jest.fn();
    const stair = makeStair('multi-flight', [{ id: 'stln_1', at: 0.5, length: 'auto' }]);
    render(<StairRestLandingsSection stair={stair} dispatchPatch={dispatchPatch} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'stairAdvancedPanel.sections.restLandings.removeOverride' }),
    );
    expect(dispatchPatch).toHaveBeenCalledWith(stair, { restLandings: [] });
  });

  it('unchecking "auto" on length dispatches the stair width', () => {
    const dispatchPatch = jest.fn();
    const stair = makeStair('v-shape', [{ id: 'stln_1', at: 0.5, length: 'auto' }], 1100);
    render(<StairRestLandingsSection stair={stair} dispatchPatch={dispatchPatch} />);
    const row = screen.getByRole('row', {
      name: 'stairAdvancedPanel.sections.restLandings.rowAriaLabel',
    });
    const lengthCheckbox = within(row).getAllByRole('checkbox')[0];
    fireEvent.click(lengthCheckbox);
    expect(dispatchPatch).toHaveBeenCalledWith(stair, {
      restLandings: [{ id: 'stln_1', at: 0.5, length: 1100 }],
    });
  });

  it('typing a numeric depth dispatches that value', () => {
    const dispatchPatch = jest.fn();
    const stair = makeStair('straight', [{ id: 'stln_1', at: 0.5, length: 'auto' }]);
    render(<StairRestLandingsSection stair={stair} dispatchPatch={dispatchPatch} />);
    // Uncheck depth "auto" first so the numeric input is enabled.
    const row = screen.getByRole('row', {
      name: 'stairAdvancedPanel.sections.restLandings.rowAriaLabel',
    });
    const depthCheckbox = within(row).getAllByRole('checkbox')[1];
    fireEvent.click(depthCheckbox);
    const depthInput = within(row).getAllByRole('spinbutton')[1];
    fireEvent.change(depthInput, { target: { value: '900' } });
    expect(dispatchPatch).toHaveBeenLastCalledWith(stair, {
      restLandings: [{ id: 'stln_1', at: 0.5, length: 'auto', depth: 900 }],
    });
  });
});
