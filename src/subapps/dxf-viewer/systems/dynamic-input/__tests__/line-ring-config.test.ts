/**
 * Unit tests — line-ring-config (ADR-513 §line-parity): διάταξη δαχτυλιδιού ΓΡΑΜΜΗΣ
 * (Μήκος / Γωνία / Τύπος γραμμής) με reuse `DynamicInputLockStore` + `QuickStyleStore` + `LinetypeRegistry`.
 */

import { LINE_RING_CONFIG } from '../line-ring-config';
import {
  getQuickStyleSnapshot,
  resetQuickStyle,
  setQuickStyleLinetype,
} from '../../../stores/QuickStyleStore';
import type { RingUnitContext } from '../ring-config';

const CTX: RingUnitContext = { displayUnit: 'mm', sceneUnits: 'mm' };

describe('LINE_RING_CONFIG layout', () => {
  it('έχει 3 πεδία σε σειρά: Μήκος / Γωνία / Τύπος (→ 3 ίσες φέτες 120°)', () => {
    // Σειρά = φέτα (computeRingSlices)· 3 πεδία → 3×120°, μηδέν σταθερή cardinal θέση.
    expect(LINE_RING_CONFIG.fields.map((f) => f.key)).toEqual(['length', 'angle', 'linetype']);
  });

  it('aria-label = δαχτυλίδι γραμμής', () => {
    expect(LINE_RING_CONFIG.ariaLabelKey).toBe('tools.ring.lineLabel');
  });
});

describe('linetype field (select → QuickStyleStore SSoT)', () => {
  afterEach(() => resetQuickStyle());

  const linetype = () => LINE_RING_CONFIG.fields.find((f) => f.key === 'linetype')!;

  it('kind = select', () => {
    expect(linetype().kind).toBe('select');
  });

  it('options = ByLayer + ISO baseline (Continuous/Dashed/...)', () => {
    const opts = linetype().options?.() ?? [];
    const values = opts.map((o) => o.value);
    expect(values[0]).toBe('ByLayer');
    expect(values).toContain('Continuous');
    expect(values).toContain('Dashed');
    expect(values).toContain('Center');
  });

  it('seed = τρέχων linetype του QuickStyleStore', () => {
    expect(linetype().seed(CTX)).toBe('ByLayer');
    setQuickStyleLinetype('Dashed');
    expect(linetype().seed(CTX)).toBe('Dashed');
  });

  it('commitSelect γράφει στο QuickStyleStore (ίδιο SSoT με το ribbon)', () => {
    linetype().commitSelect?.('Hidden');
    expect(getQuickStyleSnapshot().linetypeName).toBe('Hidden');
  });

  it('isLocked ⇔ έχει οριστεί τύπος ≠ ByLayer', () => {
    expect(linetype().isLocked()).toBe(false);
    setQuickStyleLinetype('Center');
    expect(linetype().isLocked()).toBe(true);
  });
});
