/**
 * @module server/pdf-seal/seal-transport.server
 * @description **Πώς μιλά η μηχανή σφράγισης στον έξω κόσμο** (ADR-918 §4) — ένας δρόμος για CSC **και** TSA.
 *
 * 🔑 Εγχεόμενο (`fetchImpl` · `env` · `now`), όπως ο πελάτης ΓΕΜΗ (ADR-841 Α23): οι άγκυρες δεν αγγίζουν ποτέ
 * δίκτυο ή `process.env`, και η ώρα της σφράγισης είναι **όρισμα**, όχι `new Date()` σκορπισμένο σε τρία αρχεία.
 *
 * | Απάντηση | Αποτέλεσμα |
 * |---|---|
 * | 2xx, σώμα ≤ όριο | `ok` + bytes |
 * | 4xx εκτός 408/429 | `rejected` (θέλει άνθρωπο) |
 * | 408 · 429 · 5xx · δίκτυο · προθεσμία · σώμα > όριο | `unavailable` (παροδικό — ξαναδοκιμάζει το δίχτυ) |
 */

import 'server-only';

import { getErrorMessage } from '@/lib/error-utils';
import type { EnvironmentSource } from '@/lib/environment/environment-audit';

export interface SealTransport {
  readonly fetchImpl: typeof fetch;
  readonly env: EnvironmentSource;
  readonly now: () => Date;
}

export const LIVE_SEAL_TRANSPORT: SealTransport = {
  fetchImpl: (input, init) => fetch(input, init),
  env: process.env,
  now: () => new Date(),
};

/** Προθεσμία ανά κλήση — η σφράγιση τρέχει σε εκτελεστή παρασκηνίου, όχι σε αίτημα χρήστη. */
const CALL_TIMEOUT_MS = 20_000;
/** Καμία γνήσια απάντηση CSC/TSA δεν είναι μεγαλύτερη· κάτι μεγαλύτερο απορρίπτεται πριν φτάσει σε αναλυτή ASN.1. */
const MAX_RESPONSE_BYTES = 1_048_576;

export type SealCall =
  | { readonly kind: 'ok'; readonly body: Uint8Array }
  | { readonly kind: 'rejected'; readonly detail: string }
  | { readonly kind: 'unavailable'; readonly detail: string };

function isTransient(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/** Ένα POST, με προθεσμία και όριο σώματος. Ποτέ δεν ρίχνει. */
export async function postOnce(transport: SealTransport, url: string, init: { headers: Record<string, string>; body: BodyInit }): Promise<SealCall> {
  try {
    const response = await transport.fetchImpl(url, {
      method: 'POST',
      headers: init.headers,
      body: init.body,
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      redirect: 'error',
    });
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.length > MAX_RESPONSE_BYTES) return { kind: 'unavailable', detail: `σώμα ${body.length} bytes > όριο` };
    if (response.ok) return { kind: 'ok', body };
    const detail = `HTTP ${response.status}`;
    return isTransient(response.status) ? { kind: 'unavailable', detail } : { kind: 'rejected', detail };
  } catch (error) {
    return { kind: 'unavailable', detail: getErrorMessage(error) };
  }
}

/** Σώμα → JSON, ή `null` αν δεν είναι JSON. Ποτέ δεν ρίχνει. */
export function jsonOf(body: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    return null;
  }
}

/** POST JSON → JSON. Σώμα που δεν είναι JSON ⇒ `rejected` (ο πάροχος μίλησε, αλλά όχι CSC). */
export async function postJson(
  transport: SealTransport,
  url: string,
  payload: Readonly<Record<string, unknown>>,
  headers: Record<string, string> = {},
): Promise<{ readonly kind: 'ok'; readonly json: unknown } | Exclude<SealCall, { kind: 'ok' }>> {
  const call = await postOnce(transport, url, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
  if (call.kind !== 'ok') return call;
  const json = jsonOf(call.body);
  return json === null ? { kind: 'rejected', detail: 'σώμα που δεν είναι JSON' } : { kind: 'ok', json };
}
