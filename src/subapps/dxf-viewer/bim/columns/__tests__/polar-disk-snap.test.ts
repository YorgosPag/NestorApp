/**
 * ADR-398 §3.13 — polar-disk-snap (Polar Magnet) pure resolver tests.
 *
 * Επαληθεύει: nice-absolute ring quantization, Shift κλάσματα ακτίνας, zoom-adaptive nice γωνία,
 * center snap, edge-clearance → null στο χείλος, faceFrame arc (R/θ dims), grid + findDiskContaining.
 */

import {
  resolvePolarDiskSnap,
  buildPolarDiskGrid,
  findDiskContaining,
  polarClearanceScene,
  type PolarDisk,
} from '../polar-disk-snap';

const DISK: PolarDisk = { center: { x: 0, y: 0 }, radius: 3000 };
// worldPerPixel=20 → adaptiveDistanceStep = niceRound(20·25)=niceRound(500)=500 (ring step).
const WPP = 20;
// clearance 250 → maxRing = 3000−250 = 2750 → δακτύλιοι 500/1000/1500/2000/2500.
const OPTS = { worldPerPixel: WPP, clearanceScene: 250 };

describe('resolvePolarDiskSnap (ADR-398 §3.13)', () => {
  it('snaps to CENTER when cursor is within the center capture radius', () => {
    const r = resolvePolarDiskSnap({ x: 5, y: 5 }, DISK, 'mm', OPTS);
    expect(r).not.toBeNull();
    expect(r!.isCenter).toBe(true);
    expect(r!.position).toEqual({ x: 0, y: 0 });
    expect(r!.ringR).toBe(0);
  });

  it('snaps to nearest nice-absolute ring (multiple of adaptive step)', () => {
    // cursor κατά μήκος +X σε dist 1230 → πλησιέστερος δακτύλιος 1000 (|230| < |270| προς 1500).
    const r = resolvePolarDiskSnap({ x: 1230, y: 0 }, DISK, 'mm', OPTS);
    expect(r!.ringR).toBe(1000);
    expect(r!.angleDeg).toBe(0); // ακριβώς στον +X άξονα
    expect(r!.position.x).toBeCloseTo(1000, 6);
    expect(r!.position.y).toBeCloseTo(0, 6);
  });

  it('snaps the angle to a nice increment (zoom-adaptive arc-length)', () => {
    // Στον δακτύλιο 1000: arcStep 500 / circ 2π·1000 → ~28.6° → nearest nice = 30°.
    // cursor σε γωνία 47° → round(47/30)·30 = 60°.
    const a = (47 * Math.PI) / 180;
    const r = resolvePolarDiskSnap({ x: 1000 * Math.cos(a), y: 1000 * Math.sin(a) }, DISK, 'mm', OPTS);
    expect(r!.ringR).toBe(1000);
    expect(r!.angleDeg).toBe(60);
  });

  it('Shift → rings on radius fractions (R/4…3R/4)', () => {
    // fractions: 750/1000/1500/2000/2250 (όλα ≤ maxRing). dist 1100 → πλησιέστερο 1000.
    const r = resolvePolarDiskSnap({ x: 1100, y: 0 }, DISK, 'mm', { ...OPTS, shiftFractions: true });
    expect(r!.ringR).toBe(1000);
  });

  it('returns null near the rim (beyond maxRing → §3.12 circumference takes over)', () => {
    expect(resolvePolarDiskSnap({ x: 2900, y: 0 }, DISK, 'mm', OPTS)).toBeNull();
  });

  it('returns null when the disk is too small for any ring', () => {
    const tiny: PolarDisk = { center: { x: 0, y: 0 }, radius: 100 };
    expect(resolvePolarDiskSnap({ x: 50, y: 50 }, tiny, 'mm', { worldPerPixel: WPP, clearanceScene: 250 })).toBeNull();
  });

  it('faceFrame carries the ring arc (radius = ringR) → R/θ listening dims via §3.12', () => {
    const r = resolvePolarDiskSnap({ x: 1480, y: 0 }, DISK, 'mm', OPTS);
    expect(r!.ringR).toBe(1500);
    expect(r!.faceFrame.arc).toBeDefined();
    expect(r!.faceFrame.arc!.radius).toBe(1500);
    expect(r!.faceFrame.arc!.center).toEqual({ x: 0, y: 0 });
  });
});

describe('buildPolarDiskGrid (ADR-398 §3.13 overlay)', () => {
  it('returns all rings ≤ maxRing + spokes at the active-ring density', () => {
    const grid = buildPolarDiskGrid({ x: 1000, y: 0 }, DISK, 'mm', OPTS);
    expect(grid).not.toBeNull();
    expect(grid!.rings).toEqual([500, 1000, 1500, 2000, 2500]);
    expect(grid!.outerR).toBe(2500);
    // active ring 1000 → 30° step → 12 spokes (360/30).
    expect(grid!.spokesDeg.length).toBe(12);
    expect(grid!.spokesDeg[0]).toBe(0);
  });
});

describe('findDiskContaining', () => {
  it('returns the disk that contains the cursor, null otherwise', () => {
    expect(findDiskContaining({ x: 100, y: 100 }, [DISK])).toBe(DISK);
    expect(findDiskContaining({ x: 5000, y: 0 }, [DISK])).toBeNull();
  });
});

describe('polarClearanceScene', () => {
  it('= cover(50) + half-diagonal of the column (mm scene units)', () => {
    // 400×400 → halfDiag = 0.5·hypot(400,400) ≈ 282.84 → clearance ≈ 332.84.
    expect(polarClearanceScene(400, 400, 'mm')).toBeCloseTo(50 + 0.5 * Math.hypot(400, 400), 4);
  });
});
