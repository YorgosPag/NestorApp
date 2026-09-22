/**
 * ADR-777 §8.60.21.7 — **τα άτομα του αιτήματος είναι τα άτομα της ερώτησης**, όχι ενός `useState(1)`.
 *
 * 🔴 Το εύρημα (μετρημένο 2026-09-22): η αναζήτηση έλεγε 2 άτομα, η φόρμα ξεκινούσε σιωπηλά από 1, και
 * το αίτημα γραφόταν `guests=1`. Εδώ ρωτάμε **μόνο**: τι εντολή φεύγει, και φεύγει καθόλου χωρίς
 * δηλωμένα άτομα;
 */

import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { ListingStayRequest } from '@/components/listing-detail/ListingStayRequest';
import type { MyStayRequests } from '@/hooks/listings/useMyStayRequests';
import type { StayQuery } from '@/lib/stay/stay-availability-vocabulary';
import type { PublicStayAnswer } from '@/lib/stay/stay-public-request';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const stable = jest
    .requireActual<typeof import('@/test-utils/i18n-mock')>('@/test-utils/i18n-mock')
    .keyEchoTranslation();
  return { useTranslation: () => stable };
});
jest.mock('@/auth/hooks/useAuth', () => {
  const signedIn = { user: { uid: 'uid-seeker' } };
  return { useAuth: () => signedIn };
});
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ children }: { readonly children: React.ReactNode }) => <>{children}</>,
  usePathname: () => '/listing/ownp_test',
}));

const FREE: PublicStayAnswer = {
  answer: { kind: 'free' },
  quote: { kind: 'priced', nights: [], nightsMinor: 30000, fees: [], totalMinor: 30000 },
  hold: { kind: 'held', expiresAt: '2026-10-01T12:00:00.000Z', tier: 'standard', bound: 'tier' },
} as unknown as PublicStayAnswer;

function mine(send: jest.Mock): MyStayRequests {
  return { state: { kind: 'idle' }, busy: false, lastOutcome: null, send } as unknown as MyStayRequests;
}

function renderWith(query: StayQuery, send: jest.Mock): void {
  render(
    <ListingStayRequest
      query={query} answer={FREE} mine={mine(send)}
      onChanged={() => undefined} onPriceChanged={() => undefined}
    />,
  );
}

const submit = (): HTMLElement => screen.getByRole('button', { name: 'short-stay:request.submit' });

describe('ADR-777 §8.60.21.7 — η φόρμα στέλνει τα άτομα ΤΗΣ ΕΡΩΤΗΣΗΣ', () => {
  it('🔴 με `guests: 2` ⇒ η εντολή λέει 2 (όχι το 1 ενός τοπικού state) και ό,τι άλλο ρωτήθηκε', () => {
    const send = jest.fn().mockResolvedValue({ kind: 'ok' });
    renderWith({ checkIn: '2026-10-11', checkOut: '2026-10-14', guests: 2, pets: 1 }, send);
    fireEvent.click(submit());
    expect(send).toHaveBeenCalledWith({
      action: 'request', checkIn: '2026-10-11', checkOut: '2026-10-14', guests: 2, pets: 1,
      expectedTotalMinor: 30000, riskAcknowledged: false,
    });
  });

  it('`pets: null` («δεν δηλώθηκαν») ⇒ ρητό `0` στην εντολή', () => {
    const send = jest.fn().mockResolvedValue({ kind: 'ok' });
    renderWith({ checkIn: '2026-10-11', checkOut: '2026-10-14', guests: 3, pets: null }, send);
    fireEvent.click(submit());
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ guests: 3, pets: 0 }));
  });

  it('🔴 `guests: null` ⇒ ΚΑΝΕΝΑ αίτημα — το κουμπί είναι ανενεργό και λέγεται γιατί', () => {
    const send = jest.fn();
    renderWith({ checkIn: '2026-10-11', checkOut: '2026-10-14', guests: null, pets: null }, send);
    expect(screen.getByText('short-stay:request.guestsNeeded')).toBeInTheDocument();
    expect(submit()).toBeDisabled();
    fireEvent.click(submit());
    expect(send).not.toHaveBeenCalled();
  });
});
