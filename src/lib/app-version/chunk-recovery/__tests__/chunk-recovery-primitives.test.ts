/**
 * ADR-860 §Ε3 — τα καθαρά δομικά στοιχεία της ανάκαμψης: ταξινόμηση, backoff, κρίση skew,
 * φρουρός ανανέωσης, μητρώο μη αποθηκευμένης δουλειάς.
 */

import { chunkRequestOf, isChunkLoadError } from '../chunk-load-error';
import { CHUNK_RETRY_POLICY, retryDelayMs } from '../retry-policy';
import { judgeSkew } from '../skew-probe';

describe('isChunkLoadError — μόνο τα σχήματα των φορτωτών (ADR-858)', () => {
  const js = (fields: Record<string, unknown>) =>
    Object.assign(new Error('Loading chunk 84130 failed.'), { name: 'ChunkLoadError', ...fields });

  test.each(['missing', 'timeout', 'error'])('JS με type=%s ⇒ φόρτωση', (type) => {
    expect(isChunkLoadError(js({ type }))).toBe(true);
  });

  test('JS με request αλλά χωρίς γνωστό type ⇒ φόρτωση', () => {
    expect(isChunkLoadError(js({ request: 'https://x/a.js' }))).toBe(true);
  });

  test('CSS του mini-css-extract (name=Error, code=CSS_CHUNK_LOAD_FAILED) ⇒ φόρτωση', () => {
    const css = Object.assign(new Error('Loading CSS chunk 7 failed.'), {
      code: 'CSS_CHUNK_LOAD_FAILED',
      request: 'https://x/_next/static/css/7.css',
    });
    expect(isChunkLoadError(css)).toBe(true);
    expect(chunkRequestOf(css)).toBe('https://x/_next/static/css/7.css');
  });

  test('ReferenceError/TDZ ⇒ ΟΧΙ φόρτωση, ακόμα κι αν το μήνυμα θυμίζει', () => {
    expect(isChunkLoadError(new ReferenceError("Cannot access 'o' before initialization"))).toBe(false);
    expect(isChunkLoadError(new Error('Loading chunk 1 failed.'))).toBe(false);
  });

  test('χειροποίητο name=ChunkLoadError χωρίς δομικά πεδία ⇒ ΟΧΙ', () => {
    expect(isChunkLoadError(js({}))).toBe(false);
    expect(isChunkLoadError('ChunkLoadError')).toBe(false);
  });
});

describe('retryDelayMs — εκθετικό backoff με jitter', () => {
  test('μέσα στο [ceiling/2, ceiling] για κάθε βήμα', () => {
    for (let attempt = 0; attempt < CHUNK_RETRY_POLICY.maxRetries; attempt++) {
      const ceiling = Math.min(
        CHUNK_RETRY_POLICY.maxDelayMs,
        CHUNK_RETRY_POLICY.baseDelayMs * CHUNK_RETRY_POLICY.factor ** attempt,
      );
      expect(retryDelayMs(attempt, CHUNK_RETRY_POLICY, () => 0)).toBe(Math.round(ceiling / 2));
      expect(retryDelayMs(attempt, CHUNK_RETRY_POLICY, () => 1)).toBe(ceiling);
    }
  });

  test('ποτέ πάνω από την οροφή', () => {
    expect(retryDelayMs(50, CHUNK_RETRY_POLICY, () => 1)).toBe(CHUNK_RETRY_POLICY.maxDelayMs);
  });
});

describe('judgeSkew — το «άγνωστο» δεν γίνεται ποτέ «διαφορετικό»', () => {
  test('διαφορετικές εκδόσεις ⇒ skewed με την έκδοση του server', () => {
    expect(judgeSkew('a', 'b')).toEqual({ kind: 'skewed', serverDeploymentId: 'b' });
  });

  test('ίδια ⇒ same', () => {
    expect(judgeSkew('a', 'a')).toEqual({ kind: 'same' });
  });

  test.each([
    [null, 'b'],
    ['a', null],
    [null, null],
  ])('client=%p server=%p ⇒ unknown (τοπικό build ΔΕΝ βλέπει skew παντού)', (client, server) => {
    expect(judgeSkew(client, server)).toEqual({ kind: 'unknown' });
  });
});

describe('claimReloadFor — μία ανανέωση ανά έκδοση', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    jest.resetModules();
  });

  test('πρώτη διεκδίκηση ⇒ true· δεύτερη στην ίδια σελίδα ⇒ false (ταυτόχρονες αποτυχίες)', () => {
    const guard = require('../reload-guard') as typeof import('../reload-guard');
    expect(guard.claimReloadFor('sha-1')).toBe(true);
    expect(guard.isReloadPending()).toBe(true);
    expect(guard.claimReloadFor('sha-1')).toBe(false);
  });

  test('μετά την ανανέωση (νέα σελίδα, ίδια καρτέλα) ίδια έκδοση ⇒ false: ο βρόχος είναι αδύνατος', () => {
    (require('../reload-guard') as typeof import('../reload-guard')).claimReloadFor('sha-1');
    jest.resetModules(); // «νέα σελίδα»: η μνήμη του module χάνεται, το sessionStorage μένει
    const afterReload = require('../reload-guard') as typeof import('../reload-guard');
    expect(afterReload.claimReloadFor('sha-1')).toBe(false);
    expect(afterReload.claimReloadFor('sha-2')).toBe(true);
  });

  test('χωρίς διαθέσιμο sessionStorage ⇒ ΚΑΜΙΑ ανανέωση (χωρίς μνήμη δεν τηρείται το «μία φορά»)', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    try {
      const guard = require('../reload-guard') as typeof import('../reload-guard');
      expect(guard.claimReloadFor('sha-1')).toBe(false);
      expect(guard.isReloadPending()).toBe(false);
    } finally {
      setItem.mockRestore();
    }
  });
});

describe('unsaved-work-registry — ιδιοκτήτες, όχι μετρητής', () => {
  beforeEach(() => jest.resetModules());

  test('διπλό clear του ίδιου ιδιοκτήτη δεν «καθαρίζει» άλλον', () => {
    const registry = require('../../unsaved-work-registry') as typeof import('../../unsaved-work-registry');
    registry.markUnsavedWork('form-a');
    registry.markUnsavedWork('form-b');
    registry.clearUnsavedWork('form-a');
    registry.clearUnsavedWork('form-a');
    expect(registry.hasUnsavedWork()).toBe(true);
    registry.clearUnsavedWork('form-b');
    expect(registry.hasUnsavedWork()).toBe(false);
  });

  test('ειδοποιεί μόνο σε πραγματική αλλαγή', () => {
    const registry = require('../../unsaved-work-registry') as typeof import('../../unsaved-work-registry');
    const listener = jest.fn();
    const unsubscribe = registry.subscribeUnsavedWork(listener);
    registry.markUnsavedWork('x');
    registry.markUnsavedWork('x');
    registry.clearUnsavedWork('x');
    registry.clearUnsavedWork('x');
    unsubscribe();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
