/**
 * ADR-398 §3.14 — polar-symmetry-detector tests (n-fold auto-detect + scroll override).
 */

import { detectRingFold } from '../polar-symmetry-detector';

describe('detectRingFold (ADR-398 §3.14)', () => {
  it('auto-detects 3-fold from columns at 0° and 120°, ghost = 240°', () => {
    const r = detectRingFold([0, 120], null);
    expect(r!.fold).toBe(3);
    expect(r!.ghostAnglesDeg).toEqual([240]);
    expect(r!.allAnglesDeg).toEqual([0, 120, 240]);
  });

  it('auto-detects 4-fold from 0° and 90°, ghost = 180°, 270°', () => {
    const r = detectRingFold([0, 90], null);
    expect(r!.fold).toBe(4);
    expect(r!.ghostAnglesDeg).toEqual([180, 270]);
  });

  it('complete ring → fold detected, no ghost positions', () => {
    const r = detectRingFold([0, 60, 120, 180, 240, 300], null);
    expect(r!.fold).toBe(6);
    expect(r!.ghostAnglesDeg).toEqual([]);
  });

  it('scroll override = 6 with a single seed column → full ghost set', () => {
    const r = detectRingFold([0], 6);
    expect(r!.fold).toBe(6);
    expect(r!.ghostAnglesDeg).toEqual([60, 120, 180, 240, 300]);
  });

  it('override = 8 over 0°/180° → fills the 8-fold gaps (0,180 occupied)', () => {
    const r = detectRingFold([0, 180], 8);
    expect(r!.fold).toBe(8);
    expect(r!.ghostAnglesDeg).toEqual([45, 90, 135, 225, 270, 315]);
  });

  it('null when < 2 columns and no override', () => {
    expect(detectRingFold([], null)).toBeNull();
    expect(detectRingFold([42], null)).toBeNull();
  });

  it('null when no clean symmetry (gcd → absurd fold) and no override', () => {
    expect(detectRingFold([0, 7], null)).toBeNull();
  });

  it('respects the phase of the first existing column (auto)', () => {
    // 30° and 150° → diff 120 → 3-fold from base 30 → 30/150/270.
    const r = detectRingFold([30, 150], null);
    expect(r!.fold).toBe(3);
    expect(r!.allAnglesDeg).toEqual([30, 150, 270]);
    expect(r!.ghostAnglesDeg).toEqual([270]);
  });
});
