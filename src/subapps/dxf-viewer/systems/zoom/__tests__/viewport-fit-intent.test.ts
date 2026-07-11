/**
 * viewport-fit-intent SSoT unit tests (Giorgio 2026-07-11, ADR-399).
 *
 * Locks the one-shot «this auto-fit was a user import → fit-to-extents» flag:
 * one writer (import paths), one reader (the single auto-fit controller),
 * consume-once so a re-render during the deferred fit never re-triggers it.
 */

import {
  markFreshImportFit,
  consumeFreshImportFit,
  __resetFreshImportFit,
} from '../viewport-fit-intent';

describe('viewport-fit-intent', () => {
  beforeEach(() => __resetFreshImportFit());

  it('defaults to not-pending (a plain reload never fits)', () => {
    expect(consumeFreshImportFit()).toBe(false);
  });

  it('mark → consume returns true exactly once, then clears', () => {
    markFreshImportFit();
    expect(consumeFreshImportFit()).toBe(true);
    // consume-once: a re-render during the deferred fit must NOT re-trigger.
    expect(consumeFreshImportFit()).toBe(false);
  });

  it('re-marking after a consume arms it again (a second import fits again)', () => {
    markFreshImportFit();
    expect(consumeFreshImportFit()).toBe(true);
    markFreshImportFit();
    expect(consumeFreshImportFit()).toBe(true);
  });

  it('is idempotent — marking twice still consumes as a single true', () => {
    markFreshImportFit();
    markFreshImportFit();
    expect(consumeFreshImportFit()).toBe(true);
    expect(consumeFreshImportFit()).toBe(false);
  });
});
