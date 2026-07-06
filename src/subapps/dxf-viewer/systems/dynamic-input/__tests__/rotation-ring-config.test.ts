/**
 * ADR-513 §rotation-ring — ROTATION_RING_CONFIG (single-slice «Γωνία» ring layout).
 * Verifies it exposes EXACTLY one numeric «Γωνία» field (→ whole disc = 1 slice) that commits
 * into the RotationRingStore bridge (zero new override/lock geometry — the typed-angle SSoT feed).
 */

import { ROTATION_RING_CONFIG } from '../rotation-ring-config';
import { RotationRingStore } from '../rotation-ring-store';
import { computeRingSlices } from '../radial-ring-logic';

describe('ADR-513 §rotation-ring — ROTATION_RING_CONFIG', () => {
  afterEach(() => RotationRingStore.endSession());

  it('has exactly ONE numeric «Γωνία» field → whole disc (computeRingSlices(1) = 1 slice)', () => {
    expect(ROTATION_RING_CONFIG.fields).toHaveLength(1);
    const [field] = ROTATION_RING_CONFIG.fields;
    expect(field.key).toBe('rotation-angle');
    expect(field.kind).toBe('numeric');
    expect(field.labelKey).toBe('tools.ring.rotationAngle');
    // 1 πεδίο → μία φέτα που καλύπτει όλο τον κύκλο (κλικ οπουδήποτε μέσα ανοίγει το «Γωνία»).
    expect(computeRingSlices(ROTATION_RING_CONFIG.fields.length)).toHaveLength(1);
  });

  it('uses the rotation aria label', () => {
    expect(ROTATION_RING_CONFIG.ariaLabelKey).toBe('tools.ring.rotationLabel');
  });

  it('commitNumeric locks the RAW signed angle into RotationRingStore (no normalize)', () => {
    const [field] = ROTATION_RING_CONFIG.fields;
    const ctx = { displayUnit: 'mm' as const, sceneUnits: 'mm' as const };
    field.commitNumeric?.(-30, ctx);
    expect(RotationRingStore.getLockedDeg()).toBe(-30);
    expect(field.isLocked()).toBe(true);
  });

  it('seed reflects the locked angle (fixed 2 decimals) / empty when unset', () => {
    const [field] = ROTATION_RING_CONFIG.fields;
    const ctx = { displayUnit: 'mm' as const, sceneUnits: 'mm' as const };
    expect(field.seed(ctx)).toBe('');
    field.commitNumeric?.(45, ctx);
    expect(field.seed(ctx)).toBe('45.00');
  });

  it('clearOnPlace clears the typed angle (one-shot reset SSoT)', () => {
    const [field] = ROTATION_RING_CONFIG.fields;
    const ctx = { displayUnit: 'mm' as const, sceneUnits: 'mm' as const };
    field.commitNumeric?.(90, ctx);
    field.clearOnPlace?.();
    expect(RotationRingStore.getLockedDeg()).toBeNull();
  });

  it('subscribe wires to the store (re-render on lock change)', () => {
    let fired = 0;
    const unsub = ROTATION_RING_CONFIG.subscribe(() => { fired += 1; });
    RotationRingStore.lock(10);
    expect(fired).toBeGreaterThan(0);
    unsub();
  });
});
