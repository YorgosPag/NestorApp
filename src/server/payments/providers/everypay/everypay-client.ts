import 'server-only';

/**
 * @fileoverview Πελάτης REST Everypay — **χωρίς** npm πακέτο (ADR-ACC-030 §4 · N.5)
 * @description Basic auth με το secret key (`sk_…:`), σώματα `application/x-www-form-urlencoded`, απαντήσεις JSON.
 *   Κάθε σφάλμα γίνεται `EverypayApiError` με τον κωδικό του παρόχου (π.χ. `41001` = «το token χρησιμοποιήθηκε
 *   ήδη»), ώστε ο adapter να ξεχωρίζει το ιδεμποτικό «έγινε ήδη» από την πραγματική αποτυχία. Χρονικό όριο ανά
 *   αίτημα: ο webhook handler δεν κρέμεται ποτέ πάνω σε αργό πάροχο.
 *
 * @see https://docs.everypay.gr/api-reference/
 */

import { isFiniteNumber, plainRecordOrNull } from '@/lib/type-guards';

import type { EverypayCredentials } from './everypay-config';

/** Πόσο περιμένουμε τον πάροχο (ms). */
const EVERYPAY_TIMEOUT_MS = 15_000;

export class EverypayApiError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly providerCode: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'EverypayApiError';
  }
}

/** Ο κωδικός του παρόχου για «αυτό το token χρησιμοποιήθηκε ήδη» (IRIS Direct: δεύτερη χρέωση της ίδιας πηγής). */
export const EVERYPAY_TOKEN_ALREADY_USED = 41001;

/**
 * Στιγμή ⇒ η μορφή ημερομηνίας του API: ISO 8601 **χωρίς χιλιοστά**, με ζώνη `±HHMM` (παράδειγμα του API reference:
 * `2027-11-23T15:52:00+0300`). Το `toISOString()` (`….123Z`) απορρίπτεται με «Invalid expiration date» —
 * μετρημένο ζωντανά στο sandbox 2026-11-11 (ADR-ACC-030 §5.8). Πάντα UTC (`+0000`): καμία εξάρτηση από τη ζώνη
 * του διακομιστή.
 */
export function everypayDateTime(instantIso: string): string {
  const instant = new Date(instantIso);
  if (Number.isNaN(instant.getTime())) throw new RangeError(`Not an instant: ${instantIso}`);
  return `${instant.toISOString().slice(0, 19)}+0000`;
}

interface EverypayCall {
  readonly method: 'GET' | 'POST' | 'DELETE';
  readonly path: string;
  readonly form?: Readonly<Record<string, string>>;
  readonly query?: Readonly<Record<string, string>>;
}

function authorizationOf(credentials: EverypayCredentials): string {
  return `Basic ${Buffer.from(`${credentials.secretKey}:`, 'utf8').toString('base64')}`;
}

function urlOf(credentials: EverypayCredentials, call: EverypayCall): string {
  const url = new URL(call.path, credentials.endpoints.api);
  for (const [key, value] of Object.entries(call.query ?? {})) url.searchParams.set(key, value);
  return url.toString();
}

function errorOf(status: number, body: unknown): EverypayApiError {
  const error = plainRecordOrNull(plainRecordOrNull(body)?.error);
  const code = isFiniteNumber(error?.code) ? error.code : null;
  const message = typeof error?.message === 'string' ? error.message : `Everypay HTTP ${status}`;
  return new EverypayApiError(status, code, message);
}

async function jsonOf(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Ένα αίτημα προς το API. Επιστρέφει το JSON ως `unknown` — ο adapter το διαβάζει με φρουρούς, ποτέ με `as`. */
export async function everypayRequest(credentials: EverypayCredentials, call: EverypayCall): Promise<unknown> {
  const response = await fetch(urlOf(credentials, call), {
    method: call.method,
    headers: {
      Authorization: authorizationOf(credentials),
      Accept: 'application/json',
      ...(call.form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: call.form ? new URLSearchParams(call.form).toString() : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(EVERYPAY_TIMEOUT_MS),
  });
  const body = await jsonOf(response);
  if (!response.ok) throw errorOf(response.status, body);
  return body;
}
