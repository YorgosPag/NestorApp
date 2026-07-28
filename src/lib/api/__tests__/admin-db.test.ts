/**
 * `requireAdminFirestore` — η αποτυχία αρχικοποίησης είναι 503, όχι 500.
 *
 * Το τεστ υπάρχει επειδή η προηγούμενη μορφή αυτού του ελέγχου (`if (!db) throw
 * 503`) ήταν **αόρατα νεκρή**: κανένα τεστ δεν την κάλυπτε, και δεν μπορούσε να
 * καλυφθεί — το `getAdminFirestore()` δεν επιστρέφει ποτέ falsy τιμή. Τα δύο
 * σενάρια εδώ είναι ακριβώς τα δύο μονοπάτια που ΥΠΑΡΧΟΥΝ στην πραγματικότητα.
 *
 * @module lib/api/__tests__/admin-db
 */

import { requireAdminFirestore } from '../admin-db';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { ApiError } from '../api-error-types';

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: jest.fn(),
}));

const mockGetAdminFirestore = getAdminFirestore as jest.MockedFunction<typeof getAdminFirestore>;

describe('requireAdminFirestore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('επιστρέφει το instance όταν η αρχικοποίηση πετύχει', () => {
    const db = { collection: jest.fn() };
    mockGetAdminFirestore.mockReturnValue(db as unknown as ReturnType<typeof getAdminFirestore>);

    expect(requireAdminFirestore()).toBe(db);
  });

  it('μεταφράζει την αποτυχία αρχικοποίησης σε ApiError 503 / DB_UNAVAILABLE', () => {
    mockGetAdminFirestore.mockImplementation(() => {
      throw new Error('no credentials in chain');
    });

    // ΟΧΙ 500: το 503 λέει στον πελάτη «ξαναδοκίμασε», και είναι το status που
    // σέβονται retry policies / load balancers. Πριν το SSoT, η ίδια αποτυχία
    // διέφευγε ως 500 ενώ δίπλα της υπήρχε γραμμή που υποσχόταν 503.
    expect(() => requireAdminFirestore()).toThrow(ApiError);

    try {
      requireAdminFirestore();
      throw new Error('unreachable — έπρεπε να είχε πεταχτεί ApiError');
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.statusCode).toBe(503);
      expect(apiError.errorCode).toBe('DB_UNAVAILABLE');
      // Η αιτία ταξιδεύει στα details, όχι στο μήνυμα προς τον πελάτη.
      expect(apiError.message).not.toContain('credentials');
      expect(apiError.details?.cause).toContain('no credentials in chain');
    }
  });
});
