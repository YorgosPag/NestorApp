/**
 * =============================================================================
 * THE "ALREADY HANDLED" MARKER — Cloud Functions side (ADR-873 Φ1 §9.1)
 * =============================================================================
 *
 * The ONLY writer of `function_event_records`. The decision logic is NOT here:
 * it lives in the portable core `generated/lib/idempotency/event-claim`, which
 * the app and this package share by projection (ADR-874 · CHECK 3.93). This file
 * is the Firestore mechanics around that decision, and nothing else.
 *
 * ## ⛔ When NOT to use this
 *
 * A marker document costs a write. Reach for it ONLY when there is no natural
 * guard. Prefer, in this order:
 *
 *   1. **One transaction** — if the effect is a Firestore write, create the
 *      marker AND apply the effect in the SAME transaction. Then there is no
 *      in-flight state to reason about at all: both happen or neither does.
 *      This is what `materialPriceSyncOnPODelivery` does.
 *   2. **A deterministic id on the effect itself** — an audit row whose id is
 *      derived from the change IS its own marker; `create()` on it answers
 *      "already done" for free. No second document.
 *   3. **A version on the target** — the search index compares
 *      `sourceUpdateTime`. Nothing to store.
 *
 * This module is for what is left: work that spans a non-Firestore side effect
 * (an outbound message), or a whole scheduled run.
 *
 * @module functions/shared/event-idempotency
 * @enterprise ADR-873 Φάση 1 · βήμα 1.1
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

import { COLLECTIONS } from '../config/firestore-collections';
import { generateFunctionEventId } from '../config/enterprise-id';
import {
  EVENT_CLAIM_TTL_MS,
  isEventClaimExpired,
  judgeEventClaim,
  type EventClaimRecord,
} from '../generated/lib/idempotency/event-claim';

/** gRPC `ALREADY_EXISTS` — what `create()` rejects with when the document is there. */
const ALREADY_EXISTS = 6;

const isAlreadyExists = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === ALREADY_EXISTS;

/** What a caller should do. `skip` carries WHY, because the three reasons are not alike. */
export type EventClaimOutcome =
  | { readonly kind: 'acquired' }
  | { readonly kind: 'skip'; readonly reason: 'done' | 'unknown' | 'collision' }
  | { readonly kind: 'in-flight' };

interface StoredClaim extends EventClaimRecord {
  /** TTL policy field (`firestore.indexes.json`) — for deletion only, never for judging. */
  readonly expiresAt: Date;
  readonly completedAtMs?: number;
}

/**
 * What must happen to the claim when `work` throws — and there is no safe default.
 *
 * - `release` — `work` is **all-or-nothing from our side**: a throw means nothing was
 *   written, so the seed goes back to free and the platform's retry does it.
 * - `retain` — `work` may have written **part** of its effect. Keep the claim: the lease
 *   expires, the next observer reads `unknown`, and a human decides. Never a silent
 *   second execution (the 🏆 of ADR-872).
 */
export type EventFailurePolicy = 'release' | 'retain';

const claimRef = (db: admin.firestore.Firestore, seed: string) =>
  db.collection(COLLECTIONS.FUNCTION_EVENT_RECORDS).doc(generateFunctionEventId(seed));

const freshClaim = (seed: string, nowMs: number): StoredClaim => ({
  state: 'in-flight',
  seed,
  lockedAtMs: nowMs,
  expiresAt: new Date(nowMs + EVENT_CLAIM_TTL_MS),
});

/**
 * Judge an existing marker, taking it over if the TTL sweep has not caught up yet.
 *
 * Firestore deletes expired documents lazily (up to 24h late), so an expired marker
 * must read as absent — otherwise work stops happening a week after it was last done.
 */
async function judgeOrTakeOver(
  ref: admin.firestore.DocumentReference,
  seed: string,
  nowMs: number,
): Promise<EventClaimOutcome> {
  return ref.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const existing = snapshot.exists ? (snapshot.data() as StoredClaim) : undefined;
    if (existing === undefined || isEventClaimExpired(existing, nowMs)) {
      transaction.set(ref, freshClaim(seed, nowMs));
      return { kind: 'acquired' } as const;
    }
    const verdict = judgeEventClaim(existing, seed, nowMs);
    return verdict === 'in-flight'
      ? ({ kind: 'in-flight' } as const)
      : ({ kind: 'skip', reason: verdict } as const);
  });
}

/**
 * Claim this seed for exactly one execution.
 *
 * The happy path is a single `create()`: it fails atomically if the document is already
 * there, so no transaction is needed to win the race. The transaction is paid for only
 * in the rare branch where a marker already exists and has to be judged.
 */
export async function claimEventOnce(
  db: admin.firestore.Firestore,
  seed: string,
  nowMs: number,
): Promise<EventClaimOutcome> {
  const ref = claimRef(db, seed);
  try {
    await ref.create(freshClaim(seed, nowMs));
    return { kind: 'acquired' };
  } catch (error) {
    if (!isAlreadyExists(error)) throw error;
    return judgeOrTakeOver(ref, seed, nowMs);
  }
}

// ============================================================================
// THE TRANSACTIONAL FORM — marker AND effect in ONE commit
// ============================================================================

/**
 * A marker read inside a transaction, plus where it lives.
 *
 * Carried between the read phase and the write phase because Firestore demands **every read
 * before every write** in a transaction — so the two halves cannot be one call.
 */
export interface TransactionalEventClaim {
  readonly ref: admin.firestore.DocumentReference;
  readonly outcome: EventClaimOutcome;
}

/**
 * Read phase: is this seed still free, inside the caller's transaction?
 *
 * 🔑 **Why this exists at all.** Claiming in one write and applying the effect in another is
 * the dual-write problem: a crash between them either loses the work or does it twice. The
 * Idempotent Consumer pattern (Azure/Kafka/Stripe) says the deduplication marker and the
 * business effect must share **one** transaction — then redelivery either finds the marker and
 * skips, or finds nothing because the transaction never committed, and safely redoes it.
 * There is no third state to reason about, which is why this is the FIRST guard to reach for
 * whenever the effect is itself a Firestore write.
 *
 * Note there is no `in-flight` here, by construction: a transactional claim is written as
 * `done` in the same commit as its effect, so no observer can ever see a half-finished one.
 */
export async function readEventClaimInTransaction(
  transaction: admin.firestore.Transaction,
  db: admin.firestore.Firestore,
  seed: string,
  nowMs: number,
): Promise<TransactionalEventClaim> {
  const ref = claimRef(db, seed);
  const snapshot = await transaction.get(ref);
  const existing = snapshot.exists ? (snapshot.data() as StoredClaim) : undefined;

  if (existing === undefined || isEventClaimExpired(existing, nowMs)) {
    return { ref, outcome: { kind: 'acquired' } };
  }

  const verdict = judgeEventClaim(existing, seed, nowMs);
  // `in-flight` cannot happen for a transactional claim (see above) — but if a seed is ever
  // shared with the non-transactional form, treat it as a reason to stop, not to proceed.
  return verdict === 'in-flight'
    ? { ref, outcome: { kind: 'in-flight' } }
    : { ref, outcome: { kind: 'skip', reason: verdict } };
}

/**
 * Write phase: record that this seed is spent, in the SAME commit as the effect.
 *
 * Written as `done` immediately — there is no window in which the work is "started". Either
 * the transaction commits and both exist, or neither does.
 */
export function writeEventClaimDoneInTransaction(
  transaction: admin.firestore.Transaction,
  claim: TransactionalEventClaim,
  seed: string,
  nowMs: number,
): void {
  transaction.set(claim.ref, {
    ...freshClaim(seed, nowMs),
    state: 'done',
    completedAtMs: nowMs,
  });
}

/** The work finished. From here on, every other observer of this change skips. */
export async function markEventDone(
  db: admin.firestore.Firestore,
  seed: string,
  nowMs: number,
): Promise<void> {
  await claimRef(db, seed).update({ state: 'done', completedAtMs: nowMs });
}

/**
 * The work failed and changed **nothing** — free the seed so a retry can do it.
 *
 * ⚠️ Call this ONLY when nothing was written. If the failure came after a partial
 * effect, leave the marker: the lease will expire and the next observer will read
 * `unknown`, which says "a human must look" instead of silently doing it twice.
 */
export async function releaseEventClaim(
  db: admin.firestore.Firestore,
  seed: string,
): Promise<void> {
  await claimRef(db, seed).delete();
}

/**
 * Run `work` at most once for this seed.
 *
 * Written once, here, so that eight call sites do not each re-implement the
 * claim/complete/release dance slightly differently (N.18 — the sibling-clone trap).
 *
 * ⚠️ `onFailure` has **no default, on purpose**. Whether a thrown `work()` may have left
 * half an effect behind is the one thing this module cannot know and the caller always
 * can — and guessing it wrong is either a lost write or a double one.
 *
 * @returns what `work` returned, or `null` if this execution was not the one to run it.
 * @throws if another execution holds the claim right now — deliberately: throwing makes
 *   the platform retry, and the retry will see `done`. Returning quietly would report
 *   "handled" for work that may still fail.
 */
export async function runEventOnce<T>(
  db: admin.firestore.Firestore,
  seed: string,
  label: string,
  onFailure: EventFailurePolicy,
  work: () => Promise<T>,
): Promise<T | null> {
  const nowMs = Date.now();
  const outcome = await claimEventOnce(db, seed, nowMs);

  if (outcome.kind === 'in-flight') {
    throw new Error(`${label}: another execution holds this event — retrying`);
  }
  if (outcome.kind === 'skip') {
    // `unknown` and `collision` are not routine: they mean a previous run vanished
    // mid-write, or two different changes hashed to one id. Both need a human.
    const level = outcome.reason === 'done' ? 'info' : 'error';
    functions.logger[level](`${label}: skipped (${outcome.reason})`, { seed });
    return null;
  }

  try {
    const result = await work();
    await markEventDone(db, seed, nowMs);
    return result;
  } catch (error) {
    // `release`: the caller guarantees a throw means nothing was written, and the platform
    // is about to retry — so the seed must be free, or the retry would read `in-flight`
    // and then, after the lease, `unknown`: the work would never happen at all.
    // `retain`: part of the effect may already be out there. The claim stays, the lease
    // expires, and the next observer reads `unknown` — which asks for a human instead of
    // quietly doing it a second time.
    if (onFailure === 'release') await releaseEventClaim(db, seed);
    throw error;
  }
}
