/**
 * ADR-441 Slice 6a — `segmentKeyFromBindings` tests.
 *
 * Επαληθεύει ότι το κλειδί: (α) είναι σταθερό & συγκρίσιμο ανά grid-segment,
 * (β) αγνοεί endpoint order και `extend` (robust σε corner-fill),
 * (γ) επιστρέφει `null` για σημειακά/ελλιπή bindings (ποτέ false-cover).
 */

import { segmentKeyFromBindings, gridStripSignature } from '../foundation-grid-segments';
import type { GuideBinding } from '../../hosting/guide-binding-types';
import type { FoundationEntity } from '../../types/foundation-types';

/** Vertical X-strip bindings (X-άξονας `xId`, Y endpoints `yA`→`yB`). */
const vertical = (xId: string, yA: string, yB: string, ext = false): GuideBinding[] => [
  { guideId: xId, slot: 'start-x' },
  { guideId: xId, slot: 'end-x' },
  ext ? { guideId: yA, slot: 'start-y', extend: -100 } : { guideId: yA, slot: 'start-y' },
  ext ? { guideId: yB, slot: 'end-y', extend: 100 } : { guideId: yB, slot: 'end-y' },
];

/** Horizontal Y-strip bindings (Y-άξονας `yId`, X endpoints `xA`→`xB`). */
const horizontal = (yId: string, xA: string, xB: string): GuideBinding[] => [
  { guideId: yId, slot: 'start-y' },
  { guideId: yId, slot: 'end-y' },
  { guideId: xA, slot: 'start-x' },
  { guideId: xB, slot: 'end-x' },
];

describe('segmentKeyFromBindings', () => {
  it('vertical strip → σταθερό V|… key', () => {
    expect(segmentKeyFromBindings(vertical('x1', 'y0', 'y1'))).toBe('V|x1|y0|y1');
  });

  it('horizontal strip → σταθερό H|… key', () => {
    expect(segmentKeyFromBindings(horizontal('y1', 'x0', 'x1'))).toBe('H|y1|x0|x1');
  });

  it('endpoint order αδιάφορο (y0,y1 ≡ y1,y0)', () => {
    expect(segmentKeyFromBindings(vertical('x1', 'y1', 'y0'))).toBe(
      segmentKeyFromBindings(vertical('x1', 'y0', 'y1')),
    );
  });

  it('το `extend` (corner-fill) δεν αλλάζει το key', () => {
    expect(segmentKeyFromBindings(vertical('x0', 'y0', 'y1', true))).toBe(
      segmentKeyFromBindings(vertical('x0', 'y0', 'y1', false)),
    );
  });

  it('vertical vs horizontal με ίδια ids → διαφορετικά keys', () => {
    expect(segmentKeyFromBindings(vertical('a', 'b', 'c'))).not.toBe(
      segmentKeyFromBindings(horizontal('a', 'b', 'c')),
    );
  });

  it('σημειακό (center-based pad) → null', () => {
    expect(
      segmentKeyFromBindings([
        { guideId: 'x1', slot: 'center-x' },
        { guideId: 'y1', slot: 'center-y' },
      ]),
    ).toBeNull();
  });

  it('ελλιπή bindings (λείπει end) → null', () => {
    expect(
      segmentKeyFromBindings([
        { guideId: 'x1', slot: 'start-x' },
        { guideId: 'x1', slot: 'end-x' },
        { guideId: 'y0', slot: 'start-y' },
      ]),
    ).toBeNull();
  });

  it('κενά bindings → null', () => {
    expect(segmentKeyFromBindings([])).toBeNull();
  });
});

/** ADR-441 Slice 6 — `gridStripSignature` (grid identity + rounded geometry). */
describe('gridStripSignature', () => {
  const strip = (
    bindings: GuideBinding[],
    start: { x: number; y: number },
    end: { x: number; y: number },
  ): Pick<FoundationEntity, 'guideBindings' | 'params'> => ({
    guideBindings: bindings,
    params: {
      kind: 'strip',
      start: { x: start.x, y: start.y, z: 0 },
      end: { x: end.x, y: end.y, z: 0 },
      width: 500,
      topElevationMm: 0,
      thicknessMm: 500,
    } as FoundationEntity['params'],
  });

  it('grid strip → signature = key | start-bucket | end-bucket (ακέραιοι ×1000)', () => {
    const s = strip(vertical('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 });
    expect(gridStripSignature(s)).toBe('V|x0|y0|y1|0,0|0,4000000');
  });

  it('ίδιο φάτνωμα + ίδια γεωμετρία (sub-tol float noise) → ίδιο signature (idempotency)', () => {
    const a = strip(vertical('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 });
    const b = strip(vertical('x0', 'y0', 'y1'), { x: 0.0003, y: -0.0004 }, { x: 0, y: 4000.0002 });
    expect(gridStripSignature(a)).toBe(gridStripSignature(b)); // < tol 0.001 → ίδιο bucket
  });

  it('corner-fill extend (διαφορετικά coords) → ΔΙΑΦΟΡΕΤΙΚΟ signature', () => {
    const plain = strip(vertical('x0', 'y0', 'y1'), { x: 0, y: 0 }, { x: 0, y: 4000 });
    const extended = strip(vertical('x0', 'y0', 'y1'), { x: 0, y: -300 }, { x: 0, y: 4000 });
    expect(gridStripSignature(plain)).not.toBe(gridStripSignature(extended));
  });

  it('REGRESSION: corner-fill overhang σε κλίμακα ΜΕΤΡΩΝ (0.25) ξεχωρίζει', () => {
    // Σκηνή σε μέτρα: offsets 0/4/8, overhang width/2 = 0.25 σκηνικές μονάδες.
    // Με το παλιό tol=1 το 0.25 χανόταν → ίδιο signature → ο reconciler δεν
    // αντικαθιστούσε τη stale περιμετρική (Giorgio «εισχωρεί w/2»).
    const interior = strip(vertical('x0', 'y0', 'y1'), { x: 0, y: 4 }, { x: 0, y: 8 });
    const perimeter = strip(vertical('x0', 'y0', 'y1'), { x: 0, y: 4 }, { x: 0, y: 8.25 });
    expect(gridStripSignature(interior)).not.toBe(gridStripSignature(perimeter));
  });

  it('idempotency σε μέτρα: float θόρυβος << tol → ίδιο signature', () => {
    const a = strip(vertical('x0', 'y0', 'y1'), { x: 0, y: 4 }, { x: 0, y: 8 });
    const b = strip(vertical('x0', 'y0', 'y1'), { x: 0.0000001, y: 4 }, { x: 0, y: 8.0000002 });
    expect(gridStripSignature(a)).toBe(gridStripSignature(b));
  });

  it('μη grid-managed (χωρίς bindings) → null', () => {
    const s = strip([], { x: 0, y: 0 }, { x: 0, y: 4000 });
    expect(gridStripSignature(s)).toBeNull();
  });

  it('pad (χωρίς start/end) → null', () => {
    const pad: Pick<FoundationEntity, 'guideBindings' | 'params'> = {
      guideBindings: [{ guideId: 'x1', slot: 'center-x' }, { guideId: 'y1', slot: 'center-y' }],
      params: { kind: 'pad' } as FoundationEntity['params'],
    };
    expect(gridStripSignature(pad)).toBeNull();
  });
});
