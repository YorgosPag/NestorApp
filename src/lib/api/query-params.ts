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
 */

import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod/v4';

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
