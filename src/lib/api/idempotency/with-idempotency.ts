/**
 * @module lib/api/idempotency/with-idempotency
 * @description **Το σύνορο ιδεμποτίας** — εκτελεί μια πράξη **μία** φορά ανά `Idempotency-Key` και σε κάθε
 * επανάληψη επιστρέφει την αποθηκευμένη απάντηση (ADR-853 Ε3 Φάση 2).
 *
 * 🔑 **Εξ ορισμού, όχι ανά route** (Stripe: «All POST requests accept idempotency keys»): καλείται από το
 * `withAuth`, άρα κάθε route πίσω από το σύνορο προστατεύεται χωρίς να το ζητήσει. Η **μόνη** εξαίρεση είναι
 * το `idempotency: { mode: 'natural', why }` (CHECK 3.92 Κ1).
 *
 * | Η πράξη… | τότε το κλειδί… |
 * |---|---|
 * | επέστρεψε οτιδήποτε **εκτός** 503 | αποθηκεύεται μαζί με την απάντηση (και 500 — Stripe: «including 500 errors») |
 * | **επέστρεψε** 503 | απελευθερώνεται: συμβόλαιο «τίποτα δεν άλλαξε, ξαναδοκίμασε» |
 * | **πέταξε** (και έγινε 500 από τον κεντρικό χειριστή) | αποθηκεύεται: μπορεί να είχε ήδη γράψει |
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { sha256HexOfText } from '@/lib/hash/sha256';
import { createModuleLogger } from '@/lib/telemetry';
import { generateDeterministicIdempotencyRecordId } from '@/services/enterprise-id.service';

import {
  IDEMPOTENCY_ERROR,
  IDEMPOTENCY_IN_FLIGHT_RETRY_AFTER_S,
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_MAX_STORED_BODY_CHARS,
  IDEMPOTENT_REPLAYED_HEADER,
  isValidIdempotencyKey,
  type IdempotencyErrorCode,
  type IdempotencyPolicy,
} from './idempotency-contract';
import {
  acquireIdempotencyRecord,
  completeIdempotencyRecord,
  releaseIdempotencyRecord,
  type IdempotencyAcquisition,
  type StoredIdempotentResponse,
} from './idempotency-store';

const logger = createModuleLogger('IDEMPOTENCY');

/** Τι έκανε ο handler — `thrown` ξεχωρίζει το «επέστρεψε 503» από το «έσκασε». */
export interface IdempotentExecution {
  readonly response: NextResponse;
  readonly thrown: boolean;
}

/** Εξαρτήσεις — ορατές μόνο για τις άγκυρες. */
export interface IdempotencyDeps {
  readonly db: () => Firestore;
  readonly now: () => number;
}

const DEFAULT_DEPS: IdempotencyDeps = { db: getAdminFirestore, now: Date.now };

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Η εγγραφή ενός κλειδιού — ό,τι χρειάζεται για να κριθεί και να κλείσει. */
interface KeyedRequest {
  readonly recordId: string;
  readonly principal: string;
  readonly method: string;
  readonly path: string;
  readonly fingerprint: string;
}

const REFUSAL: Record<Exclude<IdempotencyAcquisition['kind'], 'acquired' | 'replay'>, readonly [IdempotencyErrorCode, number, string]> = {
  'in-flight': [IDEMPOTENCY_ERROR.IN_FLIGHT, 409, 'The same operation is still being processed'],
  reused: [IDEMPOTENCY_ERROR.KEY_REUSED, 422, 'Idempotency key reused with a different request'],
  unknown: [IDEMPOTENCY_ERROR.OUTCOME_UNKNOWN, 409, 'The outcome of the original operation is unknown'],
  unreplayable: [IDEMPOTENCY_ERROR.REPLAY_UNAVAILABLE, 409, 'The operation completed but its response cannot be replayed'],
};

function boundaryResponse(code: IdempotencyErrorCode, status: number, message: string): NextResponse {
  const headers: Record<string, string> = code === IDEMPOTENCY_ERROR.IN_FLIGHT
    ? { 'Retry-After': String(IDEMPOTENCY_IN_FLIGHT_RETRY_AFTER_S) }
    : {};
  return NextResponse.json({ success: false, error: message, errorCode: code }, { status, headers });
}

function replayOf(stored: StoredIdempotentResponse): NextResponse {
  return new NextResponse(stored.body, {
    status: stored.status,
    headers: { 'content-type': 'application/json', [IDEMPOTENT_REPLAYED_HEADER]: 'true' },
  });
}

/** Εφαρμόζεται μόνο σε πράξη με κλειδί, σώμα JSON (ή κανένα), και όχι `natural`. */
function appliesTo(request: NextRequest, policy: IdempotencyPolicy | undefined): boolean {
  if (SAFE_METHODS.has(request.method) || policy?.mode === 'natural') return false;
  if (request.headers.get(IDEMPOTENCY_KEY_HEADER) === null) return false;
  const contentType = request.headers.get('content-type');
  return contentType === null || contentType.includes('application/json');
}

async function keyedRequestOf(request: NextRequest, principal: string, key: string): Promise<KeyedRequest> {
  const { pathname, search } = request.nextUrl;
  const body = await request.clone().text();
  const fingerprint = await sha256HexOfText(`${request.method}\n${pathname}${search}\n${body}`);
  const recordId = generateDeterministicIdempotencyRecordId(principal, request.method, pathname, key);
  return { recordId, principal, method: request.method, path: pathname, fingerprint };
}

/** Η απάντηση όπως θα αποθηκευτεί — `null` ⇒ δεν αναπαράγεται (μη-JSON ή πολύ μεγάλη). */
async function storableOf(response: NextResponse): Promise<StoredIdempotentResponse | null> {
  if (!(response.headers.get('content-type') ?? '').includes('application/json')) return null;
  const body = await response.clone().text();
  return body.length > IDEMPOTENCY_MAX_STORED_BODY_CHARS ? null : { status: response.status, body };
}

/** Κλείνει την εγγραφή. Αποτυχία εδώ **δεν** αλλάζει την απάντηση: η πράξη έγινε ήδη. */
async function settle(keyed: KeyedRequest, execution: IdempotentExecution, deps: IdempotencyDeps): Promise<void> {
  try {
    if (!execution.thrown && execution.response.status === 503) {
      await releaseIdempotencyRecord(deps.db(), keyed.recordId);
      return;
    }
    await completeIdempotencyRecord(deps.db(), keyed.recordId, await storableOf(execution.response), deps.now());
  } catch (error) {
    // Η εγγραφή μένει «σε εξέλιξη» ⇒ μετά το lease οι επαναλήψεις παίρνουν OUTCOME_UNKNOWN — ποτέ δεύτερη εκτέλεση.
    logger.error('Idempotency record could not be settled', { recordId: keyed.recordId, error });
  }
}

/**
 * 🔑 **Το σύνορο.** `principal` = ο αυθεντικοποιημένος `uid`, ή `anon` για δημόσιες διαδρομές (το κλειδί είναι
 * 128 bit τυχαίο και η αναπαραγωγή θέλει και **ίδιο** περιεχόμενο).
 */
export async function runIdempotently(
  request: NextRequest,
  principal: string,
  policy: IdempotencyPolicy | undefined,
  execute: () => Promise<IdempotentExecution>,
  deps: IdempotencyDeps = DEFAULT_DEPS,
): Promise<NextResponse> {
  if (!appliesTo(request, policy)) return (await execute()).response;
  const key = request.headers.get(IDEMPOTENCY_KEY_HEADER) ?? '';
  if (!isValidIdempotencyKey(key)) {
    return boundaryResponse(IDEMPOTENCY_ERROR.KEY_INVALID, 400, 'Invalid idempotency key');
  }
  const keyed = await keyedRequestOf(request, principal, key);
  let acquisition: IdempotencyAcquisition;
  try {
    acquisition = await acquireIdempotencyRecord(deps.db(), keyed.recordId, keyed, deps.now());
  } catch (error) {
    logger.error('Idempotency store unavailable', { recordId: keyed.recordId, error });
    return boundaryResponse(IDEMPOTENCY_ERROR.STORE_UNAVAILABLE, 503, 'Idempotency store unavailable');
  }
  if (acquisition.kind === 'replay') return replayOf(acquisition.response);
  if (acquisition.kind !== 'acquired') return boundaryResponse(...REFUSAL[acquisition.kind]);
  const execution = await execute();
  await settle(keyed, execution, deps);
  return execution.response;
}
