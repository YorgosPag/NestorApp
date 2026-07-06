/**
 * ADR-513 §rotation-ring — RotationRingStore (bridge: rotate-free session + typed rotation angle).
 * Verifies the two-field lifecycle (session gate ⊕ locked angle) + observer notifications, so the
 * `DynamicInputSubscriber` mount gate and the `useUnifiedGripInteraction` typed-angle feed stay honest.
 */

import { RotationRingStore } from '../rotation-ring-store';

describe('ADR-513 §rotation-ring — RotationRingStore', () => {
  afterEach(() => RotationRingStore.endSession()); // → initial state (inactive, no angle)

  it('starts inactive with no locked angle', () => {
    expect(RotationRingStore.isSessionActive()).toBe(false);
    expect(RotationRingStore.getLockedDeg()).toBeNull();
  });

  it('beginSession activates the mount gate (idempotent) without touching the angle', () => {
    RotationRingStore.lock(30);
    RotationRingStore.beginSession();
    RotationRingStore.beginSession();
    expect(RotationRingStore.isSessionActive()).toBe(true);
    expect(RotationRingStore.getLockedDeg()).toBe(30); // begin keeps any pre-set angle
  });

  it('lock stores the raw signed angle (no normalize — parity with keyboard DDE)', () => {
    RotationRingStore.lock(-45);
    expect(RotationRingStore.getLockedDeg()).toBe(-45);
    RotationRingStore.lock(450);
    expect(RotationRingStore.getLockedDeg()).toBe(450);
  });

  it('clearAngle drops the angle but keeps the session active', () => {
    RotationRingStore.beginSession();
    RotationRingStore.lock(90);
    RotationRingStore.clearAngle();
    expect(RotationRingStore.getLockedDeg()).toBeNull();
    expect(RotationRingStore.isSessionActive()).toBe(true);
  });

  it('endSession clears BOTH the session gate and the angle', () => {
    RotationRingStore.beginSession();
    RotationRingStore.lock(15);
    RotationRingStore.endSession();
    expect(RotationRingStore.isSessionActive()).toBe(false);
    expect(RotationRingStore.getLockedDeg()).toBeNull();
  });

  it('notifies subscribers on begin / lock / clear / end, and dedupes identical writes', () => {
    let fired = 0;
    const unsub = RotationRingStore.subscribe(() => { fired += 1; });
    RotationRingStore.beginSession();      // change → notify
    RotationRingStore.lock(60);            // change → notify
    RotationRingStore.lock(60);            // identical → no notify (equals guard)
    RotationRingStore.clearAngle();        // change → notify
    RotationRingStore.clearAngle();        // already null → no notify
    RotationRingStore.endSession();        // change → notify
    expect(fired).toBe(4);
    unsub();
  });
});
