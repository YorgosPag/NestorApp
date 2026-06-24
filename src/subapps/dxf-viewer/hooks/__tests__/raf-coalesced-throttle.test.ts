/**
 * Tests for createRafCoalescedThrottle (ADR-516 zero-lag shared throttle).
 * Verifies leading-edge apply, trailing-frame flush of the LATEST payload,
 * coalescing, window reset, and cancel — the guarantees the drag/grip ghost
 * relies on to follow the cursor without lag or dropped frames.
 */
import { createRafCoalescedThrottle } from '../raf-coalesced-throttle';

describe('createRafCoalescedThrottle', () => {
  /** Deterministic harness: manual clock + manual single-slot RAF queue. */
  function makeHarness(throttleMs = 16) {
    let clock = 1000;
    let nextId = 1;
    const rafQueue = new Map<number, () => void>();

    const throttle = createRafCoalescedThrottle(throttleMs, {
      now: () => clock,
      raf: (cb) => {
        const id = nextId++;
        rafQueue.set(id, cb);
        return id;
      },
      cancelRaf: (id) => {
        rafQueue.delete(id);
      },
    });

    return {
      throttle,
      advance: (ms: number) => { clock += ms; },
      /** Flush all queued frames (simulates the browser firing rAF). */
      flushFrames: () => {
        const cbs = [...rafQueue.values()];
        rafQueue.clear();
        cbs.forEach((cb) => cb());
      },
      pendingFrames: () => rafQueue.size,
    };
  }

  it('applies the first call immediately (leading edge)', () => {
    const h = makeHarness();
    const apply = jest.fn();
    h.throttle.run(apply);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(h.pendingFrames()).toBe(0);
  });

  it('defers a call inside the window to a single trailing frame', () => {
    const h = makeHarness(16);
    const first = jest.fn();
    const second = jest.fn();

    h.throttle.run(first);   // leading — immediate
    h.advance(5);            // still inside the 16ms window
    h.throttle.run(second);  // deferred

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    expect(h.pendingFrames()).toBe(1);

    h.flushFrames();
    expect(second).toHaveBeenCalledTimes(1); // latest flushed on the frame
  });

  it('coalesces multiple in-window calls and flushes only the LATEST', () => {
    const h = makeHarness(16);
    const a = jest.fn();
    const b = jest.fn();
    const c = jest.fn();

    h.throttle.run(a);  // leading
    h.advance(2);
    h.throttle.run(b);  // deferred (parked)
    h.advance(2);
    h.throttle.run(c);  // replaces parked b

    expect(h.pendingFrames()).toBe(1); // a single frame for all in-window calls
    h.flushFrames();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled(); // b was superseded — never dropped silently, latest wins
    expect(c).toHaveBeenCalledTimes(1);
  });

  it('applies immediately again once the window has elapsed', () => {
    const h = makeHarness(16);
    const first = jest.fn();
    const second = jest.fn();

    h.throttle.run(first);
    h.advance(20); // beyond the window
    h.throttle.run(second);

    expect(second).toHaveBeenCalledTimes(1);
    expect(h.pendingFrames()).toBe(0); // no trailing frame needed
  });

  it('resets the window after a trailing flush', () => {
    const h = makeHarness(16);
    const a = jest.fn();
    const b = jest.fn();
    const c = jest.fn();

    h.throttle.run(a);   // leading at t=1000
    h.advance(5);
    h.throttle.run(b);   // deferred
    h.flushFrames();     // flush at t=1005 → lastTime becomes 1005
    h.advance(5);        // t=1010, only 5ms since flush
    h.throttle.run(c);   // should defer again, not apply immediately

    expect(c).not.toHaveBeenCalled();
    expect(h.pendingFrames()).toBe(1);
  });

  it('cancel() drops the pending trailing frame', () => {
    const h = makeHarness(16);
    const first = jest.fn();
    const deferred = jest.fn();

    h.throttle.run(first);
    h.advance(3);
    h.throttle.run(deferred);
    expect(h.pendingFrames()).toBe(1);

    h.throttle.cancel();
    expect(h.pendingFrames()).toBe(0);

    h.flushFrames();
    expect(deferred).not.toHaveBeenCalled();
  });
});
