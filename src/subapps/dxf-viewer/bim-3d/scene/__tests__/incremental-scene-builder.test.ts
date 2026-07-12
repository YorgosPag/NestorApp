/**
 * incremental-scene-builder.test.ts — ADR-645 Φάση A.
 *
 * Drives the time-sliced runner with a FAKE scheduler + FAKE clock (no real rAF / no
 * `performance.now`), so budget slicing, progress, completion and cancellation are all
 * deterministic and jest-verifiable.
 */

import { runIncrementalBuild, type IncrementalBuildDeps } from '../incremental-scene-builder';

/** Fake single-slot scheduler + manual clock. One pending frame at a time (matches OneShot id de-dupe). */
function makeHarness() {
  let pending: (() => void) | null = null;
  let time = 0;
  const deps: IncrementalBuildDeps = {
    scheduleFrame: (_id, cb) => { pending = cb; },
    cancelFrame: () => { pending = null; },
    now: () => time,
  };
  return {
    deps,
    advance: (ms: number) => { time += ms; },
    /** Run the currently pending frame callback (if any). */
    tick: () => { const cb = pending; pending = null; cb?.(); },
    hasPending: () => pending !== null,
    /** Run frames until none is pending (or a safety cap is hit). */
    drain: (max = 1000) => {
      let n = 0;
      while (pending !== null && n < max) { const cb = pending; pending = null; cb?.(); n++; }
      return n;
    },
  };
}

describe('runIncrementalBuild', () => {
  it('processes every item in order and completes once (cheap items → single frame)', () => {
    const h = makeHarness();
    const processed: number[] = [];
    const onComplete = jest.fn();
    const handle = runIncrementalBuild(
      { id: 't', total: 100, processItem: (i) => processed.push(i), onComplete },
      h.deps,
    );

    // Clock never advances (cheap work) ⇒ the whole build finishes in one frame.
    const frames = h.drain();
    expect(frames).toBe(1);
    expect(processed).toHaveLength(100);
    expect(processed[0]).toBe(0);
    expect(processed[99]).toBe(99);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(handle.isDone()).toBe(true);
    expect(h.hasPending()).toBe(false);
  });

  it('yields across frames when the frame budget is exceeded', () => {
    const h = makeHarness();
    const processed: number[] = [];
    const progress: number[] = [];
    const onComplete = jest.fn();
    // Each item costs 3ms; budget 8ms, chunk 1 ⇒ 3 items per frame (3,6,9→break).
    runIncrementalBuild(
      {
        id: 't', total: 10, frameBudgetMs: 8, chunkSize: 1,
        processItem: (i) => { processed.push(i); h.advance(3); },
        onFrameProcessed: (done) => progress.push(done),
        onComplete,
      },
      h.deps,
    );

    const frames = h.drain();
    expect(frames).toBe(4); // 3 + 3 + 3 + 1
    expect(processed).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(progress).toEqual([3, 6, 9, 10]);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('cancel() stops further processing and fires onCancelled once (no onComplete)', () => {
    const h = makeHarness();
    const processed: number[] = [];
    const onComplete = jest.fn();
    const onCancelled = jest.fn();
    const handle = runIncrementalBuild(
      {
        id: 't', total: 10, frameBudgetMs: 8, chunkSize: 1,
        processItem: (i) => { processed.push(i); h.advance(3); },
        onComplete, onCancelled,
      },
      h.deps,
    );

    h.tick(); // first frame → 3 items
    expect(processed).toEqual([0, 1, 2]);

    handle.cancel();
    expect(onCancelled).toHaveBeenCalledTimes(1);
    expect(handle.isCancelled()).toBe(true);
    expect(h.hasPending()).toBe(false); // the scheduled next frame was cancelled

    handle.cancel(); // idempotent
    expect(onCancelled).toHaveBeenCalledTimes(1);

    h.drain(); // nothing left to run
    expect(processed).toEqual([0, 1, 2]);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('total <= 0 completes on the first frame with no processItem calls', () => {
    const h = makeHarness();
    const processItem = jest.fn();
    const onComplete = jest.fn();
    const onFrameProcessed = jest.fn();
    runIncrementalBuild({ id: 't', total: 0, processItem, onComplete, onFrameProcessed }, h.deps);

    h.drain();
    expect(processItem).not.toHaveBeenCalled();
    expect(onFrameProcessed).toHaveBeenCalledWith(0, 0);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('honours chunkSize (clock read every N items, so a batch can overshoot by <chunk)', () => {
    const h = makeHarness();
    const processed: number[] = [];
    // chunk 5, budget 8, each item 3ms: process 5 (clock 15 ≥ 8) then break ⇒ 5 per frame.
    runIncrementalBuild(
      {
        id: 't', total: 12, frameBudgetMs: 8, chunkSize: 5,
        processItem: (i) => { processed.push(i); h.advance(3); },
      },
      h.deps,
    );

    h.tick();
    expect(processed).toEqual([0, 1, 2, 3, 4]); // one whole chunk before the clock check
    h.tick();
    expect(processed).toHaveLength(10);
    h.tick();
    expect(processed).toHaveLength(12);
  });
});
