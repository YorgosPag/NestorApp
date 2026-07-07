/**
 * Unit tests — perpendicular-line-ring-config (ADR-060 / ADR-513 §direct-distance-entry):
 * length-only διάταξη δαχτυλιδιού της ΚΑΘΕΤΗΣ ΓΡΑΜΜΗΣ (`line-perpendicular`).
 *
 * Καλύπτει το design decision (μετά το click-1 η διεύθυνση είναι ήδη κλειδωμένη → ΜΟΝΟ Μήκος) και
 * ότι το μοναδικό πεδίο γράφει στο ΙΔΙΟ `DynamicInputLockStore` (SSoT, κοινό με τοίχο & γραμμή).
 */

import { PERPENDICULAR_LINE_RING_CONFIG } from '../perpendicular-line-ring-config';
import { DynamicInputLockStore } from '../DynamicInputLockStore';
import type { RingUnitContext } from '../ring-config';

const CTX: RingUnitContext = { displayUnit: 'mm', sceneUnits: 'mm' };

describe('PERPENDICULAR_LINE_RING_CONFIG layout', () => {
  afterEach(() => DynamicInputLockStore.unlock());

  it('έχει ΑΚΡΙΒΩΣ 1 πεδίο «Μήκος» (→ 1 φέτα = όλος ο δίσκος)', () => {
    // Design decision: μετά το click-1 η διεύθυνση (κάθετος άξονας) είναι ήδη κλειδωμένη → μόνο απόσταση.
    expect(PERPENDICULAR_LINE_RING_CONFIG.fields.map((f) => f.key)).toEqual(['length']);
  });

  it('ΔΕΝ έχει πεδίο Γωνίας ή Τύπου (περιττά — direction locked)', () => {
    const keys = PERPENDICULAR_LINE_RING_CONFIG.fields.map((f) => f.key);
    expect(keys).not.toContain('angle');
    expect(keys).not.toContain('linetype');
  });

  it('το μοναδικό πεδίο είναι numeric με labelKey «Μήκος»', () => {
    const [length] = PERPENDICULAR_LINE_RING_CONFIG.fields;
    expect(length.kind).toBe('numeric');
    expect(length.labelKey).toBe('tools.ring.length');
  });

  it('aria-label = δαχτυλίδι κάθετης γραμμής', () => {
    expect(PERPENDICULAR_LINE_RING_CONFIG.ariaLabelKey).toBe('tools.ring.perpendicularLabel');
  });
});

describe('length field (SSoT → DynamicInputLockStore)', () => {
  afterEach(() => DynamicInputLockStore.unlock());

  const length = () => PERPENDICULAR_LINE_RING_CONFIG.fields.find((f) => f.key === 'length')!;

  it('commitNumeric κλειδώνει το μήκος στο ΚΟΙΝΟ store (mm scene = identity)', () => {
    length().commitNumeric?.(1500, CTX);
    expect(DynamicInputLockStore.getLocked().length).toBeCloseTo(1500);
  });

  it('clearOnPlace ξεκλειδώνει ΜΟΝΟ το μήκος (one-shot direct-distance-entry)', () => {
    DynamicInputLockStore.lockLength(2000);
    DynamicInputLockStore.lockAngle(90);
    length().clearOnPlace?.();
    // Το μήκος καθαρίζεται· η γωνία (αν κάπως υπήρχε) μένει — parity με `lengthRingField`.
    expect(DynamicInputLockStore.getLocked().length).toBeNull();
    expect(DynamicInputLockStore.getLocked().angle).toBeCloseTo(90);
  });

  it('isLocked ⇔ υπάρχει locked length', () => {
    expect(length().isLocked()).toBe(false);
    DynamicInputLockStore.lockLength(500);
    expect(length().isLocked()).toBe(true);
  });
});

describe('subscribe (SSoT store)', () => {
  it('συνδρομή = DynamicInputLockStore.subscribe (fire σε lock/unlock)', () => {
    let fired = 0;
    const unsub = PERPENDICULAR_LINE_RING_CONFIG.subscribe(() => { fired += 1; });
    DynamicInputLockStore.lockLength(750);
    DynamicInputLockStore.unlock();
    unsub();
    expect(fired).toBeGreaterThanOrEqual(2);
  });
});
