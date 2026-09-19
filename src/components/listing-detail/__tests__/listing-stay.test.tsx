/**
 * ADR-835 §21 — η διαμονή στη σελίδα της αγγελίας: κάθε μέρα ΛΕΓΕΤΑΙ, ό,τι δεν επιλέγεται
 * είναι `aria-disabled` αλλά εξηγείται, και η απάντηση φέρνει διέξοδο αντί για αδιέξοδο.
 */

import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { ListingStayAnswer } from '@/components/listing-detail/ListingStayAnswer';
import { ListingStayCalendar } from '@/components/listing-detail/ListingStayCalendar';
import type { StayPublicNight } from '@/lib/stay/stay-nights-view';
import { NO_STAY_SELECTION } from '@/lib/stay/stay-public-selection';
import { isMyPendingNight } from '@/lib/stay/stay-guest-request-view';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

function night(date: string, patch: Partial<StayPublicNight> = {}): StayPublicNight {
  return { date, state: 'free', checkInAllowed: true, checkOutAllowed: true, minNights: null, maxNights: null, ...patch };
}

const NIGHTS: readonly StayPublicNight[] = Array.from({ length: 61 }, (_, i) => {
  const date = new Date(Date.UTC(2027, 9, 1 + i)).toISOString().slice(0, 10);
  if (date === '2027-10-10') return night(date, { state: 'closed', checkInAllowed: false, checkOutAllowed: true });
  if (date === '2027-10-11') return night(date, { state: 'closed', checkInAllowed: false, checkOutAllowed: false });
  return night(date);
});

describe('ListingStayCalendar', () => {
  it('«μόνο αναχώρηση» και «μη διαθέσιμη» ΛΕΓΟΝΤΑΙ· δεν επιλέγονται αλλά δεν σιωπούν', () => {
    const onPick = jest.fn();
    render(<ListingStayCalendar monthKey="2027-10" nights={NIGHTS} selection={NO_STAY_SELECTION} onShiftMonth={jest.fn()} onPick={onPick} isMine={() => false} />);
    const checkoutOnly = screen.getAllByRole('button', { name: /check-out-only/ })[0];
    const closed = screen.getAllByRole('button', { name: /cell\.closed/ })[0];
    expect(checkoutOnly).toHaveAttribute('aria-disabled', 'true');
    expect(closed).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(closed);
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: /cell\.check-in/ })[0]);
    expect(onPick).toHaveBeenCalledWith('2027-10-01');
  });

  it('🔴 ADR-835 §23.12 Ε3 — η ΔΙΚΗ ΜΟΥ αναμονή λέγεται «το αίτημά σας»· η ξένη «για άλλον επισκέπτη»', () => {
    const held = { state: 'held', heldUntil: '2027-09-01T10:00:00.000Z', checkInAllowed: false, checkOutAllowed: false } as const;
    const nights = NIGHTS.map((n) => (n.date >= '2027-10-20' && n.date <= '2027-10-22' ? { ...n, ...held } : n));
    const mine = [{ id: 'stay_1', checkIn: '2027-10-20', checkOut: '2027-10-22', guests: 1, totalMinor: null, lifecycle: 'requested', holdExpiresAt: held.heldUntil, pending: true }] as const;
    render(
      <ListingStayCalendar monthKey="2027-10" nights={nights} selection={NO_STAY_SELECTION} onShiftMonth={jest.fn()} onPick={jest.fn()}
        isMine={(day) => isMyPendingNight(mine, day)} />,
    );
    // 20 και 21 = οι νύχτες του αιτήματός μου (ημι-ανοιχτό: η 22 ΔΕΝ είναι δική μου).
    expect(screen.getAllByRole('button', { name: /cell\.heldMine/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /cell\.held(?!Mine)/ })).toHaveLength(1);
  });
});

describe('isMyPendingNight — ADR-835 §23.12 Ε3', () => {
  const request = { id: 's', checkIn: '2027-10-20', checkOut: '2027-10-22', guests: 1, totalMinor: null, lifecycle: 'requested', holdExpiresAt: null } as const;
  it('ημι-ανοιχτό [άφιξη, αναχώρηση) — η μέρα αναχώρησης δεν είναι «δική μου» νύχτα', () => {
    expect(['2027-10-19', '2027-10-20', '2027-10-21', '2027-10-22'].map((d) => isMyPendingNight([{ ...request, pending: true }], d)))
      .toEqual([false, true, true, false]);
  });
  it('🔴 ληγμένο ή απαντημένο (`pending: false`) ⇒ ΠΟΤΕ δικό μου — αλλιώς θα έκρυβε νύχτες που κρατά άλλος', () => {
    expect(isMyPendingNight([{ ...request, pending: false }], '2027-10-20')).toBe(false);
  });
});

describe('ListingStayAnswer', () => {
  it('🏆 κρατημένο ⇒ «ελεύθερο ξανά από» + τα κομμάτια που χωράνε, όχι σκέτο «μη διαθέσιμο»', () => {
    render(
      <ListingStayAnswer
        listingId="ownp_a"
        state={{
          kind: 'loaded',
          answers: {
            ownp_a: {
              answer: { kind: 'occupied', nextFreeFrom: '2027-10-14', freeRuns: [{ from: '2027-10-05', to: '2027-10-07', nights: 2 }] },
              quote: null,
            },
          },
        }}
      />,
    );
    expect(screen.getByText('short-stay:answer.occupied')).toBeInTheDocument();
    expect(screen.getByText('short-stay:answer.nextFreeFrom')).toBeInTheDocument();
    expect(screen.getByText('short-stay:answer.freeRuns')).toBeInTheDocument();
  });

  it('🏆 ADR-777 §8.60.21.7 — ανάλυση: νύχτες ΚΑΙ γραμμή κατοικιδίου με τον τρόπο της (όχι σκέτο «Pet fee»)', () => {
    render(
      <ListingStayAnswer
        listingId="ownp_a"
        state={{
          kind: 'loaded',
          answers: {
            ownp_a: {
              answer: { kind: 'free' },
              quote: {
                kind: 'priced',
                nights: [{ date: '2027-10-05', amountMinor: 8000, source: 'base' }],
                nightsMinor: 8000,
                fees: [{ kind: 'pet', basis: 'petNight', unitMinor: 1000, units: 2, pets: 2, amountMinor: 2000 }],
                totalMinor: 10000,
              },
              hold: null,
            },
          },
        }}
      />,
    );
    expect(screen.getByText('short-stay:quote.total')).toBeInTheDocument();
    expect(screen.getByText('short-stay:quote.nights')).toBeInTheDocument();
    expect(screen.getByText('short-stay:quote.fee.pet.petNight')).toBeInTheDocument();
  });

  it('🔴 χρέωση που δεν διαβάζεται ⇒ ονομάζεται, ποτέ σύνολο χωρίς αυτήν', () => {
    render(
      <ListingStayAnswer
        listingId="ownp_a"
        state={{
          kind: 'loaded',
          answers: { ownp_a: { answer: { kind: 'free' }, quote: { kind: 'unpriced', missing: [], missingFees: ['pet'] }, hold: null } },
        }}
      />,
    );
    expect(screen.getByText('short-stay:quote.unpricedFee')).toBeInTheDocument();
    expect(screen.queryByText('short-stay:quote.total')).not.toBeInTheDocument();
  });

  it('🔴 αποτυχία ⇒ δηλωμένη αποτυχία, ποτέ «ελεύθερο»', () => {
    render(<ListingStayAnswer listingId="ownp_a" state={{ kind: 'failed' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('short-stay:answer.failed');
  });
});
