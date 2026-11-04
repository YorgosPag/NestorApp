/**
 * @fileoverview **Η απάντηση των routes ευκαιριών από το αποτέλεσμα του service** — μία φορά για POST · PATCH · DELETE.
 * @module app/api/opportunities/_service-response
 *
 * Το `OpportunitiesServerService` επιστρέφει `{ success, error? }` αντί να πετά για επιχειρησιακές αρνήσεις. Η μετάφραση
 * σε HTTP ήταν γραμμένη τρεις φορές αυτολεξεί (CHECK 3.28, ADR-930)· τώρα ζει εδώ.
 */

import 'server-only';

import { NextResponse } from 'next/server';

import { getErrorMessage } from '@/lib/error-utils';

/** Άρνηση του service ⇒ 400 με το μήνυμά του· επιτυχία ⇒ ό,τι ορίσει ο καλών. */
export function respondWithServiceResult(
  result: { readonly success: boolean; readonly error?: string },
  onSuccess: () => NextResponse,
): NextResponse {
  return result.success ? onSuccess() : NextResponse.json({ success: false, error: result.error }, { status: 400 });
}

/** Απρόβλεπτο σφάλμα ⇒ 500. */
export function respondWithFailure(error: unknown, fallback: string): NextResponse {
  return NextResponse.json({ success: false, error: getErrorMessage(error, fallback) }, { status: 500 });
}
