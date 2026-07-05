/**
 * ADR-513 §grip-parity — GRIP_LINEAR_RING_CONFIG (endpoint-extend ring layout).
 * Verifies it reuses the SHARED length/angle builders (zero new mechanism) and
 * carries NO linetype field (draw-default concept, wrong for editing an entity).
 */

import { GRIP_LINEAR_RING_CONFIG } from '../grip-linear-ring-config';
import { DynamicInputLockStore } from '../DynamicInputLockStore';

describe('ADR-513 §grip-parity — GRIP_LINEAR_RING_CONFIG', () => {
  it('has exactly Length + Angle in order (→ 2 ίσες φέτες/ημικύκλια), no linetype', () => {
    const keys = GRIP_LINEAR_RING_CONFIG.fields.map((f) => f.key);
    expect(keys).toEqual(['length', 'angle']); // σειρά = φέτα (computeRingSlices)
    expect(keys).not.toContain('linetype');
  });

  it('uses the endpoint aria label + numeric fields', () => {
    expect(GRIP_LINEAR_RING_CONFIG.ariaLabelKey).toBe('tools.ring.endpointLabel');
    for (const f of GRIP_LINEAR_RING_CONFIG.fields) expect(f.kind).toBe('numeric');
  });

  it('length/angle commit into the SHARED DynamicInputLockStore (same SSoT as draw)', () => {
    const byKey = new Map(GRIP_LINEAR_RING_CONFIG.fields.map((f) => [f.key, f]));
    const ctx = { displayUnit: 'mm' as const, sceneUnits: 'mm' as const };
    byKey.get('length')?.commitNumeric?.(1234, ctx);
    expect(DynamicInputLockStore.getLocked().length).not.toBeNull();
    byKey.get('angle')?.commitNumeric?.(45, ctx);
    expect(DynamicInputLockStore.getLocked().angle).toBeCloseTo(45, 6);
    DynamicInputLockStore.unlock();
  });

  it('subscribe wires to a store (re-render on lock change)', () => {
    let fired = 0;
    const unsub = GRIP_LINEAR_RING_CONFIG.subscribe(() => { fired += 1; });
    DynamicInputLockStore.lockLength(10);
    expect(fired).toBeGreaterThan(0);
    unsub();
    DynamicInputLockStore.unlock();
  });
});
