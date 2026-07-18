'use client';

/**
 * ADR-634 follow-up — per-row write serialization for managed BIM BOQ rows.
 *
 * The managed-row lifecycle is **read-then-write** (getDoc → decide upsert /
 * delete / drift). When two changes touch the SAME row id concurrently — the
 * classic case is a MASS opening delete, which fires N parallel
 * `deleteOpeningFromGroup` / `recomputeFloorplanHardwareBoq` calls at once — the
 * reads all observe the pre-delete state and race:
 *   - two callers both see `exists() === true` → both `deleteDoc` → the second
 *     hits a now-missing doc → Firestore reports the delete-rule failure as the
 *     misleading "Missing or insufficient permissions" (rule reads
 *     `resource.data` on a null resource), spamming the console with a false
 *     security error for what is really a benign double-delete;
 *   - on the upsert side two callers count members before the other's delete
 *     lands → a **wrong `estimatedQuantity`** is persisted (silent, worse).
 *
 * Google-level answer (N.7.2 #2 "race condition possible? → No"): serialize the
 * read-modify-write **per row id**. Different ids still run fully in parallel, so
 * there is no throughput regression — only same-id operations chain, which is
 * exactly the invariant we need. A single module-singleton queue keyed by the
 * BOQ row id is the SSoT: `writeSignatureGroup` (signature-group rows) and
 * `syncManagedBoqRow` / `deleteManagedBoqRow` (hardware / stair / envelope rows)
 * all route their write through it, so no two writes to one row ever interleave.
 */

/** Serializes async tasks that share a `key`; distinct keys run concurrently. */
export interface KeyedSerialQueue {
  /**
   * Run `task` after every previously-queued task for `key` has settled,
   * regardless of their outcome (one caller's rejection never blocks the next).
   * Returns `task`'s own result/rejection to THIS caller.
   */
  run<T>(key: string, task: () => Promise<T>): Promise<T>;
}

/**
 * Create an independent keyed serial queue. Entries self-clean once their chain
 * drains, so the map never grows unbounded. Exported (not just the singleton) so
 * tests get a fresh, isolated instance.
 */
export function createKeyedSerialQueue(): KeyedSerialQueue {
  const tails = new Map<string, Promise<unknown>>();

  function run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const prev = tails.get(key) ?? Promise.resolve();
    // Chain after prev whether it resolved or rejected — the queue orders access,
    // it does not couple callers' success. `task` runs exactly once, when its turn
    // comes; its result is handed back verbatim to the caller below.
    const result = prev.then(task, task);
    // Tail-tracking copy swallows rejections so a failed task cannot break the
    // chain for the next caller (the failure is still surfaced via `result`).
    const guarded = result.then(
      () => undefined,
      () => undefined,
    );
    tails.set(key, guarded);
    void guarded.then(() => {
      // Drop the entry only if we are still the tail (a later `run` may have
      // extended the chain in the meantime).
      if (tails.get(key) === guarded) tails.delete(key);
    });
    return result;
  }

  return { run };
}

/**
 * Shared singleton: the SSoT serialization point for EVERY managed BIM BOQ row
 * write (signature groups + `syncManagedBoqRow` + `deleteManagedBoqRow`). One
 * instance so contention on a single row id is serialized across all writers.
 */
export const boqRowWriteQueue: KeyedSerialQueue = createKeyedSerialQueue();
