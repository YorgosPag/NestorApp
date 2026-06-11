/**
 * ADR-441 Slice 3 — `deriveFoundationParamsFromGuides` tests.
 *
 * Pure slot→coordinate writer. Καλύπτει: κάθε slot → σωστό coordinate (strip),
 * pad center-x/y, idempotent (ίδια offsets → null), partial change, deleted/XZ
 * guide (offset undefined → slot αγνοείται, κρατά παλιό coordinate).
 */

import { deriveFoundationParamsFromGuides, type GuideOffsetLookup } from '../derive-params-from-guides';
import type { GuideBinding } from '../guide-binding-types';
import type {
  PadFootingParams,
  StripFootingParams,
} from '../../types/foundation-types';

const stripParams = (over: Partial<StripFootingParams> = {}): StripFootingParams => ({
  kind: 'strip',
  topElevationMm: -1000,
  thicknessMm: 400,
  start: { x: 0, y: 0, z: 0 },
  end: { x: 0, y: 4000, z: 0 },
  width: 600,
  ...over,
});

const padParams = (over: Partial<PadFootingParams> = {}): PadFootingParams => ({
  kind: 'pad',
  topElevationMm: -1000,
  thicknessMm: 500,
  position: { x: 1000, y: 2000, z: 0 },
  width: 1500,
  length: 1500,
  rotation: 0,
  anchor: 'center',
  profile: 'flat',
  ...over,
});

/** Lookup από ένα απλό object. Missing key → undefined. */
const lookup = (offsets: Record<string, number>): GuideOffsetLookup =>
  (id) => offsets[id];

describe('deriveFoundationParamsFromGuides — strip (line-based)', () => {
  // X-strip: start-x & end-x → άξονας X (xId)· start-y → yA· end-y → yB.
  const bindings: GuideBinding[] = [
    { guideId: 'xId', slot: 'start-x' },
    { guideId: 'xId', slot: 'end-x' },
    { guideId: 'yA', slot: 'start-y' },
    { guideId: 'yB', slot: 'end-y' },
  ];

  it('γράφει το νέο X offset και στα δύο άκρα (μετακίνηση κατακόρυφου άξονα)', () => {
    const next = deriveFoundationParamsFromGuides(
      stripParams({ start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 4000, z: 0 } }),
      bindings,
      lookup({ xId: 2500, yA: 0, yB: 4000 }),
    ) as StripFootingParams;
    expect(next).not.toBeNull();
    expect(next.start.x).toBe(2500);
    expect(next.end.x).toBe(2500);
    expect(next.start.y).toBe(0);
    expect(next.end.y).toBe(4000);
  });

  it('γράφει νέο end-y (αλλαγή φατνώματος) κρατώντας τα υπόλοιπα', () => {
    const next = deriveFoundationParamsFromGuides(
      stripParams(),
      bindings,
      lookup({ xId: 0, yA: 0, yB: 5000 }),
    ) as StripFootingParams;
    expect(next.end.y).toBe(5000);
    expect(next.start.y).toBe(0);
  });

  it('idempotent: ίδια offsets → null (no-op)', () => {
    const next = deriveFoundationParamsFromGuides(
      stripParams(),
      bindings,
      lookup({ xId: 0, yA: 0, yB: 4000 }),
    );
    expect(next).toBeNull();
  });

  it('διαγραμμένος/XZ άξονας (offset undefined) → slot αγνοείται, κρατά παλιό coordinate', () => {
    const next = deriveFoundationParamsFromGuides(
      stripParams(),
      bindings,
      lookup({ yA: 0, yB: 9000 }), // xId missing
    ) as StripFootingParams;
    expect(next).not.toBeNull();
    expect(next.start.x).toBe(0);   // xId missing → unchanged
    expect(next.end.y).toBe(9000);  // yB moved
  });

  it('immutable: δεν mutate-άρει το input', () => {
    const input = stripParams();
    const snapshot = JSON.parse(JSON.stringify(input));
    deriveFoundationParamsFromGuides(input, bindings, lookup({ xId: 7777, yA: 0, yB: 4000 }));
    expect(input).toEqual(snapshot);
  });

  it('preserves z + width + thickness (μόνο x/y γράφονται)', () => {
    const next = deriveFoundationParamsFromGuides(
      stripParams({ start: { x: 0, y: 0, z: 42 }, end: { x: 0, y: 4000, z: 42 } }),
      bindings,
      lookup({ xId: 1000, yA: 0, yB: 4000 }),
    ) as StripFootingParams;
    expect(next.start.z).toBe(42);
    expect(next.width).toBe(600);
    expect(next.thicknessMm).toBe(400);
  });
});

describe('deriveFoundationParamsFromGuides — pad (point-based)', () => {
  const bindings: GuideBinding[] = [
    { guideId: 'cx', slot: 'center-x' },
    { guideId: 'cy', slot: 'center-y' },
  ];

  it('γράφει center-x/center-y από τα offsets', () => {
    const next = deriveFoundationParamsFromGuides(
      padParams({ position: { x: 1000, y: 2000, z: 0 } }),
      bindings,
      lookup({ cx: 3000, cy: 6000 }),
    ) as PadFootingParams;
    expect(next.position.x).toBe(3000);
    expect(next.position.y).toBe(6000);
  });

  it('idempotent → null', () => {
    const next = deriveFoundationParamsFromGuides(
      padParams({ position: { x: 3000, y: 6000, z: 0 } }),
      bindings,
      lookup({ cx: 3000, cy: 6000 }),
    );
    expect(next).toBeNull();
  });
});
