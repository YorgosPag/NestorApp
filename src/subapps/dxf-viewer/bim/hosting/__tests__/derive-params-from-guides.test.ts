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

describe('deriveFoundationParamsFromGuides — extend (corner-fill, ADR-441 Slice JOIN)', () => {
  // Γωνιακή κατακόρυφη λωρίδα: start-y με extend=-300 (προς τα κάτω/έξω).
  const corner: GuideBinding[] = [
    { guideId: 'xId', slot: 'start-x' },
    { guideId: 'xId', slot: 'end-x' },
    { guideId: 'yA', slot: 'start-y', extend: -300 },
    { guideId: 'yB', slot: 'end-y' },
  ];

  it('εφαρμόζει το extend (mm→scene) στο coordinate: start.y = offset - 300', () => {
    const next = deriveFoundationParamsFromGuides(
      stripParams({ start: { x: 0, y: -300, z: 0 } }),
      corner,
      lookup({ xId: 2500, yA: 0, yB: 4000 }),
    ) as StripFootingParams;
    expect(next.start.x).toBe(2500);
    expect(next.start.y).toBe(-300); // 0 + (-300 * 1mm-scale)
  });

  it('follow-move: re-derive μετά μετακίνηση άξονα διατηρεί το extend (γωνία μένει κλειστή)', () => {
    const next = deriveFoundationParamsFromGuides(
      stripParams({ start: { x: 0, y: -300, z: 0 }, end: { x: 0, y: 4000, z: 0 } }),
      corner,
      lookup({ xId: 0, yA: 1000, yB: 4000 }), // yA μετακινήθηκε 0→1000
    ) as StripFootingParams;
    expect(next.start.y).toBe(700); // 1000 + (-300) → εξακολουθεί stand-off w/2
  });

  it('idempotent με extend: ίδια offsets + ήδη-extended coordinate → null', () => {
    const next = deriveFoundationParamsFromGuides(
      stripParams({ start: { x: 0, y: -300, z: 0 }, end: { x: 0, y: 4000, z: 0 } }),
      corner,
      lookup({ xId: 0, yA: 0, yB: 4000 }),
    );
    expect(next).toBeNull();
  });

  it('extend respects sceneUnits (m): -300mm → -0.3 scene units', () => {
    const next = deriveFoundationParamsFromGuides(
      stripParams({ sceneUnits: 'm', start: { x: 0, y: -0.3, z: 0 }, end: { x: 0, y: 4, z: 0 } }),
      corner,
      lookup({ xId: 0, yA: 1, yB: 4 }), // yA 0→1 (m)
    ) as StripFootingParams;
    expect(next.start.y).toBeCloseTo(0.7, 9); // 1 + (-300 * 0.001)
  });
});

describe('deriveFoundationParamsFromGuides — justification follow-move-safe (ADR-441 Slice 5a)', () => {
  const bindings: GuideBinding[] = [
    { guideId: 'xId', slot: 'start-x' },
    { guideId: 'xId', slot: 'end-x' },
    { guideId: 'yA', slot: 'start-y' },
    { guideId: 'yB', slot: 'end-y' },
  ];

  it('re-derive μετά μετακίνηση άξονα ΔΙΑΤΗΡΕΙ το justification (param επιβιώνει του spread)', () => {
    const next = deriveFoundationParamsFromGuides(
      stripParams({ justification: 'left', start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 4000, z: 0 } }),
      bindings,
      lookup({ xId: 2500, yA: 0, yB: 4000 }), // ο κατακόρυφος άξονας μετακινήθηκε
    ) as StripFootingParams;
    expect(next).not.toBeNull();
    expect(next.start.x).toBe(2500);
    expect(next.justification).toBe('left'); // η εκκεντρότητα δεν χάνεται στο follow-move
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
