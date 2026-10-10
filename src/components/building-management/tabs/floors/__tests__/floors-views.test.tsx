/**
 * @tests Οι δύο όψεις των ορόφων — ADR-912 §5.
 *
 * Το αίτημα που φυλάει: **η λίστα (στενός χώρος) δεν χάνει τίποτα σε σχέση με τον πίνακα**. Στα 390px ο πίνακας
 * έκρυβε ολόκληρες τις στήλες «Μονάδες» και «Ενέργειες» — ο άνθρωπος δεν μπορούσε να επεξεργαστεί ούτε να
 * διαγράψει όροφο από κινητό. Κάθε δοκιμή «ισοτιμίας» τρέχει **και στις δύο** όψεις, στα ίδια δεδομένα.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { FloorsCompactList } from '../FloorsCompactList';
import { FloorsTable } from '../FloorsTable';
import type { FloorsTabState } from '../floor-row-model';
import { FIXTURE_BUILDING, FIXTURE_FLOORS, makeFloorsState } from './floors-fixture';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../FloorFloorplanInline', () => ({
  FloorFloorplanInline: ({ floorId }: { floorId: string }) => <div data-testid={`floorplan-${floorId}`} />,
}));

const VIEWS = [
  ['table', FloorsTable],
  ['list', FloorsCompactList],
] as const;

function renderView(View: (typeof VIEWS)[number][1], state: FloorsTabState) {
  return render(<View state={state} building={FIXTURE_BUILDING} />);
}

describe.each(VIEWS)('floors as %s — parity', (_name, View) => {
  it('shows every floor by name', () => {
    renderView(View, makeFloorsState());
    for (const floor of FIXTURE_FLOORS) {
      expect(screen.getByRole('button', { name: floor.name })).toBeInTheDocument();
    }
  });

  it('offers edit and delete on every floor', () => {
    renderView(View, makeFloorsState());
    expect(screen.getAllByRole('button', { name: 'tabs.floors.editFloor' })).toHaveLength(FIXTURE_FLOORS.length);
    expect(screen.getAllByRole('button', { name: 'tabs.floors.deleteFloor' })).toHaveLength(FIXTURE_FLOORS.length);
  });

  it('routes edit and delete to the ONE state owner, with the floor', async () => {
    const state = makeFloorsState();
    const user = userEvent.setup();
    renderView(View, state);
    await user.click(screen.getAllByRole('button', { name: 'tabs.floors.editFloor' })[1]);
    await user.click(screen.getAllByRole('button', { name: 'tabs.floors.deleteFloor' })[1]);
    expect(state.startEdit).toHaveBeenCalledWith(FIXTURE_FLOORS[1]);
    expect(state.handleDelete).toHaveBeenCalledWith(FIXTURE_FLOORS[1]);
  });

  it('shows the DERIVED height, never the stale stored one', () => {
    renderView(View, makeFloorsState());
    expect(screen.getByText('3.00 m', { selector: 'td, dd' })).toBeInTheDocument();
    expect(screen.queryByText('9.99 m')).not.toBeInTheDocument();
  });

  it('shows a storey with no height as an error, not as a number', () => {
    renderView(View, makeFloorsState());
    expect(screen.getByText('tabs.floors.storeyTooLowCell')).toBeInTheDocument();
  });

  it('marks the special level and the floor with no floorplan', () => {
    renderView(View, makeFloorsState());
    expect(screen.getAllByText('tabs.floors.specialLevel')).toHaveLength(1);
    expect(screen.getAllByLabelText('tabs.floors.noFloorplan')).toHaveLength(1);
  });

  it('shows the unit count, 0 when unknown', () => {
    const { container } = renderView(View, makeFloorsState());
    const cells = Array.from(container.querySelectorAll('td, dd')).map((el) => el.textContent);
    expect(cells).toEqual(expect.arrayContaining(['2', '4', '0']));
  });

  it('expands a floor from its name and shows the floorplan panel when expanded', async () => {
    const state = makeFloorsState({ expandedFloorId: 'f-0' });
    const user = userEvent.setup();
    renderView(View, state);
    expect(screen.getByTestId('floorplan-f-0')).toBeInTheDocument();
    expect(screen.queryByTestId('floorplan-f-1')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '1ος Όροφος' }));
    expect(state.toggleFloorExpand).toHaveBeenCalledWith('f-1');
  });

  it('edits in place: explicit fields are writable, the derived height is read-only', async () => {
    const state = makeFloorsState({ editingId: 'f-0' });
    const user = userEvent.setup();
    renderView(View, state);
    const name = screen.getByDisplayValue('Ισόγειο');
    await user.type(name, 'Χ');
    expect(state.handleEditNameChange).toHaveBeenCalled();
    expect(screen.getByLabelText('tabs.floors.derivedHeightHint')).toHaveAttribute('readonly');
    // Η γραμμή σε επεξεργασία δεν προσφέρει «επεξεργασία» ξανά.
    expect(screen.getAllByRole('button', { name: 'tabs.floors.editFloor' })).toHaveLength(FIXTURE_FLOORS.length - 1);
  });

  it('registers each row with the deep-link scroller', () => {
    const state = makeFloorsState();
    renderView(View, state);
    for (const floor of FIXTURE_FLOORS) {
      expect(state.registerFloorRowRef).toHaveBeenCalledWith(floor.id, expect.any(HTMLElement));
    }
  });
});

describe('floors as list — what the narrow view adds', () => {
  it('is a list, not a table: nothing to scroll sideways', () => {
    const { container } = renderView(FloorsCompactList, makeFloorsState());
    expect(container.querySelector('table')).toBeNull();
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(FIXTURE_FLOORS.length);
  });

  it('labels every figure with its term (dl), since there is no column header', () => {
    renderView(FloorsCompactList, makeFloorsState());
    const item = screen.getAllByRole('listitem')[1];
    for (const term of ['number', 'elevation', 'height', 'units']) {
      expect(within(item).getByText(`tabs.floors.${term}`).tagName).toBe('DT');
    }
  });

  it('gives every edit field a VISIBLE label', () => {
    renderView(FloorsCompactList, makeFloorsState({ editingId: 'f-2' }));
    expect(screen.getByLabelText('tabs.floors.name')).toHaveValue('Ισόγειο');
    expect(screen.getByLabelText('tabs.floors.number')).toHaveValue(0);
    expect(screen.getByLabelText('tabs.floors.elevation')).toHaveValue(0);
    expect(screen.getByLabelText('tabs.floors.height')).toHaveValue(3);
  });
});
