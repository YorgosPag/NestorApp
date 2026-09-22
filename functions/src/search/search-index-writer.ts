/**
 * =============================================================================
 * SEARCH INDEX — the only writer, and the only place the version is judged
 * =============================================================================
 *
 * Every write to `search_documents` from this package goes through here, inside a
 * transaction that reads what is already there and refuses to go backwards.
 *
 * ## Why a transaction on a per-write path
 *
 * Firestore has no conditional write (`if_seq_no` / `version_type=external` have no
 * equivalent), so "write only if newer" costs one read. That read is the entire mechanism:
 * without it, a redelivered event from 10 minutes ago overwrites the current index entry and
 * **nothing ever repairs it**. Elasticsearch pays the same cost from an in-memory version map
 * per shard; we pay it as one document read. It is the cheapest correct option available.
 *
 * ## Deletion writes a TOMBSTONE, it does not delete
 *
 * A deleted document carries no version, so a late CREATE arriving after a DELETE would find
 * nothing to compare against, write, and leave a **permanent ghost** — the entity is gone, so
 * no later trigger ever cleans it up. The tombstone is the same document with
 * `search.prefixes: []`, which the search query (`array-contains-any`) can never match, plus
 * a TTL that outlives the platform's retry window. See the portable judge for the full why.
 *
 * @module functions/search/search-index-writer
 * @enterprise ADR-873 Φάση 1 · βήμα 1.1 (ADR-029 — the index)
 */

import * as admin from 'firebase-admin';

import {
  buildSearchTombstone,
  shouldApplySearchIndexTombstone,
  shouldApplySearchIndexWrite,
  type CommitVersion,
  type SearchTombstoneIdentity,
  type StoredSearchIndexState,
} from '../generated/lib/search/search-index-version';
import type { SearchDocument } from './indexBuilder';

/** `applied` = the index moved · `stale` = a newer version is already there, refused. */
export type SearchIndexOutcome = 'applied' | 'stale';

const readStored = async (
  transaction: admin.firestore.Transaction,
  ref: admin.firestore.DocumentReference,
): Promise<StoredSearchIndexState | null> => {
  const snapshot = await transaction.get(ref);
  return snapshot.exists ? (snapshot.data() as StoredSearchIndexState) : null;
};

/**
 * Index one entity — unless the index already holds a newer version of it.
 *
 * The write is a full `set()`, not a merge: a merge would leave a previous tombstone's
 * `deleted` / `expiresAt` fields behind, and the entry would expire out from under a live
 * entity a week later. (The old code's merge branch rewrote every field anyway, including
 * `createdAt`, so nothing is lost by replacing it.)
 */
export async function applySearchIndexWrite(
  ref: admin.firestore.DocumentReference,
  searchDoc: SearchDocument,
  version: CommitVersion | null,
): Promise<SearchIndexOutcome> {
  return ref.firestore.runTransaction(async (transaction) => {
    const stored = await readStored(transaction, ref);
    if (!shouldApplySearchIndexWrite(stored, version)) return 'stale';
    transaction.set(ref, { ...searchDoc, sourceUpdateTime: version });
    return 'applied';
  });
}

/**
 * Mark the entity gone — unless the index already holds a newer version of it.
 *
 * `search.prefixes: []` is the whole disappearing act: the query filters with
 * `array-contains-any` over that array, and an empty array matches nothing. Not a flag someone
 * has to remember to check — an inability of the index.
 */
export async function applySearchIndexTombstone(
  ref: admin.firestore.DocumentReference,
  identity: SearchTombstoneIdentity,
  version: CommitVersion | null,
  nowMs: number,
): Promise<SearchIndexOutcome> {
  return ref.firestore.runTransaction(async (transaction) => {
    const stored = await readStored(transaction, ref);
    if (!shouldApplySearchIndexTombstone(stored, version)) return 'stale';

    const { expiresAtMs, ...tombstone } = buildSearchTombstone(identity, version, nowMs);
    transaction.set(ref, {
      ...tombstone,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
    });
    return 'applied';
  });
}
