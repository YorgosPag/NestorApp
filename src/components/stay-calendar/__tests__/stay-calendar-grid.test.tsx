/**
 * ADR-835 §20 — το πλέγμα νυχτών: κάθε κατάσταση ΛΕΓΕΤΑΙ (όχι μόνο χρωματίζεται), ένα
 * κελί στη σειρά Tab, και το πληκτρολόγιο κινεί/επεκτείνει την επιλογή.
 */

import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { StayCalendarGrid } from '@/components/stay-calendar/StayCalendarGrid';
import type { StayCalendarEntryView } from '@/lib/stay/stay-calendar-view';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

const ENTRIES: readonly StayCalendarEntryView[] = [
  { kind: 'block', id: 'sblk_1', from: '2027-10-10', to: '2027-10-12', source: 'owner', note: null },
  { kind: 'block', id: 'sblk_2', from: '2027-10-20', to: '2027-10-21', source: 'external', note: null },
  {
    kind: 'booking', id: 'stay_1', from: '2027-10-14', to: '2027-10-16', guests: 2,
    guestLabel: 'Μαρία', channel: 'direct', lifecycle: 'confirmed', occupies: true,
  },
];

function renderGrid(overrides: Partial<React.ComponentProps<typeof StayCalendarGrid>> = {}) {
  const onPick = jest.fn();
  const onFocusDay = jest.fn();
  render(
    <StayCalendarGrid
      monthKey="2027-10" entries={ENTRIES} selection={null} focusDay="2027-10-05"
      onFocusDay={onFocusDay} onPick={onPick} {...overrides}
    />,
  );
  return { onPick, onFocusDay };
}

describe('StayCalendarGrid', () => {
  it('31 νύχτες, και κάθε κατάσταση έχει ΔΙΚΗ της ετικέτα', () => {
    renderGrid();
    const cells = screen.getAllByRole('button');
    expect(cells).toHaveLength(31);
    const labels = cells.map((cell) => cell.getAttribute('aria-label'));
    expect(labels[9]).toBe('property-market:offer.stayCalendar.cell.blocked');
    expect(labels[13]).toBe('property-market:offer.stayCalendar.cell.booked');
    expect(labels[19]).toBe('property-market:offer.stayCalendar.cell.external');
    expect(labels[0]).toBe('property-market:offer.stayCalendar.cell.free');
  });

  it('ΕΝΑ κελί στη σειρά Tab — και όταν η εστίαση είναι σε άλλο μήνα, η 1η', () => {
    renderGrid({ focusDay: '2027-09-30' });
    const tabbable = screen.getAllByRole('button').filter((cell) => cell.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveTextContent('1');
  });

  it('βέλος = μετακίνηση εστίασης· Shift+βέλος = επέκταση επιλογής', () => {
    const { onPick, onFocusDay } = renderGrid();
    const fifth = screen.getAllByRole('button')[4];
    fireEvent.keyDown(fifth, { key: 'ArrowDown' });
    expect(onFocusDay).toHaveBeenLastCalledWith('2027-10-12');
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.keyDown(fifth, { key: 'ArrowRight', shiftKey: true });
    expect(onPick).toHaveBeenLastCalledWith('2027-10-06', true);
  });

  it('η επιλογή σημειώνεται με aria-selected, όχι μόνο με περίγραμμα', () => {
    renderGrid({ selection: { from: '2027-10-01', to: '2027-10-03', nights: 2 } });
    const selected = screen.getAllByRole('gridcell').filter((cell) => cell.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(2);
  });
});
