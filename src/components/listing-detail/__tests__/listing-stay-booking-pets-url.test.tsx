/**
 * ADR-777 §8.60.21.7 — **τα κατοικίδια ζουν στη διεύθυνση**, όχι σε React state.
 *
 * 🔴 Το εύρημα (ζωντανή επαλήθευση 2026-09-19): το `?pets=` **έσπερνε** τον επιλογέα και μετά
 * **ξεχνιόταν** (`useState(petsFromSearch)`). Αλλαγή επιλογέα ⇒ η διεύθυνση έμενε στην παλιά τιμή ⇒
 * ανανέωση ή κοινοποίηση συνδέσμου **πετούσε** την επιλογή του ανθρώπου.
 *
 * Οι ισχυρισμοί κοιτούν το **`window.location`** — το ίδιο που βλέπει ο browser, ο σύνδεσμος και η
 * ανανέωση — όχι μια εσωτερική τιμή. Οι hooks δικτύου και τα παιδιά-οθόνες απομονώνονται: εδώ
 * ρωτάμε **μόνο** «ποιος κρατά την απάντηση;».
 */

import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ListingStayBooking from '@/components/listing-detail/ListingStayBooking';
import type { PublicListing } from '@/types/public-listing';

// ⚠️ Mock του hook ΤΟΥ ΕΡΓΟΥ, με ΣΤΑΘΕΡΗ ταυτότητα. Ένα φρέσκο αντικείμενο ανά render (π.χ. mock του
// `react-i18next`) ξανατρέχει το `useEffect` φόρτωσης namespace ⇒ setState ⇒ render ⇒ … — ατέρμονος
// ασύγχρονος βρόχος που μόνο το `await act` περιμένει να «κάτσει» (μετρημένο: timeout 10s).
jest.mock('@/i18n/hooks/useTranslation', () => {
  const stable = jest
    .requireActual<typeof import('@/test-utils/i18n-mock')>('@/test-utils/i18n-mock')
    .keyEchoTranslation();
  return { useTranslation: () => stable };
});

// Σταθερές τιμές, όχι φρέσκα αντικείμενα ανά render — ίδιος λόγος με το mock μετάφρασης.
jest.mock('@/hooks/listings/usePublicStayNights', () => {
  const nights = { state: { kind: 'loaded', nights: { kind: 'declared', nights: [] } }, reload: () => undefined };
  return { usePublicStayNights: () => nights };
});
jest.mock('@/hooks/listings/useStayAnswers', () => {
  const idle = { kind: 'idle' };
  return { useStayAnswers: () => idle };
});
jest.mock('@/hooks/listings/useMyStayRequests', () => {
  const mine = { state: { kind: 'idle' } };
  const none: readonly never[] = [];
  return { useMyStayRequests: () => mine, readableStayRequestsOf: () => none };
});
jest.mock('@/auth/hooks/useAuth', () => {
  const anonymous = { user: null };
  return { useAuth: () => anonymous };
});
jest.mock('@/components/listing-detail/ListingStayCalendar', () => ({ ListingStayCalendar: () => null }));
jest.mock('@/components/listing-detail/ListingStayAnswer', () => ({ ListingStayAnswer: () => null }));
jest.mock('@/components/listing-detail/ListingStayRequest', () => ({ ListingStayRequest: () => null }));

const LISTING = { id: 'ownp_test', stay: { maxGuests: 2 } } as unknown as PublicListing;

/** Η διεύθυνση όπως τη βλέπει ο browser — πριν από κάθε render. */
function atUrl(search: string): void {
  window.history.replaceState(window.history.state, '', `/listing/ownp_test${search}`);
}

function petsSelect(): HTMLSelectElement {
  return screen.getByLabelText('short-stay:pets.filterLabel') as HTMLSelectElement;
}

/** Οι ειδοποιήσεις του `url-query-state` φεύγουν σε microtask — το αφήνουμε να αδειάσει. */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('ADR-777 §8.60.21.7 — ο επιλογέας κατοικιδίων και η διεύθυνση είναι ΕΝΑ', () => {
  it('η διεύθυνση σπέρνει τον επιλογέα', () => {
    atUrl('?pets=2');
    render(<ListingStayBooking listing={LISTING} />);
    expect(petsSelect().value).toBe('2');
  });

  it('🔴 αλλαγή επιλογέα ⇒ Η ΔΙΕΥΘΥΝΣΗ ΤΗΝ ΞΕΡΕΙ (ανανέωση/κοινοποίηση κρατούν την επιλογή)', async () => {
    atUrl('?pets=2');
    render(<ListingStayBooking listing={LISTING} />);
    fireEvent.change(petsSelect(), { target: { value: '3' } });
    await settle();
    expect(new URLSearchParams(window.location.search).get('pets')).toBe('3');
    expect(petsSelect().value).toBe('3');
  });

  it('🔴 «Χωρίς κατοικίδια» ⇒ το `pets` ΦΕΥΓΕΙ από τη διεύθυνση', async () => {
    atUrl('?pets=2');
    render(<ListingStayBooking listing={LISTING} />);
    fireEvent.change(petsSelect(), { target: { value: '' } });
    await settle();
    expect(new URLSearchParams(window.location.search).has('pets')).toBe(false);
    expect(petsSelect().value).toBe('');
  });

  it('🔴 άσχετα κλειδιά της αναζήτησης ΕΠΙΖΟΥΝ — η γραφή είναι μερική', async () => {
    atUrl('?in=2026-10-05&out=2026-10-08&guests=2&pets=2');
    render(<ListingStayBooking listing={LISTING} />);
    fireEvent.change(petsSelect(), { target: { value: '1' } });
    await settle();
    expect(window.location.search).toBe('?in=2026-10-05&out=2026-10-08&guests=2&pets=1');
  });

  it('🔴 η διεύθυνση αλλάζει ΑΠΟ ΕΞΩ (πίσω/μπροστά, άλλο component) ⇒ ο επιλογέας ΑΚΟΛΟΥΘΕΙ', async () => {
    atUrl('?pets=2');
    render(<ListingStayBooking listing={LISTING} />);
    await settle();
    act(() => atUrl('?pets=4'));
    await settle();
    expect(petsSelect().value).toBe('4');
  });

  it('🔴 καμία πλοήγηση: το ιστορικό ΔΕΝ μεγαλώνει με τα κλικ (το «πίσω» γυρίζει στην αναζήτηση)', async () => {
    atUrl('?pets=1');
    render(<ListingStayBooking listing={LISTING} />);
    const before = window.history.length;
    for (const value of ['2', '3', '4', '']) {
      fireEvent.change(petsSelect(), { target: { value } });
      await settle();
    }
    expect(window.history.length).toBe(before);
  });
});

/** ADR-777 §8.60.21.7 — ζωντανά 2026-09-22: «έως 2 κατοικίδια» πρόσφερε 1–5 (τα άτομα σταματούσαν στο 2). */
describe('🔴 ο επιλογέας κατοικιδίων ζητά το όριο ΤΗΣ ΑΓΓΕΛΙΑΣ', () => {
  const optionsOf = (select: HTMLSelectElement): readonly string[] => [...select.options].map((option) => option.value);
  const TWO_PETS = {
    id: 'ownp_test',
    stay: { maxGuests: 2, pets: { accepts: 'yes', maxPets: 2, fee: null } },
  } as unknown as PublicListing;

  it('«έως 2 κατοικίδια» ⇒ επιλογές 1–2', () => {
    atUrl('');
    render(<ListingStayBooking listing={TWO_PETS} />);
    expect(optionsOf(petsSelect())).toEqual(['', '1', '2']);
  });

  it('`?pets=3` πάνω από το όριο ⇒ η ερώτηση ΦΑΙΝΕΤΑΙ (όπως τα άτομα) — την απάντηση τη δίνει ο κριτής', () => {
    atUrl('?pets=3');
    render(<ListingStayBooking listing={TWO_PETS} />);
    expect(petsSelect().value).toBe('3');
    expect(optionsOf(petsSelect())).toEqual(['', '1', '2', '3']);
  });
});
