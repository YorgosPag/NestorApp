/**
 * @fileoverview Firestore Subscribe Equality Guard — SSoT module (ADR-361)
 * @description Content-equality comparators used by `firestoreQueryService.subscribe*`
 *              to suppress same-content snapshot re-emissions.
 * @version 1.0.0
 * @created 2026-05-16
 *
 * Firestore `onSnapshot` re-fires on every cache hydration, pending-write ack,
 * and metadata change. `snapshot.docs.map(...)` produces a fresh array with
 * fresh object references every time — reference equality and shallow compare
 * are both useless. Without a deep content compare, every consumer of every
 * subscription re-renders at ~3-10Hz idle (ADR-040 Phase XV root cause).
 *
 * Industry convergence: RxJS `distinctUntilChanged`, React Query
 * `structuralSharing`, SWR `compare`, Apollo `equalityCheck`, Zustand
 * `equalityFn`. All enable equality guards by default; SWR ships with `dequal`.
 *
 * We use `dequal` (MIT, 1.2KB, 0 deps): handles Firestore Timestamp objects,
 * Date, undefined/null/NaN, nested arrays/objects correctly — JSON.stringify
 * would mis-handle Timestamps and produce false positives on key order.
 */

import { dequal } from 'dequal';

/**
 * Default equality comparator for collection/subcollection subscription
 * payloads — deep equal of the readonly documents array.
 *
 * @param prev — previously delivered documents, or `null`/`undefined` when
 *               no prior delivery has happened (initial state or post-reset).
 * @param next — new documents from the latest snapshot.
 * @returns `true` when contents are deeply equal (skip delivery), `false`
 *          when they differ or no prior delivery exists (deliver to consumer).
 */
export function defaultDocumentsEqual<T>(
  prev: readonly T[] | null | undefined,
  next: readonly T[],
): boolean {
  if (prev == null) return false;
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  return dequal(prev, next);
}

/**
 * Default equality comparator for single-document subscriptions.
 *
 * @param prev — previously delivered document (or `null` on first delivery /
 *               when the doc did not previously exist)
 * @param next — new document from the latest snapshot (or `null` if deleted)
 * @returns `true` when contents are deeply equal (skip delivery).
 */
export function defaultDocumentEqual<T>(
  prev: T | null | undefined,
  next: T | null,
): boolean {
  if (prev === undefined) return false;
  if (prev === next) return true;
  if (prev === null || next === null) return prev === next;
  return dequal(prev, next);
}

/**
 * Mutable hash-slot used by the service to track the most recent payload per
 * subscription. Kept as a tiny class to encapsulate the reset semantics
 * required when a subscription is rebuilt (e.g. super-admin company switcher,
 * ADR-354 entry point #3): a rebuild MUST treat the next emission as the
 * first one — otherwise a stale hash from the previous tenant would suppress
 * a legitimate delivery from the new tenant.
 */
export class EqualitySlot<T> {
  private value: T | null | undefined = undefined;

  reset(): void {
    this.value = undefined;
  }

  /**
   * Compare `next` against the stored value, store `next`, and return whether
   * delivery should be skipped.
   */
  shouldSkip(
    next: T,
    comparator: (prev: T | null | undefined, next: T) => boolean,
  ): boolean {
    const skip = comparator(this.value, next);
    if (!skip) this.value = next;
    return skip;
  }
}
