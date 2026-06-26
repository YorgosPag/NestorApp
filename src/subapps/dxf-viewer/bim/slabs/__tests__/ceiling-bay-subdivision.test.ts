/**
 * ADR-534 Φ2 — `subdivideIntoBays`: υποδιαίρεση master region σε φατνώματα από εσωτερικούς κόπτες.
 * Επαληθεύει: χωρίς κόπτες → 1 (όλο το region)· 1 εσωτερικός → 2· σταυρός → 4· περιμετρικός
 * κόπτης (hugging) → φιλτράρεται (1)· interior classification.
 */

import type { Point2D } from '../../../rendering/types/Types';
import { subdivideIntoBays } from '../ceiling-bay-subdivision';
import { resolveRegionLoopTolWorld } from '../../walls/region-tolerance';

const M = 1000;
const TOL = resolveRegionLoopTolWorld('mm');
const MASTER: Point2D[] = [
  { x: 0, y: 0 }, { x: 12 * M, y: 0 }, { x: 12 * M, y: 12 * M }, { x: 0, y: 12 * M },
];
const seg = (sx: number, sy: number, ex: number, ey: number): [Point2D, Point2D] =>
  [{ x: sx, y: sy }, { x: ex, y: ey }];

describe('ADR-534 Φ2 — subdivideIntoBays', () => {
  it('χωρίς κόπτες → 1 φάτνωμα = όλο το region (μη εσωτερικό)', () => {
    const bays = subdivideIntoBays(MASTER, [], TOL, 'mm');
    expect(bays.length).toBe(1);
    expect(bays[0].interior).toBe(false);
    expect(bays[0].spanMm).toBeCloseTo(12 * M, 0);
  });

  it('1 εσωτερικός κατακόρυφος κόπτης (x=6m) → 2 φατνώματα', () => {
    const bays = subdivideIntoBays(MASTER, [seg(6 * M, 0, 6 * M, 12 * M)], TOL, 'mm');
    expect(bays.length).toBe(2);
    // κάθε φάτνωμα 6×12 → μικρότερη διάσταση 6m
    for (const b of bays) expect(b.spanMm).toBeCloseTo(6 * M, 0);
  });

  it('σταυρός (x=6m + y=6m) → 4 φατνώματα', () => {
    const bays = subdivideIntoBays(
      MASTER, [seg(6 * M, 0, 6 * M, 12 * M), seg(0, 6 * M, 12 * M, 6 * M)], TOL, 'mm',
    );
    expect(bays.length).toBe(4);
  });

  it('περιμετρικός κόπτης (250mm μέσα, παράλληλος στην παρειά) → φιλτράρεται → 1 φάτνωμα', () => {
    const bays = subdivideIntoBays(MASTER, [seg(0, 250, 12 * M, 250)], TOL, 'mm');
    expect(bays.length).toBe(1);
  });

  it('ασύμμετρος σταυρός → διαφορετικά spans (x=4m + y=6m)', () => {
    const bays = subdivideIntoBays(
      MASTER, [seg(4 * M, 0, 4 * M, 12 * M), seg(0, 6 * M, 12 * M, 6 * M)], TOL, 'mm',
    );
    expect(bays.length).toBe(4);
    const spans = new Set(bays.map((b) => Math.round(b.spanMm)));
    expect(spans.size).toBeGreaterThanOrEqual(2); // 4m-στενά vs 6m-φαρδιά → ≥2 διακριτά
  });
});
