/**
 * ADR-441 Slice GEN — shared slot-writers tests.
 *
 * Ένα-και-μόνο SSoT slot→coordinate writer για foundation/wall/column. Καλύπτει: line
 * slots (start/end x/y), point slots (center x/y), σταθερό `extend` (mm→scene), only-changed
 * null semantics, αγνόηση undefined offsets.
 */

import { deriveLineSlots, derivePointSlots, type GuideOffsetLookup } from '../derive-slots';
import type { GuideBinding } from '../guide-binding-types';

const lookup = (offsets: Record<string, number>): GuideOffsetLookup =>
  (id) => (id in offsets ? offsets[id] : undefined);

describe('deriveLineSlots', () => {
  const bindings: GuideBinding[] = [
    { guideId: 'xA', slot: 'start-x' },
    { guideId: 'xB', slot: 'end-x' },
    { guideId: 'yA', slot: 'start-y' },
    { guideId: 'yB', slot: 'end-y' },
  ];

  it('γράφει τα 4 endpoints από τα guide offsets', () => {
    const r = deriveLineSlots({ x: 0, y: 0 }, { x: 0, y: 0 }, bindings, lookup({ xA: 100, xB: 900, yA: 50, yB: 750 }), 1);
    expect(r).toEqual({ start: { x: 100, y: 50 }, end: { x: 900, y: 750 } });
  });

  it('only-changed: null όταν τα offsets ταυτίζονται με τις τρέχουσες συντεταγμένες', () => {
    const r = deriveLineSlots({ x: 100, y: 50 }, { x: 900, y: 750 }, bindings, lookup({ xA: 100, xB: 900, yA: 50, yB: 750 }), 1);
    expect(r).toBeNull();
  });

  it('εφαρμόζει το extend (mm) μέσω του scale', () => {
    const ext: GuideBinding[] = [{ guideId: 'xA', slot: 'start-x', extend: 300 }];
    // scale 0.001 (mm→m): 300mm * 0.001 = 0.3 → target = offset(2) + 0.3
    const r = deriveLineSlots({ x: 0, y: 0 }, { x: 0, y: 0 }, ext, lookup({ xA: 2 }), 0.001);
    expect(r?.start.x).toBeCloseTo(2.3, 6);
  });

  it('αγνοεί slot με undefined offset (διαγραμμένος/XZ άξονας)', () => {
    const r = deriveLineSlots({ x: 5, y: 0 }, { x: 0, y: 0 }, bindings, lookup({ xB: 900, yA: 50, yB: 750 }), 1);
    expect(r?.start.x).toBe(5); // xA λείπει → κρατά το committed x
  });
});

describe('derivePointSlots', () => {
  const bindings: GuideBinding[] = [
    { guideId: 'cx', slot: 'center-x' },
    { guideId: 'cy', slot: 'center-y' },
  ];

  it('γράφει center-x/center-y από τα offsets', () => {
    const r = derivePointSlots({ x: 0, y: 0 }, bindings, lookup({ cx: 400, cy: 250 }), 1);
    expect(r).toEqual({ x: 400, y: 250 });
  });

  it('only-changed: null όταν δεν αλλάζει τίποτα', () => {
    const r = derivePointSlots({ x: 400, y: 250 }, bindings, lookup({ cx: 400, cy: 250 }), 1);
    expect(r).toBeNull();
  });
});
