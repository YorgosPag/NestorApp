/** ADR-835 §20 — ο μήνας του ημερολογίου: πλέγμα, νύχτες, νόημα επιλογής. */

import {
  addMonthsToMonthKey,
  monthGrid,
  monthWindow,
  nightStateOf,
  selectionMeaning,
  selectionOf,
} from '@/lib/stay/stay-calendar-month';
import type { StayCalendarEntryView } from '@/lib/stay/stay-calendar-view';

const BLOCK: StayCalendarEntryView = {
  kind: 'block', id: 'sblk_1', from: '2027-10-10', to: '2027-10-14', source: 'owner', note: null,
};
const BOOKING: StayCalendarEntryView = {
  kind: 'booking', id: 'stay_1', from: '2027-10-14', to: '2027-10-18', guests: 2,
  guestLabel: 'Μαρία', channel: 'direct', lifecycle: 'confirmed', occupies: true,
};
const CANCELLED: StayCalendarEntryView = { ...BOOKING, id: 'stay_2', lifecycle: 'cancelled', occupies: false };

describe('μήνες', () => {
  it('μετατόπιση πάνω από αλλαγή έτους, και προς τα πίσω', () => {
    expect(addMonthsToMonthKey('2027-12', 1)).toBe('2028-01');
    expect(addMonthsToMonthKey('2027-01', -1)).toBe('2026-12');
    expect(monthWindow('2027-12')).toEqual({ from: '2027-12-01', to: '2028-01-01' });
  });

  it('πλέγμα Δευτέρα→Κυριακή: 1/10/2027 είναι Παρασκευή', () => {
    const weeks = monthGrid('2027-10');
    expect(weeks[0]).toEqual([null, null, null, null, '2027-10-01', '2027-10-02', '2027-10-03']);
    expect(weeks.flat().filter((cell) => cell !== null)).toHaveLength(31);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });
});

describe('νύχτες', () => {
  it('ημι-ανοιχτό: η 14η ανήκει στην κράτηση, όχι στο block', () => {
    const entries = [BLOCK, BOOKING];
    expect(nightStateOf('2027-10-13', entries)).toMatchObject({ kind: 'blocked' });
    expect(nightStateOf('2027-10-14', entries)).toMatchObject({ kind: 'booked' });
    expect(nightStateOf('2027-10-18', entries)).toEqual({ kind: 'free' });
  });

  it('ακυρωμένη κράτηση αφήνει τη νύχτα ελεύθερη — το `occupies` ήρθε από τον διακομιστή', () => {
    expect(nightStateOf('2027-10-15', [CANCELLED])).toEqual({ kind: 'free' });
  });
});

describe('επιλογή', () => {
  it('κλικ 13 → 10 (ανάποδα) ⇒ νύχτες 10–13 = [10, 14), 4 νύχτες', () => {
    expect(selectionOf('2027-10-13', '2027-10-10')).toEqual({ from: '2027-10-10', to: '2027-10-14', nights: 4 });
  });

  it('νόημα: ελεύθερη · μία εγγραφή · ανάμικτη', () => {
    const entries = [BLOCK, BOOKING];
    const free = selectionOf('2027-10-20', '2027-10-22');
    const inside = selectionOf('2027-10-11', '2027-10-12');
    const across = selectionOf('2027-10-12', '2027-10-15');
    const partial = selectionOf('2027-10-08', '2027-10-11');
    expect(free && selectionMeaning(free, entries)).toEqual({ kind: 'free' });
    expect(inside && selectionMeaning(inside, entries)).toEqual({ kind: 'entry', entry: BLOCK });
    expect(across && selectionMeaning(across, entries)).toEqual({ kind: 'mixed' });
    expect(partial && selectionMeaning(partial, entries)).toEqual({ kind: 'mixed' });
  });
});
