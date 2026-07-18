/**
 * ADR-513 §opening-width (mm unit fix) — το ring πλάτους κουφώματος ερμηνεύει την πληκτρολογούμενη
 * τιμή σε **mm** (ίδια μονάδα με το ribbon «Πλάτος»: 700/800/900… mm), ΟΧΙ στη global display μονάδα
 * (π.χ. cm). Regression guard: `10` → lock 10mm (scene=mm), ΟΧΙ 100 (cm→mm).
 */

import { OPENING_WIDTH_RING_CONFIG } from '../opening-width-ring-config';
import { DynamicInputLockStore } from '../DynamicInputLockStore';
import type { DisplayUnit } from '../../../config/units';
import type { SceneUnits } from '../../../utils/scene-units';

const CTX = { displayUnit: 'cm' as DisplayUnit, sceneUnits: 'mm' as SceneUnits };

describe('ADR-513 §opening-width — OPENING_WIDTH_RING_CONFIG (mm-native)', () => {
  afterEach(() => DynamicInputLockStore.unlock());

  it('έχει ΕΝΑ πεδίο «Μήκος»', () => {
    expect(OPENING_WIDTH_RING_CONFIG.fields).toHaveLength(1);
    expect(OPENING_WIDTH_RING_CONFIG.fields[0].key).toBe('length');
  });

  it('η πληκτρολογούμενη τιμή = mm (scene=mm → lock === value), ΟΧΙ cm (×10)', () => {
    OPENING_WIDTH_RING_CONFIG.fields[0].commitNumeric?.(10, CTX);
    expect(DynamicInputLockStore.getLocked().length).toBe(10); // 10mm — ΟΧΙ 100 (αν ήταν cm)
  });

  it('seed: locked scene → mm string', () => {
    DynamicInputLockStore.lockLength(250);
    expect(OPENING_WIDTH_RING_CONFIG.fields[0].seed(CTX)).toBe('250');
  });

  it('clearOnPlace ξεκλειδώνει το μήκος', () => {
    DynamicInputLockStore.lockLength(80);
    OPENING_WIDTH_RING_CONFIG.fields[0].clearOnPlace?.();
    expect(DynamicInputLockStore.getLocked().length).toBeNull();
  });
});
