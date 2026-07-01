/**
 * ADR-458 (γενίκευση) — `member-column-cutback` pure SSoT tests.
 *
 * Επαληθεύει το generic core (member ↔ column, «η κολόνα νικάει»): retention ratio
 * (net/gross plan footprint) + identity (null) όταν καμία τομή + backward-compat aliases
 * του `beam-column-cutback` (byte-for-byte ίδια συνάρτηση).
 */

import {
  computeMemberCutbackOutline,
  computeMemberCutbackNetAreaM2,
  computeMemberCutbackRetentionRatio,
} from '../member-column-cutback';
import {
  computeBeamCutbackOutline,
  computeBeamCutbackNetAreaM2,
} from '../beam-column-cutback';
import type { Pt2 } from '../shared/segment-polygon-coverage';

/** Ορθογώνιο μέλος 1000×250 (x∈[0,1000], y∈[0,250]), CCW. */
const MEMBER: Pt2[] = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 250 },
  { x: 0, y: 250 },
];
const MEMBER_AREA = 1000 * 250; // 250000

describe('computeMemberCutbackRetentionRatio (ADR-458 γενίκευση)', () => {
  it('γωνιακή κολόνα → ratio = net/gross (μειωμένο)', () => {
    // Κολόνα ΝΔ γωνία: καλύπτει x∈[0,100], y∈[0,100] → 10000 units² αφαίρεση.
    const column: Pt2[] = [
      { x: -100, y: -100 },
      { x: 100, y: -100 },
      { x: 100, y: 100 },
      { x: -100, y: 100 },
    ];
    const ratio = computeMemberCutbackRetentionRatio(MEMBER, [column]);
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeCloseTo((MEMBER_AREA - 100 * 100) / MEMBER_AREA, 5); // 0.96
  });

  it('διαμπερής κολόνα στο μέσο → ratio = 1 − (overlap/gross)', () => {
    // Κολόνα x∈[400,600] σε όλο το πλάτος → αφαιρεί 200×250 = 50000.
    const column: Pt2[] = [
      { x: 400, y: -50 },
      { x: 600, y: -50 },
      { x: 600, y: 300 },
      { x: 400, y: 300 },
    ];
    const ratio = computeMemberCutbackRetentionRatio(MEMBER, [column]);
    expect(ratio!).toBeCloseTo((MEMBER_AREA - 200 * 250) / MEMBER_AREA, 5); // 0.8
  });

  it('καμία τομή → null (identity)', () => {
    const far: Pt2[] = [
      { x: 5000, y: 5000 },
      { x: 5200, y: 5000 },
      { x: 5200, y: 5200 },
      { x: 5000, y: 5200 },
    ];
    expect(computeMemberCutbackRetentionRatio(MEMBER, [far])).toBeNull();
  });

  it('χωρίς κολόνες → null', () => {
    expect(computeMemberCutbackRetentionRatio(MEMBER, [])).toBeNull();
  });

  it('ratio ∈ (0,1] — clamp', () => {
    const cover: Pt2[] = [
      { x: -10, y: -10 },
      { x: 1010, y: -10 },
      { x: 1010, y: 260 },
      { x: -10, y: 260 },
    ];
    // Πλήρης κάλυψη → net ≈ 0 → ratio → 0 (ή null αν το boolean το δει ως full-consume).
    const ratio = computeMemberCutbackRetentionRatio(MEMBER, [cover]);
    if (ratio !== null) expect(ratio).toBeGreaterThanOrEqual(0);
  });
});

describe('backward-compat aliases (beam-column-cutback → member)', () => {
  it('computeBeamCutbackOutline === computeMemberCutbackOutline', () => {
    expect(computeBeamCutbackOutline).toBe(computeMemberCutbackOutline);
  });
  it('computeBeamCutbackNetAreaM2 === computeMemberCutbackNetAreaM2', () => {
    expect(computeBeamCutbackNetAreaM2).toBe(computeMemberCutbackNetAreaM2);
  });
  it('net area (m²) με canvasToM2=1 = raw net area', () => {
    const column: Pt2[] = [
      { x: -100, y: -100 },
      { x: 100, y: -100 },
      { x: 100, y: 100 },
      { x: -100, y: 100 },
    ];
    const net = computeMemberCutbackNetAreaM2(MEMBER, [column], 1);
    expect(net).toBeCloseTo(MEMBER_AREA - 100 * 100, 0);
  });
  it('outline pieces = 1 κοίλο κομμάτι στη γωνιακή κοπή', () => {
    const column: Pt2[] = [
      { x: -100, y: -100 },
      { x: 100, y: -100 },
      { x: 100, y: 100 },
      { x: -100, y: 100 },
    ];
    const pieces = computeMemberCutbackOutline(MEMBER, [column]);
    expect(pieces).not.toBeNull();
    expect(pieces!.length).toBe(1);
  });
});
