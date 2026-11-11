import 'server-only';

/**
 * @fileoverview Πού επιστρέφει ο browser μετά τον πάροχο — **χωρίς** να δώσουμε το token του συνδέσμου στον πάροχο
 *   (ADR-ACC-030 §5)
 * @description Η σελίδα πληρωμής ζει στο `/shared/<token>`, και το token είναι το «κλειδί» του τιμολογίου. Δεν το
 *   βάζουμε στη διεύθυνση επιστροφής που κρατά ο πάροχος, ούτε το γράφουμε στη βάση (οι σύνδεσμοι αποθηκεύονται
 *   ως hash). Το κρατά ο **ίδιος ο browser**: κατά την έναρξη πληρωμής ο διακομιστής, αφού επαληθεύσει ότι η
 *   διαδρομή λύνεται στον ίδιο σύνδεσμο, γράφει ένα `HttpOnly` cookie με εμβέλεια **μόνο** τη διαδρομή επιστροφής.
 *
 *   `SameSite=None; Secure`: η επιστροφή IRIS είναι **POST από τον πάροχο** (άλλος ιστότοπος) — με `Lax` ο browser
 *   δεν θα έστελνε το cookie. Το περιεχόμενο είναι μόνο μια διαδρομή της ίδιας εφαρμογής, ελεγμένη ξανά στην ανάγνωση.
 */

import type { NextRequest, NextResponse } from 'next/server';

import { PAYMENT_PROVIDER_ROUTE_PREFIX } from '@/lib/payments/payment-routes';

export const PAYMENT_RETURN_COOKIE = 'nestor_payment_return';

/** Όσο ζει μια συνεδρία πληρωμής (30′) + περιθώριο για την τράπεζα. */
const PAYMENT_RETURN_MAX_AGE_SECONDS = 60 * 60;

/** Μόνο διαδρομή σελίδας συνδέσμου — ποτέ εξωτερική διεύθυνση (καμία ανοιχτή ανακατεύθυνση). */
const SHARED_PAGE_PATH = /^\/shared\/[A-Za-z0-9_\-%]+$/;

export function isPaymentReturnPath(path: string): boolean {
  return SHARED_PAGE_PATH.test(path);
}

export function setPaymentReturnCookie(response: NextResponse, returnPath: string): void {
  response.cookies.set(PAYMENT_RETURN_COOKIE, returnPath, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: `${PAYMENT_PROVIDER_ROUTE_PREFIX}/return`,
    maxAge: PAYMENT_RETURN_MAX_AGE_SECONDS,
  });
}

/** Η διαδρομή επιστροφής, αν το cookie υπάρχει και έχει τη σωστή μορφή. */
export function readPaymentReturnPath(request: NextRequest): string | null {
  const value = request.cookies.get(PAYMENT_RETURN_COOKIE)?.value ?? '';
  return isPaymentReturnPath(value) ? value : null;
}
