/**
 * @fileoverview **ΟΙ ΠΑΡΑΜΕΤΡΟΙ ΤΟΥ QUERY, ΚΡΙΜΕΝΕΣ ΜΙΑ ΦΟΡΑ** — το αδελφό βήμα του `readJsonBody`.
 * @related ADR-904 Κ7 · `json-body.ts` · `malformed-request.ts`
 * @module lib/api/query-params
 *
 * 🔑 Η διαδρομή κρίνει με το **ίδιο** σχήμα zod/v4 που δημοσιεύεται στο συμβόλαιο (`src/contracts/`) — ποτέ με δεύτερο
 * αντίγραφο. Οι τιμές φτάνουν ως **κείμενο**· η μετατροπή (π.χ. αριθμός) είναι δουλειά του σχήματος (`z.coerce`).
 *
 * ⚠️ **Επαναλαμβανόμενο κλειδί κρατά την ΠΡΩΤΗ τιμή** (`URLSearchParams.get`) — δηλωμένο, ώστε να μην είναι σύμπτωση
 * της υλοποίησης (το `Object.fromEntries(searchParams)` κρατά την **τελευταία**).
 *
 * 🔑 **Δύο μορφές, μία κρίση ανά παράμετρο:** το σχήμα (`readQueryParams`) για διαδρομές με δημοσιευμένο συμβόλαιο· οι
 * **προστακτικοί αναγνώστες** (`optionalQueryText` · `optionalQueryDay` · `readQueryLimit`) για διαδρομές που ρίχνουν
 * `ApiError`. Άκυρη τιμή ⇒ `InvalidQueryParamError` (400 `INVALID_ARGUMENT`) — **απόρριψη, ποτέ ψαλίδισμα** (ήταν
 * `parseInt` ⇒ `limit=abc` = `NaN` ⇒ 500 σε τρεις διαδρομές ιστορικού, ADR-584 §9 κλώνοι).
 */

import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod/v4';

import { isCalendarDay } from '@/lib/date/calendar-day';
import { ApiError } from './api-error-types';
import { malformedResponse, type MalformedRequestBody } from './malformed-request';

export type QueryParams<T> =
  | { readonly data: T }
  | { readonly rejected: NextResponse<MalformedRequestBody> };

/** **Διάβασε το query και κρίνε το με αυτό το σχήμα** — ή η έτοιμη απόρριψη `MALFORMED_QUERY` (400). */
export function readQueryParams<TSchema extends z.ZodType>(
  request: NextRequest,
  schema: TSchema,
): QueryParams<z.infer<TSchema>> {
  const params = request.nextUrl.searchParams;
  const raw: Record<string, string> = {};
  for (const key of new Set(params.keys())) raw[key] = params.get(key) ?? '';
  const parsed = schema.safeParse(raw);
  return parsed.success ? { data: parsed.data } : { rejected: malformedResponse('MALFORMED_QUERY', parsed.error.issues) };
}

// ============================================================================
// ΠΡΟΣΤΑΚΤΙΚΟΙ ΑΝΑΓΝΩΣΤΕΣ
// ============================================================================

/** Άκυρη παράμετρος query — 400 `INVALID_ARGUMENT`· το `withAuth` / `apiErrorHandler` τη χαρτογραφούν ως `ApiError`. */
export class InvalidQueryParamError extends ApiError {
  static readonly code = 'INVALID_ARGUMENT';

  constructor(message: string) {
    super(400, message, InvalidQueryParamError.code);
    this.name = 'InvalidQueryParamError';
  }
}

/** Η τιμή, ή `undefined` — απουσία και κενό σημαίνουν το ίδιο: «δεν ζητήθηκε». */
export function optionalQueryText(searchParams: URLSearchParams, name: string): string | undefined {
  const raw = searchParams.get(name);
  return raw === null || raw === '' ? undefined : raw;
}

/** Ημερολογιακή ημέρα `YYYY-MM-DD` που **υπάρχει** (`isCalendarDay`), ή `undefined` — άκυρη ⇒ 400. */
export function optionalQueryDay(searchParams: URLSearchParams, name: string): string | undefined {
  const raw = optionalQueryText(searchParams, name);
  if (raw !== undefined && !isCalendarDay(raw)) {
    throw new InvalidQueryParamError(`${name} must be a calendar day (YYYY-MM-DD)`);
  }
  return raw;
}

export interface QueryLimitBounds {
  /** Όταν η παράμετρος λείπει ή είναι κενή. */
  readonly defaultLimit: number;
  /** Ανώτατο, συμπεριλαμβανόμενο· το κατώτατο είναι 1. */
  readonly maxLimit: number;
}

const DECIMAL_INTEGER = /^\d+$/;

/** Μέγεθος σελίδας: δεκαδικός ακέραιος `1..maxLimit` — αλλιώς 400 (ποτέ `parseInt`, που δέχεται `2.5` και `12abc`). */
export function readQueryLimit(searchParams: URLSearchParams, bounds: QueryLimitBounds, name = 'limit'): number {
  const raw = searchParams.get(name);
  if (raw === null || raw === '') return bounds.defaultLimit;
  const value = DECIMAL_INTEGER.test(raw) ? Number(raw) : Number.NaN;
  if (!(value >= 1 && value <= bounds.maxLimit)) {
    throw new InvalidQueryParamError(`${name} must be an integer in 1..${bounds.maxLimit}`);
  }
  return value;
}
