/**
 * Tests for the modal-presence SSoT store (ADR-040 cursor-lag Φ6).
 */

import {
  getIsModalOpen,
  subscribeModalPresence,
  __scanForTest,
  __setModalOpenForTest,
  __resetForTest,
} from '../ModalPresenceStore';

function makeModalOverlay(zIndex = '10000'): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'fixed inset-0';
  el.style.zIndex = zIndex;
  document.body.appendChild(el);
  return el;
}

describe('ModalPresenceStore', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    __resetForTest();
  });

  it('starts closed', () => {
    expect(getIsModalOpen()).toBe(false);
  });

  it('detects an open modal on scan', () => {
    makeModalOverlay();
    __scanForTest();
    expect(getIsModalOpen()).toBe(true);
  });

  it('clears when the modal is removed and re-scanned', () => {
    const el = makeModalOverlay();
    __scanForTest();
    expect(getIsModalOpen()).toBe(true);
    el.remove();
    __scanForTest();
    expect(getIsModalOpen()).toBe(false);
  });

  it('notifies subscribers only on state change', () => {
    const cb = jest.fn();
    const unsub = subscribeModalPresence(cb);
    cb.mockClear(); // subscribe runs an initial scan

    __setModalOpenForTest(true);
    expect(cb).toHaveBeenCalledTimes(1);

    // Same value → no extra notification (skip-if-unchanged).
    __setModalOpenForTest(true);
    expect(cb).toHaveBeenCalledTimes(1);

    __setModalOpenForTest(false);
    expect(cb).toHaveBeenCalledTimes(2);

    unsub();
  });

  it('runs an initial scan on first subscribe', () => {
    makeModalOverlay();
    const unsub = subscribeModalPresence(() => undefined);
    expect(getIsModalOpen()).toBe(true);
    unsub();
  });

  it('detaches the observer and resets when the last subscriber unsubscribes', () => {
    makeModalOverlay();
    const unsub = subscribeModalPresence(() => undefined);
    expect(getIsModalOpen()).toBe(true);
    unsub();
    expect(getIsModalOpen()).toBe(false);
  });

  it('fires the observer on a direct body childList change', async () => {
    const cb = jest.fn();
    const unsub = subscribeModalPresence(cb);
    cb.mockClear();

    makeModalOverlay(); // direct child of body → observer should fire
    // MutationObserver callbacks are microtask-async.
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(getIsModalOpen()).toBe(true);
    expect(cb).toHaveBeenCalled();
    unsub();
  });
});
