/**
 * Tests for the devicePixelRatio-change SSoT (ADR-549 Phase 7). Verifies the re-arming
 * matchMedia mechanism: notify on change, no-op when unchanged, re-arm, and teardown.
 */

import { subscribeDevicePixelRatio } from '../device-pixel-ratio';

describe('subscribeDevicePixelRatio', () => {
  let changeHandlers: Array<() => void>;
  let removeCount: number;
  const origMatchMedia = window.matchMedia;
  const origDpr = window.devicePixelRatio;

  const setDpr = (v: number) =>
    Object.defineProperty(window, 'devicePixelRatio', { value: v, configurable: true, writable: true });

  beforeEach(() => {
    changeHandlers = [];
    removeCount = 0;
    setDpr(1);
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: true,
      media: '',
      addEventListener: (_type: string, cb: () => void) => changeHandlers.push(cb),
      removeEventListener: () => { removeCount++; },
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = origMatchMedia;
    setDpr(origDpr);
    jest.clearAllMocks();
  });

  const fireLatest = () => changeHandlers[changeHandlers.length - 1]?.();

  it('notifies subscribers with the new dpr on change and re-arms a fresh query', () => {
    const cb = jest.fn();
    const unsub = subscribeDevicePixelRatio(cb);
    expect(window.matchMedia).toHaveBeenCalledTimes(1); // armed on first subscriber

    setDpr(2);
    fireLatest();

    expect(cb).toHaveBeenCalledWith(2);
    expect(window.matchMedia).toHaveBeenCalledTimes(2); // re-armed for the new dpr
    unsub();
  });

  it('does not notify when the ratio is unchanged', () => {
    const cb = jest.fn();
    const unsub = subscribeDevicePixelRatio(cb);
    fireLatest(); // dpr still 1
    expect(cb).not.toHaveBeenCalled();
    unsub();
  });

  it('tears down the media query after the last unsubscribe', () => {
    const unsub = subscribeDevicePixelRatio(jest.fn());
    unsub();
    expect(removeCount).toBeGreaterThanOrEqual(1);
  });

  it('fans out one change to multiple subscribers', () => {
    const a = jest.fn();
    const b = jest.fn();
    const ua = subscribeDevicePixelRatio(a);
    const ub = subscribeDevicePixelRatio(b);
    setDpr(1.5);
    fireLatest();
    expect(a).toHaveBeenCalledWith(1.5);
    expect(b).toHaveBeenCalledWith(1.5);
    ua();
    ub();
  });
});
