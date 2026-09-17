/** ADR-835 §21 — η επιλογή του επισκέπτη: ποτέ αναχώρηση που η μηχανή θα απέρριπτε. */

import { publicNightsOf, type StayPublicNight } from '@/lib/stay/stay-nights-view';
import {
  isSelectableMeaning,
  NO_STAY_SELECTION,
  nextStaySelection,
  stayDayMeaning,
} from '@/lib/stay/stay-public-selection';

import { bookingEntry, calendarOf, listingOf, rulesInput } from './stay-rules-fixtures';

const LISTING = listingOf({ minNights: 2, maxGuests: 4, nextAvailableFrom: null });
const CALENDAR = calendarOf(
  [bookingEntry('stay_a', '2026-09-10', '2026-09-14')],
  rulesInput({}, { '2026-09-20': { closedToArrival: true } }),
);

function nights(): readonly StayPublicNight[] {
  const view = publicNightsOf(LISTING, CALENDAR, null, '2026-09-01', '2026-10-01');
  if (view.kind !== 'declared') throw new Error('δηλωμένο');
  return view.nights;
}

describe('nextStaySelection', () => {
  it('άφιξη → αναχώρηση που χωράει ⇒ εύρος', () => {
    const first = nextStaySelection(NO_STAY_SELECTION, '2026-09-05', nights());
    expect(first).toEqual({ kind: 'check-in', checkIn: '2026-09-05' });
    expect(nextStaySelection(first, '2026-09-08', nights())).toEqual({ kind: 'range', checkIn: '2026-09-05', checkOut: '2026-09-08' });
  });

  it('🔴 αναχώρηση κάτω από τις ελάχιστες ή πάνω από κράτηση ΔΕΝ ολοκληρώνει εύρος', () => {
    const first = nextStaySelection(NO_STAY_SELECTION, '2026-09-05', nights());
    // 1 νύχτα < ελάχιστο 2 ⇒ ξεκινά νέα άφιξη στις 06 (επιτρεπτή), όχι εύρος.
    expect(nextStaySelection(first, '2026-09-06', nights())).toEqual({ kind: 'check-in', checkIn: '2026-09-06' });
    // πάνω από την κράτηση 10–14 ⇒ η 15 δεν είναι αναχώρηση για άφιξη 05.
    expect(nextStaySelection(first, '2026-09-15', nights()).kind).not.toBe('range');
  });

  it('κλικ σε μέρα που δεν δέχεται άφιξη χωρίς επιλογή ⇒ καμία αλλαγή', () => {
    expect(nextStaySelection(NO_STAY_SELECTION, '2026-09-20', nights())).toBe(NO_STAY_SELECTION);
  });
});

describe('stayDayMeaning — ονομασμένη εξήγηση', () => {
  it('«μόνο αναχώρηση» την πρώτη κλειστή νύχτα της κράτησης· «δεν ξεκινά διαμονή» στο CTA', () => {
    expect(stayDayMeaning('2026-09-10', nights(), NO_STAY_SELECTION)).toBe('check-out-only');
    expect(stayDayMeaning('2026-09-11', nights(), NO_STAY_SELECTION)).toBe('closed');
    expect(stayDayMeaning('2026-09-20', nights(), NO_STAY_SELECTION)).toBe('no-arrival');
    expect(stayDayMeaning('2026-09-05', nights(), NO_STAY_SELECTION)).toBe('check-in');
  });

  it('με άφιξη: οι επιτρεπτές αναχωρήσεις φαίνονται ως τέτοιες, οι νύχτες του εύρους ως «μέσα»', () => {
    const checkIn = { kind: 'check-in', checkIn: '2026-09-05' } as const;
    expect(stayDayMeaning('2026-09-07', nights(), checkIn)).toBe('check-out');
    expect(isSelectableMeaning(stayDayMeaning('2026-09-06', nights(), checkIn))).toBe(true);
    const range = { kind: 'range', checkIn: '2026-09-05', checkOut: '2026-09-08' } as const;
    expect(stayDayMeaning('2026-09-06', nights(), range)).toBe('in-stay');
    expect(stayDayMeaning('2026-09-08', nights(), range)).toBe('selected-check-out');
  });
});
