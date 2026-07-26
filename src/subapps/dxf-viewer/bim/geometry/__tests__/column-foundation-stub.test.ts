/**
 * ADR-712 — σχήμα ποσοτήτων κολώνας gross/net/stub (pure SSoT).
 *
 * Το κρίσιμο συμβόλαιο: `gross = net + stub` ΠΑΝΤΑ, και το stub **ποτέ αρνητικό** — ένα
 * πέδιλο ψηλότερα από τη βάση δεν «αφαιρεί» κολώνα. Το clamp είναι το ίδιο με τον 3Δ πυρήνα
 * (`Math.max(0, nominalBaseAbsMm - effectiveBaseZmm)`), ώστε render και επιμέτρηση να μη
 * μπορούν να αποκλίνουν.
 */

import { computeColumnFoundationStub, hasFoundationStub } from '../column-foundation-stub';

// Κολώνα 400×400 (0,16 m²) × 3,0m ανωδομής → net 0,48 m³.
const AREA_M2 = 0.16;
const NET_M3 = 0.48;

describe('computeColumnFoundationStub (ADR-712)', () => {
  it('drop 1000mm → stub 0,16 m³ και gross = net + stub', () => {
    const q = computeColumnFoundationStub(NET_M3, AREA_M2, 1000);
    expect(q.baseDropMm).toBe(1000);
    expect(q.stubVolumeM3).toBeCloseTo(0.16, 6);
    expect(q.netVolumeM3).toBeCloseTo(NET_M3, 6);
    expect(q.grossVolumeM3).toBeCloseTo(NET_M3 + 0.16, 6);
    expect(q.grossVolumeM3).toBeCloseTo(q.netVolumeM3 + q.stubVolumeM3, 9);
  });

  it('καμία έδραση (drop 0) → μηδενικό stub, gross === net (byte-for-byte το παλιό)', () => {
    const q = computeColumnFoundationStub(NET_M3, AREA_M2, 0);
    expect(q.stubVolumeM3).toBe(0);
    expect(q.grossVolumeM3).toBeCloseTo(NET_M3, 9);
    expect(hasFoundationStub(q)).toBe(false);
  });

  it('ΑΡΝΗΤΙΚΟ drop (πέδιλο ψηλότερα από τη βάση) → clamp στο 0, ΠΟΤΕ αφαίρεση όγκου', () => {
    const q = computeColumnFoundationStub(NET_M3, AREA_M2, -750);
    expect(q.baseDropMm).toBe(0);
    expect(q.stubVolumeM3).toBe(0);
    // Το κρίσιμο: ο gross ΔΕΝ πέφτει κάτω από τον net.
    expect(q.grossVolumeM3).toBeCloseTo(NET_M3, 9);
    expect(q.grossVolumeM3).toBeGreaterThanOrEqual(q.netVolumeM3);
  });

  it('shaped διατομή (Γ) — το stub παίρνει το ΙΔΙΟ εμβαδό με την κολώνα, όχι bbox', () => {
    // Γ-τομή 600×600 με βραχίονες → πραγματικό εμβαδό 0,20 m² (< 0,36 του bbox).
    const q = computeColumnFoundationStub(0.6, 0.2, 1000);
    expect(q.stubVolumeM3).toBeCloseTo(0.2, 6);
    expect(q.grossVolumeM3).toBeCloseTo(0.8, 6);
  });

  it('degenerate είσοδοι (NaN / Infinity / αρνητικά) → 0, χωρίς NaN διαρροή', () => {
    const nan = computeColumnFoundationStub(Number.NaN, AREA_M2, 1000);
    expect(nan.netVolumeM3).toBe(0);
    expect(Number.isNaN(nan.grossVolumeM3)).toBe(false);

    const inf = computeColumnFoundationStub(NET_M3, AREA_M2, Number.POSITIVE_INFINITY);
    expect(inf.stubVolumeM3).toBe(0);

    const negArea = computeColumnFoundationStub(NET_M3, -1, 1000);
    expect(negArea.stubVolumeM3).toBe(0);
  });

  it('hasFoundationStub — μόνο θετικός όγκος περνά (undefined / μηδέν → false)', () => {
    expect(hasFoundationStub(undefined)).toBe(false);
    expect(hasFoundationStub(computeColumnFoundationStub(NET_M3, AREA_M2, 0))).toBe(false);
    expect(hasFoundationStub(computeColumnFoundationStub(NET_M3, AREA_M2, 1))).toBe(true);
  });
});
