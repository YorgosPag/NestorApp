/**
 * ADR-920 Β6.6 — το fetch του δημοσιευμένου στιγμιοτύπου: τρεις ονομασμένες απαντήσεις, και η ακύρωση δεν είναι καμία.
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - HTTP 503 διαβάζεται ως `refused` (ή το αντίστροφο) ⇒ ο επισκέπτης παίρνει άχρηστη ή χαμένη επανάληψη.
 * - μη-JSON σώμα γίνεται `unreachable` ⇒ επανάληψη που δεν θα βοηθήσει ποτέ.
 * - η ακύρωση καταπίνεται ως `unreachable` ⇒ κάθε κλείσιμο καρτέλας αφήνει ψεύτικο «δεν φόρτωσε».
 */

import { fetchListingTerrainSnapshot, type FetchLike } from '../listing-terrain-snapshot-fetch';
import { PUBLISHED_TERRAIN_URL, REAL_PLANE } from './fixtures/terrain-3d-fixtures';

const SNAPSHOT = REAL_PLANE();

/** Μια απάντηση με το σώμα ως κείμενο — το `json()` αναλύει όπως ο browser (`SyntaxError` σε μη-JSON). */
function respondWith(body: string, status = 200): FetchLike {
  return jest.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => JSON.parse(body) as unknown }));
}

function signal(): AbortSignal {
  return new AbortController().signal;
}

describe('fetchListingTerrainSnapshot', () => {
  it('στιγμιότυπο που διαβάζεται ⇒ ready, με το ΙΔΙΟ περιεχόμενο', async () => {
    const result = await fetchListingTerrainSnapshot(PUBLISHED_TERRAIN_URL, signal(), respondWith(JSON.stringify(SNAPSHOT)));
    expect(result).toEqual({ kind: 'ready', snapshot: SNAPSHOT });
  });

  it('ζητά το url χωρίς διαπιστευτήρια και με το σήμα ακύρωσης του καλούντα', async () => {
    const fetchImpl = respondWith(JSON.stringify(SNAPSHOT));
    const abortSignal = signal();
    await fetchListingTerrainSnapshot(PUBLISHED_TERRAIN_URL, abortSignal, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith(PUBLISHED_TERRAIN_URL, { signal: abortSignal, credentials: 'omit' });
  });

  it('🔴 άρνηση του αναγνώστη ⇒ refused με τον ΟΝΟΜΑΣΜΕΝΟ λόγο', async () => {
    const body = JSON.stringify({ ...SNAPSHOT, version: SNAPSHOT.version + 1 });
    const result = await fetchListingTerrainSnapshot(PUBLISHED_TERRAIN_URL, signal(), respondWith(body));
    expect(result).toEqual({ kind: 'refused', reason: 'unknown-version' });
  });

  it('🔴 σώμα που δεν είναι JSON ⇒ refused / malformed, ΟΧΙ unreachable', async () => {
    const result = await fetchListingTerrainSnapshot(PUBLISHED_TERRAIN_URL, signal(), respondWith('<html>'));
    expect(result).toEqual({ kind: 'refused', reason: 'malformed' });
  });

  it('🔴 HTTP ≠ 2xx ⇒ unreachable με την κατάσταση', async () => {
    const result = await fetchListingTerrainSnapshot(PUBLISHED_TERRAIN_URL, signal(), respondWith('', 503));
    expect(result).toEqual({ kind: 'unreachable', status: 503 });
  });

  it('σφάλμα δικτύου ⇒ unreachable χωρίς κατάσταση', async () => {
    const failing: FetchLike = jest.fn(async () => { throw new TypeError('Failed to fetch'); });
    const result = await fetchListingTerrainSnapshot(PUBLISHED_TERRAIN_URL, signal(), failing);
    expect(result).toEqual({ kind: 'unreachable', status: null });
  });

  it('🔴 η ακύρωση ΞΑΝΑΠΕΤΙΕΤΑΙ — δεν γίνεται αποτυχία', async () => {
    const controller = new AbortController();
    const aborted = new DOMException('aborted', 'AbortError');
    const fetchImpl: FetchLike = jest.fn(async () => { controller.abort(); throw aborted; });
    await expect(fetchListingTerrainSnapshot(PUBLISHED_TERRAIN_URL, controller.signal, fetchImpl)).rejects.toBe(aborted);
  });
});
