/**
 * ADR-408 Φ-B1 — MEP segment completion elevation cascade tests.
 *
 * `buildDefaultMepSegmentParams` resolves each endpoint's authoritative z from the
 * connector-mate snap elevations (mm) via the Revit "Connect To" cascade:
 *   - neither end snapped        → both at the centreline default.
 *   - one end snapped, other free → the free end FOLLOWS the snapped one (flat run).
 *   - both ends snapped          → each keeps its own (sloped riser).
 * `centerlineElevationMm` is kept as the derived midpoint cache (Φ-A).
 */

import { buildDefaultMepSegmentParams } from '../mep-segment-completion';

const A = { x: 0, y: 0 };
const B = { x: 1000, y: 0 };

describe('buildDefaultMepSegmentParams — connector-mate elevation cascade', () => {
  it('neither end snapped → both at the centreline default (2800)', () => {
    const p = buildDefaultMepSegmentParams(A, B, 'pipe');
    expect(p.startPoint.z).toBe(2800);
    expect(p.endPoint.z).toBe(2800);
    expect(p.centerlineElevationMm).toBe(2800);
  });

  it('neither end snapped, override centreline → both follow the override', () => {
    const p = buildDefaultMepSegmentParams(A, B, 'pipe', { centerlineElevationMm: 1000 });
    expect(p.startPoint.z).toBe(1000);
    expect(p.endPoint.z).toBe(1000);
    expect(p.centerlineElevationMm).toBe(1000);
  });

  it('start snapped (400), end free → free end FOLLOWS the snap (flat @400)', () => {
    const p = buildDefaultMepSegmentParams(A, B, 'pipe', {}, 'mm', 400, null);
    expect(p.startPoint.z).toBe(400);
    expect(p.endPoint.z).toBe(400);
    expect(p.centerlineElevationMm).toBe(400);
  });

  it('end snapped (2800), start free → free start FOLLOWS the snap (flat @2800)', () => {
    const p = buildDefaultMepSegmentParams(A, B, 'pipe', {}, 'mm', null, 2800);
    expect(p.startPoint.z).toBe(2800);
    expect(p.endPoint.z).toBe(2800);
    expect(p.centerlineElevationMm).toBe(2800);
  });

  it('both ends snapped (400 → 2800) → sloped riser, centreline is the midpoint', () => {
    const p = buildDefaultMepSegmentParams(A, B, 'pipe', {}, 'mm', 400, 2800);
    expect(p.startPoint.z).toBe(400);
    expect(p.endPoint.z).toBe(2800);
    expect(p.centerlineElevationMm).toBe(1600);
  });

  it('plan x/y are preserved (elevation only touches z)', () => {
    const p = buildDefaultMepSegmentParams(A, B, 'pipe', {}, 'mm', 400, 2800);
    expect(p.startPoint.x).toBe(0);
    expect(p.startPoint.y).toBe(0);
    expect(p.endPoint.x).toBe(1000);
    expect(p.endPoint.y).toBe(0);
  });
});

describe('buildDefaultMepSegmentParams — ADR-408 Φ14 drainage classification + slope', () => {
  it('propagates classification + slope for a pipe (drainage preset)', () => {
    const p = buildDefaultMepSegmentParams(A, B, 'pipe', {
      classification: 'sanitary-drainage',
      slopePercent: 1.5,
    });
    expect(p.classification).toBe('sanitary-drainage');
    expect(p.slopePercent).toBe(1.5);
  });

  it('omits classification + slope when not supplied (plain water pipe)', () => {
    const p = buildDefaultMepSegmentParams(A, B, 'pipe');
    expect(p.classification).toBeUndefined();
    expect(p.slopePercent).toBeUndefined();
  });

  it('ignores the drainage hints for a duct (mechanical domain)', () => {
    const p = buildDefaultMepSegmentParams(A, B, 'duct', {
      classification: 'sanitary-drainage',
      slopePercent: 2,
    });
    expect(p.classification).toBeUndefined();
    expect(p.slopePercent).toBeUndefined();
  });
});

describe('buildDefaultMepSegmentParams — ADR-408 Φ14 #2 born-sloped creation', () => {
  // A=(0,0) B=(1000,0); 'mm' scene ⇒ 1 canvas unit = 1 mm ⇒ plan run = 1000 mm.
  it('free end + slope preset → born sloped (anchor start, end falls by planLen·%)', () => {
    const p = buildDefaultMepSegmentParams(A, B, 'pipe', { slopePercent: 1.5 });
    // default centreline 2800 anchors the start; end drops 1000·1.5/100 = 15 mm.
    expect(p.startPoint.z).toBe(2800);
    expect(p.endPoint.z).toBeCloseTo(2785, 6);
    expect(p.centerlineElevationMm).toBeCloseTo(2792.5, 6);
  });

  it('start snapped (400) + free end + slope → anchored at the snap, end falls', () => {
    const p = buildDefaultMepSegmentParams(A, B, 'pipe', { slopePercent: 2 }, 'mm', 400, null);
    expect(p.startPoint.z).toBe(400);
    expect(p.endPoint.z).toBeCloseTo(380, 6); // 400 − 1000·2/100
  });

  it('BOTH ends snapped to DISTINCT elevations → snaps WIN (slope NOT applied)', () => {
    const p = buildDefaultMepSegmentParams(A, B, 'pipe', { slopePercent: 1.5 }, 'mm', 400, 2800);
    expect(p.startPoint.z).toBe(400);
    expect(p.endPoint.z).toBe(2800); // network geometry preserved, not overridden
  });

  it('slope 0 → flat (no fall)', () => {
    const p = buildDefaultMepSegmentParams(A, B, 'pipe', { slopePercent: 0 });
    expect(p.startPoint.z).toBe(2800);
    expect(p.endPoint.z).toBe(2800);
  });

  it('duct ignores slope → flat (mechanical domain)', () => {
    const p = buildDefaultMepSegmentParams(A, B, 'duct', { slopePercent: 2 });
    expect(p.startPoint.z).toBe(2800);
    expect(p.endPoint.z).toBe(2800);
  });
});
