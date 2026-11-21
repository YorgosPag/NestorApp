/**
 * ADR-920 Β6.6 — **fetching a published terrain snapshot** from the public shelf, with a NAMED outcome.
 *
 *   url ─▶ fetch (gzip, decompressed by the browser) ─▶ JSON ─▶ readListingTerrainSnapshot ─▶ ready | refused
 *                    └─ network error / HTTP ≠ 2xx ───────────────────────────────────────▶ unreachable
 *
 * 🔑 **Two failures, never merged**: `unreachable` = «we did not learn» (a retry may help); `refused` = «the bytes arrived
 *   and this code cannot draw them» (a retry will not). Merging them would offer a useless retry, or hide a useful one.
 * 🔑 **Cancellation is not a failure**: an aborted request rethrows the `AbortError`; the caller that aborted ignores it.
 * 🔑 The shelf bucket is public with `origin: ['*']` CORS (`config/gcs-buckets.ts`, Ο-21) and serves
 *   `Content-Encoding: gzip` (§12): `response.json()` reads it as-is. No credentials travel to it.
 *
 * Pure except for the injected `fetch`.
 *
 * @module lib/terrain/publication/listing-terrain-snapshot-fetch
 */

import { readListingTerrainSnapshot, type ListingTerrainSnapshotRefusal } from './listing-terrain-snapshot-reader';
import type { ListingTerrainSnapshot } from './listing-terrain-types';

export type ListingTerrainSnapshotFetch =
  | { readonly kind: 'ready'; readonly snapshot: ListingTerrainSnapshot }
  | { readonly kind: 'refused'; readonly reason: ListingTerrainSnapshotRefusal }
  /** `status` = the HTTP status, `null` = no response at all (network, CORS). */
  | { readonly kind: 'unreachable'; readonly status: number | null };

/** Only what this module reads from a response — so a test needs no `Response` global. */
export type FetchedBody = Pick<Response, 'ok' | 'status' | 'json'>;
export type FetchLike = (input: string, init: RequestInit) => Promise<FetchedBody>;

/** The published snapshot behind `url` — or why it cannot be shown. Rethrows only when `signal` aborted. */
export async function fetchListingTerrainSnapshot(
  url: string,
  signal: AbortSignal,
  fetchImpl: FetchLike = fetch,
): Promise<ListingTerrainSnapshotFetch> {
  let response: FetchedBody;
  try {
    response = await fetchImpl(url, { signal, credentials: 'omit' });
  } catch (error) {
    if (signal.aborted) throw error;
    return { kind: 'unreachable', status: null };
  }
  if (!response.ok) return { kind: 'unreachable', status: response.status };

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (error) {
    if (signal.aborted) throw error;
    // A `SyntaxError` = the body arrived and is not JSON: the bytes are wrong. Anything else = the stream broke on the
    // way (network): we did not learn, and a retry may help.
    return error instanceof SyntaxError ? { kind: 'refused', reason: 'malformed' } : { kind: 'unreachable', status: null };
  }
  const read = readListingTerrainSnapshot(raw);
  return read.ok ? { kind: 'ready', snapshot: read.snapshot } : { kind: 'refused', reason: read.reason };
}
