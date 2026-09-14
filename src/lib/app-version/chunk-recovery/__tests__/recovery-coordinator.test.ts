/**
 * ADR-860 §Ε3 — η μηχανή ανάκαμψης: κάθε κλάδος του διαγράμματος, με εγχυμένες εξαρτήσεις.
 *
 * Οι δύο υποσχέσεις που μετρούν περισσότερο:
 *   • ΠΟΤΕ δεύτερη ανανέωση για την ίδια έκδοση (βρόχος δομικά αδύνατος)·
 *   • ΠΟΤΕ ανανέωση πάνω σε μη αποθηκευμένη δουλειά.
 * Και η τρίτη, από το ADR-858: ό,τι δεν είναι φόρτωση περνά ΑΚΕΡΑΙΟ.
 */

import { recoverChunkLoad, type RecoveryDeps, type RecoveryOutcome } from '../recovery-coordinator';
import type { ChunkLoadError } from '../chunk-load-error';
import type { SkewVerdict } from '../skew-probe';

function chunkError(n = 1): ChunkLoadError {
  return Object.assign(new Error(`Loading chunk ${n} failed.`), {
    name: 'ChunkLoadError',
    type: 'missing',
    request: `https://x/_next/static/chunks/${n}.js`,
  });
}

interface Harness {
  readonly deps: RecoveryDeps<string>;
  readonly outcomes: RecoveryOutcome[];
  readonly reload: jest.Mock;
  readonly announceUpdate: jest.Mock;
  readonly load: jest.Mock;
}

function harness(overrides: Partial<RecoveryDeps<string>> & { verdict?: SkewVerdict } = {}): Harness {
  const outcomes: RecoveryOutcome[] = [];
  const reload = jest.fn();
  const announceUpdate = jest.fn();
  const load = jest.fn(() => Promise.reject(chunkError()));
  let pending = false;
  const claimed = new Set<string>();
  const deps: RecoveryDeps<string> = {
    load,
    maxRetries: 3,
    delayFor: () => 0,
    sleep: () => Promise.resolve(),
    probe: () => Promise.resolve(overrides.verdict ?? { kind: 'unknown' }),
    hasUnsavedWork: () => false,
    claimReloadFor: (id) => {
      if (pending || claimed.has(id)) return false;
      claimed.add(id);
      pending = true;
      return true;
    },
    isReloadPending: () => pending,
    reload,
    announceUpdate,
    report: (outcome) => outcomes.push(outcome),
    ...overrides,
  };
  return { deps, outcomes, reload, announceUpdate, load };
}

/** Η υπόσχεση «η σελίδα φεύγει» δεν τελειώνει ποτέ — ελέγχουμε ότι δεν τελείωσε. */
async function settlesWithin(promise: Promise<unknown>): Promise<boolean> {
  let settled = false;
  promise.then(() => (settled = true), () => (settled = true));
  await new Promise((r) => setTimeout(r, 10));
  return settled;
}

describe('recoverChunkLoad', () => {
  test('προσωρινό δίκτυο: 2 αποτυχίες και επιτυχία ⇒ recovered-by-retry, καμία ανανέωση', async () => {
    const h = harness();
    h.load.mockRejectedValueOnce(chunkError()).mockRejectedValueOnce(chunkError()).mockResolvedValueOnce('module');

    await expect(recoverChunkLoad(chunkError(), h.deps)).resolves.toBe('module');
    expect(h.outcomes).toEqual(['recovered-by-retry']);
    expect(h.reload).not.toHaveBeenCalled();
    expect(h.load).toHaveBeenCalledTimes(3);
  });

  test('skew χωρίς μη αποθηκευμένη δουλειά ⇒ ΜΙΑ ανανέωση και η σελίδα περιμένει να φύγει', async () => {
    const h = harness({ verdict: { kind: 'skewed', serverDeploymentId: 'sha-new' } });

    const pending = recoverChunkLoad(chunkError(), h.deps);
    expect(await settlesWithin(pending)).toBe(false);
    expect(h.reload).toHaveBeenCalledTimes(1);
    expect(h.outcomes).toEqual(['reloaded-for-skew']);
  });

  test('ταυτόχρονες αποτυχίες μετά από deploy ⇒ ακριβώς ΜΙΑ ανανέωση, καμία οθόνη σφάλματος', async () => {
    const h = harness({ verdict: { kind: 'skewed', serverDeploymentId: 'sha-new' } });

    const all = [1, 2, 3].map((n) => recoverChunkLoad(chunkError(n), h.deps));
    const settled = await Promise.all(all.map(settlesWithin));
    expect(settled).toEqual([false, false, false]);
    expect(h.reload).toHaveBeenCalledTimes(1);
  });

  test('η ανανέωση ΔΕΝ το έλυσε (ίδιος server id) ⇒ καμία δεύτερη, το σφάλμα φτάνει στο UI', async () => {
    const claimed = new Set(['sha-new']);
    const h = harness({
      verdict: { kind: 'skewed', serverDeploymentId: 'sha-new' },
      claimReloadFor: (id) => !claimed.has(id),
      isReloadPending: () => false,
    });

    await expect(recoverChunkLoad(chunkError(), h.deps)).rejects.toMatchObject({ name: 'ChunkLoadError' });
    expect(h.reload).not.toHaveBeenCalled();
    expect(h.outcomes).toEqual(['failed-already-reloaded']);
  });

  test('skew ΜΕ μη αποθηκευμένη δουλειά ⇒ banner, ΠΟΤΕ ανανέωση', async () => {
    const h = harness({
      verdict: { kind: 'skewed', serverDeploymentId: 'sha-new' },
      hasUnsavedWork: () => true,
    });

    await expect(recoverChunkLoad(chunkError(), h.deps)).rejects.toMatchObject({ name: 'ChunkLoadError' });
    expect(h.reload).not.toHaveBeenCalled();
    expect(h.announceUpdate).toHaveBeenCalledWith('sha-new');
    expect(h.outcomes).toEqual(['deferred-unsaved']);
  });

  test('ίδια έκδοση ⇒ failed-same-version, καμία ανανέωση', async () => {
    const h = harness({ verdict: { kind: 'same' } });

    await expect(recoverChunkLoad(chunkError(), h.deps)).rejects.toMatchObject({ name: 'ChunkLoadError' });
    expect(h.reload).not.toHaveBeenCalled();
    expect(h.outcomes).toEqual(['failed-same-version']);
  });

  test('άγνωστη έκδοση (δίκτυο κάτω) ⇒ ΠΟΤΕ ανανέωση — θα άφηνε λευκή σελίδα του browser', async () => {
    const h = harness({ verdict: { kind: 'unknown' } });

    await expect(recoverChunkLoad(chunkError(), h.deps)).rejects.toMatchObject({ name: 'ChunkLoadError' });
    expect(h.reload).not.toHaveBeenCalled();
    expect(h.outcomes).toEqual(['failed-network']);
  });

  test('ADR-858: σφάλμα που ΔΕΝ είναι φόρτωση κατά την επανάληψη ⇒ περνά ακέραιο, χωρίς probe', async () => {
    const tdz = new ReferenceError("Cannot access 'o' before initialization");
    const probe = jest.fn();
    const h = harness({ probe });
    h.load.mockRejectedValueOnce(tdz);

    await expect(recoverChunkLoad(chunkError(), h.deps)).rejects.toBe(tdz);
    expect(probe).not.toHaveBeenCalled();
    expect(h.outcomes).toEqual([]);
  });

  test('πετά το ΤΕΛΕΥΤΑΙΟ σφάλμα του φορτωτή αυτούσιο, όχι περιτύλιγμα', async () => {
    const last = chunkError(99);
    const h = harness({ verdict: { kind: 'same' } });
    h.load.mockRejectedValueOnce(chunkError(2)).mockRejectedValueOnce(chunkError(3)).mockRejectedValueOnce(last);

    await expect(recoverChunkLoad(chunkError(1), h.deps)).rejects.toBe(last);
  });
});
