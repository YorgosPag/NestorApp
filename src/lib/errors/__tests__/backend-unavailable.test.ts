/**
 * Το SSoT της δηλωμένης αδυναμίας backend — το `digest` είναι συμβόλαιο με ΔΥΟ αναγνώστες:
 * το error boundary (`RouteErrorFallback`) και τον χρησμό (`scripts/lib/i18n-ssr/backend-contract.js`).
 */

import {
  BACKEND_DEPENDENCIES,
  BACKEND_UNAVAILABLE_DIGEST_PREFIX,
  BackendUnavailableError,
  isBackendUnavailableDigest,
  throwBackendUnavailable,
} from '../backend-unavailable';

describe('BackendUnavailableError', () => {
  it.each(BACKEND_DEPENDENCIES)('«%s» ⇒ digest `ΠΡΟΘΕΜΑ:εξάρτηση` που αναγνωρίζει ο διακόπτης', (dependency) => {
    const error = new BackendUnavailableError(dependency);
    expect(error.digest).toBe(`${BACKEND_UNAVAILABLE_DIGEST_PREFIX}:${dependency}`);
    expect(error.dependency).toBe(dependency);
    expect(isBackendUnavailableDigest(error.digest)).toBe(true);
  });

  it('το throwBackendUnavailable ρίχνει ΑΥΤΟ το σφάλμα (όχι γενικό Error χωρίς digest)', () => {
    expect(() => throwBackendUnavailable('agency-profile')).toThrow(BackendUnavailableError);
  });

  it('το πρόθεμα είναι [A-Z_]+ — ο χρησμός το βάζει ΑΥΤΟΥΣΙΟ σε RegExp', () => {
    expect(BACKEND_UNAVAILABLE_DIGEST_PREFIX).toMatch(/^[A-Z_]+$/);
  });
});

describe('isBackendUnavailableDigest', () => {
  it('ανέχεται κωδικό σφάλματος του Next μετά από `@` (createDigestWithErrorCode)', () => {
    expect(isBackendUnavailableDigest(`${BACKEND_UNAVAILABLE_DIGEST_PREFIX}:workspace-lookup@E394`)).toBe(true);
  });

  it.each([undefined, '', '1234567890', 'NEXT_NOT_FOUND', BACKEND_UNAVAILABLE_DIGEST_PREFIX])(
    'απορρίπτει «%s» — ένα crash ΔΕΝ δείχνει ποτέ την οθόνη «προσωρινά μη διαθέσιμο»',
    (digest) => {
      expect(isBackendUnavailableDigest(digest)).toBe(false);
    },
  );
});
