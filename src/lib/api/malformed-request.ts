/**
 * @fileoverview **ΤΟ ΑΙΤΗΜΑ ΔΕΝ ΕΙΝΑΙ ΣΧΗΜΑ** — μία απόρριψη για σώμα **και** για query.
 * @related ADR-904 Κ7 · `json-body.ts` · `query-params.ts`
 * @module lib/api/malformed-request
 *
 * 🔑 **Η απάντηση ονομάζει τα πεδία** (μονοπάτια μέσα από `Set` — το zod βγάζει πολλά ζητήματα για το ίδιο πεδίο) και
 * ⛔ **ποτέ** το μήνυμα του zod: αγγλικό κείμενο βιβλιοθήκης σε επιφάνεια χρήστη (N.11) και διαρροή του σχήματος.
 * Ο κωδικός λέει **πού** ήταν το λάθος (`MALFORMED_BODY` · `MALFORMED_QUERY`) — ο πελάτης διορθώνει άλλο πράγμα.
 */

import 'server-only';

import { NextResponse } from 'next/server';

export type MalformedRequestCode = 'MALFORMED_BODY' | 'MALFORMED_QUERY';

export interface MalformedRequestBody {
  readonly error: MalformedRequestCode;
  readonly malformed: readonly string[];
}

/** Ένα ζήτημα επικύρωσης — η κοινή μορφή zod v3 και v4 (στο v4 το μονοπάτι είναι `PropertyKey[]`). */
interface ValidationIssue {
  readonly path: readonly PropertyKey[];
}

/** **400 με τα ονόματα των πεδίων** — `String`: ένα `symbol` στο μονοπάτι θα έριχνε το `join`. */
export function malformedResponse(
  code: MalformedRequestCode,
  issues: readonly ValidationIssue[],
): NextResponse<MalformedRequestBody> {
  const malformed = [...new Set(issues.map((issue) => issue.path.map(String).join('.')))];
  return NextResponse.json({ error: code, malformed }, { status: 400 });
}
