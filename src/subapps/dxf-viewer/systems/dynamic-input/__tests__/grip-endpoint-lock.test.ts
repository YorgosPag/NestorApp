/**
 * ADR-513 §grip-parity — resolveLineEndpointLockedDelta (line-endpoint length/angle lock).
 * Locks the preview≡commit geometry the grip-drag ring reuses from the draw SSoT.
 */

import { resolveLineEndpointLockedDelta } from '../grip-endpoint-lock';
import { DynamicInputLockStore } from '../DynamicInputLockStore';

const line = { type: 'line', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } };
const END_ANCHOR = { x: 10, y: 0 }; // original dragged endpoint (grip 1 = end)
const cursor = { x: 10, y: 0 };

afterEach(() => DynamicInputLockStore.unlock());

describe('ADR-513 §grip-parity — resolveLineEndpointLockedDelta', () => {
  it('returns null when no lock is active (raw drag path unchanged)', () => {
    expect(resolveLineEndpointLockedDelta(line, 1, null, END_ANCHOR, cursor)).toBeNull();
  });

  it('returns null for a non-line entity', () => {
    DynamicInputLockStore.lockLength(5);
    expect(resolveLineEndpointLockedDelta({ type: 'circle' }, 1, null, END_ANCHOR, cursor)).toBeNull();
  });

  it('returns null for the rotation/move handles (lineGripKind set)', () => {
    DynamicInputLockStore.lockLength(5);
    expect(resolveLineEndpointLockedDelta(line, 3, 'line-rotation', END_ANCHOR, cursor)).toBeNull();
    expect(resolveLineEndpointLockedDelta(line, 4, 'line-move', END_ANCHOR, cursor)).toBeNull();
  });

  it('returns null for the centre/midpoint grip (index 2)', () => {
    DynamicInputLockStore.lockLength(5);
    expect(resolveLineEndpointLockedDelta(line, 2, null, END_ANCHOR, cursor)).toBeNull();
  });

  it('length lock: end moves so length from the fixed start = locked value', () => {
    DynamicInputLockStore.lockLength(5); // fixed = start (0,0); target length 5 along +x
    const delta = resolveLineEndpointLockedDelta(line, 1, null, END_ANCHOR, cursor);
    expect(delta).not.toBeNull();
    // new end = anchor + delta = (10,0) + (-5,0) = (5,0)
    expect(END_ANCHOR.x + delta!.x).toBeCloseTo(5, 6);
    expect(END_ANCHOR.y + delta!.y).toBeCloseTo(0, 6);
  });

  it('angle lock: end rotates to the locked angle about the fixed start', () => {
    DynamicInputLockStore.lockAngle(90); // fixed = start (0,0); dist stays 10, angle → 90°
    const delta = resolveLineEndpointLockedDelta(line, 1, null, END_ANCHOR, cursor);
    expect(delta).not.toBeNull();
    // new end = (10,0) + delta → (0,10)
    expect(END_ANCHOR.x + delta!.x).toBeCloseTo(0, 6);
    expect(END_ANCHOR.y + delta!.y).toBeCloseTo(10, 6);
  });

  it('grip 0 (start) uses the END as the fixed anchor', () => {
    DynamicInputLockStore.lockLength(4); // dragging start; fixed = end (10,0)
    const startAnchor = { x: 0, y: 0 };
    const delta = resolveLineEndpointLockedDelta(line, 0, null, startAnchor, { x: 0, y: 0 });
    expect(delta).not.toBeNull();
    // new start = (0,0)+delta → length 4 from end (10,0) along end→start (−x) = (6,0)
    expect(startAnchor.x + delta!.x).toBeCloseTo(6, 6);
    expect(startAnchor.y + delta!.y).toBeCloseTo(0, 6);
  });
});
