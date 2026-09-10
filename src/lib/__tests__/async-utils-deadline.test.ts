/**
 * @fileoverview **ΜΙΑ ΠΡΟΘΕΣΜΙΑ ΓΙΑ ΟΛΟ ΤΟ ΔΕΝΤΡΟ ΚΛΗΣΕΩΝ** — ADR-332 D27 Β13.
 * @related lib/async-utils.ts (`createDeadline`, `linkedAbortSignal`)
 */

/* global describe, it, expect, beforeEach, afterEach, jest */

import { createDeadline, linkedAbortSignal } from '../async-utils';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('createDeadline — ό,τι απομένει, όχι ένας σταθερός χρόνος ανά στάδιο', () => {
  it('το υπόλοιπο ΜΕΙΩΝΕΤΑΙ με τον χρόνο και δεν γίνεται ποτέ αρνητικό', () => {
    const deadline = createDeadline(1_000);
    expect(deadline.remainingMs()).toBe(1_000);

    jest.advanceTimersByTime(400);
    expect(deadline.remainingMs()).toBe(600);

    jest.advanceTimersByTime(5_000);
    expect(deadline.remainingMs()).toBe(0);
    deadline.dispose();
  });

  it('🔴 το σήμα ακυρώνεται ΣΤΗ ΛΗΞΗ — ούτε νωρίτερα', () => {
    const deadline = createDeadline(1_000);

    jest.advanceTimersByTime(999);
    expect(deadline.signal.aborted).toBe(false);
    jest.advanceTimersByTime(1);
    expect(deadline.signal.aborted).toBe(true);
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: `dispose` κλείνει το χρονόμετρο — καμία ακύρωση μετά', () => {
    const deadline = createDeadline(1_000);
    deadline.dispose();

    jest.advanceTimersByTime(2_000);
    expect(deadline.signal.aborted).toBe(false);
  });
});

describe('linkedAbortSignal — ακυρώνεται μόλις ακυρωθεί ΟΠΟΙΟΔΗΠΟΤΕ', () => {
  it('ο καλών ακυρώνει ⇒ ακυρώνεται', () => {
    const caller = new AbortController();
    const linked = linkedAbortSignal(caller.signal, createDeadline(10_000).signal);

    caller.abort();
    expect(linked.aborted).toBe(true);
  });

  it('η προθεσμία λήγει ⇒ ακυρώνεται', () => {
    const linked = linkedAbortSignal(new AbortController().signal, createDeadline(100).signal);

    jest.advanceTimersByTime(100);
    expect(linked.aborted).toBe(true);
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: ήδη ακυρωμένο ⇒ ακυρωμένο αμέσως · `undefined` αγνοείται', () => {
    const done = new AbortController();
    done.abort();
    expect(linkedAbortSignal(undefined, done.signal).aborted).toBe(true);
    expect(linkedAbortSignal(undefined).aborted).toBe(false);
  });
});
