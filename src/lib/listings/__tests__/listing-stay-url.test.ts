/**
 * ADR-777 §8.60.21.7 — **η ερώτηση διαμονής στη διεύθυνση**: κάθε αναγνώστης και ο καθρέφτης του.
 *
 * 🔑 Ο νόμος που φυλάγεται: **ό,τι γράφεται ξαναδιαβάζεται ίδιο, και ό,τι ο αναγνώστης θα απέρριπτε
 * ΣΒΗΝΕΤΑΙ αντί να γραφτεί**. Αλλιώς ένας σύνδεσμος θα μπορούσε να χάσει την επιλογή του ανθρώπου
 * στην πρώτη ανανέωση.
 */

import { isWholeGuestCount, STAY_BOOKING_MAX_GUESTS } from '@/lib/offers/offer-amount';

import {
  readListingGuests,
  readListingPets,
  readListingStayWindow,
  writeListingGuests,
  writeListingPets,
  writeListingStayWindow,
  type ListingStayWindow,
} from '../listing-stay-url';

function written<T>(write: (value: T, params: URLSearchParams) => void, value: T, before: string): URLSearchParams {
  const params = new URLSearchParams(before);
  write(value, params);
  return params;
}

describe('Κ — `writeListingPets`: ο καθρέφτης του αναγνώστη, για ΜΕΡΙΚΗ γραφή', () => {
  it('θέτει — και αντικαθιστά, δεν διπλασιάζει', () => {
    expect(written(writeListingPets, 2, '').get('pets')).toBe('2');
    expect(written(writeListingPets, 3, 'pets=2').getAll('pets')).toEqual(['3']);
  });

  it('🔴 `null` ΑΦΑΙΡΕΙ το υπάρχον — «Χωρίς κατοικίδια» καθαρίζει τη διεύθυνση', () => {
    expect(written(writeListingPets, null, 'pets=2').has('pets')).toBe(false);
  });

  it('🔴 ΔΕΝ πειράζει άσχετα κλειδιά — η γραφή είναι μερική', () => {
    expect(written(writeListingPets, 1, 'in=2026-10-05&out=2026-10-08&guests=2&pets=2').toString())
      .toBe('in=2026-10-05&out=2026-10-08&guests=2&pets=1');
  });

  it.each([0, 6, 1.5, -1, Number.NaN])('🔴 `%s` που ο αναγνώστης θα απέρριπτε ⇒ ΣΒΗΝΕΤΑΙ, ποτέ δεν γράφεται', (pets) => {
    expect(written(writeListingPets, pets, 'pets=2').has('pets')).toBe(false);
  });

  it.each([1, 2, 3, 4, 5, null])('ό,τι γράφεται ξαναδιαβάζεται ίδιο: %s', (pets) => {
    expect(readListingPets(written(writeListingPets, pets, 'pets=4'))).toBe(pets);
  });
});

describe('Λ — `writeListingGuests`: ο καθρέφτης του αναγνώστη ατόμων', () => {
  it('θέτει και αντικαθιστά· ΔΕΝ πειράζει άσχετα κλειδιά', () => {
    expect(written(writeListingGuests, 2, 'pets=1&guests=5').toString()).toBe('pets=1&guests=2');
  });

  it('🔴 `null` ΑΦΑΙΡΕΙ — «δεν το αποφάσισα» ≠ «ένα άτομο»', () => {
    expect(written(writeListingGuests, null, 'guests=3').has('guests')).toBe(false);
  });

  it.each([0, -1, 2.5, STAY_BOOKING_MAX_GUESTS + 1, Number.NaN])(
    '🔴 `%s` που ο αναγνώστης θα απέρριπτε ⇒ ΣΒΗΝΕΤΑΙ',
    (guests) => {
      expect(written(writeListingGuests, guests, 'guests=3').has('guests')).toBe(false);
    },
  );

  it.each([1, 2, 8, STAY_BOOKING_MAX_GUESTS, null])('ό,τι γράφεται ξαναδιαβάζεται ίδιο: %s', (guests) => {
    expect(readListingGuests(written(writeListingGuests, guests, 'guests=3'))).toBe(guests);
  });

  it('🔴 `?guests=51` ΔΕΝ διαβάζεται — ήταν ερώτηση που ο διακομιστής απαντούσε 400', () => {
    expect(readListingGuests(new URLSearchParams('guests=51'))).toBeNull();
  });
});

describe('Μ — `writeListingStayWindow`: τα δύο άκρα ΜΑΖΙ ή ΚΑΘΟΛΟΥ', () => {
  const WINDOW: ListingStayWindow = { checkIn: '2026-10-05', checkOut: '2026-10-08' };

  it('θέτει και τα δύο άκρα, χωρίς να πειράζει άσχετα κλειδιά', () => {
    expect(written(writeListingStayWindow, WINDOW, 'guests=2').toString())
      .toBe('guests=2&in=2026-10-05&out=2026-10-08');
  });

  it('🔴 `null` σβήνει ΚΑΙ ΤΑ ΔΥΟ άκρα', () => {
    const after = written(writeListingStayWindow, null, 'in=2026-10-05&out=2026-10-08&pets=1');
    expect(after.toString()).toBe('pets=1');
  });

  it.each<[string, ListingStayWindow]>([
    ['κενό (0 νύχτες)', { checkIn: '2026-10-05', checkOut: '2026-10-05' }],
    ['ανάποδο', { checkIn: '2026-10-08', checkOut: '2026-10-05' }],
    ['με ώρα', { checkIn: '2026-10-05T10:00:00Z', checkOut: '2026-10-08' }],
    ['ανύπαρκτη μέρα', { checkIn: '2026-02-31', checkOut: '2026-03-02' }],
  ])('🔴 %s ⇒ ΣΒΗΝΕΤΑΙ, ποτέ δεν γράφεται μισό', (_label, window) => {
    const after = written(writeListingStayWindow, window, 'in=2026-01-01&out=2026-01-03');
    expect(after.has('in')).toBe(false);
    expect(after.has('out')).toBe(false);
  });

  it('ό,τι γράφεται ξαναδιαβάζεται ίδιο', () => {
    expect(readListingStayWindow(written(writeListingStayWindow, WINDOW, ''))).toEqual(WINDOW);
    expect(readListingStayWindow(written(writeListingStayWindow, null, 'in=2026-10-05&out=2026-10-08'))).toBeNull();
  });

  it('🔴 μισό ζεύγος στη διεύθυνση ⇒ καμία ερώτηση', () => {
    expect(readListingStayWindow(new URLSearchParams('in=2026-10-05'))).toBeNull();
  });
});

describe('Ν — `isWholeGuestCount`: ο ΕΝΑΣ κριτής πλήθους ατόμων', () => {
  it.each([1, 2, STAY_BOOKING_MAX_GUESTS])('δέχεται %s', (value) => {
    expect(isWholeGuestCount(value)).toBe(true);
  });

  it.each([0, -1, 2.5, STAY_BOOKING_MAX_GUESTS + 1, Number.NaN, Number.POSITIVE_INFINITY, '2', null, undefined])(
    '🔴 απορρίπτει %s',
    (value) => {
      expect(isWholeGuestCount(value)).toBe(false);
    },
  );
});
