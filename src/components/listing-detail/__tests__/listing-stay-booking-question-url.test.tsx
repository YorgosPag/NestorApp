/**
 * ADR-777 §8.60.21.7 — **η ερώτηση της σελίδας είναι η ερώτηση της διεύθυνσης**: νύχτες και άτομα,
 * όπως τα κατοικίδια.
 *
 * 🔴 Το εύρημα (μετρημένο 2026-09-22): η αναζήτηση είχε `?in&out&guests=2`. Η σελίδα άνοιγε με άδειο
 * ημερολόγιο, ρωτούσε τον διακομιστή με `guests: null`, και η φόρμα έστελνε σιωπηλά `guests=1`. Ο
 * γραφέας όμως κρίνει με τα άτομα που στάλθηκαν, άρα **δύο διαφορετικές ερωτήσεις**.
 *
 * Οι ισχυρισμοί κοιτούν (α) **τι ρωτιέται** ο διακομιστής (`useStayAnswers`), (β) **τι παίρνει** η φόρμα
 * αιτήματος, και (γ) το **`window.location`**. Οι hooks δικτύου και τα παιδιά-οθόνες απομονώνονται.
 */

import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ListingStayBooking from '@/components/listing-detail/ListingStayBooking';
import type { StayQuery } from '@/lib/stay/stay-availability-vocabulary';
import type { StayPublicNight } from '@/lib/stay/stay-nights-view';
import type { PublicListing } from '@/types/public-listing';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const stable = jest
    .requireActual<typeof import('@/test-utils/i18n-mock')>('@/test-utils/i18n-mock')
    .keyEchoTranslation();
  return { useTranslation: () => stable };
});

/** Νύχτες 10–14/10 ανοιχτές — αρκετές για να κρίνει το υπάρχον `nextStaySelection` ένα κλικ. */
function mockNight(date: string): StayPublicNight {
  return { date, state: 'free', heldUntil: null, checkInAllowed: true, checkOutAllowed: true, minNights: null, maxNights: null };
}
jest.mock('@/hooks/listings/usePublicStayNights', () => {
  const nights = ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'].map(mockNight);
  const loaded = { state: { kind: 'loaded', nights: { kind: 'declared', nights } }, reload: () => undefined };
  return { usePublicStayNights: () => loaded };
});

const mockUseStayAnswers = jest.fn();
jest.mock('@/hooks/listings/useStayAnswers', () => ({
  useStayAnswers: (...args: unknown[]) => mockUseStayAnswers(...args),
}));
jest.mock('@/hooks/listings/useMyStayRequests', () => {
  const mine = { state: { kind: 'idle' } };
  const none: readonly never[] = [];
  return { useMyStayRequests: () => mine, readableStayRequestsOf: () => none };
});
jest.mock('@/auth/hooks/useAuth', () => {
  const anonymous = { user: null };
  return { useAuth: () => anonymous };
});
jest.mock('@/components/listing-detail/ListingStayAnswer', () => ({ ListingStayAnswer: () => null }));

const mockRequestProps = jest.fn();
jest.mock('@/components/listing-detail/ListingStayRequest', () => ({
  ListingStayRequest: (props: unknown) => {
    mockRequestProps(props);
    return null;
  },
}));
jest.mock('@/components/listing-detail/ListingStayCalendar', () => ({
  ListingStayCalendar: ({ monthKey, selection, onPick }: {
    readonly monthKey: string;
    readonly selection: unknown;
    readonly onPick: (day: string) => void;
  }) => (
    <section data-testid="calendar" data-month={monthKey} data-selection={JSON.stringify(selection)}>
      <button type="button" onClick={() => onPick('2026-10-11')}>pick-11</button>
      <button type="button" onClick={() => onPick('2026-10-14')}>pick-14</button>
    </section>
  ),
}));

const IDLE = { kind: 'idle' };
const LISTING = { id: 'ownp_test', stay: { maxGuests: 4 } } as unknown as PublicListing;

function atUrl(search: string): void {
  window.history.replaceState(window.history.state, '', `/listing/ownp_test${search}`);
}

async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

/** Η τελευταία ερώτηση που είδε ο διακομιστής. */
function lastAsked(): StayQuery | null {
  const calls = mockUseStayAnswers.mock.calls;
  return calls[calls.length - 1][1] as StayQuery | null;
}

function lastRequestQuery(): StayQuery | null {
  const calls = mockRequestProps.mock.calls;
  return (calls[calls.length - 1][0] as { query: StayQuery | null }).query;
}

function guestsSelect(): HTMLSelectElement {
  return screen.getByLabelText('short-stay:guests') as HTMLSelectElement;
}

function calendarSelection(): unknown {
  return JSON.parse(screen.getByTestId('calendar').getAttribute('data-selection') ?? 'null');
}

beforeEach(() => {
  mockUseStayAnswers.mockReset().mockReturnValue(IDLE);
  mockRequestProps.mockReset();
});

describe('ADR-777 §8.60.21.7 — η ερώτηση της σελίδας = η ερώτηση της διεύθυνσης', () => {
  it('🔴 `?in&out&guests=2&pets=1` ⇒ ο διακομιστής ρωτιέται ΑΚΡΙΒΩΣ αυτό — όχι `guests: null`', () => {
    atUrl('?in=2026-10-11&out=2026-10-14&guests=2&pets=1');
    render(<ListingStayBooking listing={LISTING} />);
    expect(lastAsked()).toEqual({ checkIn: '2026-10-11', checkOut: '2026-10-14', guests: 2, pets: 1 });
  });

  it('🔴 η φόρμα αιτήματος παίρνει την ΙΔΙΑ ερώτηση — τα άτομα ταξιδεύουν ως το αίτημα', () => {
    atUrl('?in=2026-10-11&out=2026-10-14&guests=2');
    render(<ListingStayBooking listing={LISTING} />);
    expect(lastRequestQuery()).toEqual({ checkIn: '2026-10-11', checkOut: '2026-10-14', guests: 2, pets: null });
  });

  it('το ημερολόγιο ανοίγει στον μήνα της άφιξης, με το εύρος επιλεγμένο', () => {
    atUrl('?in=2026-10-11&out=2026-10-14');
    render(<ListingStayBooking listing={LISTING} />);
    expect(screen.getByTestId('calendar')).toHaveAttribute('data-month', '2026-10');
    expect(calendarSelection()).toEqual({ kind: 'range', checkIn: '2026-10-11', checkOut: '2026-10-14' });
  });

  it('ο επιλογέας ατόμων δείχνει την τιμή της διεύθυνσης· αλλαγή ⇒ η ΔΙΕΥΘΥΝΣΗ και η ΕΡΩΤΗΣΗ την ξέρουν', async () => {
    atUrl('?in=2026-10-11&out=2026-10-14&guests=2');
    render(<ListingStayBooking listing={LISTING} />);
    expect(guestsSelect().value).toBe('2');
    fireEvent.change(guestsSelect(), { target: { value: '3' } });
    await settle();
    expect(new URLSearchParams(window.location.search).get('guests')).toBe('3');
    expect(lastAsked()?.guests).toBe(3);
  });

  it('🔴 «δεν το αποφάσισα» ⇒ το `guests` ΦΕΥΓΕΙ από τη διεύθυνση και η ερώτηση λέει `null`, ποτέ «ένα»', async () => {
    atUrl('?in=2026-10-11&out=2026-10-14&guests=2');
    render(<ListingStayBooking listing={LISTING} />);
    fireEvent.change(guestsSelect(), { target: { value: '' } });
    await settle();
    expect(new URLSearchParams(window.location.search).has('guests')).toBe(false);
    expect(lastAsked()?.guests).toBeNull();
  });

  it('🔴 άτομα ΠΑΝΩ από το μέγιστο ΔΕΝ εξαφανίζονται από τον επιλογέα — το «χωράει;» το κρίνει ο διακομιστής', () => {
    atUrl('?in=2026-10-11&out=2026-10-14&guests=6');
    render(<ListingStayBooking listing={LISTING} />);
    expect(guestsSelect().value).toBe('6');
    expect(lastAsked()?.guests).toBe(6);
  });

  it('🔴 νέα άφιξη ⇒ το παλιό παράθυρο ΦΕΥΓΕΙ από τη διεύθυνση (μισό ζεύγος δεν γράφεται) και καμία ερώτηση', async () => {
    atUrl('?in=2026-10-11&out=2026-10-14&guests=2');
    render(<ListingStayBooking listing={LISTING} />);
    fireEvent.click(screen.getByText('pick-11'));
    await settle();
    const params = new URLSearchParams(window.location.search);
    expect(params.has('in')).toBe(false);
    expect(params.has('out')).toBe(false);
    expect(params.get('guests')).toBe('2');
    expect(calendarSelection()).toEqual({ kind: 'check-in', checkIn: '2026-10-11' });
    expect(lastAsked()).toBeNull();
  });

  it('🔴 άφιξη + αναχώρηση ⇒ το παράθυρο ΓΡΑΦΕΤΑΙ στη διεύθυνση (ανανέωση/κοινοποίηση το κρατούν)', async () => {
    atUrl('?guests=2');
    render(<ListingStayBooking listing={LISTING} />);
    fireEvent.click(screen.getByText('pick-11'));
    await settle();
    fireEvent.click(screen.getByText('pick-14'));
    await settle();
    expect(window.location.search).toBe('?guests=2&in=2026-10-11&out=2026-10-14');
    expect(lastAsked()).toEqual({ checkIn: '2026-10-11', checkOut: '2026-10-14', guests: 2, pets: null });
  });

  it('🔴 καμία πλοήγηση: το ιστορικό ΔΕΝ μεγαλώνει με τις επιλογές', async () => {
    atUrl('?guests=1');
    render(<ListingStayBooking listing={LISTING} />);
    const before = window.history.length;
    fireEvent.change(guestsSelect(), { target: { value: '3' } });
    fireEvent.click(screen.getByText('pick-11'));
    fireEvent.click(screen.getByText('pick-14'));
    await settle();
    expect(window.history.length).toBe(before);
  });
});
